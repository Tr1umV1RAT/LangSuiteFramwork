# LangSuite v88 — bounded future design for a real Prompt-Strip System

## 1. Why this needs its own product surface

The current repository already contains:
- local prompt-bearing nodes such as `prompt_template`;
- multiple node families carrying `system_prompt` fields in `client/src/nodeConfig.ts`;
- subagent-local prompts stored inside `runtimeSettings.subagentLibrary` and edited from `client/src/components/StatePanelContent.tsx`.

That is **not yet** a real prompt-strip system.

A real prompt-strip system must be a **separate authoring and assignment surface** with all of the following properties:
1. prompts are stored as named reusable assets,
2. assignments are explicit and inspectable,
3. propagation into compile/runtime is deterministic,
4. the final resolved prompt is previewable,
5. precedence between strip content and node-local prompts is formally defined,
6. package/project/artifact semantics remain truthful.

## 2. Product truth boundary

This future system must be described as:
- **editor-backed and compile-aware** in phase 1,
- **runtime-backed through existing prompt-bearing nodes** in phase 2,
- **not** a new runtime family,
- **not** an LLM memory system,
- **not** a module loader,
- **not** a hidden global mutation layer.

It must remain distinct from:
- the block palette,
- the Artifact Library,
- the Subagent Library,
- node-local `system_prompt` fields,
- package import/export,
- runtime restore.

## 3. Minimal bounded product definition

A **Prompt Strip** is a named reusable prompt asset that can be assigned to explicit targets in a workspace.

A **Prompt Assignment** is a deterministic rule binding one prompt strip to one explicit target with a declared merge mode and order.

### 3.1 Supported targets in the first credible version

Only support explicit targets that already have a clear prompt-bearing meaning in the repository:
- graph-wide default target for the active tab,
- a specific prompt-capable node by `nodeId`,
- a specific subagent entry inside `runtimeSettings.subagentLibrary`.

Do **not** support in v1:
- wildcard assignment by free-text category,
- per-edge prompt injection,
- automatic tool-family matching,
- hidden assignment by provider/model name,
- cross-project implicit inheritance.

## 4. Data model for v1

Add two new workspace-owned structures.

### 4.1 Prompt strip registry

Suggested TypeScript interface:

```ts
export interface PromptStripDefinition {
  id: string;
  name: string;
  description?: string;
  body: string;
  tags: string[];
  variables: { name: string; required: boolean; defaultValue?: string }[];
  origin: 'workspace' | 'artifact';
  artifactRef?: string | null;
}
```

### 4.2 Prompt assignment registry

```ts
export type PromptAssignmentTarget =
  | { kind: 'graph'; tabId: string }
  | { kind: 'node'; tabId: string; nodeId: string }
  | { kind: 'subagent'; tabId: string; groupName: string; agentName: string };

export type PromptStripMergeMode = 'prepend' | 'append' | 'replace_if_empty';

export interface PromptStripAssignment {
  id: string;
  stripId: string;
  target: PromptAssignmentTarget;
  mergeMode: PromptStripMergeMode;
  order: number;
  enabled: boolean;
}
```

## 5. Storage choice

The smallest stable place is inside the existing workspace/runtime settings domain, because:
- `subagentLibrary` is already stored there,
- project save/load and package import/export already persist bounded authoring state,
- this avoids inventing a second persistence rail too early.

Suggested addition to `RuntimeSettings` in `client/src/store/types.ts`:

```ts
promptStripLibrary: PromptStripDefinition[];
promptStripAssignments: PromptStripAssignment[];
```

This keeps the first implementation inside existing save/load/package surfaces while remaining truthful: it persists **authoring data**, not live runtime state.

## 6. Deterministic resolution rules

The system should be useful without destabilizing existing local prompts.

### 6.1 Resolution order

