# Handoff: v75 hover brushing / lock-hover UX

## What changed

This pass adds one shared runtime hover channel and uses it everywhere the repo already had real execution correspondence surfaces.

### Shared state

- `runtimeHoverTarget`
- `runtimeNavigationSettings.lockHover`
- `runtimeNavigationSettings.followActiveNode`

### Graph

- hover-brushed authored edges:
  - inbound
  - outbound
  - muted others
- hover-brushed nodes:
  - hovered node
  - predecessors
  - successors
  - muted others

### Panels

- timeline hover publishes node hover target
- run-log hover publishes node hover target
- debug/state path chips publish node hover target
- matching entries visibly highlight when their node matches the shared hover target

## Validation run

- Python regression slice: `37 passed`
- TypeScript transpile parse check: `transpile-ok`

## Honest caveat

The latest actual archive present in the environment was v73, not v74, so this pass was built on the latest available artifact.

## Suggested next pass

- keyboard / click ergonomics for hover lock
- richer hover legend showing actual predecessor/successor node ids
