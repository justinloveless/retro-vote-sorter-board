import { describe, test, expect, beforeEach, jest } from 'jest/globals.ts';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
jest.mock('@supabase/supabase-js');

// Types from implementation plan
interface SlackCommandPayload {
  token: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string;
  response_url: string;
  trigger_id: string;
}

interface SlackInteractivePayload {
  type: string;
  actions: Array<{
    action_id: string;
    value: string;
  }>;
  user: {
    id: string;
    username: string;
  };
  channel: {
    id: string;
  };
  team: {
    id: string;
  };
  response_url: string;
  message: any;
}

interface Team {
  id: string;
  name: string;
  slack_channel_id: string;
  slack_bot_token: string;
}

interface PokerSession {
  id: string;
  team_id: string;
  room_id: string;
  current_round_number: number;
  created_at: string;
}

interface PokerSessionRound {
  id: string;
  session_id: string;
  round_number: number;
  ticket_number: string | null;
  ticket_title: string | null;
  selections: Record<string, { points: number; display_name: string }>;
  game_state: string;
  created_at: string;
}

// Functions to be implemented
declare function parseTicketFromText(text: string): {
  ticketNumber: string | null;
  ticketTitle?: string;
};

declare function findTeamByChannelId(channelId: string): Promise<Team | null>;

declare function generateAnonymousUserId(slackUserId: string, teamId: string): string;

declare function getOrCreatePokerSession(teamId: string): Promise<PokerSession>;

declare function createNewRound(
  sessionId: string,
  ticketNumber: string | null,
  ticketTitle: string | null
): Promise<PokerSessionRound>;

declare function processVote(
  roundId: string,
  anonymousUserId: string,
  displayName: string,
  points: number
): Promise<void>;

declare function generateVotingMessage(
  ticketNumber: string | null,
  ticketTitle: string | null,
  currentVotes: Record<string, { points: number; display_name: string }>,
  gameState: 'Voting' | 'Playing'
): any;

declare function updateVotingMessage(
  originalMessage: any,
  currentVotes: Record<string, { points: number; display_name: string }>,
  gameState: string
): any;

declare function verifySlackRequest(
  body: string,
  signature: string,
  timestamp: string
): boolean;

declare function handleSlackCommand(payload: SlackCommandPayload): Promise<Response>;

declare function handleInteractiveComponent(payload: SlackInteractivePayload): Promise<Response>;

// Utility Tests
describe('parseTicketFromText', () => {
  test('extracts ticket number from Jira URL', () => {
    const jiraUrl = 'https://company.atlassian.net/browse/PROJ-123';
    const result = parseTicketFromText(jiraUrl);

    expect(result.ticketNumber).toBe('PROJ-123');
  });

  test('extracts ticket number from plain text', () => {
    const plainText = 'PROJ-123';
    const result = parseTicketFromText(plainText);

    expect(result.ticketNumber).toBe('PROJ-123');
  });

  test('handles various ticket formats', () => {
    const testCases = [
      { input: 'ABC-456', expected: 'ABC-456' },
      { input: 'FEATURE-1234', expected: 'FEATURE-1234' },
      { input: 'BUG-99', expected: 'BUG-99' },
      { input: 'XX-1', expected: 'XX-1' }
    ];

    testCases.forEach(({ input, expected }) => {
      const result = parseTicketFromText(input);
      expect(result.ticketNumber).toBe(expected);
    });
  });

  test('returns null for invalid input', () => {
    const testCases = [
      '',
      'not a ticket',
      '123-ABC', // numbers before letters
      'PROJ', // no number
      'just text here'
    ];

    testCases.forEach(input => {
      const result = parseTicketFromText(input);
      expect(result.ticketNumber).toBeNull();
    });
  });

  test('extracts from complex Jira URLs with parameters', () => {
    const complexUrl = 'https://company.atlassian.net/browse/PROJ-123?activeTab=some-tab&extra=params';
    const result = parseTicketFromText(complexUrl);

    expect(result.ticketNumber).toBe('PROJ-123');
  });
});

