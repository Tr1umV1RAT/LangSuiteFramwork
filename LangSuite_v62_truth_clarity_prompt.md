# LangSuite v62 Truth-Clarity / Repro / Dependency / Isolation Pass Prompt

Treat the current repository as the only source of truth.
Do not re-expand fake runtimes.
Do not market unfinished rails as equivalent to the real trunk.

## Goal
Execute one disciplined pass that improves trust and operational clarity without changing the product's current center of gravity.

## Invariants to preserve
- The real compile/run trunk remains LangGraph-centered.
- LangChain and DeepAgents surfaces remain visible only to the extent the current repository truth supports them.
- Child subgraphs remain product abstractions over the trunk, not a second public runtime.
- Wrapper-backed, alias-backed, bridge-backed, embedded-native, and editor-only surfaces must remain explicitly distinguished.
- The pass must tighten truthfulness, not flatten distinctions.

## Required work

### 1. Add one explicit support-status taxonomy
Introduce one small status taxonomy that can be shown consistently in the UI and explained plainly:
- trunk runtime
- bridge-backed runtime
- editor-only
- alias-backed

Audit:
- Confirm the taxonomy does not contradict the existing capability matrix flags (`compileStrategy`, `adapterBacked`, `wrapperBacked`, `directCompile`, `directRun`, runtime-backed visibility).
- Do not invent a new runtime family.

Tests:
- Add a test that the shared matrix contains the taxonomy legend.
- Add a test that the catalog/inspector exposes the status labels.

### 2. Surface that status in the key UI truth surfaces
Show the support-status taxonomy in the capability inspector and in the main node/palette surfaces where users decide what a node really is.

Audit:
- Ensure the status badge is not presented as marketing copy.
- Ensure alias-backed surfaces do not appear as trunk-native.
- Ensure bridge-backed surfaces do not appear as editor-only.

Tests:
- Add a regression test that the inspector contains a support-status label path.

### 3. Re-align the UI wording with the matrix truth model
Use the new support-status wording to make the editor more explicit about what runs directly, what lowers through a bridge, and what remains only an editor/package surface.

Audit:
- Re-check the capability inspector wording and palette wording for drift.
- Keep the current honest language about semantic handles, wrapper references, and compiled graph relation.

Tests:
- Cover at least one file-level regression that the new wording exists where expected.

### 4. Add one reproducible frontend build/sync path inside the repo
Provide one explicit path that a maintainer can run to:
- install frontend deps when needed,
- typecheck/build the frontend,
- sync the built output into the backend-served `static/` directory.

Audit:
- Do not break existing Windows QA scripts.
- Keep `client/dist` available for browser-smoke expectations.
- The path should be callable from the repository itself.

Tests:
- Add a test that the package scripts exist.
- Add a test that the new repo-local helper can run in dry-run mode.

### 5. Add stricter runtime dependency preflight for LangChain/LangGraph surfaces
Before attempting runtime build/import, detect missing required runtime packages and fail with a staged, explicit dependency error.

Audit:
- Base graph runtime should preflight the core `langgraph` / `langchain` / `langchain-core` requirements.
- Optional surfaces should add optional dependency hints only when relevant (for example local RAG, Python REPL, SQL/web helpers, provider packages).
- The message must be more explicit than a generic import/build traceback.

Tests:
- Add a websocket/runtime test proving that missing packages fail at a dedicated dependency-preflight stage.

### 6. Harden runner isolation cleanup
Tighten the cleanup path so generated modules imported from a temporary compiled runtime cannot leak in `sys.modules` after cleanup.

Audit:
- Preserve the current lock-based containment story.
- Do not pretend multi-worker isolation is solved.
- Explicitly purge temporary generated modules from the extracted project directory during cleanup.

Tests:
- Add a regression test that cleanup removes a leaked temp-generated module and restores the prior `graph` alias.

### 7. Write the implementation report
Document:
- what was changed,
- what was actually tested here,
- what remains unverified due to missing environment/runtime dependencies.

## Deliverables
- Updated repository
- v62 implementation report
- This prompt saved in the repository
