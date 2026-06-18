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
4. **Analyze CMS module system** — decompose `actual-design` and relevant `design-system` pages into page instances, candidate shared templates, candidate flexible CMS modules, shared components, content models, interactions, and styles.
5. **Review templates, module families, and variants** — after drafting initial page/template/module Markdown files/screenshots, review them for near-duplicates and refactor similar templates/modules into reusable templates/module families with documented page/module variants before finalizing stacks and links.
6. **Create inter-linked knowledge base** — finalize pages/templates/modules/components with regular relative Markdown links between them; add styles/interactions/content models only when needed to explain implementation.
7. **Create rough rollup if requested** — estimate each unique module family and component, then roll up totals through the page-to-module/component map.
8. **Review and summarize** — check page/module/component links, assumptions, risks, counts, and report next questions.

Create rough estimate artifacts only when the user explicitly asks for quoting/estimation.

Complete the **Review templates, module families, and variants** todo only after initial page/template/module Markdown files/screenshots exist, every route/content instance has been separated from its reusable template, and every candidate module has either been merged into a module family as a variant or explicitly kept separate with a short reason.

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
   - Use `node .agents/skills/figma-design-scoper/scripts/pdf-crop-regions.ts` to render tight module/component screenshot crops from selected PDF page regions instead of copying full-page screenshots. The script accepts either one crop via CLI args or a JSON crop plan and writes `_pdf/crops-manifest.json`.
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
   - Treat `actual-design` PDF pages as examples of page instances and template compositions, not as isolated implementation units.
   - Treat `design-system` and `component-playground` pages as sources for shared components, styles, variants, states, and reusable patterns.
   - Rename or map generic PDF pages (`page-001`, `page-002`) to human names by visual inspection, e.g. homepage, services main page, case study detail.
   - Separate **pages** from **templates**:
     - **Pages** are concrete CMS route/content instances, often differing by locale, country, audience, or copy, e.g. `about-switzerland.md` and `about-luxembourg.md`.
     - **Templates** are reusable implementation/layout patterns that many pages can use, e.g. one `about.md` template used by both about pages.
     - Do not create separate templates for country/locale/content variants when the module stack and layout skeleton are substantially shared. Put the variation in page content, module variant choices, and page-level notes.
     - Create a separate template only when the route has a materially different layout skeleton, fixed page components, data requirements, or assembly rules.
   - For each template, identify two separate implementation lists:
     - **CMS module stack**: flexible modules editors can add/reorder/configure in the CMS, e.g. `Hero → Reference Slider → Fact Grid → CTA Band`.
     - **Hardcoded page components**: components fixed into the template shell or exact page location, e.g. `Header`, `Navigation`, `Footer`, page-specific anchors, or custom layout chrome.
   - For each page, link to its template and list only content-specific module variants, locale/country differences, route metadata, and overrides.
   - First draft candidate page/template/module Markdown files/screenshots using neutral reusable names where possible, then during the **Review templates, module families, and variants** todo run a clustering pass across those drafts. Group visually or structurally similar templates/pages and modules into shared templates/module families with variants when they share the same editorial purpose, core fields, reusable components, or layout skeleton.
   - Treat candidate modules as variants of one module family when differences are mostly content, theme/color, background/media, density, page context, CTA count, or optional subregions. Example pattern: homepage hero, inner-page hero, and contacted/FAQ hero should usually be one `Hero` module with variants, not three unrelated modules.
   - Create a separate module only when the CMS/editor model, primary purpose, behavior, data source, or contained component structure materially differs. If unsure, prefer one flexible module with documented variants over multiple narrow one-off modules.
   - Name modules and components by reusable function/structure, not by one page's text content or business-specific copy. Prefer generic implementation names like `Final CTA`, `Image Carousel`, `Hero`, `Accordion List`, `Card Grid`, `Logo Grid`, `Team Grid`; avoid content-bound names like `Recruiting CTA` or `Process Carousel` unless the data model/behavior is truly specific to recruiting or a process.
   - Put content-specific usage in template stacks, variant names, screenshots, and notes, not in the base module/component name. Example: `[Final CTA](../modules/final-cta.md) — variant: recruiting` rather than `recruiting-cta.md`.
   - For each module family, identify contained/reused components, e.g. `CTA Band → Button, Link, Rich Text, Icon`.
   - For each module family, define the CMS fields/editing model needed to make it flexible, e.g. headings, rich text, media, CTA arrays, card repeaters, references, booleans, style variants.
   - In template module stacks, link to the module family and name the variant inline, e.g. `[Hero](../modules/hero.md) — variant: contacted`.
   - Keep support pages linked as evidence where they affect requirements, route scope, module variants, component states, or risk.

