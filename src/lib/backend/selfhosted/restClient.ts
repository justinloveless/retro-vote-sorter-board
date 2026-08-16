/**
 * Supabase-compatible PostgREST fluent client for self-hosted mode (DUN-78).
 * Talks to Node `/rest/v1/*` which proxies to Coolify-internal PostgREST.
 */

export interface RestError {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}

export interface RestResponse<T> {
  data: T | null;
  error: RestError | null;
  count?: number | null;
  status?: number;
  statusText?: string;
}

type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'ilike'
  | 'is'
  | 'in'
  | 'cs'
  | 'cd'
  | 'ov'
  | 'sl'
  | 'sr'
  | 'nxl'
  | 'nxr'
  | 'adj';

type SelectOptions = {
  count?: 'exact' | 'planned' | 'estimated';
  head?: boolean;
};

type MutationOptions = {
  count?: 'exact' | 'planned' | 'estimated';
  defaultToNull?: boolean;
};

export type AccessTokenProvider = () => string | null | Promise<string | null>;

function encodeFilterValue(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

/**
 * PostgREST's select parser rejects whitespace inside embeds
 * (PGRST100: unexpected ")" expecting ","). Collapse template-literal
 * selects like `*, teams( id, name )` → `*,teams(id,name)`.
 */
export function normalizePostgrestSelect(columns: string): string {
  return columns
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*\(\s*/g, '(')
    .replace(/\s*\)\s*/g, ')')
    .replace(/\s*,\s*/g, ',');
}

export class RestQueryBuilder<T = unknown> {
  private queryParams: Map<string, string> = new Map();
  private headers: Record<string, string> = {};
  private method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'HEAD' = 'GET';
  private bodyData: unknown = null;
  private shouldReturnSingle = false;
  private shouldReturnMaybeSingle = false;
  private wantCount: SelectOptions['count'] | undefined;
  private headOnly = false;
  private onConflict: string | undefined;

  constructor(
    private tableName: string,
    private apiBaseUrl: string,
    private getAccessToken: AccessTokenProvider
  ) {}

  select(columns: string = '*', options?: SelectOptions): this {
    const cleanColumns = normalizePostgrestSelect(columns);
    this.queryParams.set('select', cleanColumns);
    if (options?.count) {
      this.wantCount = options.count;
      this.appendPrefer(`count=${options.count}`);
    }
    if (options?.head) {
      this.headOnly = true;
      this.method = 'HEAD';
    }
    // When select follows a mutation, ask PostgREST for representation
    if (this.method === 'POST' || this.method === 'PATCH' || this.method === 'PUT' || this.method === 'DELETE') {
      this.appendPrefer('return=representation');
      if (this.method !== 'DELETE' && this.headOnly) {
        // head+mutation is unusual; keep method
        this.headOnly = false;
      }
    }
    return this;
  }

  eq(column: string, value: unknown): this {
    return this.filter(column, 'eq', value);
  }

  neq(column: string, value: unknown): this {
    return this.filter(column, 'neq', value);
  }

  gt(column: string, value: unknown): this {
    return this.filter(column, 'gt', value);
  }

  gte(column: string, value: unknown): this {
    return this.filter(column, 'gte', value);
  }

  lt(column: string, value: unknown): this {
    return this.filter(column, 'lt', value);
  }

  lte(column: string, value: unknown): this {
    return this.filter(column, 'lte', value);
  }

  like(column: string, pattern: string): this {
    return this.filter(column, 'like', pattern);
  }

  ilike(column: string, pattern: string): this {
    return this.filter(column, 'ilike', pattern);
  }

  is(column: string, value: boolean | null): this {
    return this.filter(column, 'is', value);
  }

  in(column: string, values: unknown[]): this {
    const formattedValues = `(${values
      .map((v) => (typeof v === 'string' ? `"${v}"` : encodeFilterValue(v)))
      .join(',')})`;
    return this.filter(column, 'in', formattedValues);
  }

  contains(column: string, value: unknown): this {
    return this.filter(column, 'cs', JSON.stringify(value));
  }

  containedBy(column: string, value: unknown): this {
    return this.filter(column, 'cd', JSON.stringify(value));
  }

  filter(column: string, operator: FilterOperator | string, value: unknown): this {
    this.queryParams.set(column, `${operator}.${encodeFilterValue(value)}`);
    return this;
  }

  or(filters: string): this {
    this.queryParams.set('or', `(${filters})`);
    return this;
  }

  not(column: string, operator: FilterOperator | string, value: unknown): this {
    this.queryParams.set(column, `not.${operator}.${encodeFilterValue(value)}`);
    return this;
  }

  match(query: Record<string, unknown>): this {
    for (const [column, value] of Object.entries(query)) {
      this.eq(column, value);
    }
    return this;
  }

