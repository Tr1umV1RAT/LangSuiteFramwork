# LangSuite — Product strategy + truth-layer audit prompt

You are continuing LangSuite from an existing, nontrivial, already-audited repository.
You are **not** starting from scratch.
You must work **code first, docs second, annex third**.
If code and docs disagree, **code wins**.
If old reports disagree with code, **code wins**.

## LANGUAGE

Respond in English.

## ROLE

You are acting simultaneously as a:
- senior **product manager**,
- senior **platform strategist**,
- senior **runtime truth auditor**,
- senior **visual builder UX architect**,
- and senior **implementation realist**.

You are **not** acting as:
- a feature marketer,
- a speculative visionary detached from the repository,
- a broad rewrite assistant,
- or a “make it sound bigger than it is” consultant.

## PRIMARY GOAL

Think deeply and exhaustively about the **future of LangSuite as a product**.
Your first responsibility is to determine whether, in order to make the product materially more appealing and more successful, LangSuite should strengthen the **graph vs runtime truth layer** first.

If yes:
- explain **why**,
- explain **where**,
- explain **how**,
- and explain **what must not be destabilized**.

If no:
- explain what should come first instead,
- why it would produce more product value,
- and what evidence in the codebase supports that conclusion.

You must be exhaustive, but disciplined.
Do **not** get lost in decorative detail.
Do **not** be superficial.

---

# NON-NEGOTIABLE WORKING METHOD

## 1. Code-first evidence discipline

Base conclusions primarily on source code inspection.
Use docs, reports, prompts, handoffs, and historical notes only as:
- trajectory clues,
- reported prior intent,
- or discrepancy detectors.

Do **not** assume parity claims are true just because docs say so.
Do **not** assume a surface is supported just because it exists in the UI.
Do **not** assume a runtime path is real just because a node compiles.

## 2. Product truthfulness

Every conclusion must distinguish between:
- **core and truly supported**,
- **supported with constraints**,
- **compile-only**,
- **editor-only**,
- **package/import-export only**,
- **experimental**,
- **legacy compatibility only**,
- **editorially over-signaled**.

## 3. Minimalism in correction

If you conclude that corrections are needed, prefer:
- relabeling,
- de-emphasis,
- support-matrix clarification,
- safer defaults,
- truthful onboarding,
- bounded UX abstraction,
- additive diagnostics,
- behavioral tests.

Avoid:
- broad architecture rewrites,
- hard deletion of compatibility without replacement,
- large feature growth before truth is restored,
- fake parity between rails or runtimes.

---

# PRODUCT QUESTIONS YOU MUST ARBITRATE

You must address all of the following.

## A. Should LangSuite strengthen the graph-vs-runtime truth layer first?

You must determine:
1. whether this is the highest-leverage next product move,
2. whether the existing repository still has truth gaps between:
   - graph authoring,
   - runtime execution,
   - runtime-event surfaces,
   - compilation,
   - artifacts,
   - wrappers/bridges,
   - and user-visible support signaling,
3. which truth gaps are merely editorial,
4. which truth gaps are structural,
5. which truth gaps actively damage product appeal or first success.

If this should be strengthened first, specify:
- exact layers to improve,
- exact files to touch,
- the smallest credible sequence,
- how to validate each step,
- and what the user-visible benefit would be.

## B. If LangGraph-level capability should increase, at what level?

You must evaluate three classes of expansion and arbitrate among them.

### B-a. Usability / abstraction / UX simplification

Should LangSuite improve usability first by:
- simplifying common operations,
- making prompt standardization faster,
- making common graph building blocks easier to compose,
- allowing higher-level authoring conveniences,
- even if some of that requires controlled abstraction or code-level workaround,
- provided the code stays robust, deterministic, and properly executable?

You must assess:
- what abstractions are healthy,
- what abstractions would become deceptive,
- which operations are currently too verbose or cognitively heavy,
- which UX simplifications would materially improve the product without falsifying runtime truth.

### B-b. Capability expansion by adding more usable items at the LangChain-facing level

Should LangSuite expand by exposing more already-existing tool families or item families, for example LangChain-adjacent tools?

If yes, determine:
- which ones are good product candidates,
- which ones would improve first-use freedom,
- which ones would overload the UX,
- which ones can remain robust in compile/runtime,
- which ones require stronger truth contracts before exposure,
- which ones should remain advanced-only.

Your analysis must preserve:
- robust code,
- deterministic execution,
- truthful support labeling,
- and a non-overloaded interface.

### B-c. Beginning the DeepAgent suite inside LangSuite

Should LangSuite begin integrating the DeepAgent suite now?

