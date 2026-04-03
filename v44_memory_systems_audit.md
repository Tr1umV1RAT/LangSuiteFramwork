# LangSuite — memory systems audit (code reality + product/UI friction)

## 1. Executive summary

The project currently implements **at least five different “memory-like” mechanisms** under one visual umbrella:

1. **Thread persistence / checkpoints** via LangGraph checkpointers (`MemorySaver` or `SqliteSaver`)
2. **Runtime store / long-term memory** via `InMemoryStore` and store nodes
3. **Lightweight “memoryreader” / “memorywriter” surfaces**
4. **Prompt-injected memory** via `memory_in` on `llm_chat` / `react_agent`
5. **Context trimming / context management** via `context_trimmer`
6. **RAG-like retrieval** via `rag_retriever_local`

The engine can support all of these, but the **UI semantics and naming are currently too loose**. The biggest problems are:

- several memory surfaces compile through the **same store backend** while looking very different in the UI,
- some names imply **thread-local state** while the implementation actually uses the **runtime store**,
- store scoping is inconsistent (`state path` vs `configurable.user_id` vs fixed keys),
- and the `cross_thread_memory` setting is present in config but is **not currently driving a distinct backend/runtime behavior**.

The result is not broken, but it is cognitively unstable.

---

## 2. What exists in code today

## 2.1 Checkpointer / thread persistence

### Where
- `core/schemas.py`: `GraphConfig.persistence_type`, `cross_thread_memory`
- `core/compiler.py`: forwards `checkpoint_type`
- `templates/graph.py.jinja`: injects `MemorySaver()` or `SqliteSaver(...)`

### Reality
This is the project’s **short-term / thread-scoped persistence layer**.
It supports:
- pause/resume
- HITL
- thread state continuity
- runtime snapshots at the graph level

### Important limitation
`cross_thread_memory` exists in the config, but does **not** currently produce a materially different runtime path. The compiled graph always uses the same checkpointer/store wiring rules regardless of that flag.

---

## 2.2 Runtime store / long-term memory

### Where
- `templates/graph.py.jinja`: `store = InMemoryStore()` when memory/store nodes are present
- `templates/nodes.py.jinja`: `store_put`, `store_search`, `store_get`, `store_delete`

### Reality
This is the project’s **cross-thread / namespace-based memory mechanism**.
It is closer to LangGraph store semantics than to simple graph state.

### Current behavior
- `store_put`: persists a selected state value into a namespace/key
- `store_search`: searches the namespace and normalizes results into graph state
- `store_get`: fetches one item by key
- `store_delete`: deletes one item and can emit a receipt

### Important limitation
The store backend is always `InMemoryStore()` in the current compile template.
That means:
- useful for tests and local proofing,
- **not durable across process restarts**, even when checkpointing is durable.

This is a major product truth boundary.

---

## 2.3 `memory_store_read`

### Where
- `client/src/nodeConfig.ts`
- `core/schemas.py`
- `templates/nodes.py.jinja`

### Reality
This is a **store-backed profile read**, not a generic memory surface.

### Important implementation detail
It currently:
- derives `user_id` from a **state path** via `user_id_key`
- uses `namespace = (namespace_prefix, user_id)`
- then reads a **hardcoded key**: `profile_data`

### Problem
The UI suggests a more general “memory store read” surface than the implementation actually provides.
In reality it is a **specific profile-style lookup pattern**.

---

## 2.4 `memoryreader` / `memorywriter`

### Where
- `client/src/nodeConfig.ts`
- `templates/nodes.py.jinja`
- `client/src/capabilityMatrix.json`

### Reality
These are visually presented as lighter “memory” helpers.
But in the current implementation, they also use the **runtime store**.

#### `memoryreader`
- derives `user_id` from `config.configurable.user_id`
- reads namespace `("memory", user_id)`
- reads one key (`memory_key`)

#### `memorywriter`
- writes to the same namespace pattern
- stores `{ "data": state_value }`

### Problems
1. They are **not actually just lightweight state readers/writers**.
2. Their scoping mechanism differs from `memory_store_read`:
   - `memory_store_read` → state path lookup
   - `memoryreader` / `memorywriter` → `configurable.user_id`
3. Stored shapes differ:
   - `memorywriter` stores `{data: ...}`
   - `memory_store_read` expects the raw `.value`
   - `memoryreader` returns `.value`

This is one of the biggest consistency issues in the current memory story.

---

## 2.5 Prompt-injected memory (`memory_in`)

### Where
- `llm_chat` / `react_agent` handles in `client/src/nodeConfig.ts`
- `templates/nodes.py.jinja`

### Reality
The node accepts a memory input and uses it as **prompt-context augmentation**.
In generated code, this is injected into the system prompt as “Mémoire utilisateur ...”.

### Interpretation
This is not a long-term store API by itself.
It is a **consumer path**: a way for an LLM/agent node to *use* memory that was already read or assembled elsewhere.

### Product risk
Users can easily confuse:
- “this node has memory”
with
- “this node performs memory retrieval”.

Those are not the same thing.

---

## 2.6 `context_trimmer`

### Where
- `client/src/nodeConfig.ts`
- `templates/nodes.py.jinja`

### Reality
This is **context-window management**, not memory storage.
It manipulates short-term message history by removing older messages.

### Product risk
It sits in the “memory-adjacent” mental space, but it is really a **context-management / forgetting strategy**.
It should be presented as such.

