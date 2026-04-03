# LangSuite v31 — Maintainability and Truth Consolidation Pass

## 1. Concise execution summary

This pass was a narrow cleanup pass performed **after** the v29 compile-hardening and v30 validation-expansion work.

I did **not** broaden the visible product story.

I centralized the current capability truth into one shared matrix, reduced duplicated artifact/profile logic across frontend and backend, extracted maintainability-oriented store domains, aligned artifact-family documentation, and added regression coverage around the refactor-sensitive truth boundaries.

The visible product remains:
- one real LangGraph-centered builder / compiler / runtime trunk,
- sync + async as the only earned visible execution profiles,
- subgraphs as real child/tabbed structural units,
- hidden future-facing surfaces retained only as internal / compatibility concepts.

## 2. Why this pass was justified after v30

v29 removed concrete backend compile lies.
v30 proved more of the real trunk in practice.

Because the current trunk had now been validated enough to trust, the next justified move was not broader platform expansion. It was drift reduction.

Without this cleanup, the codebase still had the usual solo-project hazard: the same truth encoded in too many places, with too many opportunities for UI, backend, registry, and import/export behavior to drift apart later.

## 3. Truth sources before refactor

### Before

Capability truth was duplicated across multiple layers:
- `client/src/store.ts`
  - artifact/profile unions,
  - visible-surface normalization,
  - default execution profile logic,
  - workspace import/export truth normalization.
- `client/src/catalog.ts`
  - visible artifact/profile arrays,
  - node runtime metadata,
  - hidden/palette/runtime compatibility rules.
- `client/src/components/StatePanelContent.tsx`
  - hardcoded visible artifact/profile options.
- `client/src/components/artifacts/ArtifactLibrarySection.tsx`
  - hardcoded artifact labels/default profiles/default async behavior.
- `client/src/components/ProjectManager.tsx`
  - hardcoded legacy-family interpretation.
- `client/src/api/artifacts.ts`
  - duplicated artifact kind union.
- `core/schemas.py`
  - duplicated visible vs legacy artifact/profile sets.
- `core/artifact_registry.py`
  - duplicated kind → directory mapping,
  - duplicated visible artifact families.
- `api/collaboration.py`
  - duplicated accepted artifact/profile strings.
- `artifact_family_contracts.md`
  - documentation that could drift from implementation.

### After

The main truth center is now:
- `client/src/capabilityMatrix.json`

Consumed by:
- `client/src/capabilities.ts` on the frontend,
- `core/capability_matrix.py` on the backend.

That change narrows the lie-margin between UI, backend validation, artifact listing, and compatibility handling.

## 4. Exact changes made

### Shared capability truth
- Added `client/src/capabilityMatrix.json` as the canonical matrix for:
  - artifact families,
  - execution profiles,
  - runtime-backed node surface list,
  - palette-hidden node list,
  - node metadata overrides.
- Added `client/src/capabilities.ts` as the typed frontend reader/helper layer.
- Added `core/capability_matrix.py` as the backend loader/helper layer.

### Frontend capability consolidation
- Reworked `client/src/catalog.ts` to derive its runtime/capability metadata from the shared matrix rather than maintaining a separate hardcoded truth island.
- Updated `client/src/api/artifacts.ts` to derive artifact kind typing from the capability layer.
- Updated `client/src/components/StatePanelContent.tsx` to derive visible artifact/profile options and artifact-directory display from the shared capability metadata.
- Updated `client/src/components/artifacts/ArtifactLibrarySection.tsx` to derive labels/default profiles/default async settings from shared artifact metadata.
- Updated `client/src/components/ProjectManager.tsx` to derive legacy-family detection from the shared capability layer.

### Backend capability consolidation
- Updated `core/schemas.py` to derive artifact/profile allow-lists from the shared matrix-backed loader.
- Updated `core/artifact_registry.py` to derive artifact directories and visible library families from the shared matrix-backed loader.
- Updated `api/collaboration.py` to stop hardcoding accepted artifact/profile strings.

### Store/domain decomposition
- Added `client/src/store/types.ts`
  - shared store-facing types/interfaces.
- Added `client/src/store/preferences.ts`
  - preferences defaults, sanitization, preset patch logic, storage keys.
- Added `client/src/store/workspace.ts`
  - workspace normalization, default runtime settings, scope helpers, import parsing helpers.
- Slimmed `client/src/store.ts` by moving domain logic out while preserving the public store surface and current visible behavior.

### Documentation alignment
- Updated `artifact_family_contracts.md` to match current v31 product truth and the new capability-matrix source of truth.

