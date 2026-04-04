from __future__ import annotations
from typing import Any, Optional
import re
from pydantic import BaseModel, Field, field_validator, model_validator

from core.capability_matrix import known_artifact_kinds, known_execution_profiles, visible_artifact_kinds, visible_execution_profiles, legacy_artifact_kinds, legacy_execution_profiles, known_project_modes
from core.provider_contracts import normalize_provider, known_providers, provider_aliases
from core.mode_contracts import infer_project_mode, is_mode_artifact_allowed, is_mode_compile_enabled, is_mode_execution_profile_allowed, is_node_type_allowed_for_mode, find_bridge
from core.bridge_lowering import BridgeLoweringError, validate_compile_capable_bridge_reference, validate_embedded_native_reference


PROVIDER_ALIASES = provider_aliases()
ALLOWED_PROVIDERS = set(known_providers())

SAFE_GRAPH_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$")
SAFE_IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
SAFE_TYPE_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_\[\], .|]*$")
VISIBLE_ARTIFACT_TYPES = set(visible_artifact_kinds())
VISIBLE_EXECUTION_PROFILES = set(visible_execution_profiles())
LEGACY_ARTIFACT_TYPES = set(legacy_artifact_kinds())
LEGACY_EXECUTION_PROFILES = set(legacy_execution_profiles())
ALL_ARTIFACT_TYPES = set(known_artifact_kinds())
ALL_EXECUTION_PROFILES = set(known_execution_profiles())
ALL_PROJECT_MODES = set(known_project_modes())
DEFAULT_STATE_SCHEMA = (
    {"name": "messages", "type": "list", "reducer": "add_messages"},
    {"name": "documents", "type": "list", "reducer": "operator.add"},
    {"name": "custom_vars", "type": "dict", "reducer": "update"},
)


def _require_safe_identifier(value: str, *, label: str) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{label} must be a string")
    stripped = value.strip()
    if not stripped:
        raise ValueError(f"{label} must not be empty")
    if not SAFE_IDENTIFIER_RE.fullmatch(stripped):
        raise ValueError(
            f"{label} must be a valid Python identifier using only letters, digits, and underscores, got '{value}'"
        )
    return stripped


def _require_safe_type(value: str, *, label: str) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{label} must be a string")
    stripped = value.strip()
    if not stripped:
        raise ValueError(f"{label} must not be empty")
    if not SAFE_TYPE_RE.fullmatch(stripped):
        raise ValueError(
            f"{label} contains unsupported characters for generated Python annotations: '{value}'"
        )
    return stripped


def _normalize_artifact_type(value: Optional[str]) -> Optional[str]:
    if value is None:
        return value
    if value not in ALL_ARTIFACT_TYPES:
        raise ValueError(f"artifact_type must be one of {sorted(ALL_ARTIFACT_TYPES)}")
    return value


def _normalize_execution_profile(value: Optional[str]) -> Optional[str]:
    if value is None:
        return value
    aliases = {"sync": "langgraph_sync", "async": "langgraph_async"}
    normalized = aliases.get(value, value)
    if normalized not in ALL_EXECUTION_PROFILES:
        raise ValueError(f"execution_profile must be one of {sorted(ALL_EXECUTION_PROFILES)}")
    return normalized



def _normalize_project_mode(value: Optional[str]) -> Optional[str]:
    if value is None:
        return value
    if value not in ALL_PROJECT_MODES:
        raise ValueError(f"project_mode must be one of {sorted(ALL_PROJECT_MODES)}")
    return value

def _canonicalize_state_schema(entries: list[StateField], nodes: list["GraphNode"]) -> list[StateField]:
    deduped: dict[str, StateField] = {}
    for default_field in DEFAULT_STATE_SCHEMA:
        field = StateField(**default_field)
        deduped[field.name] = field
    for entry in entries:
        deduped[entry.name] = entry
    if any(getattr(node.params, "catch_errors", None) == "true" for node in nodes):
        deduped["last_error"] = StateField(name="last_error", type="str", reducer="none")
    return list(deduped.values())


class GraphConfig(BaseModel):
    persistence_type: str = "memory"
    cross_thread_memory: bool = False


class StateField(BaseModel):
    name: str
    type: str
    reducer: str = "none"

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return _require_safe_identifier(v, label="State field name")

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        return _require_safe_type(v, label="State field type")


