# LangSuite v70 — local mutation trust pass report

## Executive summary

This pass implemented truthful review-before-apply semantics for the local mutation tools that are already real in the repository:

- `fs_write_file`
- `fs_edit_file`
- `fs_apply_patch`

It also tightened shell result truth for the existing user-armed shell surface without inventing shell dry-run semantics.

The compile/runtime trunk remains LangGraph-first. No sandboxing claims were added. Mutation preview and mutation apply are now explicitly distinct in generated runtime code and in the editor-facing semantic copy.

## Actual repository findings before implementation

### Local mutation tools were already real, but direct-apply only

The repo already defined local mutation tools in `templates/tools.py.jinja`:

- bounded file write
- bounded file edit
- bounded unified-diff patch apply
- user-armed shell command execution

These surfaces were already wired through:

- `client/src/nodeConfig.ts`
- `client/src/capabilityMatrix.json`
- `client/src/store.ts`
- `client/src/store/artifactHydration.ts`
- `core/runtime_preflight.py`

### Canonical semantic source already existed

`client/src/capabilityMatrix.json` is the canonical semantic source for tool-family, mutability, provisioning model, and inspector-facing truth copy.

### Result contract existed only implicitly

The repo already uses a returned-tool-payload model, but the local mutation tools mostly returned:

- JSON on success
- plain strings on blocked/failed paths

That meant preview/apply/blocked/failed were not normalized into one structured payload shape.

### Generated runtime code already carried shell arming

The generated tools template already injected `SHELL_EXECUTION_ENABLED`, and runtime preflight already exposed shell arming as a real graph-level gate.

### Important truth issue found during audit

`_resolve_filesystem_target_for_write(...)` would eagerly create parent directories when `create_dirs=true`.
That meant a naive preview mode would have mutated the filesystem during “resolution”, which would have violated the requested trust pass.

## Implementation plan used

1. Preserve the existing tool surfaces and compile path.
2. Introduce the smallest coherent review/apply contract via tool argument `mode: str = 'preview'` for the three filesystem mutation tools.
3. Normalize local mutation results into structured JSON payloads with explicit status fields.
4. Make preview paths non-mutating, including directory-creation preview.
5. Reword the semantic source-of-truth and palette/inspector-facing copy to reflect preview/apply truth.
6. Improve shell blocked/failed/succeeded payload truth without claiming shell preview.
7. Add runtime tests that execute real generated tool code.

## Concrete changes made

### 1) Generated runtime helpers

Modified `templates/tools.py.jinja` to add:

- `_filesystem_relative_path(...)`
- `_blocking_reason(...)`
- `_tool_payload_json(...)`
- `_normalize_mutation_mode(...)`
- `_filesystem_reason_code(...)`

These now provide a single structured payload system for the local mutation pass.

### 2) Non-mutating preview-safe write target resolution

Modified `templates/tools.py.jinja`:

- `_resolve_filesystem_target_for_write(...)` now takes `prepare_dirs: bool = False`
- preview paths resolve targets without creating directories
- apply paths can still create directories when enabled

This was the most important correctness fix in the pass.

### 3) `fs_write_file` review/apply contract

`fs_write_file` now compiles with:

- signature: `(relative_path, content, mode='preview')`
- preview result with:
  - `status: preview`
  - create vs overwrite reporting
  - size estimate
  - `would_create_dirs`
- apply result with:
  - `status: applied`
  - `created` / `overwrote`
- blocked result with explicit reason codes such as:
  - `invalid_mode`
  - `root_escape_attempt`
  - `file_too_large`
  - `overwrite_not_allowed`

### 4) `fs_edit_file` review/apply contract

`fs_edit_file` now compiles with:

- signature: `(relative_path, find_text, replace_with, mode='preview')`
- preview result with:
  - `status: preview`
  - `matches_found`
  - `replacements_planned`
  - single vs all replacement mode
- apply result with:
  - `status: applied`
  - `replacements_applied`
- blocked result with explicit reason codes such as:
  - `missing_find_text`
  - `target_missing`
  - `edit_match_missing`
  - `root_escape_attempt`

