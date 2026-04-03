# LangSuite v65 — authored tool semantics pass

## Executive summary

This pass changes the direction of the next iteration in one important way:

- the default model is now treated as **circuit-author-provisioned tools**;
- optional model-side tool choice is represented only as **bounded choice among linked tools**;
- explicit `tool_executor` remains the visible workflow-step surface when the author wants tool execution shown as a first-class graph step.

This is not a speculative DeepAgent-style global tool-selection pass.
It is a truth-preserving clarification and runtime hardening pass for the model the repository already mostly had.

## Why this pass

The repository already supports tool linking on `llm_chat` / `react_agent` and explicit tool execution via `tool_executor`.
What was missing was a compact, truthful statement of:

1. who provisions tools,
2. who may choose among them,
3. what scope that choice has,
4. and how the result returns into the workflow.

## Repository findings that motivated the pass

- `tools_linked` already exists on authored nodes.
- Compile/runtime already synthesizes a tool loop when linked tools exist.
- `llm_chat` and `react_agent` already bind linked tools at runtime.
- `tool_executor` already exists as an explicit visible tool-step surface.

So the missing piece was **semantic contract clarity**, not a new tool architecture.

## Concrete changes made

### 1. Capability metadata extended

Added runtime metadata fields:

- `toolProvisioningModel`
- `toolSelectionAuthority`
- `toolAccessScope`
- `toolResultModel`

### 2. Capability matrix updated

Key node semantics now explicitly distinguish:

- `llm_chat` / `react_agent`
  - `author_linked`
  - `bounded_model_choice`
  - `linked_tools_only`
  - `tool_observation_loop`

- `tool_executor`
  - `explicit_step`
  - `runtime_step`
  - `explicit_tool_step`
  - `state_transition`

- concrete tool surfaces such as Tavily / SQL / GitHub / Playwright members
  - `tool_surface`
  - `not_applicable`
  - `single_tool_surface`
  - `returned_tool_payload`

### 3. UI truth surfaces updated

Updated:

- capability inspector
- palette truth chips
- node truth chips
- node semantic help text

New compact semantics now expose concepts like:

- `author-wired`
- `bounded-choice`
- `explicit-step`

The tools handle help text now explicitly states that only the linked subset is exposed to the node runtime and that no global tool access is implied.

### 4. Runtime prompt contract tightened

Generated `nodes.py` now inserts an explicit tool contract into the system prompt when linked tools exist:

- only tools explicitly linked by the workflow author are available;
- available linked tool names are surfaced;
- the model is told not to assume hidden/global/unlinked tools;
- if no linked tool fits, it should continue without inventing one.

This keeps runtime behavior aligned with the UI semantics.

## Tests added / updated

Added:

- `tests/test_v65_authored_tool_semantics.py`

It covers:

- capability matrix authored-tool fields,
- generated prompt contract for linked tools,
- UI strings / inspector fields / truth chips.

Regression tests rerun:

- `tests/test_v64_runtime_exercise_pass.py`
- `tests/test_v63_truthful_tool_surfaces.py`
- `tests/test_v40_node_taxonomy_consistency.py`
- `tests/test_v62_runner_isolation_and_dependencies.py`
- `tests/test_v31_capability_matrix.py`

## Test results actually run

- `22 passed`
- `1 skipped` (optional live smoke)

## Remaining limits

This pass does **not** implement:

- global autonomous tool discovery,
- DeepAgent-specific runtime semantics,
- internal LLM-tool orchestration surfaces,
- new provider families.

It intentionally keeps the current LangSuite center of gravity:

- author-linked tools,
- bounded runtime tool choice where supported,
- explicit tool-step surface when desired.

## Recommended next pass

Now that tool semantics are cleaner, the next pass can safely broaden the tool surface.

Best next expansion options:

1. search/fetch bundle — Brave, DuckDuckGo, Requests
2. API bundle — OpenAPI toolkit + requests-style API calling
3. workspace bundle — filesystem/glob/grep read-first surfaces
4. research bundle — Wikipedia / ArXiv / PubMed

The important constraint is unchanged:
expand by **family with shared semantic contracts**, not as a flat pile of unrelated tools.
