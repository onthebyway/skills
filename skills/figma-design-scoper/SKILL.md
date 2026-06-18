---
name: figma-design-scoper
description: Use when a user provides a Figma export PDF or Figma file/link and wants it dissected into inter-linked pages, CMS content modules, shared components, styles, risks, and quote-ready implementation artifacts for developers.
---

# Figma Design Scoper

## Purpose

Turn an exported Figma frame PDF into a developer handoff centered on the CMS build model: pages/templates are built from flexible content modules plus occasional hardcoded page-level components, and modules may contain shared components. The primary goal is a concise, inter-linked Markdown map of pages, modules, and components that shows what must be programmed into the CMS/component library. For rough estimation, provide estimates per unique module and component, then roll those up through the page-to-module/component map. Use the Figma API only as an optional fallback/enrichment path.

## When to use

Use this skill when the user asks to inspect, dissect, audit, estimate, quote, or prepare implementation tasks from a Figma design, especially when they can provide a Figma "export frames to PDF" file. Prioritize CMS module extraction and page/module/component links over treating every Figma frame as a one-off page.

## Required inputs

- Preferred primary input: a PDF exported from Figma frames/pages.
- Optional enrichment input: Figma file URL/file key and `FIGMA_TOKEN` if API quota is available.
- Preferred output folder, default: `figma-analysis/`.

Ask before proceeding if the file cannot be accessed or if the intended platform is unclear.

## Todo discipline

For every non-trivial Figma/PDF scoping job, create and work through todos one by one. Exactly one todo should be `in_progress` at a time. Do not mark a todo complete until its artifact exists and has been checked.

Create these todos at the start unless the user explicitly narrows the task:

1. **Confirm scope and inputs** — target platform, estimate depth, PDF path, output folder, and whether API enrichment is allowed.
2. **Extract PDF screenshots** — run the PDF extraction script and verify manifest/screens exist.
3. **Triage PDF pages** — create triage files and classify pages before deep analysis.
4. **Analyze CMS module system** — decompose `actual-design` and relevant `design-system` pages into page compositions, flexible CMS modules, shared components, content models, interactions, and styles.
5. **Create inter-linked knowledge base** — write pages/templates/modules/components with regular relative Markdown links between them; add styles/interactions/content models only when needed to explain implementation.
6. **Create rough rollup if requested** — estimate each unique module and component, then roll up totals through the page-to-module/component map.
7. **Review and summarize** — check page/module/component links, assumptions, risks, counts, and report next questions.

Create rough estimate artifacts only when the user explicitly asks for quoting/estimation.

If API enrichment is requested and quota allows, add a separate todo after PDF triage: **Fetch optional Figma metadata**. If Poppler/PDF tooling is missing, keep the current todo in progress and add a blocker todo to install or work around the missing tool.

## Workflow

1. **Confirm scope**
   - Identify target platform: web, mobile, desktop, or design-system extraction.
   - Confirm whether the output should be estimate-oriented, implementation-oriented, or both.
   - Confirm if hidden pages/branches/prototype flows matter.

2. **Ingest the exported PDF**
   - Ask the user to export top-level Figma frames to PDF from the Figma UI when API image quota is limited.
   - From the project root, run `node .agents/skills/figma-design-scoper/scripts/pdf-extract-screens.ts --pdf=<path-to-export.pdf>`.
   - This converts each PDF page into a screen image and writes:
     - `figma-analysis/screenshots/pdf/manifest.json`
     - `figma-analysis/_pdf/summary.md`
   - Use `--dpi=144` by default; increase only if the screenshots are too low fidelity. Use `--format=jpg` for smaller files or `--format=png` for lossless review.
   - For large PDFs, up to around 200 pages, run `node .agents/skills/figma-design-scoper/scripts/pdf-build-triage.ts` after extraction to create `_pdf/triage.md`.
   - Keep `_pdf/` lean: do not generate parallel CSV and Markdown copies of the same PDF inventory/triage information unless explicitly requested.
   - Complete the **Extract PDF screenshots** todo only after `screenshots/pdf/manifest.json` and `_pdf/summary.md` exist.

3. **Triage PDF pages before detailed analysis**
   - Do not fully evaluate every PDF page. First classify pages into one of:
     - `actual-design`: real page/screen/template to quote and implement.
     - `design-system`: component/style guidance worth extracting.
     - `component-playground`: exploratory component variants; skim for reusable components only.
     - `client-presentation`: slides, rationale, moodboards, process; summarize only if useful.
     - `sitemap-flow`: IA, flow, sitemap; use for routing/content scope, not template implementation.
     - `annotation`: notes/specs; extract risks/requirements only.
     - `archive-draft`: old/draft/duplicate; ignore unless referenced.
     - `unknown`: needs manual review.
   - Only pages classified as `actual-design` or `design-system` receive full decomposition into templates, modules, components, content models, interactions, and styles.
   - Supporting pages can still inform assumptions, risks, sitemap, and component inventory, but should not inflate page/template estimates.
   - Complete the **Triage PDF pages** todo only after `_pdf/triage.md` contains classifications for all pages or an explicit reviewed subset.

