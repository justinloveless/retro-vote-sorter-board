const TTL_MS = 10 * 60 * 1000;
const STORAGE_PREFIX = 'pokerAdvisor:splitDetails:v1:';

export type CachedSplitDetailsBody = { summary: string; description: string | Record<string, unknown> };

const store = new Map<string, { storedAt: number; summary: string; description: string | Record<string, unknown> }>();

function fingerprintForSplit(title: string, points: number | null | undefined): string {
  const s = JSON.stringify({ t: (title || '').trim(), p: points ?? null });
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

/** Logical key: same scope as advice (`cacheKeyFull`) + split fingerprint. */
export function splitDetailsLogicalKey(
  cacheKeyFull: string,
  splitTitle: string,
  splitPoints: number | null | undefined,
): string {
  return `${cacheKeyFull}|s|${fingerprintForSplit(splitTitle, splitPoints)}`;
}

function storageKey(logicalKey: string): string {
  return `${STORAGE_PREFIX}${logicalKey}`;
}

function readFromLocalStorage(logicalKey: string): { storedAt: number; summary: string; description: unknown } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(logicalKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const o = parsed as Record<string, unknown>;
    const storedAt = typeof o.storedAt === 'number' ? o.storedAt : NaN;
    const summary = typeof o.summary === 'string' ? o.summary : '';
    const description = o.description;
    if (!Number.isFinite(storedAt) || !summary) return null;
    return { storedAt, summary, description };
  } catch {
    return null;
  }
}

function writeToLocalStorage(
  logicalKey: string,
  row: { storedAt: number; summary: string; description: string | Record<string, unknown> },
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(logicalKey), JSON.stringify(row));
  } catch {
    /* quota / private mode */
  }
}

function deleteFromLocalStorage(logicalKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(storageKey(logicalKey));
  } catch {
    /* ignore */
  }
}

function normalizeDescriptionFromStorage(raw: unknown): string | Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object' && raw !== null) return raw as Record<string, unknown>;
  return null;
}

export function getCachedSplitDetails(
  cacheKeyFull: string,
  splitTitle: string,
  splitPoints: number | null | undefined,
): CachedSplitDetailsBody | null {
  if (!cacheKeyFull || cacheKeyFull === '—') return null;
  const logicalKey = splitDetailsLogicalKey(cacheKeyFull, splitTitle, splitPoints);
  let row = store.get(logicalKey);
  if (!row) {
    const persisted = readFromLocalStorage(logicalKey);
    if (persisted) {
      const description = normalizeDescriptionFromStorage(persisted.description);
      if (description != null) {
        row = { storedAt: persisted.storedAt, summary: persisted.summary, description };
        store.set(logicalKey, row);
      }
    }
  }
  if (!row) return null;
  if (Date.now() - row.storedAt > TTL_MS) {
    store.delete(logicalKey);
    deleteFromLocalStorage(logicalKey);
    return null;
  }
  return { summary: row.summary, description: row.description };
}

export function setCachedSplitDetails(
  cacheKeyFull: string,
  splitTitle: string,
  splitPoints: number | null | undefined,
  body: CachedSplitDetailsBody,
  storedAtMs?: number,
): void {
  if (!cacheKeyFull || cacheKeyFull === '—') return;
  const logicalKey = splitDetailsLogicalKey(cacheKeyFull, splitTitle, splitPoints);
  const storedAt = storedAtMs ?? Date.now();
  const row = { storedAt, summary: body.summary, description: body.description };
  store.set(logicalKey, row);
  writeToLocalStorage(logicalKey, row);
}

function logicalKeyMatchesScope(logicalKey: string, exactCacheKey: string, cacheKeyPrefix: string): boolean {
  if (logicalKey.startsWith(`${exactCacheKey}|s|`)) return true;
  if (logicalKey.startsWith(cacheKeyPrefix) && logicalKey.includes('|s|')) return true;
  return false;
}

/** Clears split-details entries for the same ticket scope as advice cache invalidation. */
export function invalidateSplitDetailsCacheForTicket(scope: { cacheKeyPrefix: string; exactCacheKey: string }): void {
  const { cacheKeyPrefix, exactCacheKey } = scope;
  if (!exactCacheKey || exactCacheKey === '—') return;

  for (const k of [...store.keys()]) {
    if (logicalKeyMatchesScope(k, exactCacheKey, cacheKeyPrefix)) {
      store.delete(k);
      deleteFromLocalStorage(k);
    }
  }

  if (typeof window === 'undefined') return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const fullKey = localStorage.key(i);
      if (!fullKey || !fullKey.startsWith(STORAGE_PREFIX)) continue;
      const logicalKey = fullKey.slice(STORAGE_PREFIX.length);
      if (logicalKeyMatchesScope(logicalKey, exactCacheKey, cacheKeyPrefix)) {
        toRemove.push(fullKey);
      }
    }
    for (const fullKey of toRemove) {
      localStorage.removeItem(fullKey);
    }
  } catch {
    /* ignore */
  }
}
