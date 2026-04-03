# FrameworkLangchain repair handoff v11

This pass focused on **identity/scoping coherence** rather than runtime redesign.

## What was completed in v11
- introduced a minimal scope model in the frontend store:
  - `scopeKind`
  - `scopePath`
  - consistent reuse of `parentProjectId` / `parentNodeId`
- compile/export now derives a deterministic scoped `graph_id`
- compile payload now carries optional `ui_context`
- DB save/session create reuse parent lineage when present
- collaboration websocket sync now preserves scope metadata in project JSON
- UI terminology shifted toward:
  - `Subgraph`
  - `Subgraph Tool`
- compatibility aliases added:
  - `subgraph` → `sub_agent`
  - `subgraph_tool` → `sub_agent_tool`
- TabBar now visually distinguishes graphs/tabs with:
  - stable accent color
  - `SG` badge for subgraphs
  - visible scope path

## Important remaining caveats
- this still does **not** redesign the runtime away from the global `graph` alias
- this still does **not** make the editor a true multi-framework builder
- collaboration remains last-writer-wins
- alias support is compatibility glue, not a new execution model

## Best next pass
1. browser/manual QA on:
   - multiple open tabs/projects
   - subgraph tabs
   - save/load/reload
   - collab sync + compile-after-reload
2. decide whether scope metadata should become first-class in backend storage schema rather than graph JSON payload only
3. revisit whether explicit UI modes should exist later:
   - graph mode
   - higher-level agent/wrapper mode
4. redesign generated subgraph runtime so it no longer depends on the global `graph` alias
