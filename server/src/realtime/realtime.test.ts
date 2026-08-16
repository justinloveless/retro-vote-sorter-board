import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { matchFilterClause, matchPostgresBinding } from './filters.js';
import { roomsForChannelTopic, roomsForTableChange } from './rooms.js';
import { PresenceStore } from './presence.js';

describe('matchFilterClause', () => {
  it('matches eq filters', () => {
    assert.equal(matchFilterClause({ board_id: 'abc' }, 'board_id=eq.abc'), true);
    assert.equal(matchFilterClause({ board_id: 'abc' }, 'board_id=eq.xyz'), false);
  });

  it('matches in filters', () => {
    assert.equal(matchFilterClause({ session_id: 's2' }, 'session_id=in.(s1,s2,s3)'), true);
    assert.equal(matchFilterClause({ session_id: 's9' }, 'session_id=in.(s1,s2)'), false);
  });

  it('allows empty filter', () => {
    assert.equal(matchFilterClause({ a: 1 }, undefined), true);
  });
});

describe('matchPostgresBinding', () => {
  it('respects event and table', () => {
    const binding = {
      event: '*' as const,
      schema: 'public',
      table: 'retro_votes',
      filter: 'board_id=eq.b1',
    };
    assert.equal(
      matchPostgresBinding(binding, {
        schema: 'public',
        table: 'retro_votes',
        eventType: 'INSERT',
        new: { board_id: 'b1', id: 'v1' },
        old: null,
      }),
      true
    );
    assert.equal(
      matchPostgresBinding(binding, {
        schema: 'public',
        table: 'retro_items',
        eventType: 'INSERT',
        new: { board_id: 'b1' },
        old: null,
      }),
      false
    );
  });

  it('uses old row for DELETE', () => {
    const binding = {
      event: 'DELETE' as const,
      schema: 'public',
      table: 'notifications',
      filter: 'user_id=eq.u1',
    };
    assert.equal(
      matchPostgresBinding(binding, {
        schema: 'public',
        table: 'notifications',
        eventType: 'DELETE',
        new: null,
        old: { user_id: 'u1', id: 'n1' },
      }),
      true
    );
  });
});

describe('roomsForChannelTopic', () => {
  it('maps retro and poker topics', () => {
    const retro = roomsForChannelTopic('retro-board-b1');
    assert.ok(retro.includes('channel:retro-board-b1'));
    assert.ok(retro.includes('board:b1'));

    const poker = roomsForChannelTopic('poker_session:s1');
    assert.ok(poker.includes('poker:s1'));

    const notif = roomsForChannelTopic('realtime:notifications', 'u1');
    assert.ok(notif.includes('user:u1'));
  });
});

describe('roomsForTableChange', () => {
  it('derives board and poker rooms', () => {
    assert.deepEqual(
      roomsForTableChange({
        table: 'retro_votes',
        newRow: { board_id: 'b1' },
        oldRow: null,
      }),
      ['board:b1']
    );
    const rooms = roomsForTableChange({
      table: 'poker_session_rounds',
      newRow: { session_id: 's1' },
      oldRow: null,
      extraRooms: ['team:t1'],
    });
    assert.ok(rooms.includes('poker:s1'));
    assert.ok(rooms.includes('team:t1'));
  });
});

describe('PresenceStore', () => {
  it('tracks sync and leave', () => {
    const store = new PresenceStore();
    store.track('retro-board-1', 'user-a', 'sock1', { user_id: 'user-a' });
    store.track('retro-board-1', 'user-b', 'sock2', { user_id: 'user-b' });
    assert.deepEqual(Object.keys(store.state('retro-board-1')).sort(), ['user-a', 'user-b']);
    store.untrackSocket('sock1');
    assert.deepEqual(Object.keys(store.state('retro-board-1')), ['user-b']);
  });
});
