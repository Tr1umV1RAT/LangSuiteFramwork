# LangSuite v82 — truthful product clarity follow-up

## Scope

This pass continued the earlier Phase 1 truth/usability work without expanding the product surface.

It focused on:
- product-truth framing,
- import/export consequence clarity,
- advanced-surface de-emphasis,
- and repo hygiene defaults.

## What changed

### 1. README truth rewrite
The top-level README now presents LangSuite as:
- LangGraph-first,
- compile-to-zip first-class,
- in-app runtime real but bounded,
- LangChain/DeepAgents support uneven and not parity-marketed,
- package export/import explicitly limited to editable workspace transport.

It also now separates:
- save in app,
- package export/import,
- compile Python.

### 2. Package consequence dialog
The toolbar package menu now has an explicit consequence dialog before:
- exporting a workspace package,
- importing a workspace package.

The dialog states concrete consequences instead of relying on vague help text:
- export keeps editable workspace only,
- export excludes runtime DB/vector stores/secrets/env snapshots,
- import replaces the current editor workspace,
- import cannot recreate missing local runtime state.

### 3. Advanced-mode de-emphasis
Advanced authoring is now framed more honestly in several places:
- toolbar mode switch: `Graph recommended`, `Advanced optional`,
- toolbar note when advanced mode is active,
- canvas notice in advanced mode,
- project manager note and softened button hierarchy,
- artifact library note clarifying that advanced view does not imply peer runtime parity.

This keeps advanced surfaces available while reducing false equivalence with the default LangGraph trunk.

### 4. Repo hygiene defaults
Added `.gitignore` entries for:
- `db/langgraph_builder.db`
- `client/dist/`
- `static/`
- `client/node_modules/`
- `client/tsconfig.tsbuildinfo`

For the delivered source artifact, removed generated/local state artifacts:
- `client/node_modules/`
- `db/langgraph_builder.db`
- `client/tsconfig.tsbuildinfo`
- `client/dist/`
- `static/`

## Validation

### Python tests
Passed:
- `tests/test_v81_phase1_clarity_pass.py`
- `tests/test_v82_truthful_product_clarity_followup.py`
- `tests/test_v62_support_status_and_frontend_path.py`
- `tests/test_v71_ui_runtime_truth_pass.py`
- `tests/test_v80_frontend_runtime_event_usage.py`
- `tests/test_v80_runtime_event_truth.py`

Combined result:
- **21 passed**

### Frontend verification
Executed:
- `npm ci`
- `npm run verify`

Result:
- **passed**

Note:
- `npm ci` reported **1 high severity vulnerability** in the frontend dependency tree via audit metadata. This pass did not change dependency versions, so it is an environment/dependency maintenance item rather than a regression from the clarity patch.

## Why this pass matters

This follow-up reduces three recurring user-confusion vectors:
1. mistaking advanced/editor-only/bridge-backed surfaces for equal runtime guarantees,
2. conflating package export/import with compile or with runtime state capture,
3. letting repo-generated clutter masquerade as source truth.

The result is a product that says less nonsense while preserving useful advanced surfaces.
