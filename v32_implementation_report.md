# LangSuite v32 broader platform integration report

## 1. Concise execution summary

This v32 pass moved LangSuite from a narrowly truth-hardened trunk toward a more disciplined broader-platform shape without pretending that every rail is equally mature.

I completed the first four passes from the broader-platform integration brief:
- **Pass 1**: latent feature inventory, rail mapping, and ontology classification.
- **Pass 2**: internal integration and capability/rail contract consolidation.
- **Pass 3**: advanced-mode UI surfacing with explicit status and constraints.
- **Pass 4**: compile/run semantics validation and regression protection.

The LangGraph-centered graph/subgraph compile/run path remains the stability anchor. Broader concepts now have clearer status, clearer boundaries, and better system meaning instead of floating as leftover vocabulary.

## 2. What this pass targeted

This pass targeted the transition described in the broader-platform integration program:
- preserve the validated LangGraph-first trunk,
- inventory and classify latent broader-platform concepts,
- give those concepts bounded architectural roles,
- expose only the smallest coherent advanced surface,
- and validate compile/run/UI semantics so the broader rails are not merely decorative.

## 3. What was inspected first

Initial inspection focused on the current truth and drift points across:
- `client/src/capabilityMatrix.json`
- `client/src/capabilities.ts`
- `client/src/catalog.ts`
- `client/src/store.ts`
- `client/src/store/workspace.ts`
- `client/src/components/BlocksPanelContent.tsx`
- `client/src/components/StatePanelContent.tsx`
- `client/src/components/CapabilityInspectorSection.tsx`
- `client/src/components/TabBar.tsx`
- `client/src/components/artifacts/ArtifactLibrarySection.tsx`
- `core/capability_matrix.py`
- `core/artifact_registry.py`
- `api/artifacts.py`
- `api/collaboration.py`
- runtime compile and execution tests

## 4. What was changed

### Pass 1 — rail inventory and ontology mapping

A broader-platform rail model was made explicit in the shared capability matrix:
- **Rail 0 — trunk**: LangGraph graph/subgraph compile/run path.
- **Rail 1 — composition**: subgraphs and wrapper-backed structural composition.
- **Rail 2 — agentic**: assistant/agent-shell surfaces that are meaningful but not default-trunk-equal.
- **Rail 3 — adapter**: future-runtime / adapter-backed concepts such as deep-agent shells.
- **Rail 4 — services**: artifact library, packaging, visibility, validation, and coordination support.

Artifact kinds, execution profiles, and node families were classified with explicit metadata:
- rail ownership,
- surface level (`stable`, `advanced`, `internal`),
- packaging eligibility,
- trunk dependence,
- adapter-backed / wrapper-backed status,
- direct compile / direct run semantics.

### Pass 2 — internal integration and capability contracts

The capability matrix became the canonical source for broader-rail truth in both frontend and backend.

Implemented in:
- `client/src/capabilityMatrix.json`
- `client/src/capabilities.ts`
- `core/capability_matrix.py`

This centralization now drives:
- artifact-kind visibility,
- advanced artifact-library inclusion,
- execution-profile visibility,
- node surface visibility,
- rail/status labeling,
- backend artifact listing semantics.

The artifact registry and API now support three meaningful surfaces:
- **default**: stable, earned library surface only,
- **advanced**: opt-in broader surfaces with bounded status,
- **hidden/internal**: full internal inventory only when explicitly requested.

### Pass 3 — advanced-mode UI surfacing

The UI now surfaces broader concepts only in advanced mode and only when those concepts have a defined system role.

Changes include:
- advanced nodes shown in the block panel only when editor mode is advanced,
- advanced artifact kinds visible in the artifact library only via `include_advanced=true`,
- state panel artifact/profile selectors now derive from editor mode and scope,
- capability inspector now shows rail, surface level, trunk dependence, adapter-backed status, direct compile, and direct run,
- tab badges and titles now distinguish graph/subgraph/agent/deep-agent shells more honestly.

### Pass 4 — compile/run validation and regression protection

Added or updated tests for:
- advanced artifact-library gating,
- advanced artifact API gating,
- advanced root surface preservation,
- advanced root import semantics,
- compile/run behavior for agent-shell and deep-agent-shell surfaces,
- truthful alias-backed / trunk-dependent fallback behavior,
- advanced palette visibility in browser smoke.

