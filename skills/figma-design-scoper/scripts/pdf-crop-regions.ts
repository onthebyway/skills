import { execFile as execFileCb } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rename, rm, unlink } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { numberArg, parseArgs, stringArg, writeJson } from "./figma-utils.ts";

const execFile = promisify(execFileCb);
const args = parseArgs();

type CropSpec = {
  page: number;
  target: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  width?: number;
  height?: number;
  units?: "px" | "percent";
  dpi?: number;
  format?: "jpg" | "jpeg" | "png";
  pad?: number;
  note?: string;
};

type CropPlan = {
  pdf?: string;
  outDir?: string;
  dpi?: number;
  format?: "jpg" | "jpeg" | "png";
  units?: "px" | "percent";
  crops: CropSpec[];
};

const planPath = stringArg(args.plan);
const outDir = stringArg(args.out) || "figma-analysis";
const manifestPath = stringArg(args.manifest) || `${outDir}/screenshots/pdf/manifest.json`;
const manifest = await readManifest(manifestPath);
const defaultPdf = stringArg(args.pdf) || manifest?.pdfPath;
const defaultDpi = numberArg(args.dpi, Number(manifest?.dpi) || 144);
const defaultFormat = normalizeFormat(stringArg(args.format) || manifest?.format || "jpg");
const defaultUnits = (stringArg(args.units) || "px") as "px" | "percent";

let plan: CropPlan;
if (planPath) {
  plan = JSON.parse(await readFile(planPath, "utf8"));
} else {
  const page = numberArg(args.page, NaN);
  const target = stringArg(args.target);
  const x = numberArg(args.x, NaN);
  const y = numberArg(args.y, NaN);
  const w = numberArg(args.w, numberArg(args.width, NaN));
  const h = numberArg(args.h, numberArg(args.height, NaN));
  if (!Number.isFinite(page) || !target || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) {
    console.error(`Usage:
  Single crop:
    node .agents/skills/figma-design-scoper/scripts/pdf-crop-regions.ts --pdf=exports/frames.pdf --out=figma-analysis --page=12 --target=modules/hero.jpg --x=120 --y=240 --w=1600 --h=700

  Plan file:
    node .agents/skills/figma-design-scoper/scripts/pdf-crop-regions.ts --plan=figma-analysis/_pdf/crop-plan.json --out=figma-analysis

Coordinates are pixels in the extracted PDF screenshot by default. Use --units=percent for percentage coordinates relative to the full extracted page image.`);
    process.exit(1);
  }
  plan = {
    pdf: defaultPdf,
    outDir,
    dpi: defaultDpi,
    format: defaultFormat,
    units: defaultUnits,
    crops: [{ page, target, x, y, w, h, units: defaultUnits, dpi: defaultDpi, format: defaultFormat, pad: numberArg(args.pad, 0) }],
  };
}

const pdfPath = plan.pdf || defaultPdf;
if (!pdfPath) fail("Missing PDF path. Pass --pdf or provide pdf in the crop plan / manifest.");
if (!existsSync(pdfPath)) fail(`PDF not found: ${pdfPath}`);
await assertTool("pdftoppm", "Install poppler-utils to crop PDF pages.");

const effectiveOutDir = plan.outDir || outDir;
const results: any[] = [];
for (const crop of plan.crops || []) {
  const dpi = crop.dpi || plan.dpi || defaultDpi;
  const format = normalizeFormat(crop.format || plan.format || defaultFormat);
  const units = crop.units || plan.units || defaultUnits;
  const sourceImage = sourceImageForPage(manifest, effectiveOutDir, crop.page);
  const sourceSize = sourceImage && existsSync(sourceImage) ? await imageSize(sourceImage).catch(() => undefined) : undefined;
  const pageSizeAtDpi = sourceSize && Number(manifest?.dpi) && Number(manifest.dpi) !== dpi
    ? { width: Math.round(sourceSize.width * dpi / Number(manifest.dpi)), height: Math.round(sourceSize.height * dpi / Number(manifest.dpi)) }
    : sourceSize;

  const raw = normalizeCrop(crop, units, pageSizeAtDpi);
  const padded = applyPad(raw, crop.pad || 0, pageSizeAtDpi);
  const target = targetPath(effectiveOutDir, crop.target, format);
  await mkdir(path.dirname(target), { recursive: true });

  const tmpDir = path.join(effectiveOutDir, "_pdf", ".tmp-crops");
  await mkdir(tmpDir, { recursive: true });
  const tmpPrefix = path.join(tmpDir, `${Date.now()}-${process.pid}-${crop.page}`);
  const formatArg = format === "png" ? "-png" : "-jpeg";
  await execFile("pdftoppm", [
    "-f", String(crop.page),
    "-l", String(crop.page),
    "-singlefile",
    "-r", String(dpi),
    formatArg,
    "-x", String(padded.x),
    "-y", String(padded.y),
    "-W", String(padded.w),
    "-H", String(padded.h),
    pdfPath,
    tmpPrefix,
  ], { maxBuffer: 1024 * 1024 * 20 });

  const produced = `${tmpPrefix}.${format === "png" ? "png" : "jpg"}`;
  await moveFile(produced, target);
  const warnings = auditCrop(padded, pageSizeAtDpi);
  results.push({ page: crop.page, target: path.relative(effectiveOutDir, target).replaceAll(path.sep, "/"), dpi, format, units, crop: padded, sourceImage: sourceImage ? path.relative(effectiveOutDir, sourceImage).replaceAll(path.sep, "/") : undefined, note: crop.note, warnings });
  console.log(`${warnings.length ? "WARN" : "OK  "} page ${crop.page} -> ${target}${warnings.length ? ` (${warnings.join("; ")})` : ""}`);
}

