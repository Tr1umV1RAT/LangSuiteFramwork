# LangSuite v88 — bounded future-surface design pass

## Scope of this pass

This pass does **not** implement a prompt-strip system or a true module library.
It defines them as **future product surfaces with bounded contracts**, so they can be built later without reintroducing the ambiguity just removed in v87.

## What changed

Added two design documents to the repository:
- `v88_prompt_strip_system_design.md`
- `v88_module_library_design.md`

These documents do four things:
1. define what each future surface **is**,
2. define what it **is not**,
3. define the smallest credible v1 contracts,
4. identify the exact repository seams to touch later.

## Why this pass matters

After v87, the repository is clearer about what it does **not yet** have:
- no dedicated prompt-strip panel,
- no true module library.

The next risk was building those ideas later in a vague or overlapping way.
This pass prevents that by fixing the future boundary now.

## Prompt-strip design outcome

The future prompt-strip system is defined as:
- a reusable prompt asset registry,
- explicit assignment rules,
- deterministic merge semantics,
- previewable final resolution,
- compile-aware only after explicit propagation exists.

Key protection:
- local `system_prompt` fields remain authoritative surfaces;
- the prompt-strip system does **not** become a hidden global mutation layer.

## Module-library design outcome

The future module library is defined as:
- a manifest-backed loader for reusable bundles,
- category-based and provenance-aware,
- bounded to loading existing product surfaces,
- not a runtime family,
- not an unrestricted plugin executor.

Key protection:
- palette, artifacts, subagents, and future prompt strips remain distinct surfaces even if modules can load or reference them.

## Why this is a design pass rather than an implementation pass

Because the repository is not yet at the point where these surfaces can be implemented truthfully by simply renaming existing UI.
They need:
- explicit storage,
- explicit assignment/loading semantics,
- explicit compile/runtime propagation rules,
- and explicit save/open/package consequences.

## Likely next implementation order

1. **Prompt strips phase 1**
   - workspace-owned strip registry
   - explicit assignments
   - resolved preview
   - no compile/runtime propagation claim yet

2. **Prompt strips phase 2**
   - compiler propagation into prompt-capable nodes
   - compile/runtime truth upgraded accordingly

3. **Module library phase 1**
   - manifest-backed module registry
   - installed-module metadata
   - load effects limited to authoring assets

4. **Module library phase 2**
   - provenance-aware loading/unloading
   - optional filesystem-backed custom modules under manifest constraints

## Validation

This pass is documentation-only.
No runtime/compiler/frontend behavior was changed.

The value of the pass is architectural and product-boundary clarity:
- future implementation can now be tested against explicit contracts,
- current UI remains truthful,
- and later development can avoid collapsing adjacent surfaces into one ambiguous system.
