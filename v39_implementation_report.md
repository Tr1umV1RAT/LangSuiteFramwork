# LangSuite v39 — Provider-Backed Embedded Native LangChain Artifact + Event Projection Cleanup

## 1. Concise execution summary

This pass deepened the embedded-native integration tier introduced in v38 without flattening it into the lowered bridge model.

What changed:
- preserved the existing lowered contracts:
  - `langchain_agent_to_langgraph_v1`
  - `langchain_agent_to_langgraph_v2`
- preserved the provider-free embedded-native contract path:
  - `langchain_agent_embedded_v1` via `embedded_debug_agent`
- added a **bounded provider-backed embedded-native artifact path** using a built-in LangChain artifact:
  - `embedded_provider_agent`
- improved host-visible runtime observability with explicit `embedded_trace` lifecycle events
- kept LangChain editor-only as a mode and kept DeepAgents out of embedded execution

This is still not a generic multi-runtime framework. It is one bounded embedded-native provider-backed shape under LangGraph orchestration.

## 2. What v39 targeted

- one provider-backed embedded-native LangChain artifact path
- clearer host-side event / trace projection for embedded-native execution
- preservation of v35–v38 lowering and embedded-native behavior
- no regression of mode contracts or DeepAgents boundaries

## 3. What was inspected first

Primary inspection targets:
- `core/mode_contracts.py`
- `core/schemas.py`
- `core/compiler.py`
- `api/runner.py`
- `api/routes.py`
- `templates/graph.py.jinja`
- `templates/tools.py.jinja`
- `templates/nodes.py.jinja`
- artifact registry LangChain agent entries
- wrapper/reference handling in the client store
- current embedded-native metadata in `client/src/capabilityMatrix.json`, `client/src/capabilities.ts`, and `client/src/api/artifacts.ts`
- current run/debug surfaces and v38 tests/smokes

Main conclusions from inspection:
- the v38 embedded path was already the right architectural seam to extend
- the cleanest bounded provider-backed artifact form was a single `react_agent` LangChain artifact using the existing `openai` provider path already supported by generated nodes
- event projection from embedded execution back to the host UI was still too opaque; node updates alone were not enough to explain embedded lifecycle state

## 4. Provider-backed embedded contract

### Contract preserved
- `langchain_agent_embedded_v1`

### Accepted source
- source mode: `langchain`
- source artifact kind: `agent`
- source execution profile: `langchain_agent`
- host target mode: `langgraph`
- integration model / execution kind: `embedded_native`

### Bounded provider-backed shape supported in v39
- one bounded LangChain artifact authored with a single provider-backed `react_agent`
- provider family currently bounded to:
  - `openai`
- accepted model family currently bounded to:
  - `gpt-4o*`
- shared-safe tools remain bounded exactly as before:
  - `rpg_dice_roller`
  - read-only `sql_query`
- nested embedded runtime chains remain unsupported
- DeepAgents embedding remains unsupported

### New built-in artifact used to prove the path
- `embedded_provider_agent`

### Failure behavior
If provider configuration is missing, runtime now fails clearly with explicit codes/messages such as:
- `provider_config_missing`
- `provider_init_failed`

### Explicit non-goals
- no general provider-backed LangChain embedding
- no arbitrary provider/model/plugin combinations
- no public LangChain runtime console
- no embedded DeepAgents execution
- no deep host/embedded replay-resume parity claim

## 5. Backend/compiler/runtime changes

Changed files:
- `core/bridge_lowering.py`
- `core/compiler.py`
- `api/runner.py`
- `templates/nodes.py.jinja`
- `core/artifact_registry.py`
- `artifact_registry/agents/embedded_provider_agent.json`
- `client/src/capabilityMatrix.json`
- `client/src/store.ts`
- `client/src/store/types.ts`
- `client/src/components/RunPanel.tsx`
- `client/src/components/CapabilityInspectorSection.tsx`
- `client/src/components/artifacts/ArtifactLibrarySection.tsx`
- `tests/test_v39_embedded_provider.py`
- `tests/browser_smoke_v39.py`

Key runtime/compile changes:
- embedded-native validation now carries provider-facing contract metadata:
  - accepted provider families
  - accepted provider models
  - required provider environment variables
  - provider-backed status flag
- generated external artifact metadata now includes provider assumptions in `GRAPH_EXTERNAL_ARTIFACTS`
- generated nodes now use a helper-based provider initialization path:
  - `ensure_provider_configuration(...)`
  - `build_chat_model(...)`
- provider-backed runtime failures now surface clearer reason codes instead of vague downstream provider errors
- the runner now projects `embedded_trace` events for embedded-native nodes, including:
  - `started`
  - `running`
  - `completed`
  - `failed`
- embedded-native trace events include machine-readable metadata such as:
  - node id
  - execution kind
  - source artifact id/title
  - contract id
  - provider families
  - required provider env vars
  - rejection / failure reason code when available

## 6. Event / trace projection changes

New host-visible runtime projection path:
- websocket event type: `embedded_trace`

Current projected lifecycle states:
- `started`
- `running`
- `completed`
- `failed`

Current projected metadata:
- `node_id`
- `execution_kind=embedded_native`
- `integration_model=embedded_native`
- `artifact_ref`
- `artifact_id`
- `artifact_title`
- `contract_id`
- `accepted_source_shape`
- `provider_backed`
- `provider_families`
- `required_provider_env_vars`
- `reasonCode` where applicable