  order(
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean; foreignTable?: string }
  ): this {
    const { ascending = true, nullsFirst, foreignTable } = options || {};
    const direction = ascending ? 'asc' : 'desc';
    const nullsOrder =
      nullsFirst !== undefined ? (nullsFirst ? '.nullsfirst' : '.nullslast') : '';
    const orderValue = `${column}.${direction}${nullsOrder}`;

    if (foreignTable) {
      this.queryParams.set(`${foreignTable}.order`, orderValue);
    } else {
      const existing = this.queryParams.get('order');
      this.queryParams.set('order', existing ? `${existing},${orderValue}` : orderValue);
    }
    return this;
  }

  limit(count: number, options?: { foreignTable?: string }): this {
    const { foreignTable } = options || {};
    if (foreignTable) {
      this.queryParams.set(`${foreignTable}.limit`, String(count));
    } else {
      this.queryParams.set('limit', String(count));
    }
    return this;
  }

  range(from: number, to: number, options?: { foreignTable?: string }): this {
    const { foreignTable } = options || {};
    if (foreignTable) {
      this.queryParams.set(`${foreignTable}.offset`, String(from));
      this.queryParams.set(`${foreignTable}.limit`, String(to - from + 1));
    } else {
      this.headers['Range'] = `${from}-${to}`;
      this.appendPrefer('count=exact');
    }
    return this;
  }

  single(): this {
    this.shouldReturnSingle = true;
    this.queryParams.set('limit', '1');
    this.headers['Accept'] = 'application/vnd.pgrst.object+json';
    return this;
  }

  maybeSingle(): this {
    this.shouldReturnMaybeSingle = true;
    this.queryParams.set('limit', '1');
    this.headers['Accept'] = 'application/vnd.pgrst.object+json';
    return this;
  }

  insert(data: Partial<T> | Partial<T>[], options?: MutationOptions): this {
    this.method = 'POST';
    this.bodyData = data;
    if (options?.count) {
      this.appendPrefer(`count=${options.count}`);
    }
    return this;
  }

  update(data: Partial<T>, options?: MutationOptions): this {
    this.method = 'PATCH';
    this.bodyData = data;
    if (options?.count) {
      this.appendPrefer(`count=${options.count}`);
    }
    return this;
  }

  upsert(
    data: Partial<T> | Partial<T>[],
    options?: {
      onConflict?: string;
      ignoreDuplicates?: boolean;
      count?: 'exact' | 'planned' | 'estimated';
    }
  ): this {
    this.method = 'POST';
    this.bodyData = data;
    if (options?.onConflict) {
      this.onConflict = options.onConflict;
      this.queryParams.set('on_conflict', options.onConflict);
    }
    if (options?.ignoreDuplicates) {
      this.appendPrefer('resolution=ignore-duplicates');
    } else {
      this.appendPrefer('resolution=merge-duplicates');
    }
    if (options?.count) {
      this.appendPrefer(`count=${options.count}`);
    }
    return this;
  }

  delete(options?: MutationOptions): this {
    this.method = 'DELETE';
    if (options?.count) {
      this.appendPrefer(`count=${options.count}`);
    }
    return this;
  }

  then<TResult1 = RestResponse<T>, TResult2 = never>(
    onfulfilled?:
      | ((value: RestResponse<T>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private appendPrefer(directive: string): void {
    const existing = this.headers['Prefer'];
    if (!existing) {
      this.headers['Prefer'] = directive;
      return;
    }
    if (existing.split(',').map((s) => s.trim()).includes(directive)) return;
    this.headers['Prefer'] = `${existing},${directive}`;
  }

  private buildUrl(): string {
    const base = this.apiBaseUrl.replace(/\/$/, '');
    const queryString = Array.from(this.queryParams.entries())
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    const url = `${base}/rest/v1/${this.tableName}`;
    return queryString ? `${url}?${queryString}` : url;
  }

  private async execute(): Promise<RestResponse<T>> {
    try {
      const url = this.buildUrl();
      const token = await this.getAccessToken();
      const requestHeaders: Record<string, string> = {
        Accept: this.headers['Accept'] || 'application/json',
        ...this.headers,
      };

      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
      }

      const method = this.headOnly ? 'HEAD' : this.method;
      const init: RequestInit = {
        method,
        headers: requestHeaders,
      };

      if (
        this.bodyData !== null &&
        (method === 'POST' || method === 'PATCH' || method === 'PUT')
      ) {
        init.body = JSON.stringify(this.bodyData);
        requestHeaders['Content-Type'] = 'application/json';
      }

      const response = await fetch(url, init);
      const contentRange = response.headers.get('content-range');
      let count: number | null = null;
      if (contentRange) {
        const match = /\/(\d+|\*)$/.exec(contentRange);
        if (match && match[1] !== '*') {
          count = Number(match[1]);
        }
      }

      if (method === 'HEAD' || response.status === 204) {
        if (!response.ok) {
          return {
            data: null,
            error: {
              message: `Request failed with status ${response.status}`,
              code: String(response.status),
            },
            count,
            status: response.status,
            statusText: response.statusText,
          };
        }
        return {
          data: null,
          error: null,
          count: count ?? (this.wantCount ? 0 : null),
          status: response.status,
          statusText: response.statusText,
        };
      }

      const text = await response.text();
      let responseData: unknown = null;
      if (text) {
        try {
          responseData = JSON.parse(text);
        } catch {
          responseData = text;
        }
      }

      if (!response.ok) {
        const errObj = (responseData || {}) as Record<string, unknown>;
        // PostgREST maybeSingle with 0 rows returns 406 with PGRST116 — treat as null for maybeSingle
        if (
          this.shouldReturnMaybeSingle &&
          (errObj.code === 'PGRST116' || response.status === 406)
        ) {
          return {
            data: null,
            error: null,
            count,
            status: response.status,
            statusText: response.statusText,
          };
        }
        return {
          data: null,
          error: {
            message:
              (errObj.message as string) ||
              (errObj.error as string) ||
              `Request failed with status ${response.status}`,
            details: errObj.details as string | undefined,
            hint: errObj.hint as string | undefined,
            code: (errObj.code as string) || String(response.status),
          },
          count,
          status: response.status,
          statusText: response.statusText,
        };
      }

      if (this.shouldReturnSingle) {
        if (Array.isArray(responseData)) {
          if (responseData.length === 0) {
            return {
              data: null,
              error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' },
              count,
              status: response.status,
            };
          }
          if (responseData.length > 1) {
            return {
              data: null,
              error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' },
              count,
              status: response.status,
            };
          }
          return { data: responseData[0] as T, error: null, count, status: response.status };
        }
        return { data: responseData as T, error: null, count, status: response.status };
      }

      if (this.shouldReturnMaybeSingle) {
        if (Array.isArray(responseData)) {
          if (responseData.length === 0) {
            return { data: null, error: null, count, status: response.status };
          }
          return { data: responseData[0] as T, error: null, count, status: response.status };
        }
        return { data: (responseData as T) ?? null, error: null, count, status: response.status };
      }

      return {
        data: responseData as T,
        error: null,
        count,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error instanceof Error ? error.stack : undefined,
        },
      };
    }
  }
}

