# Hotfix v4.10 — RPG dice roller runtime-build fix

## Problem
The JDR starter could compile to a zip, but runtime build failed with:

- `Build error: name 'tool_rpg_dice_roller_1' is not defined`

## Root cause
`templates/tools.py.jinja` contained a duplicated Jinja branch header for the same tool family:

- `elif t.type == 'rpg_dice_roller'`
- immediately repeated a second time

This caused the dice tool section to emit only the comment header in generated `tools.py`, without generating the actual function definition.
The rest of the graph then referenced `tool_rpg_dice_roller_1` from `ACTIVE_TOOLS_BY_ID`, producing the runtime-build failure.

## Fix
- removed the duplicated Jinja branch in `templates/tools.py.jinja`
- strengthened `tests/test_v95_jdr_starter_contract.py` to assert that compiled `tools.py` now contains:
  - `def tool_rpg_dice_roller_1`
  - the expected RPG dice roller docstring text

## Result
The compiled JDR starter now emits a real dice tool function and no longer fails at runtime build for that symbol.
