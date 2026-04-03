# v47 implementation report

## Concise execution summary

I treated v47 as a **memory access model + node surface cleanup pass**.

What is now real:
- memory-related nodes expose clearer **role** and **access model** semantics
- the UI now distinguishes better between:
  - profile/store lookup surfaces
  - store helper read/write surfaces
  - CRUD-style store nodes
  - retrieval surfaces
  - context trimming
  - memory consumers using `memory_in`
- `llm_chat` and `react_agent` now project bounded runtime memory-consumption metadata when they consume a memory payload through `memory_in`
- `sub_agent` now forwards `memory_in` payloads into the child/embedded invocation path and also projects bounded memory-forward metadata
- run/debug/state surfaces now expose more of that memory provenance instead of leaving it implicit
- the lighter memory helper nodes are labeled more honestly in the editor (`Memory Read Helper`, `Memory Write Helper`)

What I did **not** do:
- no generic ToolRuntime memory access framework for arbitrary tools
- no new memory node family beyond the existing store/retrieval/helper surfaces
- no broad persistence/replay synchronization between host state, store state, and embedded runtime internals
- no browser/manual smoke claim for this pass

---

## What v47 targeted

This pass targeted four things:

1. **rationalize the meaning** of `memory_store_read`, `memoryreader`, `memorywriter`, and store CRUD surfaces in product metadata
2. **clarify memory access for agent/LLM nodes** so `memory_in` consumption stops being just a vague conceptual note and becomes visible runtime metadata
3. **fix the mismatch** where `sub_agent` advertised `memory_in` as a valid handle but did not actually forward that payload into the child invocation path
4. **tighten the UI language** around memory roles and access patterns without inventing a fake generalized memory/tool subsystem

---

## What was inspected first

I inspected:
- `client/src/capabilityMatrix.json`
- `client/src/capabilities.ts`
- `client/src/nodeConfig.ts`
- `client/src/components/StatePanelContent.tsx`
- `client/src/components/CapabilityInspectorSection.tsx`
- `client/src/components/DebugPanelContent.tsx`
- `client/src/components/RunPanel.tsx`
- `client/src/store.ts`
- `client/src/store/types.ts`
- `templates/nodes.py.jinja`
- the existing memory-focused tests through v46

The key reality check was:
- the project already had multiple memory/store/retrieval surfaces,
- the UI already surfaced them,
- but their **product meaning** was still too muddy,
- and `sub_agent` in particular still looked like a memory consumer in the editor while ignoring the memory payload at compile/runtime.

---

## Main changes

### 1. Clearer memory metadata in the capability matrix

I added explicit memory-semantics metadata such as:
- `memoryRole`
- `memoryAccessModel`

Examples:
- `memory_store_read`
  - `profile_store_reader`
  - `runtime_store_lookup_by_user_namespace`
- `memoryreader`
  - `store_read_helper`
  - `runtime_store_helper_key_read`
- `memorywriter`
  - `store_write_helper`
  - `runtime_store_helper_key_write`
- `store_put/search/get/delete`
  - `store_crud_surface`
  - CRUD-specific access model
- `llm_chat` / `react_agent`
  - `memory_consumer`
  - `graph_memory_input_payload`
- `sub_agent`
  - `embedded_or_child_memory_consumer`
  - `graph_memory_input_payload_forwarded_to_subgraph`
- `rag_retriever_local`
  - `retrieval_surface`
  - `local_vector_index_query`
- `context_trimmer`
  - `context_window_manager`
  - `thread_state_message_trimming`

I also updated store-backed memory durability phrasing to the more honest:
- `store_runtime_user_selectable_backend`

rather than leaving helper/store surfaces with stale “in-memory current build” wording after v46 made the backend user-selectable.

### 2. Cleaner editor naming for helper nodes

I updated the node labels in `nodeConfig.ts`:
- `memoryreader` → **Memory Read Helper**
- `memorywriter` → **Memory Write Helper**

This better matches what those nodes really are in the current build: helper/store surfaces, not magical raw checkpoint peeks.

### 3. Runtime memory metadata for memory consumers

In `templates/nodes.py.jinja`, I extended `_memory_meta_update(...)` so runtime memory metadata now also carries:
- `access_model`

Then I updated compiled node behavior so:
- `llm_chat` emits `__memory_meta__` with `operation="memory_consume"` and `access_model="graph_memory_input_payload"` when consuming `memory_in`
- `react_agent` does the same
- `sub_agent` emits `operation="memory_forward"` and `access_model="graph_memory_input_payload_forwarded_to_subgraph"`

