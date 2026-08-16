import { describe, expect, it, vi } from 'vitest';
import {
  SelfHostedRealtimeChannel,
  SelfHostedRealtimeClient,
} from './realtimeClient';

describe('SelfHostedRealtimeChannel local filtering', () => {
  it('invokes postgres_changes callbacks that match filters', () => {
    const client = {
      ensureConnected: vi.fn(),
      registerChannel: vi.fn(),
      getSocket: vi.fn(() => null),
      getChannels: vi.fn(() => []),
    } as unknown as SelfHostedRealtimeClient;

    const channel = new SelfHostedRealtimeChannel('retro-board-b1', client);
    const seen: string[] = [];
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'retro_votes', filter: 'board_id=eq.b1' },
      (payload) => {
        seen.push(String(payload.new.id));
      }
    );

    channel.handlePostgres({
      schema: 'public',
      table: 'retro_votes',
      eventType: 'INSERT',
      new: { id: 'v1', board_id: 'b1' },
      old: {},
    });
    channel.handlePostgres({
      schema: 'public',
      table: 'retro_votes',
      eventType: 'INSERT',
      new: { id: 'v2', board_id: 'other' },
      old: {},
    });

    expect(seen).toEqual(['v1']);
  });

  it('routes broadcast events by name', () => {
    const client = {
      ensureConnected: vi.fn(),
      registerChannel: vi.fn(),
      getSocket: vi.fn(() => null),
      getChannels: vi.fn(() => []),
    } as unknown as SelfHostedRealtimeClient;

    const channel = new SelfHostedRealtimeChannel('poker_session:s1', client);
    const events: string[] = [];
    channel.on('broadcast', { event: 'round_updated' }, ({ event }) => {
      events.push(event);
    });
    channel.handleBroadcast('round_updated', { x: 1 });
    channel.handleBroadcast('other', { x: 2 });
    expect(events).toEqual(['round_updated']);
  });

  it('updates presenceState on sync', () => {
    const client = {
      ensureConnected: vi.fn(),
      registerChannel: vi.fn(),
      getSocket: vi.fn(() => null),
      getChannels: vi.fn(() => []),
    } as unknown as SelfHostedRealtimeClient;

    const channel = new SelfHostedRealtimeChannel('retro-board-b1', client, {
      config: { presence: { key: 'u1' } },
    });
    let synced = false;
    channel.on('presence', { event: 'sync' }, () => {
      synced = true;
    });
    channel.handlePresence({
      event: 'sync',
      state: { u1: [{ user_id: 'u1' }] },
    });
    expect(synced).toBe(true);
    expect(channel.presenceState()).toEqual({ u1: [{ user_id: 'u1' }] });
  });
});
