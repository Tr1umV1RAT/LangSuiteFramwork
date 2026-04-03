from __future__ import annotations

from copy import deepcopy
from typing import Any

from core.artifact_registry import get_artifact
from core.mode_contracts import infer_project_mode, is_node_type_allowed_for_mode
from core.provider_contracts import normalize_provider, provider_default_api_key_env, provider_is_embedded_native_allowed, provider_meta


class BridgeLoweringError(ValueError):
    def __init__(self, code: str, message: str, *, details: dict[str, Any] | None = None):
        self.code = code
        self.message = message
        self.details = details or {}
        super().__init__(f"[{code}] {message}")

    def as_dict(self) -> dict[str, Any]:
        return {"code": self.code, "message": self.message, "details": dict(self.details)}


LANGCHAIN_TO_LANGGRAPH_CONTRACT_ID = "langchain_agent_to_langgraph_v1"
LANGCHAIN_TO_LANGGRAPH_V2_CONTRACT_ID = "langchain_agent_to_langgraph_v2"
LANGCHAIN_EMBEDDED_NATIVE_CONTRACT_ID = "langchain_agent_embedded_v1"
SUPPORTED_LANGCHAIN_AGENT_SHARED_NODES = {
    "user_input_node",
    "chat_output",
    "debug_print",
    "static_text",
    "logic_router",
    "human_interrupt",
    "parallel_aggregator",
    "context_trimmer",
    "data_container",
    "update_state_node",
}
SUPPORTED_EMBEDDED_LANGCHAIN_NODE_TYPES = SUPPORTED_LANGCHAIN_AGENT_SHARED_NODES | {"react_agent", "llm_chat"}
SUPPORTED_LANGCHAIN_SHARED_TOOL_TYPES = {"rpg_dice_roller", "sql_query"}
SUPPORTED_LANGCHAIN_SHARED_TOOL_FAMILY_SETS = {
    frozenset({"rpg_dice_roller"}),
    frozenset({"sql_query"}),
}


def _bridge_error(code: str, message: str, **details: Any) -> BridgeLoweringError:
    return BridgeLoweringError(code, message, details=details or None)


def load_artifact_reference(target_subgraph: str) -> tuple[str, str, dict[str, Any]]:
    if not isinstance(target_subgraph, str) or not target_subgraph.startswith("artifact:"):
        raise _bridge_error("invalid_bridge_target", "Bridge target must be an artifact reference", targetSubgraph=target_subgraph)
    ref = target_subgraph.split(":", 1)[1]
    parts = ref.split("/", 1)
    source_kind = parts[0] if parts else ""
    source_id = parts[1] if len(parts) > 1 else ""
    if not source_kind or not source_id:
        raise _bridge_error("bridge_target_missing_identity", f"Wrapper reference '{target_subgraph}' is missing kind or artifact id", targetSubgraph=target_subgraph)
    manifest = get_artifact(source_kind, source_id)
    if manifest is None:
        raise _bridge_error("bridge_target_not_found", f"Referenced artifact '{target_subgraph}' was not found in the registry", targetSubgraph=target_subgraph)
    return source_kind, source_id, manifest


def _artifact_payload(manifest: dict[str, Any]) -> dict[str, Any]:
    artifact = manifest.get("artifact")
    if not isinstance(artifact, dict):
        raise _bridge_error("artifact_payload_missing", "Artifact manifest is missing a valid 'artifact' payload")
    return artifact


def _validate_sql_query_tool(raw_tool: dict[str, Any], *, tool_id: str) -> dict[str, Any]:
    params = deepcopy(raw_tool.get("params") or {})
    if not isinstance(params, dict):
        raise _bridge_error("tool_params_invalid", f"Tool '{tool_id}' params must be an object", toolId=tool_id)
    db_path = str(params.get("db_path") or "").strip()
    if not db_path:
        raise _bridge_error("sql_query_requires_local_db_path", f"Tool '{tool_id}' must declare params.db_path for the executable read-only SQL bridge", toolId=tool_id)
    params["bridge_read_only"] = True
    params.setdefault("max_rows", 50)
    params.setdefault("allowed_prefixes", ["select", "with", "pragma"])
    return params


