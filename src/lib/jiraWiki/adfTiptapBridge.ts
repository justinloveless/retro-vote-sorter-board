import type { JSONContent } from '@tiptap/core';

type AdfNode = Record<string, unknown>;

function isAdfNode(v: unknown): v is AdfNode {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function nodeType(n: AdfNode): string {
  return typeof n.type === 'string' ? n.type : '';
}

function adfMarksToTiptap(marks: unknown[]): JSONContent['marks'] {
  const out: NonNullable<JSONContent['marks']> = [];
  for (const raw of marks) {
    if (!isAdfNode(raw)) continue;
    const mt = nodeType(raw);
    const attrs = raw.attrs as AdfNode | undefined;
    if (mt === 'strong') out.push({ type: 'bold' });
    else if (mt === 'em') out.push({ type: 'italic' });
    else if (mt === 'strike') out.push({ type: 'strike' });
    else if (mt === 'code') out.push({ type: 'code' });
    else if (mt === 'link' && attrs?.href) {
      out.push({ type: 'link', attrs: { href: String(attrs.href), target: '_blank' } });
    }
  }
  return out.length ? out : undefined;
}

function convertInline(n: AdfNode): JSONContent | null {
  const t = nodeType(n);
  if (t === 'text') {
    const text = typeof n.text === 'string' ? n.text : '';
    if (!text) return null;
    const marks = Array.isArray(n.marks) ? adfMarksToTiptap(n.marks) : undefined;
    return { type: 'text', text, marks };
  }
  if (t === 'hardBreak') return { type: 'hardBreak' };
  if (t === 'mention') {
    const attrs = n.attrs as AdfNode | undefined;
    const label = typeof attrs?.text === 'string' ? attrs.text : '@user';
    return { type: 'text', text: label };
  }
  if (t === 'emoji') {
    const attrs = n.attrs as AdfNode | undefined;
    const shortName = typeof attrs?.shortName === 'string' ? attrs.shortName : '';
    return shortName ? { type: 'text', text: shortName } : null;
  }
  if (t === 'inlineCard') {
    const attrs = n.attrs as AdfNode | undefined;
    const url = typeof attrs?.url === 'string' ? attrs.url : '';
    if (!url) return null;
    return {
      type: 'text',
      text: url,
      marks: [{ type: 'link', attrs: { href: url, target: '_blank' } }],
    };
  }
  return null;
}

function convertChildren(n: AdfNode): JSONContent[] {
  if (!Array.isArray(n.content)) return [];
  const out: JSONContent[] = [];
  for (const child of n.content) {
    if (!isAdfNode(child)) continue;
    const converted = convertBlock(child);
    if (converted) out.push(converted);
  }
  return out;
}

function convertInlineChildren(n: AdfNode): JSONContent[] | undefined {
  if (!Array.isArray(n.content)) return undefined;
  const out: JSONContent[] = [];
  for (const child of n.content) {
    if (!isAdfNode(child)) continue;
    const ic = convertInline(child);
    if (ic) out.push(ic);
  }
  return out.length ? out : undefined;
}

function convertBlock(n: AdfNode): JSONContent | null {
  const t = nodeType(n);

  switch (t) {
    case 'doc':
      return { type: 'doc', content: convertChildren(n) };

    case 'paragraph':
      return { type: 'paragraph', content: convertInlineChildren(n) };

    case 'heading': {
      const attrs = n.attrs as AdfNode | undefined;
      const level = typeof attrs?.level === 'number' ? attrs.level : 1;
      return { type: 'heading', attrs: { level }, content: convertInlineChildren(n) };
    }

    case 'bulletList':
      return { type: 'bulletList', content: convertChildren(n) };

    case 'orderedList':
      return { type: 'orderedList', content: convertChildren(n) };

    case 'listItem': {
      const children = convertChildren(n);
      return { type: 'listItem', content: children.length ? children : [{ type: 'paragraph' }] };
    }

    case 'codeBlock': {
      const attrs = n.attrs as AdfNode | undefined;
      const lang = typeof attrs?.language === 'string' ? attrs.language : '';
      const text = extractPlainText(n);
      return {
        type: 'codeBlock',
        attrs: { jiraNoformatAttrs: lang || '' },
        content: text ? [{ type: 'text', text }] : undefined,
      };
    }

    case 'blockquote': {
      const inner = convertChildren(n);
      return {
        type: 'jiraPanel',
        attrs: { panelAttrs: '' },
        content: inner.length ? inner : [{ type: 'paragraph' }],
      };
    }

    case 'panel': {
      const attrs = n.attrs as AdfNode | undefined;
      const panelType = typeof attrs?.panelType === 'string' ? attrs.panelType : '';
      const inner = convertChildren(n);
      return {
        type: 'jiraPanel',
        attrs: { panelAttrs: panelType ? `title=${panelType}` : '' },
        content: inner.length ? inner : [{ type: 'paragraph' }],
      };
    }

    case 'rule':
      return { type: 'paragraph', content: [{ type: 'text', text: '----' }] };

    case 'table':
    case 'tableRow':
    case 'tableCell':
    case 'tableHeader': {
      if (t === 'table') {
        return convertTableToBlocks(n);
      }
      const children = convertChildren(n);
      return children.length === 1 ? children[0] : children.length ? { type: 'paragraph', content: flattenToInline(children) } : null;
    }

    case 'mediaSingle':
    case 'media':
    case 'mediaGroup':
      return null;

    case 'expand':
    case 'nestedExpand': {
      const inner = convertChildren(n);
      return inner.length === 1 ? inner[0] : inner.length ? { type: 'jiraPanel', attrs: { panelAttrs: '' }, content: inner } : null;
    }

    default: {
      const inline = convertInline(n);
      if (inline) return inline;
      const children = convertChildren(n);
      return children.length === 1 ? children[0] : children.length ? children[0] : null;
    }
  }
}

function convertTableToBlocks(table: AdfNode): JSONContent {
  const rows = Array.isArray(table.content) ? table.content : [];
  const content: JSONContent[] = [];
  for (const row of rows) {
    if (!isAdfNode(row)) continue;
    const cells = Array.isArray(row.content) ? row.content : [];
    const isHeader = cells.some((c: unknown) => isAdfNode(c) && nodeType(c as AdfNode) === 'tableHeader');
    const cellTexts: string[] = [];
    for (const cell of cells) {
      if (!isAdfNode(cell)) continue;
      cellTexts.push(extractPlainText(cell as AdfNode));
    }
    const sep = isHeader ? '||' : '|';
    const wikiRow = `${sep}${cellTexts.join(sep)}${sep}`;
    content.push({ type: 'paragraph', content: [{ type: 'text', text: wikiRow }] });
  }
  return content.length === 1 ? content[0] : { type: 'jiraPanel', attrs: { panelAttrs: '' }, content };
}

function extractPlainText(n: AdfNode): string {
  const t = nodeType(n);
  if (t === 'text') return typeof n.text === 'string' ? n.text : '';
  if (t === 'hardBreak') return '\n';
  if (!Array.isArray(n.content)) return '';
  return n.content.map((c: unknown) => (isAdfNode(c) ? extractPlainText(c) : '')).join('');
}

function flattenToInline(blocks: JSONContent[]): JSONContent[] {
  const out: JSONContent[] = [];
  for (const b of blocks) {
    if (b.content) out.push(...b.content);
  }
  return out.length ? out : [{ type: 'text', text: ' ' }];
}

/** Convert an ADF document to TipTap-compatible JSONContent for the rich editor. */
export function adfToTiptapJSON(adf: unknown): JSONContent {
  if (!isAdfNode(adf) || nodeType(adf) !== 'doc') {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }
  const result = convertBlock(adf);
  if (!result || result.type !== 'doc' || !result.content?.length) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }
  return result;
}
