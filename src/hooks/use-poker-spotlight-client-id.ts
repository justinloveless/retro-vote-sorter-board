import { useState } from 'react';

const STORAGE_KEY = 'poker_spotlight_client_id';

function readOrCreateClientId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = sessionStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

/** Stable per browser tab/window id for poker spotlight ownership. */
export function usePokerSpotlightClientId(): string {
  const [id] = useState(readOrCreateClientId);
  return id;
}