def _validate_langchain_tools(artifact: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, str], list[str]]:
    tools = artifact.get("tools") or []
    if not isinstance(tools, list):
        raise _bridge_error("artifact_tools_not_list", "Artifact tools must be a list")
    validated: list[dict[str, Any]] = []
    tool_types: dict[str, str] = {}
    seen_ids: set[str] = set()
    families: set[str] = set()
    for idx, raw_tool in enumerate(tools):
        if not isinstance(raw_tool, dict):
            raise _bridge_error("artifact_tool_invalid", f"Artifact tool at index {idx} must be an object", index=idx)
        tool_id = str(raw_tool.get("id") or "").strip()
        tool_type = str(raw_tool.get("type") or "").strip()
        if not tool_id:
            raise _bridge_error("artifact_tool_missing_id", f"Artifact tool at index {idx} is missing an id", index=idx)
        if tool_id in seen_ids:
            raise _bridge_error("artifact_tool_duplicate_id", f"Artifact tool id '{tool_id}' is duplicated", toolId=tool_id)
        seen_ids.add(tool_id)
        if tool_type not in SUPPORTED_LANGCHAIN_SHARED_TOOL_TYPES:
            raise _bridge_error("unsupported_tool_family", f"Tool type '{tool_type}' is not supported by the executable LangChain→LangGraph bridge; allowed shared tools: {sorted(SUPPORTED_LANGCHAIN_SHARED_TOOL_TYPES)}", toolType=tool_type, allowedToolFamilies=sorted(SUPPORTED_LANGCHAIN_SHARED_TOOL_TYPES))
        params = deepcopy(raw_tool.get("params") or {})
        if tool_type == "sql_query":
            params = _validate_sql_query_tool(raw_tool, tool_id=tool_id)
        elif not isinstance(params, dict):
            raise _bridge_error("tool_params_invalid", f"Tool '{tool_id}' params must be an object", toolId=tool_id)
        tool_types[tool_id] = tool_type
        families.add(tool_type)
        validated.append({
            "id": tool_id,
            "type": tool_type,
            "description": str(raw_tool.get("description") or "").strip(),
            "params": params,
            "ui_meta": deepcopy(raw_tool.get("ui_meta") or {}),
        })
    if families and frozenset(families) not in SUPPORTED_LANGCHAIN_SHARED_TOOL_FAMILY_SETS:
        raise _bridge_error("mixed_tool_families_not_supported", f"The executable LangChain→LangGraph bridge currently allows only one shared-safe tool family per artifact; got {sorted(families)}", toolFamilies=sorted(families))
    return validated, tool_types, sorted(families)




def _provider_requirements(source_node_type: str, params: dict[str, Any]) -> tuple[list[str], list[str], list[str]]:
    provider = normalize_provider(params.get("provider"))
    if source_node_type not in {"react_agent", "llm_chat"} or not provider:
        return [], [], []
    if not provider_is_embedded_native_allowed(provider):
        allowed = sorted(name for name, meta in provider_meta().items() if bool(meta.get("embeddedNativeAllowed")))
        raise _bridge_error(
            "unsupported_embedded_provider",
            f"Embedded native LangChain provider '{provider}' is not supported by the bounded provider-backed contract",
            provider=provider,
            allowedProviders=allowed,
        )
    model_name = str(params.get("model_name") or "").strip()
    explicit_env = str(params.get("api_key_env") or "").strip()
    default_env = provider_default_api_key_env(provider)
    env_names = [explicit_env] if explicit_env else ([default_env] if default_env else [])
    return [provider], env_names, ([model_name] if model_name else [])


