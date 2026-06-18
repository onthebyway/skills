---
name: shared-skill-repository
description: Sync local Agent Skills into a shared Git skill repository, regenerate its README directory, and optionally commit/push changes. Use when users want to publish, update, or maintain a team skills repo for npx skills add.
---

# Shared Skill Repository

## Purpose

Maintain a Git repository of Agent Skills that can be installed with Vercel's Skills CLI, for example:

```bash
npx skills add onthebyway/skills
npx skills add onthebyway/skills --skill my-skill
```

## When to use

Use this skill when the user wants to:

- copy locally existing skills into a shared skills repo
- publish or update a skill package repository
- generate a README directory of all skills in a repo
- commit and push skill repository updates

## Expected repository shape

The shared repo should contain skills under `skills/<skill-name>/`:

```text
agent-skill-repo/
├── README.md
└── skills/
    ├── my-skill/
    │   └── SKILL.md
    └── another-skill/
        └── SKILL.md
```

Each `SKILL.md` must have YAML frontmatter with at least:

```md
---
name: my-skill
description: What the skill does and when to use it.
---
```

## Workflow

1. Confirm the target shared repo path or clone URL.
2. Confirm which local skills to sync. Common local locations are:
   - `.agents/skills/`
   - `<project>/.agents/skills/`
   - `~/.agents/skills/`
3. If needed, clone the shared repo first:
   ```bash
   git clone <repo-url> <target-dir>
   ```
4. Sync selected local skills into the repo:
   ```bash
   node {baseDir}/scripts/sync-local-skills.ts --repo <target-dir> --source .agents/skills --skill my-skill
   ```
   Or sync every valid skill from a source directory:
   ```bash
   node {baseDir}/scripts/sync-local-skills.ts --repo <target-dir> --source .agents/skills --all
   ```
5. Regenerate the README directory:
   ```bash
   node {baseDir}/scripts/generate-readme.ts --repo <target-dir> --source onthebyway/skills
   ```
6. Review the diff before committing:
   ```bash
   git -C <target-dir> status
   git -C <target-dir> diff -- README.md skills/
   ```
7. Commit and push only after review or explicit user approval:
   ```bash
   git -C <target-dir> add README.md skills/
   git -C <target-dir> commit -m "Update shared skills"
   git -C <target-dir> push
   ```

## Script reference

### `generate-readme.ts`

Generates `README.md` with a table containing each skill's title, description, and install command.

```bash
node {baseDir}/scripts/generate-readme.ts --repo <repo-dir> --source <owner/repo-or-git-url>
```

Options:

- `--repo <dir>`: shared skill repo directory. Defaults to current directory.
- `--source <source>`: install source to show in commands, e.g. `onthebyway/skills`.
- `--skills-dir <dir>`: skills directory inside repo. Defaults to `skills`.
- `--output <file>`: README path inside repo. Defaults to `README.md`.
- `--title <title>`: README title. Defaults to `Agent Skills`.

### `sync-local-skills.ts`

Copies local skill directories into `<repo>/skills/` and then regenerates the README.

```bash
node {baseDir}/scripts/sync-local-skills.ts --repo <repo-dir> --source <local-skills-dir> --all --install-source <owner/repo>
```

Options:

- `--repo <dir>`: shared skill repo directory. Required.
- `--source <dir>`: directory containing local skill folders. Can be repeated.
- `--skill <name>`: skill to sync. Can be repeated.
- `--all`: sync all valid skills found in each source.
- `--install-source <source>`: install source for README commands.
- `--commit`: commit synced files after successful README generation.
- `--push`: push after committing. Requires `--commit`.
- `--message <msg>`: commit message. Defaults to `Update shared skills`.

## Safety rules

- Never push without explicit user approval.
- Always review `git status` and the relevant diff before committing.
- Do not sync secrets, local credentials, generated dependency folders, or agent transcripts.
- Prefer public, reviewed skills in shared repos; be extra cautious with `scripts/` inside skills.
