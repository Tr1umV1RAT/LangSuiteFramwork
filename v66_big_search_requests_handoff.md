# v66 handoff — Brave / DuckDuckGo / Requests

## What landed

New truthful tool surfaces:

- `tool_brave_search` -> `brave_search`
- `tool_duckduckgo_search` -> `duckduckgo_search`
- `tool_requests_get` -> `requests_get`
- `tool_requests_post` -> `requests_post`

## Product semantics

- Brave: provider-backed, config-required, read-only, stateless
- DuckDuckGo: provider-backed, no API-key setup, read-only, stateless
- Requests GET: toolkit-backed, stateless, read-only HTTP surface
- Requests POST: toolkit-backed, stateless, mutating HTTP surface

## Important runtime notes

- Brave uses direct HTTP against the Brave Search API endpoint
- DuckDuckGo prefers `duckduckgo_search.DDGS`, with LangChain community fallback
- Requests tools enforce author scoping via:
  - `base_url`, or
  - explicit `allow_full_urls=true`

## Key preflight behavior

- missing Brave env -> `missing_brave_api_key`
- Requests without base_url and without `allow_full_urls=true` -> `requests_target_not_configured`

## Good next pass

Best next families now:

1. filesystem / glob / grep
2. OpenAPI / API introspection
3. reference/research tools
