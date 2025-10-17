/**
 * Supabase-compatible client that uses the C# API proxy controller.
 * This provides a drop-in replacement for the Supabase client with the same fluent API.
 */

import { getApiBaseUrl } from '../../../config/environment';

interface SupabaseError {
    message: string;
    details?: string;
    hint?: string;
    code?: string;
}

interface SupabaseResponse<T> {
    data: T | null;
    error: SupabaseError | null;
}

type PostgrestFilterOperator =
    | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
    | 'like' | 'ilike' | 'is' | 'in' | 'cs' | 'cd'
    | 'ov' | 'sl' | 'sr' | 'nxl' | 'nxr' | 'adj';

/**
 * Query builder that mimics Supabase's PostgREST client.
 */
class SupabaseProxyQueryBuilder<T = any> {
    private tableName: string;
    private queryParams: Map<string, string> = new Map();
    private headers: Record<string, string> = {};
    private method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'GET';
    private bodyData: any = null;
    private shouldReturnSingle = false;
    private shouldReturnMaybeSingle = false;

    constructor(tableName: string, private accessToken: string | null) {
        this.tableName = tableName;
    }

    /**
     * Select columns to return.
     */
    select(columns: string = '*'): this {
        // Remove ALL whitespace - PostgREST is strict about format
        // *,teams(id,name) not *, teams( id, name )
        const cleanColumns = columns.replace(/\s+/g, '');
        this.queryParams.set('select', cleanColumns);
        return this;
    }

    /**
     * Filter by equality.
     */
    eq(column: string, value: any): this {
        return this.filter(column, 'eq', value);
    }

    /**
     * Filter by inequality.
     */
    neq(column: string, value: any): this {
        return this.filter(column, 'neq', value);
    }

    /**
     * Filter by greater than.
     */
    gt(column: string, value: any): this {
        return this.filter(column, 'gt', value);
    }

    /**
     * Filter by greater than or equal.
     */
    gte(column: string, value: any): this {
        return this.filter(column, 'gte', value);
    }

    /**
     * Filter by less than.
     */
    lt(column: string, value: any): this {
        return this.filter(column, 'lt', value);
    }

    /**
     * Filter by less than or equal.
     */
    lte(column: string, value: any): this {
        return this.filter(column, 'lte', value);
    }

    /**
     * Filter by pattern match (case-sensitive).
     */
    like(column: string, pattern: string): this {
        return this.filter(column, 'like', pattern);
    }

    /**
     * Filter by pattern match (case-insensitive).
     */
    ilike(column: string, pattern: string): this {
        return this.filter(column, 'ilike', pattern);
    }

    /**
     * Filter by IS (for null, true, false).
     */
    is(column: string, value: boolean | null): this {
        return this.filter(column, 'is', value);
    }

    /**
     * Filter by IN list.
     */
    in(column: string, values: any[]): this {
        const formattedValues = `(${values.map(v => typeof v === 'string' ? `"${v}"` : v).join(',')})`;
        return this.filter(column, 'in', formattedValues);
    }

    /**
     * Filter by contains (for arrays/ranges).
     */
    contains(column: string, value: any): this {
        return this.filter(column, 'cs', JSON.stringify(value));
    }

    /**
     * Filter by contained by (for arrays/ranges).
     */
    containedBy(column: string, value: any): this {
        return this.filter(column, 'cd', JSON.stringify(value));
    }

    /**
     * Generic filter method.
     */
    filter(column: string, operator: PostgrestFilterOperator | string, value: any): this {
        const formattedValue = value === null ? 'null' : value;
        this.queryParams.set(column, `${operator}.${formattedValue}`);
        return this;
    }

    /**
     * Filter with OR conditions.
     */
    or(filters: string): this {
        this.queryParams.set('or', `(${filters})`);
        return this;
    }

    /**
     * Filter with NOT condition.
     */
    not(column: string, operator: PostgrestFilterOperator, value: any): this {
        const formattedValue = value === null ? 'null' : value;
        this.queryParams.set(column, `not.${operator}.${formattedValue}`);
        return this;
    }

