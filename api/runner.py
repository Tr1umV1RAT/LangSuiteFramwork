import asyncio
import contextlib
import json
import logging
import sys
import importlib
import types
import tempfile
import os
import traceback
import shutil
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from core.schemas import GraphPayload
from core.mode_contracts import infer_project_mode, is_mode_runtime_enabled
from core.bridge_lowering import BridgeLoweringError, validate_embedded_native_reference
from core.compiler import compile_graph
from core.runtime_dependencies import find_missing_runtime_dependencies, format_missing_runtime_dependency_message
from core.runtime_preflight import find_runtime_preflight_issues, format_runtime_preflight_message
from core.runtime_truth import with_runtime_event, extract_reason_code, normalize_reason_code

logger = logging.getLogger(__name__)
TRUTH_ENVELOPE_VERSION = "runtime_truth_v1"


def _truth_envelope(event_type: str, **extra):
    envelope = {"truthEnvelopeVersion": TRUTH_ENVELOPE_VERSION, "eventType": event_type}
    envelope.update({k: v for k, v in extra.items() if v is not None})
    return envelope


router = APIRouter(prefix="/api", tags=["runner"])

# Generated subgraph execution currently depends on the process-global "graph" module alias.
# To avoid cross-run contamination in a single process, only one runtime session may actively
# own that alias at a time. This is a containment measure, not a full multi-worker redesign.
RUNNER_EXECUTION_LOCK = asyncio.Lock()


def _extract_and_load_graph(payload: GraphPayload):
    import zipfile

    zip_buffer = compile_graph(payload)
    tmp_dir = tempfile.mkdtemp(prefix="langgraph_run_")
    project_dir = os.path.join(tmp_dir, payload.graph_id)

    with zipfile.ZipFile(zip_buffer, "r") as zf:
        zf.extractall(tmp_dir)

    graph_module_name = f"_runner_graph_{uuid.uuid4().hex}"
    previous_modules = {name: sys.modules.get(name) for name in ("state", "tools", "nodes")}
    previous_graph_module = sys.modules.get("graph")
    added_sys_path = False

    try:
        if project_dir not in sys.path:
            sys.path.insert(0, project_dir)
            added_sys_path = True

        state_spec = importlib.util.spec_from_file_location("state", os.path.join(project_dir, "state.py"))
        state_mod = importlib.util.module_from_spec(state_spec)
        sys.modules["state"] = state_mod
        state_spec.loader.exec_module(state_mod)

        tools_spec = importlib.util.spec_from_file_location("tools", os.path.join(project_dir, "tools.py"))
        tools_mod = importlib.util.module_from_spec(tools_spec)
        sys.modules["tools"] = tools_mod
        tools_spec.loader.exec_module(tools_mod)

        nodes_spec = importlib.util.spec_from_file_location("nodes", os.path.join(project_dir, "nodes.py"))
        nodes_mod = importlib.util.module_from_spec(nodes_spec)
        sys.modules["nodes"] = nodes_mod
        nodes_spec.loader.exec_module(nodes_mod)

        graph_spec = importlib.util.spec_from_file_location(graph_module_name, os.path.join(project_dir, "graph.py"))
        graph_mod = importlib.util.module_from_spec(graph_spec)
        sys.modules[graph_module_name] = graph_mod
        sys.modules["graph"] = graph_mod
        graph_spec.loader.exec_module(graph_mod)
        graph_runtime_settings = getattr(graph_mod, "GRAPH_RUNTIME_SETTINGS", {})
        runtime_context = {}
        for entry in graph_runtime_settings.get("runtimeContext", []) or []:
            if isinstance(entry, dict):
                key = str(entry.get("key") or "").strip()
                if key:
                    runtime_context[key] = entry.get("value")
        return {
            "graph": graph_mod.graph,
            "bootstrap_state": getattr(state_mod, "bootstrap_state", lambda value=None: value or {}),
            "graph_runtime_settings": graph_runtime_settings,
            "runtime_context": runtime_context,
            "external_artifacts": getattr(graph_mod, "GRAPH_EXTERNAL_ARTIFACTS", []),
            "tmp_dir": tmp_dir,
            "project_dir": project_dir,
            "graph_module_name": graph_module_name,
            "graph_module": graph_mod,
            "previous_graph_module": previous_graph_module,
        }
    finally:
        for name, previous in previous_modules.items():
            if previous is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = previous
        if added_sys_path and project_dir in sys.path:
            try:
                sys.path.remove(project_dir)
            except ValueError:
                pass


