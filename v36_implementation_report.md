# LangSuite v36 — first tool-enabled / subagent-aware compile-capable LangChain → LangGraph bridge

## 1. Concise execution summary

v36 extends the stronger v35 baseline without regressing it.

This pass preserved:
- the existing executable `langchain_agent_to_langgraph_v1` bridge,
- server-side LangChain in-app run rejection,
- mode contracts and bridge metadata,
- wrapper/source-artifact reopening,
- DeepAgents remaining bounded/editor-package-only toward LangGraph.

And it added one bounded richer bridge shape:
- a **tool-enabled LangChain agent artifact** using a **small shared-safe tool whitelist**,
- lowered into the LangGraph trunk through a new explicit contract,
- while keeping unsupported tool families and nested bridge chains clearly rejected.

## 2. What v36 targeted

- inspect the v35 executable bridge and find the narrowest safe extension point,
- define a bounded `v2` executable bridge contract,
- support one shared-safe tool family,
- keep subagent-like support explicit and bounded rather than pretending it exists,
- improve UI/API honesty for executable vs editor/package-only bridges,
- regression-protect the richer bridge.

## 3. What was inspected first

Inspected first:
- `core/bridge_lowering.py`
- `core/mode_contracts.py`
- `core/schemas.py`
- `core/compiler.py`
- `templates/graph.py.jinja`
- `templates/tools.py.jinja`
- `client/src/capabilityMatrix.json`
- `core/artifact_registry.py`
- `client/src/store.ts`
- `client/src/components/artifacts/ArtifactLibrarySection.tsx`
- `tests/test_v35_executable_bridge.py`
- `tests/browser_smoke_v35.py`

Key realities found:
- v35 already had one real executable bridge (`v1`) but rejected any tool-bearing LangChain artifact.
- the compiler only lowered nodes/edges for external bridge graphs, not bridge-owned tools.
- saved artifact reopening did not rehydrate tool nodes back into the editor, which made tool-bearing authoring flows weaker than they should be.
- there was no bounded subagent-like bridge form already honest enough to enable in this pass without inventing new semantics.

## 4. v2 executable bridge contract

### Contract IDs
- `langchain_agent_to_langgraph_v1` — preserved from v35
- `langchain_agent_to_langgraph_v2` — new in v36

### v1 (preserved)
Accepted source shape:
- LangChain `agent` artifact
- no custom tools
- no nested artifact wrapper references
- `react_agent` nodes lower to `llm_chat`
- all other node shapes must already be LangGraph-allowed shared node types

### v2 (new)
Accepted source shape:
- LangChain `agent` artifact
- same base constraints as v1
- plus a **non-empty artifact tool list** where every tool belongs to the shared-safe whitelist
- at least one `react_agent` node linked to those shared-safe tools
- only `react_agent` may carry `tools_linked` in the executable bridge form

### Allowed shared tools in v2
- `rpg_dice_roller`

### Allowed shared subagent-like forms in v2
- none

This pass is **subagent-aware** in the sense that it explicitly checked for a safe bounded form and kept nested artifact wrapper chains rejected rather than quietly widening them.

### Target representation
The accepted LangChain artifact is lowered into:
- a wrapper-backed LangGraph subgraph entry in the generated `graphs` map,
- with lowered node ids and prefixed tool ids,
- preserving source artifact identity and bridge metadata.

### Explicit non-goals
- no arbitrary LangChain lowering
- no arbitrary custom tools
- no unrestricted Python/HTTP/filesystem tools
- no recursive or nested bridge-chain execution
- no LangChain in-app runtime rail
- no DeepAgents widening in this pass

## 5. Backend/compiler changes

### New / updated files
- `core/bridge_lowering.py`
- `core/compiler.py`
- `core/artifact_registry.py`
- `client/src/capabilityMatrix.json`
- `artifact_registry/agents/dice_agent.json`

### Main backend changes

#### `core/bridge_lowering.py`
- preserved `langchain_agent_to_langgraph_v1`
- added `langchain_agent_to_langgraph_v2`
- added explicit shared-safe tool whitelist validation
- added tool-aware bridge validation rules
- kept nested artifact wrapper chains rejected
- prefixed lowered tool ids to avoid collisions
- preserved source artifact metadata in lowered nodes

#### `core/compiler.py`
- external bridge graphs now carry bridge-owned tools in addition to nodes/edges
- compile context now merges payload tools + external bridge tools
- compile-time tool-node insertion logic now works for executable bridge graphs that bring their own shared-safe tools

#### `core/artifact_registry.py`
- artifact listing now exposes richer bridge metadata:
  - `bridgeContractIds`
  - `bridgeConstraints`

## 6. UI/API honesty changes

### Updated frontend/API files
- `client/src/api/artifacts.ts`
- `client/src/capabilities.ts`
- `client/src/components/artifacts/ArtifactLibrarySection.tsx`
- `client/src/components/CapabilityInspectorSection.tsx`
- `client/src/store.ts`
- `client/src/store/artifactHydration.ts`

### What changed
- bridge support levels now explicitly include `compile_capable` in the typed frontend contract
- artifact library cards can display bounded bridge constraints instead of vague “supported” vibes
- wrapper validation messaging now distinguishes:
  - direct bridge
  - compile-capable bridge with constraints
  - editor/package-only bridge
