# LangSuite v37 — second shared-safe tool family + richer bridge diagnostics

## 1. Concise execution summary

v37 extends the stronger v36 baseline without reopening settled v34–v36 contract work.

This pass keeps these truths intact:
- `langchain_agent_to_langgraph_v1` still works.
- `langchain_agent_to_langgraph_v2` still works for `rpg_dice_roller`.
- LangChain remains editor-only in-app.
- DeepAgents remains bounded and editor/package-only for LangGraph bridging.
- Nested bridge chains remain unsupported.

What v37 adds:
- one second shared-safe executable tool family for the `v2` bridge: **read-only `sql_query`**,
- richer bridge metadata in API/library/inspector surfaces,
- explicit rejection reason codes for unsupported bridge shapes,
- preserved tool-bearing artifact reopening with tool-node/tool-edge rehydration.

## 2. What v37 targeted

- inspect the current v36 bridge contract and `rpg_dice_roller` path,
- add one second shared-safe tool family,
- keep the bridge bounded and explicit,
- improve bridge diagnostics across compile/API/UI surfaces,
- regression-protect the richer bridge.

## 3. What was inspected first

Inspected first:
- `core/bridge_lowering.py`
- `core/mode_contracts.py`
- `core/schemas.py`
- `core/compiler.py`
- `templates/tools.py.jinja`
- `client/src/capabilityMatrix.json`
- `client/src/capabilities.ts`
- `client/src/components/artifacts/ArtifactLibrarySection.tsx`
- `client/src/components/CapabilityInspectorSection.tsx`
- `client/src/components/Toolbar.tsx`
- `artifact_registry/agents/dice_agent.json`
- `tests/test_v36_tool_enabled_bridge.py`
- `tests/browser_smoke_v36.py`

Main findings:
- the v36 lowering path was already the right extension point,
- tool-bearing artifact reopening was already fixed generically,
- diagnostics were still too stringly/vague,
- the next safe extension was not “more tools in general,” but one more **serializable, bounded, local** tool family.

## 4. Expanded executable bridge contract

### Current executable contracts

#### `langchain_agent_to_langgraph_v1`
- source kind: `agent`
- source mode: `langchain`
- no tools
- no nested artifact wrappers
- `react_agent` lowers to `llm_chat`
- other nodes must already be LangGraph-allowed shared nodes

#### `langchain_agent_to_langgraph_v2`
- source kind: `agent`
- source mode: `langchain`
- tool-enabled variants allowed only when:
  - tools are from exactly **one** shared-safe tool family,
  - tool-linked nodes are `react_agent`,
  - linked tools exist in the artifact tool list,
  - nested artifact wrapper chains are absent.

### New in v37

`v2` now allows two shared-safe tool families:
- `rpg_dice_roller`
- `sql_query` **in read-only executable-bridge form**

### v37 SQL bridge rules

Allowed shape:
- LangChain `agent`
- one or more `sql_query` tools only
- each SQL tool must declare `params.db_path`
- bridge lowering forces read-only guard metadata (`bridge_read_only=true`)
- `react_agent` may link to those tools via `tools_linked`

Explicit non-goals:
- arbitrary custom tools
- mixed tool families in one executable artifact
- unrestricted SQL mutation bridge execution
- generic LangChain lowering
- executable DeepAgents lowering
- nested executable bridge chains

## 5. Backend/compiler changes

Changed files:
- `core/bridge_lowering.py`
- `core/schemas.py`
- `api/routes.py`
- `core/artifact_registry.py`
- `templates/tools.py.jinja`
- `client/src/capabilityMatrix.json`
- `client/src/capabilities.ts`
- `client/src/api/artifacts.ts`
- `client/src/components/artifacts/ArtifactLibrarySection.tsx`
- `client/src/components/CapabilityInspectorSection.tsx`
- `client/src/components/Toolbar.tsx`
- `artifact_registry/agents/sql_lookup_agent.json`
- `tests/test_v37_bridge_diagnostics.py`
- `tests/browser_smoke_v37.py`

