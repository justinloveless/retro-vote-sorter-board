import type { PokerAdvisorContextResponse } from '@/lib/pokerLocalAdvisor';

const TTL_MS = 10 * 60 * 1000;
const STORAGE_PREFIX = 'pokerAdvisor:context:v1:';

const store = new Map<string, { storedAt: number; context: PokerAdvisorContextResponse }>();
const inFlight = new Map<
  string,
  Promise<{
    context: PokerAdvisorContextResponse;
    receivedAt: number;
  }>
>();

export type CachedContextEntry = { context: PokerAdvisorContextResponse; receivedAt: number };

function storageKey(cacheKey: string): string {
  return `${STORAGE_PREFIX}${cacheKey}`;
}

function readFromLocalStorage(cacheKey: string): { storedAt: number; context: PokerAdvisorContextResponse } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(cacheKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const o = parsed as Record<string, unknown>;
    const storedAt = typeof o.storedAt === 'number' ? o.storedAt : NaN;
    const context = o.context as PokerAdvisorContextResponse | undefined;
    if (!Number.isFinite(storedAt) || !context || typeof context !== 'object') return null;
    return { storedAt, context };
  } catch {
    return null;
  }
}

function writeToLocalStorage(cacheKey: string, row: { storedAt: number; context: PokerAdvisorContextResponse }): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(cacheKey), JSON.stringify(row));
  } catch {
    /* quota / private mode */
  }
}

function deleteFromLocalStorage(cacheKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(storageKey(cacheKey));
  } catch {
    /* quota / private mode */
  }
}

export function getCachedContextForTicket(cacheKey: string): CachedContextEntry | null {
  if (!cacheKey || cacheKey === '—') return null;
  let row = store.get(cacheKey);
  if (!row) {
    const persisted = readFromLocalStorage(cacheKey);
    if (persisted) {
      store.set(cacheKey, { storedAt: persisted.storedAt, context: { ...persisted.context } });
      row = store.get(cacheKey);
    }
  }
  if (!row) return null;
  if (Date.now() - row.storedAt > TTL_MS) {
    store.delete(cacheKey);
    deleteFromLocalStorage(cacheKey);
    return null;
  }
  return { context: { ...row.context }, receivedAt: row.storedAt };
}

export function setCachedContextForTicket(
  cacheKey: string,
  context: PokerAdvisorContextResponse,
  receivedAtMs?: number,
): void {
  if (!cacheKey || cacheKey === '—') return;
  const storedAt = receivedAtMs ?? Date.now();
  const row = { storedAt, context: { ...context } };
  store.set(cacheKey, row);
  writeToLocalStorage(cacheKey, row);
}

export function invalidateContextCacheForTicket(scope: { cacheKeyPrefix: string; exactCacheKey: string }): void {
  const { cacheKeyPrefix, exactCacheKey } = scope;
  if (!exactCacheKey || exactCacheKey === '—') return;
  store.delete(exactCacheKey);
  deleteFromLocalStorage(exactCacheKey);
  for (const k of store.keys()) {
    if (k.startsWith(cacheKeyPrefix)) {
      store.delete(k);
      deleteFromLocalStorage(k);
    }
  }
  for (const k of inFlight.keys()) {
    if (k === exactCacheKey || k.startsWith(cacheKeyPrefix)) inFlight.delete(k);
  }
}

export function getInFlightContextForTicket(
  cacheKey: string,
): Promise<{ context: PokerAdvisorContextResponse; receivedAt: number }> | null {
  if (!cacheKey || cacheKey === '—') return null;
  return inFlight.get(cacheKey) ?? null;
}

export function setInFlightContextForTicket(
  cacheKey: string,
  promise: Promise<{ context: PokerAdvisorContextResponse; receivedAt: number }>,
): void {
  if (!cacheKey || cacheKey === '—') return;
  inFlight.set(cacheKey, promise);
  void promise.finally(() => {
    if (inFlight.get(cacheKey) === promise) inFlight.delete(cacheKey);
  });
}

