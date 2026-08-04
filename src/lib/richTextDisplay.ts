/** CSS classes so long URLs/text wrap inside retro card containers. */
export const RICH_TEXT_DISPLAY_CLASS =
  'break-words [overflow-wrap:anywhere] [&_a]:break-all';

/** CSS classes for TipTap editors so long links wrap while editing. */
export const RICH_TEXT_EDITOR_CLASS =
  'prose dark:prose-invert min-w-full max-w-full focus:outline-none p-2 rounded-md border border-input min-h-[40px] max-h-[120px] overflow-y-auto text-sm break-words [overflow-wrap:anywhere] [&_a]:break-all';

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Decode common entities found in TipTap HTML text nodes before re-escaping. */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function markdownLinkToAnchor(labelRaw: string, urlRaw: string): string {
  const label = decodeHtmlEntities(labelRaw);
  const url = decodeHtmlEntities(urlRaw);
  if (!isSafeHttpUrl(url)) {
    return `[${escapeHtml(label)}](${escapeHtml(url)})`;
  }
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(label)}</a>`;
}

/** Parse a single markdown link that is the entire string. */
export function parseSingleMarkdownLink(
  text: string
): { label: string; href: string } | null {
  const trimmed = text.trim();
  const match = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(trimmed);
  if (!match) return null;
  const href = match[2];
  if (!isSafeHttpUrl(href)) return null;
  return { label: match[1], href };
}

/**
 * Convert markdown links `[label](https://url)` in HTML text nodes to anchors.
 * Only http(s) URLs are accepted; labels/URLs are safely escaped for HTML.
 */
export function convertMarkdownLinksToHtml(html: string): string {
  if (!html) return html;

  return html.replace(/(<[^>]+>)|([^<]+)/g, (match, tag: string | undefined, text: string | undefined) => {
    if (tag) return tag;
    if (!text) return match;

    return text.replace(MARKDOWN_LINK_RE, (_full, label: string, url: string) => {
      return markdownLinkToAnchor(label, url);
    });
  });
}

/**
 * Convert markdown links in plain text to HTML suitable for TipTap insertContent.
 * Escapes non-link text so pasted content cannot inject HTML.
 * Returns empty string when no markdown links are present.
 */
export function plainTextWithMarkdownLinksToHtml(text: string): string {
  const parts: string[] = [];
  let lastIndex = 0;
  const re = new RegExp(MARKDOWN_LINK_RE.source, 'g');
  let match: RegExpExecArray | null;
  let found = false;

  while ((match = re.exec(text)) !== null) {
    found = true;
    if (match.index > lastIndex) {
      parts.push(escapeHtml(text.slice(lastIndex, match.index)).replace(/\n/g, '<br>'));
    }
    parts.push(markdownLinkToAnchor(match[1], match[2]));
    lastIndex = match.index + match[0].length;
  }

  if (!found) {
    return '';
  }

  if (lastIndex < text.length) {
    parts.push(escapeHtml(text.slice(lastIndex)).replace(/\n/g, '<br>'));
  }

  return parts.join('');
}

export function plainTextContainsMarkdownLink(text: string): boolean {
  return new RegExp(MARKDOWN_LINK_RE.source).test(text);
}