If yes, specify under what conditions.
The DeepAgent suite must:
- remain **clearly separated at the code level**,
- remain **separate in interface logic**,
- behave more like a **dashboard or dedicated environment** than merely another palette category,
- still compile appropriately to integrate into the broader project where justified,
- not collapse into a vague hybrid that would be better rewritten from scratch.

You must decide whether:
- DeepAgent should remain out-of-scope for now,
- or start as a distinct bounded subsystem,
- and what the correct integration seam would be.

## C. Mandatory review of still-weak or not-yet-correctly-implemented areas

You must explicitly revisit the following items.
If they are not yet correctly implemented, say so clearly.
If they appear implemented, request or recommend an additional audit based on user feedback.

### C-a. Prompt strip assignable from a dedicated panel
Audit whether a proper prompt-strip authoring/assignment surface exists, is coherent, and is truthful.

### C-b. Module library with category-based loading
Audit whether LangSuite has, or should have, a module library that allows items—especially tools—to be loaded by category in a way that:
- supports custom tool addition,
- avoids cluttering the UX,
- and remains truthful about what is runtime-backed vs editor-only.

### C-c. Improved support for local LLMs and multimodality
Audit support for:
- local LLMs,
- on-the-fly unloading / reloading,
- local provider ergonomics,
- multimodal model usage,
- and whether this is reflected truthfully in runtime and UI.

### C-d. Memory / RAG / semantic surfaces
Audit the state of memory handling, especially:
- memory semantics,
- RAG usage,
- how understandable the naming is,
- whether the UX confuses users,
- whether the names and docs remain understandable and truthful,
- whether checkpoint / persistence / memory terminology is coherent.

---

# REQUIRED AUDIT COVERAGE

You must inspect, reason about, and organize your analysis around **every major program layer**.

## 1. Runtime layer
Inspect the actual runtime truth and runtime pathways, including but not limited to:
- websocket/runtime event emission,
- runtime normalization,
- preflight,
- dependency checks,
- provider truth,
- shell/tool gating,
- run/pause/resume/stop behavior,
- deterministic vs wrapper/bridge execution,
- runtime-state/log coherence,
- emitted fact vs inferred fact.

Likely code areas:
- `api/runner.py`
- `core/runtime_truth.py`
- `core/runtime_preflight.py`
- `core/runtime_dependencies.py`
- `core/provider_contracts.py`
- `tests/test_v7x_*`, `test_v80_*`, and later runtime tests

## 2. Compilation layer
Inspect:
- compile contract truth,
- generated Python path,
- runtime requirements emitted by compilation,
- template correctness,
- compile-safe vs compile-only surfaces,
- where wrapper lowering or embedded-native execution alters truth.

Likely code areas:
- `core/compiler.py`
- `templates/*.jinja`
- `core/bridge_lowering.py`
- compile-related tests

## 3. Interface / UX layer
Inspect:
- default user journey,
- empty state,
- starter path,
- run panel,
- toolbar semantics,
- project manager semantics,
- support badges,
- advanced/simple mode truth,
- package/import/export messaging,
- artifact library messaging,
- whether the UI teaches the strongest supported path first.

Likely code areas:
- `client/src/App.tsx`
- `client/src/store.ts`
- `client/src/nodeConfig.ts`
- `client/src/components/*`
- `client/src/catalog.ts`
- `client/src/capabilities.ts`

## 4. Graphical representation / authoring semantics
Inspect:
- node semantics,
- edge semantics,
- semantic links vs literal runtime edges,
- wrappers/references/subgraphs,
- graph scope markers,
- how faithfully the graphical representation corresponds to compiled/runtime reality,
- which abstractions are healthy and which are misleading.

## 5. Artifact / package / save-open layer
Inspect:
- artifact registry truth,
- package export/import truth,
- save vs package vs compile distinctions,
- artifact open/save consequences,
- what is restored and what is not,
- whether the surface truth is carried consistently.

Likely code areas:
- `api/artifacts.py`
- `core/artifact_registry.py`
- `client/src/api/artifacts.ts`
- artifact library UI
- toolbar/package UI
- state panel publishing UI

## 6. LangChain / bridge / interoperability layer
Inspect:
- what is truly supported,
- what is compile-capable only,
- what is bridge-backed,
- what is embedded-native,
- what is package-only/editor-only,
- where parity is implied incorrectly,
- whether additional LangChain-facing capabilities should be added now.

Likely code areas:
- `core/mode_contracts.py`
- `core/capability_matrix.py`
- `client/src/capabilityMatrix.json`
- bridge tests

## 7. DeepAgent boundary layer
Inspect:
- whether DeepAgents already has meaningful, truthful support,
- whether it is currently only a placeholder/bridge/package concern,
- whether there is enough separation in code and UX,
- and whether a dedicated dashboard/interface path is warranted.

