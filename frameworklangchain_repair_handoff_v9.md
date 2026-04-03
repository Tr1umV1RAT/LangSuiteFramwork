# FrameworkLangchain repair handoff v9

This pass started from the repaired v8 archive and pushed further on frontend/build validation and collaboration/store coherence.

## What was completed in v9
- performed a real frontend dependency install and production build (`npm ci`, `npm run build`)
- fixed concrete frontend TypeScript issues discovered by the real build:
  - React Flow `isValidConnection` typing
  - Lucide icon prop typing in multiple components
  - unsafe `params` spread in store
- added safer `getNodeParams(...)` helper in store
- fixed store coherence so more mutations mark tabs dirty and participate in autosave/collaboration sync:
  - add node
  - connect edge
  - update param
  - delete selected
  - set async mode
  - update custom state schema
- preserved current-tab `customStateSchema` and `projectName` when opening/switching tabs
- changed collaboration session creation to reuse existing `projectId` when available instead of always creating a new DB project
- collaboration init now stores `projectId` on the active tab
- websocket sync now carries/persists `projectName` in addition to `nodes` / `edges` / `customStateSchema` / `isAsync`
- validated generator distinction between:
  - auto tool-routing (`tools_execution` generated automatically)
  - explicit `tool_executor` (auto tool node suppressed)
- validated dependency matrix again for representative generated graphs
- validated websocket sync persistence of `projectName`, `customStateSchema`, and `isAsync` using FastAPI `TestClient`

## Important remaining caveats
- full interactive browser QA is still not done; build succeeds, but click-path behavior was not manually exercised here
- collaboration remains last-writer-wins
- runtime isolation still is not truly multi-worker safe because generated subgraph access relies on the process-global `graph` alias pattern
- `tool_executor` and auto-tool-routing still coexist as two semantics; this pass only validated that they remain distinct and non-duplicating in generation

## Best next pass
1. run browser-level manual QA on:
   - tab switching
   - loading/saving from DB
   - collaboration join/sync
   - compile after reload
2. perform a live websocket run against an environment with real LangGraph/LangChain/provider deps installed
3. decide whether `tool_executor` should remain a first-class explicit block long-term, or be deprecated/documented more aggressively
4. if concurrency matters, redesign generated subgraph loading to avoid reliance on the process-global `graph` alias
