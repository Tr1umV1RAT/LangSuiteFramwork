# v40 implementation report — node taxonomy and consistency pass

## Concise execution summary

I treated this as a **node taxonomy + consistency** pass rather than another bridge/runtime expansion pass.

The project did **not** need more integration models before its existing node surfaces were made easier to reason about.

This pass focused on four things:

1. making the UI node catalog and the capability/runtime matrix more consistent,
2. clarifying overloaded surfaces like `sub_agent`, `deep_agent_suite`, `tool_executor`, and the memory family,
3. introducing a stable **4-family block taxonomy** across key editor/runtime surfaces,
4. enriching run/debug metadata so the existing debugger/run/state panels can distinguish block provenance more clearly.

I did **not** add the larger missing node families yet (`Command`, handoffs, Send/map-reduce, runtime store write/search, etc.). That remains the next meaningful feature pass after this consistency pass.

---

## What v40 targeted

- fill the gap between `client/src/nodeConfig.ts` and `client/src/capabilityMatrix.json`
- make every UI-declared node have explicit runtime/catalog metadata instead of falling back silently to defaults
- formalize the 4 block families:
  - **native**
  - **structured**
  - **embedded**
  - **code**
- surface that taxonomy in the canvas/node chrome, capability inspector, quick insert palette, debugger/run logs, and state panel AI-node summaries
- improve run-log provenance without adding a duplicate “console” surface
- preserve the current v35–v39 lowering/embedded/runtime work

---

## What was inspected first

I inspected and cross-checked:

- `client/src/nodeConfig.ts`
- `client/src/capabilityMatrix.json`
- `client/src/capabilities.ts`
- `client/src/catalog.ts`
- `client/src/store.ts`
- `client/src/store/types.ts`
- `client/src/components/CustomNode.tsx`
- `client/src/components/BlocksPanelContent.tsx`
- `client/src/components/CapabilityInspectorSection.tsx`
- `client/src/components/DebugPanelContent.tsx`
- `client/src/components/RunPanel.tsx`
- `client/src/components/StatePanelContent.tsx`

The main reality gap was straightforward:

- the node catalog in `nodeConfig.ts` was broad and relatively stable,
- but only a small subset of nodes had explicit entries in `capabilityMatrix.json`,
- meaning many surfaces were still relying on broad defaults instead of deliberate metadata.

That is exactly how projects drift into “everything sort of works but no one knows what anything *is* anymore.”

---

## Main changes made

## 1. Explicit metadata coverage for the full UI node catalog

I added/filled explicit `nodeTypes` metadata in `client/src/capabilityMatrix.json` for the previously under-specified nodes, including:

- IO / utility surfaces:
  - `user_input_node`
  - `debug_print`
  - `static_text`
  - `chat_output`
  - `data_container`
  - `file_loader_node`
  - `python_executor_node`
- logic / flow / state surfaces:
  - `logic_router`
  - `context_trimmer`
  - `parallel_aggregator`
  - `human_interrupt`
  - `memory_checkpoint`
  - `update_state_node`
  - `tool_executor`
- tool surfaces:
  - `tool_python_repl`
  - `tool_python_function`
  - `tool_web_search`
  - `tool_rest_api`
  - `tool_api_call`
  - `tool_sql_query`
  - `tool_rpg_dice_roller`
  - all current Playwright tool variants

I also tightened summaries for key overloaded surfaces:

- `sub_agent`
- `deep_agent_suite`
- `memory_store_read`
- `memoryreader`
- `memorywriter`
- `tool_llm_worker`
- `deep_subagent_worker`

This does not magically solve all ontology issues, but it removes a lot of silent fallback ambiguity.

---

## 2. Added a stable 4-family block taxonomy

I introduced a frontend taxonomy for blocks:

- `native`
- `structured`
- `embedded`
- `code`

This taxonomy is derived in `client/src/capabilities.ts` using runtime metadata and a few explicit cases:

- free Python blocks → `code`
- wrapper/subgraph/suite-backed surfaces → `embedded`
- tool-placement surfaces → `structured`
- everything else → `native`

This taxonomy is now exposed through reusable labels/classes and consumed by the catalog/UI.

---

## 3. Node capability model now exposes block family

`client/src/catalog.ts` now includes `blockFamily` in `NodeCapabilityInfo`, so the higher-level editor surfaces can ask one simple question:

> what *kind* of block is this in product terms?

instead of re-deriving that ad hoc in every component.

---

## 4. Canvas and inspector surfaces now show block-family distinctions

Updated:

- `client/src/components/CustomNode.tsx`
- `client/src/components/CapabilityInspectorSection.tsx`
- `client/src/components/BlocksPanelContent.tsx`

### Effects

