# LangSuite v73 — interactive runtime navigation pass

## Executive summary

This pass adds interactive runtime navigation grounded in real runtime signals already present in the repository.

The graph, run panel, debug panel, and state panel now share a store-backed focus request path so a user can:

- click a run-log node badge to select and center that node on the graph,
- click an execution timeline step to do the same,
- click debug execution-path chips to focus the graph,
- click state-panel execution-path chips to focus the graph,
- use a graph overlay legend to toggle traversed / scheduled / muted edge rendering and jump to the current or scheduled nodes.

No speculative execution graph was invented. Navigation is derived from authored nodes and runtime events already emitted by the current runtime.

## Repository-grounded findings

The repo already had:

- a real execution timeline derivation layer in `client/src/executionTimeline.ts`,
- store-level node selection helpers in `client/src/store.ts`,
- separate graph / run / debug / state UI surfaces,
- real runtime signals (`node_update`, `embedded_trace`, `paused`, `pendingNodeId`, `liveStateNext`).

The missing piece was a shared interactive navigation channel and a graph-side runtime legend.

## Concrete changes made

### Store / shared UI state

Updated:

- `client/src/store/types.ts`
- `client/src/store.ts`

Added store-backed runtime navigation and legend settings:

- `RuntimeFocusRequest`
- `RuntimeEdgeLegendSettings`
- `runtimeFocusRequest`
- `runtimeEdgeLegend`
- `requestRuntimeFocus()`
- `clearRuntimeFocusRequest()`
- `updateRuntimeEdgeLegend()`

### Graph / App surface

Updated:

- `client/src/App.tsx`

What changed:

- store focus requests now translate into real graph selection + centering,
- the capability inspector is synchronized to the focused node,
- a graph overlay legend now exposes:
  - current node jump,
  - scheduled node jump,
  - toggles for traversed edges,
  - toggles for scheduled edges,
  - toggles for idle-edge dimming.

### Run panel

Updated:

- `client/src/components/RunPanel.tsx`

What changed:

- execution timeline steps are clickable,
- scheduled-next chips are clickable,
- run-log node badges are clickable,
- all of them route through the shared store focus request path.

### Debug panel

Updated:

- `client/src/components/DebugPanelContent.tsx`

What changed:

- scheduled-next chips are clickable,
- execution-path chips are clickable,
- both focus the graph through the shared store path.

### State panel

Updated:

- `client/src/components/StatePanelContent.tsx`

What changed:

- execution-path chips are clickable,
- scheduled-next chips are clickable,
- both focus the graph through the shared store path.

## Tests added / updated

Added:

- `tests/test_v73_interactive_runtime_navigation.py`

It checks for:

- runtime focus request state and legend settings in the canonical store,
- App-level translation of focus requests into selection + centering,
- clickable focus affordances in run/debug/state surfaces.

## Validation actually run

### Python tests

Command:

```bash
pytest -q tests/test_v68_local_mutation_and_shell_tools.py tests/test_v69_apply_patch_tool.py tests/test_v70_local_mutation_trust.py tests/test_v71_ui_runtime_truth_pass.py tests/test_v72_execution_timeline_rendering.py tests/test_v73_interactive_runtime_navigation.py
```

Result:

- `33 passed`

### TypeScript syntax/transpile validation

Command executed via Node + TypeScript transpilation against the modified files.

Validated files:

- `client/src/App.tsx`
- `client/src/store.ts`
- `client/src/components/RunPanel.tsx`
- `client/src/components/DebugPanelContent.tsx`
- `client/src/components/StatePanelContent.tsx`
- `client/src/store/types.ts`

Result:

- `transpile-ok`

## Remaining limits

- This pass focuses authored graph nodes only; it does not invent hidden runtime nodes.
- Centering is based on node position and measured/known size where available.
- Edge toggles affect rendering truthfully, but they do not alter runtime state.
- I did not claim a full frontend production build here.

## Recommended next pass

The best next pass is node-detail correlation and timeline scrub UX:

- hover or click a node to highlight its matching log entries,
- hover a log entry to transiently highlight its inbound/outbound authored path,
- optional “pin runtime focus” mode so live runs can keep following the active node.
