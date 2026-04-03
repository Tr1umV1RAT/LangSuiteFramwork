from __future__ import annotations

import json
from pathlib import Path
from typing import Any
import re

from core.capability_matrix import artifact_directory_map, known_artifact_kinds, visible_library_artifact_kinds, advanced_library_artifact_kinds, artifact_kind_meta
from core.mode_contracts import find_bridge, find_bridges, infer_project_mode, is_mode_artifact_allowed, is_mode_execution_profile_allowed, list_artifact_kinds_for_target_mode, project_mode_contract

REGISTRY_ROOT = Path(__file__).resolve().parent.parent / "artifact_registry"
KIND_DIRS = artifact_directory_map()
SAFE_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,127}$")
VISIBLE_KINDS = visible_library_artifact_kinds()
ADVANCED_KINDS = advanced_library_artifact_kinds()
KNOWN_KINDS = known_artifact_kinds()
KIND_META = artifact_kind_meta()


def _surface_truth(artifact_type: str, execution_profile: str | None, project_mode: str) -> dict[str, Any]:
    contract = project_mode_contract(project_mode)
    compile_safe = bool(contract.get('compileEnabled'))
    runtime_enabled = bool(contract.get('runtimeEnabled'))
    editor_only = bool(contract.get('editorOnly')) or not runtime_enabled
    if not compile_safe and editor_only:
        summary = 'Editor-only in this build.'
    elif compile_safe and editor_only:
        summary = 'Compile-capable, but in-app runtime stays disabled on this surface.'
    else:
        summary = 'Compile-safe and in-app runtime-enabled on this surface.'
    return {
        'artifactType': artifact_type,
        'executionProfile': execution_profile,
        'projectMode': project_mode,
        'compileSafe': compile_safe,
        'runtimeEnabled': runtime_enabled,
        'editorOnly': editor_only,
        'summary': summary,
    }




def _open_effect_summary(surface_truth: dict[str, Any]) -> str:
    if surface_truth.get('editorOnly'):
        return 'Opening restores an editable copy only. This surface stays editor-first in the current build and does not recreate runtime state.'
    if surface_truth.get('compileSafe') and surface_truth.get('runtimeEnabled'):
        return 'Opening restores an editable copy of a compile-safe, runtime-enabled surface. Runtime state and local environment are still not restored.'
    if surface_truth.get('compileSafe'):
        return 'Opening restores an editable copy of a compile-capable surface. In-app runtime still stays disabled here.'
    return 'Opening restores editable authoring data only.'


def _save_effect_summary(surface_truth: dict[str, Any]) -> str:
    if surface_truth.get('editorOnly'):
        return 'Saving publishes the authored artifact definition only. It preserves the editor-facing structure, not runtime state, dependencies, secrets, or local environment.'
    return 'Saving publishes the authored artifact definition and its declared surface truth only. It does not preserve runtime state, dependencies, secrets, or local environment.'

def slugify(value: str, fallback: str = "artifact") -> str:
    cleaned = re.sub(r"[^a-z0-9_-]+", "_", value.strip().lower())
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    cleaned = cleaned[:128]
    if not cleaned:
        cleaned = fallback
    if not SAFE_SLUG_RE.fullmatch(cleaned):
        cleaned = fallback
    return cleaned


def _ensure_registry_dirs() -> None:
    REGISTRY_ROOT.mkdir(parents=True, exist_ok=True)
    for dirname in KIND_DIRS.values():
        (REGISTRY_ROOT / dirname).mkdir(parents=True, exist_ok=True)


def _starter_node(node_id: str, node_type: str, label: str, x: int, y: int, params: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "id": node_id,
        "type": "custom",
        "position": {"x": x, "y": y},
        "data": {
            "nodeType": node_type,
            "label": label,
            "params": params or {},
        },
    }


