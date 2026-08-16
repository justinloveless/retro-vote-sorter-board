/**
 * Supabase Storage-compatible client for self-hosted Docker volume uploads (DUN-79).
 * Talks to Node `/storage/v1/object/*`.
 */

export type AccessTokenProvider = () => string | null | Promise<string | null>;

export interface StorageError {
  message: string;
  statusCode?: string;
}

export interface StorageResponse<T> {
  data: T | null;
  error: StorageError | null;
}

export interface UploadOptions {
  cacheControl?: string;
  contentType?: string;
  upsert?: boolean;
}

function joinUrl(base: string, ...parts: string[]): string {
  const root = base.replace(/\/$/, '');
  const path = parts
    .map((p) => p.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .map((segment) =>
      segment
        .split('/')
        .map((s) => encodeURIComponent(s))
        .join('/')
    )
    .join('/');
  return `${root}/${path}`;
}

export class StorageBucketClient {
  constructor(
    private readonly apiBaseUrl: string,
    private readonly bucket: string,
    private readonly getAccessToken: AccessTokenProvider
  ) {}

  getPublicUrl(path: string): { data: { publicUrl: string } } {
    const publicUrl = joinUrl(
      this.apiBaseUrl,
      'storage/v1/object/public',
      this.bucket,
      path
    );
    return { data: { publicUrl } };
  }

  async upload(
    path: string,
    fileBody: Blob | File | ArrayBuffer | ArrayBufferView | Buffer | string,
    options?: UploadOptions
  ): Promise<StorageResponse<{ path: string; fullPath: string }>> {
    try {
      const token = await this.getAccessToken();
      const headers: Record<string, string> = {
        'x-upsert': options?.upsert ? 'true' : 'false',
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      let body: BodyInit;
      if (typeof fileBody === 'string') {
        body = fileBody;
        headers['Content-Type'] = options?.contentType || 'text/plain';
      } else if (fileBody instanceof Blob) {
        body = fileBody;
        headers['Content-Type'] =
          options?.contentType || fileBody.type || 'application/octet-stream';
      } else if (ArrayBuffer.isView(fileBody)) {
        body = fileBody as unknown as BlobPart as BodyInit;
        headers['Content-Type'] = options?.contentType || 'application/octet-stream';
      } else {
        body = fileBody as BodyInit;
        headers['Content-Type'] = options?.contentType || 'application/octet-stream';
      }

      const url = joinUrl(
        this.apiBaseUrl,
        'storage/v1/object',
        this.bucket,
        path
      );
      const response = await fetch(url, { method: 'POST', headers, body });
      if (!response.ok) {
        const text = await response.text();
        let message = text;
        try {
          const json = JSON.parse(text) as { error?: string };
          message = json.error || text;
        } catch {
          // keep text
        }
        return {
          data: null,
          error: { message, statusCode: String(response.status) },
        };
      }

      return {
        data: { path, fullPath: `${this.bucket}/${path}` },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Upload failed',
        },
      };
    }
  }

  async remove(paths: string[]): Promise<StorageResponse<string[]>> {
    try {
      const token = await this.getAccessToken();
      const removed: string[] = [];
      for (const path of paths) {
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const url = joinUrl(
          this.apiBaseUrl,
          'storage/v1/object',
          this.bucket,
          path
        );
        const response = await fetch(url, { method: 'DELETE', headers });
        if (!response.ok && response.status !== 404) {
          const text = await response.text();
          return {
            data: null,
            error: { message: text || 'Delete failed', statusCode: String(response.status) },
          };
        }
        removed.push(path);
      }
      return { data: removed, error: null };
    } catch (error) {
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Delete failed',
        },
      };
    }
  }

  async createSignedUrl(
    path: string,
    expiresIn: number
  ): Promise<StorageResponse<{ signedUrl: string }>> {
    try {
      const token = await this.getAccessToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      const url = joinUrl(
        this.apiBaseUrl,
        'storage/v1/object/sign',
        this.bucket,
        path
      );
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ expiresIn }),
      });
      if (!response.ok) {
        const text = await response.text();
        return {
          data: null,
          error: { message: text || 'Sign failed', statusCode: String(response.status) },
        };
      }
      const json = (await response.json()) as { signedUrl?: string; signedURL?: string };
      const signedUrl = json.signedUrl || json.signedURL || '';
      return { data: { signedUrl }, error: null };
    } catch (error) {
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Sign failed',
        },
      };
    }
  }
}

export class SelfHostedStorageClient {
  constructor(
    private readonly apiBaseUrl: string,
    private readonly getAccessToken: AccessTokenProvider
  ) {}

  from(bucket: string): StorageBucketClient {
    return new StorageBucketClient(this.apiBaseUrl, bucket, this.getAccessToken);
  }
}

export function createStorageClient(
  apiBaseUrl: string,
  getAccessToken: AccessTokenProvider
): SelfHostedStorageClient {
  return new SelfHostedStorageClient(apiBaseUrl, getAccessToken);
}
