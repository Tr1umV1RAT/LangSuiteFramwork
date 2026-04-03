# LangSuite v88 — bounded future design for a real Module Library

## 1. Why the current surfaces are not yet a module library

The repository already has three adjacent surfaces:
- the **block palette** for inserting node definitions,
- the **Artifact Library** for opening saved artifacts,
- the **Subagent Library** for configuring bounded subagent groups.

Together, they are useful, but they do **not yet** form a true module library.

A real module library requires:
1. a stable module manifest,
2. explicit category-based loading,
3. explicit install/open effects,
4. truthful runtime/support labeling,
5. bounded extensibility rules,
6. deterministic materialization into existing product surfaces.

## 2. Product truth boundary

The future module library must be described as:
- a **loader/registry of reusable bundles**,
- not a new runtime,
- not an unrestricted plugin execution system,
- not a hidden mutation mechanism,
- not a replacement for the block palette,
- not a synonym for artifacts or subagents.

## 3. Minimal bounded product definition

A **Module** is a manifest-backed reusable bundle that can load one or more existing LangSuite surfaces into the current workspace in a deterministic way.

A module may materialize:
- artifact references,
- subagent groups,
- prompt strips in the future,
- palette shortcuts or starter recommendations,
- bounded configuration presets.

A module should **not** directly define a second runtime family.

## 4. First credible scope

### Supported module categories in v1
- `starter_bundle`
- `tool_bundle`
- `subagent_bundle`
- `memory_bundle`
- `debug_bundle`

These categories are product-facing organizational lenses.
They are **not** runtime kinds.

### Explicit exclusions in v1
- arbitrary Python package installation,
- custom frontend code injection,
- arbitrary JS plugins,
- live runtime mutation during a run,
- opaque modules with undisclosed dependencies,
- modules that claim provider/runtime support not already modeled elsewhere.

## 5. Manifest model

Suggested manifest shape:

```json
{
  "kind": "langsuite_module",
  "version": "v1",
  "id": "tool_bundle/http_basic",
  "title": "HTTP basic tools",
  "category": "tool_bundle",
  "description": "Reusable HTTP starter bundle.",
  "source": "built_in",
  "surfaceTruth": {
    "summary": "Loads reusable authoring assets only.",
    "runtimeEnabled": false,
    "compileSafe": false,
    "editorOnly": true
  },
  "installEffectSummary": "Adds reusable assets to the workspace.",
  "uninstallEffectSummary": "Removes module-owned references only if not adopted locally.",
  "artifacts": ["artifact:graph/http_debug_starter"],
  "subagentGroups": [],
  "promptStrips": [],
  "requiredCapabilities": ["graph"],
  "notes": ["Does not install Python packages."]
}
```

## 6. Loading semantics

A module load must be explicit about what happens.

### 6.1 Load effects in v1
- copies or references declared reusable assets into the workspace-owned registries,
- records module provenance,
- does not touch runtime state,
- does not install host dependencies,
- does not alter provider contracts,
- does not imply compile/runtime success.

### 6.2 Unload effects in v1
The safest first policy is:
- unload only removes the module registration,
- workspace materialized assets remain until explicitly removed by the user,
- if later "deep uninstall" is added, it must preview exactly what would be removed.

## 7. Where modules should live in the product

The future module library should be a dedicated library surface, not a relabeling of the palette.

### Suggested UI
- **Module Library** section near other library surfaces,
- category filters,
- install/open details,
- clear install effect summary,
- provenance badge on assets loaded from a module.

### Why not just put it in the palette
Because the palette is about **node insertion**. A module library is about **loading a bundle of reusable product assets**.

## 8. Relationship to existing surfaces

### Block palette
Remains the primary surface for adding individual node types.

### Artifact Library
Remains the surface for opening or publishing specific artifacts.
Modules may reference artifacts, but artifacts are not themselves modules.

### Subagent Library
Remains a workspace-owned bounded registry of subagent groups.
A module may populate subagent entries, but the subagent library does not become the module library.

### Prompt Strip System
If implemented later, prompt strips can become one of the asset classes a module may install.
The prompt-strip system still remains conceptually distinct.

## 9. Persistence and truth

The module library must use the same truth discipline as the rest of the product.

### Project save/open
Should persist:
- installed module metadata,
- module provenance on materialized assets.

Should not imply:
- runtime restore,
- dependency installation,
- provider readiness,
- secret/env persistence.

### Package export/import
Should preserve module metadata only as editable workspace/package state.

### Artifact open/save
Should remain separate. Opening an artifact is not equivalent to loading a module.

## 10. Exact future code areas to touch

### Registry/manifest loading
- add `core/module_registry.py`
- possibly add `module_registry/` as a sibling to `artifact_registry/`
- add a frontend API layer such as `client/src/api/modules.ts`

### Frontend/store
- `client/src/store/types.ts`
- `client/src/store/workspace.ts`
- `client/src/store.ts`
- new `ModuleLibrarySection.tsx`
- `client/src/components/BlocksPanelContent.tsx` only for navigation, not for semantic ownership

### Truth labeling
- `client/src/capabilityMatrix.json` only if module categories become first-class product metadata
- shared summary helpers so install/open/load effects remain consistent

## 11. Suggested state additions

Suggested persisted metadata:

```ts
export interface InstalledModuleRecord {
  moduleId: string;
  title: string;
  category: string;
  source: 'built_in' | 'filesystem' | 'package';
  loadedAt: string;
}
```

Suggested workspace metadata:
- `installedModules: InstalledModuleRecord[]`
- optional provenance on loaded assets: `moduleId?: string | null`

## 12. Validation plan

### Phase 1
- module install/uninstall copy is truthful,
- project save/load preserves installed module metadata,
- package export/import preserves editable module metadata,
- no UI copy implies runtime/package installation.

### Phase 2
- loading a module materializes only declared assets,
- provenance remains inspectable,
- uninstall behavior is previewed before destructive actions.

### Phase 3
- filesystem/custom module loading remains manifest-bounded,
- unsupported categories or malformed manifests fail clearly.

## 13. Do-not-destabilize rules

1. Do not conflate modules with artifacts.
2. Do not let modules bypass provider/runtime preflight truth.
3. Do not let modules install arbitrary host dependencies in v1.
4. Do not mutate the palette into the module system.
5. Do not claim runtime support from module visibility alone.
