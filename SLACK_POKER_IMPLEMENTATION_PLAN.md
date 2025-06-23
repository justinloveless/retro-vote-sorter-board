# Slack Poker Integration Implementation Plan

## Feature Overview

Implement a Slack bot command `/poke [ticket-link|ticket-number]` that creates interactive poker planning sessions directly in Slack channels. Users can vote on story points for tickets using interactive buttons, with votes synchronized to the team's RetroScope poker session.

## Requirements Analysis

### Functional Requirements
1. **Slash Command**: `/poke [ticket-link|ticket-number]` creates a new poker round
2. **Interactive Voting**: Slack users can vote using buttons (1, 2, 3, 5, 8, 13, 21, Abstain)
3. **Team Mapping**: Map Slack channels to RetroScope teams via channel ID
4. **Anonymous Integration**: Slack users appear as anonymous users in RetroScope with real names
5. **Session Management**: Update the team's active poker session with votes
6. **Real-time Updates**: Slack message updates as users vote
7. **Round Control**: Support for "Lock In", "Play Hand" actions

### Non-Functional Requirements
1. **Security**: Verify Slack request signatures
2. **Performance**: Handle concurrent votes gracefully
3. **Reliability**: Proper error handling and fallbacks
4. **Scalability**: Efficient database queries with proper indexing

## Architecture Design

### Database Schema Changes

#### New Index
```sql
-- Add index for efficient team lookup by Slack channel
CREATE INDEX IF NOT EXISTS idx_teams_slack_channel_id 
ON teams(slack_channel_id) 
WHERE slack_channel_id IS NOT NULL;
```

#### Anonymous User Strategy
- Generate deterministic anonymous user IDs: `slack_${teamId}_${slackUserId}` (hashed)
- Use Slack user's real name as display name
- Leverage existing anonymous user support in poker sessions

### Edge Function Structure

**Function**: `supabase/functions/slack-poke/index.ts`

**Responsibilities**:
1. Handle Slack slash commands
2. Process interactive component callbacks
3. Manage poker sessions and rounds
4. Generate and update Slack messages

### Core Components

#### 1. Request Routing
```typescript
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
```

#### 2. Utility Functions

**Ticket Parsing**:
```typescript
function parseTicketFromText(text: string): {
  ticketNumber: string | null;
  ticketTitle?: string;
} {
  // Extract from JIRA URLs: https://company.atlassian.net/browse/PROJ-123
  // Extract from plain text: PROJ-123, ABC-456, etc.
  // Handle various formats and edge cases
}
```

**Team Lookup**:
```typescript
function findTeamByChannelId(channelId: string): Promise<Team | null> {
  // Query teams table by slack_channel_id
  // Handle multiple matches (should not happen)
  // Return team with slack integration configured
}
```

**Anonymous User Management**:
```typescript
function generateAnonymousUserId(slackUserId: string, teamId: string): string {
  // Create deterministic hash-based ID
  // Ensure consistency across sessions
  // Format: slack_${hash}
}
```

#### 3. Poker Session Management

**Session Lifecycle**:
```typescript
function getOrCreatePokerSession(teamId: string): Promise<PokerSession> {
  // Find existing active session for team
  // Create new session if none exists
  // Use team ID as room_id for team sessions
}

function createNewRound(
  sessionId: string, 
  ticketNumber: string | null,
  ticketTitle: string | null
): Promise<PokerSessionRound> {
  // Increment current_round_number in poker_sessions
  // Create new round in poker_session_rounds
  // Initialize with empty selections
}
```

**Vote Processing**:
```typescript
function processVote(
  roundId: string,
  anonymousUserId: string,
  displayName: string,
  points: number
): Promise<void> {
  // Update selections JSONB in poker_session_rounds
  // Handle lock-in state
  // Broadcast updates via Supabase realtime
}
```

#### 4. Slack Message Generation

**Initial Voting Message**:
```typescript
function generateVotingMessage(
  ticketNumber: string | null,
  ticketTitle: string | null,
  currentVotes: Selections,
  gameState: 'Voting' | 'Playing'
): SlackMessage {
  // Create Block Kit message with:
  // - Ticket information header
  // - Current votes display
  // - Voting buttons (1, 2, 3, 5, 8, 13, 21, Abstain)
  // - Action buttons (Lock In, Play Hand)
}
```

