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

/** Normalize description for editing (same as drawer `descriptionToEditableText`). */
export function normalizeDescriptionForEdit(description: string | null): string {
  if (!description) return '';
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
