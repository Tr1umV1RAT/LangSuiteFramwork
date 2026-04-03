# v73 handoff — interactive runtime navigation

## Delivered

- Shared runtime focus request path in the store
- Graph-side selection + centering from runtime focus requests
- Interactive graph legend/toggles for traversed / scheduled / muted edge rendering
- Click-to-focus affordances in:
  - run timeline
  - run log node badges
  - debug execution path
  - debug scheduled-next chips
  - state execution path
  - state scheduled-next chips

## Files changed

- `client/src/store/types.ts`
- `client/src/store.ts`
- `client/src/App.tsx`
- `client/src/components/RunPanel.tsx`
- `client/src/components/DebugPanelContent.tsx`
- `client/src/components/StatePanelContent.tsx`
- `tests/test_v73_interactive_runtime_navigation.py`

## Validation

- `33 passed` on targeted Python tests
- `transpile-ok` on modified TS/TSX files

## Notes

- Focus navigation uses real authored node IDs only.
- No speculative internal runtime pathing was added.
- Legend toggles are UI rendering controls, not runtime controls.
