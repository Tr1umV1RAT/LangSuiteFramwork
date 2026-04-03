# LangSuite v35 — First Compile-Capable LangChain → LangGraph Bridge

## 1. Concise execution summary

v35 implemented one **real**, **bounded**, **compile-capable** cross-mode bridge:

- **LangChain `agent` artifact → LangGraph wrapper-backed compiled subgraph**

This was done without giving LangChain fake in-app runtime parity and without broadening DeepAgents beyond its existing bounded status.

The bridge now goes beyond editor/package-only semantics:

- a supported LangChain agent artifact can be inserted into a LangGraph workspace as a wrapper reference,
- the wrapper reference can compile through the LangGraph trunk,
- the generated Python export contains a lowered bridge graph,
- and a bounded static bridge variant was executed successfully through the LangGraph runner.

## 2. What v35 targeted

This pass targeted the narrowest executable cross-mode bridge that could be implemented honestly:

- inspect the v34 bridge metadata and rejection path,
- define one executable bridge contract,
- implement compiler-side lowering for that contract,
- update UI/API bridge status so the new truth is visible,
- preserve server-side mode contracts and LangChain editor-only runtime blocking,
- and add regression coverage proving the bridge works while unsupported shapes still fail.

## 3. What was inspected first

The first inspection pass focused on:

- `core/mode_contracts.py`
- `core/schemas.py`
- `core/compiler.py`
- `client/src/capabilityMatrix.json`
- `api/artifacts.py`
- `api/runner.py`
- wrapper insertion / reopening behavior in `client/src/store.ts`
- v34 bridge tests and browser smoke

The key stop-point in v34 was clear:

- LangChain→LangGraph wrapper references were visible and insertable,
- but schema validation rejected them at compile/run time because they were still marked `editor_package_only`.

## 4. Executable bridge contract

### Supported bridge in v35

**Contract ID:** `langchain_agent_to_langgraph_v1`

**Source artifact form:**
- project mode: `langchain`
- artifact kind/type: `agent`
- execution profile: `langchain_agent`

**Accepted shape:**
- no custom tool definitions in the artifact payload,
- no nested artifact wrapper references,
- `react_agent` nodes are allowed and are lowered to `llm_chat`,
- every other node in the artifact must already be a LangGraph-allowed shared node type.

**Target representation:**
- a LangGraph wrapper-backed compiled subgraph graph entry,
- keyed by the original artifact reference (for example `artifact:agent/minimal_agent`),
- emitted into the generated `graphs` map,
- and invoked by the existing `sub_agent` node path.

**Preserved metadata:**
- source artifact id,
- source artifact mode,
- source artifact type,
- source node type (via lowering metadata),
- contract id used for the lowering.

### Explicit non-goals in v35

- no arbitrary LangChain workflow lowering,
- no custom-tool LangChain bridge execution,
- no nested wrapper bridge execution,
- no universal mode translator,
- no LangChain in-app runtime rail.

## 5. Backend/compiler changes

### New bridge helper

Added:
- `core/bridge_lowering.py`

It now provides:
- bridge artifact loading from registry references,
- contract validation for executable LangChain agent bridges,
- bounded lowering from `react_agent` to `llm_chat`,
- lowered-node and lowered-edge generation for compile.

### Mode/schema enforcement

Updated:
- `core/schemas.py`

Changes:
- compile-time wrapper reference validation now distinguishes among:
  - `direct`
  - `compile_capable`
  - `editor_package_only`
- `compile_capable` references are validated against the actual executable bridge contract instead of being rejected unconditionally.

### Compiler lowering

Updated:
- `core/compiler.py`
- `templates/graph.py.jinja`

Changes:
- compiler now collects compile-capable external bridge artifact references,
- lowers supported LangChain agent artifacts into prefixed graph nodes,
- adds them as additional generated graph entries,
- keeps the LangGraph trunk as the runtime anchor,
- and preserves the original wrapper reference target string so existing wrapper node semantics still work.

### Capability / bridge metadata

Updated:
- `client/src/capabilityMatrix.json`
- `core/mode_contracts.py`

Changes:
- LangChain agent → LangGraph bridge now has:
  - `status: supported`
  - `supportLevel: compile_capable`
  - explicit constraints summary
  - contract id metadata

### UI/API honesty support

Updated:
- `client/src/api/artifacts.ts`
- `client/src/components/artifacts/ArtifactLibrarySection.tsx`

Changes:
- UI now recognizes `compile_capable` bridge status explicitly,
- artifact cards display the bridge support level in a more human-readable form,
- the artifact API continues to expose bridge metadata used by the advanced library.

