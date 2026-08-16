/**
 * In-memory presence for a single Node API instance.
 * Scale-out later can swap this for a Redis adapter.
 */

export type PresencePayload = Record<string, unknown>;

/** presenceState shape matches Supabase: { [key]: PresencePayload[] } */
export type PresenceState = Record<string, PresencePayload[]>;

interface TrackedPresence {
  key: string;
  payload: PresencePayload;
  socketId: string;
}

export class PresenceStore {
  /** topic → key → socketId → payload (multiple sockets can share a presence key) */
  private byTopic = new Map<string, Map<string, Map<string, PresencePayload>>>();

  track(topic: string, key: string, socketId: string, payload: PresencePayload): void {
    let keys = this.byTopic.get(topic);
    if (!keys) {
      keys = new Map();
      this.byTopic.set(topic, keys);
    }
    let sockets = keys.get(key);
    if (!sockets) {
      sockets = new Map();
      keys.set(key, sockets);
    }
    sockets.set(socketId, payload);
  }

  untrack(topic: string, key: string, socketId: string): boolean {
    const keys = this.byTopic.get(topic);
    if (!keys) return false;
    const sockets = keys.get(key);
    if (!sockets) return false;
    const existed = sockets.delete(socketId);
    if (sockets.size === 0) keys.delete(key);
    if (keys.size === 0) this.byTopic.delete(topic);
    return existed;
  }

  /** Remove all presence entries for a disconnected socket. Returns affected topics. */
  untrackSocket(socketId: string): Array<{ topic: string; key: string }> {
    const affected: Array<{ topic: string; key: string }> = [];
    for (const [topic, keys] of this.byTopic) {
      for (const [key, sockets] of keys) {
        if (sockets.delete(socketId)) {
          affected.push({ topic, key });
          if (sockets.size === 0) keys.delete(key);
        }
      }
      if (keys.size === 0) this.byTopic.delete(topic);
    }
    return affected;
  }

  state(topic: string): PresenceState {
    const keys = this.byTopic.get(topic);
    if (!keys) return {};
    const result: PresenceState = {};
    for (const [key, sockets] of keys) {
      result[key] = [...sockets.values()];
    }
    return result;
  }

  list(topic: string): TrackedPresence[] {
    const keys = this.byTopic.get(topic);
    if (!keys) return [];
    const out: TrackedPresence[] = [];
    for (const [key, sockets] of keys) {
      for (const [socketId, payload] of sockets) {
        out.push({ key, payload, socketId });
      }
    }
    return out;
  }
}
