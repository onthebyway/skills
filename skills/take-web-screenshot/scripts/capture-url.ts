#!/usr/bin/env node
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

interface ViewportSize {
  width: number;
  height: number;
}

interface Options {
  url: string;
  viewport: ViewportSize;
  outDir: string;
  deviceScaleFactor: number;
  waitMs: number;
  waitUntil: "load" | "domcontentloaded" | "networkidle";
  cdpEndpoint?: string;
  format: "jpeg" | "png";
  quality: number;
  hideSelectors: string[];
}

const DEFAULT_WIDTH = 1600;
const VIEWPORT_HEIGHT = 900;
const DEFAULT_HIDE_SELECTORS = ["#wpconsent-root"];

function usage(): never {
  console.error(`Usage:
  node scripts/capture-url.ts --url <url> [--width <px>] [options]

Required:
  --url <url>              URL to capture

Options:
  --width <px>             Viewport width, default 1600. Always captures the full page.
  --out <dir>              Output directory, default ./screenshots/<hostname>
  --dpr <number>           Device scale factor, default 1
  --format <jpeg|png>      Image output format, default jpeg
  --quality <1-100>        JPEG quality, default 90
  --wait-ms <ms>           Extra wait after scroll loading, default 2000
  --wait-until <state>     load | domcontentloaded | networkidle, default networkidle
  --cdp-endpoint <url>     Connect to remote Chromium over CDP instead of launching locally
  --hide-selector <css>    Hide matching elements before screenshot. Can be repeated. Default: #wpconsent-root

Examples:
  node scripts/capture-url.ts --url https://example.com --out ./screenshots/example
  node scripts/capture-url.ts --url https://example.com --width 393 --format png

Remote browser example:
  node scripts/capture-url.ts --url https://example.com --width 1440 --cdp-endpoint ws://127.0.0.1:9222/devtools/browser/<id>
`);
  process.exit(2);
}

function valueAfter(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  return args[i + 1];
}

function valuesAfter(args: string[], name: string): string[] {
  return args.flatMap((arg, index) => (arg === name && args[index + 1] ? [args[index + 1]] : []));
}

function parseWidth(argv: string[]): number {
  const widthRaw = valueAfter(argv, "--width");
  if (!widthRaw) return DEFAULT_WIDTH;

  const width = Number(widthRaw);
  if (!Number.isInteger(width) || width <= 0) {
    console.error(`Invalid --width: ${widthRaw}. Use a positive integer pixel width.`);
    process.exit(2);
  }

  return width;
}

function rejectDeprecatedViewportArgs(argv: string[]): void {
  const deprecated = ["--viewports", "--widths", "--height", "--full-page"].filter((arg) => argv.includes(arg));
  if (deprecated.length > 0) {
    console.error(`Unsupported viewport option(s): ${deprecated.join(", ")}. Use optional --width <px>; screenshots are always full-page.`);
    process.exit(2);
  }
}

function parseOptions(argv: string[]): Options {
  rejectDeprecatedViewportArgs(argv);

  const url = valueAfter(argv, "--url");
  if (!url) usage();

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    console.error(`Invalid --url: ${url}`);
    process.exit(2);
  }

  const width = parseWidth(argv);

  const waitUntilRaw = valueAfter(argv, "--wait-until") ?? "networkidle";
  if (!["load", "domcontentloaded", "networkidle"].includes(waitUntilRaw)) {
    console.error(`Invalid --wait-until: ${waitUntilRaw}`);
    process.exit(2);
  }

  const formatRaw = valueAfter(argv, "--format") ?? "jpeg";
  if (!["jpeg", "png"].includes(formatRaw)) {
    console.error(`Invalid --format: ${formatRaw}`);
    process.exit(2);
  }

  const quality = Number(valueAfter(argv, "--quality") ?? 90);
  if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
    console.error(`Invalid --quality: ${quality}. Use an integer from 1 to 100.`);
    process.exit(2);
  }

  return {
    url,
    viewport: { width, height: VIEWPORT_HEIGHT },
    outDir: valueAfter(argv, "--out") ?? path.join("screenshots", parsedUrl.hostname.replace(/[^a-z0-9.-]/gi, "-")),
    deviceScaleFactor: Number(valueAfter(argv, "--dpr") ?? 1),
    waitMs: Number(valueAfter(argv, "--wait-ms") ?? 2000),
    waitUntil: waitUntilRaw as Options["waitUntil"],
    cdpEndpoint: valueAfter(argv, "--cdp-endpoint"),
    format: formatRaw as Options["format"],
    quality,
    hideSelectors: [...DEFAULT_HIDE_SELECTORS, ...valuesAfter(argv, "--hide-selector")],
  };
}

