import { useCallback, useEffect, useState } from 'react';

export const POKER_ADVISOR_PREFETCH_ACTIVE_STORAGE_KEY = 'poker_local_advisor_prefetch_active_tickets';

function readPrefetchActiveTickets(): boolean {
  try {
    // Default on to preserve existing behavior.
    const v = localStorage.getItem(POKER_ADVISOR_PREFETCH_ACTIVE_STORAGE_KEY);
    if (v == null) return true;
    return v === '1';
  } catch {
    return true;
  }
}

/**
 * Browser-local setting for whether the local advisor should prefetch all active tickets
 * (vs only run for the currently viewed ticket).
 */
export function usePokerAdvisorPrefetch() {
  const [prefetchActiveTickets, setPrefetchActiveTicketsState] = useState(readPrefetchActiveTickets);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key != null && e.key !== POKER_ADVISOR_PREFETCH_ACTIVE_STORAGE_KEY) return;
      setPrefetchActiveTicketsState(readPrefetchActiveTickets());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setPrefetchActiveTickets = useCallback((next: boolean) => {
    setPrefetchActiveTicketsState(next);
    try {
      localStorage.setItem(POKER_ADVISOR_PREFETCH_ACTIVE_STORAGE_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  return { prefetchActiveTickets, setPrefetchActiveTickets };
}

