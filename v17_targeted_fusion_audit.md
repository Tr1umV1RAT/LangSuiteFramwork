# LangSuite v17 — targeted fusion audit

Date: 2026-03-12

## Scope
Targeted UI/UX fusion pass on top of the v16 recentered base.
- functional trunk: v16
- visual restraint reference: v15 recentered P0
- minimal settings shell added after the simple-mode fusion

No backend/runtime redesign was performed.

## Concise answers to the guiding questions

### 1. What made v15 feel cleaner than v16?
The biggest factor was chrome density in simple mode:
- lighter `TabBar`
- less verbose simple-mode palette framing
- fewer always-open advanced cues
- less technical badge soup on the first screen

### 2. Presentation vs behavior
Mostly presentation and disclosure:
- tabs: presentation / conditional visibility
- palette: disclosure and framing
- state panel: disclosure defaults and hierarchy
- custom node chips: presentation density

Behavioral additions in v17 were limited to persistent preferences and a small settings shell.

### 3. What was ported from v15 into v16?
- simple-mode `TabBar` restraint philosophy
- calmer simple palette helper area
- stricter progressive disclosure in the state UI
- stronger suppression of simple-mode noise by default

### 4. Was `TabBar` the main source of regained visual noise?
Yes.
That was the clearest and most direct regression signal.

### 5. Other mode-dependent regressions?
Yes, smaller ones:
- simple palette helper boxes had become too stacked
- state sections were all very present at once
- simple-mode node metadata was still a bit too chatty

## Implemented summary

### Phase A — visual / UX fusion
- `TabBar`: simple mode now keeps the project name + runtime cue, with scope/artifact/path governed by simple-mode preferences.
- `BlocksPanelContent`: simple mode now uses one restrained helper zone, optional quick-start, optional artifact library expansion, and preference-driven compatibility filtering.
- `StatePanelContent`: simple mode keeps the useful v16 structure but uses calmer disclosure defaults.
- `CustomNode`: simple mode now suppresses some technical chips by default.
- `RunPanel`: v16 structure preserved, with preference-driven JSON visibility, default tab, and log autoscroll.

### Phase B — minimal settings shell
Added a small preferences hub with 15 persistent options grouped by user intent:
- General
- Editor
- Block Palette
- Execution
- Appearance

## Files changed
- `client/src/store.ts`
- `client/src/App.tsx`
- `client/src/index.css`
- `client/src/components/TabBar.tsx`
- `client/src/components/BlocksPanelContent.tsx`
- `client/src/components/StatePanelContent.tsx`
- `client/src/components/CustomNode.tsx`
- `client/src/components/RunPanel.tsx`
- `client/src/components/Toolbar.tsx`
- `client/src/components/SettingsShell.tsx` (new)

## Notes
- Runtime truth remains LangGraph-first.
- No native deep-agent runtime separation was claimed or introduced.
- Artifact families / wrappers / execution profiles remain present in advanced mode.
