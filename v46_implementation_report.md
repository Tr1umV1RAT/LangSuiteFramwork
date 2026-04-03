# v46 implementation report

## Concise execution summary

I treated v46 as a **memory model rationalization + configurable runtime store backend pass**.

What is now real:
- runtime settings now include a **user-selectable store backend**:
  - `in_memory`
  - `sqlite_local`
- runtime settings also include a **store path** when the local SQLite backend is used
- graphs that compile with memory/store surfaces now provision the runtime store according to that setting
- memory-related runtime metadata now surfaces the selected backend and optional store path
- the state/variables panel now shows this information in the **Mémoires actives** subsection
- the capability inspector now distinguishes store-backed memory surfaces more honestly
- the product explains more clearly that `memory_in` is **not** the same thing as a full ToolRuntime-style memory/tool access system

What I did **not** do:
- no generic ToolRuntime memory access implementation for arbitrary tools
- no full persistent store backend matrix beyond `in_memory` and bounded local SQLite
- no attempt to merge all memory surfaces into one magic super-node
- no browser/manual smoke claim for this pass

---

## What v46 targeted

This pass targeted four things:

1. **make store durability user-configurable** instead of hard-wired to in-memory runtime storage
2. **rationalize memory semantics** so store-backed helper nodes stop sounding like raw checkpoint state peeks
3. **improve UI honesty** around what memory surfaces really are and where their data comes from
4. **clarify the difference** between memory carried through `memory_in` and memory accessed through tool/runtime systems

---

## What was inspected first

I inspected:
- `client/src/store/types.ts`
- `client/src/store/workspace.ts`
- `client/src/components/StatePanelContent.tsx`
- `client/src/components/CapabilityInspectorSection.tsx`
- `client/src/capabilityMatrix.json`
- `core/schemas.py`
- `core/compiler.py`
- `templates/graph.py.jinja`
- `templates/nodes.py.jinja`
- existing v45 memory tests and store provisioning logic

The key reality check was:
- memory/store nodes already existed,
- the UI already surfaced active memories,
- but the **runtime store was still effectively implied as in-memory**,
- and memory helper surfaces (`memoryreader`, `memorywriter`) still risked being misread as direct checkpoint/thread-state access.

---

## Main changes

### 1. Configurable runtime store backend

I extended runtime settings with:
- `storeBackend`
- `storePath`

Current supported backends:
- `in_memory`
- `sqlite_local`

This flows through:
- workspace defaults and sanitization
- exported compile payloads
- backend schema validation
- compiled graph runtime settings

### 2. Local SQLite runtime store path

When a graph compiles with memory/store surfaces and runtime settings select `sqlite_local`, the generated `graph.py` now emits a bounded local `SQLiteRuntimeStore` implementation instead of always hard-wiring `InMemoryStore()`.

This store supports the subset the project already needs:
- `get` / `aget`
- `put` / `aput`
- `search` / `asearch`
- `delete` / `adelete`

This is intentionally narrow and local.
It is not presented as a generic enterprise persistence framework.

### 3. Memory durability metadata is now runtime-dependent

Compiled memory/store nodes no longer hardcode only the old in-memory durability phrasing.

They now emit durability via a runtime-aware constant:
- `store_runtime_inmemory_user_configurable`
- `store_runtime_sqlite_local_user_configurable`

The emitted `__memory_meta__` also carries:
- `store_backend`
- `store_path` (when applicable)

### 4. State panel memory subsection is now more useful

The **Mémoires actives** subsection now shows, when available:
- store backend
- store path
- durability
- projection kind
- last update
- last operation
- last entry preview

This keeps the memory UI tied to real runtime metadata instead of pure inference.

### 5. Better product honesty around memory access

The capability inspector now makes store-backed memory surfaces more explicit and also shows the selected store backend for store-related nodes.

I also added an explicit note for LLM/agent/sub-agent nodes:
- `memory_in` is a **graph/runtime input path**
- it is **not** the same thing as arbitrary ToolRuntime memory access or agent-side memory search magic

That distinction matters technically and in the editor UX.

### 6. Memory node rationalization metadata

I added metadata in the capability matrix to make the current state of the product more explicit:
- `memoryBackendSelectable`
- `memoryBackendOptions`
- `toolRuntimeMemoryAccessMode`

This does not yet implement generic tool memory access.
It does make the current limits inspectable.

---

## Validation performed

### Python / backend validation
Executed:
- `python -m py_compile core/compiler.py core/schemas.py api/routes.py api/runner.py tests/test_v46_memory_rationalization.py`

Result:
- passed

### Regression/API suite
Executed:
- `pytest -q tests/test_v40_node_taxonomy_consistency.py tests/test_v41_node_family_expansion.py tests/test_v42_control_flow_state_runtime.py tests/test_v43_send_reduce_structured_ui.py tests/test_v44_edge_semantics_and_memory_audit.py tests/test_v45_memory_semantics_ui.py tests/test_v46_memory_rationalization.py tests/backend_session_workspace_smoke.py tests/project_tree_hidden_child_smoke.py`

Result:
- **22 passed**

### Frontend build
Executed:
- `cd client && npm ci`
- `cd client && npm run build`

Result:
- **passed**

### What was not claimed
- no fresh Playwright/browser smoke proof for this pass
- no full provider/runtime proof for every embedded or lowered memory-related surface
- no full persistence/replay parity proof across checkpoint + store + embedded runtime layers

---

## What became more real

- the user can now choose the runtime store backend instead of accepting a single hidden default
- the product is more honest about memory durability
- memory/store helper nodes are less likely to be mistaken for raw checkpoint peeks
- the state panel shows more concrete memory runtime facts
- the product distinguishes more clearly between:
  - checkpoint/thread state
  - runtime store
  - retrieval surfaces
  - memory input consumption
  - tool/runtime memory access that is still **not** implemented generically

---

## What remains bounded / deferred

Still bounded:
- no generic ToolRuntime memory access surface for arbitrary tools
- no dedicated memory-tool node family yet
- no durable backend matrix beyond `in_memory` and bounded local SQLite
- no claim that all memory surfaces have equal persistence guarantees
- no broad migration of retrieval/RAG into the same contract as store-backed memory

Still ambiguous enough to deserve a later pass:
- the long-term product distinction between `memory_store_read`, `memoryreader`, and `store_get` / `store_search`
- how much of the official LangGraph/LangChain runtime/store model should become first-class in the visual language
- whether some helper surfaces should remain aliases versus becoming strongly distinct node families

---

## Recommended next pass

The clean next move is:

**v47 — memory access model + node surface cleanup pass**

Priority order:
1. decide whether `memoryreader` / `memorywriter` stay as helper aliases or become more explicit store-helper surfaces
2. decide whether `memory_store_read` remains a visible/internal distinction or should collapse into clearer store-profile semantics
3. add a bounded, explicit **memory access model** for tools/agents if desired, rather than leaving the concept half-implied
4. tighten debug/state provenance for memory values flowing through `memory_in`, tools, store queries, and retrieval surfaces

That would move the project from “memory is now more visible and configurable” to “memory is also conceptually cleaner.”
