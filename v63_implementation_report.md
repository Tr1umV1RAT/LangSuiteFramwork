# LangSuite v63 — truthful tool/provider integration corrective pass

## 1. Executive summary

This pass keeps the existing LangGraph-centered trunk intact and makes a small number of tool/provider surfaces more truthful and more coherent.

Implemented outcomes:

- Tavily Search is now explicitly Tavily-backed in UI semantics, export/hydration, runtime preflight, generated runtime code, and generated requirements.
- Tavily Extract was added as a distinct sibling surface rather than being hidden inside search semantics.
- Playwright surfaces were not flattened into a fake generic web layer. They are now marked as a browser interaction family with shared session semantics, and the legacy duplicate link-extraction surface is hidden from the palette while kept for compatibility.
- SQL was expanded into a small read-only-first family: query, list tables, get schema, query check.
- GitHub read-first surfaces were added as advanced provider-backed toolkit members: get issue, get pull request, read file, search issues/PRs.
- Backend preflight is now truthful at two levels:
  - dependency preflight (missing packages/modules),
  - runtime/config preflight (missing env vars, unsafe SQL mode, invalid DB config).

The center of gravity remains unchanged:

- one canonical capability matrix,
- one editor/export/hydration path,
- one generated runtime template,
- and one LangGraph-first compile/runtime trunk.

## 2. Actual repository findings before implementation

The repository already had the right structural seams for a disciplined pass:

- Canonical semantic source of truth already existed in `client/src/capabilityMatrix.json`.
- Runtime metadata typing and capability helpers already existed in `client/src/capabilities.ts` and `client/src/catalog.ts`.
- Tool node definitions already existed in `client/src/nodeConfig.ts`.
- Tool export and artifact hydration already existed in `client/src/store.ts` and `client/src/store/artifactHydration.ts`.
- Generated runtime code already existed in `templates/tools.py.jinja` and `templates/requirements.txt.jinja`.
- Dependency preflight already existed in `core/runtime_dependencies.py`.
- The websocket runner already had a pre-build dependency failure path in `api/runner.py`.

Main truth gaps found in the codebase before patching:

1. `tool_web_search` was semantically generic in the UI even though the generated runtime was specifically Tavily-backed.
2. Tavily Extract did not exist as an explicit sibling surface.
3. Playwright existed as many separate browser tools, including a legacy duplicate link extractor, but without compact semantic exposure of session-backed behavior.
4. SQL existed mainly as a query surface with only partial read-only protection and without a small truthful family model.
5. GitHub read surfaces did not exist.
6. Dependency preflight was keyed mainly to UI node names, while exported tool payloads use canonical tool types. This meant preflight could miss real runtime requirements for exported tools.
7. There was no explicit runtime/config preflight category for missing provider configuration or unsafe SQL mode.

## 3. Implementation plan grounded in the repo

The pass was executed in the smallest coherent path already implied by the repository:

1. Fix runtime dependency detection so exported canonical tool types are checked, not only UI node names.
2. Add a second preflight layer for configuration truth.
3. Extend the capability matrix and UI metadata instead of introducing a parallel truth system.
4. Add only the requested surfaces to node definitions + export/hydration.
5. Keep Playwright as a session-backed browser family rather than pretending it is stateless fetch/search.
6. Extend the generated tool runtime and generated requirements in place.
7. Add focused tests that lock the new truth into metadata, runtime preflight, compile output, and visible UI semantics.

## 4. Concrete changes made

### Backend / runtime

#### `core/runtime_dependencies.py`

- Added canonical exported tool type coverage for runtime dependency checks.
- Added dependency coverage for:
  - `web_search`
  - `tavily_extract`
  - `sql_query`, `sql_list_tables`, `sql_get_schema`, `sql_query_check`
  - Playwright tool family canonical types
  - `github_get_issue`, `github_get_pull_request`, `github_read_file`, `github_search_issues_prs`
- Added `pygithub` / `github` module dependency detection for GitHub toolkit surfaces.
- Added `langchain_tavily` dependency detection for Tavily provider-backed surfaces.

#### `core/runtime_preflight.py` (new)

Added a dedicated runtime/config preflight layer that reports categorized issues for:

