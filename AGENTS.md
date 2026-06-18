# Agent Instructions

## TypeScript scripts

- Prefer TypeScript (`.ts`) for new agent utility scripts.
- Run `.ts` files directly with the current Node runtime, e.g.:

```bash
node scripts/example.ts
```

- Do not add a compile/build step for simple agent scripts. Current Node versions strip TypeScript types automatically.
- Avoid generating `.js` files from `.ts` scripts unless the project explicitly requires compiled output.
- try to avoid python for inline scripts, I'm allergic to it

## JavaScript package management

- Prefer `pnpm` for all Node/JavaScript package-management tasks.
- Use:

```bash
pnpm install
pnpm add <package>
pnpm exec <tool>
pnpm run <script>
```

- Avoid `npm install`, `npm add`, `npm exec`, and `npx` unless:
  - the project already uses npm and has no pnpm setup,
  - `pnpm` is unavailable,
  - or the user explicitly requests npm.

## Splitting and Handling Tasks

Split tasks and requests into smaller steps that you can follow one by one where it makes sense. If you decide to split a task into todos, use the todo tool to create a list, work through it one by one, and track progress through it. Don't use the todo tool, if there is only a single task being worked on.

## Lockfiles

- Prefer `pnpm-lock.yaml` for new or updated package-managed agent utilities.
- Avoid creating or keeping `package-lock.json` for agent utility packages unless npm is explicitly required.
