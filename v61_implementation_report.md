# v61 — subagent runtime ergonomics + prompt/tool hint polish + completeness audit + targeted block expansion

## Concise execution summary

I completed a combined v61 pass on top of the current v60 baseline.

This pass did four things in one bounded iteration:

1. **polished the canonical subagent runtime story**,
2. **added runtime-context support at the graph/runtime layer**,
3. **implemented two structured-output utility blocks**,
4. **produced a fresh agnostic completeness audit based on the current codebase rather than prior conversation context**.

The result is not a broad rewrite. It is a tightening pass that makes the current product more coherent and more useful without reopening already-settled node/memory/UX work.

## What v61 targeted

- keep the canonical `tool_sub_agent` model intact,
- make subagent usage hints more explicit and more useful,
- support a **real runtime context projection surface** grounded in LangGraph runtime context,
- support **post-processing and routing over structured output**,
- preserve the current LangGraph / LangChain / DeepAgents product rails,
- and produce a code-first completeness audit.

## What was inspected first

I inspected:

- `client/src/nodeConfig.ts`
- `client/src/capabilityMatrix.json`
- `client/src/components/CustomNode.tsx`
- `client/src/components/StatePanelContent.tsx`
- `client/src/store/types.ts`
- `client/src/store/workspace.ts`
- `core/schemas.py`
- `api/runner.py`
- `templates/graph.py.jinja`
- `templates/nodes.py.jinja`
- `templates/tools.py.jinja`
- v58/v59/v60 tests around the subagent model.

The two main gaps were:

1. the product still lacked any explicit **runtime context** surface even though LangGraph/LangChain runtime context is an important official abstraction,
2. structured output existed on `llm_chat` / `react_agent`, but the graph had no explicit **follow-up blocks** for extraction and routing over those structured payloads.

## Selected blocks / block surfaces implemented or refined

This pass selected five block surfaces in total:

### 1. `tool_sub_agent` (existing, refined)
- better prompt/runtime hint generation,
- clearer direct-vs-group semantics,
- stronger alignment with the official LangChain subagent-as-tool model.

### 2. `llm_chat` (existing, refined)
- clearer generated prompt hint when subagent tools are linked,
- better framing for structured output active state.

### 3. `react_agent` (existing, refined)
- same prompt/hint polish for linked subagent tools,
- better structured-output semantics in the authored/runtime story.

### 4. `runtime_context_read` (new)
- graph-native node that reads static runtime context and projects it into state.

### 5. `structured_output_extract` (new)
- graph-native node that extracts a field (or the whole payload) from structured output already placed in state/custom vars.

### 6. `structured_output_router` (new)
- graph-native conditional router based on one field of a structured payload.

(Counted as three new/expanded capability families even though five surfaces were touched.)

## Backend / compiler / runtime changes

### Runtime context support

Added project/runtime support for `runtimeContext` in runtime settings.

Changes:
- `client/src/store/types.ts`
- `client/src/store/workspace.ts`
- `core/schemas.py`
- `api/runner.py`
- `templates/graph.py.jinja`
- `templates/nodes.py.jinja`
- `client/src/components/StatePanelContent.tsx`

What changed:
- runtime settings can now carry a list of key/value runtime context entries,
- the runner now converts those entries into a `context` payload passed into graph streaming execution,
- generated graphs now declare a runtime context schema placeholder and support nodes that read runtime context,
- the new `runtime_context_read` node can emit either one named key or the whole runtime context payload.

### Structured output utility blocks

Added:
- `runtime_context_read`
- `structured_output_extract`
- `structured_output_router`

Changes:
- `client/src/nodeConfig.ts`
- `client/src/capabilityMatrix.json`
- `core/schemas.py`
- `templates/nodes.py.jinja`
- `templates/graph.py.jinja`

What changed:
- `structured_output_extract` can read from state or `custom_vars`,
- extract a named field or pass through the whole structured payload,
- emit a new graph key,
- and support a default value.
- `structured_output_router` adds a dedicated route function over a field inside a structured payload.