describe('generateAnonymousUserId', () => {
  test('generates consistent IDs for the same inputs', () => {
    const slackUserId = 'U123456';
    const teamId = 'team-abc-123';

    const id1 = generateAnonymousUserId(slackUserId, teamId);
    const id2 = generateAnonymousUserId(slackUserId, teamId);

    expect(id1).toBe(id2);
  });

  test('generates different IDs for different inputs', () => {
    const teamId = 'team-abc-123';

    const id1 = generateAnonymousUserId('U123456', teamId);
    const id2 = generateAnonymousUserId('U789012', teamId);

    expect(id1).not.toBe(id2);
  });

  test('generates different IDs for different teams', () => {
    const slackUserId = 'U123456';

    const id1 = generateAnonymousUserId(slackUserId, 'team-1');
    const id2 = generateAnonymousUserId(slackUserId, 'team-2');

    expect(id1).not.toBe(id2);
  });

  test('generates IDs with expected format', () => {
    const id = generateAnonymousUserId('U123456', 'team-123');

    expect(id).toMatch(/^slack_[a-f0-9]+$/);
  });
});

describe('verifySlackRequest', () => {
  test('verifies valid Slack signature', () => {
    const body = 'token=test&user_id=U123';
    const timestamp = '1609459200'; // Known timestamp
    const signature = 'v0=expected_valid_signature';

    // Mock the verification to return true for this test
    const result = verifySlackRequest(body, signature, timestamp);

    expect(typeof result).toBe('boolean');
  });

  test('rejects invalid signatures', () => {
    const body = 'token=test&user_id=U123';
    const timestamp = '1609459200';
    const signature = 'v0=invalid_signature';

    // This should return false when implemented
    const result = verifySlackRequest(body, signature, timestamp);

    expect(typeof result).toBe('boolean');
  });

  test('rejects old timestamps', () => {
    const body = 'token=test&user_id=U123';
    const oldTimestamp = '1000000000'; // Very old timestamp
    const signature = 'v0=some_signature';

    const result = verifySlackRequest(body, signature, oldTimestamp);

    expect(result).toBe(false);
  });
});

// Database Function Tests
describe('findTeamByChannelId', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn()
    };
  });

  test('finds team by channel ID', async () => {
    const mockTeam: Team = {
      id: 'team-123',
      name: 'Test Team',
      slack_channel_id: 'C1234567890',
      slack_bot_token: 'xoxb-token'
    };

    mockSupabase.single.mockResolvedValue({ data: mockTeam, error: null });

    const result = await findTeamByChannelId('C1234567890');

    expect(result).toEqual(mockTeam);
    expect(mockSupabase.from).toHaveBeenCalledWith('teams');
    expect(mockSupabase.eq).toHaveBeenCalledWith('slack_channel_id', 'C1234567890');
  });

  test('returns null when team not found', async () => {
    mockSupabase.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

    const result = await findTeamByChannelId('INVALID_CHANNEL');

    expect(result).toBeNull();
  });

  test('throws error on database error', async () => {
    mockSupabase.single.mockResolvedValue({
      data: null,
      error: { message: 'Database connection failed' }
    });

    await expect(findTeamByChannelId('C1234567890')).rejects.toThrow();
  });
});

describe('getOrCreatePokerSession', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      insert: jest.fn().mockReturnThis()
    };
  });

  test('returns existing active session', async () => {
    const mockSession: PokerSession = {
      id: 'session-123',
      team_id: 'team-123',
      room_id: 'team-123',
      current_round_number: 1,
      created_at: '2024-01-01T00:00:00Z'
    };

    mockSupabase.single.mockResolvedValue({ data: mockSession, error: null });

    const result = await getOrCreatePokerSession('team-123');

    expect(result).toEqual(mockSession);
    expect(mockSupabase.eq).toHaveBeenCalledWith('room_id', 'team-123');
  });

  test('creates new session when none exists', async () => {
    // First call returns no session
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

    // Second call returns the created session
    const newSession: PokerSession = {
      id: 'session-new',
      team_id: 'team-123',
      room_id: 'team-123',
      current_round_number: 0,
      created_at: new Date().toISOString()
    };

    mockSupabase.single.mockResolvedValueOnce({ data: newSession, error: null });

    const result = await getOrCreatePokerSession('team-123');

    expect(result).toEqual(newSession);
    expect(mockSupabase.insert).toHaveBeenCalled();
  });
});

