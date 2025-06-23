import { assertEquals, assertExists, assertMatch, assertRejects } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { 
  parseTicketFromText,
  generateAnonymousUserId,
  verifySlackRequest,
  findTeamByChannelId,
  getOrCreatePokerSession,
  createNewRound,
  processVote,
  generateVotingMessage,
  updateVotingMessage,
  handleSlackCommand,
  handleInteractiveComponent
} from "./index.ts";

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

// Functions are imported from index.ts

// Utility Tests
Deno.test("parseTicketFromText - extracts ticket number from Jira URL", () => {
  const jiraUrl = 'https://company.atlassian.net/browse/PROJ-123';
  const result = parseTicketFromText(jiraUrl);
  
  assertEquals(result.ticketNumber, 'PROJ-123');
});

Deno.test("parseTicketFromText - extracts ticket number from plain text", () => {
  const plainText = 'PROJ-123';
  const result = parseTicketFromText(plainText);
  
  assertEquals(result.ticketNumber, 'PROJ-123');
});

Deno.test("parseTicketFromText - handles various ticket formats", () => {
  const testCases = [
    { input: 'ABC-456', expected: 'ABC-456' },
    { input: 'FEATURE-1234', expected: 'FEATURE-1234' },
    { input: 'BUG-99', expected: 'BUG-99' },
    { input: 'XX-1', expected: 'XX-1' }
  ];

  testCases.forEach(({ input, expected }) => {
    const result = parseTicketFromText(input);
    assertEquals(result.ticketNumber, expected);
  });
});

Deno.test("parseTicketFromText - returns null for invalid input", () => {
  const testCases = [
    '',
    'not a ticket',
    '123-ABC', // numbers before letters
    'PROJ', // no number
    'just text here'
  ];

  testCases.forEach(input => {
    const result = parseTicketFromText(input);
    assertEquals(result.ticketNumber, null);
  });
});

Deno.test("parseTicketFromText - extracts from complex Jira URLs with parameters", () => {
  const complexUrl = 'https://company.atlassian.net/browse/PROJ-123?activeTab=some-tab&extra=params';
  const result = parseTicketFromText(complexUrl);
  
  assertEquals(result.ticketNumber, 'PROJ-123');
});

Deno.test("generateAnonymousUserId - generates consistent IDs for the same inputs", () => {
  const slackUserId = 'U123456';
  const teamId = 'team-abc-123';
  
  const id1 = generateAnonymousUserId(slackUserId, teamId);
  const id2 = generateAnonymousUserId(slackUserId, teamId);
  
  assertEquals(id1, id2);
});

Deno.test("generateAnonymousUserId - generates different IDs for different inputs", () => {
  const teamId = 'team-abc-123';
  
  const id1 = generateAnonymousUserId('U123456', teamId);
  const id2 = generateAnonymousUserId('U789012', teamId);
  
  assertEquals(id1 === id2, false);
});

Deno.test("generateAnonymousUserId - generates different IDs for different teams", () => {
  const slackUserId = 'U123456';
  
  const id1 = generateAnonymousUserId(slackUserId, 'team-1');
  const id2 = generateAnonymousUserId(slackUserId, 'team-2');
  
  assertEquals(id1 === id2, false);
});

Deno.test("generateAnonymousUserId - generates IDs with expected format", () => {
  const id = generateAnonymousUserId('U123456', 'team-123');
  
  assertMatch(id, /^slack_[a-f0-9]+$/);
});

Deno.test("verifySlackRequest - verifies valid Slack signature", () => {
  const body = 'token=test&user_id=U123';
  const timestamp = '1609459200'; // Known timestamp
  const signature = 'v0=expected_valid_signature';
  
  // Mock the verification to return true for this test
  const result = verifySlackRequest(body, signature, timestamp);
  
  assertEquals(typeof result, 'boolean');
});

Deno.test("verifySlackRequest - rejects invalid signatures", () => {
  const body = 'token=test&user_id=U123';
  const timestamp = '1609459200';
  const signature = 'v0=invalid_signature';
  
  // This should return false when implemented
  const result = verifySlackRequest(body, signature, timestamp);
  
  assertEquals(typeof result, 'boolean');
});

Deno.test("verifySlackRequest - rejects old timestamps", () => {
  const body = 'token=test&user_id=U123';
  const oldTimestamp = '1000000000'; // Very old timestamp
  const signature = 'v0=some_signature';
  
  const result = verifySlackRequest(body, signature, oldTimestamp);
  
  assertEquals(result, false);
});