def _purge_generated_modules(project_dir: str | None) -> None:
    if not project_dir:
        return
    project_root = os.path.abspath(project_dir)
    to_remove: list[str] = []
    for module_name, module in list(sys.modules.items()):
        module_file = getattr(module, '__file__', None)
        if not module_file:
            continue
        try:
            module_path = os.path.abspath(module_file)
        except OSError:
            continue
        if module_path.startswith(project_root):
            to_remove.append(module_name)
    for module_name in to_remove:
        sys.modules.pop(module_name, None)


def _cleanup_loaded_graph(runtime_ctx):
    if not runtime_ctx:
        return

    graph_module_name = runtime_ctx.get("graph_module_name")
    graph_module = runtime_ctx.get("graph_module")
    previous_graph_module = runtime_ctx.get("previous_graph_module")
    tmp_dir = runtime_ctx.get("tmp_dir")
    project_dir = runtime_ctx.get("project_dir")

    if graph_module_name:
        sys.modules.pop(graph_module_name, None)

    _purge_generated_modules(project_dir)

    current_graph_module = sys.modules.get("graph")
    if previous_graph_module is None:
        if current_graph_module is graph_module:
            sys.modules.pop("graph", None)
    else:
        sys.modules["graph"] = previous_graph_module

    if tmp_dir:
        shutil.rmtree(tmp_dir, ignore_errors=True)


async def _stream_graph(app, inputs, config, ws: WebSocket, stream_mode: str = "updates", embedded_nodes_meta: dict[str, dict] | None = None, runtime_context: dict | None = None):
    embedded_nodes_meta = embedded_nodes_meta or {}
    embedded_started: set[str] = set()
    try:
        stream_kwargs = {"stream_mode": stream_mode}
        if runtime_context:
            stream_kwargs["context"] = runtime_context
        async for event in app.astream(inputs, config, **stream_kwargs):
            serializable = {}
            for node_name, node_data in event.items():
                try:
                    serializable[node_name] = _make_serializable(node_data)
                except Exception:
                    serializable[node_name] = str(node_data)

            state_values = {}
            next_nodes = []
            fanout_meta = None
            try:
                current_state = await app.aget_state(config)
                state_values = _make_serializable(current_state.values) if current_state.values else {}
                next_nodes = list(current_state.next) if current_state.next else []
                if isinstance(state_values, dict) and isinstance(state_values.get("__fanout_meta__"), dict):
                    fanout_meta = state_values.get("__fanout_meta__")
            except ValueError as e:
                if "No checkpointer set" not in str(e):
                    logger.warning("state_sync failed: %s", e)
            except Exception as state_err:
                logger.warning("state_sync failed: %s", state_err)

            await ws.send_json(with_runtime_event({"type": "node_update", "data": serializable, "fanout_meta": fanout_meta, "truth": _truth_envelope("node_update", nodeIds=list(serializable.keys()), fanoutBound=bool(fanout_meta))}))
            for node_name, node_data in serializable.items():
                meta = embedded_nodes_meta.get(node_name)
                if not meta:
                    continue
                if node_name not in embedded_started:
                    embedded_started.add(node_name)
                    await _emit_embedded_trace(ws, meta, phase="started", update=node_data if isinstance(node_data, dict) else None)
                await _emit_embedded_trace(ws, meta, phase="running", update=node_data if isinstance(node_data, dict) else None)

            if state_values or next_nodes:
                await ws.send_json(with_runtime_event({
                    "type": "state_sync",
                    "state": state_values,
                    "next": next_nodes,
                    "truth": _truth_envelope("state_sync", nextNodes=list(next_nodes)),
                }))

        try:
            current_state = await app.aget_state(config)
            if current_state.next:
                paused_state = _make_serializable(current_state.values) if current_state.values else {}
                await ws.send_json(with_runtime_event({
                    "type": "state_sync",
                    "state": paused_state,
                    "next": list(current_state.next),
                    "truth": _truth_envelope("state_sync", nextNodes=list(current_state.next)),
                }))
                await ws.send_json(with_runtime_event({"type": "paused", "pending_node": current_state.next[0], "truth": _truth_envelope("paused", nodeId=current_state.next[0])}))
                return True

            final_state = _make_serializable(current_state.values) if current_state.values else {}
            await ws.send_json(with_runtime_event({"type": "state_sync", "state": final_state, "next": [], "truth": _truth_envelope("state_sync", nextNodes=[])}))
            for node_name in embedded_started:
                await _emit_embedded_trace(ws, embedded_nodes_meta[node_name], phase="completed")
            await ws.send_json(with_runtime_event({"type": "completed", "truth": _truth_envelope("completed")}))
            return False
        except ValueError as e:
            if "No checkpointer set" in str(e):
                for node_name in embedded_started:
                    await _emit_embedded_trace(ws, embedded_nodes_meta[node_name], phase="completed")
                await ws.send_json(with_runtime_event({"type": "completed", "truth": _truth_envelope("completed")}))
                return False
            logger.error("State check error: %s", e)
            return False
    except asyncio.CancelledError:
        raise
    except Exception as e:
        logger.error("Stream error: %s", traceback.format_exc())
        failed_nodes = embedded_started or set(embedded_nodes_meta.keys())
        for node_name in failed_nodes:
            meta = embedded_nodes_meta.get(node_name)
            if meta:
                await _emit_embedded_trace(ws, meta, phase="failed", error=e)
        await ws.send_json(with_runtime_event({"type": "error", "stage": "runtime_execution", "message": str(e), "reasonCode": extract_reason_code(str(e)), "truth": _truth_envelope("error", stage="runtime_execution", reasonCode=extract_reason_code(str(e)))}))
        return False