def _validate_langchain_source_manifest(manifest: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, str], list[str], list[dict[str, Any]], list[dict[str, Any]]]:
    artifact = _artifact_payload(manifest)
    artifact_type = artifact.get("artifactType") or manifest.get("kind")
    if artifact_type != "agent":
        raise _bridge_error("unsupported_source_artifact_kind", "Only LangChain 'agent' artifacts are supported by this contract", artifactType=artifact_type)
    project_mode = infer_project_mode(artifact_type=artifact_type, execution_profile=artifact.get("executionProfile"), project_mode=artifact.get("projectMode"))
    if project_mode != "langchain":
        raise _bridge_error("bridge_requires_langchain_source_mode", "This contract currently only accepts LangChain-mode agent artifacts", projectMode=project_mode)
    validated_tools, validated_tool_types, tool_families = _validate_langchain_tools(artifact)
    nodes = artifact.get("nodes") or []
    if not isinstance(nodes, list) or not nodes:
        raise _bridge_error("bridge_requires_saved_nodes", "The executable LangChain contract requires at least one saved artifact node")
    edges = artifact.get("edges") or []
    if not isinstance(edges, list):
        raise _bridge_error("artifact_edges_not_list", "Artifact edges must be a list")
    return artifact, validated_tools, validated_tool_types, tool_families, nodes, edges


def _iter_artifact_nodes(nodes: list[dict[str, Any]]) -> list[tuple[int, str, dict[str, Any], dict[str, Any]]]:
    normalized: list[tuple[int, str, dict[str, Any], dict[str, Any]]] = []
    for idx, raw_node in enumerate(nodes):
        if not isinstance(raw_node, dict):
            raise _bridge_error("artifact_node_invalid", f"Artifact node at index {idx} must be an object", index=idx)
        data = raw_node.get("data") or {}
        params = data.get("params") or {}
        if not isinstance(params, dict):
            raise _bridge_error("artifact_node_params_invalid", f"Artifact node at index {idx} has invalid params", index=idx)
        source_node_type = str(data.get("nodeType") or raw_node.get("type") or "")
        normalized.append((idx, source_node_type, params, raw_node))
    return normalized


def validate_langchain_agent_bridge_manifest(manifest: dict[str, Any]) -> dict[str, Any]:
    artifact, validated_tools, validated_tool_types, tool_families, nodes, _edges = _validate_langchain_source_manifest(manifest)

    lowered_shapes: list[str] = []
    allowed_tool_ids: set[str] = set(validated_tool_types)
    has_react_agent = False
    has_tool_linked_react_agent = False
    for _idx, source_node_type, params, _raw_node in _iter_artifact_nodes(nodes):
        if source_node_type == "react_agent":
            has_react_agent = True
            linked_tools = params.get("tools_linked") or []
            if linked_tools:
                if not isinstance(linked_tools, list):
                    raise _bridge_error("executable_bridge_requires_react_agent_tool_link_list", "react_agent tools_linked must be a list")
                invalid = [tool_id for tool_id in linked_tools if str(tool_id) not in allowed_tool_ids]
                if invalid:
                    raise _bridge_error("react_agent_missing_shared_tool_link", f"react_agent references unsupported or missing shared tools: {sorted(set(str(tool_id) for tool_id in invalid))}", invalidToolIds=sorted(set(str(tool_id) for tool_id in invalid)))
                has_tool_linked_react_agent = True
                if tool_families == ["sql_query"]:
                    lowered_shapes.append("react_agent→llm_chat+sql_query_read_only")
                elif tool_families == ["rpg_dice_roller"]:
                    lowered_shapes.append("react_agent→llm_chat+rpg_dice_roller")
                else:
                    lowered_shapes.append("react_agent→llm_chat+shared_tools")
            else:
                lowered_shapes.append("react_agent→llm_chat")
            continue
        if params.get("tools_linked"):
            raise _bridge_error("unsupported_tool_carrier_node_type", f"Node type '{source_node_type}' cannot carry shared tools in the executable LangChain→LangGraph bridge; only react_agent tool links are supported", nodeType=source_node_type)
        if source_node_type in {"sub_agent", "deep_agent_suite"} and str(params.get("target_subgraph") or "").startswith("artifact:"):
            raise _bridge_error("nested_bridge_chain_not_supported", "The executable LangChain bridge does not support nested artifact wrapper references")
        if not is_node_type_allowed_for_mode("langgraph", str(source_node_type)):
            raise _bridge_error("unsupported_node_type_for_executable_bridge", f"Node type '{source_node_type}' is not supported by the executable LangChain→LangGraph bridge", nodeType=source_node_type)
        lowered_shapes.append(str(source_node_type))

    contract_id = LANGCHAIN_TO_LANGGRAPH_CONTRACT_ID
    if validated_tools:
        if not has_tool_linked_react_agent:
            raise _bridge_error("executable_bridge_requires_react_agent_tool_link", "Tool-enabled executable LangChain bridges require at least one react_agent node linked to the shared-safe tools", allowedToolFamilies=tool_families)
        contract_id = LANGCHAIN_TO_LANGGRAPH_V2_CONTRACT_ID

    return {
        "contractId": contract_id,
        "artifact": artifact,
        "artifactTitle": manifest.get("title") or artifact.get("name") or "agent",
        "containsReactAgent": has_react_agent,
        "nodeShapes": lowered_shapes,
        "validatedTools": validated_tools,
        "allowedToolFamilies": sorted(SUPPORTED_LANGCHAIN_SHARED_TOOL_TYPES),
        "activeToolFamilies": tool_families,
        "supportsSharedSubagentForm": False,
        "acceptedSourceShape": "LangChain agent artifacts using react_agent plus LangGraph-safe shared nodes; tool-enabled variants may link exactly one shared-safe tool family to react_agent.",
        "blockedShapeCodes": ["unsupported_tool_family", "mixed_tool_families_not_supported", "unsupported_tool_carrier_node_type", "nested_bridge_chain_not_supported", "unsupported_node_type_for_executable_bridge", "executable_bridge_requires_react_agent_tool_link"],
    }


