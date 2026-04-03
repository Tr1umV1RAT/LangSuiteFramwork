# Handoff Memo v14

## Baseline
Continue from `frameworklangchain_repaired_audit_v14.zip`.

## What changed
- Introduced a real filesystem-backed artifact registry.
- Added starter manifests for graph/subgraph/agent/deep-agent families.
- Blocks panel now reads artifact starters from the registry.
- State panel can publish the current artifact back to the registry.
- Recursive binding inheritance now resolves across ancestor tabs.
- Compile payload UI context includes scope lineage and supergraph scope.
- Runner/debug surfaces now expose scope/profile metadata more clearly.

## What is still intentionally incomplete
- `langchain_agent` and `deepagents` are still profile families, not full alternate execution engines.
- Runtime inheritance remains bootstrap-oriented.
- No manual browser QA.
- No live package-backed LangGraph/LangChain/Deep Agents execution test in this environment.

## Best next moves
1. Add a lightweight “wrap artifact as node” flow so a saved subgraph/agent can be inserted into a parent graph with explicit metadata.
2. Decide which node categories should be filtered or emphasized by `artifactType` / `executionProfile`.
3. Push bindings/overrides deeper into generated runtime semantics if supergraph inheritance should become execution-truth, not only bootstrap truth.
4. Add artifact import/export metadata for transparent vs semi-opaque vs opaque wrappers.
5. When a runtime environment is available, validate real execution for LangGraph starters and then prototype a Deep Agents adapter.