def _collect_embedded_node_metadata(payload: GraphPayload) -> dict[str, dict]:
    project_mode = infer_project_mode(
        artifact_type=payload.ui_context.artifact_type if payload.ui_context else None,
        execution_profile=payload.ui_context.execution_profile if payload.ui_context else None,
        project_mode=payload.ui_context.project_mode if payload.ui_context else None,
    )
    embedded_nodes: dict[str, dict] = {}
    for node in payload.nodes:
        if node.type not in {"sub_agent", "deep_agent_suite"}:
            continue
        target = getattr(node.params, "target_subgraph", None)
        execution_kind = str(getattr(node.params, "artifact_execution_kind", None) or "lowered_bridge")
        if execution_kind != "embedded_native" or not isinstance(target, str) or not target.startswith("artifact:"):
            continue
        try:
            meta = validate_embedded_native_reference(target, target_mode=project_mode)
        except BridgeLoweringError as exc:
            embedded_nodes[node.id] = {
                "nodeId": node.id,
                "targetSubgraph": target,
                "executionKind": "embedded_native",
                "status": "invalid",
                "reasonCode": exc.code,
                "message": exc.message,
            }
            continue
        embedded_nodes[node.id] = {
            "nodeId": node.id,
            "targetSubgraph": target,
            "executionKind": "embedded_native",
            "sourceMode": meta.get("sourceMode"),
            "sourceKind": meta.get("sourceKind"),
            "sourceId": meta.get("sourceId"),
            "artifactTitle": meta.get("artifactTitle"),
            "contractId": meta.get("contractId"),
            "acceptedSourceShape": meta.get("acceptedSourceShape"),
            "providerFamilies": list(meta.get("acceptedProviderFamilies") or []),
            "requiredProviderEnvVars": list(meta.get("requiredProviderEnvVars") or []),
            "providerBacked": bool(meta.get("providerBacked")),
        }
    return embedded_nodes


