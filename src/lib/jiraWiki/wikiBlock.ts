import type { JSONContent } from '@tiptap/core';
import { wikiInlineToContent, contentToWikiInline } from './wikiInline';

export interface WikiListItemNode {
  level: number;
  content: string;
  children: WikiListItemNode[];
}

function collectWikiListItems(
  lines: string[],
  startI: number,
  pattern: RegExp,
  stripPrefix: (line: string) => string,
): { items: WikiListItemNode[]; nextI: number } {
  const items: WikiListItemNode[] = [];
  const stack: { node: WikiListItemNode; level: number }[] = [];
  let i = startI;

  while (i < lines.length) {
    const line = lines[i].trimEnd();
    const match = line.match(pattern);
    if (!match) break;

    const level = match[1].length;
    const content = stripPrefix(line);
    const node: WikiListItemNode = { level, content, children: [] };

    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      items.push(node);
      stack.push({ node, level });
    } else {
      stack[stack.length - 1].node.children.push(node);
      stack.push({ node, level });
    }
    i++;
  }

  return { items, nextI: i };
}

function wikiListItemsToListJSON(items: WikiListItemNode[], ordered: boolean): JSONContent {
  return {
    type: ordered ? 'orderedList' : 'bulletList',
    content: items.map((item) => {
      const para: JSONContent = {
        type: 'paragraph',
        content: wikiInlineToContent(item.content).length
          ? wikiInlineToContent(item.content)
          : undefined,
      };
      const inner: JSONContent[] = [para];
      if (item.children.length > 0) {
        inner.push(wikiListItemsToListJSON(item.children, ordered));
      }
      return {
        type: 'listItem',
        content: inner,
      };
    }),
  };
}

/** Convert a wiki text segment (no top-level panel/noformat) into block JSON nodes. */
export function wikiTextSegmentToBlocks(text: string): JSONContent[] {
  const lines = text.split('\n');
  const nodes: JSONContent[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trimEnd();

    if (!line.trim()) {
      i++;
      continue;
    }

    const headerMatch = line.match(/^h([1-6])\.\s*(.*)/);
    if (headerMatch) {
      const level = parseInt(headerMatch[1], 10);
      const ic = wikiInlineToContent(headerMatch[2]);
      nodes.push({
        type: 'heading',
        attrs: { level },
        content: ic.length ? ic : undefined,
      });
      i++;
      continue;
    }

    const olMatch = line.match(/^(#+)\s+(.*)$/);
    if (olMatch) {
      const { items, nextI } = collectWikiListItems(lines, i, /^(#+)\s/, (raw) => raw.replace(/^#+\s*/, ''));
      i = nextI;
      nodes.push(wikiListItemsToListJSON(items, true));
      continue;
    }

    const ulMatch = line.match(/^(\*+)\s+(.*)$/);
    if (ulMatch) {
      const { items, nextI } = collectWikiListItems(lines, i, /^(\*+)\s/, (raw) => raw.replace(/^\*+\s*/, ''));
      i = nextI;
      nodes.push(wikiListItemsToListJSON(items, false));
      continue;
    }

    const ic = wikiInlineToContent(line);
    nodes.push({
      type: 'paragraph',
      content: ic.length ? ic : undefined,
    });
    i++;
  }

  return nodes;
}

function serializeListItems(items: WikiListItemNode[], ordered: boolean, depth: number): string {
  const prefix = ordered ? '#'.repeat(depth) : '*'.repeat(depth);
  const lines: string[] = [];
  for (const item of items) {
    lines.push(`${prefix} ${item.content}`);
    if (item.children.length > 0) {
      lines.push(serializeListItems(item.children, ordered, depth + 1));
    }
  }
  return lines.join('\n');
}

/** Extract ordered list items from TipTap orderedList node (recursive). */
function extractOrderedItems(node: JSONContent): WikiListItemNode[] {
  if (node.type !== 'orderedList' || !node.content) return [];
  return node.content.map((li) => extractListItem(li, true)).filter(Boolean) as WikiListItemNode[];
}

function extractBulletItems(node: JSONContent): WikiListItemNode[] {
  if (node.type !== 'bulletList' || !node.content) return [];
  return node.content.map((li) => extractListItem(li, false)).filter(Boolean) as WikiListItemNode[];
}

function extractListItem(li: JSONContent, _ordered: boolean): WikiListItemNode | null {
  if (li.type !== 'listItem' || !li.content) return null;
  let text = '';
  const children: WikiListItemNode[] = [];
  for (const c of li.content) {
    if (c.type === 'paragraph') {
      text = contentToWikiInline(c.content);
    } else if (c.type === 'orderedList') {
      children.push(...extractOrderedItems(c));
    } else if (c.type === 'bulletList') {
      children.push(...extractBulletItems(c));
    }
  }
  return { level: 1, content: text, children };
}

export function blockToWikiSegment(node: JSONContent): string {
  if (node.type === 'paragraph') {
    return contentToWikiInline(node.content) + '\n';
  }
  if (node.type === 'heading') {
    const level = node.attrs?.level ?? 1;
    return `h${level}. ${contentToWikiInline(node.content)}\n`;
  }
  if (node.type === 'codeBlock') {
    const text =
      node.content?.map((c) => (c.type === 'text' ? c.text : '')).join('') ?? '';
    const rawAttrs = node.attrs?.jiraNoformatAttrs as string | undefined;
    const body = text.replace(/^\n/, '');
    if (rawAttrs) {
      return `{noformat:${rawAttrs}}\n${body}{noformat}\n`;
    }
    return `{noformat}\n${body}{noformat}\n`;
  }
  if (node.type === 'orderedList' && node.content) {
    const items = extractOrderedItems(node);
    return serializeListItems(items, true, 1) + '\n';
  }
  if (node.type === 'bulletList' && node.content) {
    const items = extractBulletItems(node);
    return serializeListItems(items, false, 1) + '\n';
  }
  if (node.type === 'jiraPanel') {
    const attrs = String(node.attrs?.panelAttrs ?? '');
    const inner = (node.content || []).map((c) => blockToWikiSegment(c)).join('');
    const open = attrs ? `{panel:${attrs}}` : '{panel}';
    return `${open}\n${inner}{panel}\n`;
  }
  return '';
}