function safeName(input: string): string {
  return input
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function hideElementsForScreenshot(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>["newPage"]>>,
  selectors: string[],
): Promise<void> {
  if (selectors.length === 0) return;

  const css = selectors
    .map((selector) => `${selector} { display: none !important; visibility: hidden !important; }`)
    .join("\n");

  await page.addStyleTag({ content: css });
}

async function triggerLazyLoading(page: Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>["newPage"]>>): Promise<void> {
  await page.evaluate(async () => {
    const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
    const viewportHeight = window.innerHeight || 900;
    const step = Math.max(200, Math.floor(viewportHeight * 0.75));
    let lastHeight = 0;
    let stablePasses = 0;

    while (stablePasses < 2) {
      const currentHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
      );

      for (let y = 0; y < currentHeight; y += step) {
        window.scrollTo(0, y);
        await delay(120);
      }

      window.scrollTo(0, currentHeight);
      await delay(500);

      const nextHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
      );
      if (nextHeight === lastHeight) stablePasses += 1;
      else stablePasses = 0;
      lastHeight = nextHeight;
    }

    window.scrollTo(0, 0);
  });
}

async function main() {
  const opts = parseOptions(process.argv.slice(2));
  await mkdir(opts.outDir, { recursive: true });

  const browser = opts.cdpEndpoint
    ? await chromium.connectOverCDP(opts.cdpEndpoint)
    : await chromium.launch({ headless: true });
  const pageSlug = safeName(opts.url);
  const metadata: any = {
    url: opts.url,
    capturedAt: new Date().toISOString(),
    capture: "full-page",
    waitUntil: opts.waitUntil,
    waitMs: opts.waitMs,
    browser: opts.cdpEndpoint ? "remote-cdp" : "local-chromium",
    format: opts.format,
    quality: opts.format === "jpeg" ? opts.quality : undefined,
    hiddenSelectors: opts.hideSelectors,
    screenshots: [],
  };

  try {
    const context = await browser.newContext({
      viewport: opts.viewport,
      deviceScaleFactor: opts.deviceScaleFactor,
    });
    const page = await context.newPage();
    await page.goto(opts.url, { waitUntil: opts.waitUntil, timeout: 45_000 });
    await hideElementsForScreenshot(page, opts.hideSelectors);
    await triggerLazyLoading(page);
    await hideElementsForScreenshot(page, opts.hideSelectors);
    if (opts.waitMs > 0) await page.waitForTimeout(opts.waitMs);

    const extension = opts.format === "jpeg" ? "jpg" : "png";
    const file = `${pageSlug}-${opts.viewport.width}-full.${extension}`;
    const filePath = path.join(opts.outDir, file);
    await page.screenshot({
      path: filePath,
      fullPage: true,
      type: opts.format,
      quality: opts.format === "jpeg" ? opts.quality : undefined,
    });
    await context.close();

    metadata.screenshots.push({
      file,
      viewport: opts.viewport,
      deviceScaleFactor: opts.deviceScaleFactor,
      capture: "full-page",
      format: opts.format,
    });
    console.log(filePath);
  } finally {
    await browser.close();
  }

  const metadataPath = path.join(opts.outDir, "metadata.json");
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2) + "\n", "utf8");
  console.log(metadataPath);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
