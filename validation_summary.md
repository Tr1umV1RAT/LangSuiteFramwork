# Validation Summary v15

## Environment note
Validation was done on the merged v15 working tree derived from v14 + selected v13 concepts.

## Successful validation

### 1. Python compile
Command:
```bash
python -m compileall api core db main.py
```
Result: ✅

### 2. Frontend dependency install
Command:
```bash
cd client
npm ci
```
Result: ✅

### 3. Frontend production build
Command:
```bash
npm run build
```
Result: ✅

Note:
- Vite emitted a bundle-size warning only. Build still succeeded.

### 4. Artifact registry API
Validated with `fastapi.testclient`:
- list artifacts ✅
- load built-in artifact ✅
- save artifact ✅
- new `deep_agent_suite_starter` visible in registry ✅

### 5. Representative compile payload
Validated with `fastapi.testclient` on `/compile` using a representative payload containing:
- `deep_agent_suite`
- `deep_memory_skill`
- `deep_subagent_worker`
- `artifact_type='deep_agent'`
- `execution_profile='deepagents'`

Result: ZIP compile response returned successfully ✅

### 6. Project persistence roundtrip
Validated that save/load preserves:
- `artifactType`
- `executionProfile`
- wrapper metadata fields (`artifact_ref_*`, `target_subgraph`, `wrapper_mode`)

Result: ✅

### 7. Collaboration websocket persistence
Validated that websocket sync persists and stores:
- `artifactType`
- `executionProfile`
- `runtimeSettings`
- wrapper node metadata

Result: ✅

## Not validated
- manual browser QA
- real provider-backed execution with installed `langgraph`, `langchain*`, or `deepagents`
- fully native supergraph semantics across families
- true concurrent collaboration conflict handling beyond current last-writer-wins behavior

## Honesty checks
- Runtime remains **LangGraph-centric** ✅ documented
- `langchain_agent` / `deepagents` remain editor/profile abstractions unless otherwise implemented ✅ documented
- Compatibility aliases documented ✅
- Collaboration remains effectively last-writer-wins ✅ documented

## Conclusion
The v15 merge pass is structurally valid and shippable as the next branch, with the main caveat that the richer semantic vocabulary now exceeds the runtime implementation by design and is therefore handled through explicit canonical aliases.
