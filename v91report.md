# LangSuite v91 — prompt strips phase 3: compiled/runtime provenance + LLM/provider/runtime coverage pass

## Scope of this pass

This was a **bounded phase 3** pass for the prompt-strip system.
It did **not** broaden the product claim to a full prompt-management platform.
It focused on two things:

1. carry **prompt-strip provenance** into compiled/runtime-visible metadata,
2. tighten verification around **LLM/provider/tool/memory** surfaces already present in the repository.

## What changed

### 1. Prompt-strip provenance now survives into compiled/runtime metadata

Updated:
- `core/prompt_strips.py`
- `core/compiler.py`
- `templates/state.py.jinja`

Added / extended:
- prompt-resolution provenance export per:
  - graph default layer,
  - prompt-capable nodes,
  - prompt-capable tools,
  - subagents in the subagent library.
- compiled state bootstrap now exports:
  - `GRAPH_PROMPT_STRIP_METADATA`
  - runtime state key `__prompt_strip_meta__`

What this means:
- compile output now records **which graph defaults and local prompt-strip assignments** shaped a resolved prompt,
- runtime state can expose this metadata truthfully,
- this is still bounded to the already-supported phase-2 prompt-bearing surfaces.

This pass still does **not** claim:
- artifact-level prompt-strip publishing,
- arbitrary propagation to every prompt-like surface,
- global prompt runtime mutation,
- or a full prompt-registry product.

### 2. Prompt-strip runtime provenance is surfaced in the UI

Updated:
- `client/src/components/StatePanelContent.tsx`
- `client/src/components/CapabilityInspectorSection.tsx`

Effects:
- the state panel now explains that compiled/runtime prompt-strip provenance is exposed via `__prompt_strip_meta__`,
- when runtime state is present, the selected node can show inherited graph-assignment count, local assignment count, and resolved preview length,
- the capability inspector now acknowledges runtime provenance when available.

This remains a **truth layer**, not a new authoring abstraction.

### 3. LLM/provider/tool/memory coverage was extended with new targeted tests

Added:
- `tests/test_v91_prompt_strip_phase3_runtime_truth.py`

New targeted checks cover:
- compile-time export of prompt-strip runtime metadata,
- prompt-strip provenance for nodes, tools, and subagents,
- generated LLM node/tool code keeping provider, tool-binding, memory-input, and stop/max-token parameters visible,
- preflight + dependency coverage for:
  - OpenAI
  - LM Studio
  - Ollama
  - tool-LLM worker
  - sub-agent tool
- frontend surfaces referencing runtime prompt-strip provenance.

## Important truth boundary preserved

This pass did **not** fake a live provider-runtime check.
In this environment there is still **no actual running LM Studio / Ollama / OpenAI backend** available for network execution.

So the validation here truthfully covers:
- schema acceptance,
- compile path,
- generated code,
- runtime dependency declarations,
- runtime preflight/provider checks,
- prompt-strip/runtime-state metadata export,
- and non-regression.

It does **not** prove:
- successful live model inference over the network,
- end-to-end execution against a real external LLM server from this sandbox.

## Files touched

- `core/prompt_strips.py`
- `core/compiler.py`
- `templates/state.py.jinja`
- `client/src/components/StatePanelContent.tsx`
- `client/src/components/CapabilityInspectorSection.tsx`
- `tests/test_v91_prompt_strip_phase3_runtime_truth.py`

## Validation executed

### Targeted regression cluster
Command:
- `PYTHONPATH=. pytest -q tests/test_v84_truthful_surface_followup.py tests/test_v85_project_persistence_truth.py tests/test_v86_run_path_causality.py tests/test_v87_prompt_and_module_boundaries.py tests/test_v89_prompt_strip_phase1.py tests/test_v90_prompt_strip_phase2_and_llm_surfaces.py tests/test_v91_prompt_strip_phase3_runtime_truth.py`

Result:
- **26 passed**

### Wider provider/runtime/memory truth cluster
Command:
- `PYTHONPATH=. pytest -q tests/test_v79_provider_contract_truth.py tests/test_v80_runtime_event_truth.py tests/test_v80_frontend_runtime_event_usage.py tests/test_v84_truthful_surface_followup.py tests/test_v85_project_persistence_truth.py tests/test_v86_run_path_causality.py tests/test_v87_prompt_and_module_boundaries.py tests/test_v89_prompt_strip_phase1.py tests/test_v90_prompt_strip_phase2_and_llm_surfaces.py tests/test_v91_prompt_strip_phase3_runtime_truth.py`

Result:
- **36 passed**

### Frontend verification
Check performed:
- `client/node_modules/typescript/bin/tsc`

Result:
- **not available in this extracted environment**
- `npm run verify` was therefore **not runnable here**

This is an environment/setup blocker, not evidence of a source-level contradiction.

## Product effect after this pass

Prompt strips are now better aligned across three layers:
- authoring,
- compile-time resolution,
- runtime-visible provenance.

That makes them much more suitable as a future foundation for:
- reusable GM / world / NPC persona layers,
- bounded narrative/system overlays,
- and later domain bundles/modules,
without pretending that the full future product surface already exists.

## Best next pass

The best next move is now:
- **v92 = Module Library phase 1**

Not as a plugin system,
but as a bounded manifest/bundle layer capable of packaging:
- prompt strips,
- subagent groups,
- starter artifacts,
- and later domain presets,
while staying distinct from:
- the block palette,
- artifact publishing,
- project save/open,
- and runtime restore.