## 5. Why those changes matter

These changes matter because they convert broader-platform leftovers into bounded, interpretable system constructs:
- the default trunk remains honest and lean,
- broader concepts can exist without pretending equal maturity,
- the frontend and backend now speak a more unified ontology,
- advanced surfaces are explained instead of silently drifting,
- compile/run claims are better aligned with what the system can actually do.

This reduces lie-margin while preserving broader-platform optionality.

## 6. Validation performed

### Built / executed

Executed successfully:
- `cd client && npm ci`
- `cd client && npm run build`
- `pytest -q tests/test_v29_compile_truth.py tests/test_v30_runtime_validation.py tests/test_v31_capability_matrix.py tests/test_v32_platform_rails.py`
- `python tests/browser_smoke_v31.py`
- `python tests/browser_smoke_v32.py`
- `python tests/backend_session_workspace_smoke.py`
- `python tests/project_tree_hidden_child_smoke.py`

### Results

- frontend production build succeeded,
- v29/v30/v31 regressions remained green,
- new v32 rail/capability tests passed,
- advanced browser smoke passed,
- workspace/session smoke passed,
- project-tree hidden-child smoke passed.

### Notes

One issue encountered during validation was test-side, not product-side: the new browser smoke initially read stale Zustand state immediately after `openTab`. The test was corrected to re-read the store after mutation.

## 7. What became more real

The following broader-platform movement is now real in code and validated at a narrow but meaningful level:
- a shared rail/status model across frontend and backend,
- advanced artifact-library surfacing for `agent` and `deep_agent` shells,
- advanced execution profile vocabulary with explicit constraints,
- advanced node surfacing for adapter-backed / agentic concepts,
- root-level workspace preservation for broader artifact/profile surfaces,
- truthful trunk-dependent semantics for those broader surfaces,
- backend/API gating that prevents broader rails from masquerading as default earned capability.

## 8. What remains internal / experimental / deferred

### Internal
- internal-only node families such as `tool_sub_agent` remain hidden,
- hidden/internal artifact inventory remains opt-in only.

### Experimental or bounded
- `agent` artifact shells are broader than the trunk but still bounded by the current system contracts,
- `deep_agent` shells remain adapter-backed / alias-backed and trunk-dependent rather than independent runtime truth,
- advanced node families remain expert-only rather than part of the default surface.

### Deferred
- a first truly independent broader-runtime rail,
- richer packaging semantics beyond validated workspace truth,
- advanced run coordination across broader rails,
- collaboration/security platform work,
- a deeper adapter framework beyond current bounded classification.

## 9. Risks introduced or avoided

### Avoided
- no fake runtime plurality,
- no broad UI explosion,
- no deletion-first simplification of partial broader features,
- no regression of the stable LangGraph-centered trunk.

### Introduced / managed
- broader-platform vocabulary is now more explicit, which increases conceptual surface area,
- advanced-mode UI is broader than before, so regression tests were added to prevent accidental spillover into default mode,
- advanced root surfaces now persist in more places, so default/subgraph normalization rules were kept strict to avoid structural drift.

## 10. Recommended next pass

A justified next pass would be **Optional Pass 5** from the broader-platform program: pick one narrow broader-platform family and make it genuinely useful.

The best candidate is:
- **a truthful advanced agent-shell workflow**,

because the agentic rail now has:
- status semantics,
- advanced surfacing,
- packaging/visibility meaning,
- compile/run constraints,
- and trunk-dependent bounded behavior.

That makes it the narrowest broader-platform feature family that can now be turned into something real without breaking the trunk.

---

## What broader platform movement is now actually earned

The following is now actually earned:
- broader rails are no longer just accidental leftover vocabulary,
- advanced broader-platform surfaces exist as classified system constructs,
- the UI can expose them honestly in advanced mode,
- the backend can gate them correctly,
- the system can preserve and validate them without claiming equal maturity to the proven trunk.

The following is **not** yet earned:
- independent runtime parity for non-trunk rails,
- a broadly mature multi-runtime platform,
- broader packaging/import/export semantics beyond the validated scope,
- fully first-class advanced rail orchestration.

In plain English: LangSuite is still anchored by its real LangGraph trunk, but it now has the first honest scaffolding of a broader orchestration platform instead of a pile of spooky nouns hiding in the attic.