### 4. `sub_agent` now actually forwards memory payloads

This is the most important technical fix in the pass.

Before v47:
- `sub_agent` visually exposed a `memory_in` handle,
- the product described it as a memory consumer,
- but the compiled `initial_state` passed to the child graph only forwarded `messages`.

Now:
- `sub_agent` forwards context and memory payloads into `initial_state` when present,
- while preserving the bounded current model,
- and without claiming full deep host/child memory synchronization.

### 5. Better UI surfaces for memory semantics

#### Capability Inspector
Now shows:
- **Memory role**
- **Memory access model**
- existing `toolRuntimeMemoryAccessMode` when present
- the older abstraction notes remain visible

#### State / variables panel
The **Mémoires actives** subsection now shows, per memory surface:
- **Rôle**
- **Accès**
- Durabilité
- Projection
- dernière mise à jour
- dernière opération
- dernière entrée
- backend/path when available

This makes it easier to see whether something is:
- a store helper,
- a profile lookup,
- retrieval,
- context trimming,
- or merely a memory consumer via `memory_in`.

#### Debug panel
The **Memory activity** band now also shows:
- `access_model`
- `store_backend`

so memory traces are less opaque.

#### Run panel
Run log entries now surface memory-specific context when available:
- `memorySystem`
- `memoryOperation`
- `memoryAccessModel`
- `storeBackend`

This makes runtime provenance less mushy when a node is doing memory-related work.

### 6. Store parsing in the client run-log layer

`client/src/store.ts` now extracts node-level memory metadata from `node_update` payloads and projects it into the typed run-log entry.

This is what lets the run panel distinguish ordinary node updates from memory-consumption / store / retrieval activity.

---

## Validation performed

### Python / backend validation
Executed:
- `python -m py_compile core/compiler.py core/schemas.py api/routes.py api/runner.py`

Result:
- passed

### Regression/API suite
Executed:
- `pytest -q tests/test_v40_node_taxonomy_consistency.py tests/test_v41_node_family_expansion.py tests/test_v42_control_flow_state_runtime.py tests/test_v43_send_reduce_structured_ui.py tests/test_v44_edge_semantics_and_memory_audit.py tests/test_v45_memory_semantics_ui.py tests/test_v46_memory_rationalization.py tests/test_v47_memory_access_cleanup.py tests/backend_session_workspace_smoke.py tests/project_tree_hidden_child_smoke.py`

Result:
- **25 passed**

### Frontend build
Executed:
- `cd client && npm ci`
- `cd client && npm run build`

Result:
- **passed**

### What was not claimed
- no fresh Playwright/browser smoke proof for this pass
- no claim of generic ToolRuntime memory access for arbitrary tools
- no claim of full embedded-runtime memory replay parity

---

## What became more real

- the project is clearer about what each memory surface actually is
- helper read/write surfaces are now less likely to be mistaken for raw checkpoint manipulation
- `memory_in` consumption is now not just conceptual for `llm_chat` / `react_agent`
- `sub_agent` finally forwards memory payloads instead of advertising a handle it ignored
- run/debug/state surfaces can now show more useful memory provenance

---

## What remains bounded / deferred

Still bounded:
- no generic ToolRuntime-style memory/tool access model
- no dedicated memory-tool node family
- no unified “one memory node to rule them all” abstraction
- no broad persistent replay parity across checkpoint + store + embedded runtime layers
- no explicit memory access node for tools beyond current graph/runtime input semantics

Still likely to deserve later arbitration:
- whether `memoryreader` / `memorywriter` should stay as first-class helper nodes or collapse into a stricter store-helper family
- whether `memory_store_read` should remain a distinct visible/internal surface or become purely a profile-specific variant of store get/read
- whether a bounded explicit `tool_memory_access` surface should exist later for advanced users

---

## Recommended next pass

The clean next move is:

**v48 — memory tool/runtime access surface + memory family consolidation pass**

Priority order:
1. decide whether to introduce one bounded explicit memory access surface for tools/agents
2. further rationalize `memory_store_read` vs `memoryreader` / `memorywriter` vs `store_get` / `store_search`
3. strengthen debugger/run/state provenance around memory source and memory destination
4. only then consider broader memory-tool abstractions

That would move the project from “memory is visible and semantically clearer” to “memory access is also product-coherent.”