## 6. UI/API honesty changes

The product now says something more precise and more true:

- **one** LangChain bridge is compile-capable,
- it is bounded by an explicit contract,
- it is still trunk-dependent,
- LangChain itself remains editor-only in-app,
- DeepAgents bridges remain editor/package-only in this version.

Nothing in this pass suggests runtime parity across all modes.

## 7. Validation performed

### Dependency/runtime baseline

Executed:

```bash
python -m pip install 'langgraph>=0.2.0' 'langchain>=0.3.0' 'langchain-core>=0.3.0'
```

Result:
- runtime dependencies were present and usable (`Requirement already satisfied` in this environment).

### Frontend build

Executed:

```bash
cd client && npm run build
```

Result:
- passed
- one existing bundle-size warning remained, but no build break occurred.

### Regression/API suite

Executed:

```bash
python -m pytest -q \
  tests/test_v29_compile_truth.py \
  tests/test_v30_runtime_validation.py \
  tests/test_v32_platform_rails.py \
  tests/test_v33_project_modes.py \
  tests/test_v34_mode_contracts.py \
  tests/test_v35_executable_bridge.py
```

Result:
- **22 passed**

### Persistence / project tree smoke

Executed:

```bash
python tests/backend_session_workspace_smoke.py
python tests/project_tree_hidden_child_smoke.py
```

Result:
- both passed

### Browser smoke

Executed:

```bash
python tests/browser_smoke_v35.py
```

Result:
- passed

The v35 browser smoke verified:
- the bridge is listed as `compile_capable` in the advanced LangGraph artifact library,
- a LangChain artifact wrapper can be inserted into a LangGraph workspace,
- the workspace can compile through `/compile`,
- and the wrapper can still reopen the original LangChain artifact in its native editor mode.

### Executable run smoke

Covered by regression test:
- `test_static_langchain_bridge_can_run_through_langgraph_trunk`

Result:
- a bounded static LangChain agent artifact compiled and completed execution through the LangGraph runner.

### Limitations

A representative lowered bridge using the built-in `minimal_agent` artifact was compile-validated, but not fully provider-executed in a live model call, because that artifact depends on LLM provider credentials/model availability.

This is a real limitation, not a hidden failure.

## 8. What became more real

- one LangChain→LangGraph bridge is now actually compile-capable,
- that bridge is no longer just editor/package-only metadata,
- the compiler can lower a bounded LangChain artifact shape into the LangGraph trunk,
- UI/API surfaces now expose that difference honestly,
- unsupported LangChain bridge shapes fail clearly,
- and LangChain still remains editor-only in-app.

## 9. What remains bounded / deferred

Still bounded:
- LangChain itself is **not** an in-app runtime mode,
- only one narrow LangChain artifact form is executable through the bridge,
- DeepAgents→LangGraph remains editor/package-only,
- custom-tool LangChain artifacts are not executable through this bridge,
- nested artifact-wrapper LangChain bridges are not executable,
- there is still no universal cross-mode lowering framework.

Deferred:
- richer compile-capable LangChain bridge shapes,
- a first compile-capable DeepAgents bridge,
- more structured package typing for bridge artifacts,
- stronger UI explanation surfaces for bridge constraints in inspectors and run panels,
- broader human exploratory QA.

## 10. Recommended next pass

**Recommended v36 direction:**

> Expand the executable bridge carefully from `langchain_agent_to_langgraph_v1` into one slightly richer but still bounded contract.

The safest next move would be one of:

1. **v36-A — richer compile-capable LangChain bridge shape**
   - allow a slightly broader shared-node subset,
   - keep custom tools and nested bridges unsupported.

2. **v36-B — bridge inspector / diagnostics pass**
   - make bridge constraints and failure reasons more visible in the UI,
   - improve wrapper-node and compile diagnostics,
   - keep semantics unchanged.

The most platform-moving option is **v36-A**.
The safest maintainability-first option is **v36-B**.

---

## Executable Bridge Contract Summary

**Supported in v35:**
- LangChain `agent` artifact
- lowered into a LangGraph wrapper-backed compiled subgraph
- executable through the LangGraph compile/run trunk
- only for the bounded `langchain_agent_to_langgraph_v1` shape

## Still Editor/Package-Only Bridges

Still non-executable in v35:
- DeepAgents → LangGraph wrapper bridge
- unsupported LangChain agent shapes outside the v35 contract
- nested artifact-wrapper bridge chains
- custom-tool LangChain bridge execution