Boundaries:
- this is still not deep internal LangChain trace multiplexing
- it is a bounded host-side lifecycle and identity projection layer
- full deep replay/resume coordination across host + embedded layers remains unsolved

## 7. UI/API honesty changes

The UI/API still explicitly distinguishes three integration states:
1. lowered executable bridge
2. embedded native artifact execution
3. editor/package-only reference

v39 additions:
- artifact/library and inspector surfaces now expose provider assumptions for embedded-native models more clearly
- runtime logs now include `embedded_trace` entries rather than only generic node updates
- provider-config failures are clearer and more inspectable in runtime/debug surfaces

The product still does **not** imply that all LangChain artifacts are embedded-runnable.

## 8. Validation performed

### Environment prep
Executed:
- `python -m pip install 'langgraph>=0.2.0' 'langchain>=0.3.0' 'langchain-core>=0.3.0' 'langchain-community>=0.3.0'`
- `cd client && npm ci`

### Frontend build
Executed:
- `cd client && npm run build`

Result:
- passed

### Regression/API suite
Executed:
- `pytest -q tests/test_v29_compile_truth.py tests/test_v30_runtime_validation.py tests/test_v32_platform_rails.py tests/test_v33_project_modes.py tests/test_v34_mode_contracts.py tests/test_v35_executable_bridge.py tests/test_v36_tool_enabled_bridge.py tests/test_v37_bridge_diagnostics.py tests/test_v38_embedded_native.py tests/test_v39_embedded_provider.py`

Result:
- **45 passed**

### Additional smokes
Executed:
- `python tests/backend_session_workspace_smoke.py`
- `python tests/project_tree_hidden_child_smoke.py`
- `python tests/browser_smoke_v38.py`
- `python tests/browser_smoke_v39.py`

Results:
- passed

### Proof categories

#### Compile proof
- yes
- provider-backed embedded artifact compiles through the embedded-native path

#### Local runtime proof
- yes
- bounded provider-backed embedded artifact runs under orchestration using a monkeypatched fake provider model in-process
- this proves the orchestration path, host wrapper behavior, and result flow

#### Real external-provider runtime proof
- not fully validated in this environment
- reason: no guaranteed live provider credential/config available for a true remote OpenAI invocation
- instead, provider-missing behavior was validated explicitly and local provider-shaped execution was validated with a stubbed provider model

## 9. What became more real

- one bounded provider-backed LangChain artifact shape is now supported as an embedded-native node inside LangGraph orchestration
- embedded-native execution is less of a black box because the host now receives explicit embedded lifecycle traces
- provider-backed failure cases are clearer
- the original architecture direction is better represented:
  - LangChain as authoring rail
  - LangGraph as orchestration rail
  - embedded-native artifacts as a distinct integration tier

## 10. What remains bounded / deferred

Still bounded:
- LangChain remains editor-only as a mode
- embedded-native execution is not generic
- provider-backed embedding is currently bounded to OpenAI `gpt-4o*` shapes
- no executable DeepAgents embedding
- no executable nested embedded-runtime chains
- no full host/embedded replay-resume parity
- no universal adapter framework

## Embedded Native Artifact Contract Summary

- contract: `langchain_agent_embedded_v1`
- source mode: `langchain`
- source kind: `agent`
- host mode: `langgraph`
- execution kind: `embedded_native`
- provider-free path preserved: `embedded_debug_agent`
- provider-backed path added: `embedded_provider_agent`

## Provider-Backed Embedded Support Summary

Supported now:
- one bounded `react_agent`-based LangChain artifact
- provider family: `openai`
- model family: `gpt-4o*`
- runs as an embedded-native node under LangGraph orchestration
- reopens in native LangChain authoring mode

Failure handling now explicit for:
- missing provider env config
- provider init failure

## Event / Trace Projection Summary

New host-visible event channel:
- `embedded_trace`

Projected phases:
- `started`
- `running`
- `completed`
- `failed`

Projected identity and support metadata:
- node id
- artifact id/title/ref
- integration model / execution kind
- contract id
- provider requirements
- failure reason code when available

## Embedded vs Lowered Integration Summary

Lowered bridges (preserved):
- `langchain_agent_to_langgraph_v1`
- `langchain_agent_to_langgraph_v2`

Embedded-native execution (extended):
- `langchain_agent_embedded_v1`

They remain separate integration models in:
- capability metadata
- artifact API summaries
- library labels
- inspector messaging
- runtime/debug event surfaces

## Still Unsupported Embedded Shapes

- arbitrary LangChain artifacts
- arbitrary provider families/models
- executable nested embedded runtime chains
- executable DeepAgents embedding
- general embedded multi-runtime orchestration
- broad host/embedded replay-resume parity

## 11. Recommended next pass

Recommended v40 direction:

**v40 — first bounded embedded-native tool-call event projection + provider-backed success-path polish**

Why this is the clean next move:
- v39 made provider-backed embedded execution real in one bounded shape
- the next justified step is to make the embedded-native runtime more observable during successful provider-backed runs and during shared-safe tool calls
- that would deepen the embedded-native tier without broadening it into a generic runtime framework
