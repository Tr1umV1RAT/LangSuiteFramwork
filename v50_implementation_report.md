# v50 implementation report — node insertion UX / graphical semantics pass

## Concise execution summary

I treated this pass as a **node insertion UX / graphical semantics pass**, not as another runtime inflation step.

What became more real:
- `subgraph_node` now exists as a distinct **graph-native child subgraph** surface.
- `sub_agent` is now framed as the **LangChain-derived subagent / agent artifact** surface rather than the generic subgraph bucket.
- graph-native child subgraphs and LangChain-derived subagents are no longer presented as the same thing in the UI.
- the inspector and node chrome now explain more directly that editor handles are **authoring affordances**, not a literal 1:1 picture of the compiled LangGraph shape.
- wrapper insertion defaults now route:
  - graph/subgraph artifacts → `subgraph_node`
  - agent artifacts → `sub_agent`
  - deep agents → `deep_agent_suite`

What I deliberately did **not** do:
- no runtime rewrite,
- no new bridge family,
- no generic browser/manual redesign,
- no removal of legacy compile plumbing,
- no change to the current “multiple connected components compile as separate circuits” behavior.

---

## What this pass targeted

1. **UX semantics of node insertion**
   - the same conceptual object should not be inserted through multiple node surfaces that mean different things without the UI saying so.

2. **Subgraph vs subagent clarity**
   - `sub_agent` had become the overloaded bucket for:
     - child subgraphs,
     - saved subgraph refs,
     - lowered LangChain bridges,
     - embedded LangChain artifacts.
   - this was the main conceptual tax to reduce in this pass.

3. **Graphical abstraction honesty**
   - make the UI say more clearly that:
     - tool handles mean “capability can be attached”, not “tool-calling is automatically active”,
     - handles and links are ergonomic authoring surfaces,
     - the compiled graph may differ in shape.

---

## What was inspected first

I inspected:
- `client/src/nodeConfig.ts`
- `client/src/capabilityMatrix.json`
- `client/src/catalog.ts`
- `client/src/store.ts`
- `client/src/components/CustomNode.tsx`
- `client/src/components/CapabilityInspectorSection.tsx`
- `core/schemas.py`

Main findings before patching:
- the capability matrix already contained good semantic notes for several node families,
- but the actual surface split between `sub_agent` and graph-native child subgraphs was still too muddy,
- and wrapper insertion still defaulted too much toward `sub_agent`.

---

## Main code changes

### 1. New UI surface: `subgraph_node`
Added in:
- `client/src/nodeConfig.ts`
- `client/src/capabilityMatrix.json`
- `core/schemas.py`

This new surface is:
- the **graph-native child subgraph / saved subgraph reference** block,
- visually distinct,
- compiled through the existing trunk alias path,
- but described honestly as the graph composition surface.

It uses a bounded handle set:
- `messages_in`
- `documents_in`
- `memory_in`
- `messages_out`

Notably, unlike `sub_agent`, it does **not** present a `tools_in` affordance.

### 2. Reframed `sub_agent`
Adjusted in:
- `client/src/nodeConfig.ts`
- `client/src/capabilityMatrix.json`
- `client/src/store.ts`
- `client/src/components/CustomNode.tsx`
- `client/src/components/CapabilityInspectorSection.tsx`

`sub_agent` is now described as:
- a **LangChain-derived subagent / saved agent artifact** surface,
- distinct from graph-native child subgraphs,
- the right insertion choice for complex LangChain-authored agent-like units.

### 3. Wrapper insertion defaults
Adjusted in:
- `client/src/catalog.ts`

Wrapper suggestion now routes:
- `graph` / `subgraph` → `subgraph_node`
- `agent` → `sub_agent`
- `deep_agent` → `deep_agent_suite`

This is small but product-important: it reduces silent semantic drift when inserting saved artifacts from the library.

### 4. Validation tightening in the client-side compile/run checks
Adjusted in:
- `client/src/store.ts`

Now:
- `subgraph_node` rejects non-subgraph artifact references with a specific `wrong_reference_family` error.
- `sub_agent` rejects non-agent artifact references with the same code and an explicit message to use `subgraph_node` instead.
- `sub_agent` with no artifact reference no longer silently implies “child subgraph”; it now fails as a LangChain-surface misuse.
- child subgraph creation remains on `subgraph_node` only.

### 5. Inspector and node chrome semantics
Adjusted in:
- `client/src/components/CustomNode.tsx`
- `client/src/components/CapabilityInspectorSection.tsx`

Improvements:
- explicit **authoring note** that editor handles are ergonomic attachment points, not literal compiled edges,
- `llm_chat` / `react_agent` node copy now says more clearly that the tools handle marks a capability, not an automatic tool-calling path,
- `subgraph_node` and `sub_agent` each get their own explanatory copy and open behavior.

---

## UX / product conclusions from the audit layer of this pass

### What is better now
- users get a cleaner conceptual split between:
  - **graph composition** (`subgraph_node`)
  - **LangChain-derived agent composition** (`sub_agent`)
- insertion behavior is more aligned with the intended authored object.
- the inspector now supports the central truth of the UI:
  - the canvas is an ergonomic modeling surface,
  - not a literal mirror of compiled LangGraph internals.

### What still needs work later
- the product still does not surface a first-class “detached / separate component” UX story; unconnected authored blocks still compile as separate connected components using the existing compiler logic.
- the UI still relies heavily on textual semantics in the inspector for advanced understanding; the graph itself is more honest now, but not yet fully self-explanatory.
- `deep_agent_suite` remains a bounded/legacy-adapter surface rather than a fully native DeepAgents authoring/runtime story.

---

## Validation performed

Executed successfully:
- `pytest -q tests/test_v49_memory_ui_simplification.py tests/test_v50_node_insertion_ux_semantics.py tests/backend_session_workspace_smoke.py tests/project_tree_hidden_child_smoke.py`
- `cd client && npm ci`
- `cd client && npm run build`

Results:
- targeted regression/API suite: **6 passed**
- frontend build: **passed**
- backend/session/tree smokes: **passed**

Not claimed:
- no fresh browser/manual smoke proof in this pass.

---

## What became more real

- the editor now distinguishes more honestly between **subgraph** and **subagent** intent,
- wrapper insertion is less semantically lossy,
- authoring ergonomics vs compiled graph truth are described more explicitly in the product surfaces,
- `sub_agent` no longer quietly pretends to be the graph-native child-subgraph surface.

---

## What remains bounded / deferred

Still bounded:
- `subgraph_node` compiles through the canonical trunk alias path rather than introducing a brand-new runtime primitive,
- `sub_agent` remains a LangChain-facing product surface, not a full standalone runtime rail,
- detached component UX is still implicit rather than surfaced as a first-class editor concept,
- no broad redesign of link creation gestures or connection affordances was attempted here.

---

## Recommended next pass

**v51 — detached components + connection affordance audit pass**

Priority areas:
1. make the UX of **unconnected / secondary components** explicit,
2. inspect whether certain handles should surface clearer one-to-many / many-to-one semantics directly on-node,
3. continue tightening the visual distinction between:
   - direct graph edges,
   - semantic tool links,
   - fanout/reduce abstractions,
   - wrapper/reference nodes.

That would continue the same line: reduce editor ambiguity without flattening the product into a fake literal graph mirror.