- capability inspector wrapper messaging now explains compile-capable vs editor/package-only status more clearly

### Tool-bearing artifact reopening fix
A real editor/workflow defect was fixed:
- saved artifacts that carry `artifact.tools` can now rehydrate those tools back into editor nodes and tool edges on reopen
- this matters directly for LangChain tool-bearing authoring workflows

## 7. Validation performed

### Dependency state
Executed:
- `python -m pip install 'langgraph>=0.2.0' 'langchain>=0.3.0' 'langchain-core>=0.3.0'`

Result:
- dependencies already present in this environment (`Requirement already satisfied`)

### Frontend build
Executed:
- `cd client && npm ci`
- `cd client && npm run build`

Result:
- build passed
- bundle-size warning remains, but it is unchanged and not a v36 regression

### Regression / API suite
Executed:
- `pytest -q tests/test_v29_compile_truth.py tests/test_v30_runtime_validation.py tests/test_v32_platform_rails.py tests/test_v33_project_modes.py tests/test_v34_mode_contracts.py tests/test_v35_executable_bridge.py tests/test_v36_tool_enabled_bridge.py`

Result:
- **27 passed**

### Persistence / structure smoke
Executed:
- `python tests/backend_session_workspace_smoke.py`
- `python tests/project_tree_hidden_child_smoke.py`

Result:
- passed

### Browser smoke
Executed:
- `python tests/browser_smoke_v35.py`
- `python tests/browser_smoke_v36.py`

Result:
- passed

### What was explicitly validated in v36
- v1 bridge still compiles
- v2 tool-enabled bridge is listed as compile-capable
- v2 tool-enabled bridge compiles into generated Python with lowered shared-safe tools
- unsupported tool families are rejected clearly
- nested bridge chains remain rejected
- wrapper insertion + compile works in browser for the new v2 artifact
- reopening the source LangChain artifact preserves source mode identity
- reopening the source LangChain artifact now rehydrates the dice tool node and tool edge in the editor

### What was not fully runtime-validated
The new **tool-enabled** bridge was compile-validated but not given a provider-free live execution proof.

Reason:
- the current bounded tool-enabled bridge still relies on an LLM node (`react_agent` lowered to `llm_chat`) to emit tool calls,
- and this environment does not provide a safe provider-free LLM stub path already built into the product trunk for that exact flow.

This is why v36 proves:
- compile-capable bridge semantics,
- generated artifact validity,
- browser/UI flow,

but not a live provider-independent tool-call run.

The existing v35 regression path still proves one narrow runtime-executable bridge shape through the LangGraph trunk.

## 8. What became more real

- the v35 bridge model now has a second explicit executable contract (`v2`)
- one bounded shared-safe tool family is now compile-capable through the LangGraph trunk
- bridge metadata is richer and clearer in API/UI surfaces
- tool-bearing LangChain artifacts are now more truthful and useful as authoring artifacts because reopening no longer drops their tool nodes on the floor
- unsupported tool-bearing shapes fail clearly instead of being ambiguously “advanced”

## 9. What remains bounded / deferred

Still bounded:
- LangChain remains editor-only in-app
- `langchain_agent_to_langgraph_v2` only supports a tiny shared-safe tool subset
- only `rpg_dice_roller` is allowed in executable v2 tool-bearing bridges
- no executable shared subagent-like bridge form was added
- nested artifact wrapper chains remain unsupported
- DeepAgents → LangGraph remains editor/package-only

Still deferred:
- a provider-independent runtime proof for tool-enabled bridges
- a second safe shared tool family
- a truthful bounded subagent-like executable bridge form
- deeper bridge diagnostics in the inspector / run panel

## 10. Recommended next pass

**Recommended v37 direction:**

### safest option
- add **one more shared-safe tool family** or improve bridge diagnostics/failure messaging

### more platform-moving option
- implement **one bounded executable shared subagent-like bridge form** only if a truly honest target representation can be identified first

Given the current codebase, the safest and most evidence-friendly next step is:
- **v37 — second shared-safe tool family + richer bridge diagnostics**

---

## Executable Bridge Contract Summary

### v1
- contract: `langchain_agent_to_langgraph_v1`
- source: LangChain `agent`
- tools: none
- nested artifact wrappers: rejected
- lowered path: yes
- compile-capable: yes

### v2
- contract: `langchain_agent_to_langgraph_v2`
- source: LangChain `agent`
- tools: shared-safe whitelist only
- current allowed tool families: `rpg_dice_roller`
- shared subagent-like forms: none
- nested artifact wrappers: rejected
- lowered path: yes
- compile-capable: yes

## Allowed Shared Tools / Allowed Shared Subagent Forms

### Allowed shared tools
- `rpg_dice_roller`

### Allowed shared subagent forms
- none in v36

## Still Unsupported Bridge Shapes

- arbitrary custom tools
- unrestricted Python tools in executable bridge form
- unrestricted HTTP/filesystem tools in executable bridge form
- credential-heavy external tools in executable bridge form
- nested artifact-wrapper bridge chains
- general LangChain workflow lowering
- DeepAgents executable lowering into LangGraph