class NodeParams(BaseModel):
    model_config = {"extra": "allow"}

    provider: Optional[str] = None
    model_name: Optional[str] = None
    temperature: Optional[float] = None
    system_prompt: Optional[str] = None
    tools_linked: Optional[list[str]] = None
    state_key_path: Optional[str] = None
    routes: Optional[list[dict]] = None
    json_field: Optional[str] = None
    state_key: Optional[str] = None
    fallback_handle: Optional[str] = None
    fallback: Optional[str] = None
    namespace_prefix: Optional[str] = None
    user_id_key: Optional[str] = None
    output_key: Optional[str] = None
    target_subgraph: Optional[str] = None
    target_group: Optional[str] = None
    target_agent: Optional[str] = None
    max_invocations: Optional[int] = None
    allow_repeat: Optional[str] = None
    extract_depth: Optional[str] = None
    include_images: Optional[bool] = None
    read_only: Optional[bool] = True
    text: Optional[str] = None
    prompt: Optional[str] = None
    input_key: Optional[str] = None
    embedding_model: Optional[str] = None
    db_path: Optional[str] = None
    collection_name: Optional[str] = None
    top_k: Optional[int] = None
    api_key_env: Optional[str] = None
    max_messages: Optional[int] = None
    max_tokens: Optional[int] = None
    max_iterations: Optional[int] = None
    top_p: Optional[float] = None
    frequency_penalty: Optional[float] = None
    presence_penalty: Optional[float] = None
    api_base_url: Optional[str] = None
    stop_sequences: Optional[list[str]] = None
    score_threshold: Optional[float] = None
    chunk_overlap: Optional[int] = None
    strategy: Optional[str] = None
    keep_system: Optional[str] = None
    ttl_seconds: Optional[int] = None
    max_entries: Optional[int] = None
    case_sensitive: Optional[str] = None
    input_keys: Optional[list[str]] = Field(default_factory=list)
    needs_validation: Optional[bool] = False
    memory_key: Optional[str] = None
    state_key_to_save: Optional[str] = None
    access_mode: Optional[str] = None
    target_key: Optional[str] = None
    new_value: Optional[str] = None
    command_message: Optional[str] = None
    handoff_key: Optional[str] = None
    handoff_value: Optional[str] = None
    handoff_message: Optional[str] = None
    items_key: Optional[str] = None
    item_state_key: Optional[str] = None
    passthrough_state_keys: Optional[list[str]] = Field(default_factory=list)
    copy_messages: Optional[str] = None
    copy_custom_vars: Optional[str] = None
    fanout_count_key: Optional[str] = None
    store_item_key: Optional[str] = None
    query_key: Optional[str] = None
    limit: Optional[int] = None
    selection_mode: Optional[str] = None
    file_path: Optional[str] = None
    retries: Optional[int] = 0
    catch_errors: Optional[str] = None
    structured_schema: Optional[list[dict]] = None
    context_key: Optional[str] = None
    default_value: Optional[str] = None
    field_name: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def coerce_empty_strings(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        numeric_fields = {
            "temperature", "top_p", "frequency_penalty", "presence_penalty",
            "score_threshold", "top_k", "chunk_overlap", "max_messages",
            "max_tokens", "max_iterations", "max_entries", "ttl_seconds", "retries", "limit",
        }
        for key in numeric_fields:
            if key in data and data[key] == "":
                data[key] = None

        provider = data.get("provider")
        if isinstance(provider, str):
            provider = normalize_provider(provider)
            data["provider"] = provider
            if provider and provider not in ALLOWED_PROVIDERS:
                raise ValueError(
                    f"Unsupported provider '{provider}'. Allowed providers: {sorted(ALLOWED_PROVIDERS)}"
                )

        passthrough_state_keys = data.get("passthrough_state_keys")
        if passthrough_state_keys is not None:
            if not isinstance(passthrough_state_keys, list):
                raise ValueError("passthrough_state_keys must be a list of state keys")
            data["passthrough_state_keys"] = [
                _require_safe_identifier(str(state_key), label="passthrough_state_keys entry")
                for state_key in passthrough_state_keys
            ]

        tools_linked = data.get("tools_linked")
        if tools_linked is not None:
            if not isinstance(tools_linked, list):
                raise ValueError("tools_linked must be a list of tool ids")
            data["tools_linked"] = [
                _require_safe_identifier(str(tool_id), label="Linked tool id")
                for tool_id in tools_linked
            ]

        structured_schema = data.get("structured_schema")
        if structured_schema is not None:
            if not isinstance(structured_schema, list):
                raise ValueError("structured_schema must be a list of field definitions")
            sanitized_fields = []
            for idx, field_def in enumerate(structured_schema):
                if not isinstance(field_def, dict):
                    raise ValueError(f"structured_schema[{idx}] must be an object")
                name = _require_safe_identifier(str(field_def.get("name", "")), label=f"structured_schema[{idx}].name")
                field_type = _require_safe_type(str(field_def.get("type", "str") or "str"), label=f"structured_schema[{idx}].type")
                description = field_def.get("description", "")
                if description is None:
                    description = ""
                if not isinstance(description, str):
                    description = str(description)
                sanitized_fields.append({
                    "name": name,
                    "type": field_type,
                    "description": description,
                })
            data["structured_schema"] = sanitized_fields
        return data


class GraphNode(BaseModel):
    id: str
    type: str
    inputs: list[str] = Field(default_factory=list)
    outputs: list[str] = Field(default_factory=list)
    params: NodeParams = Field(default_factory=NodeParams)

    @field_validator("id")
    @classmethod
    def validate_id(cls, v: str) -> str:
        return _require_safe_identifier(v, label="Node id")

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        aliases = {"subgraph": "sub_agent", "subgraph_node": "sub_agent", "deep_agent_suite": "sub_agent", "deep_memory_skill": "memory_store_read"}
        normalized = aliases.get(v, v)
        allowed = {
            "llm_chat", "logic_router", "memory_store_read",
            "sub_agent", "rag_retriever_local", "context_trimmer",
            "tool_executor", "react_agent",
            "parallel_aggregator", "human_interrupt", "memory_checkpoint",
            "user_input_node", "debug_print", "static_text",
            "memoryreader", "memorywriter", "memory_access", "update_state_node", "file_loader_node",
            "chat_output",
            "python_executor_node",
            "data_container",
            "command_node", "handoff_node", "send_fanout", "reduce_join", "store_put", "store_search", "store_get", "store_delete", "runtime_context_read", "structured_output_extract", "structured_output_router",
        }
        if normalized not in allowed:
            raise ValueError(f"Node type must be one of {allowed}, got '{v}'")
        return normalized

    @model_validator(mode="after")
    def validate_node_requirements(self) -> "GraphNode":
        if self.type == "llm_chat":
            if not self.params.model_name:
                self.params.model_name = "gpt-4o-mini"
            if not self.outputs:
                self.outputs = ["messages"]
        elif self.type == "react_agent":
            if not self.params.model_name:
                self.params.model_name = "gpt-4o"
        elif self.type == "rag_retriever_local":
            if not self.params.db_path:
                self.params.db_path = "./local_chroma_db"
        elif self.type == "logic_router":
            if not self.params.state_key:
                self.params.state_key = self.params.state_key_path or "messages"
            if not self.params.json_field:
                self.params.json_field = "route"
            if not self.params.routes:
                self.params.routes = [{"value": "continue", "handle_id": "continue"}]
            if not self.params.fallback_handle:
                self.params.fallback_handle = self.params.fallback or "fallback"
        elif self.type == "memory_store_read":
            if not self.params.namespace_prefix:
                raise ValueError(
                    f"Node '{self.id}': memory_store_read requires params.namespace_prefix"
                )
            if not self.params.user_id_key:
                raise ValueError(
                    f"Node '{self.id}': memory_store_read requires params.user_id_key"
                )
            if not self.params.output_key:
                raise ValueError(
                    f"Node '{self.id}': memory_store_read requires params.output_key"
                )
        elif self.type == "memory_access":
            mode = getattr(self.params, "access_mode", None) or "profile_read"
            self.params.access_mode = mode
            if not self.params.namespace_prefix:
                self.params.namespace_prefix = "memory"
            if mode == "profile_read":
                if not self.params.user_id_key:
                    self.params.user_id_key = "custom_vars.user_id"
                if not self.params.store_item_key:
                    self.params.store_item_key = "profile"
                if not self.params.output_key:
                    self.params.output_key = "memory_payload"
            elif mode == "get":
                if not self.params.store_item_key:
                    raise ValueError(f"Node '{self.id}': memory_access(get) requires params.store_item_key")
                if not self.params.output_key:
                    self.params.output_key = "memory_payload"
            elif mode == "search":
                if not self.params.query_key:
                    self.params.query_key = "messages"
                if not self.params.output_key:
                    self.params.output_key = "memory_payload"
                if not self.params.limit:
                    self.params.limit = 5
            else:
                raise ValueError(f"Node '{self.id}': memory_access params.access_mode must be one of profile_read, get, search")
        elif self.type == "sub_agent":
            if not self.params.target_subgraph:
                self.params.target_subgraph = "default_subgraph"
        elif self.type == "command_node":
            if not self.params.target_key:
                self.params.target_key = "route_state"
            if self.params.new_value is None:
                self.params.new_value = "approved"
        elif self.type == "handoff_node":
            if not self.params.handoff_key:
                self.params.handoff_key = "active_agent"
            if not self.params.handoff_value:
                raise ValueError(f"Node '{self.id}': handoff_node requires params.handoff_value")
        elif self.type == "send_fanout":
            if not self.params.items_key:
                self.params.items_key = "documents"
            if not self.params.item_state_key:
                self.params.item_state_key = "current_item"
            if getattr(self.params, "passthrough_state_keys", None) is None:
                self.params.passthrough_state_keys = []
            if getattr(self.params, "copy_messages", None) not in {"true", "false", None, ""}:
                raise ValueError(f"Node '{self.id}': send_fanout params.copy_messages must be 'true' or 'false'")
            if getattr(self.params, "copy_custom_vars", None) not in {"true", "false", None, ""}:
                raise ValueError(f"Node '{self.id}': send_fanout params.copy_custom_vars must be 'true' or 'false'")
        elif self.type == "runtime_context_read":
            if not self.params.output_key:
                self.params.output_key = "runtime_context"
        elif self.type == "structured_output_extract":
            if not self.params.source_key:
                self.params.source_key = "structured_output"
            if not self.params.output_key:
                self.params.output_key = "structured_value"
        elif self.type == "structured_output_router":
            if not self.params.source_key:
                self.params.source_key = "structured_output"
            if not self.params.field_name:
                self.params.field_name = "status"
            if not self.params.routes:
                self.params.routes = [{"value": "success", "handle_id": "success"}]
            if not self.params.fallback_handle:
                self.params.fallback_handle = self.params.fallback or "fallback"
        elif self.type == "store_put":
            if not self.params.namespace_prefix:
                raise ValueError(f"Node '{self.id}': store_put requires params.namespace_prefix")
            if not self.params.store_item_key:
                raise ValueError(f"Node '{self.id}': store_put requires params.store_item_key")
            if not self.params.state_key_to_save:
                self.params.state_key_to_save = "messages"
        elif self.type == "store_search":
            if not self.params.namespace_prefix:
                raise ValueError(f"Node '{self.id}': store_search requires params.namespace_prefix")
            if not self.params.query_key:
                self.params.query_key = "messages"
            if not self.params.output_key:
                self.params.output_key = "store_results"
            if not self.params.limit:
                self.params.limit = 5

        elif self.type == "reduce_join":
            if not self.params.results_key:
                raise ValueError(f"Node '{self.id}': reduce_join requires params.results_key")
            if not self.params.output_key:
                raise ValueError(f"Node '{self.id}': reduce_join requires params.output_key")
            join_mode = getattr(self.params, 'join_mode', 'list') or 'list'
            if join_mode not in {'list', 'text_join', 'first_non_null', 'count'}:
                raise ValueError(f"Node '{self.id}': reduce_join params.join_mode must be one of list, text_join, first_non_null, count")
        elif self.type == "store_get":
            if not self.params.namespace_prefix:
                raise ValueError(f"Node '{self.id}': store_get requires params.namespace_prefix")
            if not self.params.store_item_key:
                raise ValueError(f"Node '{self.id}': store_get requires params.store_item_key")
            if not self.params.output_key:
                self.params.output_key = "store_value"
        elif self.type == "store_delete":
            if not self.params.namespace_prefix:
                raise ValueError(f"Node '{self.id}': store_delete requires params.namespace_prefix")
            if not self.params.store_item_key:
                raise ValueError(f"Node '{self.id}': store_delete requires params.store_item_key")
        return self


class ToolParams(BaseModel):
    model_config = {"extra": "allow"}

    method: Optional[str] = "POST"
    url: Optional[str] = None
    headers: Optional[dict[str, str]] = Field(default_factory=dict)
    tavily_api_key: Optional[str] = None
    max_results: Optional[int] = None
    db_path: Optional[str] = None
    target_subgraph: Optional[str] = None
    target_group: Optional[str] = None
    target_agent: Optional[str] = None
    max_invocations: Optional[int] = None
    allow_repeat: Optional[str] = None
    extract_depth: Optional[str] = None
    include_images: Optional[bool] = None
    read_only: Optional[bool] = True


class GraphTool(BaseModel):
    id: str
    type: str = "python_function"
    code: str = ""
    description: Optional[str] = None
    params: ToolParams = Field(default_factory=ToolParams)

    @field_validator("id")
    @classmethod
    def validate_id(cls, v: str) -> str:
        return _require_safe_identifier(v, label="Tool id")

    @field_validator("type")
    @classmethod
    def validate_tool_type(cls, v: str) -> str:
        aliases = {"subgraph_tool": "sub_agent_tool", "deep_subagent_worker": "tool_llm_worker"}
        normalized = aliases.get(v, v)
        allowed = {"python_function", "rest_api", "web_search", "brave_search", "duckduckgo_search", "tavily_extract", "python_repl", "api_call", "requests_get", "requests_post", "fs_list_dir", "fs_read_file", "fs_glob", "fs_grep", "fs_write_file", "fs_edit_file", "fs_apply_patch", "shell_command", "sql_query", "sql_list_tables", "sql_get_schema", "sql_query_check", "rpg_dice_roller", "pw_navigate", "pw_click", "pw_extract_text", "pw_extract_links", "pw_get_elements", "pw_current_page", "pw_fill", "playwright_wait", "playwright_scroll", "playwright_extract_links", "playwright_keypress", "playwright_screenshot", "github_get_issue", "github_get_pull_request", "github_read_file", "github_search_issues_prs", "sub_agent_tool", "tool_llm_worker"}
        if normalized not in allowed:
            raise ValueError(f"Tool type must be one of {allowed}, got '{v}'")
        return normalized

    @model_validator(mode="after")
    def validate_tool_requirements(self) -> "GraphTool":
        if self.type == "rest_api":
            if not self.params.url:
                raise ValueError(
                    f"Tool '{self.id}': rest_api requires params.url")
        if self.type == "api_call":
            if not self.params.url:
                raise ValueError(
                    f"Tool '{self.id}': api_call requires params.url")
        if self.type in {"sql_query", "sql_list_tables", "sql_get_schema", "sql_query_check"}:
            if not self.params.db_path:
                self.params.db_path = "data.db"
        if self.type in {"fs_list_dir", "fs_read_file", "fs_glob", "fs_grep", "fs_write_file", "fs_edit_file", "fs_apply_patch", "shell_command"} and not getattr(self.params, 'root_path', None):
            self.params.root_path = "."
        if self.type == "sql_query" and self.params.read_only is None:
            self.params.read_only = True
        if self.type == "tavily_extract":
            if self.params.extract_depth not in {"basic", "advanced"}:
                self.params.extract_depth = "basic"
            if self.params.include_images is None:
                self.params.include_images = False
            if not self.params.tavily_api_key:
                self.params.tavily_api_key = "TAVILY_API_KEY"
        if self.type == "web_search" and not self.params.tavily_api_key:
            self.params.tavily_api_key = "TAVILY_API_KEY"
        if self.type == "sub_agent_tool":
            if not self.params.target_group and not self.params.target_agent and not self.params.target_subgraph:
                raise ValueError(f"Tool '{self.id}': sub_agent_tool requires params.target_group, params.target_agent, or legacy params.target_subgraph")
            if self.params.target_group is None:
                self.params.target_group = 'default'
            if self.params.max_invocations is None:
                self.params.max_invocations = 1
            if self.params.max_invocations < 1:
                raise ValueError(f"Tool '{self.id}': sub_agent_tool params.max_invocations must be >= 1")
        return self


class GraphEdge(BaseModel):
    source: str
    type: str = "direct"
    target: Optional[str] = None
    router_id: Optional[str] = None
    condition: Optional[str] = None

    @field_validator("source")
    @classmethod
    def validate_source(cls, v: str) -> str:
        return _require_safe_identifier(v, label="Edge source")

    @field_validator("target", "router_id")
    @classmethod
    def validate_optional_refs(cls, v: Optional[str], info) -> Optional[str]:
        if v is None:
            return v
        label = "Edge target" if info.field_name == "target" else "Edge router_id"
        return _require_safe_identifier(v, label=label)





class UIBinding(BaseModel):
    name: str
    value: Any = None
    kind: str = "variable"

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return _require_safe_identifier(v, label="UI binding name")

    @field_validator("kind")
    @classmethod
    def validate_kind(cls, v: str) -> str:
        if v not in {"variable", "constant"}:
            raise ValueError("UI binding kind must be 'variable' or 'constant'")
        return v


class SubagentDefinition(BaseModel):
    name: str
    systemPrompt: str = ""
    tools: list[str] = Field(default_factory=list)
    description: Optional[str] = ""

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return _require_safe_identifier(v, label="Subagent name")


class SubagentGroup(BaseModel):
    name: str
    agents: list[SubagentDefinition] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return _require_safe_identifier(v, label="Subagent group name")


class PromptStripVariable(BaseModel):
    name: str
    required: bool = True
    defaultValue: str = ""

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not isinstance(v, str):
            raise ValueError("Prompt strip variable name must be a string")
        stripped = v.strip()
        if not stripped:
            raise ValueError("Prompt strip variable name must not be empty")
        if any(ch in stripped for ch in ("\x00", "\r", "\n")):
            raise ValueError("Prompt strip variable name contains unsupported control characters")
        return stripped


class PromptStripDefinition(BaseModel):
    id: str
    name: str
    description: str = ""
    body: str = ""
    tags: list[str] = Field(default_factory=list)
    variables: list[PromptStripVariable] = Field(default_factory=list)
    origin: str = "workspace"
    artifactRef: Optional[str] = None

    @field_validator("id", "name")
    @classmethod
    def validate_non_empty_text(cls, v: str, info) -> str:
        if not isinstance(v, str):
            raise ValueError(f"Prompt strip {info.field_name} must be a string")
        stripped = v.strip()
        if not stripped:
            raise ValueError(f"Prompt strip {info.field_name} must not be empty")
        if any(ch in stripped for ch in ("\x00", "\r", "\n")):
            raise ValueError(f"Prompt strip {info.field_name} contains unsupported control characters")
        return stripped

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v: list[str]) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for raw in v or []:
            tag = str(raw).strip()
            if not tag or tag in seen:
                continue
            seen.add(tag)
            cleaned.append(tag)
        return cleaned

    @field_validator("origin")
    @classmethod
    def validate_origin(cls, v: str) -> str:
        return "artifact" if v == "artifact" else "workspace"