6. **Preserve screenshot traceability**
   - Use `figma-analysis/screenshots/pdf/manifest.json` as the source of extracted PDF screenshots.
   - Record PDF page number and screenshot path in every template/page Markdown file.
   - For every module and component that is visible in the PDF/Figma source, create a co-located screenshot that is cropped to that module/component only.
   - Do **not** copy an entire page/template screenshot into `modules/` or `components/` and label it as a module/component screenshot. Full-page screenshots belong only in `screenshots/pdf/` and template/page files.
   - A module/component screenshot must be cropped as closely around the full module/component as possible without cutting off any part of it. Include only enough surrounding whitespace/context to preserve edges, shadows, focus rings, or overlapping elements that belong to it.
   - If crop boundaries are uncertain, expand the crop slightly rather than cutting into the component; do not expand so far that unrelated modules or a whole long page are included.
   - Name screenshot files after the Markdown description file: `modules/hero.md` uses `modules/hero.png`; variants use `modules/hero--dark.png`, `modules/hero--compact.png`, etc. Components follow the same rule, e.g. `components/button.md`, `components/button.png`, `components/button--secondary.png`.
   - Embed the co-located cropped screenshots directly in the Markdown description with relative image syntax, e.g. `![Hero module](./hero.png)`.
   - Include all variants that differ materially in styling, size, composition, behavior state, or CMS structure. Store module-family variant screenshots beside the same module file, e.g. `modules/hero.jpg`, `modules/hero--inner-page.jpg`, `modules/hero--contacted.jpg`.
   - Do not create duplicate content-only examples if layout/styling/composition is the same.
   - Prefer crop-plan driven screenshots for batches, e.g. `figma-analysis/_pdf/crop-plan.json`, so the agent only has to inspect a page once, record approximate coordinates, and let the script render the exact module/component crops.
   - Before completing the knowledge-base todo, spot-check module/component images and remove/replace any full-page screenshots stored beside module/component Markdown files. Treat warnings from `_pdf/crops-manifest.json` as blockers to review.
   - If API metadata is available, optionally add Figma node IDs, but do not require them.

7. **Analyze linked structure**
   - Inventory pages/templates as compositions of reusable modules, not merely as screens.
   - Inventory modules as CMS-programmable module families with fields, variants, allowed components, responsive behavior, and editorial constraints.
   - Each module file must include a `## Variants` section that lists materially different variants, where each variant is used, and whether the variant changes fields/behavior or only presentation/content.
   - Inventory shared components such as Header, Navigation, Button, Link, Card, Form Input, Icon, Accordion Item, Media, and Rich Text as prerequisites for modules.
   - Use regular relative Markdown links inside page, module, and component Markdown files to answer: "Which CMS modules build the homepage?", "Which hardcoded components appear on the page?", and "Which components are used inside the CTA module?"
   - Note ambiguity, missing states, inconsistent components, unclear copy, accessibility concerns, CMS editorial risks, and implementation risks.

8. **Produce artifacts**
   - Follow `references/output-structure.md` for files and schemas.
   - Keep generated documents minimal: pages/templates, modules, components, and only necessary supporting styles/interactions/content models. Estimates are optional and only generated on request.
   - Write concise, developer-facing Markdown that can be pasted into a project-management tool.
   - Include assumptions and confidence levels for estimation.
   - Ensure every page file links to its template and documents only route/content-specific differences, every template file lists its reusable CMS module stack with variant names where applicable and hardcoded page components, every module file lists contained component links and variants, and every component file lists where it is used.
   - Ensure every module/component Markdown file embeds valid co-located cropped screenshot(s), including meaningful variants.
   - Before delivery, review the template and module inventory for near-duplicates. Merge templates/pages whose differences are only content/country/locale/module variant choices, and merge modules whose differences can be represented as variants without changing the CMS/editor model materially.
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
