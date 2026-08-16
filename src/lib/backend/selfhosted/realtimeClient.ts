import { io, type Socket } from 'socket.io-client';

export type RealtimeChannelStatus =
  | 'SUBSCRIBED'
  | 'TIMED_OUT'
  | 'CHANNEL_ERROR'
  | 'CLOSED';

type PostgresEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface PostgresChangeFilter {
  event: PostgresEvent;
  schema: string;
  table: string;
  filter?: string;
}

export interface PostgresChangePayload {
  schema: string;
  table: string;
  commit_timestamp?: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown>;
  old: Record<string, unknown>;
  errors?: unknown;
}

type PresenceEvent = 'sync' | 'join' | 'leave';
type BroadcastCallback = (message: { event: string; payload: unknown }) => void;
type PresenceCallback = (data: {
  key?: string;
  newPresences?: Record<string, unknown[]>;
  leftPresences?: Record<string, unknown[]>;
  currentPresences?: Record<string, unknown[]>;
}) => void;
type PostgresCallback = (payload: PostgresChangePayload) => void;
type SubscribeCallback = (status: RealtimeChannelStatus, err?: Error) => void | Promise<void>;

interface ChannelConfig {
  config?: {
    presence?: { key?: string };
  };
}

interface Binding {
  type: 'postgres_changes' | 'presence' | 'broadcast';
  filter: PostgresChangeFilter | { event: string } | { event: PresenceEvent };
  callback: PostgresCallback | PresenceCallback | BroadcastCallback;
}

/**
 * Minimal Supabase-compatible RealtimeChannel used by retro/poker hooks.
 */
export class SelfHostedRealtimeChannel {
  private bindings: Binding[] = [];
  private joined = false;
  private presenceKey: string | undefined;
  private localPresenceState: Record<string, Record<string, unknown>[]> = {};
  private status: RealtimeChannelStatus | 'CLOSED' = 'CLOSED';

  constructor(
    public readonly topic: string,
    private readonly client: SelfHostedRealtimeClient,
    private readonly channelConfig?: ChannelConfig
  ) {
    this.presenceKey = channelConfig?.config?.presence?.key;
  }

  on(
    type: 'postgres_changes',
    filter: PostgresChangeFilter,
    callback: PostgresCallback
  ): this;
  on(type: 'presence', filter: { event: PresenceEvent }, callback: PresenceCallback): this;
  on(type: 'broadcast', filter: { event: string }, callback: BroadcastCallback): this;
  on(
    type: 'postgres_changes' | 'presence' | 'broadcast',
    filter: PostgresChangeFilter | { event: string } | { event: PresenceEvent },
    callback: PostgresCallback | PresenceCallback | BroadcastCallback
  ): this {
    this.bindings.push({ type, filter, callback });
    return this;
  }

  subscribe(callback?: SubscribeCallback): this {
    void this.client.ensureConnected().then(async (socket) => {
      if (!socket) {
        this.status = 'CHANNEL_ERROR';
        await callback?.('CHANNEL_ERROR', new Error('No realtime socket'));
        return;
      }

      const pgBindings = this.bindings
        .filter((b) => b.type === 'postgres_changes')
        .map((b) => b.filter as PostgresChangeFilter);

      socket.emit(
        'channel:subscribe',
        {
          topic: this.topic,
          config: this.channelConfig?.config,
          bindings: pgBindings,
        },
        async (status: string) => {
          if (status === 'SUBSCRIBED') {
            this.joined = true;
            this.status = 'SUBSCRIBED';
            this.client.registerChannel(this);
            await callback?.('SUBSCRIBED');
          } else {
            this.status = 'CHANNEL_ERROR';
            await callback?.('CHANNEL_ERROR');
          }
        }
      );
    });
    return this;
  }

