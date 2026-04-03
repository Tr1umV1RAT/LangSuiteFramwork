# v94 report — branch opening seam for a future JDR demo branch

## Scope

This pass did **not** add a JDR runtime or a domain-specific fork inside `main`.
It added a **branch-opening seam** so `main` can stay generic while a future tabletop-RPG demo branch diverges mostly through modules, prompts, subagents, starters, and visual hints.

## What changed

### 1. Module Library now carries branch/profile metadata

Added bounded metadata on module entries:
- `lineage`: `shared` or `branch_overlay`
- `branchTargets`
- `recommendedProfile`
- `themeHints`
- `compatibilityNotes`

These fields are advisory and additive.
They do **not** create a new runtime rail.
They do **not** change compile semantics.
They do **not** change project/package/artifact truth.

### 2. State Panel exposes the branch-opening seam explicitly

The Module Library UI now explains that modules may carry branch/profile metadata so `main` can remain generic while a future domain branch can interpret those bundles more richly.

### 3. Branch/docs guidance added

Added:
- `v94_jdr_branch_opening_plan.md`
- `v94_chatgpt_project_recommendation.md`

These define:
- the intended seam between `main` and a future JDR demo branch,
- retrocompatibility expectations,
- and the recommendation to use **two ChatGPT projects** once the domain branch starts real implementation.

## Installer verification

The Windows installer/manager sanity wrapper was re-run in this pass and still passes.
No installer behavior was broadened or rewritten.

## Why this pass matters

The repo can now start accumulating **fork-friendly domain packs** on the trunk without pretending the core product has become domain-specific.
This is the right place to diverge later:
- content,
- casts,
- rules,
- worlds,
- themes,
- starter selection,
- and overlays.

Not:
- runtime,
- compiler,
- persistence semantics,
- provider truth,
- or save/open truth.

## Validation

- `PYTHONPATH=. pytest -q tests/test_v94_branch_seam_and_installer.py`
- targeted `py_compile` for `core/schemas.py`

Expected result for this pass:
- branch seam metadata accepted,
- UI wording present,
- docs present,
- installer sanity still green.
