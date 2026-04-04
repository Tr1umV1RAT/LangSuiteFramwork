# v95 JDR Cleanup Naming Pass v4.3

## Summary
A naming cleanup was applied to the tabletop starter so the visible RPG dice tool instance now uses an explicit, self-describing graph-local ID.

## Change
- Renamed the starter tool instance ID from `dice_tool_1` to `rpg_dice_roller_1`.
- Updated the GM node `tools_linked` references in the starter manifest.
- Updated the duplicated starter copy inside `v95_jdr_patch_bundle/files/...`.

## Why
The backend tool family was already correct (`rpg_dice_roller`), but the graph-local instance ID `dice_tool_1` looked like a legacy generic tool name and caused avoidable confusion during review and debugging.

## Scope
This cleanup only affects the JDR starter instance naming. It does not change the underlying tool family, compiler behavior, runtime contracts, or other existing artifacts that legitimately still use `dice_tool_1`.

## Result
The tabletop starter now uses:
- tool family: `rpg_dice_roller`
- tool instance id: `rpg_dice_roller_1`
- visible label: `RPG Dice Roller`