4. **Optional API enrichment only when quota allows**
   - If Figma API access is available, run `node .agents/skills/figma-design-scoper/scripts/figma-file-info.ts` to fetch names, candidate frame IDs, styles, and component counts.
   - Treat API metadata as enrichment, not the primary screenshot source.
   - Avoid `/v1/images/:key` unless the PDF is unavailable or incomplete. `GET image` is Tier 1 and can be extremely limited on Starter/free resources.
   - If using API screenshots, the script batches node IDs, caches outputs, surfaces `Retry-After`, `X-Figma-Plan-Tier`, `X-Figma-Rate-Limit-Type`, and `X-Figma-Upgrade-Link`, and skips already downloaded files.

5. **Identify CMS-programmable building blocks from triaged PDF pages**
   - Treat `actual-design` PDF pages as examples of page/template compositions, not as isolated implementation units.
   - Treat `design-system` and `component-playground` pages as sources for shared components, styles, variants, states, and reusable patterns.
   - Rename or map generic PDF pages (`page-001`, `page-002`) to human names by visual inspection, e.g. homepage, services main page, case study detail.
   - For each page/template, identify two separate implementation lists:
     - **CMS module stack**: flexible modules editors can add/reorder/configure in the CMS, e.g. `Hero → Reference Slider → Fact Grid → CTA Band`.
     - **Hardcoded page components**: components fixed into the page/template shell or exact page location, e.g. `Header`, `Navigation`, `Footer`, page-specific anchors, or custom layout chrome.
   - For each module, identify contained/reused components, e.g. `CTA Band → Button, Link, Rich Text, Icon`.
   - For each module, define the CMS fields/editing model needed to make it flexible, e.g. headings, rich text, media, CTA arrays, card repeaters, references, booleans, style variants.
   - Keep support pages linked as evidence where they affect requirements, route scope, module variants, component states, or risk.

6. **Preserve screenshot traceability**
   - Use `figma-analysis/screenshots/pdf/manifest.json` as the source of extracted PDF screenshots.
   - Record PDF page number and screenshot path in every template/page Markdown file.
   - For every module and component, create co-located cropped screenshots beside the Markdown file when visible in the PDF/Figma source.
   - Name screenshot files after the Markdown description file: `modules/hero.md` uses `modules/hero.png`; variants use `modules/hero--dark.png`, `modules/hero--compact.png`, etc. Components follow the same rule, e.g. `components/button.md`, `components/button.png`, `components/button--secondary.png`.
   - Embed the co-located screenshots directly in the Markdown description with relative image syntax, e.g. `![Hero module](./hero.png)`.
   - Include all variants that differ materially in styling, size, composition, behavior state, or CMS structure. Do not create duplicate screenshots for trivial content-only differences.
   - If a module/component cannot be cropped confidently from the PDF, add a `Screenshot status` note explaining what is missing.
   - If API metadata is available, optionally add Figma node IDs, but do not require them.

7. **Analyze linked structure**
   - Inventory pages/templates as compositions of reusable modules, not merely as screens.
   - Inventory modules as CMS-programmable content blocks with fields, variants, allowed components, responsive behavior, and editorial constraints.
   - Inventory shared components such as Header, Navigation, Button, Link, Card, Form Input, Icon, Accordion Item, Media, and Rich Text as prerequisites for modules.
   - Use regular relative Markdown links inside page, module, and component Markdown files to answer: "Which CMS modules build the homepage?", "Which hardcoded components appear on the page?", and "Which components are used inside the CTA module?"
   - Note ambiguity, missing states, inconsistent components, unclear copy, accessibility concerns, CMS editorial risks, and implementation risks.

8. **Produce artifacts**
   - Follow `references/output-structure.md` for files and schemas.
   - Keep generated documents minimal: pages/templates, modules, components, and only necessary supporting styles/interactions/content models. Estimates are optional and only generated on request.
   - Write concise, developer-facing Markdown that can be pasted into a project-management tool.
   - Include assumptions and confidence levels for estimation.
   - Ensure every template/page file lists its CMS module stack and hardcoded page components, every module file lists contained component links, and every component file lists where it is used.
   - Ensure every module/component Markdown file embeds its co-located screenshot(s), including meaningful variants.
   - Do not generate separate dependency matrices or build-order documents unless explicitly requested.
   - For rough estimates, estimate unique modules and components directly; do not estimate pages as standalone builds except as a small assembly/integration allowance.
   - Complete the **Create inter-linked knowledge base** todo only after pages/modules/components are linked. If estimates were explicitly requested, complete estimate work only after module/component estimate files and the rollup exist.

9. **Summarize**
   - Report output path.
   - Highlight number of pages/templates, CMS module families, shared component families, unique flows, major unknowns, and next questions for the client/designer.

## Output standards

- Prefer stable, machine-readable IDs: PDF page number, slugified page/template/module/component name, screenshot path, and optional Figma node id when available.
- Keep screenshots and manifests traceable to the PDF/Figma source.
- Do not overclaim behavior that is not represented in the design; mark it as an assumption.
- Model pages as compositions of CMS modules plus hardcoded page-level components; model modules as CMS-editable blocks; model components as reusable UI/building blocks.
- Make quote notes actionable: list linked page/module/component relationships, CMS field assumptions, integration assumptions, edge cases, and missing states.

## References

- Load `references/output-structure.md` before writing artifacts.
- Helper scripts live in `scripts/` relative to this skill directory.
- If moving this skill, update project package scripts or call the helper scripts by their new path.
