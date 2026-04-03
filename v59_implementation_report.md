# v59 implementation report — group-based canonical subagent runtime pass

## Concise execution summary

I implemented the **group-based canonical subagent model** on top of the current LangSuite baseline.

What is now real:
- the **canonical subagent surface remains `tool_sub_agent`**
- the project-level **Subagent Library** remains the place where subagents are defined
- `tool_sub_agent` can now target:
  - one named subagent inside a group, or
  - an entire group in bounded dispatch mode
- the `sub_agent` node remains the more advanced **Agent Artifact** surface and is no longer treated as the canonical subagent tool
- the node editor now offers **library-backed selection** for group and agent instead of relying purely on free text
- compile/runtime generation now follows two LangChain-style patterns:
  - **tool-per-agent** when one subagent is selected
  - **single dispatch tool** when only a group is selected
- parent agent prompting is automatically enriched with **subagent usage hints** generated from the linked subagent tool(s)

What I did **not** do:
- no persistent subagent memory by default
- no full group scheduler / orchestration policy beyond bounded dispatch shape
- no ToolCallLimitMiddleware integration in the current runtime path
- no new competing subagent block types
- no broad multi-agent framework expansion

## What v59 targeted

- keep the product model simple and canonical
- avoid forcing users to choose between separate “group block” vs “agent block” types
- support the practical model where **a group of 1 already covers the simple case**
- align LangSuite more closely with LangChain subagent patterns without reopening the whole runtime architecture

## What was inspected first

I inspected:
- `client/src/nodeConfig.ts`
- `client/src/components/CustomNode.tsx`
- `client/src/components/StatePanelContent.tsx`
- `client/src/components/CapabilityInspectorSection.tsx`
- `core/schemas.py`
- `templates/tools.py.jinja`
- `templates/nodes.py.jinja`
- existing v58 tests and the current subagent library data model

The key reality check was:
- the library model was already present,
- the canonical surface was already recentered on `tool_sub_agent`,
- but the block still relied on free-text `group + agent`, and runtime generation only really handled the direct subagent case cleanly.

## Canonical subagent contract

For LangSuite, the canonical meaning of a subagent remains:

> a LangChain-style **agent used as a tool** by a parent agent,
> configured in a **project-level Subagent Library**,
> and **ephemeral by default** (no independent persistent memory by default).

### Canonical usage model

- the **library** defines subagents
- the **canvas block** uses them

### Library entries
Each subagent definition preserves:
- `groupName`
- `agentName`
- `systemPrompt`
- `tools`
- `description`

### Block parameters
The canonical `tool_sub_agent` block now supports:
- `target_group` (required in practice; defaults to `default`)
- `target_agent` (optional)
- `max_invocations`
- `allow_repeat`

### Runtime meaning
- when `target_agent` is set → direct single-subagent wrapper
- when `target_agent` is empty → bounded dispatch wrapper over the selected group

This makes **group** the canonical base model, while still supporting the simple case with a group of 1.

## Library / block model changes

### UI changes

#### `tool_sub_agent`
- `target_agent` is no longer treated as mandatory in the UI
- the block now uses **library-backed assisted selection** instead of only free-text fields
- the user can choose:
  - a group,
  - and optionally one agent in that group
- leaving the agent empty enables **group dispatch**

#### Custom node editing
A dedicated selector component now powers the `tool_sub_agent` fields:
- group selection comes from the current project’s Subagent Library
- agent selection is filtered by the selected group
- a visible option allows **group dispatch**
- changing groups clears invalid stale agent selections automatically

#### Inspector / state panel copy
The product text now explains more clearly that:
- the block can target one group and optionally one agent
- leaving the agent empty enables bounded dispatch
- the Subagent Library remains the source of truth

## Persistence / reopen / compile-run changes

### Validation changes
`core/schemas.py` now treats `sub_agent_tool` as valid when it has:
- a `target_group`, or
- a `target_agent`, or
- the legacy `target_subgraph`

This keeps compatibility while allowing canonical group-based dispatch.

### Tool generation changes
`templates/tools.py.jinja` now generates two runtime forms for `sub_agent_tool`:

#### 1. Direct subagent wrapper
Signature:
- `tool_sub_agent(query: str) -> str`

Behavior:
- resolve one named agent in the selected group
- build a bounded LangChain agent with its configured prompt + tools
- invoke it directly
- return the final content

#### 2. Group dispatch wrapper
Signature:
- `tool_sub_agent(agent_name: str, description: str) -> str`

Behavior:
- resolve a named agent inside the selected group
- dispatch the task description to that agent
- return the final content
- reject unknown agent names with a clear error containing available agents

### Parent-agent prompt enrichment
`templates/nodes.py.jinja` now injects **subagent tool hints** into the system prompt for LLM/agent nodes that have linked subagent tools.

These hints include:
- whether the tool targets one agent or dispatches over a group
- the available agents in the group
- max invocation / repeat guidance metadata

This matches the product goal that **placing a subagent tool should be enough to generate the usage guidance**, instead of forcing the user to hand-author all of it in the parent prompt.

## UI truth changes

The UI now tells a more faithful story:
- canonical subagent = **tool_sub_agent**
- library = place of definition
- block = place of usage
- group is the base concept
- group-of-1 is a valid simple case
- agent selection is optional, not mandatory
- no persistent subagent memory is implied by default

## Validation performed

Executed successfully:

- `python -m py_compile core/*.py api/*.py main.py`
- `pytest -q tests/test_v58_canonical_subagent_model.py tests/test_v59_group_subagent_runtime.py tests/backend_session_workspace_smoke.py tests/project_tree_hidden_child_smoke.py`
- `cd client && npm ci`
- `cd client && npm run build`

Results:
- backend Python compile: **passed**
- targeted regression/API suite: **5 passed**
- frontend build: **passed**

I did **not** claim a fresh browser/manual smoke pass for this iteration.

## What became more real

- the **group-based canonical model** is now real in the product
- library-backed selection replaced the weaker text-only story for the subagent block
- group dispatch is now compiled/runtime-generated in a bounded way
- parent agent prompting is more automatic and less brittle
- the distinction between **canonical subagent tool** and **agent artifact** is stronger

## What remains bounded / deferred

Still bounded:
- no persistent subagent memory by default
- no full middleware-backed call-limit enforcement in the current runtime path
- no async background subagent job model
- no advanced group scheduling beyond “choose one named agent from the group”
- no dynamic discovery tool separate from the subagent tool itself

## Why ToolCallLimitMiddleware was not integrated yet

LangChain does provide `ToolCallLimitMiddleware`, which can enforce run-level and thread-level tool call limits in agent execution. However, the current LangSuite runtime path for graph-authored LLM/agent nodes is still based on **model binding + ToolNode orchestration**, not on a full `create_agent(..., middleware=[...])` stack for the parent agent. So I did **not** bolt middleware onto this pass in a half-real way.

That should be considered later if the parent-agent runtime surface itself moves closer to the LangChain agent middleware model. citeturn641171search1turn641171search6

## Recommended v60 direction

The clean next move is:

**v60 — subagent library UX refinement + prompt/runtime limits pass**

with likely priorities:
1. make the Subagent Library more comfortable to edit (rename, duplicate, reorder, discoverability)
2. expose group-of-1 and dispatch semantics more elegantly in insertion surfaces
3. decide whether parent-agent subagent usage limits should remain prompt guidance only, or whether the runtime is ready for a bounded middleware-backed enforcement path

This pass makes the subagent model cleaner and more canonical without reopening the rest of the architecture.
