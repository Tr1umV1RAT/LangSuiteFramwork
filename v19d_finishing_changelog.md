# v19d finishing pass

## Goal
Finish the narrow UI iteration after the v19c pass by reducing side-panel pressure on the top chrome and improving readability in the palette helper / quickstart area.

## Changes

### Side panels
- Reduced side-panel widths across `blocks`, `state`, and `debug`.
- Moved fixed side panels below the toolbar + tab bar stack using a shared `APP_TOP_OFFSET`.
- Moved panel grab tabs and drop indicators into the same post-header layout so they no longer eat into the top chrome.

### Palette / quickstart readability
- Reflowed the helper cards in `BlocksPanelContent` so descriptive copy gets its own line block.
- Stacked palette controls more cleanly instead of cramming text and toggles into the same tight row.
- Let quick-insert buttons wrap labels naturally instead of truncating them.
- Slightly increased inner spacing rhythm for helper sections.

## Intentionally unchanged
- No backend/runtime redesign.
- No store shape redesign.
- No new persisted preference keys.
- No changes to the runtime truth / conceptual wording contract.
