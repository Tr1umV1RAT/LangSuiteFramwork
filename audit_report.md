# Audit Report v15

## Scope
This pass resumed from the existing v13/v14 audit trail and merged the strongest conceptual parts of v13 into the stronger v14 product trunk.

Target of this pass:
- keep v14 as the editor/persistence/runtime trunk,
- recover the conceptual abstraction layer and readability lost from v13,
- reintroduce Deep Agents vocabulary honestly as surface semantics,
- advance artifact-as-node wrapping,
- validate the merged state without overstating runtime support.

## Input state and traceability

### A. Observed
- The provided inputs were sufficient to continue the merge campaign:
  - v13 source snapshot
  - v13 handoff/audit/validation docs
  - v14 repaired snapshot
  - v14 handoff/audit/repair/validation docs
  - comparative report
- The exact file `frameworklangchain_repaired_audit_v13.zip` was **not** present as such. The available v13 source archive was `frameworklangchain_langsuite_architecture_v13.zip`.
- The comparative report and code inspection both supported the same conclusion: **v14 is the correct trunk** and v13 should be mined selectively for conceptual strengths.

### B. Inferred
- The missing exact repaired-v13 archive slightly reduces forensic certainty about whether every v13 concept observed in docs still matched a “post-repair” tree.
- This did **not** block the work because the conceptual deltas to recover were clear enough in the code and handoff trail.

### C. Recommended
- Keep using v14-derived branches as the execution baseline.
- Treat v13 chiefly as a semantic/UI/reference branch, not as a runtime trunk.

## Architectural truth after inspection

### A. Observed
- The project remains a **LangGraph-oriented compiled runtime** in actual execution truth.
- v14 already had the stronger foundation for:
  - filesystem-backed artifact registry,
  - scoped tabs and hierarchy,
  - artifact families (`graph`, `subgraph`, `agent`, `deep_agent`),
  - richer `ui_context` propagation,
  - better debug/runtime scope visibility,
  - recursive binding inheritance on the editor/export side.
- v13 still carried a stronger conceptual layer around:
  - abstraction family readability,
  - origin/execution-placement vocabulary,
  - builder mode semantics,
  - clearer “what kind of thing is this?” cognition.

### B. Inferred
- The profitable merge direction is not “two editors” or “two runtimes”, but one editor with an explicit conceptual layer on top of the current runtime truth.
- The user-facing vocabulary can be richer than the current runtime implementation, provided the distinction is documented and enforced through aliases instead of fiction.

### C. Recommended
- Continue with one editor shell, one project model, one persistence model.
- Keep multiple artifact families and runtime profiles as metadata and UI contracts.
- Only claim separate runtime support when a separate runtime actually exists.

## Repairs applied in v15

### 1. Conceptual runtime/catalog layer restored

#### A. Observed
- Added `client/src/catalog.ts`.
- This file reintroduces explicit metadata for node families and runtime semantics:
  - abstraction kind,
  - origin,
  - execution placement,
  - execution flavor,
  - compile strategy,
  - compile alias,
  - quick props,
  - natural artifact/profile compatibility.

#### B. Inferred
- This recreates the most valuable part of the v13 conceptual layer without forcing a v13-style architecture rollback.

#### C. Recommended
- Keep extending conceptual metadata here rather than scattering it across UI components.

### 2. Deep Agents vocabulary reintroduced honestly

#### A. Observed
- Reintroduced or cleanly re-expressed the v13 vocabulary blocks in `client/src/nodeConfig.ts`:
  - `deep_agent_suite`
  - `deep_subagent_worker`
  - `deep_memory_skill`
- Added defensive backend aliasing in `core/schemas.py`.
- Added compile-time canonicalization in `client/src/store.ts`.

#### B. Inferred
- These blocks now exist as **surface/product vocabulary** while still compiling through current canonical nodes.
- This preserves the user’s conceptual language without pretending that a native Deep Agents runtime already exists.

#### C. Recommended
- Keep documenting these as semantic wrappers/aliases until a real dedicated adapter or runtime exists.

### 3. Palette readability and filtering strengthened

#### A. Observed
- `client/src/components/BlocksPanelContent.tsx` was upgraded to support:
  - grouping by category or abstraction,
  - compatibility filtering by current artifact/profile surface,
  - origin/kind badges,
  - explicit “hors surface” signaling.