BUILTIN_MANIFESTS: list[dict[str, Any]] = [
    {
        "id": "empty_graph",
        "kind": "graph",
        "title": "Empty Graph",
        "description": "Graph LangGraph vide pour partir de zéro.",
        "built_in": True,
        "artifact": {
            "name": "Empty Graph",
            "nodes": [],
            "edges": [],
            "customStateSchema": [],
            "graphBindings": [],
            "isAsync": True,
            "artifactType": "graph",
            "executionProfile": "langgraph_async",
            "projectMode": "langgraph",
            "runtimeSettings": {
                "recursionLimit": 50,
                "streamMode": "updates",
                "debug": False,
                "inheritParentBindings": True,
            },
        },
    },
    {
        "id": "core_echo_starter",
        "kind": "graph",
        "title": "Core Echo Starter",
        "description": "Starter compile-safe minimal : debug_print relaie les messages d'entrée sans provider.",
        "built_in": True,
        "artifact": {
            "name": "Core Echo Starter",
            "nodes": [
                _starter_node("debug_print_1", "debug_print", "Debug Print 1", 280, 180, {"input_key": "messages"}),
            ],
            "edges": [],
            "customStateSchema": [],
            "graphBindings": [],
            "isAsync": True,
            "artifactType": "graph",
            "executionProfile": "langgraph_async",
            "projectMode": "langgraph",
            "runtimeSettings": {
                "recursionLimit": 50,
                "streamMode": "updates",
                "debug": False,
                "inheritParentBindings": True,
            },
        },
    },
    {
        "id": "static_debug_starter",
        "kind": "graph",
        "title": "Static Debug Starter",
        "description": "Starter compile-safe : static_text alimente debug_print pour un premier flux visible sans dépendance provider.",
        "built_in": True,
        "artifact": {
            "name": "Static Debug Starter",
            "nodes": [
                _starter_node("static_text_1", "static_text", "Static Text 1", 60, 180, {"text": "Hello from the compile-safe starter.", "output_key": "messages"}),
                _starter_node("debug_print_2", "debug_print", "Debug Print 2", 340, 180, {"input_key": "messages"}),
            ],
            "edges": [
                {"id": "e1-2", "source": "static_text_1", "target": "debug_print_2", "animated": True},
            ],
            "customStateSchema": [],
            "graphBindings": [],
            "isAsync": True,
            "artifactType": "graph",
            "executionProfile": "langgraph_async",
            "projectMode": "langgraph",
            "runtimeSettings": {
                "recursionLimit": 50,
                "streamMode": "updates",
                "debug": False,
                "inheritParentBindings": True,
            },
        },
    },
    {
        "id": "empty_subgraph",
        "kind": "subgraph",
        "title": "Empty Subgraph",
        "description": "Sous-graphe vide, destiné à être wrappé comme nœud.",
        "built_in": True,
        "artifact": {
            "name": "Empty Subgraph",
            "nodes": [],
            "edges": [],
            "customStateSchema": [],
            "graphBindings": [],
            "isAsync": True,
            "artifactType": "subgraph",
            "executionProfile": "langgraph_async",
            "projectMode": "langgraph",
            "runtimeSettings": {
                "recursionLimit": 50,
                "streamMode": "updates",
                "debug": False,
                "inheritParentBindings": True,
            },
        },
    },
    {
        "id": "minimal_agent",
        "kind": "agent",
        "title": "Minimal Agent Workflow",
        "description": "Entrée utilisateur → React agent → sortie chat, pour un vrai flux d'édition LangChain.",
        "built_in": True,
        "artifact": {
            "name": "Minimal Agent Workflow",
            "nodes": [
                _starter_node("user_input_node_1", "user_input_node", "User Input 1", 40, 160, {"prompt": "Votre message", "output_key": "messages"}),
                _starter_node("react_agent_2", "react_agent", "React Agent 2", 300, 150, {"provider": "openai", "model_name": "gpt-4o", "temperature": 0.3, "system_prompt": "Tu es un agent utile.", "tools_linked": []}),
                _starter_node("chat_output_3", "chat_output", "Chat Output 3", 580, 160, {"input_key": "messages"}),
            ],
            "edges": [
                {"id": "e1-2", "source": "user_input_node_1", "target": "react_agent_2", "animated": True},
                {"id": "e2-3", "source": "react_agent_2", "target": "chat_output_3", "animated": True},
            ],
            "customStateSchema": [],
            "graphBindings": [],
            "isAsync": True,
            "artifactType": "agent",
            "executionProfile": "langchain_agent",
            "projectMode": "langchain",
            "runtimeSettings": {
                "recursionLimit": 50,
                "streamMode": "updates",
                "debug": False,
                "inheritParentBindings": True,
            },
        },
    },
    {
        "id": "embedded_debug_agent",
        "kind": "agent",
        "title": "Embedded Native Debug Agent",
        "description": "Provider-free LangChain authoring artifact intended for the embedded-native LangGraph execution path.",
        "built_in": True,
        "artifact": {
            "name": "Embedded Native Debug Agent",
            "nodes": [
                _starter_node("debug_print_1", "debug_print", "Debug Print 1", 260, 180, {"input_key": "messages"}),
            ],
            "edges": [],
            "customStateSchema": [],
            "graphBindings": [],
            "isAsync": True,
            "artifactType": "agent",
            "executionProfile": "langchain_agent",
            "projectMode": "langchain",
            "runtimeSettings": {
                "recursionLimit": 50,
                "streamMode": "updates",
                "debug": False,
                "inheritParentBindings": True,
            },
        },
    },
    {
        "id": "embedded_provider_agent",
        "kind": "agent",
        "title": "Embedded Native Provider Agent",
        "description": "Bounded provider-backed LangChain artifact intended for embedded-native LangGraph orchestration.",
        "built_in": True,
        "artifact": {
            "name": "Embedded Native Provider Agent",
            "nodes": [
                _starter_node("react_agent_1", "react_agent", "React Agent 1", 280, 180, {"provider": "openai", "model_name": "gpt-4o-mini", "api_key_env": "OPENAI_API_KEY", "temperature": 0.2, "system_prompt": "You are a concise embedded assistant.", "tools_linked": []}),
            ],
            "edges": [],
            "customStateSchema": [],
            "graphBindings": [],
            "isAsync": True,
            "artifactType": "agent",
            "executionProfile": "langchain_agent",
            "projectMode": "langchain",
            "runtimeSettings": {
                "recursionLimit": 50,
                "streamMode": "updates",
                "debug": False,
                "inheritParentBindings": True,
            },
        },
    },
    {
        "id": "deep_agent_shell",
        "kind": "deep_agent",
        "title": "Deep Agent Shell",
        "description": "Coque éditoriale Deep Agents avec réglages de base.",
        "built_in": True,
        "artifact": {
            "name": "Deep Agent Shell",
            "nodes": [],
            "edges": [],
            "customStateSchema": [],
            "graphBindings": [
                {"name": "task_description", "value": "", "kind": "variable"}
            ],
            "isAsync": True,
            "artifactType": "deep_agent",
            "executionProfile": "deepagents",
            "projectMode": "deepagents",
            "runtimeSettings": {
                "recursionLimit": 75,
                "streamMode": "values",
                "debug": True,
                "inheritParentBindings": True,
            },
        },
    },
    {
        "id": "deep_agent_suite_starter",
        "kind": "deep_agent",
        "title": "Deep Agent Suite Starter",
        "description": "Starter sémantique Deep Agents compilé canoniquement via le runtime LangGraph actuel.",
        "built_in": True,
        "artifact": {
            "name": "Deep Agent Suite Starter",
            "nodes": [
                _starter_node("deep_agent_suite_1", "deep_agent_suite", "Deep Agent Suite 1", 260, 180, {
                    "target_subgraph": "",
                    "description": "Suite Deep Agents de départ.",
                    "planning_mode": "plan_execute",
                    "wrapper_mode": "opaque",
                }),
            ],
            "edges": [],
            "customStateSchema": [],
            "graphBindings": [
                {"name": "task_description", "value": "", "kind": "variable"}
            ],
            "isAsync": True,
            "artifactType": "deep_agent",
            "executionProfile": "deepagents",
            "projectMode": "deepagents",
            "runtimeSettings": {
                "recursionLimit": 75,
                "streamMode": "values",
                "debug": True,
                "inheritParentBindings": True,
            },
        },
    }
]


