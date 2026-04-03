# FrameworkLangchain repair handoff v8

Starting point for this pass was the repaired archive described in the v7 handoff.

## What was completed in v8
- normalized provider aliases at schema level:
  - `google` -> `google_genai`
  - `azure` -> `azure_openai`
- aligned frontend provider values to canonical names
- expanded compiler dependency flags and generated requirements truthfulness for:
  - OpenAI / Azure OpenAI
  - Anthropic
  - Google GenAI
  - Google Vertex AI
  - Ollama
  - Mistral
  - sqlite async helper
- implemented `update` reducer generation for dict-like custom state
- reworked generated Python-function tool export to stable id-keyed mapping (`ACTIVE_TOOLS_BY_ID`)
- changed generated node/tool binding to resolve tools by id instead of tool name
- fixed `react_agent` crash when `tools_linked` is missing/empty
- improved generated sync sqlite checkpointer path to use sync `SqliteSaver`
- improved runner cleanup of unique graph modules and temp dirs
- canonicalized `tools_linked` during export so incoming visual tool edges win over stale params
- deepened validation:
  - source compileall
  - 3 representative generated graphs compiled with compileall
  - stubbed dynamic import/runtime smoke checks
  - backend DB roundtrip for `customStateSchema` + `isAsync`

## Important remaining caveats
- frontend full build still not executed here (missing JS deps in environment)
- collaboration is still effectively last-writer-wins
- runtime isolation is still not truly multi-worker safe because generated subgraph access still depends on a process-global `graph` alias
- `tool_executor` semantics are still somewhat redundant with auto-generated tool execution paths; this is now clearer, but not fully refactored
- the system remains state-centric; the UI still visually implies stronger port semantics than runtime truth

## Recommended next pass
1. run a real frontend install/build and fix any TS/runtime regressions
2. perform live websocket execution tests against a real LangGraph/LangChain environment
3. decide whether to:
   - keep both explicit `tool_executor` and auto tool-routing forever, documented as two modes, or
   - deprecate one path and migrate saved graphs carefully
4. add small UI/documentation cues that describe tool links and handles as builder metadata feeding state-centric generation
5. if concurrency matters, redesign runtime loading so generated projects do not depend on a global `graph` alias
