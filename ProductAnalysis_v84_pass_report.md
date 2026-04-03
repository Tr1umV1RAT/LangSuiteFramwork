# LangSuite v84 — truthful artifact surfaces + first-success follow-up

## Scope of this pass

This was **not** a feature-expansion pass.
It was a **truthfulness / first-success / product-clarity** follow-up to the previous Phase 1 work.

The focus was:
1. extend product-truth messaging from package import/export into **artifact open/save** surfaces,
2. make the first successful run path more explicit from the **empty canvas**,
3. make pre-run failure modes more causal in the **Run panel**, without pretending the UI knows the Python environment.

## What changed

### 1. Artifact open/save truth is now explicit

#### Backend
Updated:
- `core/artifact_registry.py`

Added per-artifact truth metadata:
- `surfaceTruth`
- `openEffectSummary`
- `saveEffectSummary`

This now makes artifact metadata clearer in both list and fetch flows:
- opening an artifact restores an **editable copy** only,
- saving/publishing preserves the **authored artifact definition** and declared surface truth,
- neither action claims to restore runtime state, local dependencies, secrets, or environment.

#### Frontend
Updated:
- `client/src/api/artifacts.ts`
- `client/src/components/artifacts/ArtifactLibrarySection.tsx`
- `client/src/components/StatePanelContent.tsx`

Effects:
- the artifact library now shows an **open-effect summary**,
- the publish section now shows **compile-safe vs editor-first truth**, plus what publishing does and does not preserve,
- the wording is more consistent with package truth and runtime truth.

### 2. Empty canvas now points to real compile-safe starters

Updated:
- `client/src/App.tsx`

Added direct starter actions in the empty state:
- `Open compile-safe starter`
- `Open static debug starter`

These use real built-in graph artifacts rather than synthetic marketing language.
The intent is simple: improve the odds of a first successful compile/run path without provider setup.

### 3. Run panel now lists likely blockers before first run

Updated:
- `client/src/components/RunPanel.tsx`

Added a new “likely blockers” area under runtime readiness.
This derives from existing validation issues and rewrites them into more actionable language, for example:
- add API Base URL,
- declare and actually set provider env vars,
- switch away from unsupported provider surfaces,
- fill missing required fields,
- fix broken tool references.

Important truth boundary preserved:
- the UI still **does not claim to know installed Python packages**,
- dependency presence remains a **backend preflight fact**.

## Why this pass matters

The prior passes already clarified:
- support levels,
- package consequences,
- runtime emitted vs UI-inferred truth,
- compile-safe starters in the library.

But one gap remained:
- users could still over-read what **artifact open/save** means,
- the empty state still suggested a path more than it enabled one,
- readiness was useful but not yet causal enough for the first run.

This pass closes those gaps without broadening the product claim.

## Files touched

- `core/artifact_registry.py`
- `client/src/api/artifacts.ts`
- `client/src/components/artifacts/ArtifactLibrarySection.tsx`
- `client/src/components/StatePanelContent.tsx`
- `client/src/App.tsx`
- `client/src/components/RunPanel.tsx`
- `tests/test_v84_truthful_surface_followup.py`

## Validation executed

### Python tests
Command:
- `PYTHONPATH=. pytest -q tests/test_v82_truthful_product_clarity_followup.py tests/test_v83_truthful_first_success_pass.py tests/test_v84_truthful_surface_followup.py`

Result:
- **14 passed**

### Frontend verification
Command:
- `cd client && npm run verify`

Result:
- **passed**

Notes:
- Vite still reports a large-chunk warning during production build.
- This pass did not address bundling/chunk-splitting; that is orthogonal to truth/product-clarity work.

## Product truth after this pass

### Strongest default path
Still:
- LangGraph-first
- core nodes first
- runtime readiness visible
- compile/export is real
- in-app runtime is real on truthful surfaces

### Now clearer than before
- package import/export ≠ save ≠ compile
- artifact open/save ≠ runtime restore
- starter success path is explicit in the empty state
- likely first-run blockers are surfaced before the user hits a backend wall

## Best next pass

The best next truth-preserving pass is now:
1. extend the same surface-truth model to **project save/open** language and project-manager copy,
2. make dependency/provider readiness even more **causal before Run** where the UI can do so honestly,
3. audit whether the **graph vs runtime truth layer** should be strengthened before any broader capability expansion.

That next pass is product-strategic, not just UI-polish.
