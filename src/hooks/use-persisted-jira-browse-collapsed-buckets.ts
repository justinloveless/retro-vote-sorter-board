import { useEffect, useState } from 'react';

const STORAGE_PREFIX = 'neotro-jira-browse-collapsed-buckets';

function readCollapsedBuckets(teamId: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}:${teamId}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

/**
 * Persists which Browse Jira sprint buckets are collapsed (per team) across reloads.
 */
export function usePersistedJiraBrowseCollapsedBuckets(teamId: string | undefined) {
  const [collapsedBuckets, setCollapsedBuckets] = useState<Set<string>>(() =>
    teamId ? readCollapsedBuckets(teamId) : new Set()
  );

  useEffect(() => {
    if (!teamId) return;
    try {
      localStorage.setItem(`${STORAGE_PREFIX}:${teamId}`, JSON.stringify([...collapsedBuckets]));
    } catch {
      /* quota / private mode */
    }
  }, [teamId, collapsedBuckets]);

  return [collapsedBuckets, setCollapsedBuckets] as const;
}
