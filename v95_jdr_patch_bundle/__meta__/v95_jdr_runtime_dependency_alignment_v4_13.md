# v4.13 — Runtime dependency alignment pass

## Goal
Make runtime dependency declaration, runtime dependency detection, and generated runtime imports agree with each other.

## Files changed
- `core/runtime_dependencies.py`
- `core/compiler.py`
- `templates/requirements.txt.jinja`
- `requirements.txt`
- `tests/test_v96_runtime_dependency_alignment.py`

## What changed
- Added shared runtime requirement spec generation in `core/runtime_dependencies.py`.
- Added explicit runtime dependency detection for:
  - `requests` as a generated tools runtime base requirement
  - `langgraph-checkpoint` whenever checkpoint-backed runtime is actually used
  - `langgraph-checkpoint-sqlite` and `aiosqlite` for async SQLite checkpoint graphs
  - `tenacity` when authored retries are enabled
  - `pydantic` when structured output schemas are authored
- Switched generated `requirements.txt` to render from the same runtime dependency collector used by runtime preflight.
- Updated root `requirements.txt` so the local LangSuite environment installs:
  - checkpoint support
  - `requests`
  - selectable provider runtime packages already exposed by the product surface
- Added a focused regression file locking:
  - checkpoint requirement detection
  - SQLite checkpoint requirement detection
  - JDR generated requirements alignment
  - root requirements coverage for core runtime/provider packages

## Functional effect
- Generated imports, generated requirements, and runtime dependency blocking now agree for the JDR starter and for checkpoint-backed authored graphs.
- The JDR starter's generated runtime now declares `langgraph-checkpoint` when it imports `MemorySaver`.
- In-app runtime dependency blocking now reports the same checkpoint/runtime packages the generated runtime actually needs.