def bootstrap_builtin_manifests() -> None:
    _ensure_registry_dirs()
    for manifest in BUILTIN_MANIFESTS:
        dirname = KIND_DIRS[manifest["kind"]]
        path = REGISTRY_ROOT / dirname / f"{manifest['id']}.json"
        if not path.exists():
            path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")


def _manifest_path(kind: str, artifact_id: str) -> Path:
    if kind not in KIND_DIRS:
        raise ValueError(f"Unsupported artifact kind: {kind}")
    safe_id = slugify(artifact_id)
    return REGISTRY_ROOT / KIND_DIRS[kind] / f"{safe_id}.json"


def list_artifacts(kind: str | None = None, *, include_hidden: bool = False, include_advanced: bool = False, project_mode: str | None = None) -> list[dict[str, Any]]:
    bootstrap_builtin_manifests()
    manifests: list[dict[str, Any]] = []
    selected_kinds: list[str]
    if kind:
        selected_kinds = [kind]
    elif include_hidden:
        selected_kinds = list(KNOWN_KINDS)
    elif project_mode:
        selected_kinds = list(list_artifact_kinds_for_target_mode(project_mode, include_advanced=include_advanced))
    elif include_advanced:
        selected_kinds = list(VISIBLE_KINDS) + [k for k in ADVANCED_KINDS if k not in VISIBLE_KINDS]
    else:
        selected_kinds = list(VISIBLE_KINDS)

    for selected_kind in selected_kinds:
        dirname = KIND_DIRS.get(selected_kind)
        if not dirname:
            continue
        kind_meta = KIND_META.get(selected_kind, {})
        for path in sorted((REGISTRY_ROOT / dirname).glob("*.json")):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                continue
            artifact = data.get("artifact", {})
            artifact_type = artifact.get("artifactType", data.get("kind", selected_kind))
            execution_profile = artifact.get("executionProfile")
            artifact_project_mode = infer_project_mode(artifact_type=artifact_type, execution_profile=execution_profile, project_mode=artifact.get("projectMode"))
            surface_truth = _surface_truth(str(artifact_type), execution_profile, artifact_project_mode)
            if project_mode and artifact_project_mode == project_mode:
                bridge = None
                bridge_models: list[dict[str, Any]] = []
            elif project_mode:
                bridges = list(find_bridges(source_mode=artifact_project_mode, target_mode=project_mode, source_kind=artifact_type))
                if not bridges:
                    continue
                bridge = bridges[0]
                bridge_models = [
                    {
                        "id": item.get("id"),
                        "integrationModel": item.get("integrationModel"),
                        "executionKind": item.get("executionKind") or item.get("integrationModel"),
                        "supportLevel": item.get("supportLevel"),
                        "status": item.get("status"),
                        "summary": item.get("summary"),
                        "bridgeContractIds": item.get("bridgeContractIds") if item.get("bridgeContractIds") is not None else ([item.get("bridgeContractId")] if item.get("bridgeContractId") else []),
                        "bridgeConstraints": item.get("bridgeConstraints") or [],
                        "bridgeAllowedToolFamilies": item.get("bridgeAllowedToolFamilies") or [],
                        "bridgeAcceptedSourceShape": item.get("bridgeAcceptedSourceShape"),
                        "bridgeRejectedReasonCodes": item.get("bridgeRejectedReasonCodes") or [],
                        "bridgeConstraintSummary": item.get("bridgeConstraintSummary") or {},
                    }
                    for item in bridges
                ]
            else:
                bridge = None
                bridge_models = []
            manifests.append({
                "id": data.get("id", path.stem),
                "kind": data.get("kind", selected_kind),
                "title": data.get("title", path.stem),
                "description": data.get("description", ""),
                "built_in": bool(data.get("built_in", False)),
                "executionProfile": execution_profile,
                "artifactType": artifact_type,
                "projectMode": artifact_project_mode,
                "path": str(path.relative_to(REGISTRY_ROOT)),
                "rail": kind_meta.get("rail"),
                "surfaceLevel": kind_meta.get("surfaceLevel"),
                "packagingEligibility": kind_meta.get("packagingEligibility"),
                "trunkDependent": bool(kind_meta.get("trunkDependent")),
                "compileSafe": surface_truth["compileSafe"],
                "runtimeEnabled": surface_truth["runtimeEnabled"],
                "editorOnly": surface_truth["editorOnly"],
                "surfaceSummary": surface_truth["summary"],
                "surfaceTruth": surface_truth,
                "openEffectSummary": _open_effect_summary(surface_truth),
                "saveEffectSummary": _save_effect_summary(surface_truth),
                "adapterBacked": bool(kind_meta.get("adapterBacked")) or bool(bridge and bridge.get("adapterBacked")),
                "bridgeTargetMode": project_mode if bridge else None,
                "bridgeStatus": bridge.get("status") if bridge else None,
                "bridgeSupportLevel": bridge.get("supportLevel") if bridge else None,
                "bridgeWrapperNodeType": bridge.get("wrapperNodeType") if bridge else None,
                "bridgeSummary": bridge.get("summary") if bridge else None,
                "bridgeContractIds": bridge.get("bridgeContractIds") if bridge else None,
                "bridgeConstraints": bridge.get("bridgeConstraints") if bridge else None,
                "bridgeAllowedToolFamilies": bridge.get("bridgeAllowedToolFamilies") if bridge else None,
                "bridgeAcceptedSourceShape": bridge.get("bridgeAcceptedSourceShape") if bridge else None,
                "bridgeRejectedReasonCodes": bridge.get("bridgeRejectedReasonCodes") if bridge else None,
                "bridgeConstraintSummary": bridge.get("bridgeConstraintSummary") if bridge else None,
                "bridgeIntegrationModel": bridge.get("integrationModel") if bridge else None,
                "bridgeExecutionKind": bridge.get("executionKind") if bridge else None,
                "bridgeModels": bridge_models,
            })
    manifests.sort(key=lambda m: (m["kind"], not m.get("built_in", False), m["title"].lower()))
    return manifests


