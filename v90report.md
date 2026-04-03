# LangSuite v90 — prompt strips phase 2 + LLM/provider/runtime verification pass

## Scope of this pass

This pass implemented the **first real compile/runtime propagation step** for Prompt Strips and tightened verification around **LLM/provider/tool/runtime** surfaces already present in the repository.

It was **not** a broad new-feature pass.
It stayed inside the existing LangSuite trunk and preserved the current truth boundaries.

## What changed

### 1. Prompt Strips now affect compile/runtime on bounded surfaces

Updated:
- `core/schemas.py`
- `core/prompt_strips.py` *(new)*
- `core/compiler.py`
- `templates/nodes.py.jinja`
- `client/src/store/workspace.ts`
- `client/src/components/StatePanelContent.tsx`
- `client/src/components/CapabilityInspectorSection.tsx`

Effects:
- backend runtime settings now accept:
  - `promptStripLibrary`
  - `promptStripAssignments`
- compile now resolves prompt strips for:
  - `llm_chat`
  - `react_agent`
  - `prompt_template` prompt-bearing payloads
  - `tool_llm_worker`
  - subagent library entries (`subagentLibrary[*].agents[*].systemPrompt`)
- graph-level prompt-strip assignments are treated as **defaults** that can layer with:
  - node-local assignments
  - subagent-local assignments
- generated Python now serializes resolved prompt text safely with `tojson`, avoiding syntax breakage when prompt strips introduce multiline content.

### 2. Frontend previews now match phase-2 compile semantics more closely

Updated:
- `client/src/store/workspace.ts`
- `client/src/components/StatePanelContent.tsx`
- `client/src/components/CapabilityInspectorSection.tsx`

Effects:
- the state panel can now preview node/subagent prompt resolution with **inherited graph defaults** plus local assignments
- the capability inspector now reports:
  - local node assignments
  - inherited graph-default assignment count
  - phase-2 compile/runtime activation status for supported prompt-bearing surfaces

Important boundary preserved:
- prompt strips are **not yet** artifact-published as a separate product surface
- broader prompt-surface propagation is **not yet** claimed
- this is still a bounded compile/runtime step, not a global prompt system completion

### 3. LLM/provider/tool/runtime verification was strengthened

Added/updated tests cover:
- OpenAI key-env acceptance
- Ollama acceptance
- LM Studio acceptance with required `api_base_url`
- LLM-backed tool surfaces (`tool_llm_worker`)
- dependency collection across LLM node/tool forms
- prompt-strip compile integration with memory-linked LLM nodes
- prompt-strip compile integration with subagent-library prompts

## Why this pass matters

Before this pass, Prompt Strips were deliberately truthful but mostly **editor-backed / preview-backed**.

After this pass, LangSuite now has a **real, bounded path** where prompt strips materially affect generated/runtime-bound prompts for supported LLM-bearing surfaces.

That is strategically important for later domain branches — including the planned **RPG demonstration branch** — because it enables:
- world-level defaults,
- role/persona overlays,
- explicit per-node or per-subagent prompt layering,
- without creating a second runtime or a domain-specific fork in the trunk.

## Validation executed

### Targeted pytest cluster

Command:
- `PYTHONPATH=. pytest -q tests/test_v79_provider_contract_truth.py tests/test_v89_prompt_strip_phase1.py tests/test_v90_prompt_strip_phase2_and_llm_surfaces.py tests/test_v47_memory_access_cleanup.py tests/test_v61_subagent_runtime_and_blocks.py`

Result:
- **20 passed**

### Wider non-regression cluster

Command:
- `PYTHONPATH=. pytest -q tests/test_v84_truthful_surface_followup.py tests/test_v85_project_persistence_truth.py tests/test_v86_run_path_causality.py tests/test_v87_prompt_and_module_boundaries.py tests/test_v89_prompt_strip_phase1.py tests/test_v90_prompt_strip_phase2_and_llm_surfaces.py tests/test_v79_provider_contract_truth.py tests/test_v47_memory_access_cleanup.py tests/test_v61_subagent_runtime_and_blocks.py`

Result:
- **33 passed**

### Frontend verification

Command:
- `cd client && npm run verify`

Result in this environment:
- **blocked by missing local `typescript` binary in `client/node_modules`**

This is an environment/setup blocker here, not evidence of a source-level contradiction by itself.

## Product truth after this pass

### Now true
- prompt strips can influence compile/runtime on **supported prompt-bearing surfaces**
- graph defaults can layer with node/subagent-local prompt strips
- OpenAI / LM Studio / Ollama acceptance is covered more explicitly in tests across preflight/dependency surfaces
- memory-linked LLM compile paths remain intact while prompt-strip resolution is added

### Still not claimed
- full prompt-strip publishing as its own artifact surface
- arbitrary prompt propagation to every future LLM/tool family
- completed module library
- completed domain-pack / RPG-pack system
- global variable substitution / templated prompt materialization beyond the current bounded strip model

## Best next pass

The best next implementation pass is:
1. **Prompt Strip phase 3** — carry resolved prompt-strip provenance into compiled metadata / runtime truth surfaces,
2. optionally add bounded variable-materialization for prompt strips,
3. then begin **Module Library phase 1** so universe packs / role packs / rules packs can branch cleanly into the future RPG demo line.
