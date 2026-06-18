# Playwright Browser Recipes

Run commands from this skill directory unless using absolute paths:

```bash
cd .agents/skills/use-browser
```

## Install / repair browser runtime

```bash
pnpm install
pnpm exec playwright install chromium
```

If Chromium dependencies are missing and the environment allows it:

```bash
pnpm exec playwright install --with-deps chromium
```

## Basic page inspection

```bash
node scripts/browser-inspect.ts --url 'https://example.com' --wait 5000
```

This prints JSON and writes `/tmp/browser-inspect/last-result.json` containing:

- final URL and title
- console logs
- uncaught page errors
- failed requests
- request/response summary
- optional selector/eval/screenshot output

Use `--viewport-only` when full-page screenshots are not useful.

## Get text or HTML for a selector

```bash
node scripts/browser-inspect.ts \
  --url 'https://example.com' \
  --text 'h1, .error, [role=alert]'
```

```bash
node scripts/browser-inspect.ts \
  --url 'https://example.com' \
  --html '#app'
```

## Send JavaScript to the browser

Inline JavaScript must be an expression or function body accepted by `page.evaluate`:

```bash
node scripts/browser-inspect.ts \
  --url 'https://example.com' \
  --eval '() => ({ title: document.title, buttons: [...document.querySelectorAll("button")].map(b => b.textContent?.trim()) })'
```

For larger snippets, write a temporary `.js` file and pass `--eval-file`:

```bash
cat >/tmp/check-calendar.js <<'JS'
() => ({
  active: document.querySelector('.active')?.textContent,
  months: [...document.querySelectorAll('.month')].map(el => ({
    text: el.textContent?.trim(),
    box: el.getBoundingClientRect().toJSON?.() ?? {
      x: el.getBoundingClientRect().x,
      y: el.getBoundingClientRect().y,
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height,
    }
  }))
})
JS

node scripts/browser-inspect.ts --url 'https://example.com' --eval-file /tmp/check-calendar.js
```

## Click and inspect after interaction

```bash
node scripts/browser-inspect.ts \
  --url 'https://example.com/calendar' \
  --click '.next, [aria-label="Next"]' \
  --click-wait 1000 \
  --eval '() => ({ url: location.href, active: document.activeElement?.outerHTML, body: document.body.innerText.slice(0, 1000) })'
```

## Compare two pages

```bash
node scripts/compare-pages.ts \
  --wait 8000 \
  --selector '#widget .month' \
  --network-filter 'api-or-widget-domain' \
  'https://old.example.com/page' \
  'https://new.example.com/page'
```

## Common triage checklist

1. Load page and wait long enough for async widgets.
2. Check `pageErrors` first; syntax errors and uncaught exceptions often explain broken interactions.
3. Check duplicate network calls, especially JSONP/widget endpoints.
4. Count critical DOM nodes before/after interaction.
5. Inspect computed positions for carousels/calendars/sliders:

```js
() => [...document.querySelectorAll('.slide,.month')].map(el => {
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return { text: el.textContent?.trim().slice(0, 80), x: r.x, y: r.y, width: r.width, display: cs.display, position: cs.position, left: cs.left, transform: cs.transform };
})
```

6. Take before/after screenshots when visual state matters.
7. If the issue depends on mobile/responsive behavior, rerun with `--width 390 --height 844`.
