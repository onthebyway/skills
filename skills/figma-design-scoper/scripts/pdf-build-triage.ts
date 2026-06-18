import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs, writeText, stringArg } from "./figma-utils.ts";

const args = parseArgs();
const outDir = stringArg(args.out) || "figma-analysis";
const manifestPath = stringArg(args.manifest) || `${outDir}/screenshots/pdf/manifest.json`;

if (!existsSync(manifestPath)) {
  console.error(`Missing PDF manifest: ${manifestPath}. Run pdf-extract-screens.ts first.`);
  process.exit(1);
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const exports = Array.isArray(manifest.exports) ? manifest.exports : [];

await writeText(`${outDir}/_pdf/triage.md`, toMarkdown(exports, outDir));

console.log(`Wrote ${outDir}/_pdf/triage.md`);
console.log(`Triage ${exports.length} PDF page(s), then analyze only pages classified as actual-design or design-system.`);

function toMarkdown(items: any[], outDir: string) {
  return `# PDF Page Triage\n\n` +
    `Classify each extracted PDF page before detailed analysis. Only pages marked \`actual-design\` or \`design-system\` need full decomposition into inter-linked pages/modules/components.\n\n` +
    `## Classification values\n\n` +
    `- \`actual-design\`: real page/screen/template to quote and implement\n` +
    `- \`design-system\`: component/style guidance worth extracting\n` +
    `- \`component-playground\`: exploratory component variants; skim for reusable components only\n` +
    `- \`client-presentation\`: slides, narrative, rationale, moodboards; summarize only if useful\n` +
    `- \`sitemap-flow\`: IA, flow, sitemap; use for routing/content scope, not template implementation\n` +
    `- \`annotation\`: notes/specs; extract risks/requirements only\n` +
    `- \`archive-draft\`: old/draft/duplicate; ignore unless referenced\n` +
    `- \`unknown\`: needs manual review\n\n` +
    `## Pages\n\n` +
    items.map((item) => pageBlock(item, outDir)).join("\n\n") +
    `\n`;
}

function pageBlock(item: any, outDir: string) {
  const rel = path.relative(path.dirname(`${outDir}/_pdf/triage.md`), path.join(outDir, item.imagePath)).replaceAll(path.sep, "/");
  return `### PDF page ${item.page}\n\n` +
    `- Screenshot: \`${item.imagePath}\`\n` +
    `- Classification: \`unclassified\`\n` +
    `- Proposed name:\n` +
    `- Notes:\n\n` +
    `![PDF page ${item.page}](${rel})`;
}
