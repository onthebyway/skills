# Output Structure for Figma Design Scoping

This skill produces a lightweight Markdown knowledge base, not a heavy design graph. Each design element becomes a Markdown file with YAML frontmatter, human-readable notes, regular relative Markdown links, and embedded co-located screenshots where available.

The central modeling goal is to translate the Figma file into a concise CMS/component map:

```text
Page/template composition → CMS modules + hardcoded page components → shared components
```

Pages and templates are organizational maps. A page should be buildable from its CMS module stack plus any hardcoded page-level components fixed into the template shell or exact page location. The most important implementation artifacts are the reusable modules that editors will use in the CMS and the shared components those modules contain. Keep the output lean: inter-link pages, modules, and components directly in Markdown instead of generating separate dependency documents. Use regular relative Markdown links so VS Code preview and common Markdown renderers can navigate the handoff.

Default folder:

```text
figma-analysis/
├── index.md
├── pages/
│   ├── home.md
│   ├── products.md
│   └── about.md
├── templates/
│   ├── homepage.md
│   ├── text-page.md
│   ├── blog-overview.md
│   └── blog-detail.md
├── modules/
│   ├── hero.md
│   ├── hero.png
│   ├── hero--dark.png
│   ├── feature-grid.md
│   ├── feature-grid.png
│   ├── testimonial-slider.md
│   └── cta-band.md
├── components/
│   ├── button.md
│   ├── button.png
│   ├── button--secondary.png
│   ├── card.md
│   ├── card.png
│   ├── accordion.md
│   └── form-input.md
├── content-models/
│   ├── page.md
│   ├── product.md
│   └── article.md
├── interactions/
│   ├── carousel.md
│   ├── modal.md
│   └── accordion.md
├── styles/
│   ├── colors.md
│   ├── typography.md
│   └── spacing.md
├── screenshots/
│   ├── pdf/
│   │   ├── manifest.json
│   │   └── <pdf-export-page-001>.png
│   └── <page-or-template-slug>/
│       └── <screen-slug>.png
└── _pdf/
    ├── summary.md
    └── triage.md
```

Optional when quoting is requested:

```text
figma-analysis/estimates/
├── modules.md
├── components.md
├── page-rollup.md
└── total-rollup.md
```

## Core modeling rules

Use this hierarchy when dissecting the Figma file:

1. **Pages**: broad site/app areas, routes, Figma pages, product sections, or design-system pages. Pages mainly organize requirements and route groups.
2. **Templates**: complete route/screen composition patterns developers will build, such as homepage, product detail, dashboard, settings, checkout step. Templates must list an ordered CMS module stack and separate hardcoded page components.
3. **Modules**: reusable CMS-programmable page sections or feature blocks, such as hero, reference slider, fact grid, pricing table, testimonial slider, search results, account sidebar, CTA band. Modules are the primary scoping and estimating unit.
4. **Components**: smaller reusable UI parts and global shell pieces, such as header, navigation, footer, button, link, card, badge, input, accordion item, icon. Components may be contained in modules or hardcoded into a page/template location.
5. **Content models**: CMS/data shapes needed to populate templates/modules, such as page, article, product, hero module content, testimonial, CTA, card item.
6. **Interactions**: behavior patterns, such as carousel, modal, accordion, filtering, form validation, dropdown navigation, quiz scoring.
7. **Styles**: design tokens and global visual rules, such as colors, typography, spacing, radii, shadows, breakpoints.
8. **Estimates**: optional rough rollups, only when requested, based on estimates per unique module and component. Page totals are calculated from the page's module stack plus hardcoded page components, with only a small page assembly allowance if needed.

Prefer readable relationships over dense JSON edges. Always use regular relative Markdown links, not wiki links:

```markdown
## Uses
- [Button primary](../components/button-primary.md)
- [Typography](../styles/typography.md)

## Used by
- [Homepage hero](../modules/homepage-hero.md)

## Depends on
- [Hero content](../content-models/hero-content.md)
- [Carousel](../interactions/carousel.md)
```

## Co-located screenshots for modules/components

Every module and component Markdown file should embed one or more screenshots stored beside that Markdown file:

