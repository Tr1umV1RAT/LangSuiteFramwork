# v95 JDR Patch Bundle

Ce dossier contient en doublon les **fichiers source ajoutés ou modifiés** dans le patch `v95-jdr-demo-branch-v2`, avec leur **arborescence relative conservée** sous `files/`.

Sont exclus volontairement :
- les caches Python (`__pycache__`, `.pyc`)
- les caches pytest
- la base SQLite locale générée pendant les tests
- tout autre artefact d'exécution non source

Le journal de version détaillé se trouve dans :
- `../v95_jdr_version_log.md`
- `./v95_jdr_version_log.md`


Document de revue complémentaire :
- `../v95_jdr_file_review_summary.md`
- `./v95_jdr_file_review_summary.md`
- `./review/v95_jdr_file_review_summary.md`


## Additional note
A cleanup naming pass (v4.3) renamed the tabletop starter dice tool instance from `dice_tool_1` to `rpg_dice_roller_1` for clarity.

A normalization pass (v4.4) renamed all JDR starter tool instance IDs to a single homogeneous convention.

A metadata/UI normalization pass (v4.5) aligned the JDR starter tool labels and internal descriptions with the normalized instance-ID convention.
- hardening note: `v95_jdr_hardening_v4_7_guided_prompt_assignment_test.md`


## Added in v4.8
- Repair pass sync for authoring-first JDR setup
- Provider-neutral starter manifest
- Guided-builder matrix tests
- JDR persistence roundtrip tests


- v4.9 expands the JDR module catalog with additional worlds, casts, rules stances, tones, and two utility modules.
- v4.13 adds runtime dependency alignment artifacts for compiler/runtime/install coherence.
