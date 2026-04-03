# LangSuite v33 — Project Mode Integration Pass

## Concise execution summary

This pass converted the earlier artifact/profile-only distinction into a more explicit **project mode** model:

- **LangGraph mode** — visible, editor + runtime
- **LangChain mode** — visible, editor-only in-app for now
- **DeepAgents mode** — visible, editor + runtime, with values-first streaming defaults

The stable LangGraph trunk remains the execution anchor.
DeepAgents mode now has a more truthful bounded role: it is surfaced as a distinct project mode with its own node/API surface and runtime defaults, while still remaining trunk-backed in the current implementation.

## What this pass targeted

1. Add explicit project-mode selection at project creation.
2. Gate palette/library/API surfaces by project mode.
3. Persist project mode through workspace/package/session flows.
4. Block in-app runtime for editor-only LangChain mode.
5. Give DeepAgents mode its own runtime defaults and clearer semantics.

## Exact changes made

### Canonical mode/capability model
- Added `projectModes` to `client/src/capabilityMatrix.json`
- Added `ProjectMode` helpers and normalization in `client/src/capabilities.ts`
- Added Python-side project-mode loading helpers in `core/capability_matrix.py`

### Frontend state and persistence
- Added `projectMode` to tab and workspace snapshot types in `client/src/store/types.ts`
- Added project-mode-aware defaults/import normalization in `client/src/store/workspace.ts`
- Wired project mode through export/import/session/save/load flows in `client/src/store.ts`

### UI surfacing
- Project creation now offers explicit **LangGraph / LangChain / DeepAgents** choices in `client/src/components/ProjectManager.tsx`
- Tabs now show a project-mode badge in `client/src/components/TabBar.tsx`
- Palette compatibility now depends on `projectMode` in `client/src/components/BlocksPanelContent.tsx`
- Artifact library now filters by active project mode in `client/src/components/artifacts/ArtifactLibrarySection.tsx`

### Backend/API alignment
- Added `project_mode` support to `UIContext` validation in `core/schemas.py`
- Added artifact API filtering by `project_mode` in `api/artifacts.py`
- Added artifact manifest/listing fallback inference for `projectMode` in `core/artifact_registry.py`
- Propagated `projectMode` through collaboration/session sync in `api/collaboration.py`

## Why those changes matter

Before v33, broader surfaces were classified, but the user-visible authoring model still revolved mostly around artifact type and profile.

After v33:
- users choose a **project mode** explicitly,
- mode-specific nodes stop bleeding across unrelated modes,
- LangChain mode is honestly editor-only in-app,
- DeepAgents mode gets a more meaningful runtime identity,
- and persistence no longer loses the mode selection.

## Truth boundaries preserved

- LangGraph remains the proven trunk.
- LangChain is **not** presented as a fully earned in-app peer runtime.
- DeepAgents is surfaced as a distinct mode, but still treated as **trunk-backed** rather than falsely independent.
- Default compile/export safety from v29+ remains intact.

## Validation performed

### Frontend
- `cd client && npm ci`
- `cd client && npm run build`

### Python / backend regression
- `pytest -q tests/test_v29_compile_truth.py tests/test_v30_runtime_validation.py tests/test_v32_platform_rails.py tests/test_v33_project_modes.py`
- Result: **13 passed**

### Browser/manual-style smoke
- `python tests/browser_smoke_v33.py`
- Verified:
  - LangGraph mode shows `llm_chat`, hides LangChain/DeepAgents mode-specific nodes
  - LangChain mode shows `react_agent`, hides LangGraph/DeepAgents mode-specific nodes
  - DeepAgents mode shows `deep_agent_suite`, hides LangGraph/LangChain mode-specific nodes
  - DeepAgents tabs default to `streamMode = values`

### Persistence smoke
- `python tests/backend_session_workspace_smoke.py`
- `python tests/project_tree_hidden_child_smoke.py`

## What became more real

- Project mode is now a first-class concept.
- The product has a truthful split between **three editor modes** and **two runtime-enabled modes**.
- DeepAgents mode now has explicit runtime defaults rather than just leftover labeling.

## What remained intentionally deferred

- A truly independent DeepAgents backend runtime was **not** claimed.
- LangChain in-app runtime was **not** added.
- Broader module/API families beyond the current bounded surfaces remain future work.
- Full per-mode backend route families were not exploded into large separate subsystems yet.

## Recommended next pass

**v34 — Per-mode backend/API tightening + first useful LangChain editor workflow**

Good targets:
- stricter per-mode compile endpoint preflight,
- per-mode starter/module families,
- a first genuinely useful LangChain editor/export workflow,
- clearer state-panel mode controls and mode-specific module bundles.
