# v17 repair log

## Pass summary
Applied a selective v15 P0 -> v16 UI/UX fusion on the v16 codebase only.

## Key repair decisions
1. Treat `TabBar` as priority #1 noise source and reintroduce mode-dependent restraint.
2. Collapse the simple palette helper surface into one calmer zone.
3. Preserve the v16 state panel structure but tone down first-screen intensity.
4. Preserve the v16 RunPanel architecture, avoiding regression.
5. Add only a small preferences hub instead of scattering persistent knobs across the UI.

## Intentionally avoided
- backend/runtime redesign
- artifact model removal
- wrapper semantics redesign
- deep runtime claims for `agent` / `deep_agent`