- missing Tavily API key env var,
- missing GitHub env configuration,
- missing/invalid SQL DB path,
- `read_only=false` on `sql_query` in this read-only-first pass.

#### `api/runner.py`

- Kept the existing dependency preflight stage.
- Added a new `runtime_preflight` stage before build/execution.
- Returns explicit categorized issues instead of misleading partial success.

#### `core/compiler.py`

- Added compiled tool type collection.
- Added context flags:
  - `has_tavily`
  - `has_github`
- Kept `has_playwright` and existing trunk logic intact.

#### `core/schemas.py`

- Extended tool schema support for:
  - `tavily_extract`
  - `sql_list_tables`
  - `sql_get_schema`
  - `sql_query_check`
  - GitHub read tool family
- Added tool params support for:
  - `extract_depth`
  - `include_images`
  - `read_only`
- Added read-only/default normalization and Tavily default normalization.

### Generated runtime

#### `templates/requirements.txt.jinja`

- Removed unconditional Tavily package assumption.
- Added conditional requirements generation for:
  - `langchain-tavily`
  - `pygithub`
  - Playwright stack remains conditional on Playwright usage.

#### `templates/tools.py.jinja`

Added / improved generated runtime helpers and tool implementations:

- SQL helpers:
  - `_normalize_sqlite_target`
  - `_sql_read_only_guard`
  - `_parse_list_argument`
- GitHub toolkit helpers:
  - `_load_github_tool`
  - `_invoke_sync_tool`

Implemented or improved runtime surfaces:

- `web_search`
  - explicit Tavily-backed semantics,
  - explicit missing-env failure,
  - structured JSON output.
- `tavily_extract`
  - distinct sibling tool,
  - URL-based extraction semantics,
  - explicit missing-env failure,
  - structured JSON output.
- `sql_query`
  - read-only-first enforcement,
  - explicit blocking of `read_only=false`,
  - explicit multi-statement / unsafe query rejection.
- `sql_list_tables`
- `sql_get_schema`
- `sql_query_check`
- GitHub read-first toolkit members:
  - `github_get_issue`
  - `github_get_pull_request`
  - `github_read_file`
  - `github_search_issues_prs`

### UI / product semantics

#### `client/src/capabilities.ts`

Extended `NodeRuntimeMeta` with compact truthful metadata fields:

- `providerBacked`
- `providerKind`
- `providerLabel`
- `toolkitBacked`
- `toolFamily`
- `toolFamilyLabel`
- `sessionBacked`
- `statefulness`
- `permissionLevel`
- `configRequired`

#### `client/src/capabilityMatrix.json`

Updated/added truthful metadata for:

- Tavily Search
- Tavily Extract
- SQL family members
- GitHub read family members
- Playwright family members

Also:

- added new surfaces to runtime-backed node types,
- hid `tool_playwright_extract_links` from the palette as a legacy compatibility surface.

#### `client/src/nodeConfig.ts`

Added new node definitions:

- `tool_tavily_extract`
- `tool_sql_list_tables`
- `tool_sql_get_schema`
- `tool_sql_query_check`
- `tool_github_get_issue`
- `tool_github_get_pull_request`
- `tool_github_read_file`
- `tool_github_search_issues_prs`

Updated existing node definitions:

- `tool_web_search` label changed from generic `Web Search` to `Tavily Search`.
- `tool_sql_query` now exposes `read_only` mode explicitly.
- legacy Playwright duplicate surface now reads as legacy in the editor.

#### `client/src/store.ts`

- Added export mapping for all new node types.
- Added correct canonical tool type export.
- Added parameter export for Tavily Extract and SQL read-only semantics.
- Mapped legacy Playwright duplicate export to canonical `pw_extract_links`.

#### `client/src/store/artifactHydration.ts`

- Added hydration mapping for the new canonical tool types.
- Added parameter hydration for Tavily Extract and SQL read-only semantics.
- Kept legacy hydration compatibility.

#### `client/src/components/CapabilityInspectorSection.tsx`

Added visible compact semantics rows for:

- Provider
- Tool family
- Statefulness
- Permission
- Config required
- Session-backed

#### `client/src/components/CustomNode.tsx`

Added compact truth chips on node cards to expose key semantic differences without bloating the UI.

