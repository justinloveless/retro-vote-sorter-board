/**
 * Supabase Functions-compatible client for self-hosted Node ports (DUN-79).
 * Talks to Node `/functions/v1/:name`.
 */

export type AccessTokenProvider = () => string | null | Promise<string | null>;

export interface FunctionsError {
  message: string;
  context?: Response;
}

export interface FunctionsResponse<T = unknown> {
  data: T | null;
  error: FunctionsError | null;
}

export interface InvokeOptions {
  body?: unknown;
  headers?: Record<string, string>;
  method?: 'POST' | 'GET';
}

export class SelfHostedFunctionsClient {
  constructor(
    private readonly apiBaseUrl: string,
    private readonly getAccessToken: AccessTokenProvider
  ) {}

  async invoke<T = unknown>(
    functionName: string,
    options?: InvokeOptions
  ): Promise<FunctionsResponse<T>> {
    try {
      const token = await this.getAccessToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const base = this.apiBaseUrl.replace(/\/$/, '');
      const response = await fetch(`${base}/functions/v1/${functionName}`, {
        method: options?.method || 'POST',
        headers,
        body:
          options?.method === 'GET'
            ? undefined
            : JSON.stringify(options?.body ?? {}),
      });

      const text = await response.text();
      let parsed: unknown = null;
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
      }

      if (!response.ok) {
        const message =
          parsed &&
          typeof parsed === 'object' &&
          parsed !== null &&
          'error' in parsed
            ? String((parsed as { error: unknown }).error)
            : text || `Function ${functionName} failed (${response.status})`;
        return {
          data: null,
          error: { message, context: response },
        };
      }

      return { data: parsed as T, error: null };
    } catch (error) {
      return {
        data: null,
        error: {
          message:
            error instanceof Error ? error.message : `Function ${functionName} failed`,
        },
      };
    }
  }
}

export function createFunctionsClient(
  apiBaseUrl: string,
  getAccessToken: AccessTokenProvider
): SelfHostedFunctionsClient {
  return new SelfHostedFunctionsClient(apiBaseUrl, getAccessToken);
}
