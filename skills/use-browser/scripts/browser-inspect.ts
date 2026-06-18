#!/usr/bin/env node
import { chromium, type ConsoleMessage, type Page, type Request, type Response } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);

function take(flag: string): string | undefined {
  const i = args.indexOf(flag);
  if (i === -1) return undefined;
  const value = args[i + 1];
  args.splice(i, 2);
  return value;
}

function has(flag: string): boolean {
  const i = args.indexOf(flag);
  if (i === -1) return false;
  args.splice(i, 1);
  return true;
}

const url = take('--url') ?? args[0];
const waitMs = Number(take('--wait') ?? '5000');
const width = Number(take('--width') ?? '1440');
const height = Number(take('--height') ?? '1200');
const click = take('--click');
const clickWaitMs = Number(take('--click-wait') ?? '1000');
const evalArg = take('--eval');
const evalFile = take('--eval-file');
const outDir = take('--out-dir') ?? '/tmp/browser-inspect';
const screenshotName = take('--screenshot');
const fullPage = !has('--viewport-only');
const textSelector = take('--text');
const htmlSelector = take('--html');
const networkFilter = take('--network-filter');
const userAgent = take('--user-agent');
const headed = has('--headed');

if (!url || has('--help')) {
  console.error(`Usage:
  node scripts/browser-inspect.ts --url <url> [options]

Options:
  --wait <ms>              Wait after DOMContentLoaded before inspection. Default: 5000
  --width <px>             Viewport width. Default: 1440
  --height <px>            Viewport height. Default: 1200
  --click <selector>       Click a selector after initial wait
  --click-wait <ms>        Wait after click. Default: 1000
  --eval <js>              Evaluate JavaScript in the page and print JSON result
  --eval-file <file>       Evaluate JavaScript loaded from a file
  --text <selector>        Return textContent for matching elements
  --html <selector>        Return innerHTML for matching elements
  --screenshot <name.png>  Save screenshot into --out-dir
  --out-dir <dir>          Output directory. Default: /tmp/browser-inspect
  --network-filter <text>  Include only matching request/response URLs in network summary
  --viewport-only          Screenshot viewport instead of full page
  --headed                 Run non-headless for local interactive debugging
`);
  process.exit(url ? 0 : 2);
}

function requestRecord(req: Request) {
  return { method: req.method(), url: req.url(), resourceType: req.resourceType() };
}

function includeUrl(url: string) {
  return !networkFilter || url.includes(networkFilter);
}

const consoleLogs: Array<{ type: string; text: string; location?: unknown }> = [];
const pageErrors: string[] = [];
const failedRequests: Array<{ url: string; method: string; failure?: string | null }> = [];
const network: Array<Record<string, unknown>> = [];

const browser = await chromium.launch({ headless: !headed });
try {
  const context = await browser.newContext({ viewport: { width, height }, userAgent });
  const page = await context.newPage();

  page.on('console', (msg: ConsoleMessage) => {
    consoleLogs.push({ type: msg.type(), text: msg.text(), location: msg.location() });
  });
  page.on('pageerror', (err: Error) => pageErrors.push(err.message));
  page.on('request', (req: Request) => {
    if (includeUrl(req.url())) network.push({ event: 'request', ...requestRecord(req) });
  });
  page.on('response', (res: Response) => {
    if (includeUrl(res.url())) network.push({ event: 'response', status: res.status(), url: res.url() });
  });
  page.on('requestfailed', (req: Request) => {
    failedRequests.push({ url: req.url(), method: req.method(), failure: req.failure()?.errorText });
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(waitMs);

  let clickResult: unknown;
  if (click) {
    await page.click(click, { timeout: 15_000 });
    await page.waitForTimeout(clickWaitMs);
    clickResult = { clicked: click, waitedMs: clickWaitMs };
  }

  let evalResult: unknown;
  const evalSource = evalFile ? await readFile(evalFile, 'utf8') : evalArg;
  if (evalSource) {
    evalResult = await page.evaluate(evalSource);
  }

  let textResult: string[] | undefined;
  if (textSelector) {
    textResult = await page.locator(textSelector).evaluateAll((els: Element[]) =>
      els.map((el) => el.textContent?.trim() ?? '')
    );
  }

  let htmlResult: string[] | undefined;
  if (htmlSelector) {
    htmlResult = await page.locator(htmlSelector).evaluateAll((els: Element[]) =>
      els.map((el) => (el as HTMLElement).innerHTML)
    );
  }

  let screenshotPath: string | undefined;
  if (screenshotName) {
    await mkdir(outDir, { recursive: true });
    screenshotPath = path.join(outDir, screenshotName);
    await page.screenshot({ path: screenshotPath, fullPage });
  }

  const summary = {
    url: page.url(),
    title: await page.title(),
    viewport: { width, height },
    click: clickResult,
    screenshot: screenshotPath,
    console: consoleLogs,
    pageErrors,
    failedRequests,
    network,
    text: textResult,
    html: htmlResult,
    eval: evalResult,
  };

  if (outDir) {
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, 'last-result.json'), JSON.stringify(summary, null, 2));
  }

  console.log(JSON.stringify(summary, null, 2));
} finally {
  await browser.close();
}