**Message Update Logic**:
```typescript
function updateVotingMessage(
  originalMessage: any,
  currentVotes: Selections,
  gameState: GameState
): SlackMessage {
  // Update vote counts
  // Show/hide votes based on game state
  // Update button states
  // Handle final results display
}
```

## Implementation Phases

### Phase 1: Foundation (Est: 30 minutes)
1. **Database Setup**
   - Add index on `teams.slack_channel_id`
   - Verify existing schema supports requirements

2. **Function Scaffolding**
   - Create `supabase/functions/slack-poke/index.ts`
   - Add to `supabase/config.toml` with `verify_jwt = false`
   - Basic request handling structure

### Phase 2: Core Logic (Est: 2 hours)
1. **Utility Functions**
   - Implement ticket parsing logic
   - Team lookup by channel ID
   - Anonymous user ID generation

2. **Session Management**
   - Poker session creation/retrieval
   - Round management
   - Vote processing logic

3. **Basic Slash Command**
   - Handle `/poke` command
   - Create poker round
   - Return basic Slack response

### Phase 3: Interactive Components (Est: 2 hours)
1. **Message Generation**
   - Block Kit message creation
   - Vote button implementation
   - Action button handling

2. **Interactive Handlers**
   - Process button clicks
   - Update votes in database
   - Update Slack messages

3. **Game State Management**
   - Handle "Play Hand" action
   - Show/hide votes appropriately
   - Final results display

### Phase 4: Integration & Polish (Est: 1 hour)
1. **Error Handling**
   - Invalid team/channel scenarios
   - Database error recovery
   - Slack API error handling

2. **Jira Integration**
   - Fetch ticket titles using existing functions
   - Handle Jira API failures gracefully

3. **Performance Optimization**
   - Implement basic caching
   - Optimize database queries
   - Rate limiting considerations

## Testing Strategy

### Unit Tests

#### Ticket Parsing Tests
```typescript
describe('parseTicketFromText', () => {
  test('extracts ticket from JIRA URL', () => {
    const result = parseTicketFromText('https://company.atlassian.net/browse/PROJ-123');
    expect(result.ticketNumber).toBe('PROJ-123');
  });

  test('extracts ticket from plain text', () => {
    const result = parseTicketFromText('PROJ-123');
    expect(result.ticketNumber).toBe('PROJ-123');
  });

  test('handles invalid input', () => {
    const result = parseTicketFromText('invalid text');
    expect(result.ticketNumber).toBe(null);
  });
});
```

#### Team Lookup Tests
```typescript
describe('findTeamByChannelId', () => {
  test('finds team by channel ID', async () => {
    const team = await findTeamByChannelId('C1234567890');
    expect(team).toBeDefined();
    expect(team.slack_channel_id).toBe('C1234567890');
  });

  test('returns null for non-existent channel', async () => {
    const team = await findTeamByChannelId('INVALID');
    expect(team).toBe(null);
  });
});
```

#### Anonymous User Tests
```typescript
describe('generateAnonymousUserId', () => {
  test('generates consistent IDs', () => {
    const id1 = generateAnonymousUserId('U123', 'team-456');
    const id2 = generateAnonymousUserId('U123', 'team-456');
    expect(id1).toBe(id2);
  });

  test('generates different IDs for different users', () => {
    const id1 = generateAnonymousUserId('U123', 'team-456');
    const id2 = generateAnonymousUserId('U456', 'team-456');
    expect(id1).not.toBe(id2);
  });
});
```

### Integration Tests

#### Full Command Flow Test
```typescript
describe('Slack Poke Integration', () => {
  test('handles complete /poke command flow', async () => {
    const mockSlackPayload = {
      command: '/poke',
      text: 'PROJ-123',
      channel_id: 'C1234567890',
      user_id: 'U123',
      user_name: 'john.doe'
    };

    const response = await handleSlackCommand(mockSlackPayload);
    
    expect(response.status).toBe(200);
    expect(response.body).toContain('Poker Round Started');
    
    // Verify database state
    const session = await getPokerSessionByTeam(teamId);
    expect(session).toBeDefined();
    
    const round = await getCurrentRound(session.id);
    expect(round.ticket_number).toBe('PROJ-123');
  });
});
```

