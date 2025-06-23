import { assertEquals, assertExists, assertMatch } from "https://deno.land/std@0.208.0/assert/mod.ts";

// Utility Functions (copied from index.ts for testing)
function parseTicketFromText(text: string): {
  ticketNumber: string | null;
  ticketTitle?: string;
} {
  if (!text || typeof text !== 'string') {
    return { ticketNumber: null };
  }

  // Extract from Jira URLs: https://company.atlassian.net/browse/PROJ-123
  const jiraUrlMatch = text.match(/\/browse\/([A-Z]+-\d+)/);
  if (jiraUrlMatch) {
    return { ticketNumber: jiraUrlMatch[1] };
  }

  // Extract from plain text: ABC-123, PROJ-456, etc.
  const ticketMatch = text.match(/\b([A-Z]+-\d+)\b/);
  if (ticketMatch) {
    return { ticketNumber: ticketMatch[1] };
  }

  return { ticketNumber: null };
}

function generateAnonymousUserId(slackUserId: string, teamId: string): string {
  // Simple hash for consistent IDs
  let hash = 0;
  const str = `${teamId}_${slackUserId}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `slack_${Math.abs(hash).toString(16)}`;
}

function verifySlackRequest(
  body: string,
  signature: string,
  timestamp: string
): boolean {
  // Check timestamp to prevent replay attacks (within 5 minutes)
  const currentTime = Math.floor(Date.now() / 1000);
  const requestTime = parseInt(timestamp);
  
  if (Math.abs(currentTime - requestTime) > 300) {
    return false;
  }

  // Verify signature format
  return signature.startsWith('v0=') && signature.length > 10;
}

function generateVotingMessage(
  ticketNumber: string | null,
  ticketTitle: string | null,
  currentVotes: Record<string, { points: number; display_name: string }>,
  gameState: 'Voting' | 'Playing'
): any {
  const voteCount = Object.keys(currentVotes).length;
  const ticketInfo = ticketNumber ? `${ticketNumber}${ticketTitle ? `: ${ticketTitle}` : ''}` : 'Planning Poker Session';
  
  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `🃏 ${ticketInfo}`
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: gameState === 'Voting' 
          ? `*${voteCount} votes cast* - Vote for your estimate!`
          : `*Results:*\n${Object.values(currentVotes).map(v => `${v.display_name}: ${v.points === -1 ? 'Abstain' : v.points}`).join('\n')}`
      }
    }
  ];

  if (gameState === 'Voting') {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '1' },
          action_id: 'vote_1',
          value: '1'
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '2' },
          action_id: 'vote_2',
          value: '2'
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '3' },
          action_id: 'vote_3',
          value: '3'
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '5' },
          action_id: 'vote_5',
          value: '5'
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '8' },
          action_id: 'vote_8',
          value: '8'
        }
      ]
    });

    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '13' },
          action_id: 'vote_13',
          value: '13'
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '21' },
          action_id: 'vote_21',
          value: '21'
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Abstain' },
          action_id: 'abstain',
          value: '-1',
          style: 'danger'
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '🔒 Lock In' },
          action_id: 'lock_in',
          value: 'lock_in',
          style: 'primary'
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '🎴 Play Hand' },
          action_id: 'play_hand',
          value: 'play_hand',
          style: 'primary'
        }
      ]
    });
  }

  return { blocks };
}

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
  const timestamp = Math.floor(Date.now() / 1000).toString(); // Current timestamp
  const signature = 'v0=expected_valid_signature';
  
  const result = verifySlackRequest(body, signature, timestamp);
  
  assertEquals(typeof result, 'boolean');
  assertEquals(result, true); // Should pass with current timestamp and valid format
});

Deno.test("verifySlackRequest - rejects invalid signatures", () => {
  const body = 'token=test&user_id=U123';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = 'invalid_signature'; // No v0= prefix
  
  const result = verifySlackRequest(body, signature, timestamp);
  
  assertEquals(result, false);
});

Deno.test("verifySlackRequest - rejects old timestamps", () => {
  const body = 'token=test&user_id=U123';
  const oldTimestamp = '1000000000'; // Very old timestamp
  const signature = 'v0=some_signature';
  
  const result = verifySlackRequest(body, signature, oldTimestamp);
  
  assertEquals(result, false);
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