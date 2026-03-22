import type { JSONContent } from '@tiptap/core';

function applyLinkToFragments(fragments: JSONContent[], href: string): JSONContent[] {
  return fragments.map((f) => {
    if (f.type !== 'text') return f;
    return {
      ...f,
      marks: [...(f.marks || []), { type: 'link', attrs: { href, target: '_blank' } }],
    };
  });
}

function mergeAdjacentTextNodes(parts: JSONContent[]): JSONContent[] {
  const out: JSONContent[] = [];
  for (const p of parts) {
    if (p.type === 'text' && out.length && out[out.length - 1].type === 'text') {
      const prev = out[out.length - 1];
      const sameMarks =
        JSON.stringify(prev.marks || []) === JSON.stringify(p.marks || []);
      if (sameMarks) {
        out[out.length - 1] = {
          ...prev,
          text: (prev.text || '') + (p.text || ''),
        };
        continue;
      }
    }
    out.push(p);
  }
  return out;
}

/**
 * Parse one line of Jira wiki inline markup into TipTap-compatible inline JSON.
 */
export function wikiInlineToContent(line: string): JSONContent[] {
  const cleaned = line.replace(/\{color:[^}]*\}/g, '').replace(/\{color\}/g, '');

  const tokenRegex =
    /\{\{((?:(?!\}\}).)+)\}\}|\*([^*]+)\*|(?<![a-zA-Z0-9])_([^_]+)_(?![a-zA-Z0-9])|(?<![-\w])-([^-]+)-(?![-\w])|\[([^[\]]*)\|([^\]]*)\]/g;

  const parts: JSONContent[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;

  while ((m = tokenRegex.exec(cleaned)) !== null) {
    if (m.index > lastIdx) {
      parts.push({ type: 'text', text: cleaned.slice(lastIdx, m.index) });
    }

    if (m[1] !== undefined) {
      parts.push({
        type: 'text',
        text: m[1],
        marks: [{ type: 'code' }],
      });
    } else if (m[2] !== undefined) {
      parts.push({
        type: 'text',
        text: m[2],
        marks: [{ type: 'bold' }],
      });
    } else if (m[3] !== undefined) {
      parts.push({
        type: 'text',
        text: m[3],
        marks: [{ type: 'italic' }],
      });
    } else if (m[4] !== undefined) {
      parts.push({
        type: 'text',
        text: m[4],
        marks: [{ type: 'strike' }],
      });
    } else if (m[5] !== undefined && m[6] !== undefined) {
      const inner = wikiInlineToContent(m[5]);
      parts.push(...applyLinkToFragments(inner, m[6]));
    }

    lastIdx = m.index + m[0].length;
  }

  if (lastIdx < cleaned.length) {
    parts.push({ type: 'text', text: cleaned.slice(lastIdx) });
  }

  return mergeAdjacentTextNodes(parts);
}

/** Serialize TipTap inline fragment (paragraph content) to Jira wiki line (no trailing newline). */
export function contentToWikiInline(content: JSONContent[] | undefined): string {
  if (!content || content.length === 0) return '';
  return content.map((node) => serializeInlineNode(node)).join('');
}

function serializeInlineNode(node: JSONContent): string {
  if (node.type === 'hardBreak') return '\n';
  if (node.type !== 'text') return '';
  let text = node.text ?? '';
  const marks = [...(node.marks || [])].reverse();
  for (const m of marks) {
    if (m.type === 'bold') text = `*${text}*`;
    else if (m.type === 'italic') text = `_${text}_`;
    else if (m.type === 'strike') text = `-${text}-`;
    else if (m.type === 'code') text = `{{${text}}}`;
    else if (m.type === 'link' && m.attrs?.href) {
      const href = String(m.attrs.href);
      text = `[${text}|${href}]`;
    }
  }
  return text;
}