def validate_embedded_native_langchain_manifest(manifest: dict[str, Any]) -> dict[str, Any]:
    artifact, validated_tools, validated_tool_types, tool_families, nodes, _edges = _validate_langchain_source_manifest(manifest)
    allowed_tool_ids: set[str] = set(validated_tool_types)
    accepted_shapes: list[str] = []
    accepted_provider_families: set[str] = set()
    required_env_vars: set[str] = set()
    accepted_models: set[str] = set()
    has_react_agent = False
    for _idx, source_node_type, params, _raw_node in _iter_artifact_nodes(nodes):
        if source_node_type in {"sub_agent", "deep_agent_suite"} and str(params.get("target_subgraph") or "").startswith("artifact:"):
            raise _bridge_error("nested_bridge_chain_not_supported", "The embedded native LangChain artifact contract does not support nested artifact wrapper references")
        if source_node_type not in SUPPORTED_EMBEDDED_LANGCHAIN_NODE_TYPES:
            raise _bridge_error("unsupported_node_type_for_embedded_native", f"Node type '{source_node_type}' is not supported by the embedded native LangChain artifact contract", nodeType=source_node_type)
        providers, env_names, models = _provider_requirements(source_node_type, params)
        accepted_provider_families.update(providers)
        required_env_vars.update(env_names)
        accepted_models.update(models)
        linked_tools = params.get("tools_linked") or []
        if linked_tools:
            if source_node_type != "react_agent":
                raise _bridge_error("unsupported_tool_carrier_node_type", f"Node type '{source_node_type}' cannot carry shared tools in the embedded native LangChain artifact contract; only react_agent tool links are supported", nodeType=source_node_type)
            if not isinstance(linked_tools, list):
                raise _bridge_error("executable_bridge_requires_react_agent_tool_link_list", "react_agent tools_linked must be a list")
            invalid = [tool_id for tool_id in linked_tools if str(tool_id) not in allowed_tool_ids]
            if invalid:
                raise _bridge_error("react_agent_missing_shared_tool_link", f"react_agent references unsupported or missing shared tools: {sorted(set(str(tool_id) for tool_id in invalid))}", invalidToolIds=sorted(set(str(tool_id) for tool_id in invalid)))
        elif validated_tools and source_node_type == "react_agent":
            raise _bridge_error("executable_bridge_requires_react_agent_tool_link", "Tool-enabled embedded LangChain artifacts require at least one react_agent node linked to the shared-safe tools", allowedToolFamilies=tool_families)
        if source_node_type == "react_agent":
            has_react_agent = True
        accepted_shapes.append(str(source_node_type))

    provider_backed = bool(accepted_provider_families)
    accepted_source_shape = (
        "LangChain agent artifacts kept in native authored form with one bounded component using react_agent, llm_chat, or shared-safe local nodes; shared-safe tools remain limited to exactly one allowed family linked through react_agent. "
        "Provider-backed embedded execution stays bounded to providers whose contracts are modeled explicitly by the current runtime surface."
    )

    return {
        "contractId": LANGCHAIN_EMBEDDED_NATIVE_CONTRACT_ID,
        "artifact": artifact,
        "artifactTitle": manifest.get("title") or artifact.get("name") or "agent",
        "containsReactAgent": has_react_agent,
        "nodeShapes": accepted_shapes,
        "validatedTools": validated_tools,
        "allowedToolFamilies": sorted(SUPPORTED_LANGCHAIN_SHARED_TOOL_TYPES),
        "activeToolFamilies": tool_families,
        "providerBacked": provider_backed,
        "acceptedProviderFamilies": sorted(accepted_provider_families),
        "requiredProviderEnvVars": sorted(required_env_vars),
        "acceptedProviderModels": sorted(accepted_models),
        "acceptedSourceShape": accepted_source_shape,
        "blockedShapeCodes": [
            "unsupported_tool_family",
            "mixed_tool_families_not_supported",
            "unsupported_tool_carrier_node_type",
            "nested_bridge_chain_not_supported",
            "unsupported_node_type_for_embedded_native",
            "unsupported_embedded_provider",
            "provider_config_missing",
            "provider_init_failed",
            "executable_bridge_requires_react_agent_tool_link",
        ],
    }


