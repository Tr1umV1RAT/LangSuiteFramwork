# Repair Log v15

## Baseline used
- Development trunk: **v14**
- Conceptual source branch mined selectively: **v13**

## Important input note
- Exact file `frameworklangchain_repaired_audit_v13.zip` was not available.
- Used instead: `frameworklangchain_langsuite_architecture_v13.zip` plus v13 handoff/audit/validation documents.

## Files added
- `client/src/catalog.ts`
- `frameworklangchain_repair_handoff_v15.md`
- `merge_plan_v15.md`
- `artifact_family_contracts.md`
- `runtime_profile_matrix.md`

## Files updated
- `client/src/nodeConfig.ts`
- `client/src/components/BlocksPanelContent.tsx`
- `client/src/components/CustomNode.tsx`
- `client/src/components/artifacts/ArtifactLibrarySection.tsx`
- `client/src/store.ts`
- `core/artifact_registry.py`
- `core/schemas.py`
- `audit_report.md`
- `repair_log.md`
- `validation_summary.md`

## Main changes

### 1. Reintroduced a conceptual abstraction catalog
- Added a dedicated frontend catalog describing:
  - node abstraction kind,
  - runtime origin,
  - execution placement,
  - execution flavor,
  - compile aliasing strategy,
  - natural artifact/profile compatibility.

### 2. Restored Deep Agents product vocabulary
- Reintroduced the following surface-level node vocabulary:
  - `deep_agent_suite`
  - `deep_subagent_worker`
  - `deep_memory_skill`
- These are intentionally implemented as **semantic/editor aliases**, not as proof of a native deepagents runtime.

### 3. Added compile-safe canonicalization
- Export path now canonicalizes conceptual node types before compile.
- Backend schema validation also normalizes aliases defensively.

### 4. Strengthened blocks panel readability
- Palette can now be grouped by:
  - category
  - abstraction
- Palette can show only nodes compatible with the active surface or all nodes.
- Items display abstraction/runtime badges and compatibility hints.

### 5. Strengthened node-card readability
- Node cards now surface:
  - conceptual kind,
  - runtime origin,
  - execution placement,
  - execution flavor,
  - faux-node status,
  - quick props,
  - auto-link hints,
  - current surface compatibility.

### 6. Advanced artifact wrapper insertion
- Artifact library now supports inserting an artifact into the current graph as a wrapper node.
- Wrapper metadata persisted in node params includes:
  - `artifact_ref_kind`
  - `artifact_ref_id`
  - `artifact_ref_title`
  - `target_subgraph`
  - `wrapper_mode`

### 7. Added built-in deep-agent suite starter
- Registry now ships a built-in `deep_agent_suite_starter` artifact.

## Compatibility aliases documented
- `deep_agent_suite -> sub_agent`
- `deep_memory_skill -> memory_store_read`
- `deep_subagent_worker -> tool_llm_worker`

## Issues encountered during validation
- Existing frontend dependencies in the working snapshot were not reliable enough for a build and required a clean reinstall:
  - removed stale `client/node_modules`
  - reran `npm ci`
- Collaboration websocket sends a `users` event before the `init` event; tests were adapted accordingly.

## Non-goals deliberately preserved
- No claim of a native Deep Agents runtime.
- No claim of a separate LangChain runtime engine.
- No manual browser UX QA in this pass.
- No redesign of collaboration semantics beyond existing last-writer-wins behavior.
