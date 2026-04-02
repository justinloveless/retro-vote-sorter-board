import { stripHtmlForWikiParse } from './htmlStrip';

export type WikiTopSegment = { type: 'text' | 'panel' | 'code'; content: string; attrs?: string };

const MAX_RICH_EDIT_CHARS = 200_000;

/**
 * Split Jira wiki by top-level {panel} and {noformat} blocks (same logic as the issue drawer viewer).
 */
export function segmentJiraWikiTopLevel(normalized: string): WikiTopSegment[] {
  const segments: WikiTopSegment[] = [];
  let remaining = normalized;

  while (remaining.length > 0) {
    const noformatMatch = remaining.match(/\{(?:noformat|norformat)(?::([^}]*))?\}/i);
    const noformatStart = noformatMatch ? remaining.indexOf(noformatMatch[0]) : Infinity;

    const panelMatch = remaining.match(/\{panel(?::([^}]*))?\}/i);
    const panelStart = panelMatch ? remaining.indexOf(panelMatch[0]) : Infinity;

    const nextBlock = Math.min(noformatStart, panelStart);

    if (nextBlock === Infinity) {
      segments.push({ type: 'text', content: remaining });
      break;
    }

    if (nextBlock > 0) {
      segments.push({ type: 'text', content: remaining.slice(0, nextBlock) });
    }

    if (noformatStart <= panelStart) {
      const openTag = remaining.slice(noformatStart).match(/^\{(?:noformat|norformat)(?::([^}]*))?\}/i);
      if (!openTag) {
        segments.push({ type: 'text', content: remaining });
        break;
      }

      const attrs = openTag[1] || '';
      const afterOpen = noformatStart + openTag[0].length;
      const closeMatch = remaining.slice(afterOpen).match(/\{(?:noformat|norformat)\}/i);
      const closeIdx = closeMatch ? afterOpen + closeMatch.index! : -1;

      if (closeIdx === -1) {
        segments.push({ type: 'text', content: remaining.slice(noformatStart) });
        break;
      }

      segments.push({ type: 'code', content: remaining.slice(afterOpen, closeIdx), attrs });
      remaining = remaining.slice(closeIdx + closeMatch![0].length);
    } else {
      const openTag = remaining.slice(panelStart).match(/^\{panel(?::([^}]*))?\}/i);
      if (!openTag) {
        segments.push({ type: 'text', content: remaining });
        break;
      }

      const attrs = openTag[1] || '';
      const afterOpen = panelStart + openTag[0].length;
      const closeMatch = remaining.slice(afterOpen).match(/\{panel\}/i);
      const closeIdx = closeMatch ? afterOpen + closeMatch.index! : -1;

      if (closeIdx === -1) {
        segments.push({ type: 'text', content: remaining.slice(panelStart) });
        break;
      }

      segments.push({ type: 'panel', content: remaining.slice(afterOpen, closeIdx), attrs });
      remaining = remaining.slice(closeIdx + closeMatch![0].length);
    }
  }

  return segments;
}

/**
 * Convert an ADF (Atlassian Document Format) tree to Jira wiki markup.
 * Handles the most common node types; unsupported nodes fall back to text extraction.
 */