#### Custom node chrome
Canvas nodes now surface block family badges directly, so:
- native graph nodes,
- structured tool/library blocks,
- embedded artifact/wrapper surfaces,
- and free code blocks

stop visually blending into one generic “node” soup.

#### Capability inspector
The inspector now shows a dedicated **Block family** row and clearer explanatory notes for:
- `tool_executor`
- `deep_agent_suite`
- the memory family (`memory_store_read`, `memoryreader`, `memorywriter`)

So the inspector now says something more useful than “yes, this is technically a node, good luck.”

#### Quick insert palette
Quick-insert cards now surface the block family badge as well, helping the palette tell a truer story.

---

## 5. Run-log provenance is now richer and more structured

Updated:

- `client/src/store/types.ts`
- `client/src/store.ts`
- `client/src/components/RunPanel.tsx`
- `client/src/components/DebugPanelContent.tsx`

### New run-log metadata captured when possible
For run entries, the store now enriches logs with:
- `nodeType`
- `blockFamily`
- `executionPlacement`
- `executionFlavor`
- `integrationModel`
- `reasonCode`

This is done opportunistically based on current node IDs and runtime metadata, without pretending that every internal/lowered/external node can always be fully resolved.

### Run panel improvements
The Run panel now displays:
- block family badge
- integration model badge (when present)
- rejection reason code (when present)
- type / placement / flavor details

### Debugger improvements
The Debugger now shows a small **run event mix** summary by block family, instead of leaving all events as one undifferentiated stream.

This is still modest, but it begins to align the debugger with the product taxonomy instead of only with raw event types.

---

## 6. State panel AI-node summaries now include block family

Updated:

- `client/src/components/StatePanelContent.tsx`

The “Nœuds IA” sections now display the block family badge for AI-capable nodes, which helps distinguish:
- native graph LLM surfaces,
- embedded/wrapper surfaces,
- and other advanced rails.

This is not yet full variable-diff provenance, but it improves the readability of the existing state tooling.

---

## Validation performed

### Frontend build
Executed:

```bash
cd client && npm run build
```

Result:
- **passed**

### Targeted consistency regression
Executed:

```bash
pytest -q tests/test_v40_node_taxonomy_consistency.py
```

Result:
- **3 passed**

Coverage added:
- every UI node now has explicit capability-matrix metadata,
- overloaded/advanced surfaces have explicit metadata,
- code/tool surfaces are explicitly described rather than relying on broad defaults.

### Existing backend/session smokes
Executed:

```bash
python tests/backend_session_workspace_smoke.py
python tests/project_tree_hidden_child_smoke.py
```

Results:
- passed

### Browser smoke
Attempted existing browser smoke, but the environment hit a Playwright/Node `EPIPE` failure before a useful signal was produced.

So I am **not** claiming a fresh browser proof for this pass.
The frontend build itself passed, and the changes are primarily metadata/UI/rendering-level rather than deep runner semantics.

---

## What became more real

- the capability/runtime matrix now covers the actual UI node catalog much more explicitly
- the editor now has a stable product-level taxonomy for blocks
- the capability inspector says clearer things about overloaded surfaces
- the run/debug surfaces carry better provenance instead of only raw event types
- the state panel better reflects node family distinctions
- the project is a little less likely to drift into “everything is technically a node, therefore nothing has a clear nature”

---

## What remains bounded / deferred

I intentionally did **not** implement the larger feature additions yet:

- no `command_node`
- no explicit handoff node/tool surface yet
- no `send_fanout` / reduce-style control-flow surface yet
- no `store_search` / `store_put` runtime store family yet
- no structured-output dedicated node surface yet
- no new DeepAgents runtime broadening
- no full variable-diff provenance by source block family yet

Those are still the next meaningful feature additions.

This pass was about **taxonomy, coherence, and observability alignment**, not about widening the runtime surface again before the existing zoo had name tags.

---

## Recommended next pass

The best next pass is:

**v41 — first node-family expansion pass (Command / handoff / store surfaces)**

Recommended order:

1. `command_node` or equivalent Command-based update+goto surface
2. bounded handoff / state-transfer surface
3. first runtime store write/search nodes (`store_put`, `store_search`)
4. only then revisit richer Send/map-reduce or more ambitious multi-agent flow surfaces

Why this order:
- it follows the official LangGraph / LangChain control-flow direction (`Command`, handoffs, state-driven behavior),
- it gives the graph editor more semantically meaningful orchestration blocks,
- and it builds on the taxonomy pass instead of bypassing it.

---

## Deliverables

- updated project archive
- this implementation report
- targeted regression test: `tests/test_v40_node_taxonomy_consistency.py`

This pass was intentionally boring in the good way: less ontology drift, less silent fallback metadata, more product truth in the UI.
