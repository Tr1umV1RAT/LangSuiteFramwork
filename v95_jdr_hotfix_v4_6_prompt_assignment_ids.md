# v95-jdr hotfix v4.6 — Prompt assignment ID sanitization

## Problem
Guided tabletop builds could generate `runtimeSettings.promptStripAssignments[].id` values containing `:` because module merge logic embedded serialized target keys such as `graph:starter_tab` and `subagent:starter_tab:group:agent` into assignment IDs.

The backend `GraphPayload` schema requires prompt assignment IDs to be valid Python identifiers using only letters, digits, and underscores. This caused build-time validation failures.

## Fix
Updated `client/src/store/workspace.ts` to sanitize prompt assignment IDs aggressively and keep them valid across:
- module merge into runtime settings
- runtime settings sanitization
- prompt assignment remap to a new tab ID

### Code changes
- added `sanitizePromptAssignmentIdentifier(...)`
- added `buildPromptAssignmentTargetIdPart(...)`
- changed module-generated assignment IDs to use underscore-only target ID parts
- changed `sanitizePromptStripAssignment(...)` to normalize IDs
- changed `sanitizePromptStripAssignments(...)` to de-duplicate sanitized IDs safely
- changed `remapPromptAssignmentsToTabId(...)` to re-sanitize the remapped assignments

## Impact
- guided tabletop starter builds no longer emit invalid prompt assignment IDs
- starter/open-tab remapping remains stable
- no runtime contract, compiler contract, or module-library contract changed

## Files updated
- `client/src/store/workspace.ts`
- `tests/test_v95_jdr_starter_contract.py`
- bundle copies under `v95_jdr_patch_bundle/files/...`
