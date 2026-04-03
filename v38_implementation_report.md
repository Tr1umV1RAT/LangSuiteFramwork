# LangSuite v38 — embedded native LangChain artifact nodes

## 1. Concise execution summary

v38 introduces the first **embedded native LangChain artifact node** inside LangGraph orchestration while preserving the existing v35–v37 **lowered bridge** path.

The new bounded contract is **`langchain_agent_embedded_v1`**.

What is now real:
- existing lowered bridges remain intact,
- one bounded LangChain `agent` artifact can now execute inside a LangGraph graph as an **embedded native artifact node**,
- embedded-native execution and lowered execution are explicitly distinguished in backend metadata, artifact API summaries, the artifact library, and the capability inspector,
- source artifact identity and reopen flow remain intact,
- a provider-free embedded runtime proof now exists via the built-in `embedded_debug_agent` artifact.

What did **not** happen:
- no deletion of v35–v37 lowering bridges,
- no LangChain in-app runtime console,
- no DeepAgents embedded execution,
- no universal adapter framework,
- no executable nested bridge chains.

## 2. What v38 targeted

- keep v35–v37 lowering bridges as a secondary integration path,
- add a first bounded **embedded-native** LangChain integration tier,
- preserve LangChain as an **authoring rail** and LangGraph as the visible orchestration rail,
- make the UI/API explain the distinction between:
  - lowered execution,
  - embedded native execution,
  - and editor/package-only references.

## 3. What was inspected first

Primary inspection targets:
- `core/bridge_lowering.py`
- `core/mode_contracts.py`
- `core/schemas.py`
- `core/compiler.py`
- `api/runner.py`
- `api/routes.py`
- `templates/graph.py.jinja`
- `templates/tools.py.jinja`
- artifact registry entries for LangChain agents
- wrapper/reference handling in `client/src/store.ts`
- artifact reopen flow
- `client/src/capabilityMatrix.json`
- v35–v37 tests and browser smokes

The key practical conclusion was:
- the existing wrapper-backed `sub_agent` execution path already provided the cleanest host seam,
- so the narrowest coherent pivot was **not** a new runtime shell,
- but a new external artifact graph collection path that keeps the LangChain artifact **native-authored** instead of lowering it.

## 4. Embedded native artifact contract

### Contract ID
- `langchain_agent_embedded_v1`

### Accepted source
- source mode: `langchain`
- source artifact kind: `agent`
- source execution profile: `langchain_agent`
- target host mode: `langgraph`
- integration model: `embedded_native`

### Accepted bounded source shape
A single bounded LangChain agent artifact that remains in native authored form and uses only the currently accepted embedded-native node/tool surface.

Allowed node surface in v38:
- `react_agent`
- `llm_chat`
- `user_input_node`
- `chat_output`
- `debug_print`
- `static_text`
- `logic_router`
- `human_interrupt`
- `parallel_aggregator`
- `context_trimmer`
- `data_container`
- `update_state_node`

Allowed shared-safe tool families in embedded-native form:
- `rpg_dice_roller`
- read-only `sql_query`

Tool constraints remain bounded:
- at most one shared-safe tool family per artifact,
- tool links must be carried by `react_agent`,
- nested artifact-wrapper chains remain unsupported.

### Execution semantics
- the artifact is compiled as an **external native-authored graph component**,
- it is inserted into the LangGraph host through a wrapper/reference node with `artifact_execution_kind = embedded_native`,
- the wrapper executes the embedded graph through the existing LangGraph orchestration trunk,
- the artifact keeps its source identity and can still be reopened in LangChain authoring mode.

### Non-goals
- no arbitrary LangChain artifact support,
- no recursive embedded runtime chains,
- no DeepAgents embedded execution,
- no generic multi-runtime framework,
- no claim of full persistence/replay parity across host + embedded layers.

## 5. Backend/compiler/runtime changes

Changed files:
- `core/bridge_lowering.py`
- `core/mode_contracts.py`
- `core/schemas.py`
- `core/compiler.py`
- `templates/graph.py.jinja`
- `core/artifact_registry.py`
- `client/src/capabilityMatrix.json`
- `client/src/capabilities.ts`
- `client/src/api/artifacts.ts`
- `client/src/store.ts`
- `client/src/components/artifacts/ArtifactLibrarySection.tsx`
- `client/src/components/CapabilityInspectorSection.tsx`
- `tests/test_v38_embedded_native.py`
- `tests/browser_smoke_v38.py`

