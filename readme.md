# LangSuite

LangSuite is a **LangGraph-first visual authoring tool**.

Its strongest supported path is:

1. create or open a LangGraph graph/subgraph,
2. build the graph visually,
3. run the graph on the proven in-app runtime surface when available,
4. inspect logs/state,
5. save in the app,
6. compile to a runnable Python zip.

## Product truth

- **Core and strongest support**: LangGraph visual authoring.
- **Real and first-class**: compile to a runnable Python zip.
- **Real but bounded**: in-app runtime for proven LangGraph-oriented surfaces.
- **Real but uneven**: runtime-event normalization and run-log truth, with legacy fallback still present for compatibility.
- **Real but not parity surfaces**: LangChain and DeepAgents-related authoring, bridge, wrapper, package, and interoperability flows.
- **Package export/import** moves the editable workspace only. It does **not** freeze-dry runtime DB contents, vector stores, secrets, or hidden environment state.
- Package export/import moves the editable workspace only.
- **Save in app**, **package export/import**, and **compile Python** are different operations and should not be conflated.
- Advanced surfaces remain **trunk-dependent unless a bridge or contract explicitly proves more**.

## Support levels

### Fully supported
- LangGraph visual authoring
- compile to runnable Python zip

### Supported with constraints
- in-app runtime execution on proven LangGraph surfaces
- save/load/session persistence
- runtime-event truth where normalized runtime payloads are present, with legacy fallback retained

### Compile-only / package-only / bridge-backed
- portions of LangChain-oriented support
- portions of DeepAgents-oriented support
- artifact wrapper/interoperability flows that compile or package honestly but are not peer native runtimes

### Experimental or advanced
- bounded rail starters and some bridge-heavy surfaces
- authoring flows that remain valuable in the editor but should not be marketed as equivalent execution families

## What this repository is for

Use LangSuite when you want to:
- visually author a LangGraph workflow,
- inspect graph structure, state, and runtime logs,
- save and reopen project trees in the app,
- export a portable workspace package,
- compile a runnable Python project from the current graph.

Do **not** treat the repository as claiming blanket runtime parity across LangGraph, LangChain, DeepAgents, embedded-native, wrappers, and bridge paths.

## System architecture

### UI/UX decisions
- **Frontend framework**: React 18 with Vite.
- **Canvas**: `@xyflow/react` (React Flow v12).
- **State management**: Zustand.
- **Styling**: Tailwind CSS.
- **Main surfaces**:
  - `App.tsx`: canvas and empty-state guidance.
  - `Toolbar.tsx`: save/package/compile controls and mode framing.
  - `RunPanel.tsx`: runtime readiness, logs, state, pause/resume.
  - `ProjectManager.tsx`: saved-in-app project tree.
  - `CapabilityInspectorSection.tsx`: support/runtime/product truth per node.

### Backend/runtime
- **Backend**: FastAPI.
- **Compiler**: Jinja-based Python export generation.
- **Persistence**: SQLite-backed project/session management.
- **Runtime truth**: normalized runtime projections plus legacy fallback handling.
- **Collaboration**: WebSocket-based synchronization.

## Reproducible frontend build path

The repository carries one explicit frontend verification path:

- `python qa/repro_frontend_build.py` installs frontend dependencies when needed, runs the canonical frontend verification script, and checks that both the frontend build and backend-served static bundle can be regenerated.
- `python qa/repro_frontend_build.py --dry-run` prints the steps without executing them.
- `npm run verify` (from `client/`) runs the TypeScript build and then syncs the frontend bundle for backend serving.

## Local model compatibility notes

- The generated runtime is cross-platform Python/Node code and is designed to run on Linux and Windows without OS-specific path assumptions in the core compile/runtime path.
- Native local chat providers currently supported in the generated runtime are:
  - `ollama` via `langchain-ollama`
  - `openai_compat` for generic OpenAI-compatible servers
  - `lm_studio` for LM Studio's OpenAI-compatible local server
  - `llama_cpp` for `llama.cpp` server mode exposing an OpenAI-compatible API
- `lm_studio` and `llama_cpp` require `api_base_url` on the LLM surface or subagent/tool surface. Example values include `http://127.0.0.1:1234/v1` for LM Studio and `http://127.0.0.1:8080/v1` for a typical `llama.cpp` server.
- These local OpenAI-compatible providers do not require a real cloud API key; the runtime will use a placeholder when the server accepts it.
- The local-provider compatibility surface is intentionally adapter-based so the rest of LangSuite does not need to diverge between Windows and Debian.