```text
modules/hero.md
modules/hero.png
modules/hero--dark.png
components/button.md
components/button.png
components/button--secondary.png
```

Rules:

- Base screenshot uses the same basename as the Markdown file: `hero.md` → `hero.png`.
- Variants use `--variant-name`: `hero--dark.png`, `button--secondary.png`, `card--compact.png`.
- Capture every variant that differs materially in styling, size, composition, behavior state, or CMS structure.
- Do not capture duplicate content-only examples if layout/styling/composition is the same.
- Embed screenshots near the top of the Markdown file using relative image links, e.g. `![Hero module](./hero.png)`.
- If a screenshot cannot be cropped confidently from the PDF/Figma source, add a `## Screenshot status` section explaining what is missing.

## YAML frontmatter conventions

Every Markdown file should start with YAML frontmatter.

Common fields:

```yaml
---
title: Homepage Hero
type: module
status: analyzed
source:
  figma_file: https://figma.com/file/...
  page: Marketing Site
  node_id: "12:345"
screenshots:
  - ./homepage-hero.png
  - ./homepage-hero--dark.png
complexity:
  frontend: M
  cms: S
  qa: S
confidence: medium
tags:
  - marketing
  - reusable
---
```

Allowed `type` values:

- `page`
- `template`
- `module`
- `component`
- `content-model`
- `interaction`
- `style`
- `estimate`

Allowed complexity values:

- `XS`: static/simple content
- `S`: common UI or simple CMS/data mapping
- `M`: moderate responsive behavior, forms, states, variants, or CMS configuration
- `L`: complex data UI, multiple states, custom behavior, integrations, or advanced responsive rules
- `XL`: highly custom interaction, animation-heavy, canvas/editor behavior, or significant ambiguity

## index.md

Purpose: entry point for humans and estimating agents.

Include:

- Figma file name and URL.
- Analysis date if relevant.
- Access limitations.
- Summary counts for pages, templates, CMS modules, shared components, content models, interactions, styles.
- High-level implementation assumptions.
- Global components that most pages use, e.g. Header, Navigation, Footer, SEO metadata, layout container.
- Links to all major sections.

Example:

```markdown
# Figma Analysis: Example Site

## Summary
- Pages: 2
- Templates: 6
- Modules: 14
- Components: 22
- Content models: 5
- Interactions: 4

## Sections
- [Marketing site](pages/marketing-site.md)
- [Design system](pages/design-system.md)
```

## _pdf/triage.md

Purpose: quickly separate actual implementation screens from supporting material before deep analysis. This matters for large PDFs where client presentation slides, component playgrounds, annotations, and sitemap pages do not all need full decomposition.

Keep `_pdf/` lean. Do not create both Markdown and CSV versions of the same inventory/triage information unless the user explicitly asks for a spreadsheet-friendly export.

Classification values:

- `actual-design`: real page/screen/template to quote and implement.
- `design-system`: component/style guidance worth extracting.
- `component-playground`: exploratory component variants; skim for reusable components only.
- `client-presentation`: slides, rationale, moodboards, process; summarize only if useful.
- `sitemap-flow`: IA, flow, sitemap; use for routing/content scope, not template implementation.
- `annotation`: notes/specs; extract risks/requirements only.
- `archive-draft`: old/draft/duplicate; ignore unless referenced.
- `unknown`: needs manual review.

Only `actual-design` and `design-system` pages should drive full analysis. Supporting classifications can inform requirements, risks, routes, and reusable component notes.

## pages/*.md

Use for broad areas or Figma/PDF sections.

Recommended sections:

```markdown
## Purpose

## Contains
- [Homepage](../templates/homepage.md)
- [Product detail](../templates/product-detail.md)

## Key screenshots

## Notes

## Open questions
```

## templates/*.md

Use for complete buildable page/route composition patterns. Templates should not duplicate all module details; they should answer "what module stack builds this page?" and "what must exist first?"

Required sections:

```markdown
## Purpose

## Source frames
- Figma node: `12:345`
- Screenshot: `../screenshots/marketing-site/homepage.png`

## CMS module stack
1. [Hero](../modules/hero.md)
2. [Reference slider](../modules/reference-slider.md)
3. [Fact grid](../modules/fact-grid.md)
4. [CTA band](../modules/cta-band.md)

## Hardcoded page components
- [Header](../components/header.md)
- [Navigation](../components/navigation.md)
- [Footer](../components/footer.md)
- [Page layout](../components/page-layout.md)
- [Page content model](../content-models/page.md)

## Uses interactions
- [Carousel](../interactions/carousel.md)

## CMS/page assembly notes
- Allowed module ordering constraints
- Required vs optional modules
- Which components are fixed in the template instead of editor-managed
- Reusable page metadata fields

## Responsive notes

## States and variants

## Accessibility notes

## Risks and open questions

## Estimate notes
```

## modules/*.md

Use for reusable CMS-programmable sections or feature blocks. Modules are the primary implementation/scoping artifact. Each module should be flexible enough for editors to compose pages without creating a one-off template for every design variation.

Required sections:

```markdown
## Purpose

## Screenshots
![Hero module](./hero.png)
![Hero dark variant](./hero--dark.png)

## Used by templates/pages
- [Homepage](../templates/homepage.md)

## CMS fields
| Field | Type | Required | Notes |
|---|---|---:|---|
| eyebrow | string | no | Optional small label |
| heading | string | yes | Main module title |
| body | rich text | no | Supports links/bold text |
| ctas | array<cta> | no | Uses [Button](../components/button.md) / [Link](../components/link.md) |
| items | array<object> | no | Repeater for cards/facts/slides |

## Uses components
- [Button](../components/button.md)
- [Link](../components/link.md)
- [Card](../components/card.md)

## Depends on styles
- [Typography](../styles/typography.md)
- [Spacing](../styles/spacing.md)

## Content model
- [Hero module](../content-models/hero-module.md)

## Behavior
- [Carousel](../interactions/carousel.md)

## Variants
- Background/theme variants
- Layout variants
- Media/no-media variants

## Editorial constraints
- Min/max item counts
- Character/image guidance
- Which fields are optional

## Implementation notes

## Estimate notes
```

## components/*.md

Use for smaller UI primitives, composed reusable UI elements, and global shell components. Components are the prerequisites that modules depend on.

Required sections:

```markdown
## Purpose

## Screenshots
![Button component](./button.png)
![Button secondary variant](./button--secondary.png)

## Used by modules/templates
- [Hero](../modules/hero.md)
- [CTA band](../modules/cta-band.md)

## Depends on components
- [Icon](./icon.md)

## Variants
- Primary
- Secondary
- Disabled

## States
- Default
- Hover
- Focus
- Disabled
- Loading

## Props / API
| Prop | Type | Required | Notes |
|---|---|---:|---|
| label | string | yes | Visible text |
| href | url | no | Link target |

## Depends on styles
- [Colors](../styles/colors.md)
- [Typography](../styles/typography.md)

## Accessibility notes

## Implementation notes
```

## content-models/*.md

Use for CMS/data/API shapes implied by the design. Prefer content models that map directly to modules and repeatable content types.

Required sections:

```markdown
## Purpose

## Used by
- [Homepage](../templates/homepage.md)
- [Hero](../modules/hero.md)

## Fields
| Field | Type | Required | Notes |
|---|---|---:|---|
| title | string | yes | Main heading |
| image | asset | no | Responsive image |

## Validation rules

## Editorial notes
- Min/max repeater counts
- Character guidance
- Image aspect-ratio guidance
- Module placement constraints

## API/CMS assumptions
```

## interactions/*.md

Use for reusable behavior.

Required sections:

```markdown
## Purpose

## Used by
- [Testimonial slider](../modules/testimonial-slider.md)

## Trigger

## Behavior

## States

## Responsive behavior

## Accessibility requirements

## Risks and open questions
```

## styles/*.md

Use for tokens, global design rules, and style dependencies.

Recommended files:

- `styles/colors.md`
- `styles/typography.md`
- `styles/spacing.md`
- `styles/radii.md`
- `styles/shadows.md`
- `styles/breakpoints.md`