def validate_compile_capable_bridge_reference(target_subgraph: str, *, target_mode: str) -> dict[str, Any]:
    source_kind, source_id, manifest = load_artifact_reference(target_subgraph)
    artifact = _artifact_payload(manifest)
    project_mode = infer_project_mode(artifact_type=artifact.get("artifactType") or manifest.get("kind"), execution_profile=artifact.get("executionProfile"), project_mode=artifact.get("projectMode"))
    if target_mode == "langgraph" and project_mode == "langchain" and source_kind == "agent":
        metadata = validate_langchain_agent_bridge_manifest(manifest)
        metadata.update({"sourceMode": project_mode, "sourceKind": source_kind, "sourceId": source_id, "targetSubgraph": target_subgraph})
        return metadata
    raise _bridge_error("no_executable_bridge_contract", f"No executable bridge contract exists for '{target_subgraph}' into '{target_mode}'", targetSubgraph=target_subgraph, targetMode=target_mode)


def validate_embedded_native_reference(target_subgraph: str, *, target_mode: str) -> dict[str, Any]:
    source_kind, source_id, manifest = load_artifact_reference(target_subgraph)
    artifact = _artifact_payload(manifest)
    project_mode = infer_project_mode(artifact_type=artifact.get("artifactType") or manifest.get("kind"), execution_profile=artifact.get("executionProfile"), project_mode=artifact.get("projectMode"))
    if target_mode == "langgraph" and project_mode == "langchain" and source_kind == "agent":
        metadata = validate_embedded_native_langchain_manifest(manifest)
        metadata.update({"sourceMode": project_mode, "sourceKind": source_kind, "sourceId": source_id, "targetSubgraph": target_subgraph})
        return metadata
    raise _bridge_error("no_embedded_native_contract", f"No embedded native artifact contract exists for '{target_subgraph}' into '{target_mode}'", targetSubgraph=target_subgraph, targetMode=target_mode)