Concrete backend/compiler changes:
- `BridgeLoweringError` now carries explicit reason codes.
- `sql_query` is allowed in executable bridge form only as a read-only local SQL family.
- mixed tool families are rejected.
- unsupported tool carriers are rejected.
- nested bridge chains still reject explicitly.
- compile validation surfaces reason-coded messages back through `/compile`.
- generated SQL bridge tools now enforce read-only query prefixes (`SELECT` / `WITH` / `PRAGMA`) and reject multiple statements.

## 6. Diagnostics / UI/API honesty changes

Artifact/API metadata now includes machine-readable bridge details such as:
- `bridgeAllowedToolFamilies`
- `bridgeAcceptedSourceShape`
- `bridgeRejectedReasonCodes`
- `bridgeConstraintSummary`

UI improvements:
- artifact library cards show allowed shared tools, accepted shape, and rejection-code summaries,
- capability inspector shows bridge contracts, accepted shape, allowed tool families, and common rejection codes for wrapper references,
- compile notice details now surface reason codes instead of hiding them inside plain text.

Representative rejection codes now exposed:
- `unsupported_tool_family`
- `mixed_tool_families_not_supported`
- `sql_query_requires_local_db_path`
- `unsupported_tool_carrier_node_type`
- `nested_bridge_chain_not_supported`
- `unsupported_node_type_for_executable_bridge`
- `executable_bridge_requires_react_agent_tool_link`
- `bridge_editor_package_only`

## 7. Validation performed

Executed successfully:

```bash
python -m pip install 'langgraph>=0.2.0' 'langchain>=0.3.0' 'langchain-core>=0.3.0' 'langchain-community>=0.3.0'
cd client && npm ci
cd client && npm run build
pytest -q tests/test_v29_compile_truth.py tests/test_v30_runtime_validation.py tests/test_v32_platform_rails.py tests/test_v33_project_modes.py tests/test_v34_mode_contracts.py tests/test_v35_executable_bridge.py tests/test_v36_tool_enabled_bridge.py tests/test_v37_bridge_diagnostics.py
python tests/backend_session_workspace_smoke.py
python tests/project_tree_hidden_child_smoke.py
python tests/browser_smoke_v36.py
python tests/browser_smoke_v37.py
```

Results:
- runtime dependencies present and usable,
- frontend build passed,
- regression/API suite: **34 passed**,
- persistence/session smoke passed,
- project-tree/hidden-child smoke passed,
- v36 browser smoke passed,
- v37 browser smoke passed.

What was not newly provider-proven:
- there is still no provider-independent live LLM tool-call proof for the tool-enabled bridge.
- this pass proves compile-capable lowering and browser/editor integrity, not provider-free autonomous tool use.

## 8. What became more real

- `v2` is slightly richer and still bounded.
- A second shared-safe tool family is executable through the bridge.
- Bridge constraints are much easier to inspect in UI/API surfaces.
- Unsupported shapes fail with more concrete reasons.
- Tool-bearing reopening still works for both dice and SQL tool-bearing artifacts.

## 9. What remains bounded / deferred

Still bounded:
- LangChain remains editor-only in-app.
- DeepAgents → LangGraph remains editor/package-only.
- No executable subagent-aware bridge form yet.
- No mixed executable tool-family bridge.
- No arbitrary custom tool lowering.
- No nested executable bridge chains.
- No provider-independent live runtime proof for tool-enabled bridge execution.

## 10. Recommended next pass

**v38 — first bounded subagent-aware/shared-worker bridge OR diagnostics-first bridge console polish**

The safer next step is diagnostics/UX polish around bridge explainability.
The more platform-moving next step is one truthful bounded subagent-like form, but only if it maps cleanly into the LangGraph trunk without recursive nonsense.
