# Handoff Memo v13

## Baseline
Continue from `frameworklangchain_repaired_audit_v13.zip`.

## What changed
- `graphBindings` now begin to affect generated runtime bootstrap via generated `state.py` and `graph.py`.
- The editor/store now has first-class:
  - `artifactType`
  - `executionProfile`
  - `runtimeSettings`
- Collaboration and persistence now carry those concepts.
- The state panel is now also an execution-parameter panel.
- Runner now consumes some of the new runtime settings and bootstraps inputs via generated state helpers.

## What is still intentionally incomplete
- Only LangGraph generation/runtime is truly implemented.
- `langchain_agent` and `deepagents` are currently product/editor profile groundwork, not full alternate runtimes.
- Binding inheritance is still resolved shallowly at export/compile time.
- No manual browser QA has been done.
- No true live LangGraph execution test was possible here because required libs are not installed in this environment.

## Best next moves
1. Manual browser QA of:
   - artifact/profile switching
   - runtime settings editing
   - graph binding editing
   - save/load/collab after those edits
2. Decide how far `artifactType` should influence available node palettes in the current single UI.
3. Introduce a lightweight artifact creation flow:
   - empty graph/subgraph/agent/deep-agent tabs
   - 1–2 starter presets at most
4. Decide whether `resolved_graph_bindings` should become a deeper inheritance model or stay an editor/export resolution step.
5. When a suitable environment exists, run a real live execution test with installed `langgraph` / `langchain*` packages.
