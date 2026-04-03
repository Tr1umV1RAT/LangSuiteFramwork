# Handoff v17 — targeted UI/UX fusion + minimal settings shell

## State of the branch
v17 is now a targeted fusion on top of the v16 recentered base.
- v16 remains the functional trunk
- v15 P0 visual restraint was selectively reintroduced
- a minimal settings shell was added

## What changed
- lighter `TabBar` in simple mode
- calmer simple block palette
- stricter disclosure defaults in simple state UI
- reduced simple-node technical chip density
- preserved v16 RunPanel architecture with preference-driven behavior
- added persistent workspace preferences

## Preferences added
15 persistent options are now available through the settings shell:
- default editor mode
- autosave
- confirm before close
- minimap
- snap to grid
- UI density
- quick-start visibility
- incompatible-block visibility
- compact palette
- default RunPanel tab
- JSON tab visibility
- log auto-scroll
- reduced technical badges in simple mode
- artifact badges in simple mode
- `scopePath` visibility in simple mode

## What remains true
- runtime is still primarily LangGraph-centric
- advanced conceptual surfaces still exist
- no native separate runtime claim for `agent` / `deep_agent`

## Main risks / next checks
1. Real browser QA still needed:
   - toolbar
   - tab bar
   - block palette
   - state panel
   - custom nodes
   - run panel
   - settings shell open/close
   - persistence after reload
2. Check whether simple-mode defaults are now calm enough without becoming too empty.
3. Consider later whether some appearance preferences should remain exposed or be trimmed further.

## Recommended next move
Do a real browser QA pass and only then decide whether v17 should get a tiny follow-up polish pass (likely on spacing and maybe one or two labels), rather than another broad merge.
