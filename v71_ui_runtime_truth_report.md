# LangSuite v71 — UI runtime truth pass report

## 1. Executive summary

This pass focused on making the authored graph, the runtime/debug surfaces, and local-tool execution results line up more truthfully and readably.

I implemented a shared frontend execution-truth layer for local mutation and shell tool payloads, then wired it into:

- graph node cards,
- run log cards,
- the debug panel,
- and the state / variables tree.

The result is that preview / applied / blocked / failed / partially_applied statuses are no longer confined to raw JSON blobs. They now show up as compact readable signals across the main UI surfaces the repo already supports.

I also extended the capability matrix entries for local mutation and shell tools so the node inspector and quick-help surfaces describe the same truth model the runtime actually emits.

## 2. Actual repository findings before implementation

The repo already had the right UI anchors for this pass:

- `client/src/components/CustomNode.tsx` for authored graph cards,
- `client/src/components/RunPanel.tsx` for run tracking,
- `client/src/components/DebugPanelContent.tsx` for live runtime/debug state,
- `client/src/components/StatePanelContent.tsx` for runtime variables/state,
- `client/src/components/CapabilityInspectorSection.tsx` for semantic truth,
- `client/src/store.ts` for websocket event ingestion and run-log shaping,
- `client/src/capabilityMatrix.json` as the semantic source of truth.

The main gap was not the absence of UI surfaces; it was the absence of a shared interpretation layer for structured local-tool outputs.

Before this pass:

- the graph could not clearly show whether a local mutation node had most recently previewed, applied, blocked, or failed;
- the run panel still relied heavily on raw payload display;
- the debug panel knew about live state and next nodes, but not about compact local-operation truth;
- the state tree treated local-tool result payloads like generic strings/objects rather than recognizable operation results;
- and the capability matrix entries for local mutation / shell tools still lacked runtime-debug projection guidance.

## 3. Implementation plan grounded in the repo

I kept the pass narrow and repo-native:

1. Add one shared parser/summarizer for local-tool observation payloads.
2. Reuse that layer in store log shaping, run logs, debug, graph nodes, and state tree.
3. Add only the smallest runtime-state styling needed for graph-node readability.
4. Extend the capability matrix for the affected tools so inspector/help copy matches the real runtime truth.
5. Validate with targeted tests and syntax-level frontend checks rather than pretending a full frontend build succeeded without installed dependencies.

## 4. Concrete changes made

### A. Shared execution-truth layer

Added:

- `client/src/executionTruth.ts`

This file provides:

- `parseToolObservation(...)`
- `summarizeToolObservation(...)`
- `describeToolObservationCounts(...)`
- `collectToolObservationsFromObject(...)`

It parses the structured payloads emitted by the local filesystem and shell tools and normalizes fields like:

- toolkit,
- operation,
- status,
- reasonCode,
- mode,
- path,
- filesToModify / filesToCreate / filesRejected,
- matchCount / replacementCount,
- allowedCommands,
- exitCode,
- stdout / stderr.

### B. Store / run-log shaping

Updated:

- `client/src/store.ts`
- `client/src/store/types.ts`

`RunLogEntry` now carries:

- `toolkit`
- `operation`
- `executionStatus`
- `operationSummary`

The websocket ingestion path now extracts structured local-tool truth from node-update payloads instead of leaving that information buried in raw JSON.

### C. Run panel readability

Updated:

- `client/src/components/RunPanel.tsx`

Run log cards now:

- render compact execution-status badges,
- show toolkit / operation chips,
- surface local-tool summaries,
- show path / mode / counts / reason codes,
- and still preserve raw JSON underneath for inspection.

### D. Debug/runtime correspondence

Updated:

- `client/src/components/DebugPanelContent.tsx`

Added:

- an execution-correspondence section tying scheduled nodes and last executed node together,
- explicit display of last local-tool status,
- a compact recent local-operation activity section.

This makes the debug panel better at answering “what is the graph doing right now?” and “which local operation just happened?” without requiring raw JSON reading first.

### E. Graph-node runtime readability

Updated:

