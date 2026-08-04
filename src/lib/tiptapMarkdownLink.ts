import { InputRule } from '@tiptap/core';
import { DOMParser as ProseMirrorDOMParser } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
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

function insertHtmlAtSelection(view: EditorView, html: string) {
  const element = document.createElement('div');
  element.innerHTML = html;
  const slice = ProseMirrorDOMParser.fromSchema(view.state.schema).parseSlice(element);
  view.dispatch(view.state.tr.replaceSelection(slice));
}

/**
 * If clipboard plain text contains markdown links, insert them as TipTap links.
 * Returns true when handled (caller should skip default paste).
 */
export function tryPasteMarkdownLinks(view: EditorView, event: ClipboardEvent): boolean {
  const text = event.clipboardData?.getData('text/plain');
  if (!text || !plainTextContainsMarkdownLink(text)) {
    return false;
  }

  const single = parseSingleMarkdownLink(text);
  if (single) {
    event.preventDefault();
    insertHtmlAtSelection(
      view,
      `<a href="${escapeHtml(single.href)}" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(single.label)}</a>`
    );
    return true;
  }

  const html = plainTextWithMarkdownLinksToHtml(text);
  if (!html) return false;

  event.preventDefault();
  insertHtmlAtSelection(view, html);
  return true;
}
