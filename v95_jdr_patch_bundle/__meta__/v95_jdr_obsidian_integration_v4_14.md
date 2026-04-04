# v4.14 — Obsidian companion integration for JDR sessions

## What was added

This pass adds a bounded **Obsidian companion vault export** for graph-authored tabletop sessions.

It does **not** add:
- a new runtime,
- direct Obsidian process control,
- a plugin system,
- or a second persistence rail.

The graph remains the runtime source of truth.
Obsidian is treated as a markdown-facing campaign / prep / play-notes companion.

## Backend
- Added `core/obsidian_export.py`
- Added `api/obsidian.py`
- Registered the router in `main.py`

New endpoint:
- `POST /api/obsidian/vault`

It accepts the current graph payload and exports a `.zip` vault containing:
- session hub note
- graph runtime note
- current scene note
- loaded modules index
- prompt-strip notes
- cast/group/agent notes
- `_langsuite/graph_payload.json`
- `_langsuite/runtime_settings.json`

## Frontend
- Updated `client/src/components/Toolbar.tsx`

When the active tab is recognized as tabletop/JDR, the toolbar now shows:
- `Obsidian vault`

This exports a markdown companion vault for the current graph.

## Tests
- Added `tests/test_v97_obsidian_jdr_export.py`

Coverage includes:
- endpoint returns a valid zip
- expected vault files are present
- prompt and cast notes are exported
- payload trace file is included
