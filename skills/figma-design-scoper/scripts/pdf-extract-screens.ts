import { execFile as execFileCb } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { parseArgs, slugify, writeJson, writeText, stringArg, numberArg } from "./figma-utils.ts";

const execFile = promisify(execFileCb);
const args = parseArgs();
const pdfPath = stringArg(args.pdf) || stringArg(args.input) || process.argv.slice(2).find((arg) => !arg.startsWith("--"));
const outDir = stringArg(args.out) || "figma-analysis";
const screenshotDir = stringArg(args.screenshots) || `${outDir}/screenshots/pdf`;
const dpi = Math.max(36, Math.min(numberArg(args.dpi, 144), 300));
const format = (stringArg(args.format) || "png").toLowerCase();
const prefix = slugify(stringArg(args.prefix) || (pdfPath ? path.basename(pdfPath, path.extname(pdfPath)) : "figma-export"));

if (!pdfPath) {
  console.error("Missing PDF path. Usage: node .agents/skills/figma-design-scoper/scripts/pdf-extract-screens.ts --pdf=exports/frames.pdf");
  process.exit(1);
}
if (!existsSync(pdfPath)) {
  console.error(`PDF not found: ${pdfPath}`);
  process.exit(1);
}
if (!["png", "jpg", "jpeg"].includes(format)) {
  console.error("Unsupported --format. Use png or jpg.");
  process.exit(1);
}

await assertTool("pdfinfo", "Install poppler-utils to read PDF metadata.");
await assertTool("pdftoppm", "Install poppler-utils to convert PDF pages to images.");

await mkdir(screenshotDir, { recursive: true });
const tempDir = path.join(screenshotDir, ".tmp-pdf-export");
await rm(tempDir, { recursive: true, force: true });
await mkdir(tempDir, { recursive: true });

const infoText = (await execFile("pdfinfo", [pdfPath])).stdout;
const pageCount = Number(infoText.match(/^Pages:\s+(\d+)/m)?.[1] || 0);
if (!pageCount) throw new Error("Could not determine PDF page count from pdfinfo output.");

const ppmFormatArgs = format === "png" ? ["-png"] : ["-jpeg"];
const tempPrefix = path.join(tempDir, prefix);
console.error(`Converting ${pageCount} PDF page(s) to ${format} at ${dpi} DPI...`);
await execFile("pdftoppm", ["-r", String(dpi), ...ppmFormatArgs, pdfPath, tempPrefix], { maxBuffer: 1024 * 1024 * 20 });

const generated = (await readdir(tempDir))
  .filter((file) => file.startsWith(prefix + "-") && file.endsWith(format === "jpeg" ? ".jpg" : `.${format}`))
  .sort((a, b) => pageNumber(a) - pageNumber(b));

const exports: any[] = [];
for (const file of generated) {
  const page = pageNumber(file);
  const screenSlug = `${prefix}-page-${String(page).padStart(3, "0")}`;
  const ext = format === "jpeg" ? "jpg" : format;
  const target = path.join(screenshotDir, `${screenSlug}.${ext}`);
  await rename(path.join(tempDir, file), target);
  exports.push({
    source: "pdf",
    pdfPath,
    page,
    itemType: "screen-from-pdf-page",
    item: `PDF page ${page}`,
    slug: screenSlug,
    imagePath: path.relative(outDir, target).replaceAll(path.sep, "/"),
    dpi,
    format: ext,
    classification: "candidate-screen",
    confidence: "medium",
  });
}
await rm(tempDir, { recursive: true, force: true });

const manifest = {
  source: "pdf",
  pdfPath,
  pageCount,
  dpi,
  format: format === "jpeg" ? "jpg" : format,
  exports,
};

await writeJson(`${screenshotDir}/manifest.json`, manifest);
await writeText(`${outDir}/_pdf/summary.md`, toMarkdown(manifest));
console.log(`Extracted ${exports.length}/${pageCount} PDF page(s) to ${screenshotDir}`);
console.log(`Wrote manifest to ${screenshotDir}/manifest.json`);

async function assertTool(name: string, hint: string) {
  try {
    await execFile(name, ["-v"]);
  } catch {
    try {
      await execFile(name, ["--help"]);
    } catch {
      console.error(`Missing required tool: ${name}. ${hint}`);
      process.exit(1);
    }
  }
}

function pageNumber(file: string) {
  const match = file.match(/-(\d+)\.[^.]+$/);
  return match ? Number(match[1]) : 0;
}

function toMarkdown(manifest: any) {
  return `# PDF Screen Extraction\n\n` +
    `- PDF: ${manifest.pdfPath}\n` +
    `- Pages: ${manifest.pageCount}\n` +
    `- Extracted screenshots: ${manifest.exports.length}\n` +
    `- DPI: ${manifest.dpi}\n` +
    `- Format: ${manifest.format}\n\n` +
    `## Screens\n\n` +
    manifest.exports.map((item: any) => `- ${item.item}: \`${item.imagePath}\``).join("\n") +
    `\n`;
}
