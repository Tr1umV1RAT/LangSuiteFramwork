# Runtime Profile Matrix (v15 snapshot)

## Profiles in the editor

| Profile | Current status | Execution truth today | Notes |
|---|---|---|---|
| `langgraph_sync` | real/editor-visible | LangGraph-oriented | synchronous flavor/defaults |
| `langgraph_async` | real/editor-visible | LangGraph-oriented | asynchronous flavor/defaults |
| `langchain_agent` | partial/editor-visible | layered through current pipeline | useful as abstraction/profile, not yet separate engine |
| `deepagents` | partial/editor-visible | layered through current pipeline | semantic profile with explicit aliases |

## Canonical aliasing in v15

| Surface node type | Canonical compile type |
|---|---|
| `deep_agent_suite` | `sub_agent` |
| `deep_memory_skill` | `memory_store_read` |
| `deep_subagent_worker` | `tool_llm_worker` |

## Practical meaning
- The editor can expose profiles richer than the runtime implementation.
- The compile path must therefore keep canonicalization explicit and documented.
- Presence of a profile must not be misread as proof of a fully separate runtime adapter.
