# LangSuite v63 handoff

## What is truly real after this pass

- Tavily Search is no longer presented as generic search; it is explicitly Tavily-backed across metadata, export, preflight, runtime, and requirements.
- Tavily Extract exists as a distinct sibling surface.
- SQL is now a small read-only-first family.
- GitHub read-first toolkit surfaces exist as advanced provider-backed members.
- Playwright remains a browser-session family; the legacy duplicate link extractor is hidden from the palette but still supported for compatibility.
- Preflight is now split between dependency truth and runtime/config truth.

## Most important architectural correction

The key corrective fix is in `core/runtime_dependencies.py`:
preflight now understands canonical exported tool types, not only UI node names.
That removes a hidden falsehood in the previous dependency-validation path.

## Files to inspect first in a future pass

1. `core/runtime_preflight.py`
2. `core/runtime_dependencies.py`
3. `templates/tools.py.jinja`
4. `client/src/capabilityMatrix.json`
5. `client/src/nodeConfig.ts`
6. `client/src/store.ts`
7. `tests/test_v63_truthful_tool_surfaces.py`

## Best next move

Do a runtime exercise pass with optional real credentials/dependencies, not a new architecture pass.
The current weak point is no longer semantics; it is live environment coverage.