    /**
     * Order results.
     */
    order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean; foreignTable?: string }): this {
        const { ascending = true, nullsFirst, foreignTable } = options || {};
        const direction = ascending ? 'asc' : 'desc';
        const nullsOrder = nullsFirst !== undefined ? (nullsFirst ? '.nullsfirst' : '.nullslast') : '';
        const orderValue = `${column}.${direction}${nullsOrder}`;

        if (foreignTable) {
            this.queryParams.set(`${foreignTable}.order`, orderValue);
        } else {
            this.queryParams.set('order', orderValue);
        }
        return this;
    }

    /**
     * Limit number of results.
     */
    limit(count: number, options?: { foreignTable?: string }): this {
        const { foreignTable } = options || {};
        if (foreignTable) {
            this.queryParams.set(`${foreignTable}.limit`, String(count));
        } else {
            this.queryParams.set('limit', String(count));
        }
        return this;
    }

    /**
     * Range of results (for pagination).
     */
    range(from: number, to: number, options?: { foreignTable?: string }): this {
        const { foreignTable } = options || {};
        if (foreignTable) {
            this.queryParams.set(`${foreignTable}.offset`, String(from));
            this.queryParams.set(`${foreignTable}.limit`, String(to - from + 1));
        } else {
            this.headers['Range'] = `${from}-${to}`;
        }
        return this;
    }

    /**
     * Return a single row. Throws error if not exactly one row.
     */
    single(): this {
        this.shouldReturnSingle = true;
        this.queryParams.set('limit', '1');
        return this;
    }

    /**
     * Return a single row or null. Doesn't throw error if no rows.
     */
    maybeSingle(): this {
        this.shouldReturnMaybeSingle = true;
        this.queryParams.set('limit', '1');
        return this;
    }

    /**
     * Insert new rows.
     */
    insert(data: Partial<T> | Partial<T>[], options?: { returning?: 'minimal' | 'representation' }): this {
        this.method = 'POST';
        this.bodyData = data;
        if (options?.returning === 'representation') {
            this.headers['Prefer'] = 'return=representation';
        }
        return this;
    }

    /**
     * Update existing rows.
     */
    update(data: Partial<T>, options?: { returning?: 'minimal' | 'representation' }): this {
        this.method = 'PATCH';
        this.bodyData = data;
        if (options?.returning === 'representation') {
            this.headers['Prefer'] = 'return=representation';
        }
        return this;
    }

    /**
     * Upsert rows (insert or update).
     */
    upsert(data: Partial<T> | Partial<T>[], options?: {
        onConflict?: string;
        returning?: 'minimal' | 'representation';
        ignoreDuplicates?: boolean;
    }): this {
        this.method = 'POST';
        this.bodyData = data;

        const preferParts: string[] = [];
        if (options?.returning === 'representation') {
            preferParts.push('return=representation');
        }
        if (options?.ignoreDuplicates) {
            preferParts.push('resolution=ignore-duplicates');
        } else {
            preferParts.push('resolution=merge-duplicates');
        }
        if (options?.onConflict) {
            // PostgREST uses the Prefer header for this
            preferParts.push(`resolution=merge-duplicates`);
        }

        if (preferParts.length > 0) {
            this.headers['Prefer'] = preferParts.join(',');
        }
        return this;
    }

    /**
     * Delete rows.
     */
    delete(options?: { returning?: 'minimal' | 'representation' }): this {
        this.method = 'DELETE';
        if (options?.returning === 'representation') {
            this.headers['Prefer'] = 'return=representation';
        }
        return this;
    }

    /**
     * Execute the query and return results.
     */
    async then<TResult = T>(
        onfulfilled?: ((value: SupabaseResponse<T>) => TResult | PromiseLike<TResult>) | null,
        onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
    ): Promise<TResult> {
        const result = await this.execute();
        const promise = Promise.resolve(result);
        return promise.then(onfulfilled, onrejected);
    }

    /**
     * Build the URL with query parameters.
     */
    private buildUrl(): string {
        const baseUrl = getApiBaseUrl();
        const queryString = Array.from(this.queryParams.entries())
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join('&');

        const url = `${baseUrl}/api/supabase/${this.tableName}`;
        return queryString ? `${url}?${queryString}` : url;
    }

    /**
     * Execute the request.
     */
    private async execute(): Promise<SupabaseResponse<T>> {
        try {
            const url = this.buildUrl();
            const requestHeaders: Record<string, string> = {
                ...this.headers,
            };

            if (this.accessToken) {
                requestHeaders['Authorization'] = `Bearer ${this.accessToken}`;
            }

            const requestInit: RequestInit = {
                method: this.method,
                headers: requestHeaders,
            };

            if (this.bodyData !== null && (this.method === 'POST' || this.method === 'PATCH' || this.method === 'PUT')) {
                requestInit.body = JSON.stringify(this.bodyData);
                // Only set Content-Type for requests with a body
                requestHeaders['Content-Type'] = 'application/json';
            }

            const response = await fetch(url, requestInit);

            // Handle empty responses (like 204 No Content)
            if (response.status === 204 || response.headers.get('Content-Length') === '0') {
                return { data: null, error: null };
            }

            const responseData = await response.json();

            if (!response.ok) {
                // Response is an error
                return {
                    data: null,
                    error: {
                        message: responseData.message || responseData.error || `Request failed with status ${response.status}`,
                        details: responseData.details,
                        hint: responseData.hint,
                        code: responseData.code || String(response.status),
                    },
                };
            }

            // Handle single row responses
            if (this.shouldReturnSingle) {
                if (Array.isArray(responseData)) {
                    if (responseData.length === 0) {
                        return {
                            data: null,
                            error: {
                                message: 'No rows returned',
                                code: 'PGRST116',
                            },
                        };
                    }
                    if (responseData.length > 1) {
                        return {
                            data: null,
                            error: {
                                message: 'Multiple rows returned',
                                code: 'PGRST116',
                            },
                        };
                    }
                    return { data: responseData[0] as T, error: null };
                }
                // If it's already a single object, return it
                return { data: responseData as T, error: null };
            }

            if (this.shouldReturnMaybeSingle) {
                if (Array.isArray(responseData)) {
                    if (responseData.length === 0) {
                        return { data: null, error: null };
                    }
                    return { data: responseData[0] as T, error: null };
                }
                return { data: responseData as T, error: null };
            }

            // Return array or object as-is
            return { data: responseData as T, error: null };
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

/**
 * RPC function caller.
 */
class SupabaseProxyRpcBuilder<T = any> {
    constructor(
        private functionName: string,
        private params: any,
        private accessToken: string | null
    ) { }

    async then<TResult = T>(
        onfulfilled?: ((value: SupabaseResponse<T>) => TResult | PromiseLike<TResult>) | null,
        onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
    ): Promise<TResult> {
        const result = await this.execute();
        const promise = Promise.resolve(result);
        return promise.then(onfulfilled, onrejected);
    }

    private async execute(): Promise<SupabaseResponse<T>> {
        try {
            const baseUrl = getApiBaseUrl();
            const url = `${baseUrl}/api/supabase/rpc/${this.functionName}`;

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'X-UseSupabaseProxy': 'true',
            };

            if (this.accessToken) {
                headers['Authorization'] = `Bearer ${this.accessToken}`;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(this.params),
            });

            if (!response.ok) {
                const errorData = await response.json();
                return {
                    data: null,
                    error: {
                        message: errorData.message || `RPC call failed with status ${response.status}`,
                        details: errorData.details,
                        hint: errorData.hint,
                        code: errorData.code || String(response.status),
                    },
                };
            }

            const data = await response.json();
            return { data: data as T, error: null };
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

/**
 * Edge Functions invocation client.
 */
export class SupabaseProxyFunctionsClient {
    constructor(private accessToken: string | null) { }

    /**
     * Invoke an Edge Function.
     */
    async invoke<T = any>(
        functionName: string,
        options?: {
            body?: any;
            headers?: Record<string, string>;
            method?: 'POST' | 'GET' | 'PUT' | 'PATCH' | 'DELETE';
        }
    ): Promise<SupabaseResponse<T>> {
        try {
            const baseUrl = getApiBaseUrl();
            const url = `${baseUrl}/api/supabase/functions/${functionName}`;

            const headers: Record<string, string> = {
                ...options?.headers,
            };

            if (this.accessToken) {
                headers['Authorization'] = `Bearer ${this.accessToken}`;
            }

            if (options?.body !== undefined) {
                headers['Content-Type'] = 'application/json';
            }

            const response = await fetch(url, {
                method: options?.method || 'POST',
                headers,
                body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    data: null,
                    error: {
                        message: errorData.message || `Function invocation failed with status ${response.status}`,
                        details: errorData.details,
                        hint: errorData.hint,
                        code: errorData.code || String(response.status),
                    },
                };
            }

            const data = await response.json();
            return { data: data as T, error: null };
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

/**
 * Authentication client.
 */
export class SupabaseProxyAuthClient {
    constructor(private accessToken: string | null, private setAccessToken: (token: string | null) => void) { }

    /**
     * Sign in with email and password.
     */
    async signInWithPassword(credentials: {
        email: string;
        password: string;
    }): Promise<SupabaseResponse<{ user: any; session: any }>> {
        try {
            const baseUrl = getApiBaseUrl();
            const url = `${baseUrl}/api/supabase/auth/v1/token?grant_type=password`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(credentials),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    data: null,
                    error: {
                        message: errorData.message || errorData.error_description || `Sign in failed with status ${response.status}`,
                        details: errorData.details,
                        code: errorData.code || errorData.error || String(response.status),
                    },
                };
            }

            const data = await response.json();
            if (data.access_token) {
                this.setAccessToken(data.access_token);
                return { 
                    data: { 
                        user: data.user, 
                        session: { 
                            access_token: data.access_token,
                            refresh_token: data.refresh_token,
                            expires_in: data.expires_in,
                            token_type: data.token_type,
                            user: data.user
                        } 
                    }, 
                    error: null 
                };
            }
            return { data, error: null };
        } catch (error) {
            return {
                data: null,
                error: {
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
            };
        }
    }

    /**
     * Sign up with email and password.
     */
    async signUp(credentials: {
        email: string;
        password: string;
        options?: {
            data?: Record<string, any>;
            emailRedirectTo?: string;
        };
    }): Promise<SupabaseResponse<{ user: any; session: any }>> {
        try {
            const baseUrl = getApiBaseUrl();
            const url = `${baseUrl}/api/supabase/auth/v1/signup`;

            const body: any = {
                email: credentials.email,
                password: credentials.password,
            };
            if (credentials.options?.data) {
                body.data = credentials.options.data;
            }
            if (credentials.options?.emailRedirectTo) {
                body.options = { emailRedirectTo: credentials.options.emailRedirectTo };
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    data: null,
                    error: {
                        message: errorData.message || errorData.msg || `Sign up failed with status ${response.status}`,
                        details: errorData.details,
                        code: errorData.code || String(response.status),
                    },
                };
            }

            const data = await response.json();
            if (data.access_token) {
                this.setAccessToken(data.access_token);
            }
            return { 
                data: { 
                    user: data.user, 
                    session: data.access_token ? {
                        access_token: data.access_token,
                        refresh_token: data.refresh_token,
                        expires_in: data.expires_in,
                        token_type: data.token_type,
                        user: data.user
                    } : null
                }, 
                error: null 
            };
        } catch (error) {
            return {
                data: null,
                error: {
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
            };
        }
    }

    /**
     * Sign out the current user.
     */
    async signOut(): Promise<SupabaseResponse<void>> {
        try {
            const baseUrl = getApiBaseUrl();
            const url = `${baseUrl}/api/supabase/auth/v1/logout`;

            const headers: Record<string, string> = {};
            if (this.accessToken) {
                headers['Authorization'] = `Bearer ${this.accessToken}`;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    data: null,
                    error: {
                        message: errorData.message || `Sign out failed with status ${response.status}`,
                        details: errorData.details,
                        code: errorData.code || String(response.status),
                    },
                };
            }

            this.setAccessToken(null);
            return { data: null, error: null };
        } catch (error) {
            return {
                data: null,
                error: {
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
            };
        }
    }

    /**
     * Get the current session.
     */
    async getSession(): Promise<SupabaseResponse<{ session: any }>> {
        // Note: Supabase auth API doesn't have a direct session endpoint
        // Session state is typically managed client-side
        // This returns the current session if we have an access token
        if (this.accessToken) {
            return {
                data: {
                    session: {
                        access_token: this.accessToken,
                    }
                },
                error: null
            };
        }
        return {
            data: { session: null },
            error: null
        };
    }

    /**
     * Get the current user.
     */
    async getUser(): Promise<SupabaseResponse<{ user: any }>> {
        try {
            const baseUrl = getApiBaseUrl();
            const url = `${baseUrl}/api/supabase/auth/v1/user`;

            const headers: Record<string, string> = {};
            if (this.accessToken) {
                headers['Authorization'] = `Bearer ${this.accessToken}`;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    data: null,
                    error: {
                        message: errorData.message || `Get user failed with status ${response.status}`,
                        details: errorData.details,
                        code: errorData.code || String(response.status),
                    },
                };
            }

            const data = await response.json();
            return { data: { user: data }, error: null };
        } catch (error) {
            return {
                data: null,
                error: {
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
            };
        }
    }

    /**
     * Send a password reset email.
     */
    async resetPasswordForEmail(
        email: string,
        options?: { redirectTo?: string }
    ): Promise<SupabaseResponse<void>> {
        try {
            const baseUrl = getApiBaseUrl();
            const url = `${baseUrl}/api/supabase/auth/v1/recover`;

            const body: any = { email };
            if (options?.redirectTo) {
                body.gotrue_meta_security = { captcha_token: null };
                body.redirect_to = options.redirectTo;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    data: null,
                    error: {
                        message: errorData.message || `Password reset failed with status ${response.status}`,
                        details: errorData.details,
                        code: errorData.code || String(response.status),
                    },
                };
            }

            return { data: null, error: null };
        } catch (error) {
            return {
                data: null,
                error: {
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
            };
        }
    }

    /**
     * Update user data.
     */
    async updateUser(attributes: {
        email?: string;
        password?: string;
        data?: Record<string, any>;
    }): Promise<SupabaseResponse<{ user: any }>> {
        try {
            const baseUrl = getApiBaseUrl();
            const url = `${baseUrl}/api/supabase/auth/v1/user`;

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (this.accessToken) {
                headers['Authorization'] = `Bearer ${this.accessToken}`;
            }

            const response = await fetch(url, {
                method: 'PUT',
                headers,
                body: JSON.stringify(attributes),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    data: null,
                    error: {
                        message: errorData.message || `Update user failed with status ${response.status}`,
                        details: errorData.details,
                        code: errorData.code || String(response.status),
                    },
                };
            }

            const data = await response.json();
            return { data: { user: data }, error: null };
        } catch (error) {
            return {
                data: null,
                error: {
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
            };
        }
    }

    /**
     * Refresh the session using a refresh token.
     */
    async refreshSession(refreshToken?: string): Promise<SupabaseResponse<{ session: any; user: any }>> {
        try {
            const baseUrl = getApiBaseUrl();
            const url = `${baseUrl}/api/supabase/auth/v1/token?grant_type=refresh_token`;

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: refreshToken ? JSON.stringify({ refresh_token: refreshToken }) : undefined,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    data: null,
                    error: {
                        message: errorData.message || `Refresh session failed with status ${response.status}`,
                        details: errorData.details,
                        code: errorData.code || String(response.status),
                    },
                };
            }

            const data = await response.json();
            if (data.access_token) {
                this.setAccessToken(data.access_token);
                return {
                    data: {
                        session: {
                            access_token: data.access_token,
                            refresh_token: data.refresh_token,
                            expires_in: data.expires_in,
                            token_type: data.token_type,
                            user: data.user
                        },
                        user: data.user
                    },
                    error: null
                };
            }
            return { data, error: null };
        } catch (error) {
            return {
                data: null,
                error: {
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
            };
        }
    }

    /**
     * Listen to auth state changes.
     * Note: This is a simplified implementation that doesn't provide real-time updates.
     * It returns immediately with the current session state.
     */
    onAuthStateChange(callback: (event: string, session: any) => void): {
        data: { subscription: { unsubscribe: () => void } };
    } {
        // Immediately call with current session if we have a token
        if (this.accessToken) {
            // Fetch user data to include in the session
            this.getUser().then((result) => {
                if (result.data?.user) {
                    callback('SIGNED_IN', {
                        access_token: this.accessToken,
                        user: result.data.user,
                    });
                } else {
                    // If we can't get user, still call with minimal session
                    callback('SIGNED_IN', {
                        access_token: this.accessToken,
                        user: null,
                    });
                }
            }).catch(() => {
                // On error, call with minimal session
                callback('SIGNED_IN', {
                    access_token: this.accessToken,
                    user: null,
                });
            });
        } else {
            setTimeout(() => {
                callback('SIGNED_OUT', null);
            }, 0);
        }

        // Return a subscription object that can be unsubscribed
        return {
            data: {
                subscription: {
                    unsubscribe: () => {
                        // Cleanup if needed
                    },
                },
            },
        };
    }

    /**
     * Sign in with OAuth provider.
     */
    async signInWithOAuth(params: {
        provider: string;
        options?: {
            redirectTo?: string;
            scopes?: string;
        };
    }): Promise<SupabaseResponse<{ url: string }>> {
        try {
            const baseUrl = getApiBaseUrl();
            const url = `${baseUrl}/api/supabase/auth/v1/authorize?provider=${params.provider}${params.options?.redirectTo ? `&redirect_to=${encodeURIComponent(params.options.redirectTo)}` : ''}${params.options?.scopes ? `&scopes=${encodeURIComponent(params.options.scopes)}` : ''}`;

            // For OAuth, we need to redirect the browser
            return {
                data: { url },
                error: null,
            };
        } catch (error) {
            return {
                data: null,
                error: {
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
            };
        }
    }

    /**
     * Set a new session (from access token and refresh token).
     */
    async setSession(params: {
        access_token: string;
        refresh_token: string;
    }): Promise<SupabaseResponse<{ session: any; user: any }>> {
        try {
            // Use the refresh token to get a new session
            const result = await this.refreshSession(params.refresh_token);
            if (result.error) {
                return result;
            }

            // If successful, set the access token
            if (result.data?.session?.access_token) {
                this.setAccessToken(result.data.session.access_token);
            } else {
                // If no session from refresh, just set the provided token
                this.setAccessToken(params.access_token);
                
                // Try to get user info
                const userResult = await this.getUser();
                return {
                    data: {
                        session: {
                            access_token: params.access_token,
                            refresh_token: params.refresh_token,
                        },
                        user: userResult.data?.user || null,
                    },
                    error: null,
                };
            }

            return result;
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

/**
 * Storage client for file operations.
 */
export class SupabaseProxyStorageClient {
    constructor(private accessToken: string | null) { }

    /**
     * Get a bucket client to perform operations on a specific bucket.
     */
    from(bucketName: string): SupabaseProxyStorageBucket {
        return new SupabaseProxyStorageBucket(bucketName, this.accessToken);
    }

    /**
     * List all buckets.
     */
    async listBuckets(): Promise<SupabaseResponse<any[]>> {
        try {
            const baseUrl = getApiBaseUrl();
            const url = `${baseUrl}/api/supabase/storage/v1/bucket`;

            const headers: Record<string, string> = {};
            if (this.accessToken) {
                headers['Authorization'] = `Bearer ${this.accessToken}`;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    data: null,
                    error: {
                        message: errorData.message || `List buckets failed with status ${response.status}`,
                        details: errorData.details,
                        code: errorData.code || String(response.status),
                    },
                };
            }

            const data = await response.json();
            return { data, error: null };
        } catch (error) {
            return {
                data: null,
                error: {
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
            };
        }
    }

    /**
     * Create a new bucket.
     */
    async createBucket(id: string, options?: { public?: boolean }): Promise<SupabaseResponse<any>> {
        try {
            const baseUrl = getApiBaseUrl();
            const url = `${baseUrl}/api/supabase/storage/v1/bucket`;

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (this.accessToken) {
                headers['Authorization'] = `Bearer ${this.accessToken}`;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({ id, public: options?.public ?? false }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    data: null,
                    error: {
                        message: errorData.message || `Create bucket failed with status ${response.status}`,
                        details: errorData.details,
                        code: errorData.code || String(response.status),
                    },
                };
            }

            const data = await response.json();
            return { data, error: null };
        } catch (error) {
            return {
                data: null,
                error: {
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
            };
        }
    }

    /**
     * Delete a bucket.
     */
    async deleteBucket(id: string): Promise<SupabaseResponse<void>> {
        try {
            const baseUrl = getApiBaseUrl();
            const url = `${baseUrl}/api/supabase/storage/v1/bucket/${id}`;

            const headers: Record<string, string> = {};
            if (this.accessToken) {
                headers['Authorization'] = `Bearer ${this.accessToken}`;
            }

            const response = await fetch(url, {
                method: 'DELETE',
                headers,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    data: null,
                    error: {
                        message: errorData.message || `Delete bucket failed with status ${response.status}`,
                        details: errorData.details,
                        code: errorData.code || String(response.status),
                    },
                };
            }

            return { data: null, error: null };
        } catch (error) {
            return {
                data: null,
                error: {
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
            };
        }
    }

    /**
     * Empty a bucket (delete all files).
     */
    async emptyBucket(id: string): Promise<SupabaseResponse<void>> {
        try {
            const baseUrl = getApiBaseUrl();
            const url = `${baseUrl}/api/supabase/storage/v1/bucket/${id}/empty`;

            const headers: Record<string, string> = {};
            if (this.accessToken) {
                headers['Authorization'] = `Bearer ${this.accessToken}`;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    data: null,
                    error: {
                        message: errorData.message || `Empty bucket failed with status ${response.status}`,
                        details: errorData.details,
                        code: errorData.code || String(response.status),
                    },
                };
            }

            return { data: null, error: null };
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

/**
 * Bucket-specific storage operations.
 */
export class SupabaseProxyStorageBucket {
    constructor(private bucketName: string, private accessToken: string | null) { }

    /**
     * Upload a file to the bucket.
     */
    async upload(
        path: string,
        fileBody: File | Blob | ArrayBuffer | string,
        options?: {
            contentType?: string;
            cacheControl?: string;
            upsert?: boolean;
        }
    ): Promise<SupabaseResponse<{ path: string }>> {
        try {
            const baseUrl = getApiBaseUrl();
            const url = `${baseUrl}/api/supabase/storage/v1/object/${this.bucketName}/${path}`;

            const headers: Record<string, string> = {};
            if (this.accessToken) {
                headers['Authorization'] = `Bearer ${this.accessToken}`;
            }

            if (options?.contentType) {
                headers['Content-Type'] = options.contentType;
            }

            if (options?.cacheControl) {
                headers['Cache-Control'] = options.cacheControl;
            }

            if (options?.upsert) {
                headers['x-upsert'] = 'true';
            }

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: fileBody instanceof Blob || fileBody instanceof File
                    ? fileBody
                    : typeof fileBody === 'string'
                        ? fileBody
                        : new Blob([fileBody]),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    data: null,
                    error: {
                        message: errorData.message || `Upload failed with status ${response.status}`,
                        details: errorData.details,
                        code: errorData.code || String(response.status),
                    },
                };
            }

            const data = await response.json();
            return { data, error: null };
        } catch (error) {
            return {
                data: null,
                error: {
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
            };
        }
    }

    /**
     * Download a file from the bucket.
     */
    async download(path: string): Promise<SupabaseResponse<Blob>> {
        try {
            const baseUrl = getApiBaseUrl();
            const url = `${baseUrl}/api/supabase/storage/v1/object/${this.bucketName}/${path}`;

            const headers: Record<string, string> = {};
            if (this.accessToken) {
                headers['Authorization'] = `Bearer ${this.accessToken}`;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    data: null,
                    error: {
                        message: errorData.message || `Download failed with status ${response.status}`,
                        details: errorData.details,
                        code: errorData.code || String(response.status),
                    },
                };
            }

            const blob = await response.blob();
            return { data: blob, error: null };
        } catch (error) {
            return {
                data: null,
                error: {
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
            };
        }
    }

    /**
     * List files in the bucket.
     */
    async list(path?: string, options?: {
        limit?: number;
        offset?: number;
        sortBy?: { column: string; order: 'asc' | 'desc' };
    }): Promise<SupabaseResponse<any[]>> {
        try {
            const baseUrl = getApiBaseUrl();
            const url = `${baseUrl}/api/supabase/storage/v1/object/list/${this.bucketName}`;

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (this.accessToken) {
                headers['Authorization'] = `Bearer ${this.accessToken}`;
            }

            const body: any = {};
            if (path !== undefined) {
                body.prefix = path;
            }
            if (options?.limit !== undefined) {
                body.limit = options.limit;
            }
            if (options?.offset !== undefined) {
                body.offset = options.offset;
            }
            if (options?.sortBy) {
                body.sortBy = options.sortBy;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    data: null,
                    error: {
                        message: errorData.message || `List failed with status ${response.status}`,
                        details: errorData.details,
                        code: errorData.code || String(response.status),
                    },
                };
            }

            const data = await response.json();
            return { data, error: null };
        } catch (error) {
            return {
                data: null,
                error: {
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
            };
        }
    }

    /**
     * Remove files from the bucket.
     */
    async remove(paths: string[]): Promise<SupabaseResponse<any[]>> {
        try {
            const baseUrl = getApiBaseUrl();
            const url = `${baseUrl}/api/supabase/storage/v1/object/${this.bucketName}`;

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (this.accessToken) {
                headers['Authorization'] = `Bearer ${this.accessToken}`;
            }

            const response = await fetch(url, {
                method: 'DELETE',
                headers,
                body: JSON.stringify({ prefixes: paths }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    data: null,
                    error: {
                        message: errorData.message || `Remove failed with status ${response.status}`,
                        details: errorData.details,
                        code: errorData.code || String(response.status),
                    },
                };
            }

            const data = await response.json();
            return { data, error: null };
        } catch (error) {
            return {
                data: null,
                error: {
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
            };
        }
    }

    /**
     * Move a file within the bucket.
     */
    async move(fromPath: string, toPath: string): Promise<SupabaseResponse<{ message: string }>> {
        try {
            const baseUrl = getApiBaseUrl();
            const url = `${baseUrl}/api/supabase/storage/v1/object/move`;

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (this.accessToken) {
                headers['Authorization'] = `Bearer ${this.accessToken}`;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    bucketId: this.bucketName,
                    sourceKey: fromPath,
                    destinationKey: toPath,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    data: null,
                    error: {
                        message: errorData.message || `Move failed with status ${response.status}`,
                        details: errorData.details,
                        code: errorData.code || String(response.status),
                    },
                };
            }

            const data = await response.json();
            return { data, error: null };
        } catch (error) {
            return {
                data: null,
                error: {
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
            };
        }
    }

    /**
     * Get the public URL for a file.
     */
    getPublicUrl(path: string): { data: { publicUrl: string } } {
        const baseUrl = getApiBaseUrl();
        const publicUrl = `${baseUrl}/api/supabase/storage/v1/object/public/${this.bucketName}/${path}`;
        return {
            data: {
                publicUrl,
            },
        };
    }

    /**
     * Create a signed URL for temporary access to a private file.
     */
    async createSignedUrl(
        path: string,
        expiresIn: number
    ): Promise<SupabaseResponse<{ signedUrl: string }>> {
        try {
            const baseUrl = getApiBaseUrl();
            const url = `${baseUrl}/api/supabase/storage/v1/object/sign/${this.bucketName}/${path}`;

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (this.accessToken) {
                headers['Authorization'] = `Bearer ${this.accessToken}`;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({ expiresIn }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    data: null,
                    error: {
                        message: errorData.message || `Create signed URL failed with status ${response.status}`,
                        details: errorData.details,
                        code: errorData.code || String(response.status),
                    },
                };
            }

            const data = await response.json();
            return { data, error: null };
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

/**
 * Main Supabase proxy client that mimics the Supabase client API.
 */
export class SupabaseProxyClient {
    private accessToken: string | null = null;
    public readonly functions: SupabaseProxyFunctionsClient;
    public readonly auth: SupabaseProxyAuthClient;
    public readonly storage: SupabaseProxyStorageClient;

    constructor(accessToken?: string | null) {
        this.accessToken = accessToken || null;
        this.functions = new SupabaseProxyFunctionsClient(this.accessToken);
        this.auth = new SupabaseProxyAuthClient(
            this.accessToken,
            (token) => this.setAccessToken(token)
        );
        this.storage = new SupabaseProxyStorageClient(this.accessToken);
    }

    /**
     * Set the access token for authenticated requests.
     */
    setAccessToken(token: string | null): void {
        this.accessToken = token;
        // Update the token in the sub-clients as well
        (this.functions as any).accessToken = token;
        (this.auth as any).accessToken = token;
        (this.storage as any).accessToken = token;
    }

    /**
     * Start a query on a table.
     */
    from<T = any>(tableName: string): SupabaseProxyQueryBuilder<T> {
        return new SupabaseProxyQueryBuilder<T>(tableName, this.accessToken);
    }

    /**
     * Call a stored procedure/function.
     */
    rpc<T = any>(functionName: string, params: any = {}): SupabaseProxyRpcBuilder<T> {
        return new SupabaseProxyRpcBuilder<T>(functionName, params, this.accessToken);
    }
}

/**
 * Create a Supabase proxy client instance.
 */
export function createSupabaseProxyClient(accessToken?: string | null): SupabaseProxyClient {
    return new SupabaseProxyClient(accessToken);
}