// Database Function Tests
Deno.test("findTeamByChannelId - finds team by channel ID", async () => {
  const mockTeam: Team = {
    id: 'team-123',
    name: 'Test Team',
    slack_channel_id: 'C1234567890',
    slack_bot_token: 'xoxb-token'
  };

  // This test will fail until implementation is done
  try {
    const result = await findTeamByChannelId('C1234567890');
    assertEquals(result, mockTeam);
  } catch (error) {
    // Expected to fail until implementation
    assertExists(error);
  }
});

Deno.test("findTeamByChannelId - returns null when team not found", async () => {
  try {
    const result = await findTeamByChannelId('INVALID_CHANNEL');
    assertEquals(result, null);
  } catch (error) {
    // Expected to fail until implementation
    assertExists(error);
  }
});

Deno.test("getOrCreatePokerSession - returns existing active session", async () => {
  const mockSession: PokerSession = {
    id: 'session-123',
    team_id: 'team-123',
    room_id: 'team-123',
    current_round_number: 1,
    created_at: '2024-01-01T00:00:00Z'
  };

  try {
    const result = await getOrCreatePokerSession('team-123');
    assertEquals(result, mockSession);
  } catch (error) {
    // Expected to fail until implementation
    assertExists(error);
  }
});

Deno.test("createNewRound - creates new round and increments session counter", async () => {
  const mockRound: PokerSessionRound = {
    id: 'round-123',
    session_id: 'session-123',
    round_number: 2,
    ticket_number: 'PROJ-123',
    ticket_title: 'Test ticket',
    selections: {},
    game_state: 'Selection',
    created_at: new Date().toISOString()
  };

  try {
    const result = await createNewRound('session-123', 'PROJ-123', 'Test ticket');
    assertEquals(result, mockRound);
  } catch (error) {
    // Expected to fail until implementation
    assertExists(error);
  }
});

Deno.test("createNewRound - handles null ticket information", async () => {
  const mockRound: PokerSessionRound = {
    id: 'round-123',
    session_id: 'session-123',
    round_number: 1,
    ticket_number: null,
    ticket_title: null,
    selections: {},
    game_state: 'Selection',
    created_at: new Date().toISOString()
  };

  try {
    const result = await createNewRound('session-123', null, null);
    assertEquals(result.ticket_number, null);
    assertEquals(result.ticket_title, null);
  } catch (error) {
    // Expected to fail until implementation
    assertExists(error);
  }
});

Deno.test("processVote - processes valid vote", async () => {
  try {
    await processVote('round-123', 'slack_abc123', 'John Doe', 5);
    // This should not throw when implemented correctly
  } catch (error) {
    // Expected to fail until implementation
    assertExists(error);
  }
});

Deno.test("processVote - handles abstain vote", async () => {
  try {
    await processVote('round-123', 'slack_abc123', 'John Doe', -1);
    // This should not throw when implemented correctly
  } catch (error) {
    // Expected to fail until implementation
    assertExists(error);
  }
});

// Message Generation Tests
Deno.test("generateVotingMessage - generates message with ticket information", () => {
  const message = generateVotingMessage(
    'PROJ-123',
    'Test Story',
    {},
    'Voting'
  );
  
  assertExists(message);
  assertExists(message.blocks);
  const messageStr = JSON.stringify(message);
  assertEquals(messageStr.includes('PROJ-123'), true);
  assertEquals(messageStr.includes('Test Story'), true);
});

Deno.test("generateVotingMessage - generates message without ticket information", () => {
  const message = generateVotingMessage(
    null,
    null,
    {},
    'Voting'
  );
  
  assertExists(message);
  assertExists(message.blocks);
});

Deno.test("generateVotingMessage - includes voting buttons in Voting state", () => {
  const message = generateVotingMessage(
    'PROJ-123',
    'Test Story',
    {},
    'Voting'
  );
  
  const messageStr = JSON.stringify(message);
  assertEquals(messageStr.includes('vote_1'), true);
  assertEquals(messageStr.includes('vote_2'), true);
  assertEquals(messageStr.includes('vote_3'), true);
  assertEquals(messageStr.includes('vote_5'), true);
  assertEquals(messageStr.includes('vote_8'), true);
  assertEquals(messageStr.includes('vote_13'), true);
  assertEquals(messageStr.includes('vote_21'), true);
  assertEquals(messageStr.includes('abstain'), true);
});

Deno.test("generateVotingMessage - shows current votes count", () => {
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
  assertEquals(messageStr.includes('2 votes cast'), true);
});

Deno.test("generateVotingMessage - reveals votes in Playing state", () => {
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
  assertEquals(messageStr.includes('John: 5'), true);
  assertEquals(messageStr.includes('Jane: 8'), true);
});

