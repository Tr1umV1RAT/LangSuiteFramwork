# LangSuite integrated source package

This archive is a clean integrated source snapshot of the current LangSuite working tree after the recent truth / memory passes.

## Included
- source code
- tests
- templates
- static assets needed by the repo
- reports / handoff docs already present in the working tree
- new memory design docs (`v102_memory_plane_design.md`, `v102_recent_passes_summary.md`)

## Excluded
- `client/node_modules/`
- `client/dist/`
- `__pycache__/`
- `.pytest_cache/`
- other transient cache folders

The goal is to give a stable repo snapshot to replace the fragmented chain of individual patch bundles.
