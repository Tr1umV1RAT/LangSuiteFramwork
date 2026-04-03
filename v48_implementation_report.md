# v48 implementation report

## Concise execution summary

I treated v48 as a **memory tool/runtime access surface + memory family consolidation pass**.

What is now real:
- a new canonical memory surface exists: `memory_access`
- `memory_access` supports three bounded access modes:
  - `profile_read`
  - `get`
  - `search`
- the project now distinguishes more clearly between:
  - canonical bounded memory access
  - legacy helper reads/writes
  - CRUD-style store operations
  - memory consumption via `memory_in`
- the UI now shows which memory surface is the **preferred surface**
- existing helper/store nodes remain available, but the product now stops pretending they are all equally primary

What I did **not** do:
- no generic ToolRuntime memory API for arbitrary tools
- no arbitrary memory-tool plugin framework
- no broad removal of legacy memory nodes
- no fresh browser/manual smoke claim for this pass

---

## What v48 targeted

This pass targeted three things:

1. introduce **one canonical bounded memory access node** for agents/tools/graph consumers
2. consolidate the current family tension between:
   - `memory_store_read`
   - `memoryreader`
   - `memorywriter`
   - `store_get`
   - `store_search`
3. make the UI more explicit about which memory surface should be used by default versus which ones are helper/legacy/specialized surfaces

---

## What was inspected first

I inspected:
- `client/src/nodeConfig.ts`
- `client/src/capabilityMatrix.json`
- `client/src/capabilities.ts`
- `client/src/components/CapabilityInspectorSection.tsx`
- `client/src/components/StatePanelContent.tsx`
- `core/schemas.py`
- `core/compiler.py`
- `templates/nodes.py.jinja`
- the existing v40–v47 targeted tests

The key reality check was simple:
- the project already had several memory/store surfaces,
- but they still competed semantically,
- and there was no single **preferred bounded memory access surface** for feeding memory payloads into downstream agents/tools.

---

## Main changes

### 1. New canonical node: `memory_access`

I added a new visible memory node in `client/src/nodeConfig.ts`:
- **label:** `Memory Access`
- **category:** `Memory`
- **handles:** `state_in` → `memory_out`

It supports three explicit modes:
- `profile_read`
- `get`
- `search`

And uses one normalized output payload shape.

This is now the cleanest bounded surface for:
- reading a profile-like memory payload,
- reading one store item,
- or performing one bounded store search,

without forcing the user to choose too early between multiple overlapping helper/store node families.

### 2. Capability matrix consolidation

I added a canonical capability entry for `memory_access` with explicit metadata such as:
- `memoryRole = canonical_memory_access_surface`
- `memoryAccessModel = runtime_store_profile_get_or_search_projection`
- `toolRuntimeMemoryReady = true`
- `toolRuntimeMemoryAccessMode = bounded_graph_surface_for_agent_or_tool_memory_payload`
- `preferredSurface = true`
- `consolidates = [memory_store_read, memoryreader, store_get, store_search]`

I also updated older memory/store nodes so the matrix now communicates:
- which surface is **preferred**,
- which surfaces are still **helper/legacy**,
- and which group they conceptually belong to.

Examples:
- `memoryreader.preferredSurface = memory_access`
- `store_get.preferredSurface = memory_access`
- `store_search.preferredSurface = memory_access`
- `memorywriter.preferredSurface = store_put`

This does not remove the old surfaces, but it stops leaving them semantically flat.

### 3. Schema validation for canonical memory access

In `core/schemas.py`:
- `memory_access` is now an allowed node type
- `NodeParams` now includes `access_mode`
- validation enforces bounded modes:
  - `profile_read`
  - `get`
  - `search`

The validator also fills reasonable defaults where appropriate.

### 4. Compile/runtime implementation for `memory_access`

In `templates/nodes.py.jinja`, I added a real compile path for `memory_access`.

It now compiles to one of three bounded runtime store behaviors:
- profile-scoped read
- direct get by key
- bounded search

Each path emits normalized `__memory_meta__` with:
- `memory_system = runtime_memory_access_surface`
- access metadata
- backend metadata
- operation metadata
- namespace/key/query info where relevant

This keeps it aligned with the v45–v47 memory provenance work.

### 5. Memory/store provisioning stays correct

In `core/compiler.py`, `memory_access` is now counted among store-using/memory-using nodes.

This means the graph keeps provisioning a runtime store when this node is present, instead of generating a graph that references store access without preparing the runtime support.

### 6. UI clarity: preferred surface is now visible

I updated:
- `CapabilityInspectorSection.tsx`
- `StatePanelContent.tsx`
- `client/src/capabilities.ts`

So the product now surfaces a **preferred memory surface** explicitly.

In practice this means:
- the inspector can say which node is the preferred canonical memory surface
- the active memory section can say which surface is recommended
- the product now stops flattening canonical surfaces and helper surfaces into the same conceptual bucket

---

## Validation performed

### Python / backend validation
Executed:
- `python -m py_compile core/compiler.py core/schemas.py api/routes.py api/runner.py`

Result:
- passed

### Regression/API suite
Executed:
- `pytest -q tests/test_v48_memory_access_surface.py tests/test_v40_node_taxonomy_consistency.py tests/test_v41_node_family_expansion.py tests/test_v42_control_flow_state_runtime.py tests/test_v43_send_reduce_structured_ui.py tests/test_v44_edge_semantics_and_memory_audit.py tests/test_v45_memory_semantics_ui.py tests/test_v46_memory_rationalization.py tests/test_v47_memory_access_cleanup.py tests/backend_session_workspace_smoke.py tests/project_tree_hidden_child_smoke.py`

Result:
- **28 passed**

### Frontend build
Executed:
- `cd client && npm ci`
- `cd client && npm run build`

Result:
- **passed**

### What was not claimed
- no fresh Playwright/browser smoke proof for this pass
- no claim of generic tool runtime memory access parity
- no claim that legacy helper surfaces have been removed or fully replaced

---

## What became more real

- the project now has one **canonical bounded memory access surface**
- memory/store helper families are more clearly organized around preferred vs helper/specialized roles
- downstream agent/tool memory payload design is more coherent
- memory provenance remains aligned with the existing debug/state/run memory metadata work
- the UI now better communicates which memory node should be used by default

---

## What remains bounded / deferred

Still bounded:
- no generic memory-as-tool runtime framework
- no arbitrary memory plugins
- no automatic migration from old helper surfaces to `memory_access`
- no browser/manual smoke claim for this pass

Still likely worth later arbitration:
- whether `memory_store_read` should remain visible at all or become a purely advanced/specialized surface
- whether `memoryreader` / `memorywriter` should stay first-class or become more obviously helper aliases
- whether a future explicit memory/tool bridge should exist for advanced users beyond graph-level memory payload wiring

---

## Recommended next pass

The clean next move is:

**v49 — memory UI simplification + helper/legacy surfacing pass**

Priority order:
1. decide how strongly to demote or hide overlapping helper surfaces
2. make memory surface choice simpler in the editor for non-advanced users
3. continue tightening debugger/run/state provenance around canonical vs helper memory paths
4. only then consider a broader explicit tool/runtime memory bridge abstraction

That would move the project from “memory access is technically more coherent” to “memory access is also easier to choose correctly in the UI.”