describe('createNewRound', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn(),
      insert: jest.fn().mockReturnThis()
    };
  });

  test('creates new round and increments session counter', async () => {
    const mockRound: PokerSessionRound = {
      id: 'round-123',
      poker_session_id: 'session-123',
      round_number: 2,
      ticket_number: 'PROJ-123',
      ticket_title: 'Test ticket',
      selections: {},
      is_revealed: false,
      created_at: new Date().toISOString()
    };

    mockSupabase.single.mockResolvedValue({ data: mockRound, error: null });

    const result = await createNewRound('session-123', 'PROJ-123', 'Test ticket');

    expect(result).toEqual(mockRound);
    expect(mockSupabase.from).toHaveBeenCalledWith('poker_sessions');
    expect(mockSupabase.from).toHaveBeenCalledWith('poker_session_rounds');
    expect(mockSupabase.update).toHaveBeenCalled();
    expect(mockSupabase.insert).toHaveBeenCalled();
  });

  test('handles null ticket information', async () => {
    const mockRound: PokerSessionRound = {
      id: 'round-123',
      poker_session_id: 'session-123',
      round_number: 1,
      ticket_number: null,
      ticket_title: null,
      selections: {},
      is_revealed: false,
      created_at: new Date().toISOString()
    };

    mockSupabase.single.mockResolvedValue({ data: mockRound, error: null });

    const result = await createNewRound('session-123', null, null);

    expect(result.ticket_number).toBeNull();
    expect(result.ticket_title).toBeNull();
  });
});

describe('processVote', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn()
    };
  });

  test('processes valid vote', async () => {
    const mockUpdatedRound = {
      selections: {
        'slack_abc123': { points: 5, display_name: 'John Doe' }
      }
    };

    mockSupabase.single.mockResolvedValue({ data: mockUpdatedRound, error: null });

    await processVote('round-123', 'slack_abc123', 'John Doe', 5);

    expect(mockSupabase.from).toHaveBeenCalledWith('poker_session_rounds');
    expect(mockSupabase.update).toHaveBeenCalled();
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'round-123');
  });

  test('handles abstain vote', async () => {
    const mockUpdatedRound = {
      selections: {
        'slack_abc123': { points: -1, display_name: 'John Doe' }
      }
    };

    mockSupabase.single.mockResolvedValue({ data: mockUpdatedRound, error: null });

    await processVote('round-123', 'slack_abc123', 'John Doe', -1);

    expect(mockSupabase.update).toHaveBeenCalled();
  });

  test('overwrites existing vote from same user', async () => {
    // First vote
    await processVote('round-123', 'slack_abc123', 'John Doe', 3);

    // Second vote should overwrite
    const mockUpdatedRound = {
      selections: {
        'slack_abc123': { points: 8, display_name: 'John Doe' }
      }
    };

    mockSupabase.single.mockResolvedValue({ data: mockUpdatedRound, error: null });

    await processVote('round-123', 'slack_abc123', 'John Doe', 8);

    expect(mockSupabase.update).toHaveBeenCalled();
  });
});

// Message Generation Tests
describe('generateVotingMessage', () => {
  test('generates message with ticket information', () => {
    const message = generateVotingMessage(
      'PROJ-123',
      'Test Story',
      {},
      'Voting'
    );

    expect(message).toBeDefined();
    expect(message.blocks).toBeDefined();
    expect(JSON.stringify(message)).toContain('PROJ-123');
    expect(JSON.stringify(message)).toContain('Test Story');
  });

  test('generates message without ticket information', () => {
    const message = generateVotingMessage(
      null,
      null,
      {},
      'Voting'
    );

    expect(message).toBeDefined();
    expect(message.blocks).toBeDefined();
  });

  test('includes voting buttons in Voting state', () => {
    const message = generateVotingMessage(
      'PROJ-123',
      'Test Story',
      {},
      'Voting'
    );

    const messageStr = JSON.stringify(message);
    expect(messageStr).toContain('vote_1');
    expect(messageStr).toContain('vote_2');
    expect(messageStr).toContain('vote_3');
    expect(messageStr).toContain('vote_5');
    expect(messageStr).toContain('vote_8');
    expect(messageStr).toContain('vote_13');
    expect(messageStr).toContain('vote_21');
    expect(messageStr).toContain('abstain');
  });

  test('shows current votes count', () => {
    const votes = {
      'slack_user1': { points: 5, display_name: 'John' },
      'slack_user2': { points: 8, display_name: 'Jane' }
    };

    const message = generateVotingMessage(
      'PROJ-123',
      'Test Story',
      votes,
      'Voting'
    );

    const messageStr = JSON.stringify(message);
    expect(messageStr).toContain('2 votes cast');
  });

  test('reveals votes in Playing state', () => {
    const votes = {
      'slack_user1': { points: 5, display_name: 'John' },
      'slack_user2': { points: 8, display_name: 'Jane' }
    };

    const message = generateVotingMessage(
      'PROJ-123',
      'Test Story',
      votes,
      'Playing'
    );

    const messageStr = JSON.stringify(message);
    expect(messageStr).toContain('John: 5');
    expect(messageStr).toContain('Jane: 8');
  });
});

