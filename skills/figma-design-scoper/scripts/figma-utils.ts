import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export type FigmaNode = {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
};

export type CandidateFrame = {
  page: string;
  pageSlug: string;
  name: string;
  slug: string;
  nodeId: string;
  type: string;
  width?: number;
  height?: number;
  path: string[];
};

export function parseArgs(argv = process.argv.slice(2)): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const eq = raw.indexOf("=");
    if (eq === -1) args[raw.slice(2)] = true;
    else args[raw.slice(2, eq)] = raw.slice(eq + 1);
  }
  return args;
}

export async function loadDotEnv(file = ".env") {
  if (!existsSync(file)) return;
  const body = await readFile(file, "utf8");
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

export function getConfig(args: Record<string, string | boolean>) {
  const token = stringArg(args.token) || process.env.FIGMA_TOKEN;
  const fileKey = stringArg(args.file) || stringArg(args.key) || process.env.FIGMA_FILE_KEY;
  if (!token) throw new Error("Missing FIGMA_TOKEN. Add it to .env or pass --token=...");
  if (!fileKey) throw new Error("Missing FIGMA_FILE_KEY. Add it to .env or pass --file=...");
  return { token, fileKey };
}

export class FigmaApiError extends Error {
  status: number;
  statusText: string;
  retryAfterMs?: number;
  rateLimitType?: string;
  planTier?: string;
  upgradeLink?: string;

  constructor(status: number, statusText: string, body: string, options: { retryAfterMs?: number; rateLimitType?: string; planTier?: string; upgradeLink?: string } = {}) {
    super(`Figma API ${status} ${statusText}: ${body.slice(0, 500)}`);
    this.status = status;
    this.statusText = statusText;
    this.retryAfterMs = options.retryAfterMs;
    this.rateLimitType = options.rateLimitType;
    this.planTier = options.planTier;
    this.upgradeLink = options.upgradeLink;
  }
}

export async function figmaGet<T>(token: string, endpoint: string): Promise<T> {
  const url = endpoint.startsWith("http") ? endpoint : `https://api.figma.com/v1${endpoint}`;
  const res = await fetch(url, { headers: { "X-Figma-Token": token } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new FigmaApiError(res.status, res.statusText, text, {
      retryAfterMs: retryAfterToMs(res.headers.get("retry-after")),
      rateLimitType: res.headers.get("x-figma-rate-limit-type") || undefined,
      planTier: res.headers.get("x-figma-plan-tier") || undefined,
      upgradeLink: res.headers.get("x-figma-upgrade-link") || undefined,
    });
  }
  return (await res.json()) as T;
}

function retryAfterToMs(value: string | null) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    // Figma appears to sometimes send millisecond-like numeric values despite
    // the Retry-After convention being seconds. Treat very large values as ms
    // so we do not accidentally sleep for days.
    return Math.max(0, seconds > 3600 ? seconds : seconds * 1000);
  }
  const dateMs = Date.parse(value);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : undefined;
}

export async function fetchFigmaFile(token: string, fileKey: string) {
  return figmaGet<any>(token, `/files/${encodeURIComponent(fileKey)}`);
}

export function collectCandidateFrames(file: any, options: { includeNested?: boolean; pageFilter?: string } = {}): CandidateFrame[] {
  const pages: FigmaNode[] = file?.document?.children || [];
  const out: CandidateFrame[] = [];
  for (const page of pages) {
    if (options.pageFilter && !matches(page.name, options.pageFilter)) continue;
    const pageSlug = slugify(page.name);
    for (const child of page.children || []) {
      if (isExportCandidate(child)) pushCandidate(out, page.name, pageSlug, child, [page.name, child.name]);
      if (child.type === "SECTION" || options.includeNested) {
        for (const nested of child.children || []) {
          if (isExportCandidate(nested)) pushCandidate(out, page.name, pageSlug, nested, [page.name, child.name, nested.name]);
        }
      }
    }
  }
  return dedupeByNodeId(out);
}

export function summarizeFile(file: any, candidates: CandidateFrame[]) {
  const pages: FigmaNode[] = file?.document?.children || [];
  return {
    name: file?.name,
    lastModified: file?.lastModified,
    version: file?.version,
    pages: pages.map((page) => ({
      name: page.name,
      nodeId: page.id,
      directChildren: page.children?.length || 0,
      candidateScreens: candidates.filter((c) => c.page === page.name).length,
    })),
    candidateScreens: candidates.length,
    components: Object.keys(file?.components || {}).length,
    componentSets: Object.keys(file?.componentSets || {}).length,
    styles: Object.keys(file?.styles || {}).length,
  };
}

export async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2) + "\n");
}

export async function writeText(filePath: string, value: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, value);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";
}

export function csvEscape(value: unknown) {
  const str = String(value ?? "");
  if (!/[",\n]/.test(str)) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

export function stringArg(value: string | boolean | undefined) {
  return typeof value === "string" && value.length ? value : undefined;
}

export function numberArg(value: string | boolean | undefined, fallback: number) {
  const parsed = typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pushCandidate(out: CandidateFrame[], page: string, pageSlug: string, node: FigmaNode, nodePath: string[]) {
  out.push({
    page,
    pageSlug,
    name: node.name,
    slug: slugify(node.name),
    nodeId: node.id,
    type: node.type,
    width: node.absoluteBoundingBox?.width ? Math.round(node.absoluteBoundingBox.width) : undefined,
    height: node.absoluteBoundingBox?.height ? Math.round(node.absoluteBoundingBox.height) : undefined,
    path: nodePath,
  });
}

function isExportCandidate(node: FigmaNode) {
  if (!["FRAME", "COMPONENT", "INSTANCE"].includes(node.type)) return false;
  const box = node.absoluteBoundingBox;
  if (!box || box.width < 80 || box.height < 80) return false;
  return !/^(archive|draft|trash|wip|deprecated)\b/i.test(node.name);
}

function matches(name: string, filter: string) {
  return name.toLowerCase().includes(filter.toLowerCase());
}

function dedupeByNodeId(items: CandidateFrame[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.nodeId)) return false;
    seen.add(item.nodeId);
    return true;
  });
}
