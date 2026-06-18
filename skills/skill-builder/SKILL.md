---
name: skill-builder
description: Creates or updates Agent Skills in this workspace. Use when adding global skills under .agents/skills or project skills under a project subdirectory's .agents/skills.
---


# Skill Builder

Use this skill to create focused Agent Skills.

## Skill locations

- **Global workspace skills:** `.agents/skills/<skill-name>/`
  - Use for skills that apply across all agents operating via this workspace.
- **Project skills:** `<project>/.agents/skills/<skill-name>/`
  - Use for skills tied to one project, for example `<project-root>/.agents/skills/<skill-name>/`.

Pi discovers skill directories named `SKILL.md` under `.agents/skills` locations when run from the relevant folder.

## Create a skill

1. Decide whether the skill is global or project-specific.
2. Choose a valid name: lowercase letters, numbers, and hyphens only.
3. Create `<chosen-location>/<skill-name>/SKILL.md`.
4. Start from [references/skill-template.md](references/skill-template.md).
5. Apply [references/best-practices.md](references/best-practices.md).
6. If scripts are useful, follow [references/script-guidelines.md](references/script-guidelines.md).

## Required frontmatter

```markdown
---
name: my-skill
description: What this skill does and when to use it.
---
```

## Keep it simple

- Put essential workflow instructions in `SKILL.md`.
- Put longer material in `references/`.
- Put deterministic repeatable operations in `scripts/`.
