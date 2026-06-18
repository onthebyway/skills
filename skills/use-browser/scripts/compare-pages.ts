#!/usr/bin/env node
import { chromium, type Page } from 'playwright';

const args = process.argv.slice(2);
function take(flag: string): string | undefined {
  const i = args.indexOf(flag);
  if (i === -1) return undefined;
  const value = args[i + 1];
  args.splice(i, 2);
  return value;
}

const waitMs = Number(take('--wait') ?? '5000');
const width = Number(take('--width') ?? '1440');
const height = Number(take('--height') ?? '1200');
const selector = take('--selector');
const networkFilter = take('--network-filter');
const urls = args;

if (urls.length < 2) {
  console.error(`Usage:
  node scripts/compare-pages.ts [options] <url-a> <url-b> [...]

Options:
  --wait <ms>                 Wait after DOMContentLoaded. Default: 5000
  --width <px>                Viewport width. Default: 1440
  --height <px>               Viewport height. Default: 1200
  --selector <css-selector>   Count and sample matching elements on each page
  --network-filter <text>     Only record matching network URLs
`);
  process.exit(2);
}

async function inspect(page: Page, url: string) {
  const consoleLogs: Array<{ type: string; text: string }> = [];
  const pageErrors: string[] = [];
  const failedRequests: Array<{ url: string; failure?: string | null }> = [];
  const network: Array<Record<string, unknown>> = [];
  const include = (url: string) => !networkFilter || url.includes(networkFilter);

  page.on('console', (msg) => consoleLogs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('request', (req) => {
    if (include(req.url())) network.push({ event: 'request', method: req.method(), url: req.url() });
  });
  page.on('response', (res) => {
    if (include(res.url())) network.push({ event: 'response', status: res.status(), url: res.url() });
  });
  page.on('requestfailed', (req) => failedRequests.push({ url: req.url(), failure: req.failure()?.errorText }));

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(waitMs);

  const selectorData = selector
    ? await page.locator(selector).evaluateAll((els: Element[]) => ({
        count: els.length,
        samples: els.slice(0, 20).map((el) => ({
          text: el.textContent?.trim().replace(/\s+/g, ' ').slice(0, 160) ?? '',
          html: (el as HTMLElement).outerHTML.slice(0, 300),
        })),
      }))
    : undefined;

  return {
    inputUrl: url,
    finalUrl: page.url(),
    title: await page.title(),
    selector,
    selectorData,
    console: consoleLogs,
    pageErrors,
    failedRequests,
    network,
  };
}

const browser = await chromium.launch({ headless: true });
try {
  const results = [];
  for (const url of urls) {
    const page = await browser.newPage({ viewport: { width, height } });
    results.push(await inspect(page, url));
    await page.close();
  }
  console.log(JSON.stringify({ viewport: { width, height }, waitMs, results }, null, 2));
} finally {
  await browser.close();
}
