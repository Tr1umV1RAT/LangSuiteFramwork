# v95-jdr hotfix v4.1

## Fixed

### GraphPayload validation failure on build
The JDR starter could fail validation with:

`Edge source 'dice_tool_1' does not reference a known node`

### Root cause
Two separate issues combined:
1. The raw built-in starter manifest still contained tool visualization edges in `artifact.edges`.
2. The frontend export/build path converted all visible edges into API edges, including tool visualization edges, while tool nodes are exported separately in `tools` rather than in `nodes`.

### Corrections
- Raw starter manifest now keeps only true graph-node edges.
- Export/build now filters edges so only edges between exported API nodes are included in the payload.
- Regression test updated accordingly.

## Files touched
- `artifact_registry/graphs/jdr_solo_session_starter.json`
- `client/src/store.ts`
- `tests/test_v95_jdr_starter_contract.py`
