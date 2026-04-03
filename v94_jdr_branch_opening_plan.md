# v94 — Opening seam from `main` toward a future tabletop-RPG demo branch

## Goal

Prepare `main` so a future **JDR/tabletop RPG demo branch** can diverge mostly through:
- prompt assets,
- subagent casts,
- rule/world/persona modules,
- starter references,
- visual theme hints,
- and branch/profile metadata,

without forking the runtime model, compile model, or persistence semantics.

## What v94 adds

v94 keeps the existing bounded **Module Library** contract, but adds branch-opening metadata so modules can be:
- **shared trunk assets**,
- or **branch overlays**,
while staying readable and preservable by the same workspace/package/project rails.

Added metadata on module entries:
- `lineage`: `shared` | `branch_overlay`
- `branchTargets`: advisory compatible branch identifiers (for example `main`, `jdr_demo`)
- `recommendedProfile`: optional bounded profile hint
- `themeHints`: advisory UI/theme hints (for example `paper`, `fantasy`, `grimdark`)
- `compatibilityNotes`: human-readable compatibility notes

## Why this is the right seam

This does **not** add:
- a plugin runtime,
- a new execution rail,
- a branch-specific compiler,
- or a branch-specific persistence subsystem.

It simply lets `main` host generic, future-portable authoring bundles that a domain/demo branch can interpret more richly later.

## Intended branch policy

### `main`
- owns the runtime/compiler/persistence truth,
- keeps generic capability surfaces,
- accepts shared modules and compatibility-safe overlays,
- does not become JDR-specific in its vocabulary by default.

### `jdr-demo`
- reuses the same runtime/compiler/persistence rails,
- adds domain packs, cast packs, universe packs, rules packs, and visual overlays,
- may interpret `recommendedProfile`, `themeHints`, and `branchTargets` more aggressively,
- but should keep reading/writing shared module entries compatibly.

## Retrocompatibility rule

A module created in `main` should remain readable in `jdr-demo`.
A module created in `jdr-demo` should remain loadable in `main` as long as it only uses:
- bounded module payloads,
- safe prompt-strip assets,
- bounded subagent groups,
- starter refs,
- runtime context,
- and advisory metadata.

If `jdr-demo` later adds domain-only metadata, it should do so additively and tolerate lossless ignore on `main` where possible.

## Recommended next domain step

Build the first **domain pack** as modules, not as core features:
- `world` module
- `rules` module
- `persona/cast` module
- `utility` module for scene/session helpers

Then let the branch change:
- copy,
- defaults,
- theme,
- starter selection,
- and orchestration patterns.

Keep the trunk neutral.
