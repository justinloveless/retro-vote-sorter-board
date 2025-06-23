import { assertEquals, assertExists, assertMatch } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { 
  generateVoteProgressText,
  generateVoteSummary,
  generateVotingMessage
} from "./message-utils.ts";

// Vote Progress Display Tests
Deno.test("generateVoteProgressText - empty votes during voting", () => {
  const result = generateVoteProgressText({}, 'Voting');
  assertEquals(result.includes('*Voting Progress:*'), true);
  assertEquals(result.includes('_Waiting for votes..._'), true);
});

Deno.test("generateVoteProgressText - single vote with checkmark", () => {
  const votes = {
    'slack_user1': { points: 5, display_name: 'John Doe' }
  };
  
  const result = generateVoteProgressText(votes, 'Voting');
  assertEquals(result.includes('*Voting Progress:*'), true);
  assertEquals(result.includes('✅ John Doe'), true);
});

Deno.test("generateVoteProgressText - multiple votes with checkmarks", () => {
  const votes = {
    'slack_user1': { points: 5, display_name: 'John Doe' },
    'slack_user2': { points: 8, display_name: 'Jane Smith' }
  };
  
  const result = generateVoteProgressText(votes, 'Voting');
  assertEquals(result.includes('✅ John Doe'), true);
  assertEquals(result.includes('✅ Jane Smith'), true);
});

Deno.test("generateVoteProgressText - abstention shows red X", () => {
  const votes = {
    'slack_user1': { points: -1, display_name: 'Mike Wilson' }
  };
  
  const result = generateVoteProgressText(votes, 'Voting');
  assertEquals(result.includes('❌ Mike Wilson'), true);
});

Deno.test("generateVoteProgressText - mixed votes and abstentions", () => {
  const votes = {
    'slack_user1': { points: 5, display_name: 'John Doe' },
    'slack_user2': { points: -1, display_name: 'Mike Wilson' },
    'slack_user3': { points: 8, display_name: 'Jane Smith' }
  };
  
  const result = generateVoteProgressText(votes, 'Voting');
  assertEquals(result.includes('✅ John Doe'), true);
  assertEquals(result.includes('❌ Mike Wilson'), true);
  assertEquals(result.includes('✅ Jane Smith'), true);
});

Deno.test("generateVoteProgressText - users sorted alphabetically", () => {
  const votes = {
    'slack_user1': { points: 5, display_name: 'Zoe Adams' },
    'slack_user2': { points: 8, display_name: 'Alice Brown' },
    'slack_user3': { points: 3, display_name: 'Bob Wilson' }
  };
  
  const result = generateVoteProgressText(votes, 'Voting');
  const aliceIndex = result.indexOf('Alice Brown');
  const bobIndex = result.indexOf('Bob Wilson');
  const zoeIndex = result.indexOf('Zoe Adams');
  
  assertEquals(aliceIndex < bobIndex, true);
  assertEquals(bobIndex < zoeIndex, true);
});

Deno.test("generateVoteProgressText - playing state shows actual votes", () => {
  const votes = {
    'slack_user1': { points: 5, display_name: 'John Doe' },
    'slack_user2': { points: -1, display_name: 'Mike Wilson' }
  };
  
  const result = generateVoteProgressText(votes, 'Playing');
  assertEquals(result.includes('*Results:*'), true);
  assertEquals(result.includes('John Doe: 5 pts'), true);
  assertEquals(result.includes('Mike Wilson: Abstain'), true);
});

// Vote Summary Tests
Deno.test("generateVoteSummary - empty votes", () => {
  const result = generateVoteSummary({});
  assertEquals(result, '0 votes');
});

Deno.test("generateVoteSummary - single vote", () => {
  const votes = {
    'slack_user1': { points: 5, display_name: 'John' }
  };
  
  const result = generateVoteSummary(votes);
  assertEquals(result, '1 x 5 pts');
});

Deno.test("generateVoteSummary - multiple same votes", () => {
  const votes = {
    'slack_user1': { points: 5, display_name: 'John' },
    'slack_user2': { points: 5, display_name: 'Jane' },
    'slack_user3': { points: 5, display_name: 'Mike' }
  };
  
  const result = generateVoteSummary(votes);
  assertEquals(result, '3 x 5 pts');
});

