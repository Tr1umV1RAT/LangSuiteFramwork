## Concise execution summary

I treated this pass as a focused **graph-scope / detached surface guidance pass** rather than a broad UX rewrite.

Main outcome:
- `memory_checkpoint` is now supported as a **graph-scope setting** through runtime settings (`checkpointEnabled`) instead of only as a detached marker node,
- the quick-start UI no longer pushes checkpointing as a canvas block,
- the state panel now explains checkpointing more honestly,
- and legacy detached `memory_checkpoint` markers are still supported without being treated as ordinary step nodes.

## What changed

### Runtime settings
Added:
- `checkpointEnabled: boolean`

Touched files:
- `client/src/store/types.ts`
- `client/src/store/workspace.ts`
- `core/schemas.py`
- `client/src/store.ts`

Behavior:
- users can now enable checkpointing as a graph/runtime setting,
- compile export now enables checkpointing when either:
  - `runtimeSettings.checkpointEnabled` is true,
  - a legacy `memory_checkpoint` marker exists,
  - a user-input async flow requires checkpointing,
  - or interrupt nodes require it.

### UI guidance
Touched files:
- `client/src/App.tsx`
- `client/src/components/BlocksPanelContent.tsx`
- `client/src/components/StatePanelContent.tsx`

Behavior:
- quick-start no longer suggests dropping `memory_checkpoint` as a starter block,
- `chat_output` now occupies that slot instead,
- the state panel exposes a graph-scope checkbox:
  - **Checkpointing du graphe**
- the panel explains that checkpointing is a compile/runtime graph-scope concern,
  not a literal step-local node.
- if legacy `memory_checkpoint` markers still exist on the canvas, the panel tells the user so explicitly.

## Why this is the minimal coherent fix

The official LangGraph persistence model attaches checkpointing to the graph when it is compiled with a checkpointer, then saves a checkpoint at each super-step of execution. That makes a graph-scope switch a more truthful default UX than pretending checkpointing is normally a flow step block.

At the same time, existing projects that already use detached `memory_checkpoint` markers remain supported.

## Validation performed

Executed successfully:
- `python -m py_compile core/*.py api/*.py main.py`
- `pytest -q tests/test_v55_checkpoint_toggle_and_graph_scope_ui.py tests/test_v54_graph_scope_marker_semantics.py tests/backend_session_workspace_smoke.py tests/project_tree_hidden_child_smoke.py`
- `cd client && npm ci`
- `cd client && npm run build`

Results:
- targeted Python compile check passed
- targeted regression suite: **8 passed**
- frontend build: **passed**

## What became more real

- checkpointing is now presented more honestly as a graph-scope runtime setting,
- the quick-start surface is less misleading,
- legacy detached checkpoint markers remain supported but are clearly treated as inherited graph-scope markers,
- compile behavior remains backward compatible.

## What remains bounded / deferred

- `memory_checkpoint` still exists as a legacy graph-scope marker surface for compatibility,
- I did not remove it from every advanced palette surface in this pass,
- I did not attempt a full browser/manual UX audit here,
- I did not add new persistence backends beyond the existing store backend choices.

## Recommended next pass

The next useful pass is a broader **browser/manual UX audit + graph-scope / detached surface guidance** pass across all graph-scope or detached abstractions, not only checkpointing.
