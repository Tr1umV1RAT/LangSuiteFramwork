# Hotfix v4.2 — stale tool-edge cleanup after tool replacement

## Problem fixed
If a visible tool node was deleted and replaced, the editor could keep stale `tool_out -> tools_in` edges and stale `tools_linked` references.

This produced pre-run validation failures such as:
- `Lien invalide: la source "dice_tool_1" ne correspond à aucun nœud visible.`

## Fixes applied

### 1. `client/src/store.ts`
`onNodesChange(...)` now:
- detects removed node IDs,
- prunes edges whose source or target no longer exists,
- rebuilds `tools_linked` on surviving target nodes so deleted tool IDs are removed.

### 2. `artifact_registry/graphs/jdr_solo_session_starter.json`
The visible starter label was clarified from `Dice Roller` to `RPG Dice Roller`.

## Expected result
After deleting or replacing the starter dice tool, the graph should no longer remain blocked by stale `dice_tool_1` references.