Deno.test("generateVoteSummary - mixed votes", () => {
  const votes = {
    'slack_user1': { points: 5, display_name: 'John' },
    'slack_user2': { points: 8, display_name: 'Jane' },
    'slack_user3': { points: 5, display_name: 'Mike' }
  };
  
  const result = generateVoteSummary(votes);
  assertEquals(result.includes('2 x 5 pts'), true);
  assertEquals(result.includes('1 x 8 pts'), true);
  assertEquals(result.includes(', '), true);
});

Deno.test("generateVoteSummary - single abstention", () => {
  const votes = {
    'slack_user1': { points: -1, display_name: 'John' }
  };
  
  const result = generateVoteSummary(votes);
  assertEquals(result, '1 x Abstain');
});

Deno.test("generateVoteSummary - multiple abstentions", () => {
  const votes = {
    'slack_user1': { points: -1, display_name: 'John' },
    'slack_user2': { points: -1, display_name: 'Jane' }
  };
  
  const result = generateVoteSummary(votes);
  assertEquals(result, '2 x Abstain');
});

Deno.test("generateVoteSummary - mixed votes and abstentions", () => {
  const votes = {
    'slack_user1': { points: 5, display_name: 'John' },
    'slack_user2': { points: -1, display_name: 'Jane' },
    'slack_user3': { points: 8, display_name: 'Mike' },
    'slack_user4': { points: -1, display_name: 'Sara' }
  };
  
  const result = generateVoteSummary(votes);
  assertEquals(result.includes('1 x 5 pts'), true);
  assertEquals(result.includes('1 x 8 pts'), true);
  assertEquals(result.includes('2 x Abstain'), true);
});

Deno.test("generateVoteSummary - votes sorted by point value", () => {
  const votes = {
    'slack_user1': { points: 13, display_name: 'John' },
    'slack_user2': { points: 5, display_name: 'Jane' },
    'slack_user3': { points: 8, display_name: 'Mike' }
  };
  
  const result = generateVoteSummary(votes);
  const fiveIndex = result.indexOf('5 pts');
  const eightIndex = result.indexOf('8 pts');
  const thirteenIndex = result.indexOf('13 pts');
  
  assertEquals(fiveIndex < eightIndex, true);
  assertEquals(eightIndex < thirteenIndex, true);
});

// Enhanced Message Generation Tests
Deno.test("generateVotingMessage - voting phase shows progress instead of count", () => {
  const votes = {
    'slack_user1': { points: 5, display_name: 'John' },
    'slack_user2': { points: -1, display_name: 'Mike' }
  };
  
  const message = generateVotingMessage('PROJ-123', 'Test Story', votes, 'Voting');
  const messageStr = JSON.stringify(message);
  
  // Should not show generic vote count
  assertEquals(messageStr.includes('votes cast'), false);
  
  // Should show actual progress
  assertEquals(messageStr.includes('*Voting Progress:*'), true);
  assertEquals(messageStr.includes('✅ John'), true);
  assertEquals(messageStr.includes('❌ Mike'), true);
});

Deno.test("generateVotingMessage - voting phase includes all buttons except lock-in", () => {
  const message = generateVotingMessage('PROJ-123', 'Test Story', {}, 'Voting');
  const messageStr = JSON.stringify(message);
  
  // Should include voting buttons
  assertEquals(messageStr.includes('vote_1'), true);
  assertEquals(messageStr.includes('vote_2'), true);
  assertEquals(messageStr.includes('vote_3'), true);
  assertEquals(messageStr.includes('vote_5'), true);
  assertEquals(messageStr.includes('vote_8'), true);
  assertEquals(messageStr.includes('vote_13'), true);
  assertEquals(messageStr.includes('vote_21'), true);
  assertEquals(messageStr.includes('abstain'), true);
  assertEquals(messageStr.includes('play_hand'), true);
  
  // Should NOT include lock-in button
  assertEquals(messageStr.includes('lock_in'), false);
  assertEquals(messageStr.includes('🔒 Lock In'), false);
});

