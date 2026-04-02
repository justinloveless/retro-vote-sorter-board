import { useCallback, useEffect, useState } from 'react';

export const POKER_ADVISOR_ESTIMATE_SOURCE_STORAGE_KEY = 'poker_local_advisor_estimate_source';

export type PokerAdvisorEstimateSource = 'description' | 'context';

function readEstimateSource(): PokerAdvisorEstimateSource {
  try {
    const v = localStorage.getItem(POKER_ADVISOR_ESTIMATE_SOURCE_STORAGE_KEY);
    if (v === 'context' || v === 'description') return v;
    return 'description';
  } catch {
    return 'description';
  }
}

export function usePokerAdvisorEstimateSource() {
  const [estimateSource, setEstimateSourceState] = useState<PokerAdvisorEstimateSource>(readEstimateSource);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key != null && e.key !== POKER_ADVISOR_ESTIMATE_SOURCE_STORAGE_KEY) return;
      setEstimateSourceState(readEstimateSource());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setEstimateSource = useCallback((next: PokerAdvisorEstimateSource) => {
    setEstimateSourceState(next);
    try {
      localStorage.setItem(POKER_ADVISOR_ESTIMATE_SOURCE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  return { estimateSource, setEstimateSource };
}

