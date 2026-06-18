---
name: take-web-screenshot
description: Captures a full-page screenshot of a URL at a specified width using headless Chromium/Playwright, producing JPEG/PNG files and metadata for downstream agent workflows.
---

# Take Web Screenshot

## Purpose

Generate repeatable full-page website screenshots from a URL at a chosen viewport width for visual analysis, design extraction, responsive audits, bug reports, or documentation.

## When to use

Use this skill when the user asks to:

- take or capture website screenshots
- screenshot a URL at mobile/tablet/desktop sizes
- generate visual evidence for another skill
- prepare screenshots for design-system extraction or UI review
- test responsive layouts visually without an interactive browser

## Instructions

1. Confirm the URL and width. If no width is specified, use the default 1600px width.
2. Always capture the full length of the page. Do not request or use viewport-only screenshots.
3. Before capture, scroll through the page to trigger lazy-loaded images, animations, and scroll-mounted elements, then return to the top and wait before taking the screenshot.
4. The helper hides `#wpconsent-root` by default before screenshots so cookie banners do not obscure the page. Use repeated `--hide-selector <css>` flags to hide additional page-wide overlays or sticky elements when needed.
5. Keep these common screen-size widths in mind when the user asks for a specific device class:
   - large desktop: `1920`
   - desktop/laptop: `1440`
   - iPad landscape: `1024`
   - iPad portrait: `768`
   - iPhone portrait: `393`
   - iPhone SE portrait: `375`
6. Default to JPEG output for compact downstream image handling; use `--format png` only when lossless screenshots are required.
7. Write outputs under `screenshots/<site-or-task>/` in the root working directory unless the user specifies another location.
8. Run the capture helper from this skill directory.
9. Verify output by checking that the image file and `metadata.json` were created, and read the image when feasible.
10. Return generated paths and metadata summary.

## Usage

```bash
cd .agents/skills/take-web-screenshot
pnpm install
pnpm exec playwright install chromium
node scripts/capture-url.ts --url https://example.com --out ../../../screenshots/example
```

For a specific width:

```bash
node scripts/capture-url.ts --url https://example.com --width 393 --out ../../../screenshots/example
```

For lossless PNG screenshots:

```bash
node scripts/capture-url.ts --url https://example.com --width 1440 --format png --out ../../../screenshots/example
```

To hide additional overlays or sticky elements:

```bash
node scripts/capture-url.ts --url https://example.com --out ../../../screenshots/example --hide-selector '.chat-widget' --hide-selector '.sticky-promo'
```

If Chromium is installed but fails to launch due to missing native libraries, install Playwright's system dependencies when sudo is available:

```bash
sudo env PATH=$PATH pnpm exec playwright install-deps chromium
```

If local Chromium still cannot launch, use a remote Chromium/CDP endpoint:

```bash
node scripts/capture-url.ts --url https://example.com --width 1440 --out ../../../screenshots/example --cdp-endpoint ws://host:9222/devtools/browser/<id>
```

## Output

The script writes:

- one full-page JPEG by default (`.jpg`)
- optional PNG output when `--format png` is passed
- `metadata.json` containing URL, capture mode, viewport width, DPR, image format, quality, hidden selectors, and generated filename

Use the generated image paths as inputs for downstream visual-analysis skills.
