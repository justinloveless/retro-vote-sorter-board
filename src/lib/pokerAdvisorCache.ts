import type { PokerAdvisorResponse } from '@/lib/pokerLocalAdvisor';

const TTL_MS = 10 * 60 * 1000;

const store = new Map<string, { storedAt: number; advice: PokerAdvisorResponse }>();
const inFlight = new Map<
  string,
  Promise<{
    advice: PokerAdvisorResponse;
    receivedAt: number;
  }>
>();

export type CachedAdviceEntry = { advice: PokerAdvisorResponse; receivedAt: number };

export function getCachedAdviceForTicket(ticketKey: string): CachedAdviceEntry | null {
  if (!ticketKey || ticketKey === '—') return null;
  const row = store.get(ticketKey);
  if (!row) return null;
  if (Date.now() - row.storedAt > TTL_MS) {
    store.delete(ticketKey);
    return null;
  }
  return { advice: { ...row.advice }, receivedAt: row.storedAt };
}

export function setCachedAdviceForTicket(ticketKey: string, advice: PokerAdvisorResponse, receivedAtMs?: number): void {
  if (!ticketKey || ticketKey === '—') return;
  const storedAt = receivedAtMs ?? Date.now();
  store.set(ticketKey, { storedAt, advice: { ...advice } });
}

export function invalidateAdviceCacheForTicket(ticketKey: string): void {
  if (!ticketKey || ticketKey === '—') return;
  store.delete(ticketKey);
}

export function getInFlightAdviceForTicket(
  ticketKey: string,
): Promise<{ advice: PokerAdvisorResponse; receivedAt: number }> | null {
  if (!ticketKey || ticketKey === '—') return null;
  return inFlight.get(ticketKey) ?? null;
}

export function setInFlightAdviceForTicket(
  ticketKey: string,
  promise: Promise<{ advice: PokerAdvisorResponse; receivedAt: number }>,
): void {
  if (!ticketKey || ticketKey === '—') return;
  inFlight.set(ticketKey, promise);
  // Only clear if this exact promise is still the current inflight entry.
  void promise.finally(() => {
    if (inFlight.get(ticketKey) === promise) inFlight.delete(ticketKey);
  });
}
