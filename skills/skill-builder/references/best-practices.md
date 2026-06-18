# Skill Best Practices

Heavily summarized from Agent Skills guidance and Anthropic's skill-design recommendations.

## Core principles

- **Make skills narrow and useful.** One skill should cover one clear capability or workflow.
- **Write trigger-oriented descriptions.** The description should say when to use the skill, not just what it is.
- **Use progressive disclosure.** Keep `SKILL.md` concise; link deeper docs in `references/` only when needed.
- **Prefer procedures over prose.** Give the agent concrete steps, file paths, commands, and decision rules.
- **Optimize for context.** Avoid dumping large docs into `SKILL.md`; summarize and link.
- **Make outputs predictable.** Tell the agent what to produce, where to write files, and how to summarize results.
- **Include constraints.** Mention preferred tools, project conventions, safety limits, and when to ask for clarification.

## Good skill shape

```text
<skill-name>/
├── SKILL.md       # short instructions and links
├── references/    # optional details loaded only when relevant
├── scripts/       # optional deterministic helpers
└── assets/        # optional templates/static files
```

## Checklist

Before finishing a skill, verify:

- The name is lowercase with hyphens.
- The description is specific enough to trigger at the right time.
- `SKILL.md` is short enough to scan quickly.
- Any long docs are in `references/`.
- Any repeatable logic is scripted.
- Paths are relative to the skill directory unless absolute paths are intentional.