#### B. Inferred
- This is the clearest recovery of v13’s cognitive-map strength.
- The UI no longer behaves like a shapeless node shelf; it now teaches the editor’s abstraction model.

#### C. Recommended
- Extend this same logic later to starter artifacts and published wrappers, so both palette items and artifacts speak the same conceptual language.

### 4. Node card readability improved

#### A. Observed
- `client/src/components/CustomNode.tsx` now surfaces:
  - abstraction kind,
  - runtime origin,
  - execution placement,
  - execution flavor,
  - faux-node information,
  - surface compatibility,
  - quick props,
  - auto-link hints.

#### B. Inferred
- This closes one of the main cognition gaps: users can now inspect a node and immediately see what it is supposed to mean.

#### C. Recommended
- Keep the badges concise and stable; do not turn them into verbose prose in the node header.

### 5. Artifact-as-node wrapper flow advanced

#### A. Observed
- Added `addArtifactWrapperNode(...)` in `client/src/store.ts`.
- `client/src/components/artifacts/ArtifactLibrarySection.tsx` now allows:
  - opening an artifact in its own tab,
  - inserting it as a wrapper node into the current graph.
- Wrapper insertion records explicit metadata such as:
  - artifact reference kind/id/title,
  - target subgraph reference,
  - wrapper mode.

#### B. Inferred
- This is the most concrete progress in the “publish artifact -> reuse as node” direction.
- The system now has a real bridge between registry and graph composition, not only a registry browser.

#### C. Recommended
- Next pass should formalize transparent vs semi-opaque vs opaque contracts at the manifest/interface level.

### 6. Built-in deep-agent starter enriched

#### A. Observed
- Added a `deep_agent_suite_starter` built-in manifest in `core/artifact_registry.py`.

#### B. Inferred
- This provides a clean semantic starter for the `deep_agent` family while staying honest about the current compiler/runtime.

#### C. Recommended
- Continue adding starters only when they are semantically useful and not fake-feature theater.

## Compatibility aliases introduced

### A. Observed
- Canonical compile aliases now include:
  - `deep_agent_suite -> sub_agent`
  - `deep_memory_skill -> memory_store_read`
  - `deep_subagent_worker -> tool_llm_worker`
- Backend schema validation accepts these aliases and normalizes them.

### B. Inferred
- This is the correct compromise: preserve product language while keeping one execution truth.

### C. Recommended
- Keep a single explicit alias table. Do not let aliases sprawl silently through many files.

## Validation results

### A. Observed
Validated successfully:
- `python -m compileall api core db main.py`
- `npm ci`
- `npm run build`
- artifact registry list/load/save through FastAPI test client
- representative `/compile` payload using:
  - `deep_agent_suite`
  - `deep_memory_skill`
  - `deep_subagent_worker`
- project persistence roundtrip for wrapper metadata
- collaboration websocket sync persistence for `artifactType`, `executionProfile`, wrapper metadata, and runtime settings

Notable build note:
- frontend build completes successfully, with a Vite chunk-size warning only.

### B. Inferred
- The merge is structurally sound enough to ship as a next branch.
- The conceptual alias layer is now wired deeply enough to survive save/load/compile flows.

### C. Recommended
- Perform manual browser QA next, especially on:
  - palette grouping/filtering,
  - wrapper insertion UX,
  - badge density/readability,
  - node compatibility signaling.

## Open uncertainties / unresolved limits

### A. Observed
- The runtime is still fundamentally LangGraph-centric.
- `langchain_agent` and `deepagents` remain mostly profile/editor abstractions layered over the current pipeline.
- Graph binding inheritance is stronger on the editor/export side than in fully dynamic execution semantics.
- Collaboration remains effectively **last-writer-wins**.
- No real provider-backed LangGraph/LangChain/Deep Agents live execution was validated in this environment.

### B. Inferred
- The project is now semantically clearer than before, but not yet semantically complete.
- The remaining high-value work is mostly around contract clarity and deeper runtime semantics, not around adding more decorative node types.

### C. Recommended
- Next profitable pass:
  1. formalize wrapper interface contracts,
  2. deepen graph bindings into generated runtime semantics where still shallow,
  3. strengthen scope-level execution parameters and inheritance UX,
  4. prepare supergraph semantics more explicitly,
  5. only then widen the starter catalog.
