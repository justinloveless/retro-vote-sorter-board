import type pg from 'pg';
import type { AppConfig } from '../config.js';
import { getPool } from '../lib/db.js';

export const REALTIME_NOTIFY_CHANNEL = 'retroscope_changes';

export interface NotifyChangePayload {
  schema: string;
  table: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
  /** Optional rooms computed in SQL (board lookup for comments, team for rounds). */
  rooms?: string[];
}

export type NotifyHandler = (change: NotifyChangePayload) => void;

type RealtimeLog = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
};

/**
 * Dedicated Postgres connection that LISTENs for trigger NOTIFY payloads.
 */
export class PostgresChangeListener {
  private client: pg.PoolClient | null = null;
  private stopped = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly config: AppConfig,
    private readonly onChange: NotifyHandler,
    private readonly log: RealtimeLog
  ) {}

  async start(): Promise<void> {
    this.stopped = false;
    await this.connect();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.client) {
      try {
        this.client.removeAllListeners('notification');
        this.client.removeAllListeners('error');
        await this.client.query(`UNLISTEN ${REALTIME_NOTIFY_CHANNEL}`);
      } catch {
        // ignore
      }
      this.client.release();
      this.client = null;
    }
  }

  get listening(): boolean {
    return this.client !== null && !this.stopped;
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;

    const pool = getPool(this.config);
    if (!pool) {
      this.log.warn('Realtime LISTEN skipped: DATABASE_URL not configured');
      return;
    }

    try {
      const client = await pool.connect();
      this.client = client;

      client.on('notification', (msg) => {
        if (msg.channel !== REALTIME_NOTIFY_CHANNEL || !msg.payload) return;
        try {
          const parsed = JSON.parse(msg.payload) as NotifyChangePayload;
          if (!parsed?.table || !parsed?.event) return;
          this.onChange({
            schema: parsed.schema || 'public',
            table: parsed.table,
            event: parsed.event,
            new: parsed.new ?? null,
            old: parsed.old ?? null,
            rooms: parsed.rooms,
          });
        } catch (error) {
          this.log.warn({ err: error, payload: msg.payload }, 'Invalid realtime NOTIFY payload');
        }
      });

      client.on('error', (err) => {
        this.log.error({ err }, 'Realtime LISTEN client error');
        void this.scheduleReconnect();
      });

      await client.query(`LISTEN ${REALTIME_NOTIFY_CHANNEL}`);
      this.log.info({ channel: REALTIME_NOTIFY_CHANNEL }, 'Realtime LISTEN started');
    } catch (error) {
      this.log.error({ err: error }, 'Failed to start realtime LISTEN');
      void this.scheduleReconnect();
    }
  }

  private async scheduleReconnect(): Promise<void> {
    if (this.stopped) return;
    if (this.client) {
      try {
        this.client.release(true);
      } catch {
        // ignore
      }
      this.client = null;
    }
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, 2_000);
  }
}
