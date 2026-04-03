# v19b corrective changelog

## Intent
A narrow corrective pass after the v19 UI regression report.

This package intentionally resets the user-facing UI surfaces to the stable v18 state and keeps only one low-risk store fix:
- `palettePreset` persistence now correctly accepts the canonical `graph` preset
- `defaultRunPanelTab` sanitization now accepts the full tab union, including `inputs`

## What was intentionally *not* carried over from v19
The v19 UI-layer changes were not kept in this corrective build:
- RunPanel v2 framing and fallback chrome
- shared surface-language helper abstraction
- compatibility wording normalization spread across several components
- extra palette helper chrome and preset copy changes
- simple-mode tab badge logic changes

## Why
The regression report pointed to UI breakage rather than a backend/runtime issue.
The safest corrective action was to:
1. return to the proven v18 UI surfaces,
2. use v17 as a visual restraint reference,
3. keep only the store-level fix that is easy to justify and validate.

## Files changed relative to the v18 codebase
- `client/src/store.ts`
- `v19b_corrective_changelog.md`
- `v19b_validation_summary.md`
