# v42 implementation report

## Concise execution summary

I continued from the v41 baseline with a **control-flow / state-runtime expansion pass**.

This pass adds three new bounded node families:
- `send_fanout`
- `store_get`
- `store_delete`

The goal was not to widen the system into a generic distributed runtime fantasy, but to add the next practical language primitives after `command_node`, `handoff_node`, `store_put`, and `store_search`.

## What v42 targeted

- add a first bounded **Send API fanout** surface
- extend store/runtime support with **exact-key read** and **delete** primitives
- preserve the v40 taxonomy and v41 control/state semantics
- keep the compile/run story explicit rather than mushy

## What was inspected first

I inspected:
- `client/src/nodeConfig.ts`
- `client/src/capabilityMatrix.json`
- `core/schemas.py`
- `core/compiler.py`
- `templates/nodes.py.jinja`
- `templates/graph.py.jinja`
- `client/src/components/CapabilityInspectorSection.tsx`
- existing v40/v41 tests

The main design constraint was to avoid inventing a giant new runtime model when the next real additions were still local and bounded.

## New node families added

### 1. `send_fanout`

A bounded control-flow surface built on the LangGraph `Send` API pattern.

Current contract:
- requires **exactly one** direct outgoing worker edge
- dispatches **one worker payload per source item**
- reads from one list-like source key (`items_key`)
- injects each item into a worker state key (`item_state_key`)
- can optionally copy:
  - `messages`
  - `custom_vars`
  - selected passthrough state keys
- can optionally emit a local fanout count (`fanout_count_key`)

This is intentionally not a generic distributed execution framework.
It is a bounded worker-fanout primitive.

### 2. `store_get`

A bounded runtime-store read-by-key node.

Current contract:
- namespace-scoped
- exact key lookup
- normalized single output into graph state
- no broad store admin semantics implied

### 3. `store_delete`

A bounded runtime-store delete node.

Current contract:
- namespace-scoped
- exact key deletion
- optional delete receipt
- no broad store lifecycle/admin semantics implied

## Backend / compiler changes

Changed files:
- `client/src/nodeConfig.ts`
- `client/src/capabilityMatrix.json`
- `core/schemas.py`
- `core/compiler.py`
- `templates/nodes.py.jinja`
- `templates/graph.py.jinja`
- `client/src/components/CapabilityInspectorSection.tsx`
- `client/src/components/StatePanelContent.tsx`
- `tests/test_v42_control_flow_state_runtime.py`

### Main changes

#### `send_fanout`
- added to UI catalog and capability matrix
- added schema validation in `core/schemas.py`
- added compile-time target inference in `core/compiler.py`
- compile now rejects:
  - zero direct worker edges
  - multiple direct worker edges
- generated Python now includes:
  - `_fanout_items(...)`
  - `*_dispatch(...)`
  - `Send(...)` payload creation
- generated graph wiring now uses `builder.add_conditional_edges(..., dispatch_fn, [target])`
- direct edge emission for `send_fanout` is intentionally skipped in `graph.py` because Send API dispatch owns that control-flow path

#### `store_get`
- added exact-key runtime retrieval path using `get` / `aget` when present
- returns normalized value into graph state

#### `store_delete`
- added exact-key runtime deletion path using `delete` / `adelete` when present
- can emit a bounded receipt object when configured

#### latent fix included in this pass
I also fixed a latent coherence issue from the previous store additions:
- `store_put` / `store_search` / `store_get` / `store_delete` now correctly count as memory/store-backed nodes for graph compilation,
- so `graph.py` emits the store setup (`InMemoryStore`) whenever these node families are present.

Without that, store nodes could compile into graphs that referenced a store without provisioning one.

## UI / inspector changes

I added bounded inspector messaging for the new node families:
- `send_fanout`
- `store_get`
- `store_delete`

The capability inspector now explains these as:
- structured advanced surfaces
- bounded primitives
- not magical generic orchestration/admin systems

This continues the v40 taxonomic cleanup rather than adding another hidden abstraction layer.

## Validation performed

Executed successfully:

- `cd client && npm ci`
- `cd client && npm run build`
- `pytest -q tests/test_v40_node_taxonomy_consistency.py tests/test_v41_node_family_expansion.py tests/test_v42_control_flow_state_runtime.py tests/backend_session_workspace_smoke.py tests/project_tree_hidden_child_smoke.py`

Results:
- frontend build: **passed**
- regression/API/backend suite: **11 passed**
- persistence/session smoke: **passed**
- project-tree/hidden-child smoke: **passed**

## What became more real

- the workflow language now has a first bounded **fanout worker primitive**
- the store/runtime language now supports:
  - put
  - search
  - get
  - delete
- store-backed nodes now compile more honestly because store provisioning tracks them properly
- the node family expansion remains aligned with the existing taxonomy and compile story

## What remains bounded / deferred

Still deferred:
- richer handoff return/tool-style handoff semantics
- `Send`-based reduce/join helpers beyond the current bounded fanout
- store list/admin surfaces
- dedicated structured-output node family
- browser/manual smoke for this exact pass
- broader event/debug projection specifically for send worker runs

## Recommended v43 direction

The cleanest next move is:

**v43 — send/reduce + structured output surface pass**

In practice:
1. add a bounded reduce/join complement for `send_fanout`
2. add a clearer structured-output surface (instead of leaving it only as hidden param power)
3. improve debugger/state-panel projection for fanout worker provenance

That would extend the workflow language in a coherent way instead of just adding more isolated knobs.