def get_artifact(kind: str, artifact_id: str) -> dict[str, Any] | None:
    bootstrap_builtin_manifests()
    path = _manifest_path(kind, artifact_id)
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    artifact = data.get("artifact", {})
    artifact_type = artifact.get("artifactType", data.get("kind", kind))
    execution_profile = artifact.get("executionProfile")
    project_mode = infer_project_mode(artifact_type=artifact_type, execution_profile=execution_profile, project_mode=artifact.get("projectMode"))
    surface_truth = _surface_truth(str(artifact_type), execution_profile, project_mode)
    data["surfaceTruth"] = surface_truth
    data["openEffectSummary"] = _open_effect_summary(surface_truth)
    data["saveEffectSummary"] = _save_effect_summary(surface_truth)
    return data


def save_artifact_manifest(manifest: dict[str, Any]) -> dict[str, Any]:
    bootstrap_builtin_manifests()
    artifact = manifest.get("artifact") or {}
    kind = manifest.get("kind") or artifact.get("artifactType") or "graph"
    if kind not in KIND_DIRS:
        raise ValueError(f"kind must be one of {list(KNOWN_KINDS)}")
    artifact_type = artifact.get("artifactType") or kind
    execution_profile = artifact.get("executionProfile")
    project_mode = infer_project_mode(artifact_type=artifact_type, execution_profile=execution_profile, project_mode=artifact.get("projectMode"))
    if not is_mode_artifact_allowed(project_mode, artifact_type):
        raise ValueError(f"Artifact type '{artifact_type}' is not allowed in project mode '{project_mode}'")
    if execution_profile and not is_mode_execution_profile_allowed(project_mode, execution_profile):
        raise ValueError(f"Execution profile '{execution_profile}' is not allowed in project mode '{project_mode}'")
    title = str(manifest.get("title") or artifact.get("name") or kind).strip()
    artifact_id = slugify(str(manifest.get("id") or title), fallback=kind)
    cleaned_artifact = dict(artifact)
    cleaned_artifact["artifactType"] = artifact_type
    cleaned_artifact["executionProfile"] = execution_profile
    cleaned_artifact["projectMode"] = project_mode
    cleaned = {
        "id": artifact_id,
        "kind": kind,
        "title": title or artifact_id,
        "description": str(manifest.get("description") or "").strip(),
        "built_in": False,
        "artifact": cleaned_artifact,
    }
    path = _manifest_path(kind, artifact_id)
    path.write_text(json.dumps(cleaned, indent=2, ensure_ascii=False), encoding="utf-8")
    surface_truth = _surface_truth(str(artifact_type), execution_profile, project_mode)
    cleaned["surfaceTruth"] = surface_truth
    cleaned["openEffectSummary"] = _open_effect_summary(surface_truth)
    cleaned["saveEffectSummary"] = _save_effect_summary(surface_truth)
    return cleaned
