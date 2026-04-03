# LangSuite v61 composite pass

You are continuing LangSuite from the current v60 baseline.

This pass must do all of the following in one bounded iteration:

1. **Subagent runtime ergonomics + prompt/tool hint polish**
   - keep the canonical subagent model intact,
   - improve generated tool hints and parent-agent guidance,
   - do not add new subagent block types.

2. **Agnostic completeness audit**
   - inspect the current codebase as the primary source of truth,
   - produce a fresh completeness audit,
   - do not rely on conversation history as evidence.

3. **Select 3–5 useful blocks/surfaces from the official LangChain/LangGraph documentation**
   - prefer existing block types when that is enough,
   - otherwise add bounded new block types,
   - implement UI + backend + compilation + tests.

## Chosen direction for this pass

- refine existing: `tool_sub_agent`, `llm_chat`, `react_agent`
- add: `runtime_context_read`
- add: `structured_output_extract`
- add: `structured_output_router`

## Invariants
- keep LangGraph as orchestration trunk,
- keep LangChain mode/editor-only distinction as currently modeled,
- do not re-open subgraph/subagent ambiguity,
- do not introduce broad middleware/runtime frameworks,
- keep the pass bounded and testable.