### Core backend/runtime changes
- Added **`langchain_agent_embedded_v1`** in `core/bridge_lowering.py`.
- Added `validate_embedded_native_reference(...)`.
- Added `embed_langchain_agent_reference(...)` which preserves native-authored node types instead of lowering `react_agent` to `llm_chat`.
- Refactored compiler external artifact collection from a lowering-only path to an **external artifact graph** path that supports:
  - lowered bridge graphs,
  - embedded-native graphs.
- Added `artifact_execution_kind` handling in schema validation and wrapper node payloads.
- Preserved existing lowered contracts and compile-capable validation logic.
- Added `GRAPH_EXTERNAL_ARTIFACTS` metadata to generated `graph.py`.

### New provider-free built-in artifact
- Added built-in `embedded_debug_agent`:
  - LangChain-mode `agent`
  - provider-free
  - used to prove embedded-native compile+run without external model credentials.

## 6. UI/API honesty changes

### Artifact/API metadata
Artifact summaries for cross-mode items now expose both integration models instead of collapsing everything into one bridge story.

Added machine-readable fields such as:
- `bridgeModels`
- `bridgeIntegrationModel`
- `bridgeExecutionKind`

Each model carries its own:
- integration model,
- support level,
- contract IDs,
- accepted source shape,
- allowed tool families,
- rejection reason codes.

### Artifact library changes
The artifact library now distinguishes between:
- **Insert embedded**
- **Insert lowered**
- generic wrapper insertion for items without multiple executable models.

### Capability inspector changes
The inspector now shows:
- current wrapper node execution kind,
- all bridge/integration models available for the referenced artifact,
- contract IDs,
- accepted shape,
- allowed shared tools,
- common rejection codes.

## 7. Validation performed

### Environment / dependencies
Executed:
- `python -m pip install 'langgraph>=0.2.0' 'langchain>=0.3.0' 'langchain-core>=0.3.0' 'langchain-community>=0.3.0'`
- `cd client && npm ci`
- `cd client && npm run build`

### Regression/API suite
Executed:
- `pytest -q tests/test_v29_compile_truth.py tests/test_v30_runtime_validation.py tests/test_v32_platform_rails.py tests/test_v33_project_modes.py tests/test_v34_mode_contracts.py tests/test_v35_executable_bridge.py tests/test_v36_tool_enabled_bridge.py tests/test_v37_bridge_diagnostics.py tests/test_v38_embedded_native.py`

Result:
- **39 passed**

### Additional smokes
Executed:
- `python tests/backend_session_workspace_smoke.py`
- `python tests/project_tree_hidden_child_smoke.py`
- `python tests/browser_smoke_v36.py`
- `python tests/browser_smoke_v38.py`

Results:
- persistence/session smoke: passed
- project-tree/hidden-child smoke: passed
- prior v36 browser smoke: passed
- new v38 browser smoke: passed

### What was runtime-proven in v38
Runtime-proven:
- one embedded-native LangChain artifact path (`embedded_debug_agent`) compiles and runs through the LangGraph orchestration trunk,
- wrapper insert → compile → websocket run → reopen works for that bounded path.

### What remains not fully solved
Not fully solved yet:
- deep persistence / resume synchronization between host graph state and embedded-native artifact internals,
- generic embedded provider-backed agent execution guarantees beyond the bounded accepted shapes already validated,
- embedded DeepAgents.

## 8. What became more real

- LangChain authoring artifacts are no longer forced to integrate **only** through lowering.
- There are now **two explicit integration models**:
  1. lowered bridge execution,
  2. embedded native artifact execution.
- One bounded embedded-native LangChain artifact form now really compiles and runs.
- The product is closer to the original architecture:
  - LangChain for authoring,
  - LangGraph for orchestration,
  - reusable artifact insertion as first-class integration.

## 9. What remains bounded / deferred

Still bounded:
- LangChain remains editor-only as a mode.
- Embedded-native execution supports only one bounded source contract.
- Lowered and embedded-native execution are still wrapper-backed reference integrations, not generic foreign-runtime composition.
- DeepAgents remains outside executable embedding in this pass.
- Nested executable bridge chains remain unsupported.
- Full embedded runtime state replay/resume semantics are not claimed.

## 10. Recommended next pass

**v39 — first bounded provider-backed embedded native LangChain artifact + event projection cleanup**

The clean next step is:
- keep the new embedded-native tier,
- prove one bounded provider-backed LangChain artifact shape under the embedded-native contract,
- and improve trace/event projection so embedded-native runs are easier to inspect from the LangGraph host UI.
