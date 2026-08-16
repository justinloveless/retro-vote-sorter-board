import type { Server } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config.js';
import { attachRealtimeGateway, type RealtimeGateway } from './gateway.js';

export type { RealtimeGateway } from './gateway.js';
export { matchFilterClause, matchPostgresBinding } from './filters.js';
export { roomsForChannelTopic, roomsForTableChange, channelRoom } from './rooms.js';
export { PresenceStore } from './presence.js';

let gateway: RealtimeGateway | null = null;

export function getRealtimeGateway(): RealtimeGateway | null {
  return gateway;
}

export async function registerRealtime(app: FastifyInstance, config: AppConfig): Promise<RealtimeGateway> {
  gateway = await attachRealtimeGateway(app, config);
  return gateway;
}

export function realtimeHealth(): { ok: boolean; error?: string } {
  if (!gateway) {
    return { ok: false, error: 'Realtime gateway not started' };
  }
  if (gateway.listener && !gateway.listener.listening) {
    return { ok: false, error: 'Postgres LISTEN not connected' };
  }
  if (!gateway.listener) {
    return { ok: true, error: 'Socket.IO up; LISTEN skipped (no DATABASE_URL)' };
  }
  return { ok: true };
}

/** Test helper */
export function getRealtimeIo(): Server | null {
  return gateway?.io ?? null;
}