Deno.test("generateVotingMessage - playing phase shows results and summary", () => {
  const votes = {
    'slack_user1': { points: 5, display_name: 'John' },
    'slack_user2': { points: 8, display_name: 'Jane' },
    'slack_user3': { points: -1, display_name: 'Mike' }
  };
  
  const message = generateVotingMessage('PROJ-123', 'Test Story', votes, 'Playing');
  const messageStr = JSON.stringify(message);
  
  // Should show results
  assertEquals(messageStr.includes('*Results:*'), true);
  assertEquals(messageStr.includes('John: 5 pts'), true);
  assertEquals(messageStr.includes('Jane: 8 pts'), true);
  assertEquals(messageStr.includes('Mike: Abstain'), true);
  
  // Should show summary
  assertEquals(messageStr.includes('*Summary:*'), true);
  assertEquals(messageStr.includes('1 x 5 pts'), true);
  assertEquals(messageStr.includes('1 x 8 pts'), true);
  assertEquals(messageStr.includes('1 x Abstain'), true);
});

Deno.test("generateVotingMessage - playing phase has no interactive buttons", () => {
  const votes = {
    'slack_user1': { points: 5, display_name: 'John' }
  };
  
  const message = generateVotingMessage('PROJ-123', 'Test Story', votes, 'Playing');
  const messageStr = JSON.stringify(message);
  
  // Should not include any interactive buttons
  assertEquals(messageStr.includes('vote_1'), false);
  assertEquals(messageStr.includes('vote_2'), false);
  assertEquals(messageStr.includes('vote_3'), false);
  assertEquals(messageStr.includes('vote_5'), false);
  assertEquals(messageStr.includes('vote_8'), false);
  assertEquals(messageStr.includes('vote_13'), false);
  assertEquals(messageStr.includes('vote_21'), false);
  assertEquals(messageStr.includes('abstain'), false);
  assertEquals(messageStr.includes('play_hand'), false);
  assertEquals(messageStr.includes('lock_in'), false);
});

Deno.test("generateVotingMessage - empty votes shows waiting message", () => {
  const message = generateVotingMessage('PROJ-123', 'Test Story', {}, 'Voting');
  const messageStr = JSON.stringify(message);
  
  assertEquals(messageStr.includes('_Waiting for votes..._'), true);
});

Deno.test("generateVotingMessage - maintains ticket information display", () => {
  const message = generateVotingMessage('PROJ-123', 'Test Story', {}, 'Voting');
  const messageStr = JSON.stringify(message);
  
  assertEquals(messageStr.includes('🃏 PROJ-123: Test Story'), true);
});

Deno.test("generateVotingMessage - handles null ticket gracefully", () => {
  const message = generateVotingMessage(null, null, {}, 'Voting');
  const messageStr = JSON.stringify(message);
  
  assertEquals(messageStr.includes('🃏 Planning Poker Session'), true);
});

Deno.test("generateVotingMessage - handles special characters in names", () => {
  const votes = {
    'slack_user1': { points: 5, display_name: 'John & Jane' },
    'slack_user2': { points: 8, display_name: 'Mike O\'Connor' }
  };
  
  const message = generateVotingMessage('PROJ-123', 'Test Story', votes, 'Voting');
  const messageStr = JSON.stringify(message);
  
  assertEquals(messageStr.includes('✅ John & Jane'), true);
  assertEquals(messageStr.includes('✅ Mike O\'Connor'), true);
});

// Edge Cases Tests
Deno.test("generateVoteProgressText - handles very long names", () => {
  const votes = {
    'slack_user1': { points: 5, display_name: 'Very Long Name That Might Cause Issues' }
  };
  
  const result = generateVoteProgressText(votes, 'Voting');
  assertEquals(result.includes('✅ Very Long Name That Might Cause Issues'), true);
});

Deno.test("generateVoteSummary - handles all same abstentions", () => {
  const votes = {
    'slack_user1': { points: -1, display_name: 'John' },
    'slack_user2': { points: -1, display_name: 'Jane' },
    'slack_user3': { points: -1, display_name: 'Mike' }
  };
  
  const result = generateVoteSummary(votes);
  assertEquals(result, '3 x Abstain');
});

Deno.test("generateVoteSummary - handles single point value with multiple votes", () => {
  const votes = {
    'slack_user1': { points: 21, display_name: 'John' },
    'slack_user2': { points: 21, display_name: 'Jane' },
    'slack_user3': { points: 21, display_name: 'Mike' },
    'slack_user4': { points: 21, display_name: 'Sara' }
  };
  
  const result = generateVoteSummary(votes);
  assertEquals(result, '4 x 21 pts');
}); 