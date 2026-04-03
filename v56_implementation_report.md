## Concise execution summary

I treated this as a **browser/manual UX audit + graph-scope / detached surface guidance pass**, but I kept it grounded in code and validated behavior rather than claiming human-browser proof I did not actually perform.

What is now real:

- the toolbar exposes a compact **Canvas semantics** help entry point
- the help popover explains the three concepts that were still too easy to confuse:
  - detached interactive circuits
  - graph-scope markers
  - semantic link families
- the State Panel now has a dedicated **Sémantique du canvas** section
- the UI now explains more directly that some handles/chips are authoring abstractions rather than literal one-to-one runtime edges
- the guidance is dynamic and uses real validation state counts rather than static prose

What I did not claim:

- no fresh browser/manual smoke proof
- no runtime model changes
- no new compile semantics
- no attempt to redesign connection logic again

## What v56 targeted

- make graph-scope / detached semantics easier to understand from the existing UI
- reduce the chance that users misread detached components as errors when they are actually intentional authoring structures
- reduce the chance that users misread graph-scope markers as nodes that require literal flow edges
- improve the “what am I really drawing?” story without changing the actual execution model

## What was inspected first

I inspected:

- `client/src/components/Toolbar.tsx`
- `client/src/components/StatePanelContent.tsx`
- `client/src/graphUtils.ts`
- existing graph validation summaries (`detachedComponentCount`, `graphScopeMarkerIds`, `semanticEdgeSummary`)
- the current v55 graph-scope marker handling and detached component messaging

Key starting reality:

- the product already knew about detached components, graph-scope markers, and semantic links
- but the explanation was scattered and still too implicit
- the information existed more in validation state than in a coherent UX surface

## UI guidance changes

### Toolbar

Added a compact **Canvas semantics** help button (`toolbar-canvas-help`) that opens a popover with:

- a short explanation that the canvas is an authoring language
- a reminder that some handles/chips represent semantic attachments or graph-scope settings rather than literal one-to-one runtime edges
- live counts for:
  - detached interactive circuits
  - graph-scope markers
  - semantic link kinds
- a machine-readable-ish / inspectable list of semantic link families present in the current graph

The popover closes on outside click.

### State Panel

Added a new dedicated section:

- **Sémantique du canvas**

It now shows:

- detached circuit count
- graph-scope marker count
- semantic link family count
- a list of semantic link kinds present
- a short explanation that these are authoring abstractions and not always literal runtime edges

This complements the existing execution/memory sections instead of burying the explanation inside unrelated runtime settings text.

## Why these changes matter

This pass does not change runtime truth.
It changes whether the UI tells the truth intelligibly.

Before this pass:

- detached components were visible indirectly
- graph-scope markers were explained, but mostly in checkpoint-specific places
- semantic link families were counted, but not presented as part of a coherent mental model

After this pass:

- users have a clearer on-demand explanation of the canvas grammar
- detached circuits, graph-scope markers, and semantic links are presented as distinct concepts
- the UI is more honest about the fact that the authoring surface is not a literal AST dump of the compiled LangGraph code

## Validation performed

### Tests

Executed:

- `pytest -q tests/test_v49_memory_ui_simplification.py tests/test_v50_node_insertion_ux_semantics.py tests/test_v51_detached_components_and_affordances.py tests/test_v52_quickstart_help_ui.py tests/test_v53_connection_gesture_refinement.py tests/test_v54_graph_scope_marker_semantics.py tests/test_v55_checkpoint_toggle_and_graph_scope_ui.py tests/test_v56_canvas_guidance.py tests/backend_session_workspace_smoke.py tests/project_tree_hidden_child_smoke.py`

Result:

- **25 passed**

### Frontend build

Executed:

- `cd client && npm ci`
- `cd client && npm run build`

Result:

- **passed**

### Not performed

I did **not** perform a new browser/manual smoke pass in this environment, so I am not claiming fresh real-user interaction proof.

## What became more real

- graph-scope marker semantics are now easier to find and understand
- detached circuits are now presented as a known authoring concept rather than a semi-hidden validation detail
- semantic link families are now surfaced as part of the editor’s language, not just as hidden metadata
- the product better explains the difference between:
  - literal runtime edges
  - semantic attachments
  - graph-scope settings

## What remains bounded / deferred

Still deferred:

- a true fresh browser/manual audit with human interaction traces
- richer connection rejection feedback directly during drag gestures
- stronger detached workflow guidance (for example: suggested actions or auto-grouping)
- more explicit authoring-vs-runtime documentation woven into more UI surfaces

## Recommended next pass

The cleanest next move is:

**v57 — live connection feedback + detached workflow actions pass**

Priority targets:

1. inline feedback when a connection gesture is rejected
2. clearer suggested actions for detached interactive circuits
3. lightweight actions for detached circuit management (focus, isolate, promote, or acknowledge)
4. continued refinement of the editor as an authoring language rather than a fake literal graph mirror
