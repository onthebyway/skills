import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { parseArgs, loadDotEnv, getConfig, fetchFigmaFile, collectCandidateFrames, figmaGet, writeJson, stringArg, numberArg, FigmaApiError } from "./figma-utils.ts";

await loadDotEnv();
const args = parseArgs();
const { token, fileKey } = getConfig(args);

const outDir = stringArg(args.out) || "figma-analysis";
const screenshotDir = stringArg(args.screenshots) || `${outDir}/screenshots`;
const scale = Math.max(0.01, Math.min(numberArg(args.scale, 2), 4));
const format = (stringArg(args.format) || "png") as "png" | "jpg" | "svg" | "pdf";
const pageFilter = stringArg(args.page);
const nameFilter = stringArg(args.name);
const includeNested = Boolean(args["include-nested"]);
const onlyIds = new Set((stringArg(args.ids) || "").split(",").map((id) => id.trim()).filter(Boolean));
const minHeight = numberArg(args["min-height"], 0);
const maxHeight = numberArg(args["max-height"], Number.POSITIVE_INFINITY);
const minWidth = numberArg(args["min-width"], 0);
const maxWidth = numberArg(args["max-width"], Number.POSITIVE_INFINITY);
const limit = numberArg(args.limit, 0);
const batchSize = Math.max(1, Math.min(numberArg(args["batch-size"], 25), 100));
const delayMs = Math.max(0, numberArg(args["delay-ms"], 1000));
const retries = Math.max(0, numberArg(args.retries, 5));
// Default: obey Retry-After values up to 15 minutes. Use --max-wait-ms=0 to wait indefinitely,
// or a small value during debugging to skip instead of waiting.
const maxWaitMs = Math.max(0, numberArg(args["max-wait-ms"], 900000));

let file: any = undefined;
let candidates: ReturnType<typeof collectCandidateFrames> = [];

if (args["from-cache"]) {
  console.error("Reading candidate screens from local cache...");
  candidates = await readCachedCandidates(outDir);
} else {
  console.error(`Fetching Figma file ${fileKey}...`);
  try {
    file = await fetchFigmaFile(token, fileKey);
    candidates = collectCandidateFrames(file, { pageFilter, includeNested });
  } catch (error: any) {
    if (!existsSync(`${outDir}/_figma/candidate-screens.json`)) throw error;
    console.warn(`Could not fetch file metadata (${error?.message || error}). Falling back to local candidate cache.`);
    candidates = await readCachedCandidates(outDir);
  }
}
if (pageFilter && args["from-cache"]) candidates = candidates.filter((item) => item.page.toLowerCase().includes(pageFilter.toLowerCase()));
if (onlyIds.size) {
  const matched = candidates.filter((item) => onlyIds.has(item.nodeId));
  const matchedIds = new Set(matched.map((item) => item.nodeId));
  const arbitrary = [...onlyIds].filter((id) => !matchedIds.has(id)).map((id) => ({
    page: stringArg(args["arbitrary-page"]) || "manual-ids",
    pageSlug: stringArg(args["arbitrary-page"]) || "manual-ids",
    name: id.replace(":", "-"),
    slug: id.replace(/[^a-zA-Z0-9]+/g, "-"),
    nodeId: id,
    type: "UNKNOWN",
    width: undefined,
    height: undefined,
    path: [id],
  }));
  candidates = [...matched, ...arbitrary];
}
if (nameFilter) candidates = candidates.filter((item) => item.name.toLowerCase().includes(nameFilter.toLowerCase()));
candidates = candidates.filter((item) => (item.height || 0) >= minHeight && (item.height || 0) <= maxHeight && (item.width || 0) >= minWidth && (item.width || 0) <= maxWidth);
if (limit > 0) candidates = candidates.slice(0, limit);

if (!candidates.length) {
  console.log("No candidate frames found. Try --include-nested, --page=<name>, or --ids=<node-id,node-id>.");
  process.exit(0);
}

if (args["dry-run"]) {
  for (const candidate of candidates) {
    console.log(`${candidate.nodeId}\t${candidate.width || "?"}x${candidate.height || "?"}\t${candidate.page} / ${candidate.name}`);
  }
  console.log(`Selected ${candidates.length} candidate(s).`);
  process.exit(0);
}

const ext = format === "jpg" ? "jpg" : format;
const pendingCandidates = candidates.filter((candidate) => {
  const imagePath = path.join(screenshotDir, candidate.pageSlug, `${candidate.slug}.${ext}`);
  return !existsSync(imagePath);
});

console.error(`Selected ${candidates.length} candidate(s); ${pendingCandidates.length} need export and ${candidates.length - pendingCandidates.length} already exist.`);
if (pendingCandidates.length) console.error(`Requesting rendered image URL(s) from Figma in batches of ${batchSize}...`);
const images = pendingCandidates.length
  ? await requestImages(token, fileKey, pendingCandidates.map((item) => item.nodeId), { scale, format, batchSize, delayMs, retries, maxWaitMs })
  : {};
if (pendingCandidates.length) await writeJson(`${screenshotDir}/image-url-cache.json`, images);

const manifest = {
  figmaFileKey: fileKey,
  figmaFileName: file?.name,
  scale,
  format,
  exports: [] as any[],
};

