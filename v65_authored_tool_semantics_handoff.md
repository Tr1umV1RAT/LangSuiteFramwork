# v65 handoff

## What changed

This pass makes the tool model explicit:

- tools are primarily provisioned by the circuit author;
- `llm_chat` / `react_agent` may only choose among the linked subset;
- `tool_executor` is the explicit author-visible tool step;
- tool surfaces themselves are no longer conflated with agent-wide/global access.

## Files changed

- `client/src/capabilities.ts`
- `client/src/capabilityMatrix.json`
- `client/src/components/CapabilityInspectorSection.tsx`
- `client/src/components/BlocksPanelContent.tsx`
- `client/src/components/CustomNode.tsx`
- `templates/nodes.py.jinja`
- `tests/test_v65_authored_tool_semantics.py`

## Key behavioral effect

Generated LLM/agent nodes with `tools_linked` now receive an explicit runtime tool contract in the system prompt stating that only author-linked tools are available.

## Suggested next pass

Move to multi-tool expansion by family:

- Brave / DuckDuckGo / Requests
- OpenAPI toolkit
- filesystem / glob / grep
- reference tools such as Wikipedia / ArXiv / PubMed

while preserving the authored-tool semantic contract introduced here.
