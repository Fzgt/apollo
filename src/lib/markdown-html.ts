// GitHub issue bodies embed screenshots as raw `<img>` HTML. react-markdown does not
// parse raw HTML, and adding rehype-raw would pull parse5 into the bundle for the sake
// of a handful of tags — so those `<img>` tags rendered as visible text instead of
// pictures. Rewrite them to markdown image syntax before rendering.
//
// The rewrite must be line-preserving: heading anchor ids are looked up by source line
// number (see headingIdByLine), so adding or removing a single line breaks every anchor
// in the document.

// Requires whitespace before the attribute name so `data-src` is not mistaken for `src`.
const attrValue = (tag: string, name: string) => {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return match ? (match[1] ?? match[2] ?? '') : '';
};

const IMG_TAG = /<img\b[^>]*>/gi;

const rewriteImgTags = (text: string) =>
  text.replace(IMG_TAG, (tag) => {
    const src = attrValue(tag, 'src').trim();
    if (!src) return tag;
    const alt = attrValue(tag, 'alt').replace(/[[\]]/g, '');
    // `width` on the original tag is the display size the author picked in the issue —
    // the files themselves are retina screenshots (1172px wide for a 400px picture).
    // Markdown has nowhere to put it, so carry it in the query string and let the
    // renderer turn it back into a max-width.
    const width = attrValue(tag, 'width').trim();
    const sized =
      /^\d+$/.test(width) && !/[?&]w=/.test(src)
        ? `${src}${src.includes('?') ? '&' : '?'}w=${width}`
        : src;
    // Pointy-bracket destination keeps URLs containing parentheses intact.
    return `![${alt}](<${sized}>)`;
  });

// Backtick-delimited spans are code, not markup — leave them exactly as written.
const rewriteOutsideInlineCode = (line: string) =>
  line
    .split(/(`+[^`]*`+)/)
    .map((chunk, index) => (index % 2 === 1 ? chunk : rewriteImgTags(chunk)))
    .join('');

export function inlineHtmlImages(markdown: string): string {
  let inFence = false;

  return markdown
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence || !line.includes('<img')) return line;
      return rewriteOutsideInlineCode(line);
    })
    .join('\n');
}