class PromptAssignmentTarget(BaseModel):
    kind: str
    tabId: str
    nodeId: Optional[str] = None
    groupName: Optional[str] = None
    agentName: Optional[str] = None

    @field_validator("kind")
    @classmethod
    def validate_kind(cls, v: str) -> str:
        if v not in {"graph", "node", "subagent"}:
            raise ValueError("Prompt assignment target kind must be one of graph, node, subagent")
        return v

    @field_validator("tabId")
    @classmethod
    def validate_tab_id(cls, v: str) -> str:
        return _require_safe_identifier(v, label="Prompt assignment target tabId")

    @model_validator(mode="after")
    def validate_target_shape(self) -> "PromptAssignmentTarget":
        if self.kind == "node":
            self.nodeId = _require_safe_identifier(str(self.nodeId or ""), label="Prompt assignment target nodeId")
        elif self.kind == "subagent":
            self.groupName = _require_safe_identifier(str(self.groupName or ""), label="Prompt assignment target groupName")
            self.agentName = _require_safe_identifier(str(self.agentName or ""), label="Prompt assignment target agentName")
        return self


class PromptStripAssignment(BaseModel):
    id: str
    stripId: str
    target: PromptAssignmentTarget
    mergeMode: str = "prepend"
    order: int = 0
    enabled: bool = True

    @field_validator("id")
    @classmethod
    def validate_id(cls, v: str) -> str:
        return _require_safe_identifier(v, label="Prompt assignment id")

    @field_validator("stripId")
    @classmethod
    def validate_strip_id(cls, v: str) -> str:
        return _require_safe_identifier(v, label="Prompt assignment stripId")

    @field_validator("mergeMode")
    @classmethod
    def validate_merge_mode(cls, v: str) -> str:
        if v not in {"prepend", "append", "replace_if_empty"}:
            raise ValueError("Prompt assignment mergeMode must be one of prepend, append, replace_if_empty")
        return v

    @field_validator("order")
    @classmethod
    def validate_order(cls, v: int) -> int:
        return max(0, min(999, int(v)))


