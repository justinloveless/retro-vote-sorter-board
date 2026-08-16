import type { FastifyInstance } from 'fastify';
import { Server, type Socket } from 'socket.io';
import type { AppConfig } from '../config.js';
import { verifyAccessToken } from '../auth/jwt.js';
import {
  matchPostgresBinding,
  type PostgresChangeBinding,
  type PostgresChangeEvent,
} from './filters.js';
import { PostgresChangeListener, type NotifyChangePayload } from './pgListener.js';
import { PresenceStore, type PresencePayload } from './presence.js';
import { channelRoom, roomsForChannelTopic, roomsForTableChange } from './rooms.js';

export interface RealtimeGateway {
  io: Server;
  presence: PresenceStore;
  listener: PostgresChangeListener | null;
  close: () => Promise<void>;
  /** True when Socket.IO is up (LISTEN may still be reconnecting). */
  ok: () => boolean;
}

interface SocketMeta {
  userId: string;
  email?: string;
  /** topic → postgres bindings registered for that channel */
  bindings: Map<string, PostgresChangeBinding[]>;
  /** topic → number of active FE channel instances */
  topicRefs: Map<string, number>;
  /** topic → presence key currently tracked by this socket */
  presenceKeys: Map<string, string>;
  /** topics this socket has subscribed to */
  topics: Set<string>;
}

interface SubscribeMessage {
  topic: string;
  config?: {
    presence?: { key?: string };
  };
  bindings?: PostgresChangeBinding[];
}

interface TrackMessage {
  topic: string;
  key?: string;
  payload: PresencePayload;
}

interface BroadcastMessage {
  topic: string;
  event: string;
  payload?: unknown;
}

function getMeta(socket: Socket): SocketMeta {
  return socket.data.realtime as SocketMeta;
}

async function authenticateSocket(
  socket: Socket,
  config: AppConfig
): Promise<{ userId: string; email?: string } | null> {
  const authToken =
    (socket.handshake.auth?.token as string | undefined) ||
    (typeof socket.handshake.headers.authorization === 'string'
      ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
      : undefined);

  if (!authToken) {
    return null;
  }

  if (!config.JWT_SECRET) {
    // Dev without JWT: accept opaque token as anonymous-authenticated for dual-path smoke.
    return { userId: 'anonymous' };
  }

  try {
    const claims = await verifyAccessToken(authToken, config.JWT_SECRET);
    return { userId: claims.sub, email: claims.email };
  } catch {
    // Dual-path: hosted Supabase JWTs are not signed with our secret.
    // Allow connection with a stable opaque id derived from token prefix so
    // presence still works; postgres fan-out is filter-scoped.
    const opaque = `hosted:${authToken.slice(0, 12)}`;
    return { userId: opaque };
  }
}

function toClientChange(change: NotifyChangePayload): PostgresChangeEvent {
  return {
    schema: change.schema,
    table: change.table,
    eventType: change.event,
    new: change.new,
    old: change.old,
  };
}

function supabaseStylePayload(change: PostgresChangeEvent) {
  return {
    schema: change.schema,
    table: change.table,
    commit_timestamp: new Date().toISOString(),
    eventType: change.eventType,
    new: change.new,
    old: change.old,
    errors: null,
  };
}

function bindingKey(b: PostgresChangeBinding): string {
  return `${b.event}|${b.schema}|${b.table}|${b.filter ?? ''}`;
}

function mergeBindings(
  prev: PostgresChangeBinding[],
  incoming: PostgresChangeBinding[]
): PostgresChangeBinding[] {
  const map = new Map<string, PostgresChangeBinding>();
  for (const b of prev) map.set(bindingKey(b), b);
  for (const b of incoming) map.set(bindingKey(b), b);
  return [...map.values()];
}

