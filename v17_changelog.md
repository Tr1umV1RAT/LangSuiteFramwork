# v17 changelog

## Added
- Minimal preferences shell (`SettingsShell`) with persistent workspace settings.
- Persistent UI preferences in Zustand/localStorage.
- Simple-mode appearance controls for technical badges, artifact badges, and `scopePath`.

## Changed
- `TabBar` is now substantially lighter in simple mode.
- `BlocksPanelContent` simple mode is more compact and less box-heavy.
- `StatePanelContent` simple mode uses calmer disclosure defaults.
- `CustomNode` simple mode shows fewer technical chips by default.
- `RunPanel` keeps v16 structure while honoring JSON visibility, default tab, and log autoscroll preferences.
- `App` now honors minimap, snap-to-grid, density, and unsaved-close confirmation preferences.
- Autosave can now be disabled from preferences.

## Kept intact
- v16 `simple | advanced` model
- editor mode persistence
- RunPanel 3-view structure
- backend/runtime behavior
- conceptual advanced layer
