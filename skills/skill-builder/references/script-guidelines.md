# Script Guidelines

Use scripts for repeatable, deterministic tasks that are easier or safer to execute than describe.

## Preferred stack

- Prefer **TypeScript syntax** for new scripts.
- Run with the **Node runtime** that strips types automatically when available.
- Use **pnpm** for dependencies if needed.
- Avoid Python unless it is clearly more effective for the task or required by existing project tooling.

## When to add a script

Add a script when the task is:

- deterministic and repeatable
- easier to test as code than as agent instructions
- likely to be reused
- sensitive to exact formatting, parsing, or validation

Do not add a script for one-off edits or simple shell commands.

## Script conventions

Recommended layout:

```text
<skill-name>/
├── scripts/
│   └── my-task.ts
└── package.json   # only if dependencies are needed
```

Guidelines:

- Keep scripts small and single-purpose.
- Accept inputs via CLI arguments or stdin.
- Print concise success output.
- Print actionable errors to stderr.
- Exit non-zero on failure.
- Avoid hidden global state.
- Avoid network access unless the skill explicitly requires it.
- Prefer deterministic output: stable ordering, explicit formatting, no timestamps unless needed.
- Document usage in `SKILL.md`.

## Dependencies

If dependencies are required:

```bash
pnpm add <package>
```

Commit or keep the relevant `package.json` / lockfile according to the project's conventions.