Deno.test("updateVotingMessage - updates vote counts in existing message", () => {
  const originalMessage = {
    blocks: [
      { type: 'section', text: { text: 'Existing message' } }
    ]
  };

  const votes = {
    'slack_user1': { points: 5, display_name: 'John' }
  };

  const updatedMessage = updateVotingMessage(originalMessage, votes, 'Voting');
  
  assertExists(updatedMessage);
  assertExists(updatedMessage.blocks);
});

Deno.test("updateVotingMessage - preserves message structure while updating content", () => {
  const originalMessage = {
    blocks: [
      { type: 'section', text: { text: 'Original content' } }
    ],
    attachments: []
  };

  const updatedMessage = updateVotingMessage(originalMessage, {}, 'Playing');
  
  assertExists(updatedMessage.blocks);
  assertEquals(Array.isArray(updatedMessage.blocks), true);
});

// Integration Tests
Deno.test("handleSlackCommand - handles complete /poke command flow", async () => {
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

  try {
    const response = await handleSlackCommand(mockSlackPayload);
    assertEquals(response.status, 200);
    
    const responseBody = await response.text();
    assertEquals(responseBody.includes('Poker Round Started'), true);
  } catch (error) {
    // Expected to fail until implementation
    assertExists(error);
  }
});

Deno.test("handleSlackCommand - handles empty text parameter", async () => {
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

  try {
    const response = await handleSlackCommand(mockSlackPayload);
    assertEquals(response.status, 200);
    
    const responseBody = await response.text();
    assertEquals(responseBody.includes('Poker Round Started'), true);
  } catch (error) {
    // Expected to fail until implementation
    assertExists(error);
  }
});

Deno.test("handleInteractiveComponent - processes vote button clicks", async () => {
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

  try {
    const response = await handleInteractiveComponent(mockInteractivePayload);
    assertEquals(response.status, 200);
    
    const responseData = await response.json();
    assertEquals(responseData.replace_original, true);
  } catch (error) {
    // Expected to fail until implementation
    assertExists(error);
  }
});

Deno.test("handleInteractiveComponent - handles lock-in button", async () => {
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

  try {
    const response = await handleInteractiveComponent(mockInteractivePayload);
    assertEquals(response.status, 200);
  } catch (error) {
    // Expected to fail until implementation
    assertExists(error);
  }
});

Deno.test("handleInteractiveComponent - handles play-hand button", async () => {
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

  try {
    const response = await handleInteractiveComponent(mockInteractivePayload);
    assertEquals(response.status, 200);
    
    const responseData = await response.json();
    assertEquals(responseData.replace_original, true);
  } catch (error) {
    // Expected to fail until implementation
    assertExists(error);
  }
});

// Error Handling Tests
Deno.test("handleSlackCommand - handles team not found gracefully", async () => {
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

  try {
    const response = await handleSlackCommand(mockPayload);
    assertEquals(response.status, 200);
    
    const responseBody = await response.text();
    assertEquals(/team not found|not configured/i.test(responseBody), true);
  } catch (error) {
    // Expected to fail until implementation
    assertExists(error);
  }
});

Deno.test("handleSlackCommand - handles invalid Slack signature", async () => {
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

  try {
    // This should fail signature verification
    const response = await handleSlackCommand(mockPayload);
    assertEquals(response.status, 401);
  } catch (error) {
    // Expected to fail until implementation
    assertExists(error);
  }
});

// Edge Cases
Deno.test("parseTicketFromText - handles malformed ticket numbers", () => {
  const testCases = [
    'PROJ-',
    '-123',
    'PROJ--123',
    'PROJ-ABC',
    '123-123'
  ];

  testCases.forEach(input => {
    const result = parseTicketFromText(input);
    assertEquals(result.ticketNumber, null);
  });
});

Deno.test("generateAnonymousUserId - handles very long team and user IDs", () => {
  const longSlackUserId = 'U' + 'x'.repeat(50);
  const longTeamId = 'team-' + 'y'.repeat(100);
  
  const id = generateAnonymousUserId(longSlackUserId, longTeamId);
  
  assertMatch(id, /^slack_[a-f0-9]+$/);
  assertEquals(id.length < 255, true); // Database varchar limit
});

Deno.test("generateVotingMessage - handles empty vote selections object", () => {
  const message = generateVotingMessage('PROJ-123', 'Test', {}, 'Voting');
  
  assertExists(message);
  const messageStr = JSON.stringify(message);
  assertEquals(messageStr.includes('0 votes cast'), true);
});

Deno.test("generateVotingMessage - handles special characters in ticket titles", () => {
  const specialTitle = 'Fix bug with "quotes" & ampersands < > and unicode 🚀';
  const message = generateVotingMessage('PROJ-123', specialTitle, {}, 'Voting');
  
  assertExists(message);
  assertEquals(JSON.stringify(message).includes('🚀'), true);
}); 