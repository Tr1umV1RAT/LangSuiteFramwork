# LangSuite v89 — Prompt-Strip System phase 1

## Scope of this pass

This pass implements the **first real Prompt-Strip System slice** discussed in v88.
It stays intentionally bounded:
- **editor-backed**,
- **previewable**,
- **save/load and package friendly** through existing workspace/runtime-settings rails,
- but **not yet compile/runtime-propagated**.

That is deliberate. The goal is to create a truthful reusable prompt asset seam that can later support:
- domain personas,
- bounded GM / NPC / helper role packs,
- future universe/rules bundles,
- and a future demo branch,
without inventing a new runtime family or hidden prompt mutation layer.

## What was implemented

### 1. Prompt-strip data model is now real in workspace state

Updated:
- `client/src/store/types.ts`
- `client/src/store/workspace.ts`
- `client/src/store.ts`

Added persisted types:
- `PromptStripDefinition`
- `PromptStripVariableDefinition`
- `PromptStripAssignment`
- `PromptAssignmentTarget`
- `PromptStripMergeMode`

`RuntimeSettings` now carries:
- `promptStripLibrary`
- `promptStripAssignments`

This means prompt strips now survive:
- in-app project save/open,
- package export/import,
- and ordinary workspace hydration,
through the same truthful authoring rails already used elsewhere.

### 2. Sanitization and deterministic resolution helpers now exist

Updated:
- `client/src/store/workspace.ts`

Added helpers for:
- strip sanitation,
- assignment sanitation,
- variable extraction from `{{ variable }}` placeholders,
- target-key normalization,
- prompt-capable node detection,
- local prompt extraction,
- deterministic resolved prompt preview.

Resolution behavior implemented now:
1. enabled `prepend` strips,
2. local target prompt text,
3. enabled `append` strips,
4. `replace_if_empty` only when local prompt text is empty.

This is still editor-phase behavior, but it already gives a trustworthy preview anchor.

### 3. Real Prompt Strips section added to the State panel

Updated:
- `client/src/components/StatePanelContent.tsx`

Added a dedicated **Prompt Strips** section with:
- strip creation,
- inline strip editing,
- tags,
- inferred variables,
- delete behavior,
- explicit assignment UI,
- resolved preview.

Supported explicit targets in this phase:
- graph default for the active tab,
- selected prompt-capable node,
- named subagents in the Subagent Library.

Also added:
- “Créer depuis le nœud sélectionné” to seed a reusable strip from a node-local prompt.

This is especially useful for future domain/demo branches that want to turn authored prompts into reusable role/persona assets.

### 4. Subagents now participate cleanly in the same system

Updated:
- `client/src/components/StatePanelContent.tsx`

Each subagent entry can now receive prompt-strip assignments explicitly.
This keeps subagent-local prompts intact while allowing layered reusable framing.

This is the exact seam needed later for:
- GM persona,
- NPC persona,
- assistant/player personas,
- universe-specific framing,
without redefining subagents as a new runtime.

### 5. Capability Inspector now reflects prompt-strip phase 1 truth

Updated:
- `client/src/components/CapabilityInspectorSection.tsx`

The inspector now reports, for prompt-capable nodes:
- how many prompt-strip assignments exist,
- whether a local prompt already exists,
- whether a resolved preview is available,
- and the phase-1 truth boundary:
  - deterministic preview exists,
  - compile/runtime propagation is **not yet active**.

## What this does **not** claim yet

This pass does **not** implement:
- compile-time propagation into generated Python,
- runtime propagation beyond editor preview,
- artifact-backed prompt-strip publishing,
- wildcard/category auto-assignment,
- hidden global prompt mutation,
- module-library loading of prompt-strip bundles.

## Why this matters strategically

This pass makes the future branch split much cleaner.
The upcoming demo branch can now diverge primarily through:
- prompt-strip content,
- tags,
- assignments,
- subagent role composition,
- visual/theme overlays,
- and later module bundles,
while still relying on the same LangSuite trunk.

In product terms, this is the first real reusable prompt asset seam.
In architecture terms, it reduces the need to fork behavior just to fork domain framing.

## Files touched

- `client/src/store/types.ts`
- `client/src/store/workspace.ts`
- `client/src/store.ts`
- `client/src/components/StatePanelContent.tsx`
- `client/src/components/CapabilityInspectorSection.tsx`
- `tests/test_v89_prompt_strip_phase1.py`

## Validation executed

### Python tests
Command:
- `PYTHONPATH=. pytest -q tests/test_v84_truthful_surface_followup.py tests/test_v85_project_persistence_truth.py tests/test_v86_run_path_causality.py tests/test_v87_prompt_and_module_boundaries.py tests/test_v89_prompt_strip_phase1.py`

Result:
- **17 passed**

## Best next pass

The best next pass is now:
1. **Prompt-strip phase 2** — propagate resolved prompt output into compile/runtime on already prompt-bearing node families only;
2. then **module library phase 1** — use bounded manifests to load prompt strips, subagent groups, and starter assets without inventing a second runtime.

That sequence would directly support the future demo/JDR branch while keeping the trunk truthful.
