import { coalesceAdviceSplits, type PokerAdvisorResponse } from '@/lib/pokerLocalAdvisor';

const TTL_MS = 10 * 60 * 1000;
const STORAGE_PREFIX = 'pokerAdvisor:advice:v1:';

const store = new Map<string, { storedAt: number; advice: PokerAdvisorResponse }>();
const inFlight = new Map<
  string,
  Promise<{
    advice: PokerAdvisorResponse;
    receivedAt: number;
  }>
>();

export type CachedAdviceEntry = { advice: PokerAdvisorResponse; receivedAt: number };

function storageKey(cacheKey: string): string {
  return `${STORAGE_PREFIX}${cacheKey}`;
}

function readFromLocalStorage(cacheKey: string): { storedAt: number; advice: PokerAdvisorResponse } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(cacheKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const o = parsed as Record<string, unknown>;
    const storedAt = typeof o.storedAt === 'number' ? o.storedAt : NaN;
    const advice = o.advice as PokerAdvisorResponse | undefined;
    if (!Number.isFinite(storedAt) || !advice || typeof advice !== 'object') return null;
    return { storedAt, advice };
  } catch {
    return null;
  }
}

function writeToLocalStorage(cacheKey: string, row: { storedAt: number; advice: PokerAdvisorResponse }): void {
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

export function getCachedAdviceForTicket(cacheKey: string): CachedAdviceEntry | null {
  if (!cacheKey || cacheKey === '—') return null;
  let row = store.get(cacheKey);
  if (!row) {
    const persisted = readFromLocalStorage(cacheKey);
    if (persisted) {
      store.set(cacheKey, { storedAt: persisted.storedAt, advice: { ...persisted.advice } });
      row = store.get(cacheKey);
    }
  }
  if (!row) return null;
  if (Date.now() - row.storedAt > TTL_MS) {
    store.delete(cacheKey);
    deleteFromLocalStorage(cacheKey);
    return null;
  }
  return { advice: coalesceAdviceSplits({ ...row.advice }), receivedAt: row.storedAt };
}

export function setCachedAdviceForTicket(cacheKey: string, advice: PokerAdvisorResponse, receivedAtMs?: number): void {
  if (!cacheKey || cacheKey === '—') return;
  const storedAt = receivedAtMs ?? Date.now();
  const row = { storedAt, advice: { ...advice } };
  store.set(cacheKey, row);
  writeToLocalStorage(cacheKey, row);
}

export function invalidateAdviceCacheForTicket(scope: { cacheKeyPrefix: string; exactCacheKey: string }): void {
  const { cacheKeyPrefix, exactCacheKey } = scope;
  if (!exactCacheKey || exactCacheKey === '—') return;
  // Delete exact key plus any Q&A-scoped composite keys for this ticket within the same scope.
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

export function getInFlightAdviceForTicket(
  cacheKey: string,
): Promise<{ advice: PokerAdvisorResponse; receivedAt: number }> | null {
  if (!cacheKey || cacheKey === '—') return null;
  return inFlight.get(cacheKey) ?? null;
}

export function setInFlightAdviceForTicket(
  cacheKey: string,
  promise: Promise<{ advice: PokerAdvisorResponse; receivedAt: number }>,
): void {
  if (!cacheKey || cacheKey === '—') return;
  inFlight.set(cacheKey, promise);
  // Only clear if this exact promise is still the current inflight entry.
  void promise.finally(() => {
    if (inFlight.get(cacheKey) === promise) inFlight.delete(cacheKey);
  });
}
