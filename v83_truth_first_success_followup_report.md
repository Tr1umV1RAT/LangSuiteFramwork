# LangSuite v83 — truthful first-success pass

## Goal

This pass stayed within product-truth / first-success boundaries.
It did **not** broaden the product claim surface.
It targeted three concrete confusion sources:

1. package import/export consequences,
2. compile-safe starter graphs,
3. dependency/provider runtime error copy.

## What changed

### 1) Package import/export now carries explicit surface truth

Added/extended package metadata so exported workspace packages now carry a `surfaceTruth` summary:
- artifact type,
- execution profile,
- project mode,
- compile-safe yes/no,
- runtime-enabled yes/no,
- editor-only yes/no,
- short human summary.

The toolbar package UI now surfaces:
- current workspace surface truth,
- compile-safe vs not compile-safe,
- editor-first vs runtime-enabled,
- clearer consequence copy for export/import.

Import diagnostics now preserve:
- imported surface truth,
- package includes,
- package excludes.

### 2) Better starter templates

Replaced the misleading provider-backed graph starter with compile-safe graph starters:
- `core_echo_starter`
- `static_debug_starter`

These are provider-free first-success starters aimed at:
- opening cleanly,
- compiling truthfully,
- running on the LangGraph trunk without needing provider setup.

Artifact library cards now show:
- compile-safe badge,
- editor-first / runtime-enabled badge,
- short surface summary,
- compile-safe first-success hint for suitable built-in graph starters.

### 3) Better dependency/provider error copy

Improved backend error wording for:
- missing runtime dependencies,
- missing provider base URL,
- missing provider env vars,
- provider surface unsupported,
- requests target config,
- filesystem root config,
- shell arming / allowlist,
- GitHub config,
- SQL read-only restriction.

Added frontend actionable hint cards in run logs for common runtime failures so the user sees:
- what to change,
- where to change it,
- and what to do next.

## Files changed

### Frontend
- `client/src/components/Toolbar.tsx`
- `client/src/components/RunPanel.tsx`
- `client/src/components/artifacts/ArtifactLibrarySection.tsx`
- `client/src/api/artifacts.ts`
- `client/src/store.ts`
- `client/src/store/types.ts`
- `client/src/store/workspace.ts`

### Backend / registry
- `core/artifact_registry.py`
- `core/runtime_dependencies.py`
- `core/runtime_preflight.py`
- `artifact_registry/graphs/core_echo_starter.json`
- `artifact_registry/graphs/static_debug_starter.json`
- removed `artifact_registry/graphs/chat_workflow.json`

### Tests
- `tests/test_v83_truthful_first_success_pass.py`

## Validation performed

### Python
Passed:
- `PYTHONPATH=. pytest -q tests/test_v82_truthful_product_clarity_followup.py tests/test_v83_truthful_first_success_pass.py`
- result: **10 passed**

Note:
- broader embedded/provider tests that import `langchain_core` could not be re-run in this environment because that package is not installed here.
- this is an environment limitation, not evidence of a regression in the current patch.

### Frontend
Passed:
- `npm ci`
- `npm run verify`

Result:
- TypeScript typecheck passed
- production frontend build passed
- static sync passed

Note:
- `npm ci` reported **1 high severity vulnerability** in the dependency tree; not introduced by this pass.

## Truth impact

This pass improves first-use truth in three important ways:

- packages now better communicate what they really preserve,
- starters now reinforce the supported path instead of nudging users into provider setup too early,
- runtime failures now tell the user what to do next instead of only what went wrong.

## Best next pass

The next disciplined continuation should be:

1. make provider/dependency readiness even more causal in the run panel before first run,
2. extend package/import truth to artifact save/open surfaces in the state panel,
3. tighten secondary docs so the same wording appears consistently outside the main UI.
