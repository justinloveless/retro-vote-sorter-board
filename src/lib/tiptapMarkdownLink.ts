import { InputRule } from '@tiptap/core';
import Link from '@tiptap/extension-link';
import {
  escapeHtml,
  parseSingleMarkdownLink,
  plainTextContainsMarkdownLink,
  plainTextWithMarkdownLinksToHtml,
} from '@/lib/richTextDisplay';

/** TipTap Link with markdown `[label](url)` input rule and wrap-friendly attrs. */
export const MarkdownLink = Link.extend({
  addInputRules() {
    return [
      ...(this.parent?.() ?? []),
      new InputRule({
        find: /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/,
        handler: ({ chain, range, match }) => {
          const label = match[1];
          const href = match[2];
          if (!label || !href) return;

          chain()
            .focus()
            .deleteRange(range)
            .insertContent({
              type: 'text',
              text: label,
              marks: [
                {
                  type: this.name,
                  attrs: {
                    href,
                    target: '_blank',
                    rel: 'noopener noreferrer nofollow',
                  },
                },
              ],
            })
            .run();
        },
      }),
    ];
  },
}).configure({
  openOnClick: true,
  autolink: true,
  linkOnPaste: true,
  validate: (href) => /^https?:\/\//.test(href),
  HTMLAttributes: {
    class: 'break-all',
    target: '_blank',
    rel: 'noopener noreferrer nofollow',
  },
});

/**
 * If clipboard plain text contains markdown links, insert them as TipTap links.
 * Returns true when handled (caller should skip default paste).
 */
export function tryPasteMarkdownLinks(
  event: ClipboardEvent,
  insertHtml: (html: string) => void
): boolean {
  const text = event.clipboardData?.getData('text/plain');
  if (!text || !plainTextContainsMarkdownLink(text)) {
    return false;
  }

  const single = parseSingleMarkdownLink(text);
  if (single) {
    event.preventDefault();
    insertHtml(
      `<a href="${escapeHtml(single.href)}" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(single.label)}</a>`
    );
    return true;
  }

  const html = plainTextWithMarkdownLinksToHtml(text);
  if (!html) return false;

  event.preventDefault();
  insertHtml(html);
  return true;
}