export class RestRpcBuilder<T = unknown> {
  constructor(
    private functionName: string,
    private params: Record<string, unknown> | undefined,
    private apiBaseUrl: string,
    private getAccessToken: AccessTokenProvider
  ) {}

  then<TResult1 = RestResponse<T>, TResult2 = never>(
    onfulfilled?:
      | ((value: RestResponse<T>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<RestResponse<T>> {
    try {
      const base = this.apiBaseUrl.replace(/\/$/, '');
      const url = `${base}/rest/v1/rpc/${this.functionName}`;
      const token = await this.getAccessToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(this.params ?? {}),
      });

      const text = await response.text();
      let responseData: unknown = null;
      if (text) {
        try {
          responseData = JSON.parse(text);
        } catch {
          responseData = text;
        }
      }

      if (!response.ok) {
        const errObj = (responseData || {}) as Record<string, unknown>;
        return {
          data: null,
          error: {
            message:
              (errObj.message as string) ||
              `RPC call failed with status ${response.status}`,
            details: errObj.details as string | undefined,
            hint: errObj.hint as string | undefined,
            code: (errObj.code as string) || String(response.status),
          },
          status: response.status,
        };
      }

      return { data: responseData as T, error: null, status: response.status };
    } catch (error) {
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}

export interface SelfHostedRestClient {
  from: <T = unknown>(table: string) => RestQueryBuilder<T>;
  rpc: <T = unknown>(
    fn: string,
    params?: Record<string, unknown>
  ) => RestRpcBuilder<T>;
}

export function createRestClient(
  apiBaseUrl: string,
  getAccessToken: AccessTokenProvider
): SelfHostedRestClient {
  return {
    from<T = unknown>(table: string) {
      return new RestQueryBuilder<T>(table, apiBaseUrl, getAccessToken);
    },
    rpc<T = unknown>(fn: string, params?: Record<string, unknown>) {
      return new RestRpcBuilder<T>(fn, params, apiBaseUrl, getAccessToken);
    },
  };
}

/** Exported for unit tests — builds the same URL shape as RestQueryBuilder. */
export function buildRestUrlForTest(
  apiBaseUrl: string,
  table: string,
  params: Record<string, string>
): string {
  const base = apiBaseUrl.replace(/\/$/, '');
  const queryString = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  const url = `${base}/rest/v1/${table}`;
  return queryString ? `${url}?${queryString}` : url;
}
