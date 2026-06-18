---
name: extract-page-content
description: Use when the agent needs to fetch a public web URL and read its contents as cleaned HTML or Markdown returned directly in the tool output, without writing artifacts to files.
---

# Extract Page Content

## Purpose

Load a web page in headless Chromium and return its readable contents to the agent as either cleaned HTML or Markdown.

## When to use

Use this skill when a workflow requires inspecting a URL's content, copy, forms, links, page structure, or implementation hints and the result should be consumed directly in the conversation/tool output rather than saved as artifacts.

## Script

Run from the root working directory:

```bash
node .agents/skills/extract-page-content/scripts/extract-page-content.ts <url> --format=markdown
node .agents/skills/extract-page-content/scripts/extract-page-content.ts <url> --format=html
```

Formats:
- `markdown` / `md`: readable text hierarchy, links, buttons, form fields, `<br>` line breaks, and basic inline spacing/emphasis.
- `html`: cleaned DOM HTML with scripts/styles/svg/iframes removed and noisy attributes stripped.

## Instructions

1. Choose `markdown` when you need page copy, headings, links, CTAs, and form labels.
2. Choose `html` when implementation details, DOM structure, form fields, hidden inputs, plugin traces, or technical clues matter.
3. Capture the command stdout and use it as agent context.
4. Do not expect output files; the script intentionally writes nothing to disk.
5. If extraction fails, report the URL, attempted format, and the blocking error.

## Notes

- The script uses the existing Playwright dependency from the root `take-web-screenshot` skill.
- Keep downstream summaries concise; do not paste the full extracted content back to the user unless requested.
