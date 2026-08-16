/**
 * Map FE channel topics + table changes onto Socket.IO / logical rooms.
 * Rooms: `channel:{topic}`, `board:{id}`, `poker:{sessionId}`, `team:{id}`, `user:{id}`, `item:{id}`, `feature-flags`
 */

export function channelRoom(topic: string): string {
  return `channel:${topic}`;
}

/** Logical rooms a client should join when subscribing to a channel topic. */
export function roomsForChannelTopic(topic: string, userId?: string | null): string[] {
  const rooms = new Set<string>([channelRoom(topic)]);

  let match: RegExpMatchArray | null;

  if ((match = topic.match(/^retro-board-(.+)$/))) {
    rooms.add(`board:${match[1]}`);
  } else if ((match = topic.match(/^poker_session:(.+)$/))) {
    rooms.add(`poker:${match[1]}`);
  } else if ((match = topic.match(/^poker_session_rounds-changes-for-(.+)$/))) {
    rooms.add(`poker:${match[1]}`);
  } else if ((match = topic.match(/^poker_chat:(.+)$/))) {
    rooms.add(`poker:${match[1]}`);
  } else if ((match = topic.match(/^poker_chat_reactions:(.+)$/))) {
    rooms.add(`poker:${match[1]}`);
  } else if ((match = topic.match(/^team-action-items-(.+)$/))) {
    rooms.add(`team:${match[1]}`);
  } else if ((match = topic.match(/^team-action-items-tab-(.+)$/))) {
    rooms.add(`team:${match[1]}`);
  } else if ((match = topic.match(/^team-poker-sessions-(.+)$/))) {
    rooms.add(`team:${match[1]}`);
  } else if ((match = topic.match(/^team-poker-rounds-([0-9a-fA-F-]{36})/))) {
    rooms.add(`team:${match[1]}`);
  } else if ((match = topic.match(/^endorsements-(.+)$/))) {
    rooms.add(`board:${match[1]}`);
  } else if ((match = topic.match(/^tai-comments-(.+)$/))) {
    rooms.add(`item:${match[1]}`);
  } else if (topic === 'feature-flags-realtime') {
    rooms.add('feature-flags');
  } else if (topic === 'realtime:notifications' && userId) {
    rooms.add(`user:${userId}`);
  }

  return [...rooms];
}

function idOf(row: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!row) return null;
  const value = row[key];
  if (value === null || value === undefined) return null;
  return String(value);
}

/**
 * Derive fan-out rooms for a postgres change. Uses NEW for INSERT/UPDATE and OLD for DELETE.
 * Callers may pass `extraRooms` (e.g. board id looked up from retro_items for comments).
 */
export function roomsForTableChange(params: {
  table: string;
  newRow: Record<string, unknown> | null;
  oldRow: Record<string, unknown> | null;
  extraRooms?: string[];
}): string[] {
  const row = params.newRow ?? params.oldRow;
  const rooms = new Set<string>(params.extraRooms ?? []);

  switch (params.table) {
    case 'retro_items':
    case 'retro_votes':
    case 'retro_board_config':
    case 'endorsements': {
      const boardId = idOf(row, 'board_id');
      if (boardId) rooms.add(`board:${boardId}`);
      break;
    }
    case 'retro_comments': {
      const itemId = idOf(row, 'item_id');
      if (itemId) rooms.add(`item:${itemId}`);
      break;
    }
    case 'retro_boards': {
      const boardId = idOf(row, 'id');
      const teamId = idOf(row, 'team_id');
      if (boardId) rooms.add(`board:${boardId}`);
      if (teamId) rooms.add(`team:${teamId}`);
      break;
    }
    case 'poker_sessions': {
      const sessionId = idOf(row, 'id');
      const teamId = idOf(row, 'team_id');
      if (sessionId) rooms.add(`poker:${sessionId}`);
      if (teamId) rooms.add(`team:${teamId}`);
      break;
    }
    case 'poker_session_rounds':
    case 'poker_session_chat':
    case 'poker_session_chat_message_reactions': {
      const sessionId = idOf(row, 'session_id');
      if (sessionId) rooms.add(`poker:${sessionId}`);
      break;
    }
    case 'team_action_items': {
      const teamId = idOf(row, 'team_id');
      if (teamId) rooms.add(`team:${teamId}`);
      break;
    }
    case 'notifications': {
      const userId = idOf(row, 'user_id');
      if (userId) rooms.add(`user:${userId}`);
      break;
    }
    case 'feature_flags':
    case 'feature_flag_user_overrides':
    case 'feature_flag_team_overrides': {
      rooms.add('feature-flags');
      break;
    }
    default:
      break;
  }

  return [...rooms];
}
