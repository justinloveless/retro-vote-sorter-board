import type { PokerAdvisorResponse } from '@/lib/pokerLocalAdvisor';

const TTL_MS = 10 * 60 * 1000;

const store = new Map<string, { storedAt: number; advice: PokerAdvisorResponse }>();

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