## 5. Capability matrix consolidation

### New canonical source
- `client/src/capabilityMatrix.json`

### What it now centralizes
- artifact family visibility,
- library visibility,
- scope kind,
- artifact registry directory mapping,
- default execution profile,
- visible vs hidden execution profiles,
- runtime-backed node inventory,
- palette-hidden node policy,
- node-level origin / compile alias / placement / future-hook / internal-only metadata.

### Frontend consumers after consolidation
- `client/src/capabilities.ts`
- `client/src/catalog.ts`
- `client/src/api/artifacts.ts`
- `client/src/components/StatePanelContent.tsx`
- `client/src/components/artifacts/ArtifactLibrarySection.tsx`
- `client/src/components/ProjectManager.tsx`
- `client/src/store.ts`
- `client/src/store/workspace.ts`

### Backend consumers after consolidation
- `core/capability_matrix.py`
- `core/schemas.py`
- `core/artifact_registry.py`
- `api/collaboration.py`

### Before / after summary
- **Before:** multiple handwritten truth islands.
- **After:** one shared matrix + thin readers on each side.

That is not theoretical elegance. It is maintenance damage control.

## 6. Store/domain decomposition summary

The store was **not** rewritten into a speculative new architecture.

Instead, it was decomposed into maintainable domains while preserving the existing `useAppStore` surface:

### `client/src/store/types.ts`
Owns:
- UI/store-facing types,
- workspace snapshot types,
- validation result types,
- runtime/log/import diagnostic types.

### `client/src/store/preferences.ts`
Owns:
- preference defaults,
- preference sanitization,
- workspace preset patches,
- preference/editor-mode storage keys and initial-load helpers.

### `client/src/store/workspace.ts`
Owns:
- visible artifact/profile normalization,
- default runtime settings,
- scope path / graph id helpers,
- root-tab construction,
- workspace import parsing,
- import diagnostic helpers.

### `client/src/store.ts`
Still owns:
- the actual Zustand store,
- actions and orchestration,
- live runtime/run/debug/collaboration behavior,
- graph editing mutations.

This keeps the working product surface stable while making future targeted refactors less dangerous for one developer.

## 7. Regression coverage added or updated

### Added
- `tests/test_v31_capability_matrix.py`
  - verifies backend capability loader matches the shared matrix JSON,
  - verifies artifact registry default visibility vs hidden expansion still matches truth,
  - verifies `/api/artifacts` default and `include_hidden=true` behavior remain aligned.
- `tests/browser_smoke_v31.py`
  - verifies default artifact API surface remains `graph` + `subgraph`,
  - verifies legacy artifact/profile payloads are still normalized back onto the truthful visible workspace surface in the browser-backed store.

### Re-run to preserve v29/v30 guarantees
- `tests/test_v29_compile_truth.py`
- `tests/test_v30_runtime_validation.py`
- `tests/backend_session_workspace_smoke.py`
- `tests/project_tree_hidden_child_smoke.py`

## 8. What remained intentionally deferred

I did **not** do any of the following in this pass:
- expose LangChain or DeepAgents as visible peer runtimes/editors,
- expand export/import truth beyond what has already been validated,
- rewrite the full frontend store into a new slice framework,
- merge `nodeConfig.ts` entirely into the capability matrix,
- do bundle-chunking/performance work beyond noting the current warning,
- broaden package persistence claims,
- perform speculative platform restructuring.

Those remain later decisions, not present-tense truth.

## 9. How this pass helps future platform evolution without widening current claims

This pass helps the broader later platform vision in a quiet, non-theatrical way:

- future hidden/internal surfaces now have a clearer place to live without leaking into product claims,
- artifact/profile truth can evolve from one matrix instead of six scattered files,
- backend and frontend can add future capability distinctions with less risk of contradiction,
- the store is easier to keep stable while selectively extracting more domains later,
- documentation now points more explicitly at what is real, what is hidden, and what is future-facing.

In other words: the codebase is more prepared for later pluralism **without pretending pluralism already exists**.

## 10. Recommended next pass

A justified next pass would be a **narrow product-UX and bundle discipline pass**, for example:
- reduce the oversized frontend bundle warning,
- tighten panel ergonomics / inspector clarity where truth is already earned,
- optionally continue store extraction only in the run/debug/collaboration domains,
- keep the visible product story unchanged.

Not recommended next:
- broad runtime plurality,
- speculative editor-mode expansion,
- claiming broader persistence than has been proven.
