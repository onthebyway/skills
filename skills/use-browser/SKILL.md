---
name: use-browser
description: Use when a task needs live browser investigation with Playwright like reproducing JS UI bugs, collecting console/network errors, clicking controls, evaluating JavaScript in a page.
---

# Use Browser

## Purpose

Provide a reusable Playwright workflow for live website/UI debugging from the agent environment.

## When to use

Use this skill when you need to:

- reproduce a browser-only issue on a URL
- collect console errors, uncaught page errors, failed requests, or network calls
- click/interact with controls and inspect changed DOM state
- send JavaScript into a page with `page.evaluate`

## Setup

This skill includes its own Playwright install in this directory.

```bash
cd .agents/skills/use-browser
pnpm install
pnpm exec playwright install chromium
```

The browser helper scripts are TypeScript files run directly with Node.

## Quick commands

Inspect one page and collect logs/network/errors:

```bash
cd .agents/skills/use-browser
node scripts/browser-inspect.ts --url 'https://example.com' --wait 5000
```

Click something, then evaluate JavaScript in the browser:

```bash
node scripts/browser-inspect.ts \
  --url 'https://example.com' \
  --click '.next' \
  --click-wait 1000 \
  --eval '() => ({ title: document.title, body: document.body.innerText.slice(0, 500) })'
```

Compare two pages:

```bash
node scripts/compare-pages.ts \
  --wait 8000 \
  --selector '.calendar-month' \
  --network-filter 'api' \
  'https://old.example.com/page' \
  'https://new.example.com/page'
```

## Instructions

1. Start with `browser-inspect.ts` for a single URL or `compare-pages.ts` for old/new comparisons.
2. Wait long enough for async widgets (`--wait 8000` or higher for third-party embeds).
3. Inspect output in this order: `pageErrors`, `console`, `failedRequests`, `network`, selector/eval data.
4. Use `--eval` or `--eval-file` for custom DOM/computed-style checks.
5. Use `--click` plus a post-click `--eval` to verify UI state changes.
6. Summarize only decision-relevant evidence in the final response.

## More recipes

Read `references/playwright-recipes.md` for examples covering setup repair, screenshots, selector extraction, sending JS, interaction testing, page comparison, and responsive checks.