  async track(payload: Record<string, unknown>): Promise<'ok' | 'timed out' | 'error'> {
    const socket = await this.client.ensureConnected();
    if (!socket || !this.joined) return 'error';
    return new Promise((resolve) => {
      socket.emit(
        'presence:track',
        { topic: this.topic, key: this.presenceKey, payload },
        (ok: boolean) => resolve(ok ? 'ok' : 'error')
      );
    });
  }

  async untrack(): Promise<'ok' | 'timed out' | 'error'> {
    const socket = await this.client.ensureConnected();
    if (!socket) return 'error';
    return new Promise((resolve) => {
      socket.emit('presence:untrack', { topic: this.topic }, (ok: boolean) =>
        resolve(ok ? 'ok' : 'error')
      );
    });
  }

  presenceState(): Record<string, Record<string, unknown>[]> {
    return this.localPresenceState;
  }

  async send(args: {
    type: 'broadcast';
    event: string;
    payload?: unknown;
  }): Promise<'ok' | 'timed out' | 'error'> {
    const socket = await this.client.ensureConnected();
    if (!socket || !this.joined) return 'error';
    return new Promise((resolve) => {
      socket.emit(
        'broadcast:send',
        { topic: this.topic, event: args.event, payload: args.payload },
        (ok: boolean) => resolve(ok ? 'ok' : 'error')
      );
    });
  }

  /** @internal */
  handlePostgres(payload: PostgresChangePayload): void {
    for (const binding of this.bindings) {
      if (binding.type !== 'postgres_changes') continue;
      const filter = binding.filter as PostgresChangeFilter;
      if (filter.schema !== payload.schema || filter.table !== payload.table) continue;
      if (filter.event !== '*' && filter.event !== payload.eventType) continue;
      if (filter.filter) {
        const row =
          payload.eventType === 'DELETE' ? payload.old : payload.new ?? payload.old;
        if (!matchClientFilter(row, filter.filter)) continue;
      }
      (binding.callback as PostgresCallback)(payload);
    }
  }

  /** @internal */
  handlePresence(msg: {
    event: PresenceEvent;
    key?: string;
    state?: Record<string, Record<string, unknown>[]>;
    newPresences?: Record<string, unknown[]>;
    leftPresences?: Record<string, unknown[]>;
    currentPresences?: Record<string, unknown[]>;
  }): void {
    if (msg.state) {
      this.localPresenceState = msg.state;
    } else if (msg.currentPresences) {
      this.localPresenceState = msg.currentPresences as Record<string, Record<string, unknown>[]>;
    }

    for (const binding of this.bindings) {
      if (binding.type !== 'presence') continue;
      const filter = binding.filter as { event: PresenceEvent };
      if (filter.event !== msg.event) continue;
      (binding.callback as PresenceCallback)({
        key: msg.key,
        newPresences: msg.newPresences,
        leftPresences: msg.leftPresences,
        currentPresences: msg.currentPresences ?? this.localPresenceState,
      });
    }
  }

  /** @internal */
  handleBroadcast(event: string, payload: unknown): void {
    for (const binding of this.bindings) {
      if (binding.type !== 'broadcast') continue;
      const filter = binding.filter as { event: string };
      if (filter.event !== event) continue;
      (binding.callback as BroadcastCallback)({ event, payload });
    }
  }

  get isJoined(): boolean {
    return this.joined;
  }

  /** @internal */
  async teardown(): Promise<void> {
    const socket = this.client.getSocket();
    const siblingsStillJoined = this.client
      .getChannels()
      .some((c) => c !== this && c.topic === this.topic && c.isJoined);
    if (socket && this.joined && !siblingsStillJoined) {
      socket.emit('channel:unsubscribe', { topic: this.topic });
    }
    this.joined = false;
    this.status = 'CLOSED';
    this.bindings = [];
  }
}

