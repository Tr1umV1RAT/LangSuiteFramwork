# LangSuite v86 — pre-run causality / truthful run-path pass

## Scope of this pass

This pass stays inside the existing product truth strategy.
It does **not** add new runtime capability.
It makes the **Run** surface more causal and less ambiguous by showing, in order:
1. what the editor can already know locally,
2. what the project-mode gate blocks before runtime,
3. what backend dependency preflight checks on Run,
4. and what runtime preflight re-checks against the real environment.

## What changed

### 1. The Run panel now exposes an ordered run path

Updated:
- `client/src/components/RunPanel.tsx`

Added a new section:
- `data-testid="runtime-run-path"`

It explains the actual sequence implied by the backend:
- local graph validation first,
- project-mode gate second,
- dependency preflight next when needed,
- runtime preflight after that.

This removes an important ambiguity: users no longer have to infer whether provider/dependency checks happen before or after project-mode blocking.

### 2. Runtime preflight is previewed more causally without pretending the UI knows the environment

The Run panel now previews *which kinds of checks* backend preflight will re-run from the graph shape itself, such as:
- provider base URLs and env vars,
- search-provider keys,
- GitHub configuration,
- bounded request targets,
- filesystem root paths,
- shell arming / allowlists,
- SQL safety mode.

Important truth boundary preserved:
- the UI still does **not** claim that these checks already passed,
- and it still does **not** claim to know installed Python packages.

### 3. The ordered explanation matches backend control flow

The pass explicitly aligns the UI story with the current backend order in `api/runner.py`:
- editor-only mode blocks first,
- missing runtime dependencies block after that,
- runtime preflight blocks after dependency checks.

## Why this pass matters

The earlier passes improved:
- artifact truth,
- package/project persistence truth,
- first-success starter access,
- and likely blocker messaging.

But one ambiguity remained:
- the user still had to guess the **actual order** of Run-time checks.

That matters because product trust is damaged when users cannot tell whether a failure is:
- a graph problem,
- a mode problem,
- a missing package problem,
- or an environment/config problem.

This pass makes that sequence visible without expanding support claims.

## Files touched

- `client/src/components/RunPanel.tsx`
- `tests/test_v86_run_path_causality.py`

## Validation executed

Command:
- `PYTHONPATH=. pytest -q tests/test_v84_truthful_surface_followup.py tests/test_v85_project_persistence_truth.py tests/test_v86_run_path_causality.py`

Result:
- **10 passed**

## Product truth after this pass

The Run surface now more clearly communicates:
- what the editor knows now,
- what Run blocks before runtime,
- what backend preflight confirms only at execution time,
- and why the UI is intentionally not the source of truth for installed dependencies.

## Best next pass

The next strongest bounded truth pass is likely one of:
1. **prompt/module boundary pass** — make it clearer that prompt nodes and scattered `system_prompt` fields do not yet constitute a dedicated prompt-strip authoring surface, and that the block palette / artifact library do not yet form a real module library; or
2. **provider-readiness consequence pass** — tighten how provider-local-vs-cloud constraints are signaled in setup surfaces before users even reach Run.