Each should include observed values, token names if present, inferred patterns, and inconsistencies. Do not invent a full design system when Figma only contains ad hoc values.

## screenshots/pdf/manifest.json

Purpose: trace extracted screenshots back to the exported Figma PDF. This is the preferred screenshot source when Figma API image limits are restrictive.

```json
{
  "source": "pdf",
  "pdfPath": "exports/figma-frames.pdf",
  "pageCount": 40,
  "dpi": 144,
  "format": "png",
  "exports": [
    {
      "source": "pdf",
      "pdfPath": "exports/figma-frames.pdf",
      "page": 1,
      "itemType": "screen-from-pdf-page",
      "item": "PDF page 1",
      "slug": "figma-frames-page-001",
      "imagePath": "screenshots/pdf/figma-frames-page-001.png",
      "classification": "candidate-screen",
      "confidence": "medium"
    }
  ]
}
```

If Figma API metadata is also available, add node IDs to template/page Markdown frontmatter, but do not require them.

## Link-only relationship mapping

Do not generate separate matrices or build-order documents unless the user explicitly asks for them. Page/module/component relationships should live directly inside the Markdown files:

- Page/template files list their ordered `## CMS module stack` and separate `## Hardcoded page components`.
- Module files list `## Used by templates/pages` and `## Uses components`.
- Component files list `## Used by modules/templates/pages` and any lower-level `## Depends on components`.

This keeps the output focused on inter-linked pages, modules, and components.

## estimates/*.md

Optional: generate only when the user explicitly asks for quoting/estimation. The rough estimate should be based on unique modules and components, not one-off full-page estimates.

Required estimate artifacts when requested:

- `estimates/modules.md`: one row per unique CMS module with FE/CMS/QA estimate.
- `estimates/components.md`: one row per unique component with FE/CMS/QA estimate. CMS is usually `0` unless the component has editor-managed settings.
- `estimates/page-rollup.md`: one row per page/template showing its CMS modules, hardcoded page components, page assembly allowance, and total.
- `estimates/total-rollup.md`: unique module/component totals plus assumptions and risks.

A page estimate should follow:

```text
Page total = unique CMS modules used by page + hardcoded page components + small page assembly allowance
```

A module estimate should answer:

```text
Module -> CMS fields -> contained components -> interactions/variants/states -> QA allowance
```

A component estimate should answer:

```text
Component -> props/states -> responsive/accessibility behavior -> QA allowance
```

Example `estimates/modules.md` row:

```markdown
| Module | Used by | Uses components | FE | CMS | QA | Notes |
|---|---|---|---:|---:|---:|---|
| [Hero](../modules/hero.md) | [Homepage](../templates/homepage.md), [About](../templates/about.md) | [Button](../components/button.md), [Rich text](../components/rich-text.md) | 5 | 2 | 2 | Flexible CMS hero with CTA variants. |
```

Example `estimates/components.md` row:

```markdown
| Component | Used by | FE | CMS | QA | Notes |
|---|---|---:|---:|---:|---|
| [Button](../components/button.md) | [Hero](../modules/hero.md), [CTA band](../modules/cta-band.md) | 2 | 0 | 1 | Variants: primary, secondary, disabled, loading. |
```

Example `estimates/page-rollup.md` row:

```markdown
| Page/template | CMS modules | Hardcoded page components | Assembly | Total | Notes |
|---|---|---|---:|---:|---|
| [Homepage](../templates/homepage.md) | [Hero](../modules/hero.md), [Reference slider](../modules/reference-slider.md), [Fact grid](../modules/fact-grid.md) | [Header](../components/header.md), [Navigation](../components/navigation.md), [Footer](../components/footer.md) | 3 | 42 | Page is assembled from CMS modules plus fixed shell components. |
```

## estimates/total-rollup.md

Purpose: quote-facing summary.

Include:

- Unique module total.
- Unique component total.
- Page assembly allowance total.
- Page/template rollup totals derived from linked modules and hardcoded components.
- CMS/content-model work included in module estimates.
- QA allowance included per module/component.
- Main assumptions.
- Blocking questions.
