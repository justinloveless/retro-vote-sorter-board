import { useEffect, useState } from 'react';

/** Global (per browser profile) — not scoped to team or session. */
const VISIBILITY_KEY = 'neotro-poker-panel-visibility';
const WIDTH_KEY_PREFIX = 'neotro-panel-width';

export type NeotroPokerPanelVisibility = { chat: boolean; jiraBrowser: boolean };

const DEFAULT_VISIBILITY: NeotroPokerPanelVisibility = { chat: true, jiraBrowser: true };

export const DEFAULT_NEOTRO_PANEL_WIDTH = 320;
export const MIN_NEOTRO_PANEL_WIDTH = 240;
export const MAX_NEOTRO_PANEL_WIDTH = 480;

function readVisibility(): NeotroPokerPanelVisibility {
  if (typeof window === 'undefined') return { ...DEFAULT_VISIBILITY };
  try {
    const raw = localStorage.getItem(VISIBILITY_KEY);
    if (!raw) return { ...DEFAULT_VISIBILITY };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_VISIBILITY };
    const o = parsed as Record<string, unknown>;
    const chat = typeof o.chat === 'boolean' ? o.chat : DEFAULT_VISIBILITY.chat;
    const jiraBrowser = typeof o.jiraBrowser === 'boolean' ? o.jiraBrowser : DEFAULT_VISIBILITY.jiraBrowser;
    return { chat, jiraBrowser };
  } catch {
    return { ...DEFAULT_VISIBILITY };
  }
}

function readWidth(side: 'left' | 'right'): number {
  if (typeof window === 'undefined') return DEFAULT_NEOTRO_PANEL_WIDTH;
  try {
    const stored = localStorage.getItem(`${WIDTH_KEY_PREFIX}-${side}`);
    if (!stored) return DEFAULT_NEOTRO_PANEL_WIDTH;
    const n = Number(stored);
    if (!Number.isFinite(n)) return DEFAULT_NEOTRO_PANEL_WIDTH;
    return Math.min(MAX_NEOTRO_PANEL_WIDTH, Math.max(MIN_NEOTRO_PANEL_WIDTH, n));
  } catch {
    return DEFAULT_NEOTRO_PANEL_WIDTH;
  }
}

export function writePanelWidth(side: 'left' | 'right', width: number) {
  try {
    localStorage.setItem(`${WIDTH_KEY_PREFIX}-${side}`, String(width));
  } catch {
    /* quota / private mode */
  }
}

/**
 * Collapsed/expanded state for desktop Jira browser + chat side panels.
 * Persists in localStorage for this browser — same across teams and poker sessions.
 */
export function usePersistedNeotroPokerPanelVisibility() {
  const [panelVisibility, setPanelVisibility] = useState<NeotroPokerPanelVisibility>(() => readVisibility());

  useEffect(() => {
    try {
      localStorage.setItem(VISIBILITY_KEY, JSON.stringify(panelVisibility));
    } catch {
      /* quota / private mode */
    }
  }, [panelVisibility]);

  return [panelVisibility, setPanelVisibility] as const;
}

/** Left/right resizable panel width state, initialized from localStorage. */
export function useNeotroPanelWidth(side: 'left' | 'right') {
  return useState(() => readWidth(side));
}
