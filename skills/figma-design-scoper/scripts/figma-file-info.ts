import { parseArgs, loadDotEnv, getConfig, fetchFigmaFile, collectCandidateFrames, summarizeFile, writeJson, writeText, csvEscape, stringArg } from "./figma-utils.ts";

await loadDotEnv();
const args = parseArgs();
const { token, fileKey } = getConfig(args);
const outDir = stringArg(args.out) || "figma-analysis/_figma";
const pageFilter = stringArg(args.page);
const includeNested = Boolean(args["include-nested"]);

console.error(`Fetching Figma file ${fileKey}...`);
const file = await fetchFigmaFile(token, fileKey);
const candidates = collectCandidateFrames(file, { pageFilter, includeNested });
const summary = summarizeFile(file, candidates);

if (args.raw) await writeJson(`${outDir}/file.json`, file);
await writeJson(`${outDir}/summary.json`, summary);
await writeJson(`${outDir}/candidate-screens.json`, candidates);
await writeText(`${outDir}/candidate-screens.csv`, toCsv(candidates));
await writeText(`${outDir}/summary.md`, toMarkdown(summary, candidates));

console.log(`Wrote Figma info to ${outDir}`);
if (!args.raw) console.log("Skipped raw file dump. Use --raw if you need the full Figma JSON.");
console.log(`Pages: ${summary.pages.length}`);
console.log(`Candidate screens: ${summary.candidateScreens}`);
console.log(`Components: ${summary.components}; component sets: ${summary.componentSets}; styles: ${summary.styles}`);

function toCsv(items: typeof candidates) {
  const header = ["page", "name", "node_id", "type", "width", "height", "path"];
  const rows = items.map((item) => [
    item.page,
    item.name,
    item.nodeId,
    item.type,
    item.width || "",
    item.height || "",
    item.path.join(" / "),
  ]);
  return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n") + "\n";
}

function toMarkdown(summary: any, candidates: any[]) {
  return `# Figma File Summary\n\n` +
    `- File: ${summary.name || "Unknown"}\n` +
    `- Last modified: ${summary.lastModified || "Unknown"}\n` +
    `- Pages: ${summary.pages.length}\n` +
    `- Candidate screens: ${summary.candidateScreens}\n` +
    `- Components: ${summary.components}\n` +
    `- Component sets: ${summary.componentSets}\n` +
    `- Styles: ${summary.styles}\n\n` +
    `## Pages\n\n` +
    summary.pages.map((page: any) => `- ${page.name}: ${page.candidateScreens} candidate screens`).join("\n") +
    `\n\n## Candidate screens\n\n` +
    candidates.map((item) => `- ${item.page} / ${item.name} \`${item.nodeId}\` (${item.width || "?"}×${item.height || "?"})`).join("\n") +
    `\n`;
}