For a prompt-capable target, compute the final prompt in this order:
1. all enabled assigned strips with `prepend`, sorted by `order`,
2. existing local prompt text already owned by the target,
3. all enabled assigned strips with `append`, sorted by `order`,
4. `replace_if_empty` applies only if the target has no local prompt text.

### 6.2 Why this order

- It preserves the current meaning of node-local and subagent-local prompt fields.
- It avoids hidden destructive replacement.
- It keeps assignments inspectable and reversible.
- It lets a future graph-wide strip provide common framing without pretending to erase local author intent.

### 6.3 Required preview

The editor must expose a **resolved prompt preview** for any selected target before compile/run.
That preview is the trust anchor.

## 7. Compile/runtime contract

The prompt-strip system should not require a new runtime subsystem.

### Phase 1 behavior
- editor stores prompt strips and assignments,
- preview resolution is available,
- compile/runtime behavior remains unchanged until explicit propagation is implemented,
- surface classification: **editor-only**.

### Phase 2 behavior
- `core/compiler.py` resolves prompt-strip assignments into the generated node params or generated helper metadata,
- templates propagate the final resolved prompt into already existing prompt-bearing node families,
- runtime remains unchanged because the runtime already consumes the resolved node params,
- surface classification: **supported with constraints**.

### Phase 3 behavior
- optional artifact-backed prompt-strip publishing/import, still as authoring data only,
- surface classification: **package/import-export only** for the artifact rail.

## 8. UI surfaces for the real feature

### 8.1 Dedicated panel

Add a dedicated panel section, separate from the block palette and separate from the Subagent Library:
- **Prompt Strips**
- list of strips
- create/edit/delete strip
- assign strip
- preview final prompt on selected target

### 8.2 Assignment UX

Assignments should be explicit and target-driven:
- "assign to selected node"
- "assign to this subagent"
- "assign as graph default"

Do **not** start with drag-and-drop from vague categories.

### 8.3 Capability/inspector UX

When a prompt-capable node is selected, the capability inspector should say:
- local prompt present or absent,
- assigned strips count,
- resolved prompt preview available,
- compile/runtime meaning of this surface.

## 9. Non-goals

The first real prompt-strip system must **not** claim any of the following:
- prompt retrieval from memory/RAG,
- dynamic prompt generation by runtime state,
- global hidden prompt mutation,
- automatic assignment by model/provider/tool family,
- cross-project organization-level prompt governance,
- hot-reload of external prompt packs.

## 10. Exact future code areas to touch

### Phase 1
- `client/src/store/types.ts`
- `client/src/store/workspace.ts`
- `client/src/store.ts`
- `client/src/components/StatePanelContent.tsx`
- `client/src/components/CapabilityInspectorSection.tsx`
- `client/src/nodeConfig.ts` only to mark prompt-capable families more explicitly if needed

### Phase 2
- `core/compiler.py`
- `templates/graph.py.jinja`
- `templates/nodes.py.jinja`
- compile/runtime truth tests

### Phase 3
- `core/artifact_registry.py`
- `api/artifacts.py`
- `client/src/api/artifacts.ts`
- Artifact Library UI

## 11. Validation plan

### Phase 1
- save/load preserves prompt-strip library and assignments,
- package export/import preserves them as authoring data,
- prompt-strip UI never claims runtime propagation yet,
- resolved prompt preview is stable and deterministic.

### Phase 2
- compile output contains the resolved prompt text,
- runtime behavior matches preview,
- no node without prompt-bearing semantics receives prompt-strip propagation,
- existing local prompts remain unchanged when no strip is assigned.

### Phase 3
- artifact publish/open preserves strip definitions truthfully,
- no wording implies runtime restore or secret/env preservation.

## 12. Do-not-destabilize rules

1. Do not remove node-local `system_prompt` fields.
2. Do not overload the Subagent Library to become the prompt-strip system.
3. Do not introduce hidden merge behavior.
4. Do not claim phase-2 runtime support before compiler propagation exists.
5. Do not let artifact publishing imply runtime persistence.
