# LangSuite v59 Prompt — Group-Based Canonical Subagent Runtime Pass

You are continuing **LangSuite** immediately after the completed **v58 pass**.

IMPORTANT:
Use as the source-of-truth baseline the current version where:
- `tool_sub_agent` is already the canonical subagent surface,
- `sub_agent` has already been recentered as the more advanced Agent Artifact surface,
- the project already has a Subagent Library in runtime settings,
- and the product direction is that a **subagent** means a LangChain-style **agent used as a tool**, without persistent independent memory by default.

Do not regress that baseline.
Do not reopen settled memory/runtime/UI work unless a real defect is found.

## LANGUAGE
- Respond in English unless the user explicitly asks otherwise.

## ROLE
You are acting as a:
- senior full-stack product architect,
- LangChain/LangGraph integration designer,
- UX/system ontology cleanup engineer,
- persistence truth hardening engineer,
- and solo-maintainability guardian.

This is:

**v59 — group-based canonical subagent runtime pass**

You are **not** doing a broad rewrite.
You are **not** introducing multiple competing subagent block types.
You are **not** turning subagent into subgraph.
You are **not** adding persistent subagent memory by default.

This pass should make the **group-based canonical subagent model** real.

---

## CANONICAL PRODUCT DECISION

For LangSuite, a **subagent** must mean:

> a LangChain-style **agent used as a tool** by a parent agent,
> configured in a **project-level Subagent Library**,
> with its own system prompt and optionally its own tools,
> but **without independent persistent memory by default beyond the time of invocation**.

A **subgraph** remains a graph composition concept.
A **subagent** is not a subgraph.

---

## TARGET UX MODEL

### Library model
The project-level Subagent Library defines:
- groups,
- agents inside groups,
- system prompt,
- tools,
- optional description.

A group of 1 is a perfectly valid simple case.

### Canvas block model
The canonical `tool_sub_agent` block should reference:
- `target_group` (canonical base target)
- `target_agent` (optional)

Interpretation:
- if `target_agent` is set → call one named subagent
- if `target_agent` is empty → use bounded **group dispatch**

Keep the model simple.
Do not force the user to choose between separate “agent block” vs “group block” types.

---

## PRIMARY OBJECTIVES

### Objective 1 — Make group-based targeting canonical
Treat the group as the primary target concept.
A group of 1 must cover the simple case cleanly.

### Objective 2 — Replace text-only subagent targeting with library-backed selection
The `tool_sub_agent` block should use the project’s Subagent Library as its source of truth.
Support selection of:
- a group,
- and optionally one agent inside that group.

### Objective 3 — Support two bounded runtime forms
Support:
1. direct tool-per-agent wrapper
2. group dispatch wrapper (`agent_name`, `description`)

Do not build a complex scheduler.
Do not add multiple subagent block types.

### Objective 4 — Auto-generate parent-agent usage guidance
Placing a subagent tool should be enough to generate the relevant parent-agent usage hints.
The user should not need to hand-author the entire subagent usage story in the parent prompt.

### Objective 5 — Preserve truth and simplicity
Do not imply persistent subagent memory by default.
Do not blur subagent and subgraph again.

---

## HARD CONSTRAINTS

- Do **not** re-expand `sub_agent` into a fuzzy catch-all.
- Do **not** collapse subgraph and subagent semantics.
- Do **not** add persistent subagent memory by default.
- Do **not** create several competing subagent block variants.
- Do **not** pretend group dispatch is already a full orchestration framework.
- Do **not** add middleware-backed tool-call enforcement unless the runtime path genuinely supports it cleanly.

---

## MANDATORY TASK ORDER

# Phase 1 — Inspect current subagent surfaces
Inspect first:
- `client/src/nodeConfig.ts`
- `client/src/components/CustomNode.tsx`
- `client/src/components/StatePanelContent.tsx`
- `client/src/components/CapabilityInspectorSection.tsx`
- `core/schemas.py`
- `templates/tools.py.jinja`
- `templates/nodes.py.jinja`
- current subagent library definitions in runtime settings

Identify exactly where:
- subagent targeting is still too text-based,
- the runtime only supports the direct case,
- and parent-agent usage hints are still too weak.

---

# Phase 2 — Define the canonical group-based contract
Before broad patching, define in code and in the report:
- group as canonical base target
- agent as optional refinement inside a group
- group-of-1 as the simple case
- direct call semantics vs group dispatch semantics
- no persistent subagent memory by default
- explicit non-goals

---

# Phase 3 — Implement library-backed selection
Patch the smallest coherent UI surface so the `tool_sub_agent` block uses project-library-backed selection for:
- group
- optional agent

Keep the interaction simple.

---

# Phase 4 — Implement bounded runtime generation
Extend the generated `sub_agent_tool` runtime so it supports:
- direct one-agent wrapper if `target_agent` is set
- dispatch wrapper if only `target_group` is set

Keep this bounded and explicit.
Do not attempt a broad scheduler.

---

# Phase 5 — Improve parent-agent usage hints
Generate parent-agent prompt/runtime hints automatically when a subagent tool is linked.
These hints should explain:
- which group is available
- which agents are available
- whether the tool targets one agent or dispatches within a group
- bounded invocation guidance

---

# Phase 6 — Validate and regression-protect
Validation must include:
- backend Python compile
- targeted subagent regression tests
- save/load/import/export truth where touched
- frontend build

If something remains partial, say so clearly.

---

## REQUIRED DELIVERABLES

You must deliver:
1. an updated project archive,
2. an implementation report,
3. explicit validation results,
4. a short **Canonical Subagent Contract Summary**,
5. a short **Group Dispatch Summary**,
6. a short **Prompt/Runtime Hint Summary**,
7. and a short **recommended next pass**.

---

## SUCCESS CRITERIA

A successful v59 pass should achieve as many of these as reality allows:
- one canonical subagent model remains,
- group-based targeting is real,
- group-of-1 cleanly covers the simple case,
- direct and dispatch runtime forms are both supported in bounded form,
- parent-agent hints are generated automatically,
- subgraph and subagent remain clearly distinct,
- no persistent subagent memory is implied by default.

---

## ANTI-BULLSHIT RULE

When choosing between:
- “support every possible multi-agent dispatch idea now”,
- and “make one canonical group-based subagent model work cleanly”,

choose the canonical model.

---

## START NOW

Begin by inspecting the current canonical subagent model and the Subagent Library, then implement the narrowest coherent group-based runtime extension and library-backed block selection.
