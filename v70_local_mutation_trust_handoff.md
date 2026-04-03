# LangSuite v70 — local mutation trust handoff

## What changed

This pass added truthful review-before-apply semantics to:

- `fs_write_file`
- `fs_edit_file`
- `fs_apply_patch`

and tightened structured shell result truth for:

- `shell_command`

## Runtime contract now

### Filesystem mutation tools

These tools now compile with:

- `mode='preview'` (default)
- `mode='apply'`

Statuses now include:

- `preview`
- `applied`
- `blocked`
- `failed`
- `partially_applied` (patch writes only, when genuinely true)

### Shell tool

Still no dry-run.
Still user-armed.
Now returns structured payloads with:

- `blocked`
- `failed`
- `succeeded`

## Important implementation note

Preview paths are genuinely non-mutating now.
In particular, write-target resolution no longer creates parent directories during preview.

## Files most relevant for future work

- `templates/tools.py.jinja`
- `client/src/capabilityMatrix.json`
- `client/src/nodeConfig.ts`
- `client/src/components/BlocksPanelContent.tsx`
- `tests/test_v70_local_mutation_trust.py`

## Truthful limitations

- no atomic cross-file patch guarantee
- no shell sandboxing
- no shell preview
- no dedicated frontend preview-result renderer yet

## Suggested follow-up

Build a compact run/debug payload renderer for local mutation results so preview/apply/blocked states become immediately readable in the UI without inspecting raw JSON.