for (const candidate of candidates) {
  const imageUrl = images[candidate.nodeId];
  const imagePath = path.join(screenshotDir, candidate.pageSlug, `${candidate.slug}.${ext}`);
  const relPath = path.relative(outDir, imagePath).replaceAll(path.sep, "/");
  const entry = {
    page: candidate.page,
    pageSlug: candidate.pageSlug,
    itemType: "template-or-screen",
    item: candidate.name,
    slug: candidate.slug,
    nodeId: candidate.nodeId,
    imagePath: relPath,
    width: candidate.width,
    height: candidate.height,
    figmaPath: candidate.path.join(" / "),
    exported: false,
    error: undefined as string | undefined,
  };

  if (existsSync(imagePath)) {
    entry.exported = true;
    manifest.exports.push(entry);
    console.log(`Exists ${imagePath}`);
    continue;
  }

  if (!imageUrl) {
    entry.error = "Figma did not return an image URL for this node.";
    manifest.exports.push(entry);
    console.warn(`Skipped ${candidate.name}: no image URL`);
    continue;
  }

  try {
    await download(imageUrl, imagePath);
    entry.exported = true;
    console.log(`Saved ${imagePath}`);
  } catch (error: any) {
    entry.error = error?.message || String(error);
    console.warn(`Failed ${candidate.name}: ${entry.error}`);
  }
  manifest.exports.push(entry);
}

await writeJson(`${screenshotDir}/manifest.json`, manifest);
console.log(`Wrote screenshot manifest to ${screenshotDir}/manifest.json`);
console.log(`Exported ${manifest.exports.filter((item) => item.exported).length}/${manifest.exports.length} screenshots`);

async function readCachedCandidates(outDir: string): Promise<ReturnType<typeof collectCandidateFrames>> {
  const cachePath = `${outDir}/_figma/candidate-screens.json`;
  if (!existsSync(cachePath)) throw new Error(`Missing candidate cache at ${cachePath}. Run node scripts/figma-file-info.ts first.`);
  return JSON.parse(await readFile(cachePath, "utf8"));
}

async function requestImages(token: string, key: string, ids: string[], options: { scale: number; format: string; batchSize: number; delayMs: number; retries: number; maxWaitMs: number }) {
  const all: Record<string, string | null> = {};
  const chunks = chunk(ids, options.batchSize);
  for (const idsChunk of chunks) {
    Object.assign(all, await requestImagesChunk(token, key, idsChunk, options));
    if (options.delayMs) await sleep(options.delayMs);
  }
  return all;
}

async function requestImagesChunk(token: string, key: string, ids: string[], options: { scale: number; format: string; delayMs: number; retries: number; maxWaitMs: number }, attempt = 0): Promise<Record<string, string | null>> {
  const params = new URLSearchParams({
    ids: ids.join(","),
    format: options.format,
    scale: String(options.scale),
  });
  try {
    const result = await figmaGet<{ images: Record<string, string | null> }>(token, `/images/${encodeURIComponent(key)}?${params}`);
    return result.images || {};
  } catch (error: any) {
    const message = error?.message || String(error);
    const isRateLimited = error instanceof FigmaApiError ? error.status === 429 : message.includes("429");
    if (isRateLimited && attempt < options.retries) {
      const wait = Math.max(error instanceof FigmaApiError ? error.retryAfterMs || 0 : 0, options.delayMs * Math.pow(2, attempt + 1));
      const details = formatRateLimitDetails(error, wait);
      if (options.maxWaitMs && wait > options.maxWaitMs) {
        console.warn(`Rate limited; Figma asked us to wait ${formatDuration(wait)}, above --max-wait-ms=${formatDuration(options.maxWaitMs)}. Skipping this request. ${details}`);
        return Object.fromEntries(ids.map((id) => [id, null]));
      }
      console.warn(`Rate limited; waiting ${formatDuration(wait)} before retry ${attempt + 1}/${options.retries}. ${details}`);
      await sleep(wait);
      return requestImagesChunk(token, key, ids, options, attempt + 1);
    }
    if (ids.length === 1) {
      console.warn(`Could not render node ${ids[0]}: ${message}`);
      return { [ids[0]]: null };
    }
    console.warn(`Figma render request failed for ${ids.length} nodes; retrying smaller batches...`);
    const midpoint = Math.ceil(ids.length / 2);
    return {
      ...(await requestImagesChunk(token, key, ids.slice(0, midpoint), options)),
      ...(await requestImagesChunk(token, key, ids.slice(midpoint), options)),
    };
  }
}

async function download(url: string, filePath: string) {
  if (existsSync(filePath)) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status} ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer);
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatRateLimitDetails(error: unknown, waitMs: number) {
  if (!(error instanceof FigmaApiError)) return `Retry-After: ${formatDuration(waitMs)}.`;
  const parts = [
    `Retry-After: ${formatDuration(waitMs)}`,
    error.planTier ? `plan: ${error.planTier}` : undefined,
    error.rateLimitType ? `rate-limit-type: ${error.rateLimitType}` : undefined,
    error.upgradeLink ? `upgrade: ${error.upgradeLink}` : undefined,
  ].filter(Boolean);
  return parts.join("; ") + ".";
}

function formatDuration(ms: number) {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = seconds % 60;
  if (minutes < 60) return remSeconds ? `${minutes}m ${remSeconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes ? `${hours}h ${remMinutes}m` : `${hours}h`;
}
