import { useCallback, useState } from 'react';
import {
  normalizeUpdateCheckUrl,
  normalizeUpdateUrl,
  type PokerAdvisorUpdateCheckResult,
  type PokerAdvisorUpdateInstallResult,
  type PokerLocalAdvisorUpdateChannel,
} from '@/lib/pokerLocalAdvisor';

async function readJsonError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    if (typeof j.error === 'string' && j.error.trim()) return j.error.trim();
  } catch {
    /* ignore */
  }
  return res.statusText || `HTTP ${res.status}`;
}

export function usePokerLocalAdvisorSelfUpdate(baseUrl: string) {
  const [channel, setChannel] = useState<PokerLocalAdvisorUpdateChannel>('stable');
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [checkResult, setCheckResult] = useState<PokerAdvisorUpdateCheckResult | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const check = useCallback(async () => {
    const trimmed = baseUrl.trim();
    if (!trimmed) {
      setLastError('Enter a local server URL first.');
      return null;
    }
    setChecking(true);
    setLastError(null);
    try {
      const res = await fetch(normalizeUpdateCheckUrl(trimmed), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel }),
      });
      if (!res.ok) {
        throw new Error(await readJsonError(res));
      }
      const data = (await res.json()) as PokerAdvisorUpdateCheckResult;
      setCheckResult(data);
      return data;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Update check failed';
      setLastError(msg);
      setCheckResult(null);
      return null;
    } finally {
      setChecking(false);
    }
  }, [baseUrl, channel]);

  const install = useCallback(async (): Promise<PokerAdvisorUpdateInstallResult | null> => {
    const trimmed = baseUrl.trim();
    if (!trimmed) {
      setLastError('Enter a local server URL first.');
      return null;
    }
    setInstalling(true);
    setLastError(null);
    try {
      const res = await fetch(normalizeUpdateUrl(trimmed), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel }),
      });
      const data = (await res.json()) as PokerAdvisorUpdateInstallResult & { error?: string };
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : await readJsonError(res));
      }
      if (!data.ok) {
        throw new Error('Unexpected response from local advisor');
      }
      setCheckResult((prev) =>
        prev
          ? {
              ...prev,
              currentVersion: data.newVersion ?? prev.currentVersion,
              remoteVersion: data.newVersion ?? prev.remoteVersion,
              updateAvailable: false,
            }
          : null,
      );
      return data;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Update failed';
      setLastError(msg);
      return null;
    } finally {
      setInstalling(false);
    }
  }, [baseUrl, channel]);

  return {
    channel,
    setChannel,
    checking,
    installing,
    checkResult,
    lastError,
    clearError: () => setLastError(null),
    check,
    install,
  };
}