---

## 2.7 `rag_retriever_local`

### Where
- `client/src/nodeConfig.ts`
- `templates/nodes.py.jinja`

### Reality
This is **external retrieval**, not memory in the strict LangGraph thread/store sense.
It uses Chroma/HuggingFace embeddings and returns docs.

### Product risk
Many users mentally collapse:
- memory
- retrieval
- RAG
- profile store
into one blob.
The UI must not do that.

---

## 3. Main technical problems in the current memory design

## 3.1 Store vs state is blurred in the UI

Several nodes *look* like “state memory helpers” but compile through the store.
That makes debugging, documentation, and user expectations drift apart.

## 3.2 User scoping is inconsistent

Current memory surfaces use at least two different patterns:
- `user_id_key` read from graph state
- `configurable.user_id` from runtime config

These should not coexist silently.

## 3.3 Key semantics are inconsistent

- `memory_store_read` hardcodes `profile_data`
- `memoryreader` / `memorywriter` use configurable `memory_key`
- `store_*` use explicit `store_item_key`

This is too many memory identity models for the same product surface.

## 3.4 Checkpointer durability and store durability are decoupled

You can have durable checkpoints with a non-durable store.
That is technically valid, but the UI should say so.

## 3.5 `cross_thread_memory` is currently more declarative than real

It exists, but the runtime/store backend behavior does not meaningfully branch on it yet.

## 3.6 LLM/tool access to memory is not unified in the product model

Officially, tools can access:
- short-term state,
- long-term store,
- runtime context,
- stream writer,
via `ToolRuntime`.

The current project does not yet expose that cleanly as a first-class structured authoring concept.

---

## 4. Main UI/UX problems

## 4.1 Too many memory-ish blocks without a stable mental model

Users currently have to infer differences between:
- checkpoint
- memory store read
- memoryreader
- memorywriter
- store_put/search/get/delete
- context_trimmer
- rag_retriever_local
- memory input on LLM/agent nodes

That is too much ambiguity for one palette.

## 4.2 “Read memory” vs “consume memory” is not explicit enough

A node can:
- retrieve/store memory,
- or merely accept memory as input.

Those should be clearly distinct in the editor.

## 4.3 The debugger/state panel likely needs source attribution

For memory effects, users need to know whether a value came from:
- thread state / checkpoint continuation
- store lookup
- prompt injection
- retrieval (RAG)
- or a tool-side runtime state/store access

Without this, memory debugging gets mystical.

---

## 5. What official LangGraph / LangChain memory systems say that matters here

## 5.1 Short-term memory
LangChain short-term memory is stored in agent/graph state and persisted via a **checkpointer**, so threads can resume later. State is read at each step, and long conversations usually need trimming, deletion, or summarization strategies.

## 5.2 Long-term memory
LangGraph long-term memory uses a **store** organized by namespace/key, and the recommended access pattern inside nodes is via the **Runtime** object, not ad hoc globals.

## 5.3 Tools can access memory too
LangChain tools can access:
- short-term state,
- runtime context,
- long-term store,
- stream writer,
through `ToolRuntime`.
This is very important for LangSuite, because it means “LLM wants to retrieve memory like a tool” is not a hack — it is a normal pattern.

## 5.4 Subgraphs/subagents and inspection limits
LangGraph can inspect subgraph state only when subgraphs are statically discoverable. If the subgraph is called indirectly inside a tool function or similar indirection, that nested state is not statically exposed in the same way.

This matters directly for:
- embedded artifacts,
- subagent-like patterns,
- and memory observability in the debugger.

---

## 6. Recommended cleanup and arbitration

## Priority A — clarify the families
The editor should distinguish at least these memory families:

### Family 1 — Thread / checkpoint memory
- `memory_checkpoint`
- resume / interrupt / thread persistence

### Family 2 — Store / long-term memory
- `store_put`
- `store_search`
- `store_get`
- `store_delete`
- `memory_store_read`

### Family 3 — Context management
- `context_trimmer`
- any future summarizer node

### Family 4 — Retrieval / external knowledge
- `rag_retriever_local`
- future retrievers

### Family 5 — Memory-consuming nodes
- `llm_chat` / `react_agent` `memory_in`

Right now these families are too blended.

## Priority B — fix naming/behavior mismatches
Most important:
- decide whether `memoryreader` / `memorywriter` should truly be **state-local helpers** or should be renamed into store-oriented helpers
- remove the hardcoded `profile_data` assumption from `memory_store_read`, or present it explicitly as `profile_store_read`
- unify user scoping strategy

## Priority C — expose durability honestly
Users should be able to tell whether they currently have:
- ephemeral checkpoint + ephemeral store
- durable checkpoint + ephemeral store
- durable checkpoint + durable store

That distinction matters a lot.

## Priority D — bring tool/runtime memory access into the product model
The official stack supports tools reading/writing state/store through runtime.
LangSuite should eventually expose a bounded way to author this.

---

## 7. Best next pass for memory

The next useful memory-focused pass should be something like:

**Memory semantics + durability pass**

Goals:
1. clarify memory families in the UI
2. unify `memory_store_read` / `memoryreader` / `memorywriter` semantics
3. make store durability/config explicit
4. surface source attribution in debug/state panels
5. begin exposing bounded tool/runtime memory access semantics in authored tool blocks or embedded artifacts

That would reduce both technical ambiguity and user confusion more effectively than simply adding more memory nodes.