export async function attachRealtimeGateway(
  app: FastifyInstance,
  config: AppConfig
): Promise<RealtimeGateway> {
  // Must run after app.listen() so app.server exists and Fastify has finished booting.
  // Do not call app.ready()/addHook here — Fastify rejects both after start/boot.
  if (!app.server) {
    throw new Error('Realtime gateway requires app.server; call after app.listen()');
  }

  const io = new Server(app.server, {
    path: '/socket.io',
    cors: {
      origin: config.allowOrigins.includes('*') ? true : config.allowOrigins,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  const presence = new PresenceStore();
  let listener: PostgresChangeListener | null = null;

  const fanOutPostgresChange = (raw: NotifyChangePayload) => {
    const change = toClientChange(raw);
    const changeRooms = roomsForTableChange({
      table: raw.table,
      newRow: raw.new,
      oldRow: raw.old,
      extraRooms: raw.rooms,
    });
    const payload = supabaseStylePayload(change);

    for (const socket of io.sockets.sockets.values()) {
      const meta = socket.data.realtime as SocketMeta | undefined;
      if (!meta) continue;

      for (const [topic, bindings] of meta.bindings) {
        if (!meta.topics.has(topic)) continue;
        if (!bindings.some((b) => matchPostgresBinding(b, change))) continue;

        // When we know logical rooms for the row, require the socket joined one.
        // Bindings with an explicit filter may still match across rooms (e.g. in.(...)).
        if (changeRooms.length > 0) {
          const inChangeRoom = changeRooms.some((room) => socket.rooms.has(room));
          const bindingHasFilter = bindings.some(
            (b) => matchPostgresBinding(b, change) && Boolean(b.filter)
          );
          if (!inChangeRoom && !bindingHasFilter) continue;
        }

        socket.emit('postgres_changes', { topic, payload });
      }
    }
  };

  if (config.DATABASE_URL) {
    listener = new PostgresChangeListener(config, fanOutPostgresChange, app.log);
    await listener.start();
  } else {
    app.log.warn('Realtime gateway started without DATABASE_URL (no LISTEN)');
  }

  io.use(async (socket, next) => {
    try {
      const identity = await authenticateSocket(socket, config);
      if (!identity) {
        next(new Error('Unauthorized'));
        return;
      }
      socket.data.realtime = {
        userId: identity.userId,
        email: identity.email,
        bindings: new Map(),
        topicRefs: new Map(),
        presenceKeys: new Map(),
        topics: new Set(),
      } satisfies SocketMeta;
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const meta = getMeta(socket);
    app.log.debug({ socketId: socket.id, userId: meta.userId }, 'Realtime socket connected');

    socket.on('channel:subscribe', (msg: SubscribeMessage, ack?: (status: string) => void) => {
      try {
        if (!msg?.topic || typeof msg.topic !== 'string') {
          ack?.('CHANNEL_ERROR');
          return;
        }
        const topic = msg.topic;
        meta.topics.add(topic);
        meta.topicRefs.set(topic, (meta.topicRefs.get(topic) ?? 0) + 1);

        const incoming = Array.isArray(msg.bindings) ? msg.bindings : [];
        const prev = meta.bindings.get(topic) ?? [];
        meta.bindings.set(topic, mergeBindings(prev, incoming));

        for (const room of roomsForChannelTopic(topic, meta.userId)) {
          void socket.join(room);
        }

        // Presence key hint from channel config (Supabase presence.key)
        if (msg.config?.presence?.key) {
          meta.presenceKeys.set(topic, msg.config.presence.key);
        }

        socket.emit('channel:status', { topic, status: 'SUBSCRIBED' });
        ack?.('SUBSCRIBED');
      } catch (error) {
        app.log.warn({ err: error }, 'channel:subscribe failed');
        ack?.('CHANNEL_ERROR');
      }
    });

    socket.on('channel:unsubscribe', (msg: { topic?: string }) => {
      if (!msg?.topic) return;
      const topic = msg.topic;
      const refs = (meta.topicRefs.get(topic) ?? 1) - 1;
      if (refs > 0) {
        meta.topicRefs.set(topic, refs);
        return;
      }

      meta.topicRefs.delete(topic);
      meta.topics.delete(topic);
      meta.bindings.delete(topic);

      const presenceKey = meta.presenceKeys.get(topic);
      if (presenceKey) {
        presence.untrack(topic, presenceKey, socket.id);
        meta.presenceKeys.delete(topic);
        io.to(channelRoom(topic)).emit('presence', {
          topic,
          event: 'leave',
          key: presenceKey,
          currentPresences: presence.state(topic),
        });
        io.to(channelRoom(topic)).emit('presence', {
          topic,
          event: 'sync',
          state: presence.state(topic),
        });
      }

      for (const room of roomsForChannelTopic(topic, meta.userId)) {
        void socket.leave(room);
      }
    });

    socket.on('presence:track', (msg: TrackMessage, ack?: (ok: boolean) => void) => {
      try {
        if (!msg?.topic) {
          ack?.(false);
          return;
        }
        const key =
          (typeof msg.key === 'string' && msg.key) ||
          meta.presenceKeys.get(msg.topic) ||
          meta.userId;
        meta.presenceKeys.set(msg.topic, key);
        presence.track(msg.topic, key, socket.id, msg.payload ?? {});

        io.to(channelRoom(msg.topic)).emit('presence', {
          topic: msg.topic,
          event: 'join',
          key,
          newPresences: { [key]: [msg.payload ?? {}] },
          currentPresences: presence.state(msg.topic),
        });
        io.to(channelRoom(msg.topic)).emit('presence', {
          topic: msg.topic,
          event: 'sync',
          state: presence.state(msg.topic),
        });
        ack?.(true);
      } catch {
        ack?.(false);
      }
    });

    socket.on('presence:untrack', (msg: { topic?: string }, ack?: (ok: boolean) => void) => {
      try {
        if (!msg?.topic) {
          ack?.(false);
          return;
        }
        const key = meta.presenceKeys.get(msg.topic) || meta.userId;
        presence.untrack(msg.topic, key, socket.id);
        meta.presenceKeys.delete(msg.topic);
        io.to(channelRoom(msg.topic)).emit('presence', {
          topic: msg.topic,
          event: 'leave',
          key,
          currentPresences: presence.state(msg.topic),
        });
        io.to(channelRoom(msg.topic)).emit('presence', {
          topic: msg.topic,
          event: 'sync',
          state: presence.state(msg.topic),
        });
        ack?.(true);
      } catch {
        ack?.(false);
      }
    });

    socket.on('broadcast:send', (msg: BroadcastMessage, ack?: (ok: boolean) => void) => {
      try {
        if (!msg?.topic || !msg.event) {
          ack?.(false);
          return;
        }
        io.to(channelRoom(msg.topic)).emit('broadcast', {
          topic: msg.topic,
          event: msg.event,
          payload: msg.payload,
        });
        ack?.(true);
      } catch {
        ack?.(false);
      }
    });

    socket.on('disconnect', () => {
      const affected = presence.untrackSocket(socket.id);
      const topics = new Set(affected.map((a) => a.topic));
      for (const topic of topics) {
        const keys = affected.filter((a) => a.topic === topic).map((a) => a.key);
        for (const key of keys) {
          io.to(channelRoom(topic)).emit('presence', {
            topic,
            event: 'leave',
            key,
            currentPresences: presence.state(topic),
          });
        }
        io.to(channelRoom(topic)).emit('presence', {
          topic,
          event: 'sync',
          state: presence.state(topic),
        });
      }
    });
  });

  const gateway: RealtimeGateway = {
    io,
    presence,
    listener,
    ok: () => true,
    close: async () => {
      await listener?.stop();
      await new Promise<void>((resolve) => {
        io.close(() => resolve());
      });
    },
  };

  app.log.info('Realtime Socket.IO gateway attached at /socket.io');
  return gateway;
}
