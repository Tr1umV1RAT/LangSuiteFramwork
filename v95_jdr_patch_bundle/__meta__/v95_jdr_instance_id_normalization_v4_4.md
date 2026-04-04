# v95 JDR instance ID normalization pass v4.4

This pass normalizes all tool instance IDs in the JDR starter so they follow one consistent naming convention.

## Scope
- `artifact_registry/graphs/jdr_solo_session_starter.json`
- `client/src/store/tabletopStarter.ts`
- bundle duplicate copies of those files

## New naming convention
- `tool_rpg_dice_roller_1`
- `tool_sub_agent_cast_1`
- `tool_sub_agent_cast_2`
- `tool_sub_agent_cast_3`
- `tool_llm_worker_rules_referee_1`

## Replaced IDs
- `rpg_dice_roller_1` → `tool_rpg_dice_roller_1`
- `npc_innkeeper_tool` → `tool_sub_agent_cast_1`
- `npc_scout_tool` → `tool_sub_agent_cast_2`
- `npc_guard_tool` → `tool_sub_agent_cast_3`
- `rules_referee_tool` → `tool_llm_worker_rules_referee_1`

## Functional impact
- The starter now uses homogeneous tool instance IDs.
- Guided cast remapping still works because the three cast tools are still addressed by stable slot IDs rather than world-specific NPC names.
- No backend tool type changed.

## Risk
Low. The change is limited to JDR-starter-local instance IDs and their direct references.
