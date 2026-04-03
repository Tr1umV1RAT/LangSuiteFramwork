# v45 implementation report — memory semantics + durability pass

## Concise execution summary

I treated v45 as a **memory semantics + durability/UI pass** rather than another feature bloom.

What is now more explicit and more usable:

- memory surfaces now carry explicit semantics in the capability matrix,
- the variables/state panel now includes a dedicated **"Mémoires actives"** subsection,
- each detected memory surface can show:
  - its memory system kind,
  - durability hint,
  - projection/visibility style,
  - last update time,
  - last operation,
  - last entry preview,
  - namespace / output key / source key when relevant,
- AI nodes that consume memory through `memory_in` now appear as **memory consumers** in that subsection,
- runtime memory nodes now project bounded `__memory_meta__` into state so the UI can show real recent memory activity instead of hand-waving,
- the capability inspector now surfaces **Memory system** and **Durability** for relevant nodes,
- the debugger now shows a small **Memory activity** strip sourced from `__memory_meta__`.

I did **not** claim:
- durable long-term store persistence beyond what the current build really compiles,
- full host/embedded runtime memory synchronization,
- generic tool-runtime memory parity,
- browser-manual proof for this pass.

---

## What v45 targeted

- make memory families less mushy in the UI,
- expose memory existence directly in the state/variables panel,
- clarify what is thread/checkpoint vs runtime store vs retrieval vs context trimming vs memory input consumption,
- attach a usable notion of **last update** and **last entry** to memory surfaces,
- keep the existing graph/runtime model intact while making its limitations more visible.

---

## What was inspected first

I inspected:

- `client/src/capabilityMatrix.json`
- `client/src/capabilities.ts`
- `client/src/components/StatePanelContent.tsx`
- `client/src/components/CapabilityInspectorSection.tsx`
- `client/src/components/DebugPanelContent.tsx`
- `templates/nodes.py.jinja`
- `core/compiler.py`
- the existing memory/store node families:
  - `memory_store_read`
  - `memoryreader`
  - `memorywriter`
  - `store_put`
  - `store_search`
  - `store_get`
  - `store_delete`
  - `context_trimmer`
  - `rag_retriever_local`
- AI nodes that expose `memory_in`
- the v44 memory audit

The main reality check remained the same as in the audit:

- the project already had multiple memory surfaces,
- but their semantics and durability story were still too implicit,
- and the state panel did not yet make the existence of these memory systems visible enough.

---

## Memory semantics / durability changes

### 1. Capability matrix enrichment

Relevant nodes now expose explicit memory metadata fields such as:

- `memorySystemKind`
- `memoryDurability`
- `memoryVisibility`
- `memoryLastEntryKey`
- `memoryConsumer`

This was added for:

- `memory_store_read`
- `memoryreader`
- `memorywriter`
- `store_put`
- `store_search`
- `store_get`
- `store_delete`
- `context_trimmer`
- `rag_retriever_local`
- `llm_chat`
- `react_agent`
- `sub_agent`

### 2. Honest durability hints

The current build now says more clearly, in metadata and UI, that many store-backed surfaces are still effectively:

- **runtime store** surfaces,
- and in the compiled graph this runtime store remains **in-memory in the current build**.

So the product now makes less accidental noise about “memory” as if every memory surface were durable long-term persistence.

### 3. Memory consumers are visible

Nodes like:

- `llm_chat`
- `react_agent`
- `sub_agent`

can now appear as **memory consumers** in the state panel whenever they receive data through `memory_in`.

That matters because “uses memory” is not the same thing as “is a memory node”.

---

## Runtime / compile changes

### `templates/nodes.py.jinja`

I added a reusable helper:

- `_memory_meta_update(...)`

This produces bounded `__memory_meta__` state entries with fields such as:

- `node_id`
- `memory_system`
- `durability`
- `operation`
- `updated_at`
- `output_key`
- `state_key`
- `namespace`
- `key`
- `last_entry`

Then I threaded that through the relevant runtime nodes:

- `memory_store_read`
- `memoryreader`
- `memorywriter`
- `store_put`
- `store_search`
- `store_get`
- `store_delete`
- `context_trimmer`
- `rag_retriever_local`

So now these surfaces can project useful memory activity into graph state instead of leaving the UI to guess from smoke.

### Important constraint preserved

I did **not** change the underlying durability model of the runtime store in this pass.

I only made it **more explicit** and **more inspectable**.

---

## UI changes

### 1. State / variables panel

`StatePanelContent.tsx` now computes a dedicated list of **memory surfaces** using:

- node metadata,
- current graph nodes,
- `memory_in` links,
- `liveState.__memory_meta__`,
- recent run logs as fallback timestamps.

It now renders a subsection:

- **Mémoires actives**

For each memory surface, the UI can show:

- block family
- memory system kind
- durability hint
- projection style
- last update time
- last operation
- output key / source key
- namespace hint
- last entry preview
- linked sources for `memory_in` consumers

This directly implements your request to make the existence of memories visible in the variables/state panel with last update / last entry style cues.

### 2. Capability inspector

`CapabilityInspectorSection.tsx` now exposes:

- **Memory system**
- **Durability**

for relevant nodes.

I also tightened some memory-specific explanatory text so the inspector is less likely to imply:

- raw checkpoint state when it is actually store-backed,
- durable persistence when it is still runtime-store/in-memory in the current build.

### 3. Debug panel

`DebugPanelContent.tsx` now includes a small **Memory activity** strip sourced from `__memory_meta__`, so recent memory operations become visible without inventing a whole new debug subsystem.

---

## Validation performed

Executed successfully:

- `pytest -q tests/test_v40_node_taxonomy_consistency.py tests/test_v41_node_family_expansion.py tests/test_v42_control_flow_state_runtime.py tests/test_v43_send_reduce_structured_ui.py tests/test_v44_edge_semantics_and_memory_audit.py tests/test_v45_memory_semantics_ui.py tests/backend_session_workspace_smoke.py tests/project_tree_hidden_child_smoke.py`
- `cd client && npm ci`
- `cd client && npm run build`

Results:

- targeted regression/backend suite: **19 passed**
- frontend build: **passed**

Not claimed in this pass:

- fresh browser smoke proof
- stronger store durability than the current compiled runtime really provides

---

## What became more real

- the project now shows memory systems as first-class UI/runtime concepts rather than vague side-effects,
- the state panel can now display the **existence** of memory surfaces with operational hints,
- memory consumers are no longer invisible just because they are not memory nodes,
- the inspector and debugger now reflect memory semantics more explicitly,
- the current limitation around store durability is less likely to be misread.

---

## What remains bounded / deferred

Still bounded:

- runtime store durability is still limited by the current compiled store backend,
- full replay/resume parity across all memory layers is not solved,
- tools using memory “like a retrieval/tool runtime” are not yet normalized into one explicit user-facing memory contract,
- `memory_store_read` / `memoryreader` / `memorywriter` are now clearer, but they are still not fully rationalized into a final minimal family,
- embedded-native artifact internals do not yet expose a full memory debugger story.

---

## Recommended next pass

The clean next move is:

**v46 — memory model rationalization + tool/runtime memory access pass**

That should focus on:

1. deciding whether `memory_store_read`, `memoryreader`, and `memorywriter` should stay distinct or be rationalized,
2. clarifying how a tool/LLM retrieves memory-like information in the product model,
3. exposing memory provenance more explicitly in run/debug surfaces,
4. deciding whether the runtime store should remain in-memory or gain a stronger durable backend path.

In plain language:

v45 made the memory zoo much easier to see.

v46 should decide which animals actually deserve separate cages.
