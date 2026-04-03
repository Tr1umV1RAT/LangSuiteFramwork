# LangSuite v21 — narrow truth/flow pass

## 1. Executive summary
This pass stayed inside the existing LangGraph-centered trunk and tightened four places where the product could still drift into fiction: capability visibility, child-subgraph opening behavior, project-tree persistence, and terminology. It did **not** reintroduce visible LangChain or DeepAgents editor/runtime modes.

## 2. What changed
- Added a **capability inspector** fed by the canonical catalog/runtime matrix instead of duplicating truth in UI-only logic.
- Added **child subgraph opening** from `sub_agent` nodes:
  - editable child subgraphs open as child tabs in the current workspace
  - saved subgraph references open as referenced child tabs
  - non-subgraph artifact references stay explicitly wrapper-only
- Hardened **workspace save/load** for one root + child subgraphs:
  - local save now stores a `workspaceTree` snapshot
  - DB load now uses a recursive `/api/projects/{id}/tree` route
  - DB save writes the root graph plus known child subgraphs and stores tab reopening metadata on the root project
- Restored **`rag_retriever_local`** honestly by wiring back the missing node template path and re-exposing it through the runtime-backed catalog matrix.

## 3. Files modified and why
- `client/src/catalog.ts`
  - expanded canonical capability metadata
  - added inspector-friendly derived capability helpers
  - centralized palette-hidden policy and restored `rag_retriever_local` as runtime-backed
- `client/src/store.ts`
  - added capability inspector target state
  - added `openSubgraphTabFromNode()`
  - added workspace-tree local save/load support
  - changed DB load to recursive project-tree loading
  - changed DB save to persist root + known child subgraphs and tab reopening metadata
  - added local parent-tab linkage for unsaved child tabs
- `client/src/components/CapabilityInspectorSection.tsx`
  - new UI component for the catalog/runtime-backed inspector
- `client/src/components/BlocksPanelContent.tsx`
  - added inspector launch buttons for catalog entries
  - moved visible-palette hiding to canonical catalog policy
- `client/src/components/CustomNode.tsx`
  - auto-focuses the inspector on selected nodes
  - adds explicit wrapper/subgraph honesty messaging
  - adds child-tab opening action for real/editable `sub_agent` surfaces
- `client/src/components/StatePanelContent.tsx`
  - embeds the inspector in the side-panel flow
  - adds user-facing persistence honesty note
  - updates ancestor resolution to work for unsaved local child tabs too
- `api/collaboration.py`
  - added `/api/projects/{project_id}/tree` for recursive tree loading
- `templates/nodes.py.jinja`
  - restored the missing `rag_retriever_local` template implementation

## 4. UX truth improvements
- The inspector now tells the user, for the selected node or catalog item:
  - canonical node type
  - compile target type
  - runtime-backed / alias-backed / wrapper / abstraction / legacy status
  - supported execution profiles
  - simple/advanced palette visibility
  - whether it opens a child editor
  - one-line explanation only
- `sub_agent` nodes no longer imply mysterious standalone runtimes:
  - editable child graph
  - referenced saved subgraph
  - wrapper-only reference to a non-subgraph artifact
  are now visually distinguished.
- `deep_agent_suite` is explicitly treated as a legacy alias surface, not a separate active editor/runtime.

## 5. Save/load behavior improvements
- **Local save/load**
  - now persists a `workspaceTree` snapshot containing:
    - root graph
    - known child subgraphs
    - active/open child-tab metadata
  - remains backward compatible with older single-graph JSON
- **DB save/load**
  - root save now persists the root graph plus known child subgraphs (those with a parent node relationship)
  - root project data now stores workspace reopening metadata
  - recursive tree load reconstructs root + child tabs coherently
- **Honesty boundary**
  - global UI preferences are still local preferences, not project-tree data
  - runtime databases / vector stores are **not** persisted by project save
  - orphan exploratory subgraph tabs without a parent relation are not treated as durable project-tree children

## 6. Wrapper/subgraph behavior results
- `sub_agent` without an artifact reference:
  - opens a real editable child tab under the current root workspace
- `sub_agent` referencing `artifact:subgraph/...`:
  - opens the referenced saved subgraph into a child tab under the same root workspace
- `sub_agent` referencing a non-subgraph artifact:
  - stays explicit wrapper/reference only; no fake child runtime is claimed
- `deep_agent_suite`:
  - remains an alias-backed legacy/editor surface and does **not** open a fake peer editor

## 7. Optional RAG restoration result
**Restored.**

Reason this was safe:
- the current codebase already still contained most of the RAG schema/compiler plumbing (`nodeConfig`, `schemas`, `requirements` gating, `has_rag` compiler context)
- what was missing was the actual node template implementation and truthful visible catalog/runtime exposure

What was restored:
- runtime-backed catalog exposure
- inspector metadata
- node template generation in `templates/nodes.py.jinja`
- compile-time dependency exposure through the existing `has_rag` path

What this does **not** mean:
- it does not magically provide a hosted managed vector DB
- it remains a **local Chroma-backed retrieval surface** that depends on a real persisted local vector store being present at runtime

## 8. Validation performed
### Frontend / TypeScript
- `npm run build` ✅
  - TypeScript build passed
  - Vite production build passed
  - `client/dist` regenerated

### Backend smoke
- `python -m py_compile api/collaboration.py db/projects.py core/compiler.py core/schemas.py` ✅
- FastAPI `TestClient` smoke for project tree route ✅
  - created root project
  - created child subgraph project
  - loaded `/api/projects/{root_id}/tree`
  - verified recursive child presence

### RAG restoration smoke
- compiled a minimal graph payload containing `rag_retriever_local` ✅
- verified generated `nodes.py` contains the local retrieval implementation ✅
- verified generated `requirements.txt` includes `langchain-huggingface` and `langchain-chroma` ✅

### Static/source-path validation
- verified visible artifact types remain `graph` + `subgraph` only ✅
- verified visible execution profiles remain `langgraph_sync` + `langgraph_async` only ✅
- verified inspector wiring is present in blocks panel, state panel, and custom nodes ✅
- verified store save/load hooks now read/write `workspaceTree` and DB tree route usage ✅

### Honesty note on validation depth
- capability inspector and wrapper/subgraph flows were validated through successful TypeScript build and source-path checks, not through a full interactive browser automation pass
- project-tree API behavior was smoke-tested server-side

## 9. Remaining risks
- DB tree save currently persists **known child subgraphs** and reopening metadata, but it does not garbage-collect previously saved child rows that are no longer represented in the current workspace.
- The project manager still opens roots from a flat list; it does not yet render the full tree structure in the modal.
- Some older collaboration/session code paths still think in terms of the active tab rather than the full workspace tree.
- The large Vite chunk warning remains a performance follow-up, not a correctness blocker.

## 10. Recommended next pass
A good v22 would stay narrow and do three things only:
1. add a true **project-tree view** inside the project manager modal
2. teach collaboration/session save paths about the root workspace tree instead of only the active tab
3. add a tiny browser-level interaction test pass for:
   - inspector selection
   - child-tab opening from `sub_agent`
   - root + child tree reload
