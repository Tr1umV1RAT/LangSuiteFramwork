# Handoff Memo v15

## Baseline
Continue from the merged v15 archive produced from:
- v14 as trunk
- selected conceptual/UI recoveries from v13

## What changed in v15
- Restored a dedicated conceptual abstraction catalog in `client/src/catalog.ts`.
- Reintroduced Deep Agents vocabulary blocks as honest semantic/editor aliases:
  - `deep_agent_suite`
  - `deep_subagent_worker`
  - `deep_memory_skill`
- Improved palette readability with grouping/filtering by abstraction compatibility.
- Improved node readability with explicit badges for origin / placement / flavor / compatibility.
- Advanced the artifact library so artifacts can be inserted as wrapper nodes into the current graph.
- Added built-in `deep_agent_suite_starter` in the filesystem registry.
- Added compile-safe canonicalization and backend schema aliases.

## Current truth you must preserve
- The runtime is still primarily **LangGraph-centric**.
- `langchain_agent` and `deepagents` are still mostly higher-level editor/runtime-profile abstractions.
- Do not market the semantic vocabulary as proof of separate native runtimes.

## Key compatibility aliases
- `deep_agent_suite -> sub_agent`
- `deep_memory_skill -> memory_store_read`
- `deep_subagent_worker -> tool_llm_worker`

## What worked well
- The conceptual layer now sits on top of v14’s stronger project shell without splitting the product.
- Save/load/compile/collaboration all tolerate the new semantic surface.
- Wrapper insertion is now a real user flow rather than a hand-wavy idea.

## Remaining limits
- Wrapper contracts are still implicit in params rather than formalized as first-class interfaces/manifests.
- Binding inheritance is still stronger in export/bootstrap than in fully dynamic runtime semantics.
- Collaboration is still effectively last-writer-wins.
- No real provider-backed runtime validation was possible.

## Best next moves
1. Formalize wrapper contracts:
   - transparent / semi-opaque / opaque
   - expected inputs / outputs / tools exposure
2. Push scope-level bindings and execution parameters deeper into generated runtime behavior.
3. Make supergraph readiness more explicit in schema/compiler/runtime adapters.
4. Extend starter artifacts only after contracts are clearer.
5. Do manual browser QA for palette ergonomics and wrapper UX.

## Caution
- Do not silently remove the conceptual layer because the runtime is not fully there yet.
- Do not invent native runtime claims for Deep Agents or LangChain agents.
- Keep the distinction clear between:
  - editor vocabulary
  - compile aliases
  - real execution semantics
