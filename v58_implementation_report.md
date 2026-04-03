# v58 implementation report

## Concise execution summary

I implemented a first **canonical subagent model** without reopening the broader runtime/bridge architecture.

What is now real:
- `subgraph_node` remains the graph-native child/subgraph surface,
- `sub_agent` is now reframed as an **agent artifact** / wrapper-backed advanced surface,
- `tool_sub_agent` is promoted as the **canonical subagent** surface,
- a project-level **Subagent Library** now exists in runtime settings and the State Panel,
- a subagent is now modeled as a **LangChain-style agent used as a tool**, configured in the library and referenced by block,
- subagents remain **ephemeral by default** and do not imply independent persistent memory.

I did **not**:
- introduce multiple competing subagent block types,
- re-merge subagent and subgraph,
- add persistent subagent memory by default,
- implement a general “group target” runtime dispatcher,
- or broaden DeepAgents/runtime rails in this pass.

## What v58 targeted

- give `subagent` one clean product meaning,
- separate **subgraph** from **subagent** more clearly,
- add a bounded project-level **Subagent Library**,
- make the canonical subagent block reference that library,
- and preserve save/load/compile truth through existing runtime settings export paths.

## What was inspected first

I inspected:
- `client/src/nodeConfig.ts`
- `client/src/capabilityMatrix.json`
- `client/src/components/StatePanelContent.tsx`
- `client/src/components/CapabilityInspectorSection.tsx`
- `client/src/store.ts`
- `client/src/store/artifactHydration.ts`
- `client/src/store/types.ts`
- `client/src/store/workspace.ts`
- `core/schemas.py`
- `templates/tools.py.jinja`

The key reality check was:
- the current product already had both `subgraph_node` and `sub_agent`,
- but the user-facing meaning of “subagent” was still overloaded,
- while the only truly tool-shaped surface was `tool_sub_agent`, still hidden and framed as an internal composite wrapper.

## Canonical subagent contract

### Product meaning

A **subagent** in LangSuite now means:
- a LangChain-style **agent used as a tool** by a parent agent,
- defined with a system prompt and optional tools,
- **ephemeral by default**,
- without independent persistent memory by default.

### Two-layer model

#### 1. Subagent Library (project-level definition layer)
Stored in runtime settings for the active project/tab.

Each group contains agents with:
- `name`
- `systemPrompt`
- `tools`
- `description`

#### 2. Canonical `tool_sub_agent` block (usage layer)
The canvas block references one library entry through:
- `target_group`
- `target_agent`
- plus bounded execution params such as:
  - `max_invocations`
  - `allow_repeat`
  - provider/model settings for the wrapper execution path

### Important scope decision

Groups are currently **organizational + scoping**.
The runtime path in this pass references **one named agent inside one group**.
That is intentional: it keeps the model simple and canonical, while still allowing “groups of 1” and future bounded expansion.

## Library / block model changes

### Changed UI/product semantics

- `sub_agent`
  - relabeled as **Agent Artifact**
  - remains the advanced wrapper/artifact reference surface
  - no longer claims to be the canonical subagent model

- `tool_sub_agent`
  - relabeled as **Subagent**
  - promoted out of hidden/internal framing
  - now represents the canonical **agent-as-tool** concept

### Subagent Library UI

Added to the State Panel:
- create / name group
- add / name subagent
- edit description
- edit system prompt
- edit tools list
- delete subagent / delete group

This is the project-level definition surface.

### Persistence path

`runtimeSettings` now carries:
- `subagentLibrary`

This means the library survives through the existing project/tab persistence path and compile export path, instead of becoming detached UI-only state.

## Persistence / reopen / compile-run changes

### Frontend persistence

Added to runtime settings typing + sanitization:
- `subagentLibrary`
- group / agent sanitization
- tool list sanitization

### Compile/export path

`tool_sub_agent` export now includes:
- `target_group`
- `target_agent`
- `max_invocations`
- `allow_repeat`
- provider/model settings
- legacy `target_subgraph` fallback retained for compatibility

### Artifact hydration

Hydration now restores the canonical subagent block params:
- `target_group`
- `target_agent`
- invocation settings
- provider/model settings

### Runtime code generation

`templates/tools.py.jinja` now emits:
- `SUBAGENT_LIBRARY`
- `_find_subagent_entry(...)`
- `_resolve_subagent_tools(...)`

For `sub_agent_tool`:
- if `target_agent` is present, the tool resolves the subagent from the project library,
- builds a bounded LangChain agent-like invocation using the configured provider/model,
- binds only the tools listed on the subagent entry,
- and runs it as an **ephemeral subagent invocation**.

Legacy fallback to `target_subgraph` remains if present.

## UI truth changes

### Node catalog

- `sub_agent` now says “Agent Artifact” instead of “Subagent”
- `tool_sub_agent` now says “Subagent”

### Capability matrix

- `tool_sub_agent` now explicitly describes the canonical subagent semantics
- `sub_agent` now explicitly describes the saved/wrapped **agent artifact** semantics

### Capability Inspector

Added a clearer explanation for `tool_sub_agent`:
- configured in **Subagent Library**
- used as an agent-as-tool
- ephemeral by default

And tightened the `sub_agent` explanation so it points users away from confusing it with the canonical subagent model.

## Validation performed

Executed successfully:
- `python -m py_compile core/*.py api/*.py main.py`
- `pytest -q tests/test_v58_canonical_subagent_model.py tests/backend_session_workspace_smoke.py tests/project_tree_hidden_child_smoke.py`
- `cd client && npm ci`
- `cd client && npm run build`

Results:
- Python compile: passed
- targeted regression/API suite: **2 passed**
- frontend build: passed

Notes:
- the targeted pytest subset includes the new v58 test and the two existing smoke scripts requested in the command; only the actual pytest tests are counted in the final “passed” count.
- no fresh browser/manual smoke is claimed in this pass.

## What became more real

- the product now has one **canonical** meaning for subagents,
- subgraph and subagent are more clearly separated,
- the project now has a real **Subagent Library**,
- the canonical subagent block now references library definitions instead of pretending to be a generic catch-all,
- persistence and compile export paths now carry the subagent library and canonical block parameters.

## What remains bounded / deferred

Still bounded:
- group targeting is still organizational/scoping; runtime references one named agent entry,
- no persistent independent subagent memory by default,
- no broad multi-agent orchestration framework,
- no generalized subagent group dispatcher,
- no fresh browser/manual UX proof for the library UI.

## Recommended next pass

**v59 — subagent insertion UX + library-aware block authoring pass**

Best next move:
- make subagent insertion more guided from the canvas/palette,
- add a library-aware picker instead of requiring text entry for `group + agent` in the block fields,
- optionally surface “create from library” / “open library” affordances directly from the subagent block.

That would deepen usability without changing the canonical runtime model again.