### 5) `fs_apply_patch` review/apply contract

`fs_apply_patch` now compiles with:

- signature: `(patch, mode='preview')`
- preview path that:
  - parses the patch
  - validates bounded paths
  - distinguishes modify vs create
  - validates in memory without writing
  - reports `files_to_modify`
  - reports `files_to_create`
  - reports `files_rejected`
  - reports `blocking_reasons`
- apply path that:
  - writes only after the preview plan is clean
  - returns `status: applied` on success
  - returns `status: blocked` if the patch plan is not clean
  - truthfully returns `partially_applied` if a later write fails after earlier writes already landed

Explicit patch-side reason codes now include cases such as:

- `invalid_patch`
- `root_escape_attempt`
- `patch_creation_not_allowed`
- `patch_delete_not_supported`
- `patch_rename_not_supported`
- `file_too_large`
- `target_already_exists`

### 6) Shell truth tightening without fake preview

`shell_command` was updated to keep the real user-armed contract and return structured payloads with:

- `status: blocked`
- `status: failed`
- `status: succeeded`

and explicit reason codes such as:

- `shell_not_armed`
- `invalid_cwd`
- `missing_shell_allowlist`
- `invalid_shell_command`
- `shell_command_not_allowed`
- `shell_runtime_failure`
- `shell_command_failed`

No shell dry-run or sandboxing claims were added.

### 7) Semantic/UI truth surfaces updated

Updated:

- `client/src/capabilityMatrix.json`
- `client/src/nodeConfig.ts`
- `client/src/components/BlocksPanelContent.tsx`

These now describe the tools as preview/apply surfaces where appropriate, and the shell surface as explicit blocked/failed/succeeded status reporting.

## Tests added and updated

### Updated tests

- `tests/test_v68_local_mutation_and_shell_tools.py`
- `tests/test_v69_apply_patch_tool.py`

### New tests

- `tests/test_v70_local_mutation_trust.py`

### Coverage added

The new/updated tests cover:

- capability-matrix truth for preview/apply mutation semantics
- compile output containing review/apply runtime helpers
- preview mode not mutating for write and patch
- directory creation not happening during preview
- apply mode mutating when valid
- overwrite denial being explicit
- edit no-match being explicit
- invalid patch being explicit
- root escape being blocked explicitly
- shell blocked state when not armed
- shell allowlist denial
- real generated runtime code execution

## Test results actually run

Command run:

```bash
pytest -q tests/test_v68_local_mutation_and_shell_tools.py tests/test_v69_apply_patch_tool.py tests/test_v70_local_mutation_trust.py
```

Result:

- `24 passed`

## Remaining gaps / known limitations

1. **No atomic multi-file patch guarantee**
   Multi-file patch apply is still sequential file IO. This pass does not claim atomicity. It now reports `partially_applied` truthfully if a later write fails after earlier writes succeeded.

2. **No shell preview**
   This was intentionally not added because the current repo does not honestly support it.

3. **No bespoke result-card UI for these payloads**
   The repo already supports returned tool payloads. This pass normalized those payloads, but it did not add a dedicated frontend renderer for mutation previews.

4. **Patch applicability remains bounded, not full git-style compatibility**
   The patch parser handles the repository’s current unified-diff scope but does not claim full `git apply` parity.

## Recommended next pass

A good next pass would be a **returned-tool-payload rendering pass** in the run/debug UI:

- compact badges for `preview / applied / blocked / failed / partially_applied`
- collapsed lists for `files_to_modify`, `files_to_create`, `files_rejected`
- compact reason-code chips

That would improve user trust further without changing runtime semantics.

## Final artifact list

Modified files:

- `templates/tools.py.jinja`
- `client/src/capabilityMatrix.json`
- `client/src/nodeConfig.ts`
- `client/src/components/BlocksPanelContent.tsx`
- `tests/test_v68_local_mutation_and_shell_tools.py`
- `tests/test_v69_apply_patch_tool.py`
- `tests/test_v70_local_mutation_trust.py`
- `v70_local_mutation_trust_report.md`
- `v70_local_mutation_trust_handoff.md`