### Subagent prompt/tool hint polish

Changes:
- `templates/tools.py.jinja`
- `templates/nodes.py.jinja`
- `client/src/components/CustomNode.tsx`

What changed:
- generated subagent tool hints now say more clearly that subagents run ephemerally with their own configured prompt and tools,
- parent-agent prompt synthesis now adds a more explicit usage note when subagent tools are linked,
- `tool_sub_agent` surfaces now explain more clearly whether they are in direct mode or group-dispatch mode.

## UI changes

### Runtime context authoring

The State Panel runtime settings now include a small editable **Runtime context** section.

This gives the product a truthful place where users can define static runtime context values without pretending those are just ordinary graph state keys.

### New blocks visible in the editor

The node catalog now includes:
- `Runtime Context`
- `Structured Extract`
- `Structured Router`

They are reflected in capability metadata and show up with summaries and interaction notes.

### Better authored truth on subagents and structured outputs

The canvas help lines now tell the user:
- whether a `tool_sub_agent` is direct or group-dispatch,
- and whether `llm_chat` / `react_agent` currently have structured output active.

## Validation performed

Executed successfully:

- `python -m py_compile core/*.py api/*.py main.py`
- `pytest -q tests/test_v58_canonical_subagent_model.py tests/test_v59_group_subagent_runtime.py tests/test_v60_subagent_library_authoring.py tests/test_v61_subagent_runtime_and_blocks.py tests/backend_session_workspace_smoke.py tests/project_tree_hidden_child_smoke.py`
- broader regression slice:
  - `tests/test_v49_memory_ui_simplification.py`
  - `tests/test_v50_node_insertion_ux_semantics.py`
  - `tests/test_v51_detached_components_and_affordances.py`
  - `tests/test_v52_quickstart_help_ui.py`
  - `tests/test_v53_connection_gesture_refinement.py`
  - `tests/test_v54_graph_scope_marker_semantics.py`
  - `tests/test_v55_checkpoint_toggle_and_graph_scope_ui.py`
  - `tests/test_v56_canvas_guidance.py`
  - `tests/test_v57_live_connection_and_detached_actions.py`
  - `tests/test_v58_canonical_subagent_model.py`
  - `tests/test_v59_group_subagent_runtime.py`
  - `tests/test_v60_subagent_library_authoring.py`
  - `tests/test_v61_subagent_runtime_and_blocks.py`
  - `tests/backend_session_workspace_smoke.py`
  - `tests/project_tree_hidden_child_smoke.py`
- `cd client && npm ci`
- `cd client && npm run build`

Results:
- targeted v58→v61 suite: **12 passed**
- broader v49→v61 regression slice: **41 passed**
- frontend build: **passed**
- Python compile: **passed**

## Agnostic completeness audit

This pass also produced:
- `LangSuite_v61_agnostic_audit_prompt.md`
- `LangSuite_v61_agnostic_audit_report.md`

The audit was written from the current codebase state rather than from prior conversation assumptions.

## What became more real

- runtime context is now a first-class concept in the product,
- structured output no longer stops at “the model can emit it”; the graph now has explicit blocks to **extract** and **route** over it,
- subagent tool usage is easier to understand at authoring time,
- the project’s completeness story is documented again from current code reality.

## What remains bounded / deferred

Still bounded:
- no generic middleware graph surface,
- no broad runtime context schema editor beyond key/value entries,
- no generic skill-loader family yet,
- no full provider-backed embedded-native expansion beyond the bounded paths already present,
- no browser/manual long-form UX proof in this pass.

## Recommended next pass

The clean next move is:

**v62 — runtime context + structured-output UX refinement pass**

with priorities:
- improve insertion and guidance for `runtime_context_read`,
- make structured output setup in `llm_chat` / `react_agent` easier than raw JSON textarea alone,
- and decide whether a dedicated lightweight `skills/context-loader` surface is now justified.
