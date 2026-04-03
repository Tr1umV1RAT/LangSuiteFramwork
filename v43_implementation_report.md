# v43 implementation report

## Concise execution summary

I completed **v43 — send/reduce + structured output surface + UI semantics pass** from the current v42 baseline.

This pass added one bounded complement to `send_fanout`, made structured output more explicit in the editor, and improved how the product explains graphical abstractions that do **not** map 1:1 to the compiled LangGraph graph.

What is now real:

- `send_fanout` still works
- a new bounded complement exists: **`reduce_join`**
- `llm_chat` and `react_agent` now expose a more explicit **structured output surface** in the editor
- structured output can now target an explicit key via `structured_output_key`
- run/debug/state surfaces now project **fanout worker context** more clearly
- the capability inspector now explains **interaction model**, **link semantics**, and **graphical abstraction notes** for key block families

What I did **not** do:

- no generic distributed workflow engine
- no generic multi-worker reduce framework beyond a bounded reduce/join surface
- no generic executable shared subagent lowering
- no DeepAgents widening
- no browser-proof claim for this pass

---

## What v43 targeted

1. add a bounded **reduce/join** complement to `send_fanout`
2. make **structured output** more explicit in the editor instead of leaving it as a hidden advanced textarea with opaque writeback semantics
3. improve **debug/state projection** for fanout workers
4. improve the UI’s explanation of **graphical abstractions** such as:
   - tools chips
   - auto-plumbed ToolNode loops
   - fanout dispatch links that are visually singular but runtime-multiple
   - wrapper/reference surfaces that do not map literally to native graph nodes

---

## What was inspected first

I inspected:

- `client/src/nodeConfig.ts`
- `client/src/capabilityMatrix.json`
- `client/src/capabilities.ts`
- `client/src/components/CustomNode.tsx`
- `client/src/components/CapabilityInspectorSection.tsx`
- `client/src/components/DebugPanelContent.tsx`
- `client/src/components/RunPanel.tsx`
- `client/src/components/StatePanelContent.tsx`
- `client/src/store.ts`
- `core/schemas.py`
- `templates/nodes.py.jinja`
- `api/runner.py`
- prior v40–v42 tests

The key architectural reality check was:

- `send_fanout` already provided the right bounded entry point for worker dispatch,
- but there was no explicit **join/reduce** surface in the editor,
- structured output was technically supported, but its editor/runtime story was still too implicit,
- and the UI still needed better language for the fact that some chips/handles/links are **authoring abstractions**, not literal compiled graph nodes.

---

## Bounded send/reduce expansion

### New node added

- **`reduce_join`**

### Purpose

A bounded complement to `send_fanout` for reducing a shared worker-results key after fanout execution.

### Contract

Accepted shape:
- reads one shared state/custom_vars key (`results_key`)
- writes one reduced output key (`output_key`)
- supports bounded reduce modes:
  - `list`
  - `text_join`
  - `first_non_null`
  - `count`
- optional `item_field` extraction before reduction
- optional `progress_key` for lightweight runtime progress metadata

### Important truth boundary