def _prefix_artifact_graph(metadata: dict[str, Any], *, prefix: str, lowered: bool) -> dict[str, Any]:
    artifact = metadata["artifact"]
    source_id = metadata["sourceId"]
    nodes_out: list[dict[str, Any]] = []
    id_map: dict[str, str] = {}
    for idx, raw_node in enumerate(artifact.get("nodes", [])):
        node = deepcopy(raw_node)
        original_id = str(node.get("id") or f"node_{idx}")
        lowered_id = f"{prefix}_{original_id}"
        id_map[original_id] = lowered_id
        source_type = (node.get("data") or {}).get("nodeType") or node.get("type")
        node_type = "llm_chat" if lowered and source_type == "react_agent" else source_type
        params = deepcopy((node.get("data") or {}).get("params") or {})
        if isinstance(params.get("tools_linked"), list):
            params["tools_linked"] = [f"{prefix}_{tool_id}" for tool_id in params["tools_linked"]]
        nodes_out.append({
            "id": lowered_id,
            "type": node_type,
            "inputs": list(node.get("inputs") or []),
            "outputs": list(node.get("outputs") or []),
            "params": params,
            "bridge_origin": {
                "sourceMode": "langchain",
                "sourceArtifactType": "agent",
                "sourceArtifactId": source_id,
                "sourceNodeType": source_type,
                "integrationModel": "lowered_bridge" if lowered else "embedded_native",
            },
        })
    edges_out: list[dict[str, Any]] = []
    for raw_edge in artifact.get("edges", []):
        if not isinstance(raw_edge, dict):
            continue
        edge = deepcopy(raw_edge)
        if edge.get("source") in id_map:
            edge["source"] = id_map[edge["source"]]
        if edge.get("target") in id_map:
            edge["target"] = id_map[edge["target"]]
        if edge.get("router_id") in id_map:
            edge["router_id"] = id_map[edge["router_id"]]
        edges_out.append(edge)
    tools_out: list[dict[str, Any]] = []
    for raw_tool in metadata.get("validatedTools", []):
        tool = deepcopy(raw_tool)
        tool["id"] = f"{prefix}_{tool['id']}"
        tools_out.append(tool)
    return {
        "artifact": artifact,
        "artifact_id": source_id,
        "artifact_title": metadata.get("artifactTitle") or source_id,
        "nodes": nodes_out,
        "edges": edges_out,
        "tools": tools_out,
        "state_schema": list(artifact.get("customStateSchema") or []),
        "runtime_settings": dict(artifact.get("runtimeSettings") or {}),
    }


def lower_langchain_agent_reference(target_subgraph: str) -> dict[str, Any]:
    metadata = validate_compile_capable_bridge_reference(target_subgraph, target_mode="langgraph")
    source_id = metadata["sourceId"]
    prefixed = _prefix_artifact_graph(metadata, prefix=f"bridge_{source_id}", lowered=True)
    return {
        "graph_key": target_subgraph,
        "function_name": f"bridge_{source_id}",
        "artifact_id": source_id,
        "artifact_title": prefixed["artifact_title"],
        "source_mode": "langchain",
        "contract_id": metadata["contractId"],
        "integration_model": "lowered_bridge",
        "nodes": prefixed["nodes"],
        "edges": prefixed["edges"],
        "tools": prefixed["tools"],
        "state_schema": prefixed["state_schema"],
        "runtime_settings": prefixed["runtime_settings"],
        "provider_families": metadata.get("acceptedProviderFamilies", []),
        "required_provider_env_vars": metadata.get("requiredProviderEnvVars", []),
        "accepted_provider_models": metadata.get("acceptedProviderModels", []),
        "provider_backed": bool(metadata.get("providerBacked")),
    }


def embed_langchain_agent_reference(target_subgraph: str) -> dict[str, Any]:
    metadata = validate_embedded_native_reference(target_subgraph, target_mode="langgraph")
    source_id = metadata["sourceId"]
    prefixed = _prefix_artifact_graph(metadata, prefix=f"embedded_{source_id}", lowered=False)
    return {
        "graph_key": target_subgraph,
        "function_name": f"embedded_{source_id}",
        "artifact_id": source_id,
        "artifact_title": prefixed["artifact_title"],
        "source_mode": "langchain",
        "contract_id": metadata["contractId"],
        "integration_model": "embedded_native",
        "nodes": prefixed["nodes"],
        "edges": prefixed["edges"],
        "tools": prefixed["tools"],
        "state_schema": prefixed["state_schema"],
        "runtime_settings": prefixed["runtime_settings"],
    }