#### Interactive Component Test
```typescript
describe('Interactive Components', () => {
  test('processes vote button clicks', async () => {
    const mockInteractivePayload = {
      type: 'block_actions',
      actions: [{
        action_id: 'vote_5',
        value: '5'
      }],
      user: { id: 'U123', username: 'john.doe' },
      channel: { id: 'C1234567890' }
    };

    const response = await handleInteractiveComponent(mockInteractivePayload);
    
    expect(response.status).toBe(200);
    
    // Verify vote was recorded
    const round = await getCurrentRound(sessionId);
    const anonymousUserId = generateAnonymousUserId('U123', teamId);
    expect(round.selections[anonymousUserId].points).toBe(5);
  });
});
```

### Error Scenario Tests

```typescript
describe('Error Handling', () => {
  test('handles team not found gracefully', async () => {
    const mockPayload = {
      command: '/poke',
      text: 'PROJ-123',
      channel_id: 'INVALID_CHANNEL'
    };

    const response = await handleSlackCommand(mockPayload);
    
    expect(response.status).toBe(200);
    expect(response.body).toContain('team not found');
  });

  test('handles database errors', async () => {
    // Mock database failure
    jest.spyOn(supabase, 'from').mockImplementation(() => {
      throw new Error('Database connection failed');
    });

    const response = await handleSlackCommand(validPayload);
    
    expect(response.status).toBe(200);
    expect(response.body).toContain('error occurred');
  });
});
```

### Manual Testing Checklist

#### Setup Requirements
- [ ] Test Slack workspace with bot installed
- [ ] Team configured with slack_channel_id
- [ ] Slash command configured to point to edge function
- [ ] Interactive components enabled for bot

#### Test Scenarios
- [ ] `/poke PROJ-123` creates new poker round
- [ ] Multiple users can vote independently
- [ ] Votes update in real-time
- [ ] "Play Hand" reveals all votes
- [ ] Error messages for invalid channels/teams
- [ ] Concurrent voting doesn't cause conflicts
- [ ] Ticket title fetching from Jira (if configured)

## Security Considerations

### Slack Request Verification
```typescript
function verifySlackRequest(
  body: string,
  signature: string,
  timestamp: string
): boolean {
  // Verify request signature using Slack signing secret
  // Check timestamp to prevent replay attacks
  // Return true if request is authentic
}
```

### Rate Limiting
- Implement basic rate limiting per user/channel
- Prevent spam commands
- Consider using Supabase edge function built-in rate limiting

### Data Privacy
- Anonymous user IDs don't reveal Slack user information
- Hash Slack user IDs for additional privacy
- Don't store unnecessary Slack user data

## Configuration Requirements

### Supabase Config Update
```toml
[functions.slack-poke]
verify_jwt = false
```

### Environment Variables
- `SLACK_SIGNING_SECRET` (for request verification)
- Standard Supabase environment variables

### Slack App Configuration
- Add `/poke` slash command
- Enable interactive components
- Configure request URLs to point to edge function
- Set appropriate bot scopes: `chat:write`, `commands`

## Deployment Checklist

### Pre-deployment
- [ ] All tests passing
- [ ] Database index created
- [ ] Function added to config
- [ ] Environment variables set

### Deployment
- [ ] Deploy edge function
- [ ] Verify function is accessible
- [ ] Configure Slack app URLs
- [ ] Test with real Slack workspace

### Post-deployment
- [ ] Monitor error logs
- [ ] Verify database performance
- [ ] Test with multiple teams
- [ ] Gather user feedback

## Success Metrics

### Functional Metrics
- Commands processed successfully
- Vote accuracy (matches expected behavior)
- Message update reliability
- Error rate < 1%

### Performance Metrics
- Command response time < 3 seconds
- Database query performance
- Concurrent user handling
- No vote conflicts or data loss

### User Experience Metrics
- User adoption rate
- Command usage frequency
- User feedback scores
- Feature completeness vs. requirements

## Future Enhancements

### Potential Improvements
1. **Persistent Voting Sessions**: Save/resume poker sessions
2. **Advanced Analytics**: Voting patterns and insights
3. **Custom Point Scales**: Configurable point values per team
4. **Integrations**: Direct ticket updates to Jira with final points
5. **Notifications**: Remind team members to vote
6. **Multi-round Sessions**: Support multiple tickets in one session

### Technical Debt Considerations
- Monitor function performance and optimize if needed
- Consider splitting into multiple functions if complexity grows
- Evaluate need for caching layer for high-traffic teams
- Review and update error handling based on production usage

---

This implementation plan provides a comprehensive roadmap for building the Slack poker integration feature while maintaining code quality, security, and scalability. 