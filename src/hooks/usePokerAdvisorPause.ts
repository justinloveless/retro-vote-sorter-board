import { useCallback, useEffect, useState } from 'react';

export const POKER_ADVISOR_PAUSED_STORAGE_KEY = 'poker_local_advisor_paused';

function readPaused(): boolean {
  try {
    return localStorage.getItem(POKER_ADVISOR_PAUSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Browser-local pause for local advisor HTTP calls (no server round-trips while paused).
 */
export function usePokerAdvisorPause() {
  const [paused, setPausedState] = useState(readPaused);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key != null && e.key !== POKER_ADVISOR_PAUSED_STORAGE_KEY) return;
      setPausedState(readPaused());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setPaused = useCallback((next: boolean) => {
    setPausedState(next);
    try {
      if (next) {
        localStorage.setItem(POKER_ADVISOR_PAUSED_STORAGE_KEY, '1');
      } else {
        localStorage.removeItem(POKER_ADVISOR_PAUSED_STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  return { paused, setPaused };
}
