/** Helpers for Jira REST API v3 issue create (ADF description). */

// deno-lint-ignore no-explicit-any
export function isAdfDoc(v: unknown): v is Record<string, any> {
  return !!v && typeof v === 'object' && (v as Record<string, unknown>).type === 'doc';
}

/** Convert plain text (newlines → paragraphs) to minimal ADF. */
export function plainTextToAdf(text: string): Record<string, unknown> {
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

/**
 * Ensure value is ADF for v3 create. String descriptions (e.g. from older APIs) become paragraphs.
 */
export function coerceDescriptionToAdf(description: unknown): Record<string, unknown> {
  if (isAdfDoc(description)) {
    return JSON.parse(JSON.stringify(description)) as Record<string, unknown>;
  }
  if (typeof description === 'string' && description.trim()) {
    return plainTextToAdf(description);
  }
  return { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [] }] };
}

export function appendCloneFooterToAdf(
  adf: unknown,
  sourceKey: string,
  browseUrl: string,
): Record<string, unknown> {
  const doc = coerceDescriptionToAdf(adf);
  const arr = Array.isArray(doc.content) ? [...doc.content] : [];
  arr.push({
    type: 'paragraph',
    content: [{ type: 'text', text: `Cloned from ${sourceKey}`, marks: [{ type: 'strong' }] }],
  });
  arr.push({
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: browseUrl,
        marks: [{ type: 'link', attrs: { href: browseUrl } }],
      },
    ],
  });
  return { ...doc, content: arr };
}

export async function fetchJiraBoardLocationProjectKey(
  baseUrl: string,
  authHeaders: Record<string, string>,
  boardId: number,
): Promise<string | undefined> {
  try {
    const res = await fetch(`${baseUrl}/rest/agile/1.0/board/${boardId}`, { headers: authHeaders });
    if (!res.ok) return undefined;
    const data = await res.json();
    const loc = data?.location as { projectKey?: string; key?: string } | undefined;
    const pk = loc?.projectKey || loc?.key;
    return typeof pk === 'string' && pk.trim() ? pk.trim() : undefined;
  } catch (_) {
    return undefined;
  }
}

export function resolveTeamProjectKey(options: {
  jiraBoardId: string | null | undefined;
  jiraTicketPrefix: string | null | undefined;
  boardProjectKey?: string | null;
}): string | undefined {
  const trimmedBoard = (options.jiraBoardId || '').trim();
  const trimmedPrefix = (options.jiraTicketPrefix || '').trim();
  const boardIdNum = parseInt(trimmedBoard, 10);
  const isNumericBoard =
    trimmedBoard !== '' && !isNaN(boardIdNum) && String(boardIdNum) === trimmedBoard;
  if (isNumericBoard) {
    const fromBoard = options.boardProjectKey?.trim();
    if (fromBoard) return fromBoard;
    return trimmedPrefix || undefined;
  }
  if (trimmedBoard) return trimmedBoard;
  return trimmedPrefix || undefined;
}
