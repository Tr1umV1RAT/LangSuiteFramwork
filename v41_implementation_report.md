# LangSuite v41 — first node-family expansion pass

## Concise execution summary

I extended the stabilized node taxonomy with the first genuinely new workflow-language families that were still missing after v40:

- `command_node`
- `handoff_node`
- `store_put`
- `store_search`

This pass did **not** add another bridge layer.
It added missing graph-language surfaces so the editor can express more of the LangGraph/LangChain control-flow and runtime-store patterns directly.

What is now real:

- the v40 taxonomy pass remains intact
- all UI nodes still have explicit capability metadata
- `command_node` now compiles to a real `Command(update=..., goto=...)` step
- `handoff_node` now compiles to a bounded state-transfer / handoff step using the same `Command` primitive
- `store_put` now compiles to a bounded runtime store write surface
- `store_search` now compiles to a bounded runtime store search surface
- the capability inspector now explains these families explicitly
- state-key detection now includes the new state/query-oriented parameters where relevant

What I did **not** do:

- no `Send` / map-reduce family yet
- no full handoff-as-tool surface yet
- no `store_list` / `store_delete` family yet
- no structured-output dedicated node family yet
- no changes to the v35–v39 lowered / embedded integration tiers

## What v41 targeted

This pass targeted the exact gap identified in the v40 node audit:

1. add the first missing graph-language family for combined update+goto (`Command`)
2. add the first explicit handoff/state-transfer surface
3. add the first runtime store write/search surfaces
4. keep the existing node taxonomy coherent instead of inventing a second parallel ontology

## What was inspected first

I inspected:

- `client/src/nodeConfig.ts`
- `core/schemas.py`
- `core/compiler.py`
- `templates/nodes.py.jinja`
- `templates/graph.py.jinja`
- `client/src/capabilityMatrix.json`
- `client/src/components/CapabilityInspectorSection.tsx`
- `client/src/components/StatePanelContent.tsx`
- `tests/test_v40_node_taxonomy_consistency.py`

The key design constraint was to add new families without breaking the v40 “UI taxonomy ↔ backend validation ↔ compile/runtime” alignment.

## Backend / compiler changes

### Added node families

#### `command_node`
- flow-category surface
- updates a bounded key inside `custom_vars`
- compiles to a real LangGraph `Command(update=..., goto=...)`
- supports at most **one direct outgoing edge** in the current build
- if no direct outgoing edge exists, it degrades to a plain bounded state update instead of inventing fake routing

#### `handoff_node`
- flow-category surface
- updates a bounded handoff key in `custom_vars`
- compiles through the same `Command` primitive
- also supports at most **one direct outgoing edge** in the current build
- intended as a state-transfer / step-transfer surface, not yet as a full tool-return handoff implementation

#### `store_put`
- runtime store write surface
- writes one selected state value into a bounded namespace + key
- can optionally emit a small receipt into state

#### `store_search`
- runtime store search surface
- queries one namespace using a bounded query key from state
- normalizes results into graph state under the configured output key
- uses a defensive multi-signature fallback strategy for `search` / `asearch`

### Validation tightening

`core/compiler.py` now annotates command-like nodes with their direct target and rejects multiple direct outgoing edges for:
- `command_node`
- `handoff_node`

This keeps the first implementation bounded and unambiguous.

### Files changed

Main files changed in this pass:
- `client/src/nodeConfig.ts`
- `client/src/capabilityMatrix.json`
- `client/src/components/CapabilityInspectorSection.tsx`
- `client/src/components/StatePanelContent.tsx`
- `core/schemas.py`
- `core/compiler.py`
- `templates/nodes.py.jinja`
- `templates/graph.py.jinja`
- `tests/test_v41_node_family_expansion.py`

## UI / taxonomy / inspector changes

I kept the v40 taxonomy model and extended it rather than reshuffling it.

### New capability metadata
Each new node family now has explicit metadata in `capabilityMatrix.json`:
- block family
- rail
- execution placement
- surface level
- allowed project modes
- quick props
- summary

### Inspector clarification
The capability inspector now explains:
- `command_node` as a combined state update + goto surface
- `handoff_node` as a bounded state-transfer surface
- `store_put` and `store_search` as runtime store operations distinct from the lighter `memoryreader` / `memorywriter` helpers

### State panel improvement
The state panel now also picks up the new relevant parameters such as:
- `query_key`
- `handoff_key`

That does not solve full sourced diffs yet, but it makes the panel more aware of the new state-oriented families.

## Validation performed

### Frontend
Executed:
- `cd client && npm ci`
- `cd client && npm run build`

Result:
- **passed**

### Tests
Executed:
- `pytest -q tests/test_v40_node_taxonomy_consistency.py tests/test_v41_node_family_expansion.py tests/backend_session_workspace_smoke.py tests/project_tree_hidden_child_smoke.py`

Result:
- **7 passed**

### What the v41 tests covered

- new node families exist both in `nodeConfig.ts` and in `capabilityMatrix.json`
- new node families have explicit runtime metadata
- `command_node` and `handoff_node` compile into real `Command`-based steps with explicit `ends=[...]`
- `store_put` and `store_search` compile into real runtime-store code paths
- command-like nodes reject multiple direct outgoing edges in the current bounded implementation

### What I did not re-claim here

I did **not** rerun browser Playwright smoke for this pass.
The most recent browser environment in this conversation already showed Playwright/Node flakiness (`EPIPE`), and this pass was centered on compile/runtime language expansion rather than new browser-only interaction behavior.

So for v41 I am claiming:
- **frontend build proof**
- **backend/compiler proof**
- **targeted regression proof**

I am **not** claiming fresh browser smoke proof.

## What became more real

- the editor can now express a first bounded `Command`-style update+goto step
- the editor can now express a first explicit bounded handoff/state-transfer step
- the project now has real runtime store write/search surfaces instead of only read helpers and implicit memory abstractions
- the node taxonomy remains coherent while expanding
- the capability inspector can now explain more of the graph language instead of only the older rail/bridge layers

## What remains bounded / deferred

Still bounded:
- `command_node` and `handoff_node` support at most one direct outgoing edge in the current build
- handoffs are node-level surfaces, not yet tool-return handoffs with `ToolMessage`
- no `Send` / map-reduce family yet
- no explicit parent-graph `Command.PARENT` surface yet
- no richer store family like `store_list`, `store_delete`, `store_namespace` yet
- no dedicated structured-output node family yet
- no richer debugger variable-diff provenance model yet

## Recommended v42 direction

The clean next move is:

**v42 — control-flow and state-runtime expansion pass**

in this order:
1. `send_fanout` / bounded Send-style surface
2. richer handoff surface (possibly tool-return aware)
3. `store_delete` / `store_list` only if the store family still feels coherent
4. optional dedicated structured-output surface if the current `structured_schema` params remain too buried

The most important thing is to keep expanding the language in **bounded clusters** rather than adding isolated clever nodes until the graph becomes a landfill with badges.
