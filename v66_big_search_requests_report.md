# LangSuite v66 — Brave / DuckDuckGo / Requests big pass

## Executive summary

This pass adds three high-yield web/tool families to the existing truthful tooling model without flattening them into one fake abstraction:

- **Brave Search** — provider-backed, stateless, read-only search surface
- **DuckDuckGo Search** — provider-backed, stateless, read-only search surface
- **Requests toolkit** — stateless HTTP toolkit family with explicit GET vs POST separation

The pass was implemented through the repo's existing seams rather than a rewrite:

- capability matrix / UI semantics
- node definitions
- export + hydration
- schema validation
- runtime dependency detection
- runtime preflight
- generated runtime code
- generated requirements
- tests

## Repository findings that shaped the implementation

The repo already had the right pattern for this extension:

- provider-backed single-tool surfaces already existed (`tool_web_search`, `tool_tavily_extract`)
- toolkit-backed stateful family semantics already existed for Playwright
- read-only family semantics already existed for SQL
- author-linked tool semantics were already explicit for `llm_chat` / `react_agent`

So this pass extended those patterns instead of inventing a second abstraction system.

## Concrete changes made

### Backend/runtime

- `core/compiler.py`
  - added compile-context detection for:
    - `has_brave`
    - `has_duckduckgo`
    - `has_requests_toolkit`

- `core/runtime_dependencies.py`
  - added canonical tool-type coverage for:
    - `brave_search`
    - `duckduckgo_search`
    - `requests_get`
    - `requests_post`
  - maps dependency expectations to:
    - `requests`
    - `duckduckgo-search`
    - `langchain-community` (for DDG fallback path)

- `core/runtime_preflight.py`
  - added Brave preflight for missing `BRAVE_SEARCH_API_KEY`
  - added Requests preflight for unscoped tools that have neither `base_url` nor `allow_full_urls=true`

- `core/schemas.py`
  - added GraphTool type validation support for:
    - `brave_search`
    - `duckduckgo_search`
    - `requests_get`
    - `requests_post`

### Generated runtime

- `templates/requirements.txt.jinja`
  - added explicit `requests>=2.31.0`
  - added conditional `duckduckgo-search>=8.1.1`

- `templates/tools.py.jinja`
  - added helper functions:
    - `_parse_json_object_arg`
    - `_normalize_timeout`
    - `_resolve_requests_target`
    - `_requests_preview_payload`
    - `_extract_brave_web_results`
  - added generated runtime tool surfaces for:
    - `brave_search`
    - `duckduckgo_search`
    - `requests_get`
    - `requests_post`
  - implementation choices:
    - Brave uses a direct provider HTTP adapter to the Brave Search API endpoint
    - DuckDuckGo prefers `duckduckgo_search.DDGS` with LangChain community fallback
    - Requests GET/POST preserve stateless HTTP semantics and do not pretend to be browser/session tools

### Frontend / product model

- `client/src/capabilityMatrix.json`
  - added truthful metadata for:
    - `tool_brave_search`
    - `tool_duckduckgo_search`
    - `tool_requests_get`
    - `tool_requests_post`

- `client/src/nodeConfig.ts`
  - added nodes:
    - `Brave Search`
    - `DuckDuckGo Search`
    - `Requests GET`
    - `Requests POST`

- `client/src/store.ts`
  - added export mappings to canonical tool types
  - added parameter export handling for all four surfaces

- `client/src/store/artifactHydration.ts`
  - added reverse mappings and parameter hydration for all four surfaces

- `client/src/components/BlocksPanelContent.tsx`
  - added concise palette descriptions for the new surfaces

## Truthfulness decisions

### Brave Search

Treated as:

- provider-backed
- stateless
- read-only
- config-required
- single-tool surface

### DuckDuckGo Search

Treated as:

- provider-backed
- stateless
- read-only
- no API-key configuration required
- single-tool surface

### Requests toolkit

Treated as:

- toolkit-backed
- stateless
- non-browser / non-session
- author-scoped HTTP surface
- split into GET vs POST instead of one fake neutral HTTP action

This is deliberate: GET and POST are not semantically identical, and Requests is not a browser/session family.

## Tests added

- `tests/test_v66_search_and_requests_tools.py`

Coverage includes:

- capability matrix truth for the new surfaces
- runtime dependency detection for canonical exported tool types
- runtime preflight for missing Brave config and unscoped Requests tools
- compile rendering for generated runtime + requirements
- frontend wiring across node config / export / hydration / palette copy

## Regression fixes during the pass

Two implementation regressions were caught and corrected during the pass:

1. **GraphTool schema validator** initially rejected the new canonical tool types
2. **Generated tools template** accidentally duplicated helper insertion inside the active-tools registry, producing invalid Python

Both were fixed before packaging.

## Tests actually run

### Run 1

`pytest -q tests/test_v66_search_and_requests_tools.py tests/test_v65_authored_tool_semantics.py tests/test_v64_runtime_exercise_pass.py tests/test_v63_truthful_tool_surfaces.py`

Result:
- **18 passed**
- **1 skipped**

### Run 2

`pytest -q tests/test_v31_capability_matrix.py tests/test_v40_node_taxonomy_consistency.py tests/test_v62_runner_isolation_and_dependencies.py tests/test_v62_support_status_and_frontend_path.py tests/test_v66_search_and_requests_tools.py`

Result:
- **18 passed**

## Remaining limitations

- Brave runtime success still depends on a valid Brave Search API key at execution time
- DuckDuckGo runtime success still depends on the installed `duckduckgo-search` package and the external search path behaving normally at runtime
- Requests GET/POST currently support author-configured headers, base URL scoping, and optional full-URL allowance, but do not yet expose richer method families like PUT/DELETE

## Recommended next pass

Best next pass after this one:

- **filesystem / glob / grep family**
- or **OpenAPI / API introspection family**

Both would extend utility without jumping immediately into heavy OAuth ecosystems.

## Final artifact list

Changed files:

- `client/src/capabilityMatrix.json`
- `client/src/nodeConfig.ts`
- `client/src/store.ts`
- `client/src/store/artifactHydration.ts`
- `client/src/components/BlocksPanelContent.tsx`
- `core/compiler.py`
- `core/runtime_dependencies.py`
- `core/runtime_preflight.py`
- `core/schemas.py`
- `templates/requirements.txt.jinja`
- `templates/tools.py.jinja`
- `tests/test_v66_search_and_requests_tools.py`