class ModulePromptAssignmentPreset(BaseModel):
    id: str
    stripId: str
    targetKind: str = "graph"
    groupName: Optional[str] = None
    agentName: Optional[str] = None
    mergeMode: str = "prepend"
    order: int = 0
    enabled: bool = True

    @field_validator("id", "stripId")
    @classmethod
    def validate_non_empty_identifier(cls, v: str, info) -> str:
        return _require_safe_identifier(v, label=f"module.promptAssignments.{info.field_name}")

    @field_validator("targetKind")
    @classmethod
    def validate_target_kind(cls, v: str) -> str:
        if v not in {"graph", "subagent"}:
            raise ValueError("module.promptAssignments.targetKind must be graph or subagent")
        return v

    @field_validator("mergeMode")
    @classmethod
    def validate_merge_mode(cls, v: str) -> str:
        if v not in {"prepend", "append", "replace_if_empty"}:
            raise ValueError("module.promptAssignments.mergeMode must be prepend, append, or replace_if_empty")
        return v

    @field_validator("order")
    @classmethod
    def validate_order(cls, v: int) -> int:
        if v < 0 or v > 999:
            raise ValueError("module.promptAssignments.order must be between 0 and 999")
        return v

    @model_validator(mode="after")
    def validate_target_fields(self):
        if self.targetKind == "subagent":
            self.groupName = _require_safe_identifier(str(self.groupName or ""), label="module.promptAssignments.groupName")
            self.agentName = _require_safe_identifier(str(self.agentName or ""), label="module.promptAssignments.agentName")
        else:
            self.groupName = None
            self.agentName = None
        return self


class ModuleStarterArtifactRef(BaseModel):
    artifactId: str
    artifactKind: str = "graph"
    label: str = ""
    description: str = ""

    @field_validator("artifactId")
    @classmethod
    def validate_artifact_id(cls, v: str) -> str:
        if not isinstance(v, str):
            raise ValueError("module.starterArtifacts.artifactId must be a string")
        stripped = v.strip()
        if not stripped:
            raise ValueError("module.starterArtifacts.artifactId must not be empty")
        if any(ch in stripped for ch in ("\x00", "\r", "\n")):
            raise ValueError("module.starterArtifacts.artifactId contains unsupported control characters")
        return stripped

    @field_validator("artifactKind")
    @classmethod
    def validate_artifact_kind(cls, v: str) -> str:
        if not isinstance(v, str):
            raise ValueError("module.starterArtifacts.artifactKind must be a string")
        stripped = v.strip()
        if not stripped:
            raise ValueError("module.starterArtifacts.artifactKind must not be empty")
        if any(ch in stripped for ch in ("\x00", "\r", "\n")):
            raise ValueError("module.starterArtifacts.artifactKind contains unsupported control characters")
        return stripped

    @field_validator("label", "description")
    @classmethod
    def validate_text_fields(cls, v: str) -> str:
        if not isinstance(v, str):
            raise ValueError("module starter text fields must be strings")
        if any(ch in v for ch in ("\x00", "\r", "\n")):
            raise ValueError("module starter text fields contain unsupported control characters")
        return v


class SubagentRef(BaseModel):
    groupName: str
    agentName: str

    @field_validator("groupName")
    @classmethod
    def validate_group_name(cls, v: str) -> str:
        return _require_safe_identifier(v, label="subagentRef.groupName")

    @field_validator("agentName")
    @classmethod
    def validate_agent_name(cls, v: str) -> str:
        return _require_safe_identifier(v, label="subagentRef.agentName")


