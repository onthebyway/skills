# Skill Template

Copy this into the chosen skill location and customize it:

- Global workspace skill: `.agents/skills/<skill-name>/SKILL.md`
- Project skill: `<project>/.agents/skills/<skill-name>/SKILL.md`

```markdown
---
name: my-skill
description: A specific and concise description of what this skill does and when to use it.
---

# My Skill

## Purpose

Describe the focused capability this skill provides.

## When to use

Use this skill when the user asks to ...

## Instructions

1. Confirm the user's goal and inputs.
2. Read relevant project files or skill references.
3. Follow the project conventions.
4. Make the requested change or produce the requested output.
5. Summarize the result and mention important files.

## Notes

- Keep `SKILL.md` short and practical.
- Add `references/` for longer supporting docs.
- Add `scripts/` for deterministic repeatable tasks.
- Prefer TypeScript/Node scripts with pnpm-managed dependencies when scripts are needed.
```
