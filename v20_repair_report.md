# LangSuite v20 repair pass — implementation report

## Scope actually changed

This pass stayed narrow and followed the audited product truth:

- kept the current LangGraph-centered run + compile/export trunk
- kept side panels
- kept subgraphs as the only intended tabbed children
- hid misleading visible creation/editing surfaces for LangChain / DeepAgents
- reduced stale palette/runtime drift instead of expanding the runtime

## What changed

### 1) Mode surface cleanup

**Files:**
- `client/src/components/Toolbar.tsx`
- `client/src/components/TabBar.tsx`
- `client/src/components/StatePanelContent.tsx`
- `client/src/components/artifacts/ArtifactLibrarySection.tsx`
- `client/src/catalog.ts`

**Changes:**
- Renamed the top-level shell buttons from **Graph simple / Suite** to **Graph / Advanced** so the UI no longer implies a separate suite runtime.
- Removed visible creation paths for `agent` and `deep_agent` from the artifact library shell.
- Restricted visible artifact/profile selectors to the real trunk:
  - artifact surface: `graph`, `subgraph`
  - execution profiles: `langgraph_sync`, `langgraph_async`
- Added honest **legacy surface / legacy metadata** fallback options when older tabs are loaded from saved data.
- Tab badges now collapse legacy surfaces to `LEG` / `legacy` instead of advertising fake peer runtimes.
- Origin labels in the catalog were made more honest (`LangChain surface`, `DeepAgents surface`).

### 2) One-root-project workspace enforcement

**File:** `client/src/store.ts`

**Changes:**
- Added strict root-vs-subgraph tab handling.
- Opening a **root** project now replaces the current root workspace instead of accumulating multiple root projects in tabs.
- Opening a **subgraph** still appends it as a tab.
- Closing the root workspace now resets the editor to a fresh empty root project instead of leaving an orphaned multi-root state.

**Result:**
- one root project at a time
- subgraphs remain the intended tabbed children
- less workspace drift and less state ambiguity

### 3) Adjustable layout settings

**Files:**
- `client/src/store.ts`
- `client/src/components/SettingsShell.tsx`
- `client/src/components/SidePanelSystem.tsx`
- `client/src/components/RunPanel.tsx`

**Changes:**
- Added persistent workspace preferences for:
  - blocks panel width
  - debug panel width
  - state panel width
  - run panel height
- Wired those values into the live layout.
- Presets now also set sane default layout values.

**Result:**
- the side rails can be kept narrower
- the run panel height is no longer hardcoded
- layout tuning is persistent and user-visible

### 4) Runtime-backed palette enforcement

**Files:**
- `client/src/catalog.ts`
- `client/src/components/BlocksPanelContent.tsx`
- `client/src/components/CustomNode.tsx`

**Changes:**
- Added a canonical runtime-backed node matrix in `client/src/catalog.ts`.
- The block palette now filters out node surfaces that are not backed by the current compile/runtime templates.
- This specifically removes stale decorative fossils such as `rag_retriever_local` from the visible palette.
- Existing already-loaded unsupported nodes are flagged in-node as **Hidden from palette** instead of silently pretending everything is fine.

**Result:**
- less UI/runtime overclaim
- a clearer contract between palette visibility and actual runtime support

### 5) Build script hardening

**File:** `client/package.json`

**Change:**
- Replaced the broken `tsc`/`vite` bin invocation with direct Node execution:
  - `node node_modules/typescript/bin/tsc -b`
  - `node node_modules/vite/bin/vite.js build`

**Why:**
- the archived `.bin/tsc` shim in this delivered branch was broken in the container
- the repaired script now builds correctly with the vendored modules already present

## Validation performed

### Frontend build

Executed successfully:

```bash
cd client
npm run build
```

Result:
- TypeScript build passed
- Vite production build passed
- Dist assets regenerated successfully

### Notes

- Vite still reports a large chunk warning (~573 kB JS bundle). That is a performance follow-up, not a correctness blocker for this pass.
- I did **not** expand runtime semantics, add a real LangChain editor/runtime, or add a real DeepAgents editor/runtime.

## Intentional non-changes

- No broad store decomposition in this pass.
- No runtime redesign.
- No new compile surface.
- No multi-user redesign.
- No attempt to revive stale nodes by inventing backend support.

## Practical next step after this pass

1. Add an explicit **surface/capability inspector** panel sourced from the new catalog matrix.
2. Finish the subgraph opening flow from wrapper/reference nodes so the one-root workspace model is fully exercised in UI, not just enforced in store behavior.
3. Split the large client bundle once product truth has stabilized.
4. Only then revisit whether `agent` / `deep_agent` deserve real independent runtimes or should remain hidden legacy vocabulary.