class StructuredSeedBase(BaseModel):
    id: str
    title: str
    description: str = ""
    tags: list[str] = Field(default_factory=list)
    mergePolicy: str = "error"
    origin: str = "workspace"
    artifactRef: Optional[str] = None
    sourceModuleId: Optional[str] = None

    @field_validator("id")
    @classmethod
    def validate_id(cls, v: str) -> str:
        return _require_safe_identifier(v, label="seed.id")

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        if not isinstance(v, str):
            raise ValueError("seed.title must be a string")
        stripped = v.strip()
        if not stripped:
            raise ValueError("seed.title must not be empty")
        if any(ch in stripped for ch in ("\x00", "\r", "\n")):
            raise ValueError("seed.title contains unsupported control characters")
        return stripped

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v: list[str]) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for raw in v or []:
            tag = str(raw).strip()
            if not tag or tag in seen:
                continue
            seen.add(tag)
            cleaned.append(tag)
        return cleaned

    @field_validator("mergePolicy")
    @classmethod
    def validate_merge_policy(cls, v: str) -> str:
        if v not in {"error", "preserve", "replace"}:
            raise ValueError("seed.mergePolicy must be error, preserve, or replace")
        return v

    @field_validator("origin")
    @classmethod
    def validate_origin(cls, v: str) -> str:
        return "artifact" if v == "artifact" else "workspace"

    @field_validator("sourceModuleId")
    @classmethod
    def validate_source_module_id(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        return _require_safe_identifier(str(v).strip(), label="seed.sourceModuleId")


class SceneSeed(StructuredSeedBase):
    kind: str = "opening"
    status: str = "seeded"
    locationId: Optional[str] = None
    objective: str = ""
    situation: str = ""
    castGroupNames: list[str] = Field(default_factory=list)
    encounterIds: list[str] = Field(default_factory=list)
    clockIds: list[str] = Field(default_factory=list)

    @field_validator("kind")
    @classmethod
    def validate_kind(cls, v: str) -> str:
        allowed = {"opening", "travel", "social", "investigation", "combat", "fallback"}
        if v not in allowed:
            raise ValueError(f"scene.kind must be one of {sorted(allowed)}")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in {"seeded", "active", "resolved"}:
            raise ValueError("scene.status must be seeded, active, or resolved")
        return v

    @field_validator("locationId")
    @classmethod
    def validate_location_id(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        return _require_safe_identifier(str(v).strip(), label="scene.locationId")

    @field_validator("castGroupNames", "encounterIds", "clockIds")
    @classmethod
    def validate_identifier_lists(cls, v: list[str], info) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for idx, raw in enumerate(v or []):
            item = _require_safe_identifier(str(raw).strip(), label=f"scene.{info.field_name}[{idx}]")
            if item in seen:
                continue
            seen.add(item)
            cleaned.append(item)
        return cleaned


class EncounterSeed(StructuredSeedBase):
    kind: str = "social_pressure"
    status: str = "seeded"
    sceneId: Optional[str] = None
    locationId: Optional[str] = None
    participantRefs: list[SubagentRef] = Field(default_factory=list)
    pressure: str = "medium"
    stakes: str = ""
    successAtCost: str = ""
    falloutOnFail: str = ""
    suggestedToolIds: list[str] = Field(default_factory=list)

    @field_validator("kind")
    @classmethod
    def validate_kind(cls, v: str) -> str:
        allowed = {"social_pressure", "combat_pressure", "hazard", "investigation", "pursuit"}
        if v not in allowed:
            raise ValueError(f"encounter.kind must be one of {sorted(allowed)}")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in {"seeded", "active", "resolved"}:
            raise ValueError("encounter.status must be seeded, active, or resolved")
        return v

    @field_validator("sceneId", "locationId")
    @classmethod
    def validate_optional_ids(cls, v: Optional[str], info) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        return _require_safe_identifier(str(v).strip(), label=f"encounter.{info.field_name}")

    @field_validator("pressure")
    @classmethod
    def validate_pressure(cls, v: str) -> str:
        if v not in {"low", "medium", "high"}:
            raise ValueError("encounter.pressure must be low, medium, or high")
        return v

    @field_validator("suggestedToolIds")
    @classmethod
    def validate_tool_ids(cls, v: list[str]) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for idx, raw in enumerate(v or []):
            item = _require_safe_identifier(str(raw).strip(), label=f"encounter.suggestedToolIds[{idx}]")
            if item in seen:
                continue
            seen.add(item)
            cleaned.append(item)
        return cleaned


class LocationSeed(StructuredSeedBase):
    kind: str = "site"
    status: str = "seeded"
    summary: str = ""
    region: str = ""
    parentLocationId: Optional[str] = None
    sceneIds: list[str] = Field(default_factory=list)

    @field_validator("kind")
    @classmethod
    def validate_kind(cls, v: str) -> str:
        allowed = {"inn", "district", "station", "ruin", "wilderness", "settlement", "site"}
        if v not in allowed:
            raise ValueError(f"location.kind must be one of {sorted(allowed)}")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in {"seeded", "active", "resolved"}:
            raise ValueError("location.status must be seeded, active, or resolved")
        return v

    @field_validator("parentLocationId")
    @classmethod
    def validate_parent_location_id(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        return _require_safe_identifier(str(v).strip(), label="location.parentLocationId")

    @field_validator("sceneIds")
    @classmethod
    def validate_scene_ids(cls, v: list[str]) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for idx, raw in enumerate(v or []):
            item = _require_safe_identifier(str(raw).strip(), label=f"location.sceneIds[{idx}]")
            if item in seen:
                continue
            seen.add(item)
            cleaned.append(item)
        return cleaned


class ClockSeed(StructuredSeedBase):
    status: str = "seeded"
    segments: int = 4
    progress: int = 0
    trigger: str = ""
    consequence: str = ""
    sceneId: Optional[str] = None
    locationId: Optional[str] = None
    factionIds: list[str] = Field(default_factory=list)
    linkedSceneIds: list[str] = Field(default_factory=list)
    linkedEncounterIds: list[str] = Field(default_factory=list)
    publicVisible: bool = False

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in {"seeded", "active", "resolved"}:
            raise ValueError("clock.status must be seeded, active, or resolved")
        return v

    @field_validator("segments")
    @classmethod
    def validate_segments(cls, v: int) -> int:
        if v < 1 or v > 24:
            raise ValueError("clock.segments must be between 1 and 24")
        return v

    @field_validator("progress")
    @classmethod
    def validate_progress(cls, v: int) -> int:
        if v < 0:
            raise ValueError("clock.progress must be >= 0")
        return v

    @field_validator("sceneId", "locationId")
    @classmethod
    def validate_optional_ids(cls, v: Optional[str], info) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        return _require_safe_identifier(str(v).strip(), label=f"clock.{info.field_name}")

    @field_validator("factionIds", "linkedSceneIds", "linkedEncounterIds")
    @classmethod
    def validate_linked_id_lists(cls, v: list[str], info) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for idx, raw in enumerate(v or []):
            item = _require_safe_identifier(str(raw).strip(), label=f"clock.{info.field_name}[{idx}]")
            if item in seen:
                continue
            seen.add(item)
            cleaned.append(item)
        return cleaned

    @model_validator(mode="after")
    def validate_progress_within_segments(self):
        if self.progress > self.segments:
            raise ValueError("clock.progress must not exceed clock.segments")
        return self


class FactionPresence(BaseModel):
    locationId: str
    strength: str = "hidden"
    details: str = ""

    @field_validator("locationId")
    @classmethod
    def validate_location_id(cls, v: str) -> str:
        return _require_safe_identifier(v, label="factionPresence.locationId")

    @field_validator("strength")
    @classmethod
    def validate_strength(cls, v: str) -> str:
        if v not in {"hidden", "weak", "present", "strong", "dominant"}:
            raise ValueError("factionPresence.strength must be hidden, weak, present, strong, or dominant")
        return v


class FactionSeed(StructuredSeedBase):
    tier: str = "local"
    factionType: str = "political"
    presence: list[FactionPresence] = Field(default_factory=list)
    agenda: str = ""
    resources: list[str] = Field(default_factory=list)
    rivalIds: list[str] = Field(default_factory=list)
    allyIds: list[str] = Field(default_factory=list)
    clockIds: list[str] = Field(default_factory=list)
    sceneIds: list[str] = Field(default_factory=list)
    leaderName: Optional[str] = None
    headquartersLocationId: Optional[str] = None

    @field_validator("tier")
    @classmethod
    def validate_tier(cls, v: str) -> str:
        if v not in {"local", "regional", "global", "planar", "cosmic"}:
            raise ValueError("faction.tier must be local, regional, global, planar, or cosmic")
        return v

    @field_validator("factionType")
    @classmethod
    def validate_faction_type(cls, v: str) -> str:
        allowed_types = {"political", "criminal", "economic", "mystical", "military", "guild", "mercantile", "religious", "nomadic", "hermetic"}
        if v not in allowed_types:
            raise ValueError(f"faction.factionType must be one of {sorted(allowed_types)}")
        return v

    @field_validator("rivalIds", "allyIds", "clockIds", "sceneIds")
    @classmethod
    def validate_linked_lists(cls, v: list[str], info) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for idx, raw in enumerate(v or []):
            item = _require_safe_identifier(str(raw).strip(), label=f"faction.{info.field_name}[{idx}]")
            if item in seen:
                continue
            seen.add(item)
            cleaned.append(item)
        return cleaned

    @field_validator("leaderName")
    @classmethod
    def validate_leader_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        return str(v).strip()

    @field_validator("headquartersLocationId")
    @classmethod
    def validate_headquarters(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        return _require_safe_identifier(str(v).strip(), label="faction.headquartersLocationId")


class HookTarget(BaseModel):
    targetType: str
    targetId: str
    weight: float = 1.0

    @field_validator("targetType")
    @classmethod
    def validate_target_type(cls, v: str) -> str:
        allowed = {"scene", "location", "encounter", "faction", "npc", "any"}
        if v not in allowed:
            raise ValueError(f"hookTarget.targetType must be one of {sorted(allowed)}")
        return v

    @field_validator("targetId")
    @classmethod
    def validate_target_id(cls, v: str) -> str:
        return _require_safe_identifier(v, label="hookTarget.targetId")

    @field_validator("weight")
    @classmethod
    def validate_weight(cls, v: float) -> float:
        if v < 0.0 or v > 10.0:
            raise ValueError("hookTarget.weight must be between 0.0 and 10.0")
        return v


class HookSeed(StructuredSeedBase):
    hookKind: str = "rumor"
    triggerCondition: str = "always"
    content: str = ""
    targets: list[HookTarget] = Field(default_factory=list)
    expirationClockId: Optional[str] = None
    expirationCondition: str = ""
    used: bool = False
    hidden: bool = True
    gmNotes: str = ""
    suggestedChecks: list[str] = Field(default_factory=list)

    @field_validator("hookKind")
    @classmethod
    def validate_hook_kind(cls, v: str) -> str:
        allowed = {"rumor", "event", "discovery", "threat", "opportunity", "mystery", "task", "vision"}
        if v not in allowed:
            raise ValueError(f"hook.hookKind must be one of {sorted(allowed)}")
        return v

    @field_validator("triggerCondition")
    @classmethod
    def validate_trigger(cls, v: str) -> str:
        if not isinstance(v, str):
            raise ValueError("hook.triggerCondition must be a string")
        return v.strip()

    @field_validator("expirationClockId")
    @classmethod
    def validate_expiration_clock(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        return _require_safe_identifier(str(v).strip(), label="hook.expirationClockId")


class ModuleSlotProvision(BaseModel):
    slot: str
    entityType: str
    entityId: str
    policy: str = "exclusive"

    @field_validator("slot")
    @classmethod
    def validate_slot(cls, v: str) -> str:
        allowed = {
            "opening_scene",
            "default_location",
            "starter_encounter",
            "starter_clock",
            "primary_cast",
            "fallback_referee_frame",
        }
        if v not in allowed:
            raise ValueError(f"module.providesSlots.slot must be one of {sorted(allowed)}")
        return v

    @field_validator("entityType")
    @classmethod
    def validate_entity_type(cls, v: str) -> str:
        allowed = {"scene", "encounter", "location", "clock", "cast_group", "faction"}
        if v not in allowed:
            raise ValueError(f"module.providesSlots.entityType must be one of {sorted(allowed)}")
        return v

    @field_validator("entityId")
    @classmethod
    def validate_entity_id(cls, v: str) -> str:
        return _require_safe_identifier(v, label="module.providesSlots.entityId")

    @field_validator("policy")
    @classmethod
    def validate_policy(cls, v: str) -> str:
        if v not in {"exclusive", "append", "replace"}:
            raise ValueError("module.providesSlots.policy must be exclusive, append, or replace")
        return v


class RuntimeSlotBinding(BaseModel):
    slot: str
    entityType: str
    entityId: str
    providerModuleId: str

    @field_validator("slot")
    @classmethod
    def validate_slot(cls, v: str) -> str:
        allowed = {
            "opening_scene",
            "default_location",
            "starter_encounter",
            "starter_clock",
            "primary_cast",
            "fallback_referee_frame",
        }
        if v not in allowed:
            raise ValueError(f"runtime_settings.slotBindings.slot must be one of {sorted(allowed)}")
        return v

    @field_validator("entityType")
    @classmethod
    def validate_entity_type(cls, v: str) -> str:
        allowed = {"scene", "encounter", "location", "clock", "cast_group", "faction"}
        if v not in allowed:
            raise ValueError(f"runtime_settings.slotBindings.entityType must be one of {sorted(allowed)}")
        return v

    @field_validator("entityId")
    @classmethod
    def validate_entity_id(cls, v: str) -> str:
        return _require_safe_identifier(v, label="runtime_settings.slotBindings.entityId")

    @field_validator("providerModuleId")
    @classmethod
    def validate_provider_module_id(cls, v: str) -> str:
        return _require_safe_identifier(v, label="runtime_settings.slotBindings.providerModuleId")


class ModuleLibraryEntry(BaseModel):
    id: str
    name: str
    description: str = ""
    category: str = "mixed"
    tags: list[str] = Field(default_factory=list)
    lineage: str = "shared"
    branchTargets: list[str] = Field(default_factory=list)
    recommendedProfile: str = ""
    themeHints: list[str] = Field(default_factory=list)
    compatibilityNotes: str = ""
    origin: str = "workspace"
    artifactRef: Optional[str] = None
    promptStrips: list[PromptStripDefinition] = Field(default_factory=list)
    promptAssignments: list[ModulePromptAssignmentPreset] = Field(default_factory=list)
    subagentGroups: list[SubagentGroup] = Field(default_factory=list)
    starterArtifacts: list[ModuleStarterArtifactRef] = Field(default_factory=list)
    runtimeContext: list[dict[str, str]] = Field(default_factory=list)
    moduleDependencies: list[str] = Field(default_factory=list)
    moduleConflicts: list[str] = Field(default_factory=list)
    requiresSlots: list[str] = Field(default_factory=list)
    providesSlots: list[ModuleSlotProvision] = Field(default_factory=list)
    sceneSeeds: list[SceneSeed] = Field(default_factory=list)
    encounterSeeds: list[EncounterSeed] = Field(default_factory=list)
    locationSeeds: list[LocationSeed] = Field(default_factory=list)
    clockSeeds: list[ClockSeed] = Field(default_factory=list)
    factionSeeds: list[FactionSeed] = Field(default_factory=list)
    hookSeeds: list[HookSeed] = Field(default_factory=list)

    @field_validator("id", "name")
    @classmethod
    def validate_non_empty_text(cls, v: str, info) -> str:
        if not isinstance(v, str):
            raise ValueError(f"Module entry {info.field_name} must be a string")
        stripped = v.strip()
        if not stripped:
            raise ValueError(f"Module entry {info.field_name} must not be empty")
        if any(ch in stripped for ch in ("\x00", "\r", "\n")):
            raise ValueError(f"Module entry {info.field_name} contains unsupported control characters")
        return stripped

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        allowed = {"world", "rules", "persona", "party", "utility", "adventure", "mixed"}
        return v if v in allowed else "mixed"

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v: list[str]) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for raw in v or []:
            tag = str(raw).strip()
            if not tag or tag in seen:
                continue
            seen.add(tag)
            cleaned.append(tag)
        return cleaned

    @field_validator("lineage")
    @classmethod
    def validate_lineage(cls, v: str) -> str:
        return v if v in {"shared", "branch_overlay"} else "shared"

    @field_validator("branchTargets", "themeHints")
    @classmethod
    def validate_identifier_lists(cls, v: list[str], info) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for idx, raw in enumerate(v or []):
            item = str(raw).strip()
            if not item:
                continue
            item = _require_safe_identifier(item, label=f"module.{info.field_name}[{idx}]")
            if item in seen:
                continue
            seen.add(item)
            cleaned.append(item)
        return cleaned

    @field_validator("recommendedProfile")
    @classmethod
    def validate_recommended_profile(cls, v: str) -> str:
        stripped = str(v or "").strip()
        if not stripped:
            return ""
        return _require_safe_identifier(stripped, label="module.recommendedProfile")

    @field_validator("compatibilityNotes")
    @classmethod
    def validate_compatibility_notes(cls, v: str) -> str:
        if not isinstance(v, str):
            raise ValueError("module.compatibilityNotes must be a string")
        if any(ch in v for ch in ("\x00", "\r")):
            raise ValueError("module.compatibilityNotes contains unsupported control characters")
        return v

    @field_validator("origin")
    @classmethod
    def validate_origin(cls, v: str) -> str:
        return "artifact" if v == "artifact" else "workspace"

    @field_validator("moduleDependencies", "moduleConflicts")
    @classmethod
    def validate_module_refs(cls, v: list[str], info) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for idx, raw in enumerate(v or []):
            item = _require_safe_identifier(str(raw).strip(), label=f"module.{info.field_name}[{idx}]")
            if item in seen:
                continue
            seen.add(item)
            cleaned.append(item)
        return cleaned

    @field_validator("requiresSlots")
    @classmethod
    def validate_required_slots(cls, v: list[str]) -> list[str]:
        allowed = {
            "opening_scene",
            "default_location",
            "starter_encounter",
            "starter_clock",
            "primary_cast",
            "fallback_referee_frame",
        }
        cleaned: list[str] = []
        seen: set[str] = set()
        for idx, raw in enumerate(v or []):
            item = str(raw or "").strip()
            if not item:
                continue
            if item not in allowed:
                raise ValueError(f"module.requiresSlots[{idx}] must be one of {sorted(allowed)}")
            if item in seen:
                continue
            seen.add(item)
            cleaned.append(item)
        return cleaned

    @field_validator("runtimeContext")
    @classmethod
    def validate_runtime_context(cls, v: list[dict[str, str]]) -> list[dict[str, str]]:
        cleaned: list[dict[str, str]] = []
        for idx, entry in enumerate(v or []):
            if not isinstance(entry, dict):
                raise ValueError(f"module.runtimeContext[{idx}] must be an object")
            key = str(entry.get('key', '')).strip()
            if not key:
                continue
            _require_safe_identifier(key, label=f"module.runtimeContext[{idx}].key")
            value = str(entry.get('value', ''))
            cleaned.append({'key': key, 'value': value})
        return cleaned

    @model_validator(mode="after")
    def validate_structured_module_refs(self):
        if set(self.moduleDependencies).intersection(self.moduleConflicts):
            raise ValueError("moduleDependencies and moduleConflicts must not overlap")
        entity_ids = {
            "scene": {item.id for item in self.sceneSeeds},
            "encounter": {item.id for item in self.encounterSeeds},
            "location": {item.id for item in self.locationSeeds},
            "clock": {item.id for item in self.clockSeeds},
            "cast_group": {item.name for item in self.subagentGroups},
            "faction": {item.id for item in self.factionSeeds},
        }
        seen_slots: set[tuple[str, str, str]] = set()
        for provision in self.providesSlots:
            key = (provision.slot, provision.entityType, provision.entityId)
            if key in seen_slots:
                raise ValueError(f"module.providesSlots contains duplicate binding {key}")
            seen_slots.add(key)
            if provision.entityId not in entity_ids.get(provision.entityType, set()):
                raise ValueError(
                    f"module.providesSlots references missing {provision.entityType} '{provision.entityId}' in module '{self.id}'"
                )
        return self


class RuntimeSettings(BaseModel):
    recursionLimit: int = 50
    streamMode: str = "updates"
    debug: bool = False
    inheritParentBindings: bool = True
    storeBackend: str = "in_memory"
    storePath: str = "runtime_store.db"
    checkpointEnabled: bool = False
    subagentLibrary: list[SubagentGroup] = Field(default_factory=list)
    promptStripLibrary: list[PromptStripDefinition] = Field(default_factory=list)
    promptStripAssignments: list[PromptStripAssignment] = Field(default_factory=list)
    moduleLibrary: list[ModuleLibraryEntry] = Field(default_factory=list)
    loadedModuleIds: list[str] = Field(default_factory=list)
    runtimeContext: list[dict[str, str]] = Field(default_factory=list)
    shellExecutionEnabled: bool = False
    sceneSeeds: list[SceneSeed] = Field(default_factory=list)
    encounterSeeds: list[EncounterSeed] = Field(default_factory=list)
    locationSeeds: list[LocationSeed] = Field(default_factory=list)
    clockSeeds: list[ClockSeed] = Field(default_factory=list)
    factionSeeds: list[FactionSeed] = Field(default_factory=list)
    hookSeeds: list[HookSeed] = Field(default_factory=list)
    slotBindings: list[RuntimeSlotBinding] = Field(default_factory=list)

    @field_validator("recursionLimit")
    @classmethod
    def validate_recursion_limit(cls, v: int) -> int:
        if v < 1 or v > 500:
            raise ValueError("runtime_settings.recursionLimit must be between 1 and 500")
        return v

    @field_validator("streamMode")
    @classmethod
    def validate_stream_mode(cls, v: str) -> str:
        if v not in {"updates", "values", "debug"}:
            raise ValueError("runtime_settings.streamMode must be one of updates, values, debug")
        return v

    @field_validator("storeBackend")
    @classmethod
    def validate_store_backend(cls, v: str) -> str:
        if v not in {"in_memory", "sqlite_local"}:
            raise ValueError("runtime_settings.storeBackend must be one of in_memory, sqlite_local")
        return v

    @field_validator("storePath")
    @classmethod
    def validate_store_path(cls, v: str) -> str:
        if not isinstance(v, str):
            raise ValueError("runtime_settings.storePath must be a string")
        stripped = v.strip()
        if not stripped:
            raise ValueError("runtime_settings.storePath must not be empty")
        if any(ch in stripped for ch in ("\x00", "\r", "\n")):
            raise ValueError("runtime_settings.storePath contains unsupported control characters")
        return stripped

    @field_validator("loadedModuleIds")
    @classmethod
    def validate_loaded_module_ids(cls, v: list[str]) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for idx, raw in enumerate(v or []):
            module_id = _require_safe_identifier(str(raw or ""), label=f"runtime_settings.loadedModuleIds[{idx}]")
            if module_id in seen:
                continue
            seen.add(module_id)
            cleaned.append(module_id)
        return cleaned


    @field_validator("runtimeContext")
    @classmethod
    def validate_runtime_context(cls, v: list[dict[str, str]]) -> list[dict[str, str]]:
        cleaned: list[dict[str, str]] = []
        for idx, entry in enumerate(v or []):
            if not isinstance(entry, dict):
                raise ValueError(f"runtime_settings.runtimeContext[{idx}] must be an object")
            key = str(entry.get('key', '')).strip()
            if not key:
                continue
            _require_safe_identifier(key, label=f"runtime_settings.runtimeContext[{idx}].key")
            value = str(entry.get('value', ''))
            cleaned.append({'key': key, 'value': value})
        return cleaned


class UIContext(BaseModel):
    model_config = {"extra": "allow"}

    project_id: Optional[str] = None
    tab_id: Optional[str] = None
    graph_kind: Optional[str] = None
    graph_scope: Optional[str] = None
    parent_project_id: Optional[str] = None
    parent_node_id: Optional[str] = None
    scope_lineage: Optional[list[str]] = None
    supergraph_scope: Optional[str] = None
    artifact_type: Optional[str] = None
    execution_profile: Optional[str] = None
    project_mode: Optional[str] = None
    runtime_settings: Optional[RuntimeSettings] = None
    graph_bindings: Optional[list[UIBinding]] = None
    resolved_graph_bindings: Optional[list[UIBinding]] = None
    ai_node_inventory: Optional[list[dict[str, Any]]] = None

    @field_validator("artifact_type")
    @classmethod
    def validate_artifact_type(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_artifact_type(v)

    @field_validator("execution_profile")
    @classmethod
    def validate_execution_profile(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_execution_profile(v)

    @field_validator("project_mode")
    @classmethod
    def validate_project_mode(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_project_mode(v)

class GraphPayload(BaseModel):
    graph_id: str
    ui_context: Optional[UIContext] = None
    config: GraphConfig = Field(default_factory=GraphConfig)
    state_schema: list[StateField] = Field(default_factory=list)
    nodes: list[GraphNode] = Field(default_factory=list)
    tools: list[GraphTool] = Field(default_factory=list)
    edges: list[GraphEdge] = Field(default_factory=list)
    use_checkpoint: bool = False
    interrupt_before_nodes: list[str] = Field(default_factory=list)
    is_async: bool = True

    @field_validator("graph_id")
    @classmethod
    def validate_graph_id(cls, v: str) -> str:
        if not isinstance(v, str):
            raise ValueError("graph_id must be a string")
        stripped = v.strip()
        if not stripped:
            raise ValueError("graph_id must not be empty")
        if not SAFE_GRAPH_ID_RE.fullmatch(stripped):
            raise ValueError(
                "graph_id must use only letters, digits, hyphens, and underscores, and must not contain path separators"
            )
        return stripped

    @field_validator("interrupt_before_nodes")
    @classmethod
    def validate_interrupt_before_nodes(cls, v: list[str]) -> list[str]:
        return [_require_safe_identifier(node_id, label="interrupt_before_nodes entry") for node_id in v]

    @model_validator(mode="after")
    def validate_cross_references(self) -> "GraphPayload":
        node_ids = [node.id for node in self.nodes]
        tool_ids = [tool.id for tool in self.tools]

        duplicate_node_ids = sorted({node_id for node_id in node_ids if node_ids.count(node_id) > 1})
        if duplicate_node_ids:
            raise ValueError(f"Duplicate node ids are not allowed: {duplicate_node_ids}")

        duplicate_tool_ids = sorted({tool_id for tool_id in tool_ids if tool_ids.count(tool_id) > 1})
        if duplicate_tool_ids:
            raise ValueError(f"Duplicate tool ids are not allowed: {duplicate_tool_ids}")

        node_id_set = set(node_ids)
        tool_id_set = set(tool_ids)

        for node in self.nodes:
            linked_tools = node.params.tools_linked or []
            missing_tools = sorted({tool_id for tool_id in linked_tools if tool_id not in tool_id_set})
            if missing_tools:
                raise ValueError(
                    f"Node '{node.id}' references unknown tools in tools_linked: {missing_tools}"
                )

        graph_scope_marker_types = {'memory_checkpoint'}
        node_type_by_id = {node.id: node.type for node in self.nodes}

        for edge in self.edges:
            if edge.source not in node_id_set:
                raise ValueError(f"Edge source '{edge.source}' does not reference a known node")
            if edge.target is not None and edge.target not in node_id_set:
                raise ValueError(f"Edge target '{edge.target}' does not reference a known node")
            if edge.router_id is not None and edge.router_id not in node_id_set:
                raise ValueError(f"Edge router_id '{edge.router_id}' does not reference a known node")
            if node_type_by_id.get(edge.source) in graph_scope_marker_types or (edge.target is not None and node_type_by_id.get(edge.target) in graph_scope_marker_types):
                raise ValueError('[graph_scope_marker_cannot_connect] memory_checkpoint is a graph-scope marker and cannot participate in direct graph edges')

        missing_interrupts = sorted({node_id for node_id in self.interrupt_before_nodes if node_id not in node_id_set})
        if missing_interrupts:
            raise ValueError(
                f"interrupt_before_nodes contains unknown node ids: {missing_interrupts}"
            )
        return self

    @model_validator(mode="after")
    def canonicalize_compile_defaults(self) -> "GraphPayload":
        self.state_schema = _canonicalize_state_schema(self.state_schema, self.nodes)
        if self.ui_context:
            self.ui_context.artifact_type = _normalize_artifact_type(self.ui_context.artifact_type)
            self.ui_context.execution_profile = _normalize_execution_profile(self.ui_context.execution_profile)
            self.ui_context.project_mode = _normalize_project_mode(self.ui_context.project_mode)
        return self

    @model_validator(mode="after")
    def validate_mode_contracts(self) -> "GraphPayload":
        ui = self.ui_context
        artifact_type = ui.artifact_type if ui and ui.artifact_type else "graph"
        execution_profile = ui.execution_profile if ui and ui.execution_profile else ("langgraph_async" if self.is_async else "langgraph_sync")
        project_mode = infer_project_mode(artifact_type=artifact_type, execution_profile=execution_profile, project_mode=ui.project_mode if ui else None)

        if ui:
            ui.project_mode = project_mode
            ui.artifact_type = artifact_type
            ui.execution_profile = execution_profile

        if not is_mode_compile_enabled(project_mode):
            raise ValueError(f"Project mode '{project_mode}' is not compile-enabled in this build")
        if not is_mode_artifact_allowed(project_mode, artifact_type):
            raise ValueError(f"Artifact type '{artifact_type}' is not allowed in project mode '{project_mode}'")
        if not is_mode_execution_profile_allowed(project_mode, execution_profile):
            raise ValueError(f"Execution profile '{execution_profile}' is not allowed in project mode '{project_mode}'")

        for node in self.nodes:
            if not is_node_type_allowed_for_mode(project_mode, node.type):
                raise ValueError(f"Node '{node.id}' of type '{node.type}' is not allowed in project mode '{project_mode}'")

            target_subgraph = getattr(node.params, 'target_subgraph', None)
            if node.type in {"sub_agent", "deep_agent_suite"} and isinstance(target_subgraph, str) and target_subgraph.startswith("artifact:"):
                ref = target_subgraph.split(":", 1)[1]
                parts = ref.split("/", 1)
                source_kind = parts[0] if parts else ""
                source_id = parts[1] if len(parts) > 1 else ""
                source_mode = infer_project_mode(artifact_type=source_kind, execution_profile=None, project_mode=None)
                execution_kind = str(getattr(node.params, 'artifact_execution_kind', None) or '')
                bridge = find_bridge(source_mode=source_mode, target_mode=project_mode, source_kind=source_kind, integration_model=execution_kind or None)
                if bridge is None:
                    bridge = find_bridge(source_mode=source_mode, target_mode=project_mode, source_kind=source_kind)
                if bridge is None:
                    raise ValueError(f"[bridge_not_supported_for_target_mode] Wrapper reference '{target_subgraph}' is not supported from project mode '{source_mode}' into '{project_mode}'")
                support_level = bridge.get('supportLevel')
                integration_model = bridge.get('integrationModel')
                if support_level == 'direct':
                    if not source_id:
                        raise ValueError(f"[bridge_target_missing_identity] Wrapper reference '{target_subgraph}' is missing an artifact id")
                elif support_level == 'compile_capable':
                    try:
                        if integration_model == 'embedded_native' or execution_kind == 'embedded_native':
                            validate_embedded_native_reference(target_subgraph, target_mode=project_mode)
                        else:
                            validate_compile_capable_bridge_reference(target_subgraph, target_mode=project_mode)
                    except BridgeLoweringError as exc:
                        raise ValueError(str(exc)) from exc
                else:
                    raise ValueError(f"[bridge_editor_package_only] Wrapper reference '{target_subgraph}' is editor/package-only in this build and cannot compile/run yet")

        return self


class ObsidianRuntimeContextPatch(BaseModel):
    key: str
    value: str
    mergePolicy: str = "replace"

    @field_validator("key")
    @classmethod
    def validate_key(cls, v: str) -> str:
        return _require_safe_identifier(v, label="obsidian.runtimeContext.key")

    @field_validator("value")
    @classmethod
    def validate_value(cls, v: str) -> str:
        if not isinstance(v, str):
            raise ValueError("obsidian.runtimeContext.value must be a string")
        if any(ch in v for ch in ("\x00", "\r")):
            raise ValueError("obsidian.runtimeContext.value contains unsupported control characters")
        return v

    @field_validator("mergePolicy")
    @classmethod
    def validate_merge_policy(cls, v: str) -> str:
        if v not in {"error", "preserve", "replace"}:
            raise ValueError("obsidian.mergePolicy must be error, preserve, or replace")
        return v


class ObsidianScenePatch(BaseModel):
    sceneId: str
    status: Optional[str] = None
    objective: Optional[str] = None
    situation: Optional[str] = None
    mergePolicy: str = "replace"

    @field_validator("sceneId")
    @classmethod
    def validate_scene_id(cls, v: str) -> str:
        return _require_safe_identifier(v, label="obsidian.scenePatch.sceneId")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        if v not in {"seeded", "active", "resolved"}:
            raise ValueError("obsidian.scenePatch.status must be seeded, active, or resolved")
        return v

    @field_validator("mergePolicy")
    @classmethod
    def validate_merge_policy(cls, v: str) -> str:
        if v not in {"error", "preserve", "replace"}:
            raise ValueError("obsidian.scenePatch.mergePolicy must be error, preserve, or replace")
        return v


class ObsidianClockPatch(BaseModel):
    clockId: str
    status: Optional[str] = None
    progress: Optional[int] = None
    trigger: Optional[str] = None
    consequence: Optional[str] = None
    mergePolicy: str = "replace"

    @field_validator("clockId")
    @classmethod
    def validate_clock_id(cls, v: str) -> str:
        return _require_safe_identifier(v, label="obsidian.clockPatch.clockId")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        if v not in {"seeded", "active", "resolved"}:
            raise ValueError("obsidian.clockPatch.status must be seeded, active, or resolved")
        return v

    @field_validator("progress")
    @classmethod
    def validate_progress(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return None
        if v < 0:
            raise ValueError("obsidian.clockPatch.progress must be >= 0")
        return v

    @field_validator("mergePolicy")
    @classmethod
    def validate_merge_policy(cls, v: str) -> str:
        if v not in {"error", "preserve", "replace"}:
            raise ValueError("obsidian.clockPatch.mergePolicy must be error, preserve, or replace")
        return v


class ObsidianFactionPatch(BaseModel):
    factionId: str
    agenda: Optional[str] = None
    leaderName: Optional[str] = None
    resources: Optional[list[str]] = None
    mergePolicy: str = "replace"

    @field_validator("factionId")
    @classmethod
    def validate_faction_id(cls, v: str) -> str:
        return _require_safe_identifier(v, label="obsidian.factionPatch.factionId")

    @field_validator("resources")
    @classmethod
    def validate_resources(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        if v is None:
            return None
        cleaned: list[str] = []
        seen: set[str] = set()
        for raw in v:
            item = str(raw).strip()
            if not item or item in seen:
                continue
            seen.add(item)
            cleaned.append(item)
        return cleaned

    @field_validator("mergePolicy")
    @classmethod
    def validate_merge_policy(cls, v: str) -> str:
        if v not in {"error", "preserve", "replace"}:
            raise ValueError("obsidian.factionPatch.mergePolicy must be error, preserve, or replace")
        return v


class ObsidianHookPatch(BaseModel):
    hookId: str
    used: Optional[bool] = None
    hidden: Optional[bool] = None
    gmNotes: Optional[str] = None
    content: Optional[str] = None
    mergePolicy: str = "replace"

    @field_validator("hookId")
    @classmethod
    def validate_hook_id(cls, v: str) -> str:
        return _require_safe_identifier(v, label="obsidian.hookPatch.hookId")

    @field_validator("mergePolicy")
    @classmethod
    def validate_merge_policy(cls, v: str) -> str:
        if v not in {"error", "preserve", "replace"}:
            raise ValueError("obsidian.hookPatch.mergePolicy must be error, preserve, or replace")
        return v


class ObsidianRecapPayload(BaseModel):
    graphId: str
    sessionId: str = "session_current"
    recap: str = ""
    gmJournal: str = ""
    validatedDecisions: list[str] = Field(default_factory=list)
    runtimeContextUpdates: list[ObsidianRuntimeContextPatch] = Field(default_factory=list)
    scenePatches: list[ObsidianScenePatch] = Field(default_factory=list)
    clockPatches: list[ObsidianClockPatch] = Field(default_factory=list)
    factionPatches: list[ObsidianFactionPatch] = Field(default_factory=list)
    hookPatches: list[ObsidianHookPatch] = Field(default_factory=list)

    @field_validator("graphId", "sessionId")
    @classmethod
    def validate_ids(cls, v: str, info) -> str:
        return _require_safe_identifier(v, label=f"obsidianRecap.{info.field_name}")

    @field_validator("validatedDecisions")
    @classmethod
    def validate_decisions(cls, v: list[str]) -> list[str]:
        cleaned: list[str] = []
        for raw in v or []:
            item = str(raw).strip()
            if item:
                cleaned.append(item)
        return cleaned


class ObsidianRecapApplyRequest(BaseModel):
    graphPayload: GraphPayload
    recap: ObsidianRecapPayload
    failOnConflict: bool = False

    @model_validator(mode="after")
    def validate_graph_id_alignment(self):
        if self.graphPayload.graph_id != self.recap.graphId:
            raise ValueError("obsidian recap graphId must match graphPayload.graph_id")
        return self
