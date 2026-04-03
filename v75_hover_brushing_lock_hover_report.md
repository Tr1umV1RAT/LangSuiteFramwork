# v75 hover brushing / lock-hover UX pass

## Executive summary

This pass adds shared runtime hover brushing and inspection controls across the graph, run logs, debug panel, and state panel.

Implemented:

- shared store-backed runtime hover target
- shared runtime navigation settings with:
  - `lockHover`
  - `followActiveNode`
- graph edge hover brushing with truthful authored-path semantics:
  - inbound edges into the inspected node
  - outbound edges leaving the inspected node
  - muted unrelated authored edges
- graph-node brushing with:
  - hovered node styling
  - predecessor node styling
  - successor node styling
  - muted unrelated nodes during hover inspection
- compact hover legend in the graph overlay
- hover participation in:
  - execution timeline
  - run log cards
  - debug execution path chips
  - state execution path chips

## Repo-grounded findings

The latest actual archive available in the environment was `LangSuite_v73_interactive_runtime_navigation_pass.zip`.
A `v74` archive was not present on disk, so this pass was applied on top of the latest available repo artifact rather than a missing intermediate archive.

The repo already had:

- execution timeline derivation
- click-to-focus runtime navigation
- runtime edge legend and authored-edge decoration
- node runtime chips / summaries

The missing piece was a shared hover channel and a persistent inspection mode.

## Concrete changes

### Store / shared truth

Updated:

- `client/src/store/types.ts`
- `client/src/store.ts`

Added:

- `RuntimeHoverTarget`
- `RuntimeNavigationSettings`
- `runtimeHoverTarget`
- `runtimeNavigationSettings`
- `setRuntimeHoverTarget()`
- `clearRuntimeHoverTarget()`
- `updateRuntimeNavigationSettings()`

### Graph / canvas

Updated:

- `client/src/App.tsx`
- `client/src/index.css`
- `client/src/components/CustomNode.tsx`

Added:

- edge hover classes:
  - `runtime-edge-hover-inbound`
  - `runtime-edge-hover-outbound`
  - `runtime-edge-hover-muted`
- node hover classes:
  - `runtime-hovered`
  - `runtime-hover-predecessor`
  - `runtime-hover-successor`
  - `runtime-hover-muted`
- graph runtime hover legend with:
  - inbound / outbound explanation
  - predecessor / successor counts
  - `lock hover` toggle
  - `follow active` toggle
  - `clear hover`

### Execution surfaces

Updated:

- `client/src/components/RunPanel.tsx`
- `client/src/components/DebugPanelContent.tsx`
- `client/src/components/StatePanelContent.tsx`

Added hover publishing and matching highlights for:

- execution timeline steps
- scheduled-next chips
- run-log cards
- run-log node buttons
- debug path chips
- state path chips

## Tests

Added:

- `tests/test_v75_hover_brushing_lock_hover.py`

Regression slice run:

- `tests/test_v68_local_mutation_and_shell_tools.py`
- `tests/test_v69_apply_patch_tool.py`
- `tests/test_v70_local_mutation_trust.py`
- `tests/test_v71_ui_runtime_truth_pass.py`
- `tests/test_v72_execution_timeline_rendering.py`
- `tests/test_v73_interactive_runtime_navigation.py`
- `tests/test_v75_hover_brushing_lock_hover.py`

## Results actually run

### Python tests

`37 passed`

### TypeScript parse/transpile validation

Checked via `typescript.transpileModule` on:

- `client/src/store/types.ts`
- `client/src/store.ts`
- `client/src/App.tsx`
- `client/src/components/CustomNode.tsx`
- `client/src/components/RunPanel.tsx`
- `client/src/components/DebugPanelContent.tsx`
- `client/src/components/StatePanelContent.tsx`

Result:

- `transpile-ok`

## Known limitations

- Brushing remains intentionally limited to authored graph structure.
- It does not invent hidden runtime edges or hidden runtime nodes.
- `followActiveNode` follows the reported active node only.
- Full frontend production build was not claimed.

## Recommended next pass

A good next pass is hover-inspection ergonomics:

- keyboard escape to clear hover lock
- optional click-to-lock on timeline/log chips
- breadcrumb text for predecessor vs successor node identities in the hover legend