## 8. Consolidation opportunities
You must also identify code that could be consolidated **without risking semantic drift**, especially where truth wording or support classification is duplicated across:
- backend metadata,
- client badges,
- run logs,
- package import/export messages,
- artifact messages,
- support matrices,
- docs.

Do not propose reckless deduplication.
Only propose consolidation where it reduces truth drift.

---

# STRICT AUDIT PROCEDURE

Follow this exact sequence.

## Step 1 — Product truth snapshot
Produce a blunt 5–15 bullet snapshot of what LangSuite really is *today*.
No euphemisms.
No marketing language.

## Step 2 — Support classification matrix
Create a realistic support matrix across:
- LangGraph visual authoring
- compile to Python / zip / runnable export
- in-app runtime execution
- runtime event truth
- save/load/session persistence
- package import/export
- artifact library open/save/publish
- LangChain-facing artifacts
- bridge-backed behavior
- DeepAgent-facing support
- local LLM surfaces
- memory / RAG surfaces

Use categories such as:
- fully supported
- supported with constraints
- compile-only
- editor-only
- package/import-export only
- experimental
- legacy compatibility only

## Step 3 — Graph-vs-runtime truth assessment
Determine whether the graph-vs-runtime truth layer is the highest-value next move.
If yes, rank the top truth gaps by business/product harm.
If no, identify the better next strategic move and explain why.

## Step 4 — Expansion arbitration
Evaluate B-a, B-b, and B-c above.
You must explicitly recommend:
- do now,
- do later,
- keep out for now,
- or split into prerequisite phases.

## Step 5 — Mandatory weak-area review
Audit C-a through C-d.
For each item, classify:
- absent,
- partial,
- misleadingly signaled,
- usable but under-audited,
- or good enough for current product stage.

## Step 6 — Correction procedure if errors or misleading claims are found
If you find truth or product-signaling problems, define a correction procedure with:
- objective,
- why now,
- code areas to touch,
- minimal-diff strategy,
- user-visible effect,
- risk,
- tests.

## Step 7 — Validation strategy
For every proposed change, define validation.
This must include where applicable:
- truth-label consistency checks,
- UI smoke tests,
- artifact/package consequence checks,
- compile happy-path smoke,
- runtime preflight/path checks,
- no regression to runtime event fallback behavior,
- and where relevant, behavioral tests instead of fragile copy-only assertions.

## Step 8 — Final roadmap
Prepare a roadmap in as many steps as necessary.
The roadmap must sequence:
- prerequisite truth work,
- UX/abstraction work,
- capability expansion,
- LangChain/tool exposure decisions,
- DeepAgent separation/integration decisions,
- local LLM/multimodal decisions,
- memory/RAG clarity work.

The roadmap must be realistic.
It must separate:
- immediate,
- short-term,
- medium-term,
- optional/speculative.

---

# CORRECTION RULES IF YOU PATCH ANYTHING

Only patch if a correction is well-supported by evidence.

If patching:
- prefer minimal diffs,
- preserve behavior unless the behavior is the problem,
- do not rewrite compiler/runtime architecture broadly,
- do not remove compatibility without explicit replacement,
- do not broaden product claims.

When correcting, follow this exact procedure:
1. state the problem precisely,
2. identify whether it is editorial, metadata, UX, runtime, compile, or architecture,
3. patch the smallest stable surface that solves the actual problem,
4. add or adjust tests,
5. rerun targeted validation,
6. report any remaining ambiguity honestly.

---

# REQUIRED DELIVERABLES

You must produce all of the following.

## 1. `ProductAnalysis.md`
This is the main analytical document.
It must include:
- product truth snapshot,
- support matrix,
- graph-vs-runtime truth arbitration,
- capability-expansion arbitration,
- mandatory weak-area review,
- recommended strategic sequence,
- and explicit risks.

## 2. `Roadmap.md`
This must contain the concrete phased plan.
Use as many steps as necessary.
Each step must include:
- objective,
- why now,
- code areas,
- user-visible effect,
- validation.

## 3. Optional patch plan or minimal implementation set
Only if justified.
If you believe a minimal correction pass should be applied immediately, specify exactly what it is.

## 4. Validation checklist
A concise but explicit checklist of tests and smoke checks to run.

---

# ADDITIONAL REQUIREMENTS

- Be exhaustive in reasoning, but avoid clutter.
- Do not merely praise existing structure.
- Push back where the product is over-signaled.
- Prefer truth, leverage, and first success over breadth.
- Where uncertainty remains, say so clearly.
- When recommending new capabilities, specify the **truth prerequisites** first.
- When recommending DeepAgent integration, treat it as a **separate product surface**, not just another node family.

Your job is not to flatter the system.
Your job is to determine what should happen next so LangSuite becomes:
- more appealing,
- more understandable,
- more truthful,
- and more successful on first use,
without destabilizing the codebase or making false promises.
