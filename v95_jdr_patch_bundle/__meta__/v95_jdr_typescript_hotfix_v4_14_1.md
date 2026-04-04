# Hotfix v4.14.1 — Artifact manifest runtimeSettings typing

## Problem
TypeScript build failed in `src/App.tsx` because `fetchArtifactManifest()` exposed
`artifact.runtimeSettings` as a loose union with `streamMode: string`, which was not
assignable to `Partial<RuntimeSettings>` expected by the guided JDR builder.

## Fix
Updated `client/src/api/artifacts.ts` to type `artifact.runtimeSettings` as
`Partial<RuntimeSettings>` using the shared store runtime settings contract.

## Effect
This narrows the manifest typing to the actual runtime settings shape used by the
editor/store and removes the `streamMode` widening that triggered the build error.
