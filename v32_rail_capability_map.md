# LangSuite v32 rail and capability map

## Rail inventory

### Rail 0 — Proven trunk

**Purpose**
- LangGraph-centered graph/subgraph compile/run path.

**Current status**
- Proven.

**Representative surfaces**
- artifact kinds: `graph`, `subgraph`
- execution profiles: `langgraph_sync`, `langgraph_async`
- stable graph/subgraph compile/run/package flows

**Visibility**
- default visible

---

### Rail 1 — Structural composition rail

**Purpose**
- structural reuse and composition inside the trunk.

**Current status**
- real but bounded by the trunk

**Representative surfaces**
- `subgraph`
- `sub_agent`
- wrapper-backed structural references
- imported graph-like units that still resolve through the trunk

**Visibility**
- visible where structurally appropriate

---

### Rail 2 — Agentic / assistant rail

**Purpose**
- advanced agent-shell concepts with truthful bounded meaning.

**Current status**
- partial and needs integration, now promoted to advanced bounded surface

**Representative surfaces**
- artifact kind: `agent`
- execution profile: `langchain_agent`
- node types: `react_agent`, `tool_llm_worker`

**Meaning in v32**
- advanced/editorial surface
- may compile through bounded trunk-dependent logic
- not a proven default peer runtime

**Visibility**
- advanced only

---

### Rail 3 — Adapter / future-runtime rail

**Purpose**
- adapter-backed or future-runtime-facing concepts that should exist honestly without claiming parity.

**Current status**
- experimental but promising

**Representative surfaces**
- artifact kind: `deep_agent`
- execution profile: `deepagents`
- node types: `deep_agent_suite`, `deep_subagent_worker`, `deep_memory_skill`

**Meaning in v32**
- adapter-backed / alias-backed / trunk-dependent
- advanced only
- not directly equal to the proven trunk

**Visibility**
- advanced only

---

### Rail 4 — Platform services rail

**Purpose**
- cross-rail governance, validation, packaging, and support.

**Current status**
- real and growing

**Representative surfaces**
- capability matrix
- artifact registry and artifact API
- workspace normalization and import/export rules
- browser/runtime regression checks
- collaboration/session filtering hooks

**Visibility**
- mostly internal, with some visible effects through the artifact library and UI labels

## Concept-status matrix

| Concept | Rail | Status | Visible surface | Compile meaning | Run meaning | Notes |
|---|---|---:|---|---|---|---|
| `graph` | trunk | proven | default | direct | direct | main truth anchor |
| `subgraph` | composition | proven | default where structural | direct | direct via trunk | child structural unit |
| `sub_agent` | composition | real but internal/wrapper-backed | advanced node surface only | bounded | bounded via trunk | composition helper |
| `agent` | agentic | partial but integrated | advanced | bounded / trunk-dependent | bounded / trunk-dependent | advanced shell, not default peer runtime |
| `langchain_agent` | agentic | partial but integrated | advanced | bounded | bounded | execution profile for agent-shell workflows |
| `react_agent` | agentic | experimental but promising | advanced | bounded | bounded | advanced node, now clearly labeled |
| `tool_llm_worker` | agentic | experimental but promising | advanced | bounded | bounded | advanced helper node |
| `deep_agent` | adapter | experimental but promising | advanced | alias-backed | alias-backed | adapter/future-runtime shell |
| `deepagents` | adapter | experimental but promising | advanced | alias-backed | alias-backed | profile does not imply runtime parity |
| `deep_agent_suite` | adapter | experimental but promising | advanced | bounded | bounded / fallback | trunk-dependent advanced node |
| `deep_subagent_worker` | adapter | experimental but promising | advanced | bounded | bounded | adapter-backed advanced node |
| `deep_memory_skill` | adapter | experimental but promising | advanced | bounded | bounded | advanced node |
| `tool_sub_agent` | composition | real but internal | hidden | bounded | bounded | internal-only helper |

## Naming / ontology plan implemented in v32

### Unified terms
- **artifact kind**: graph-level family/classification used for workspace/package/library identity
- **execution profile**: execution-shaping mode / contract
- **rail**: architectural lane describing maturity and system meaning
- **surface level**: `stable`, `advanced`, or `internal`

### Clarified distinctions
- **graph**: root LangGraph-centered workspace unit
- **subgraph**: child structural unit inside the trunk
- **wrapper-backed**: concept reuses trunk semantics and does not claim independent runtime parity
- **adapter-backed**: concept is broader-facing but currently bounded through an adapter/alias contract
- **trunk-dependent**: broader surface ultimately depends on the proven trunk

### What remains hidden/internal
- internal-only helper nodes and hidden artifact inventory
- concepts that still lack a safe user-facing contract

## Concrete Pass 2 integration target that was implemented

The minimum coherent integration target was:
1. centralize broader-rail truth into one capability matrix,
2. use that matrix in both frontend and backend,
3. expose broader concepts only in advanced mode,
4. preserve default mode as stable/trunk-first,
5. validate compile/run/package/UI semantics for the new bounded surfaces.

That target has now been implemented for passes 1–4.
