import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSupabaseProxyClient } from '../supabaseProxyClient';
import { getCSharpApiHeaders } from '@/config/environment';

// Mock fetch
global.fetch = vi.fn();

// Mock environment
vi.mock('@/config/environment', async () => {
  const actual = await vi.importActual('@/config/environment');
  return {
    ...actual,
    getApiBaseUrl: () => 'http://localhost:5228',
    getCSharpApiHeaders: vi.fn(() => ({
      'X-UseLocalAuth': 'true',
      'X-UseLocalPostgres': 'false',
      'X-DualPath': 'true',
    })),
  };
});

describe('Header Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
  });

  it('should include debug headers in query requests', async () => {
    const client = createSupabaseProxyClient('test-token');

    await client.from('test_table').select('*');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:5228/api/supabase/query/test_table'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'X-UseLocalAuth': 'true',
          'X-UseLocalPostgres': 'false',
          'X-DualPath': 'true',
        }),
      })
    );
  });

  it('should include debug headers in RPC requests', async () => {
    const client = createSupabaseProxyClient('test-token');

    await client.rpc('test_function', { param: 'value' });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:5228/api/supabase/rpc/test_function'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
          'X-UseSupabaseProxy': 'true',
          'X-UseLocalAuth': 'true',
          'X-UseLocalPostgres': 'false',
          'X-DualPath': 'true',
        }),
      })
    );
  });

  it('should include debug headers in function invocations', async () => {
    const client = createSupabaseProxyClient('test-token');

    await client.functions.invoke('test-function', { body: { data: 'value' } });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:5228/api/supabase/functions/test-function'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
          'X-UseLocalAuth': 'true',
          'X-UseLocalPostgres': 'false',
          'X-DualPath': 'true',
        }),
      })
    );
  });
});