function matchClientFilter(row: Record<string, unknown> | null | undefined, filter: string): boolean {
  if (!row) return false;
  const eqMatch = /^([^=]+)=eq\.(.+)$/.exec(filter);
  if (eqMatch) {
    const [, column, value] = eqMatch;
    return String(row[column.trim()]) === value.trim();
  }
  const inMatch = /^([^=]+)=in\.\((.+)\)$/.exec(filter);
  if (inMatch) {
    const [, column, list] = inMatch;
    const values = list.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    return values.includes(String(row[column.trim()]));
  }
  return true;
}

export class SelfHostedRealtimeClient {
  private socket: Socket | null = null;
  private connecting: Promise<Socket | null> | null = null;
  private channels: SelfHostedRealtimeChannel[] = [];

  constructor(
    private readonly apiBaseUrl: string,
    private readonly getAccessToken: () => Promise<string | null> | string | null
  ) {}

  channel(topic: string, opts?: ChannelConfig): SelfHostedRealtimeChannel {
    // Always create a new channel instance (Supabase allows multiple joins on one topic).
    const channel = new SelfHostedRealtimeChannel(topic, this, opts);
    this.channels.push(channel);
    return channel;
  }

  async removeChannel(channel: SelfHostedRealtimeChannel): Promise<'ok' | 'timed out' | 'error'> {
    await channel.teardown();
    this.channels = this.channels.filter((c) => c !== channel);
    return 'ok';
  }

  getChannels(): SelfHostedRealtimeChannel[] {
    return [...this.channels];
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  /** @internal */
  registerChannel(_channel: SelfHostedRealtimeChannel): void {
    // Channel already tracked at construction; keep hook for subscribe ack.
  }

  async ensureConnected(): Promise<Socket | null> {
    if (this.socket?.connected) return this.socket;
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      const token = await this.getAccessToken();
      const base = this.apiBaseUrl.replace(/\/$/, '');

      const socket = io(base, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        auth: { token: token ?? '' },
        autoConnect: true,
        reconnection: true,
      });

      this.socket = socket;
      this.bindSocketHandlers(socket);

      try {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error('Realtime connection timed out'));
          }, 10_000);
          socket.once('connect', () => {
            clearTimeout(timer);
            resolve();
          });
          socket.once('connect_error', (err) => {
            clearTimeout(timer);
            reject(err);
          });
        });
      } catch (err) {
        console.warn('[selfhosted realtime] connect failed', err);
        socket.disconnect();
        this.socket = null;
        return null;
      }

      return this.socket;
    })().finally(() => {
      this.connecting = null;
    });

    return this.connecting;
  }

  private channelsForTopic(topic: string): SelfHostedRealtimeChannel[] {
    return this.channels.filter((c) => c.topic === topic);
  }

  private bindSocketHandlers(socket: Socket): void {
    socket.on('postgres_changes', (msg: { topic: string; payload: PostgresChangePayload }) => {
      for (const channel of this.channelsForTopic(msg.topic)) {
        channel.handlePostgres(msg.payload);
      }
    });

    socket.on(
      'presence',
      (msg: {
        topic: string;
        event: PresenceEvent;
        key?: string;
        state?: Record<string, Record<string, unknown>[]>;
        newPresences?: Record<string, unknown[]>;
        currentPresences?: Record<string, unknown[]>;
      }) => {
        for (const channel of this.channelsForTopic(msg.topic)) {
          channel.handlePresence(msg);
        }
      }
    );

    socket.on('broadcast', (msg: { topic: string; event: string; payload: unknown }) => {
      for (const channel of this.channelsForTopic(msg.topic)) {
        channel.handleBroadcast(msg.event, msg.payload);
      }
    });

    socket.on('channel:status', (msg: { topic: string; status: RealtimeChannelStatus }) => {
      if (msg.status === 'CHANNEL_ERROR') {
        console.warn('[selfhosted realtime] channel error', msg.topic);
      }
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.channels = [];
  }
}

export function createRealtimeClient(
  apiBaseUrl: string,
  getAccessToken: () => Promise<string | null> | string | null
): SelfHostedRealtimeClient {
  return new SelfHostedRealtimeClient(apiBaseUrl, getAccessToken);
}