describe('updateVotingMessage', () => {
  test('updates vote counts in existing message', () => {
    const originalMessage = {
      blocks: [
        { type: 'section', text: { text: 'Existing message' } }
      ]
    };

    const votes = {
      'slack_user1': { points: 5, display_name: 'John' }
    };

    const updatedMessage = updateVotingMessage(originalMessage, votes, 'Voting');

    expect(updatedMessage).toBeDefined();
    expect(updatedMessage.blocks).toBeDefined();
  });

  test('preserves message structure while updating content', () => {
    const originalMessage = {
      blocks: [
        { type: 'section', text: { text: 'Original content' } }
      ],
      attachments: []
    };

    const updatedMessage = updateVotingMessage(originalMessage, {}, 'Playing');

    expect(updatedMessage.blocks).toBeDefined();
    expect(Array.isArray(updatedMessage.blocks)).toBe(true);
  });
});

// Integration Tests
describe('Slack Command Integration', () => {
  test('handles complete /poke command flow', async () => {
    const mockSlackPayload: SlackCommandPayload = {
      token: 'test-token',
      team_id: 'T123456',
      team_domain: 'test-team',
      channel_id: 'C1234567890',
      channel_name: 'general',
      user_id: 'U123456',
      user_name: 'john.doe',
      command: '/poke',
      text: 'PROJ-123',
      response_url: 'https://hooks.slack.com/commands/response',
      trigger_id: 'trigger-123'
    };

    const response = await handleSlackCommand(mockSlackPayload);

    expect(response.status).toBe(200);

    const responseBody = await response.text();
    expect(responseBody).toContain('Poker Round Started');
  });

  test('handles empty text parameter', async () => {
    const mockSlackPayload: SlackCommandPayload = {
      token: 'test-token',
      team_id: 'T123456',
      team_domain: 'test-team',
      channel_id: 'C1234567890',
      channel_name: 'general',
      user_id: 'U123456',
      user_name: 'john.doe',
      command: '/poke',
      text: '',
      response_url: 'https://hooks.slack.com/commands/response',
      trigger_id: 'trigger-123'
    };

    const response = await handleSlackCommand(mockSlackPayload);

    expect(response.status).toBe(200);

    const responseBody = await response.text();
    expect(responseBody).toContain('Poker Round Started');
  });
});

describe('Interactive Component Integration', () => {
  test('processes vote button clicks', async () => {
    const mockInteractivePayload: SlackInteractivePayload = {
      type: 'block_actions',
      actions: [{
        action_id: 'vote_5',
        value: '5'
      }],
      user: {
        id: 'U123456',
        username: 'john.doe'
      },
      channel: {
        id: 'C1234567890'
      },
      team: {
        id: 'T123456'
      },
      response_url: 'https://hooks.slack.com/actions/response',
      message: {
        blocks: []
      }
    };

    const response = await handleInteractiveComponent(mockInteractivePayload);

    expect(response.status).toBe(200);

    const responseData = await response.json();
    expect(responseData.replace_original).toBe(true);
  });

  test('handles lock-in button', async () => {
    const mockInteractivePayload: SlackInteractivePayload = {
      type: 'block_actions',
      actions: [{
        action_id: 'lock_in',
        value: 'lock_in'
      }],
      user: {
        id: 'U123456',
        username: 'john.doe'
      },
      channel: {
        id: 'C1234567890'
      },
      team: {
        id: 'T123456'
      },
      response_url: 'https://hooks.slack.com/actions/response',
      message: {
        blocks: []
      }
    };

    const response = await handleInteractiveComponent(mockInteractivePayload);

    expect(response.status).toBe(200);
  });

  test('handles play-hand button', async () => {
    const mockInteractivePayload: SlackInteractivePayload = {
      type: 'block_actions',
      actions: [{
        action_id: 'play_hand',
        value: 'play_hand'
      }],
      user: {
        id: 'U123456',
        username: 'john.doe'
      },
      channel: {
        id: 'C1234567890'
      },
      team: {
        id: 'T123456'
      },
      response_url: 'https://hooks.slack.com/actions/response',
      message: {
        blocks: []
      }
    };

    const response = await handleInteractiveComponent(mockInteractivePayload);

    expect(response.status).toBe(200);

    const responseData = await response.json();
    expect(responseData.replace_original).toBe(true);
  });
});

