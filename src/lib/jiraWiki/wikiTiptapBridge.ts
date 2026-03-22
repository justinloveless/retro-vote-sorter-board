import type { JSONContent } from '@tiptap/core';
import { segmentJiraWikiTopLevel } from './segmentWiki';
import { wikiTextSegmentToBlocks, blockToWikiSegment } from './wikiBlock';

/** Jira wiki (common subset) → TipTap document JSON. */
export function wikiCommonToTiptapJSON(wiki: string): JSONContent {
  const normalized = wiki.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const segments = segmentJiraWikiTopLevel(normalized);
  const content: JSONContent[] = [];

  for (const seg of segments) {
    if (seg.type === 'text') {
      content.push(...wikiTextSegmentToBlocks(seg.content));
    } else if (seg.type === 'code') {
      const raw = seg.content.replace(/^\n/, '');
      content.push({
        type: 'codeBlock',
        attrs: { jiraNoformatAttrs: seg.attrs || '' },
        content: raw ? [{ type: 'text', text: raw }] : undefined,
      });
    } else if (seg.type === 'panel') {
      const inner = wikiTextSegmentToBlocks(seg.content);
      const panelAttrs = seg.attrs || '';
      content.push({
        type: 'jiraPanel',
        attrs: { panelAttrs },
        content: inner.length ? inner : [{ type: 'paragraph' }],
      });
    }
  }

  if (content.length === 0) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }
  return { type: 'doc', content };
}

/** TipTap document JSON → Jira wiki string. */
export function tiptapJSONToWikiCommon(doc: JSONContent): string {
  if (doc.type !== 'doc' || !doc.content) return '';
  return doc.content.map((c) => blockToWikiSegment(c)).join('');
}
