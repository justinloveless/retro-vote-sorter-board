/**
 * Merge Jira issue description after a split create: preserve post-create automation ADF
 * when present, otherwise replace with the user-approved body. Optional parent key footer.
 */

function isAdfDoc(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && (v as Record<string, unknown>).type === 'doc';
}

function plainTextToAdf(text: string): Record<string, unknown> {
  const normalized = (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const content = lines.map((line) => ({
    type: 'paragraph',
    content: line.length ? [{ type: 'text', text: line }] : [],
  }));
  if (content.length === 0) {
    return { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [] }] };
  }
  return { type: 'doc', version: 1, content };
}

function coerceDescriptionToAdf(description: unknown): Record<string, unknown> {
  if (isAdfDoc(description)) {
    return JSON.parse(JSON.stringify(description)) as Record<string, unknown>;
  }
  if (typeof description === 'string' && description.trim()) {
    return plainTextToAdf(description);
  }
  return { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [] }] };
}

function accumulateSubstance(node: unknown, acc: { textLen: number; hasMedia: boolean }): void {
  if (!node || typeof node !== 'object') return;
  const o = node as Record<string, unknown>;
  if (o.type === 'text' && typeof o.text === 'string') {
    acc.textLen += o.text.trim().length;
  }
  if (o.type === 'media' || o.type === 'mediaSingle' || o.type === 'embedCard') {
    acc.hasMedia = true;
  }
  if (Array.isArray(o.content)) {
    for (const c of o.content) accumulateSubstance(c, acc);
  }
}

/** True when automation/template likely filled the description (text or embedded media). */
export function adfDescriptionIsSubstantive(postCreateDescription: unknown): boolean {
  const doc = coerceDescriptionToAdf(postCreateDescription);
  const acc = { textLen: 0, hasMedia: false };
  accumulateSubstance(doc, acc);
  return acc.textLen > 0 || acc.hasMedia;
}

function splitFromFooterParagraph(parentKey: string): Record<string, unknown> {
  return {
    type: 'paragraph',
    content: [
      { type: 'text', text: `Split from ${parentKey.trim()}`, marks: [{ type: 'em' }] },
    ],
  };
}

/**
 * @param postCreateDescription - `fields.description` from get-jira-issue-v3
 * @param userDescription - edited body from preview: ADF object (from advisor) or plain text string
 * @param parentKey - parent ticket key for a single footer line
 */
export function mergeSplitDescriptionAfterCreate(
  postCreateDescription: unknown,
  userDescription: string | Record<string, unknown>,
  parentKey?: string | null,
): Record<string, unknown> {
  const doc = coerceDescriptionToAdf(postCreateDescription);
  const substantive = adfDescriptionIsSubstantive(doc);
  const userDoc = isAdfDoc(userDescription)
    ? (JSON.parse(JSON.stringify(userDescription)) as Record<string, unknown>)
    : plainTextToAdf(typeof userDescription === 'string' ? userDescription : '');
  const userBlocks = Array.isArray(userDoc.content) ? userDoc.content : [];
  const footer =
    parentKey && parentKey.trim() ? [splitFromFooterParagraph(parentKey)] : [];

  if (substantive) {
    const base = Array.isArray(doc.content) ? [...doc.content] : [];
    base.push({ type: 'rule' });
    base.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Split details' }],
    });
    base.push(...userBlocks);
    base.push(...footer);
    return { ...doc, content: base };
  }

  const arr = Array.isArray(userDoc.content) ? [...userDoc.content] : [];
  arr.push(...footer);
  return { ...userDoc, content: arr };
}
