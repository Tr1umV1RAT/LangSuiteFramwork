# v94 — Recommendation for ChatGPT project structure once the JDR branch starts

## Recommendation

Use **two ChatGPT projects/conversations** once the JDR branch begins real implementation.

### Keep this conversation/project for
- `main` / trunk truth,
- runtime/compiler/persistence boundaries,
- generic prompt-strip and module-library evolution,
- installer/runtime/provider/tooling integrity,
- and cross-branch compatibility policy.

### Open a separate conversation/project for
- the JDR demo branch,
- domain packs,
- MJ/PNJ/persona prompt assets,
- JDR-specific UX wording,
- visual theme work,
- universe/rules packaging,
- and demo-specific orchestration choices.

## Why split them

If both branches stay in one long conversation, three things happen:
1. trunk-neutral architectural work gets polluted by domain assumptions,
2. JDR-specific convenience choices start looking like core product truth,
3. the conversation history becomes harder to steer cleanly.

## What to keep shared between the two

Maintain a tiny shared handoff set:
- current branch-compatibility policy,
- prompt-strip contract,
- module-library contract,
- persistence truth,
- provider/runtime truth,
- and installer/QA expectations.

## Practical rule

Stay in one conversation **until the fork contract is stabilized**.

Once you start doing real JDR-specific implementation, use:
- **Project A** = LangSuite trunk/main
- **Project B** = LangSuite JDR demo branch

That is the cleanest way to preserve truth in both.
