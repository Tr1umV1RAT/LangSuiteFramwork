# v95 JDR Metadata/UI Normalization v4.5

This pass aligned the JDR starter tool naming across IDs already normalized in v4.4, UI-facing labels, internal descriptions, and review-bundle copies.

Applied convention:
- `tool_rpg_dice_roller_1` → label `RPG Dice Roller`
- `tool_sub_agent_cast_*` → labels `Cast Advisor · <Role>`
- `tool_llm_worker_rules_referee_1` → label `Structured Rules Referee`

Updated assets:
- `artifact_registry/graphs/jdr_solo_session_starter.json`
- `client/src/store/tabletopStarter.ts`
- bundle copies under `v95_jdr_patch_bundle/files/...`
- review/version documents

Functional impact:
- no runtime model change
- no backend tool-type change
- consistent terminology in starter UI, guided builder, and review artifacts