export function adfToWikiMarkup(adf: unknown): string {
  if (!adf || typeof adf !== 'object') return '';

  const rec = adf as Record<string, unknown>;
  const nodeType = typeof rec.type === 'string' ? rec.type : '';

  if (nodeType === 'text') {
    let text = typeof rec.text === 'string' ? rec.text : '';
    const marks = Array.isArray(rec.marks) ? rec.marks : [];
    for (const mark of marks) {
      const m = mark as Record<string, unknown>;
      const mt = typeof m.type === 'string' ? m.type : '';
      if (mt === 'strong') text = `*${text}*`;
      else if (mt === 'em') text = `_${text}_`;
      else if (mt === 'strike') text = `-${text}-`;
      else if (mt === 'code') text = `{{${text}}}`;
      else if (mt === 'link') {
        const href = (m.attrs as Record<string, unknown>)?.href;
        if (typeof href === 'string') text = `[${text}|${href}]`;
      }
    }
    return text;
  }
  if (nodeType === 'hardBreak') return '\n';
  if (nodeType === 'mention') {
    const attrs = rec.attrs as Record<string, unknown> | undefined;
    const id = attrs?.id;
    return typeof id === 'string' ? `[~accountid:${id}]` : '';
  }
  if (nodeType === 'emoji') {
    const attrs = rec.attrs as Record<string, unknown> | undefined;
    const shortName = attrs?.shortName;
    return typeof shortName === 'string' ? shortName : '';
  }
  if (nodeType === 'inlineCard') {
    const attrs = rec.attrs as Record<string, unknown> | undefined;
    const url = attrs?.url;
    return typeof url === 'string' ? `[${url}]` : '';
  }

  const children = Array.isArray(rec.content)
    ? rec.content.map((c: unknown) => adfToWikiMarkup(c)).join('')
    : '';

  switch (nodeType) {
    case 'doc':
      return children.replace(/\n{3,}/g, '\n\n').trim();
    case 'paragraph':
      return children + '\n';
    case 'heading': {
      const level = (rec.attrs as Record<string, unknown>)?.level ?? 1;
      return `h${level}. ${children}\n`;
    }
    case 'bulletList':
      return adfListToWiki(rec.content as unknown[], '*');
    case 'orderedList':
      return adfListToWiki(rec.content as unknown[], '#');
    case 'listItem':
      return children;
    case 'blockquote':
      return `{quote}\n${children}{quote}\n`;
    case 'codeBlock': {
      const lang = (rec.attrs as Record<string, unknown>)?.language ?? '';
      const header = lang ? `{code:${lang}}` : '{code}';
      return `${header}\n${children}{code}\n`;
    }
    case 'rule':
      return '----\n';
    case 'panel': {
      const panelType = (rec.attrs as Record<string, unknown>)?.panelType ?? '';
      const header = panelType ? `{panel:title=${panelType}}` : '{panel}';
      return `${header}\n${children}{panel}\n`;
    }
    case 'table':
      return adfTableToWiki(rec.content as unknown[]);
    case 'tableRow':
    case 'tableCell':
    case 'tableHeader':
      return children;
    case 'mediaSingle':
    case 'media':
      return '';
    default:
      return children;
  }
}

function adfListToWiki(items: unknown[], marker: string, depth = 1): string {
  if (!Array.isArray(items)) return '';
  const prefix = marker.repeat(depth);
  let out = '';
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const li = item as Record<string, unknown>;
    if (!Array.isArray(li.content)) continue;
    for (const child of li.content) {
      if (!child || typeof child !== 'object') continue;
      const c = child as Record<string, unknown>;
      const ct = typeof c.type === 'string' ? c.type : '';
      if (ct === 'bulletList') {
        out += adfListToWiki(c.content as unknown[], '*', depth + 1);
      } else if (ct === 'orderedList') {
        out += adfListToWiki(c.content as unknown[], '#', depth + 1);
      } else {
        const text = adfToWikiMarkup(child).replace(/\n$/, '');
        out += `${prefix} ${text}\n`;
      }
    }
  }
  return out;
}

function adfTableToWiki(rows: unknown[]): string {
  if (!Array.isArray(rows)) return '';
  let out = '';
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    if (!Array.isArray(r.content)) continue;
    const cells: string[] = [];
    let isHeaderRow = false;
    for (const cell of r.content) {
      if (!cell || typeof cell !== 'object') continue;
      const c = cell as Record<string, unknown>;
      if (c.type === 'tableHeader') isHeaderRow = true;
      const text = adfToWikiMarkup(cell).replace(/\n$/, '').trim();
      cells.push(text);
    }
    const sep = isHeaderRow ? '||' : '|';
    out += `${sep}${cells.join(sep)}${sep}\n`;
  }
  return out;
}

/** Normalize description for editing (same as drawer `descriptionToEditableText`). */
export function normalizeDescriptionForEdit(description: unknown): string {
  if (!description) return '';
  if (typeof description === 'object') {
    return adfToWikiMarkup(description);
  }
  if (typeof description !== 'string') return '';
  const normalized = description.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (/^\s*</.test(normalized) || /<(?:p|div|br|table|ul|ol)\b/i.test(normalized)) {
    return stripHtmlForWikiParse(normalized);
  }
  return normalized;
}

/**
 * True when the TipTap wiki editor can load/save without falling back to raw textarea.
 */
export function canEditDescriptionRichly(text: string): boolean {
  if (!text || text.length > MAX_RICH_EDIT_CHARS) return false;

  // Unsupported macros / tokens for v1 import-export
  if (/\{color[:}]/i.test(text)) return false;
  if (/\[~(?:accountid:)?[^\]]+\]/.test(text)) return false;
  // Jira inline images !file.png|opts!
  if (/![^!\n]+(?:\|[^!\n]*)?!/.test(text)) return false;

  const segments = segmentJiraWikiTopLevel(text);
  for (const seg of segments) {
    if (seg.type === 'text') {
      // Unbalanced panel/noformat left as text by tokenizer
      if (/\{panel/i.test(seg.content) || /\{(?:noformat|norformat)/i.test(seg.content)) {
        return false;
      }
    }
    if (seg.type === 'panel') {
      // Nested panels in content — not supported in v1
      if (/\{panel/i.test(seg.content)) return false;
    }
  }

  return true;
}
