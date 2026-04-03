# Handoff — v76 hover-lock ergonomics

## What changed
- `Esc` now clears a locked hover and disables lock mode.
- runtime hover legend now exposes actual predecessor/successor node ids.
- execution timeline and run-log chips/cards support double-click-to-lock.

## Files touched
- `client/src/App.tsx`
- `client/src/components/RunPanel.tsx`
- `tests/test_v76_hover_lock_ergonomics.py`

## Validation performed
- targeted Python regression slice: `39 passed`
- TypeScript transpile parse check: `transpile-ok`

## Notes
- Based on the latest actual artifact available on disk: `LangSuite_v75_hover_brushing_lock_hover_pass.zip`
- No hidden runtime semantics were invented; interactions are derived from authored graph structure + existing runtime signals.
