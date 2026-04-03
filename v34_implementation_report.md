# LangSuite v34 — per-mode backend/API tightening + first useful LangChain editor workflow

## 1. Concise execution summary

This pass made **project mode** more authoritative in the backend and API layer, made **LangChain mode** more useful as an **editor/export rail**, and added one explicit **cross-mode bridge family** without pretending the three modes have equal runtime maturity.

The stable truths were preserved:
- **LangGraph** remains the mature in-app compile/run trunk.
- **LangChain** remains **editor-only in-app**, but now has a stronger authoring/export workflow.
- **DeepAgents** remains runtime-enabled in-app, but still bounded by shared/trunk-backed infrastructure rather than being marketed as a fully independent peer runtime.

## 2. What v34 targeted

v34 targeted four things:

1. **Per-mode backend/API contracts**
2. **A first genuinely useful LangChain editor workflow**
3. **One bounded cross-mode interoperability path**
4. **Tighter DeepAgents messaging and boundary behavior**

## 3. What was inspected first

Inspected before patching:
- frontend project creation flow
- mode persistence in workspace/session/package state
- capability matrix and mode gating logic
- backend artifact/node/profile filtering
- compile and runner endpoints
- wrapper/reference handling already present in the editor
- artifact registry defaults
- current LangChain and DeepAgents workflow defaults

Main shallow spots found:
- mode truth was present, but backend/API enforcement was still too distributed
- artifact library filtering was mode-aware, but not yet bridge-aware
- LangChain starters were still too bare to feel like a real editor workflow
- wrapper references already existed, but non-subgraph references had no explicit contract semantics

## 4. Per-mode backend/API changes

### New contract layer
Added a dedicated backend helper:
- `core/mode_contracts.py`

This now centralizes:
- allowed artifact kinds per mode
- allowed execution profiles per mode
- allowed node families per mode
- compile eligibility
- runtime eligibility
- library surface expansion rules
- explicit cross-mode bridge lookup

### Capability matrix expansion
Extended `client/src/capabilityMatrix.json` with:
- `modeContracts`
- `interoperabilityBridges`

That information is now consumed by both frontend and backend.

### Backend enforcement
Updated:
- `core/schemas.py`
- `api/runner.py`
- `api/collaboration.py`
- `core/artifact_registry.py`

Concrete effects:
- compile payloads now fail clearly when artifact/profile/mode combinations are invalid
- compile payloads now fail clearly when node families do not belong to the selected mode
- editor/package-only wrapper bridges are rejected during compile/run instead of quietly pretending to work
- LangChain runtime attempts are blocked **server-side**, not just in frontend UX
- persisted workspace/session sync no longer accepts obviously invalid mode/artifact/profile combinations without normalization

## 5. LangChain workflow changes

LangChain mode now feels more like a real authoring/export lane.

### Better built-in starter
The built-in LangChain artifact starter was upgraded from a tiny shell to a real small workflow:
- user input
- react agent
- chat output

This makes the mode more useful for:
- authoring
- validation
- saving/loading
- publishing to the artifact registry

### Save/load/export identity preservation
Publishing artifacts from the editor now preserves:
- `artifactType`
- `executionProfile`
- `projectMode`

That stops LangChain artifacts from degrading into generic anonymous payloads.

### Clearer in-app messaging
The Run panel now explicitly explains that:
- LangChain mode is editor-only in-app
- it is useful for authoring, validation, saving, publishing, and bounded wrapper bridges
- it is **not** yet an in-app runtime rail

## 6. Cross-mode interoperability changes

Implemented one explicit, bounded bridge family:

### Supported bridge family
- **LangChain agent → LangGraph wrapper reference**

### Also formalized
- **LangGraph subgraph → LangGraph wrapper insertion**
- **DeepAgents artifact → LangGraph wrapper reference**

### Important truth boundary
The new LangChain and DeepAgents bridges are:
- discoverable in the advanced LangGraph library surface
- insertable as wrapper/reference nodes
- reopenable as source artifacts from the wrapper node
- **editor/package only** for now

They are **not** compile-capable bridges yet.

Unsupported transformations now fail explicitly instead of bluffing.

## 7. DeepAgents tightening changes

DeepAgents was not broadened recklessly.

What changed:
- mode contracts now constrain its artifact/profile/node surface more clearly
- distinct runtime eligibility remains explicit
- bridge behavior into LangGraph is now labeled as bounded/editor-package-only where appropriate

What did **not** change:
- no false claim of independent runtime parity
- no duplicated per-mode stack explosion

## 8. Validation performed

### Frontend build
Executed:
- `cd client && npm ci`
- `cd client && npm run build`

Result:
- build passed
- large-bundle warning remains, but is not a v34 truth regression

### Backend / regression tests
Executed:
- `python -m pip install 'langgraph>=0.2.0' 'langchain>=0.3.0' 'langchain-core>=0.3.0'`
- `pytest -q tests/test_v29_compile_truth.py tests/test_v30_runtime_validation.py tests/test_v32_platform_rails.py tests/test_v33_project_modes.py tests/test_v34_mode_contracts.py`

Result:
- **18 passed**

### Persistence / project-tree smoke
Executed:
- `python tests/backend_session_workspace_smoke.py`
- `python tests/project_tree_hidden_child_smoke.py`

Result:
- passed

### Browser smoke
Executed:
- `python tests/browser_smoke_v33.py`
- `python tests/browser_smoke_v34.py`

Result:
- passed

Notes:
- browser coverage here is still **targeted headless smoke**, not full human exploratory QA

## 9. What became more real

What is more real after v34:
- project mode behaves more like a real backend/API contract boundary
- LangChain mode is more useful as an editor/export workflow
- one explicit cross-mode bridge family now exists and is validated
- wrapper references can reopen mode-appropriate source artifacts
- unsupported bridges fail clearly

## 10. What remains bounded / deferred

Still bounded:
- LangChain has **no in-app runtime**
- LangChain → LangGraph bridge remains **editor/package-only**
- DeepAgents → LangGraph bridge remains **editor/package-only**
- no universal cross-mode translator exists
- no claim of equal maturity across all three modes

Deferred:
- first **compile-capable** cross-mode bridge
- richer package typing and artifact semantics
- deeper per-mode API decomposition where not yet justified
- fuller human manual QA of mode-specific UX

## Mode contract summary

- **LangGraph**
  - artifact kinds: `graph`, `subgraph`
  - execution profiles: `langgraph_sync`, `langgraph_async`
  - compile: yes
  - run: yes

- **LangChain**
  - artifact kinds: `agent`
  - execution profiles: `langchain_agent`
  - compile/export/package: yes
  - in-app run: no

- **DeepAgents**
  - artifact kinds: `deep_agent`
  - execution profiles: `deepagents`
  - compile: yes
  - run: yes

## Cross-mode interoperability summary

Currently explicit and validated:
- LangGraph subgraph → LangGraph wrapper insertion (**direct**)
- LangChain agent → LangGraph wrapper reference (**editor/package-only**)
- DeepAgents artifact → LangGraph wrapper reference (**editor/package-only**)

Not supported yet:
- compile/run through those non-direct bridges
- broad automatic cross-mode translation
- LangChain in-app runtime

## 11. Recommended next pass

The cleanest **v35** direction is:

### Preferred option
**Make one LangChain → LangGraph bridge compile-capable**

Why this is the best next step:
- it turns the first broader cross-mode bridge from editorial into executable value
- it advances the platform without faking runtime parity
- it keeps the mature LangGraph trunk as the execution anchor

### Safer alternative
Deepen LangChain package/export semantics further without compile-capable bridging yet.

That is safer, but less platform-moving.
