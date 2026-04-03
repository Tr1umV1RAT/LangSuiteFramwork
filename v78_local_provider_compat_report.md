# LangSuite v78 — local provider compatibility + pass-1 seed

## What changed

- Added explicit provider families for:
  - `openai_compat`
  - `lm_studio`
  - `llama_cpp`
- Normalized provider aliases:
  - `lmstudio` -> `lm_studio`
  - `llamacpp` / `llama.cpp` -> `llama_cpp`
  - `openai-compatible` -> `openai_compat`
- Wired `api_base_url` into generated LLM runtime code for `llm_chat`, `react_agent`, `tool_llm_worker`, and `sub_agent_tool`.
- Added OpenAI-compatible runtime adapters using `langchain_openai.ChatOpenAI` for LM Studio / llama.cpp / generic OpenAI-compatible local servers.
- Preserved existing Ollama path.
- Expanded dependency detection/template requirements so local OpenAI-compatible providers pull the OpenAI adapter dependency.
- Updated frontend provider pickers and store validation.
- Fixed frontend typecheck issue caused by a missing `CheckCircle` import.
- Began pass 1 by adding a low-risk backend truth envelope (`truthEnvelopeVersion=runtime_truth_v1`) on runner websocket events without breaking the existing frontend contract.

## Compatibility conclusion

### OS
- The project is already structurally Linux-friendly and Windows-friendly in the main compile/runtime path.
- No central Windows-only runtime dependency was found in the graph compiler or generated local mutation tooling.
- Debian 13 compatibility is therefore plausible and now remains aligned with Windows in the same codebase.

### Local model runtimes
- Ollama: already supported.
- LM Studio: now explicitly supported via `lm_studio` + `api_base_url`.
- llama.cpp server mode: now explicitly supported via `llama_cpp` + `api_base_url`.
- Generic OpenAI-compatible local endpoints: now explicitly supported via `openai_compat` + `api_base_url`.

## Validation performed

- `python -m compileall api core`
- `pytest -q tests/test_v78_local_provider_compatibility.py tests/test_v68_local_mutation_and_shell_tools.py tests/test_v69_apply_patch_tool.py tests/test_v70_local_mutation_trust.py tests/backend_session_workspace_smoke.py`
- `client/npm ci`
- `client/npm run verify`
- manual compile of a minimal `lm_studio` graph with `compile_graph(...)`

All of the above passed in this patched tree.

## Important limit

This does **not** mean native `llama.cpp` library embedding was added.
Compatibility is through the OpenAI-compatible server mode, which is the low-risk path that preserves LangSuite's current architecture and avoids forking the runtime by OS.
