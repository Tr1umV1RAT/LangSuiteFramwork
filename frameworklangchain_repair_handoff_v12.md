# Handoff Memo v12

## Baseline
Continue from `frameworklangchain_repaired_audit_v12.zip`.
This pass did **not** change the core generated runtime semantics. It improved the editor and persistence model around scope/runtime visibility and graph-level bindings.

## What changed
- Graph-level bindings (`graphBindings`) are now a first-class editor/persistence concept.
- State panel became a broader state/scope/runtime panel.
- Tabs and nodes now expose more scope/runtime metadata directly.
- `ui_context` is now accepted by the backend schema and carried through compile requests.
- Collaboration sync now persists `graphBindings`.

## What is still intentionally incomplete
- `graphBindings` inheritance is editor-only when parent tabs are open.
- Generated runtime does not yet consume `graphBindings`.
- No Deep Agents runtime profile exists yet.
- No browser QA pass has been done.

## Best next moves
1. Manual browser QA of:
   - bindings editor
   - tab switching
   - save/load DB
   - collaboration sync
   - compile after reload
2. Decide whether `graphBindings` should influence generated runtime/state bootstrap.
3. Introduce a lightweight “execution profile” or “artifact profile” concept in the editor model without splitting the UI.
4. Revisit `sub_agent` backend naming and consider a future internal rename path once runtime compatibility is handled end-to-end.

## Validation remembered
- Python compileall: OK
- frontend production build: OK
- compile API with enriched `ui_context`: OK
- websocket persistence of `graphBindings`: OK