#### `client/src/components/BlocksPanelContent.tsx`

Updated quick help text so `tool_web_search` is described as Tavily-backed rather than generic.

## 5. Tests added/updated

### Added

#### `tests/test_v63_truthful_tool_surfaces.py`

Covers:

- capability matrix truth for provider/toolkit/session/read-only/config metadata,
- dependency preflight for canonical exported tool types,
- runtime/config preflight for missing Tavily/GitHub env and unsafe SQL mode,
- runner behavior for truthful runtime preflight,
- compile path generation for Tavily/SQL/GitHub/Playwright surfaces,
- frontend presence of key truthful labels.

### Reused / rerun regression tests

- `tests/test_v31_capability_matrix.py`
- `tests/test_v40_node_taxonomy_consistency.py`
- `tests/test_v62_runner_isolation_and_dependencies.py`
- `tests/test_v62_support_status_and_frontend_path.py`

## 6. Test results actually run

Commands run:

```bash
pytest -q tests/test_v63_truthful_tool_surfaces.py \
         tests/test_v40_node_taxonomy_consistency.py \
         tests/test_v62_runner_isolation_and_dependencies.py \
         tests/test_v62_support_status_and_frontend_path.py

pytest -q tests/test_v31_capability_matrix.py
```

Observed result:

- 16 tests passed in the first grouped run.
- 3 tests passed in the capability matrix regression run.
- Total explicitly run in this pass: 19 passing tests.

Notes:

- One initial generated-template syntax issue in `tools.py.jinja` was caught by compile validation and fixed before final packaging.
- No claim is made here that real Tavily/GitHub/Playwright live calls succeeded in this environment; this pass verifies truthful compile/preflight behavior and generated runtime integrity.

## 7. Remaining gaps / known limitations

### Completed but environment-dependent at runtime

- Tavily Search / Tavily Extract require valid Tavily configuration at runtime.
- GitHub read tools require valid GitHub env configuration at runtime.
- Playwright still depends on an installed browser runtime in the execution environment.

### Intentionally deferred

- No Gmail / Google Drive / Composio / heavy OAuth expansion.
- No GitHub mutation/write tools.
- No SQL write mode.
- No broad provider explosion.
- No fake “unified super-tool” abstraction.

### Honest limitations of this pass

- GitHub toolkit invocation is implemented as read-first wrapper logic around toolkit members and may still need a future pass for stricter per-tool input normalization once a real configured runtime is exercised against the installed LangChain version.
- SQL query checking is policy/read-only validation, not a full LLM-assisted SQL generation/checker workflow.
- Playwright consolidation in this pass is semantic/catalog-level and canonical-export-level; it does not redesign the whole browser authoring UX.

## 8. Recommended next pass

Best next pass:

1. **Runtime exercise / fixture pass**
   - add optional integration tests or smoke harnesses for Tavily, GitHub, SQL, and Playwright when credentials/dependencies exist.

2. **Playwright coherence pass**
   - tighten palette grouping and inspector wording further,
   - optionally unify Playwright and PlaywrightLG presentation into one visible family while keeping honest compatibility aliases.

3. **GitHub input hardening pass**
   - validate per-tool input shapes more explicitly,
   - expose repository/config hints more clearly in the inspector.

4. **SQL ergonomics pass**
   - improve schema/query-check interplay,
   - possibly add explicit “query generation” only if it can be represented truthfully and separately from execution.

## 9. Final artifact list

### Modified files

- `api/runner.py`
- `core/compiler.py`
- `core/runtime_dependencies.py`
- `core/runtime_preflight.py`
- `core/schemas.py`
- `templates/requirements.txt.jinja`
- `templates/tools.py.jinja`
- `client/src/capabilityMatrix.json`
- `client/src/capabilities.ts`
- `client/src/nodeConfig.ts`
- `client/src/store.ts`
- `client/src/store/artifactHydration.ts`
- `client/src/components/CapabilityInspectorSection.tsx`
- `client/src/components/CustomNode.tsx`
- `client/src/components/BlocksPanelContent.tsx`
- `tests/test_v63_truthful_tool_surfaces.py`

### Generated deliverables

- updated project archive
- this implementation report
- short handoff markdown