await rm(path.join(effectiveOutDir, "_pdf", ".tmp-crops"), { recursive: true, force: true });
await writeJson(`${effectiveOutDir}/_pdf/crops-manifest.json`, { source: "pdf-crop-regions", pdfPath, outDir: effectiveOutDir, crops: results });
console.log(`Wrote ${effectiveOutDir}/_pdf/crops-manifest.json`);

async function moveFile(source: string, target: string) {
  try {
    await rename(source, target);
  } catch (error: any) {
    if (error?.code !== "EXDEV") throw error;
    await copyFile(source, target);
    await unlink(source);
  }
}

function normalizeCrop(crop: CropSpec, units: "px" | "percent", pageSize?: { width: number; height: number }) {
  const w = crop.w ?? crop.width;
  const h = crop.h ?? crop.height;
  if (!Number.isFinite(crop.page) || !Number.isFinite(crop.x) || !Number.isFinite(crop.y) || !Number.isFinite(w) || !Number.isFinite(h)) {
    fail(`Invalid crop spec: ${JSON.stringify(crop)}`);
  }
  if (units === "percent") {
    if (!pageSize) fail(`Percent crop for page ${crop.page} needs extracted source screenshot dimensions from manifest.`);
    return {
      x: Math.round(pageSize.width * crop.x / 100),
      y: Math.round(pageSize.height * crop.y / 100),
      w: Math.round(pageSize.width * Number(w) / 100),
      h: Math.round(pageSize.height * Number(h) / 100),
    };
  }
  return { x: Math.round(crop.x), y: Math.round(crop.y), w: Math.round(Number(w)), h: Math.round(Number(h)) };
}

function applyPad(crop: { x: number; y: number; w: number; h: number }, pad: number, pageSize?: { width: number; height: number }) {
  if (!pad) return crop;
  const x = Math.max(0, crop.x - pad);
  const y = Math.max(0, crop.y - pad);
  const maxW = pageSize ? pageSize.width - x : Number.POSITIVE_INFINITY;
  const maxH = pageSize ? pageSize.height - y : Number.POSITIVE_INFINITY;
  return { x, y, w: Math.min(crop.w + pad * 2, maxW), h: Math.min(crop.h + pad * 2, maxH) };
}

function auditCrop(crop: { w: number; h: number }, pageSize?: { width: number; height: number }) {
  const warnings: string[] = [];
  if (!pageSize) return warnings;
  const widthRatio = crop.w / pageSize.width;
  const heightRatio = crop.h / pageSize.height;
  if (widthRatio > 0.92 && heightRatio > 0.70) warnings.push("crop looks like a near-full page, not a module/component");
  else if (heightRatio > 0.85) warnings.push("crop is very tall; verify it does not include multiple modules");
  return warnings;
}

function sourceImageForPage(manifest: any, outDir: string, page: number) {
  const item = manifest?.exports?.find((entry: any) => Number(entry.page) === Number(page));
  return item?.imagePath ? path.join(outDir, item.imagePath) : undefined;
}

function targetPath(outDir: string, target: string, format: "jpg" | "png") {
  const parsed = path.parse(target);
  const hasExt = [".jpg", ".jpeg", ".png"].includes(parsed.ext.toLowerCase());
  return path.isAbsolute(target) ? target : path.join(outDir, hasExt ? target : `${target}.${format}`);
}

function normalizeFormat(value: string): "jpg" | "png" {
  const format = value.toLowerCase();
  if (format === "jpeg" || format === "jpg") return "jpg";
  if (format === "png") return "png";
  fail(`Unsupported format: ${value}. Use jpg or png.`);
}

async function readManifest(file: string) {
  if (!existsSync(file)) return undefined;
  return JSON.parse(await readFile(file, "utf8"));
}

async function assertTool(name: string, hint: string) {
  try {
    await execFile(name, ["-v"]);
  } catch {
    try {
      await execFile(name, ["--help"]);
    } catch {
      fail(`Missing required tool: ${name}. ${hint}`);
    }
  }
}

async function imageSize(file: string): Promise<{ width: number; height: number }> {
  const buffer = await readFile(file);
  if (buffer[0] === 0x89 && buffer.toString("ascii", 1, 4) === "PNG") {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }
  throw new Error(`Unsupported image type or missing dimensions: ${file}`);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
