# LangSuite v64 — runtime exercise pass

## Executive summary

This pass did not broaden the platform. It tightened the already-added tool surfaces by focusing on runtime honesty and exercise readiness:

- fixed a real generated-runtime bug in the GitHub wrappers (`_load_github_tool` / `_invoke_sync_tool` were referenced but not defined);
- added stricter GitHub configuration/input validation;
- made Playwright family presentation slightly tighter by surfacing compact truth chips directly in the palette and by refining per-tool permission metadata;
- improved SQL ergonomics while preserving read-only-first semantics;
- added optional live smoke-test scaffolding that stays skipped unless the environment explicitly supports it.

## What “runtime exercise pass” meant here

In this repository, a runtime exercise pass means:

1. verify that generated runtime code is not just semantically present but actually executable;
2. add honest preflight checks where configuration can be wrong;
3. add optional smoke tests that can exercise real provider/browser behavior when credentials/runtime exist;
4. tighten UI semantics where a family can still be misread despite being technically implemented.

## Concrete changes

### 1. Generated runtime hardening

File: `templates/tools.py.jinja`

Added shared helpers:
- `_coerce_bool`
- `_truncate_text`
- `_sql_limit_warning`
- `_normalize_positive_int`
- `_normalize_repo_relative_path`
- `_is_valid_github_repository`

Added GitHub runtime helpers that were previously missing:
- `_load_github_tool`
- `_invoke_sync_tool`

### 2. GitHub validation tightened

Files:
- `templates/tools.py.jinja`
- `core/runtime_preflight.py`

Changes:
- `GITHUB_REPOSITORY` is now validated against `owner/repo` format during runtime preflight.
- generated GitHub issue / PR tools now reject non-positive / non-integer identifiers.
- generated GitHub file reads now reject absolute paths and `..` traversal.
- generated GitHub search now rejects empty queries.

### 3. SQL ergonomics improved without relaxing safety

File: `templates/tools.py.jinja`

Changes:
- `sql_query` responses now include `db_path` and optional warning text.
- `sql_query_check` now emits a warning when a query lacks `LIMIT`.
- `sql_list_tables` now returns structured JSON with `db_path`, `tables`, and `count`.
- `sql_get_schema` remains read-only but now returns a structured/truncated payload more suitable for inspection.
- read-only blocking remains intact.

### 4. Playwright family presentation tightened

Files:
- `client/src/capabilityMatrix.json`
- `client/src/components/BlocksPanelContent.tsx`

Changes:
- read-oriented Playwright surfaces now carry `read_only` permission metadata (`extract_text`, `extract_links`, `get_elements`, `current_page`, `wait`, `screenshot`, legacy extract-links alias).
- mutating/session-changing Playwright surfaces remain `mixed` (`navigate`, `click`, `fill`, `scroll`, `keypress`).
- palette rows now show compact truth chips such as family / session / permission / config when present.

### 5. Optional live smoke-test scaffolding

File: `tests/test_v64_runtime_exercise_pass.py`

Added:
- compile-level assertions that the new runtime helpers are rendered into generated `tools.py`.
- a preflight test for invalid `GITHUB_REPOSITORY`.
- UI truth-chip coverage test.
- an optional Playwright generated-runtime smoke test gated by:
  - `LANGSUITE_ENABLE_LIVE_SMOKE=1`
  - installed `playwright`

The optional Playwright smoke uses a `data:` URL so it does not require external network access.

## Tests run

Command actually run:

```bash
pytest -q \
  tests/test_v64_runtime_exercise_pass.py \
  tests/test_v63_truthful_tool_surfaces.py \
  tests/test_v40_node_taxonomy_consistency.py \
  tests/test_v62_runner_isolation_and_dependencies.py \
  tests/test_v62_support_status_and_frontend_path.py \
  tests/test_v31_capability_matrix.py
```

Result:
- **23 passed**
- **1 skipped** (optional live smoke)

## Files changed

- `core/runtime_preflight.py`
- `templates/tools.py.jinja`
- `client/src/capabilityMatrix.json`
- `client/src/components/BlocksPanelContent.tsx`
- `tests/test_v64_runtime_exercise_pass.py`

## Remaining gaps

Still intentionally not done in this pass:
- live Tavily smoke execution against real credentials
- live GitHub smoke execution against real credentials/app config
- deeper Playwright family UI regrouping beyond compact truth chips
- SQL query rewriting or automatic LIMIT insertion
- any GitHub mutation/write surface

## Recommended next pass

A very small follow-up pass, only if credentials/runtime are available:

1. opt-in live Tavily smoke (`search` + `extract`);
2. opt-in live GitHub smoke on a known safe repo;
3. tiny UI copy pass for Playwright family wording in inspector/catalog;
4. maybe a narrow SQL result-preview enhancement, still read-only-first.