This node is intentionally **not** presented as a generic distributed reducer.
It is a bounded surface over the common orchestrator-worker pattern documented in the LangGraph `Send` API examples, where workers write to shared reduced state and the orchestrator synthesizes the final result. ([docs.langchain.com](https://docs.langchain.com/oss/python/langgraph/workflows-agents))

### Compilation/runtime behavior

- `send_fanout` still emits `Send(...)` dispatches
- `reduce_join` compiles to a normal node function that reads the aggregated key and writes the reduced result
- the product explicitly explains that a single visual fanout edge may correspond to many runtime worker payloads, and that `reduce_join` may execute as worker results accumulate rather than representing a literal one-time “join box” in every backend execution path

---

## Structured output surface improvements

### What changed

For `llm_chat` and `react_agent`:

- structured output remains supported via the existing schema field
- a new explicit editor field now exists:
  - **`structured_output_key`**
- the compiled node now writes parsed structured output to:
  - `custom_vars[structured_output_key]`
  - instead of always forcing the implicit `${node_id}_data` convention

### Why this matters

This turns structured output from “supported but slightly hidden plumbing” into something that is actually legible in the editor.

The LangChain docs treat structured output as a first-class agent capability, where the agent returns typed validated data under a structured-response channel. ([docs.langchain.com](https://docs.langchain.com/oss/javascript/langchain/structured-output))

LangSuite is still not mirroring LangChain’s exact internal API surface 1:1, but this pass makes the authored intent and the writeback target much clearer.

### UI changes

- nodes with structured schema now show a `structured` chip
- the capability inspector explicitly states that structured output is active
- the inspector explains where the parsed payload is written in the current build
- the state panel now shows the resolved structured output key for AI nodes

---

## UI semantics / graphical abstraction pass

This was a major requested part of the pass.

### New metadata layer added to node capability metadata

For key node families, the matrix now carries:

- `interactionModel`
- `linkSemantics`
- `uiAbstractionNotes`
- `structuredOutputCapable` where relevant

### Surfaces updated

#### `CapabilityInspectorSection`
Now shows a generic **Interface semantics** section when relevant, covering:
- interaction model
- link semantics
- graphical abstraction notes

#### `CustomNode`
Now adds short explanatory notes for key abstraction-heavy nodes:
- `llm_chat`
- `react_agent`
- `send_fanout`
- `reduce_join`
- `tool_executor`

Examples of what is now said explicitly:
- tools chips are graphical semantics, not necessarily one literal compiled ToolNode per visual relationship
- one fanout edge may represent many runtime dispatches
- `reduce_join` complements fanout through shared-state reduction rather than literal branch-by-branch backend structure
- explicit `tool_executor` and auto-plumbed tool loops are both valid product surfaces

### Why this matters

This aligns the product better with the reality of LangGraph itself:
- graphs can contain native function nodes,
- subgraphs can be used as nodes,
- `ToolNode` is a runtime/tool surface,
- `Send` is a dispatch API rather than a literal hand-authored duplication of workers. ([docs.langchain.com](https://docs.langchain.com/oss/python/langgraph/graph-api)) ([docs.langchain.com](https://docs.langchain.com/oss/python/langchain/tools?utm_source=chatgpt.com)) ([docs.langchain.com](https://docs.langchain.com/oss/python/langgraph/use-subgraphs))

So the editor should not lie by pretending every visible affordance is a literal backend graph primitive.

---

## Fanout worker debug/state projection improvements

### Backend/runtime change

`api/runner.py` now includes `fanout_meta` on `node_update` messages when runtime state exposes `__fanout_meta__`.

### Frontend changes

- run log entries now preserve:
  - `fanoutSourceNode`
  - `fanoutIndex`
  - `fanoutItemsKey`
- `RunPanel` now surfaces worker/fanout badges where available
- `DebugPanelContent` now shows a **Fanout worker context** section when present in live state
- `StatePanelContent` now surfaces fanout runtime context when available

### Important truth boundary

This is **not** a full distributed worker debugger.
It is a bounded visibility improvement so fanout execution is no longer a silent blur.

---

## Files changed

### Frontend
- `client/src/nodeConfig.ts`
- `client/src/capabilityMatrix.json`
- `client/src/capabilities.ts`
- `client/src/components/CustomNode.tsx`
- `client/src/components/CapabilityInspectorSection.tsx`
- `client/src/components/DebugPanelContent.tsx`
- `client/src/components/RunPanel.tsx`
- `client/src/components/StatePanelContent.tsx`
- `client/src/store.ts`
- `client/src/store/types.ts`

### Backend / compile / runtime
- `core/schemas.py`
- `templates/nodes.py.jinja`
- `api/runner.py`

### Tests
- `tests/test_v43_send_reduce_structured_ui.py`

---

## Validation performed

Executed successfully:

- `python -m py_compile api/runner.py core/compiler.py core/schemas.py`
- `cd client && npm ci`
- `cd client && npm run build`
- `pytest -q tests/test_v40_node_taxonomy_consistency.py tests/test_v41_node_family_expansion.py tests/test_v42_control_flow_state_runtime.py tests/test_v43_send_reduce_structured_ui.py tests/backend_session_workspace_smoke.py tests/project_tree_hidden_child_smoke.py`

Results:

- Python compile checks: **passed**
- frontend build: **passed**
- regression/API/backend suite: **14 passed**
- persistence/session smoke: **passed**
- project-tree/hidden-child smoke: **passed**

### Not claimed

- no fresh browser smoke proof in this pass
- no provider-backed autonomous runtime proof beyond already established prior rails
- no claim of generic worker debugger parity

---

## What became more real

- `send_fanout` now has a real bounded editorial complement: `reduce_join`
- structured output is materially clearer in the editor
- the product is better at telling the user when a visual affordance is an abstraction rather than a literal compiled node
- fanout worker context is more visible in runtime/debug/state surfaces
- the editor language is now closer to your actual intention: graphical semantics first, compilation truth second, but with both kept explicit

---

## What remains bounded / deferred

Still bounded:

- no generic map/reduce framework
- no generic distributed worker coordination model
- no generic executable shared subagent form
- no generic multi-runtime debugger
- no DeepAgents widening
- no browser/manual proof for this exact pass

Still worth doing later:

- richer reduce modes if there is a real repeated use-case
- optional dedicated “structured output helper” surface if authoring demand makes it worthwhile
- more explicit handling of bidirectional / many-to-one graphical semantics in the edge model itself
- richer worker debug timeline if the runtime/event model justifies it

---

## Recommended next pass

The cleanest next move is:

**v44 — edge semantics + multi-link UX pass**

Focused on:
- formalizing which handles/links are:
  - literal direct edges
  - many-to-one semantic links
  - one-to-many dispatch links
  - reference/wrapper links
- improving authoring UX around those distinctions
- keeping the compiled graph truth and the graphical authoring truth aligned without flattening them into one category

A secondary useful direction would be:

**v44b — richer structured output / result-schema authoring pass**

But the edge/link semantics are probably the more important architectural continuation right now.
