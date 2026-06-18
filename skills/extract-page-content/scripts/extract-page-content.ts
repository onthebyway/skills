import { chromium } from '../../take-web-screenshot/node_modules/playwright/index.mjs';

const args = process.argv.slice(2);
const url = args[0];
const formatArg = args.find((arg) => arg.startsWith('--format='))?.split('=')[1] ?? args[1] ?? 'markdown';
const format = formatArg.toLowerCase();

if (!url || !['markdown', 'md', 'html'].includes(format)) {
  console.error('Usage: node .agents/skills/extract-page-content/scripts/extract-page-content.ts <url> --format=markdown|html');
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

  const data = await page.evaluate(() => {
    const normalize = (value: string | null | undefined) => (value || '').replace(/\s+/g, ' ').trim();

    const clone = document.documentElement.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('script, style, svg, link, noscript, iframe, template').forEach((el) => el.remove());
    clone.querySelectorAll('*').forEach((el) => {
      [...el.attributes].forEach((attr) => {
        const keep = ['href', 'src', 'alt', 'title', 'name', 'content', 'property', 'type', 'action', 'method', 'value', 'placeholder', 'for', 'id'];
        if (!keep.includes(attr.name)) el.removeAttribute(attr.name);
      });
    });

    const inlineMarkdown = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
      if (node.nodeType !== Node.ELEMENT_NODE) return '';

      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (tag === 'br') return '\n';

      const children = Array.from(el.childNodes).map(inlineMarkdown).join('');
      const withInlineSpacing = (value: string) => value.trim() ? ` ${value.trim()} ` : '';
      if (tag === 'strong' || tag === 'b') return withInlineSpacing(`**${children.trim()}**`);
      if (tag === 'em' || tag === 'i') return withInlineSpacing(`_${children.trim()}_`);
      if (tag === 'code') return withInlineSpacing(`\`${children.trim()}\``);

      const inlineTags = new Set([
        'a', 'abbr', 'bdi', 'bdo', 'cite', 'data', 'dfn', 'kbd', 'mark', 'q',
        'rp', 'rt', 'ruby', 's', 'samp', 'small', 'span', 'sub', 'sup', 'time',
        'u', 'var', 'wbr',
      ]);
      if (inlineTags.has(tag)) return withInlineSpacing(children);
      return children;
    };

    const cleanMarkdown = (value: string) => value
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.replace(/[ \t]+/g, ' ').trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const lines: string[] = [];
    const seen = new Set<string>();
    const add = (line: string) => {
      const clean = cleanMarkdown(line);
      if (!clean || seen.has(clean)) return;
      seen.add(clean);
      lines.push(clean);
    };

    const title = normalize(document.title);
    if (title) add(`# ${title}`);

    document.querySelectorAll('main, article, body').forEach((root, rootIndex) => {
      if (rootIndex > 0 && document.querySelector('main, article')) return;
      root.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,a,button,label,input,textarea,select,option,figcaption,blockquote').forEach((el) => {
        const tag = el.tagName.toLowerCase();
        const text = cleanMarkdown(inlineMarkdown(el));

        if (/h[1-6]/.test(tag)) {
          if (text) add(`${'#'.repeat(Number(tag[1]))} ${text}`);
          return;
        }

        if (tag === 'a') {
          const href = (el as HTMLAnchorElement).href;
          if (text && href) add(`- [${text}](${href})`);
          else if (href) add(`- ${href}`);
          return;
        }

        if (tag === 'button' && text) {
          add(`- Button: ${text}`);
          return;
        }

        if (['input', 'textarea', 'select'].includes(tag)) {
          const input = el as HTMLInputElement;
          const label = normalize(input.getAttribute('aria-label') || input.getAttribute('placeholder') || input.getAttribute('name') || input.id);
          if (label) add(`- Field: ${label}`);
          return;
        }

        if (text) add(tag === 'li' ? `- ${text}` : text);
      });
    });

    return {
      finalUrl: location.href,
      html: '<!doctype html>\n' + clone.outerHTML,
      markdown: lines.join('\n\n'),
    };
  });

  // Return the requested content to the agent via stdout. Do not write files.
  process.stdout.write(format === 'html' ? data.html : data.markdown);
} finally {
  await browser.close();
}
