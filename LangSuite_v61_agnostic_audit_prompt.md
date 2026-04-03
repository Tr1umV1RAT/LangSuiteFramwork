# LangSuite agnostic completeness audit prompt

Treat the attached/current codebase as the only primary source of truth.
Do not rely on conversation history, changelog optimism, or prior reports unless the current repository still supports them.

## Goal
Produce an evidence-based completeness audit of the project as it exists now.

## Method
1. Inspect the actual repository structure.
2. Identify the real architectural center of gravity.
3. Identify what is implemented, partially implemented, wrapper-backed, alias-backed, or merely representational.
4. Inspect the frontend/editor, backend/compiler, runtime, persistence, and tests.
5. Compare the current implementation to the project’s apparent intended direction, but only after inspecting the code.
6. Identify the highest-value next iteration that preserves current invariants.

## Required output
1. Executive summary
2. What the project really is today
3. Editor/UI maturity
4. Compile/runtime maturity
5. Persistence/reopen/export maturity
6. Node/catalog completeness
7. Memory/runtime context/subagent state of support
8. UX / authoring friction points
9. Recommended next iteration
10. Known unknowns

## Rules
- Be concrete.
- Separate proven working behavior from likely intent.
- Do not flatter.
- If something is wrapper-backed, alias-backed, lowered, embedded, or editor-only, say so.
- If browser/manual UX was not fully exercised, say so clearly.
