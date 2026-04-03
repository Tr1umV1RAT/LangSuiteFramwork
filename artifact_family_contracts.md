# Artifact Family Contracts (v31)

## Purpose
This document defines what artifact families currently mean in the product **without overstating runtime reality**.

The canonical family/profile truth now lives in `client/src/capabilityMatrix.json` and is consumed by both the frontend and backend.

## Visible families

### `graph`
- Primary visible executable/editor surface.
- Natural fit for the current LangGraph compiler/runtime trunk.
- Can reference child subgraphs through wrapper nodes.

### `subgraph`
- Visible reusable child graph surface.
- Opened as a real child tab and compiled through the same current trunk.
- Not a peer runtime; it is a structural child unit.

## Hidden / internal families

### `agent`
- Retained for compatibility metadata, starter semantics, and future-facing architecture hooks.
- **Not** a separately earned visible runtime/editor mode.
- Can still appear in hidden artifact registry expansion or older payloads.

### `deep_agent`
- Retained for compatibility metadata and future-facing suite language.
- **Not** a separately earned visible runtime/editor mode.
- Current handling remains aliasing / normalization into the existing trunk where applicable.

## Execution profile truth

### Visible profiles
- `langgraph_sync`
- `langgraph_async`

### Hidden / compatibility-only profiles
- `langchain_agent`
- `deepagents`

Hidden profiles remain useful for compatibility metadata and architecture staging, but they are not marketed as peer runtimes in the current product surface.

## Wrapper terminology

### `sub_agent`
- Truthful visible wrapper node for child subgraphs and saved subgraph references.
- Hidden from direct palette insertion policy when necessary, but part of the real current trunk.

### `deep_agent_suite`, `deep_subagent_worker`, `deep_memory_skill`
- Internal / compatibility-oriented legacy surfaces.
- Kept to preserve future optionality and import tolerance.
- Not exposed as proof of a separate DeepAgents runtime.

## Honesty note
The codebase still contains useful future hooks, but the visible product story remains deliberately narrower:
- one real LangGraph-centered builder/runtime trunk,
- sync + async as the only earned visible execution profiles,
- subgraphs as real child/tabbed structural units,
- export/import truth limited to what has actually been validated.