async def _emit_embedded_trace(ws: WebSocket, meta: dict, *, phase: str, update: dict | None = None, error: Exception | None = None):
    payload = {
        "type": "embedded_trace",
        "phase": phase,
        "node_id": meta.get("nodeId"),
        "execution_kind": meta.get("executionKind") or "embedded_native",
        "integration_model": "embedded_native",
        "source_mode": meta.get("sourceMode"),
        "source_kind": meta.get("sourceKind"),
        "artifact_ref": meta.get("targetSubgraph"),
        "artifact_id": meta.get("sourceId"),
        "artifact_title": meta.get("artifactTitle"),
        "contract_id": meta.get("contractId"),
        "accepted_source_shape": meta.get("acceptedSourceShape"),
        "provider_backed": bool(meta.get("providerBacked")),
        "provider_families": list(meta.get("providerFamilies") or []),
        "required_provider_env_vars": list(meta.get("requiredProviderEnvVars") or []),
    }
    if isinstance(update, dict):
        payload["output_keys"] = list(update.keys())
    if error is not None:
        message = str(error)
        payload["message"] = message
        payload["reasonCode"] = extract_reason_code(message)
    elif phase == "started":
        payload["message"] = f"Embedded native artifact '{meta.get('artifactTitle') or meta.get('sourceId') or meta.get('targetSubgraph')}' started."
    elif phase == "running":
        payload["message"] = f"Embedded native artifact '{meta.get('artifactTitle') or meta.get('sourceId') or meta.get('targetSubgraph')}' produced an update."
    elif phase == "completed":
        payload["message"] = f"Embedded native artifact '{meta.get('artifactTitle') or meta.get('sourceId') or meta.get('targetSubgraph')}' completed."
    elif phase == "failed":
        payload.setdefault("message", f"Embedded native artifact '{meta.get('artifactTitle') or meta.get('sourceId') or meta.get('targetSubgraph')}' failed.")
    payload["truth"] = _truth_envelope("embedded_trace", nodeId=meta.get("nodeId"), phase=phase, reasonCode=payload.get("reasonCode"))
    await ws.send_json(with_runtime_event(payload))