- `client/src/components/CustomNode.tsx`
- `client/src/index.css`

Node cards now respond to real runtime information already present in the store:

- scheduled node,
- currently executing node,
- awaiting input / paused node,
- latest local operation result for that node.

Added runtime visual states / summaries for:

- queued,
- running,
- paused,
- blocked,
- failed,
- recent tool-operation summary.

This improves authored-graph ↔ runtime correspondence without inventing new runtime semantics.

### F. Variables/state readability

Updated:

- `client/src/components/StatePanelContent.tsx`

The recursive state tree now recognizes local-tool observation payloads and renders them as meaningful runtime operation summaries with compact chips for:

- status,
- toolkit.operation,
- mode,
- path,
- counts,
- reason code.

That improves the “variables/state” side specifically, which was part of the requested pass.

### G. Capability / inspector truth

Updated:

- `client/src/capabilityMatrix.json`

Added `debugProjection`, `uiAbstractionNotes`, and `linkSemantics` for:

- `tool_fs_write_file`
- `tool_fs_edit_file`
- `tool_fs_apply_patch`
- `tool_shell_command`

This means the inspector and quick-help surfaces now describe:

- preview vs apply,
- non-mutation during preview,
- blocked/failed truth,
- non-atomic patch limitations,
- shell user-armed gating,
- non-sandboxed shell semantics.

## 5. Tests added/updated

Added:

- `tests/test_v71_ui_runtime_truth_pass.py`

This test file verifies:

- capability-matrix runtime/debug projection entries for local mutation and shell tools,
- existence and reuse of the shared execution-truth layer,
- graph/debug/run/state UI source integration,
- runtime graph-node styling hooks.

Previously-added v70 local-mutation tests remained relevant and were re-run.

## 6. Test results actually run

### Python tests

Command:

```bash
pytest -q tests/test_v65_authored_tool_semantics.py tests/test_v68_local_mutation_and_shell_tools.py tests/test_v69_apply_patch_tool.py tests/test_v70_local_mutation_trust.py tests/test_v71_ui_runtime_truth_pass.py
```

Result:

- `30 passed`

### Frontend dependency/build check

Attempted:

```bash
cd client && npm run build
```

Actual result:

- failed because `client/node_modules` is not present in the uploaded repo and the local build script expects `client/node_modules/typescript/bin/tsc`.

This is an environment/dependency limitation, not a repo-truth signal I should hide.

### Syntax-level frontend validation actually run

Because the full frontend dependency tree is absent, I ran a TypeScript syntax transpile over the modified files using the globally available TypeScript installation.

Validated files:

- `client/src/executionTruth.ts`
- `client/src/store.ts`
- `client/src/components/RunPanel.tsx`
- `client/src/components/DebugPanelContent.tsx`
- `client/src/components/CustomNode.tsx`
- `client/src/components/StatePanelContent.tsx`

Result:

- all modified frontend files transpiled without syntax diagnostics.

## 7. Remaining gaps / known limitations

1. I did not add a dedicated bespoke visual diff/preview widget for patch payloads. The repo now surfaces truthful structured summaries and counts, but not a custom patch review UI.
2. I did not claim a full frontend build passed, because the uploaded repo does not include installed frontend dependencies.
3. This pass improves correspondence and readability, but it does not introduce a new execution timeline engine or graph animation model beyond the runtime data the repo already provides.

## 8. Recommended next pass

The most valuable next pass would be a **focused result-rendering and timeline pass** for runtime events, not another backend semantics pass.

Good scope:

- a compact timeline view for node execution order,
- richer patch preview cards in run/debug panels,
- explicit grouping of node-enter / node-result / state-sync moments,
- optional emphasis of graph paths corresponding to `liveState.next` and the most recent executed node.

That would extend this pass’s truth layer into a more legible end-user execution narrative without inventing new backend semantics.

## 9. Final artifact list

Updated repo archive:

- `LangSuite_v71_ui_runtime_truth_pass.zip`

Report:

- `v71_ui_runtime_truth_report.md`

Handoff:

- `v71_ui_runtime_truth_handoff.md`
