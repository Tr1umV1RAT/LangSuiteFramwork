# FrameworkLangchain repair handoff v10

This pass focused on runtime isolation/live-run control and compiler-input hardening.

## What was completed in v10
- added a process-local runner ownership lock in `api/runner.py`
- prevented concurrent websocket runs from silently swapping the generated global `graph` alias
- preserved runtime ownership across pause/resume
- made `stop` actually interrupt an active run by moving streaming into a background task and adding cancellation/cleanup logic
- strengthened `core/schemas.py` validation for:
  - safe `graph_id`
  - safe node/tool ids
  - safe state-schema field names/types
  - safe `structured_schema` field names/types
  - duplicate ids
  - unknown edge/router/tool/interruption references
- revalidated the frontend with `npm ci` + `npm run build` successfully
- cleaned up `client/src/store.ts` typing enough to keep the production build green in this environment

## Important remaining caveats
- the generated subgraph mechanism still fundamentally depends on `from graph import graphs`; v10 only contains that risk with a process-local lock
- because of that containment approach, only one active generated runtime may own the alias at a time per process
- collaboration is still last-writer-wins
- browser/manual click-path QA is still not done
- `tool_executor` vs auto-tool-routing still coexist semantically

## Best next pass
1. browser-level manual QA for:
   - tab switching
   - save/load/reload
   - collaboration join/sync
   - compile after reload
2. decide whether to expose the runner busy/serialized-runtime constraint explicitly in UI messaging
3. redesign subgraph access so generated runtimes do not depend on the process-global `graph` alias
4. revisit `tool_executor` vs auto-tool-routing with a documentation-first or deprecation-first strategy instead of silent coexistence