def _make_serializable(obj):
    if obj is None or isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, dict):
        return {k: _make_serializable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [_make_serializable(item) for item in obj]
    if hasattr(obj, 'content'):
        result = {"content": obj.content, "type": getattr(obj, 'type', 'unknown')}
        if hasattr(obj, 'tool_calls') and obj.tool_calls:
            result["tool_calls"] = [
                {"name": tc.get("name", ""), "args": tc.get("args", {})}
                if isinstance(tc, dict)
                else {"name": getattr(tc, "name", ""), "args": getattr(tc, "args", {})}
                for tc in obj.tool_calls
            ]
        return result
    try:
        return str(obj)
    except Exception:
        return "Objet non sérialisable"


@router.websocket("/ws/run/{session_id}")
async def ws_run_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    app = None
    runtime_ctx = None
    config = {"configurable": {"thread_id": session_id}}
    stream_task: asyncio.Task | None = None
    owns_runner_lock = False
    active_stream_mode = "updates"
    bootstrap_inputs = lambda value=None: value or {}
    embedded_nodes_meta: dict[str, dict] = {}

    async def release_runner_lock():
        nonlocal owns_runner_lock
        if owns_runner_lock and RUNNER_EXECUTION_LOCK.locked():
            RUNNER_EXECUTION_LOCK.release()
        owns_runner_lock = False

    async def cleanup_runtime():
        nonlocal app, runtime_ctx, bootstrap_inputs, active_stream_mode, embedded_nodes_meta
        if runtime_ctx:
            _cleanup_loaded_graph(runtime_ctx)
            runtime_ctx = None
        app = None
        bootstrap_inputs = lambda value=None: value or {}
        active_stream_mode = "updates"
        embedded_nodes_meta = {}

    async def cancel_stream_task():
        nonlocal stream_task
        if stream_task and not stream_task.done():
            stream_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await stream_task
        stream_task = None

    async def start_stream(inputs):
        nonlocal stream_task

        async def runner_task():
            nonlocal stream_task
            try:
                prepared_inputs = bootstrap_inputs(inputs) if inputs is not None else None
                runtime_context = runtime_ctx.get("runtime_context") or {}
                paused = await _stream_graph(app, prepared_inputs, config, websocket, stream_mode=active_stream_mode, embedded_nodes_meta=embedded_nodes_meta, runtime_context=runtime_context)
                if not paused:
                    await cleanup_runtime()
                    await release_runner_lock()
            except asyncio.CancelledError:
                await cleanup_runtime()
                await release_runner_lock()
                raise
            except Exception as e:
                logger.error("Runner task error: %s", traceback.format_exc())
                try:
                    await websocket.send_json(with_runtime_event({"type": "error", "stage": "ws_error", "message": str(e), "reasonCode": extract_reason_code(str(e)), "truth": _truth_envelope("error", stage="ws_error", reasonCode=extract_reason_code(str(e)))}))
                except Exception:
                    pass
                await cleanup_runtime()
                await release_runner_lock()
            finally:
                stream_task = None

        stream_task = asyncio.create_task(runner_task())

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            action = msg.get("action")

            if action == "start":
                if stream_task and not stream_task.done():
                    await websocket.send_json(with_runtime_event({"type": "error", "stage": "before_run", "message": "A run is already in progress", "reasonCode": "run_already_in_progress", "truth": _truth_envelope("error", stage="before_run", reasonCode="run_already_in_progress")}))
                    continue
                if not owns_runner_lock and RUNNER_EXECUTION_LOCK.locked():
                    await websocket.send_json(with_runtime_event({
                        "type": "error",
                        "stage": "before_run",
                        "message": "Runner busy: another execution currently owns the generated runtime context",
                        "reasonCode": "runner_busy",
                        "truth": _truth_envelope("error", stage="before_run", reasonCode="runner_busy"),
                    }))
                    continue

                payload_data = msg.get("payload")
                inputs = msg.get("inputs", {})
                if not payload_data:
                    await websocket.send_json(with_runtime_event({"type": "error", "stage": "before_run", "message": "No payload provided", "reasonCode": "missing_payload", "truth": _truth_envelope("error", stage="before_run", reasonCode="missing_payload")}))
                    continue
                try:
                    payload = GraphPayload(**payload_data)
                except Exception as e:
                    await websocket.send_json(with_runtime_event({"type": "error", "stage": "payload_validation", "message": f"Build error: {e}", "reasonCode": extract_reason_code(str(e)), "truth": _truth_envelope("error", stage="payload_validation", reasonCode=extract_reason_code(str(e)))}))
                    continue

                project_mode = infer_project_mode(
                    artifact_type=payload.ui_context.artifact_type if payload.ui_context else None,
                    execution_profile=payload.ui_context.execution_profile if payload.ui_context else None,
                    project_mode=payload.ui_context.project_mode if payload.ui_context else None,
                )
                if not is_mode_runtime_enabled(project_mode):
                    await websocket.send_json(with_runtime_event({"type": "error", "stage": "before_run", "message": f"Run blocked before execution: {project_mode} mode is editor-only in this build.", "reasonCode": "editor_only_mode", "truth": _truth_envelope("error", stage="before_run", reasonCode="editor_only_mode")}))
                    continue

                missing_dependencies = find_missing_runtime_dependencies(payload)
                if missing_dependencies:
                    await websocket.send_json(with_runtime_event({
                        "type": "error",
                        "stage": "runtime_dependencies",
                        "message": format_missing_runtime_dependency_message(missing_dependencies),
                        "missingDependencies": missing_dependencies,
                        "reasonCode": "missing_runtime_dependencies",
                        "truth": _truth_envelope("error", stage="runtime_dependencies", reasonCode="missing_runtime_dependencies"),
                    }))
                    continue

                preflight_issues = find_runtime_preflight_issues(payload)
                if preflight_issues:
                    await websocket.send_json(with_runtime_event({
                        "type": "error",
                        "stage": "runtime_preflight",
                        "message": format_runtime_preflight_message(preflight_issues),
                        "issues": preflight_issues,
                        "reasonCode": normalize_reason_code(preflight_issues[0].get("code") if preflight_issues else None),
                        "truth": _truth_envelope("error", stage="runtime_preflight", reasonCode=normalize_reason_code(preflight_issues[0].get("code") if preflight_issues else None)),
                    }))
                    continue

                try:
                    runtime_settings = payload.ui_context.runtime_settings if payload.ui_context and payload.ui_context.runtime_settings else None
                    await RUNNER_EXECUTION_LOCK.acquire()
                    owns_runner_lock = True
                    await cleanup_runtime()
                    runtime_ctx = _extract_and_load_graph(payload)
                    app = runtime_ctx["graph"]
                    bootstrap_inputs = runtime_ctx.get("bootstrap_state", lambda value=None: value or {})
                    active_stream_mode = runtime_settings.streamMode if runtime_settings else runtime_ctx.get("graph_runtime_settings", {}).get("streamMode", "updates")
                    recursion_limit = runtime_settings.recursionLimit if runtime_settings else runtime_ctx.get("graph_runtime_settings", {}).get("recursionLimit")
                    debug_enabled = runtime_settings.debug if runtime_settings else runtime_ctx.get("graph_runtime_settings", {}).get("debug", False)
                    config = {"configurable": {"thread_id": session_id}}
                    embedded_nodes_meta = _collect_embedded_node_metadata(payload)
                    if recursion_limit:
                        config["recursion_limit"] = recursion_limit
                    await websocket.send_json(with_runtime_event({
                        "type": "started",
                        "truth": _truth_envelope("started"),
                        "stream_mode": active_stream_mode,
                        "debug": debug_enabled,
                        "graph_scope": payload.ui_context.graph_scope if payload.ui_context else None,
                        "scope_lineage": payload.ui_context.scope_lineage if payload.ui_context else None,
                        "artifact_type": payload.ui_context.artifact_type if payload.ui_context else None,
                        "execution_profile": payload.ui_context.execution_profile if payload.ui_context else None,
                        "external_artifacts": runtime_ctx.get("external_artifacts", []),
                        "embedded_nodes": list(embedded_nodes_meta.values()),
                    }))
                except Exception as e:
                    logger.error("Graph build error: %s", traceback.format_exc())
                    await cleanup_runtime()
                    await release_runner_lock()
                    await websocket.send_json(with_runtime_event({"type": "error", "stage": "runtime_build", "message": f"Build error: {e}", "reasonCode": extract_reason_code(str(e)), "truth": _truth_envelope("error", stage="runtime_build", reasonCode=extract_reason_code(str(e)))}))
                    continue

                if not inputs:
                    inputs = {"messages": []}
                await start_stream(inputs)

            elif action == "resume":
                if not app or not owns_runner_lock:
                    await websocket.send_json(with_runtime_event({"type": "error", "stage": "before_resume", "message": "No paused graph loaded", "reasonCode": "no_paused_graph", "truth": _truth_envelope("error", stage="before_resume", reasonCode="no_paused_graph")}))
                    continue
                if stream_task and not stream_task.done():
                    await websocket.send_json(with_runtime_event({"type": "error", "stage": "before_resume", "message": "A run is already in progress", "reasonCode": "run_already_in_progress", "truth": _truth_envelope("error", stage="before_resume", reasonCode="run_already_in_progress")}))
                    continue
                user_response = msg.get("user_response", "")
                node_id = msg.get("node_id", "")
                try:
                    if importlib.util.find_spec('langchain_core') is None:
                        await websocket.send_json(with_runtime_event({"type": "error", "stage": "runtime_dependencies", "message": "Resume blocked: missing langchain-core for HumanMessage resume payload handling.", "reasonCode": "missing_runtime_dependencies", "truth": _truth_envelope("error", stage="runtime_dependencies", reasonCode="missing_runtime_dependencies")}))
                        continue
                    from langchain_core.messages import HumanMessage
                    await app.aupdate_state(
                        config,
                        {"messages": [HumanMessage(content=user_response)]},
                        as_node=node_id,
                    )
                except Exception as e:
                    logger.error("Resume update error: %s", e)
                    await websocket.send_json(with_runtime_event({"type": "error", "stage": "resume_update", "message": f"Resume error: {e}", "reasonCode": extract_reason_code(str(e)), "truth": _truth_envelope("error", stage="resume_update", reasonCode=extract_reason_code(str(e)))}))
                    continue
                await start_stream(None)

            elif action == "stop":
                await cancel_stream_task()
                await cleanup_runtime()
                await release_runner_lock()
                await websocket.send_json(with_runtime_event({"type": "stopped", "truth": _truth_envelope("stopped")}))
                break
    except WebSocketDisconnect:
        logger.info("Run WS disconnected: %s", session_id)
    except Exception as e:
        logger.error("Run WS error: %s", traceback.format_exc())
        try:
            await websocket.send_json(with_runtime_event({"type": "error", "stage": "ws_error", "message": str(e), "reasonCode": extract_reason_code(str(e)), "truth": _truth_envelope("error", stage="ws_error", reasonCode=extract_reason_code(str(e)))}))
        except Exception:
            pass
    finally:
        await cancel_stream_task()
        await cleanup_runtime()
        await release_runner_lock()