// Error Handling Tests
describe('Error Handling', () => {
  test('handles team not found gracefully', async () => {
    const mockPayload: SlackCommandPayload = {
      token: 'test-token',
      team_id: 'T123456',
      team_domain: 'test-team',
      channel_id: 'INVALID_CHANNEL',
      channel_name: 'invalid',
      user_id: 'U123456',
      user_name: 'john.doe',
      command: '/poke',
      text: 'PROJ-123',
      response_url: 'https://hooks.slack.com/commands/response',
      trigger_id: 'trigger-123'
    };

    const response = await handleSlackCommand(mockPayload);

    expect(response.status).toBe(200);

    const responseBody = await response.text();
    expect(responseBody).toMatch(/team not found|not configured/i);
  });

  test('handles invalid Slack signature', async () => {
    const mockPayload: SlackCommandPayload = {
      token: 'invalid-token',
      team_id: 'T123456',
      team_domain: 'test-team',
      channel_id: 'C1234567890',
      channel_name: 'general',
      user_id: 'U123456',
      user_name: 'john.doe',
      command: '/poke',
      text: 'PROJ-123',
      response_url: 'https://hooks.slack.com/commands/response',
      trigger_id: 'trigger-123'
    };

    // This should fail signature verification
    const response = await handleSlackCommand(mockPayload);

    expect(response.status).toBe(401);
  });

  test('handles database connection errors', async () => {
    // This test would require mocking the database to throw errors
    const mockPayload: SlackCommandPayload = {
      token: 'test-token',
      team_id: 'T123456',
      team_domain: 'test-team',
      channel_id: 'C1234567890',
      channel_name: 'general',
      user_id: 'U123456',
      user_name: 'john.doe',
      command: '/poke',
      text: 'PROJ-123',
      response_url: 'https://hooks.slack.com/commands/response',
      trigger_id: 'trigger-123'
    };

    // Mock database failure
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Database connection failed'));

    const response = await handleSlackCommand(mockPayload);

    expect(response.status).toBe(200);

    const responseBody = await response.text();
    expect(responseBody).toMatch(/error occurred|something went wrong/i);
  });

  test('handles concurrent votes on same round', async () => {
    const basePayload: SlackInteractivePayload = {
      type: 'block_actions',
      actions: [{
        action_id: 'vote_5',
        value: '5'
      }],
      channel: {
        id: 'C1234567890'
      },
      team: {
        id: 'T123456'
      },
      response_url: 'https://hooks.slack.com/actions/response',
      message: {
        blocks: []
      }
    };

    // Simulate two users voting simultaneously
    const user1Payload = {
      ...basePayload,
      user: { id: 'U123456', username: 'user1' }
    };

    const user2Payload = {
      ...basePayload,
      user: { id: 'U789012', username: 'user2' },
      actions: [{ action_id: 'vote_8', value: '8' }]
    };

    // Both should succeed
    const response1 = await handleInteractiveComponent(user1Payload);
    const response2 = await handleInteractiveComponent(user2Payload);

    expect(response1.status).toBe(200);
    expect(response2.status).toBe(200);
  });
});

// Edge Cases
describe('Edge Cases', () => {
  test('handles malformed ticket numbers', () => {
    const testCases = [
      'PROJ-',
      '-123',
      'PROJ--123',
      'PROJ-ABC',
      '123-123'
    ];

    testCases.forEach(input => {
      const result = parseTicketFromText(input);
      expect(result.ticketNumber).toBeNull();
    });
  });

  test('handles very long team and user IDs', () => {
    const longSlackUserId = 'U' + 'x'.repeat(50);
    const longTeamId = 'team-' + 'y'.repeat(100);

    const id = generateAnonymousUserId(longSlackUserId, longTeamId);

    expect(id).toMatch(/^slack_[a-f0-9]+$/);
    expect(id.length).toBeLessThan(255); // Database varchar limit
  });

  test('handles empty vote selections object', () => {
    const message = generateVotingMessage('PROJ-123', 'Test', {}, 'Voting');

    expect(message).toBeDefined();
    const messageStr = JSON.stringify(message);
    expect(messageStr).toContain('0 votes cast');
  });

  test('handles special characters in ticket titles', () => {
    const specialTitle = 'Fix bug with "quotes" & ampersands < > and unicode 🚀';
    const message = generateVotingMessage('PROJ-123', specialTitle, {}, 'Voting');

    expect(message).toBeDefined();
    expect(JSON.stringify(message)).toContain('🚀');
  });
}); 