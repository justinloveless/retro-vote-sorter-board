# Slack Poker Real-time Message Updates Implementation Plan

## Feature Overview

Enhance the existing Slack poker bot to show real-time voting progress and final results directly in the Slack message, providing immediate visual feedback to participants.

## Requirements Analysis

### Current Behavior
- Message shows generic "X votes cast" 
- Vote reveals show plain text results
- "Lock In" button exists but isn't necessary for Slack workflow

### New Behavior Required

#### During Voting Phase (`game_state: 'Selection'`)
1. **Real-time Vote Display**: Show each user's status as they vote
   - ✅ Green check for users who voted on a number
   - ❌ Red X for users who abstained
   - User names displayed with their status
2. **No Lock-in Required**: Voting a number automatically locks the vote
3. **Vote Changes**: Users can change votes by clicking different numbers
4. **Remove Lock-in Button**: Not needed for Slack workflow

#### After Playing Hand (`game_state: 'Playing'`)
1. **Revealed Results**: Show actual vote values instead of checkmarks
   - `John: 5 pts`, `Jane: 8 pts`, `Mike: Abstain`
2. **Vote Summary**: Add aggregated results 
   - `3 x 5 pts, 2 x 8 pts, 1 x Abstain`
3. **Remove Interactive Elements**: No voting buttons after reveal

## Implementation Strategy

### Core Components to Modify

#### 1. **Enhanced Vote Progress Display**
```typescript
interface VoteStatus {
  display_name: string;
  points: number;
  hasVoted: boolean;
}

function generateVoteProgressText(
  currentVotes: Record<string, { points: number; display_name: string }>,
  gameState: 'Voting' | 'Playing'
): string {
  // Voting phase: Show checkmarks/X marks
  // Playing phase: Show actual votes + summary
}
```

#### 2. **Remove Lock-in Logic**
- Remove "🔒 Lock In" button from voting interface
- Direct vote processing without lock-in step
- Remove any lock-in handling from `handleInteractiveComponent`

#### 3. **Vote Summary Generation**
```typescript
function generateVoteSummary(
  votes: Record<string, { points: number; display_name: string }>
): string {
  // Group by point values
  // Generate "X x Y pts" format
  // Handle abstentions separately
}
```

#### 4. **Message Structure Updates**
```typescript
// Enhanced message structure:
[
  { type: 'header', text: 'Ticket Info' },
  { type: 'section', text: 'Vote Progress Display' },
  { type: 'actions', elements: [...voting buttons] }, // Only during voting
  { type: 'section', text: 'Vote Summary' } // Only after reveal
]
```

### Implementation Phases

#### Phase 1: Vote Progress Display (Est: 45 min)
1. **Update `generateVotingMessage` function**
   - Add real-time vote status display
   - Show user names with ✅/❌ indicators
   - Remove lock-in button

2. **Enhance vote status text generation**
   - Create helper function for vote progress
   - Handle empty state gracefully
   - Sort users alphabetically for consistent display

#### Phase 2: Vote Summary & Results (Est: 30 min)
1. **Create vote summary generator**
   - Group votes by point value
   - Format summary text (e.g., "3 x 5 pts, 2 x abstains")
   - Handle edge cases (no votes, all abstains, etc.)

2. **Update playing state display**
   - Show actual vote values instead of progress indicators
   - Add vote summary section
   - Remove all interactive buttons

#### Phase 3: Remove Lock-in Logic (Est: 15 min)
1. **Update interactive component handler**
   - Remove lock-in handling
   - Simplify vote processing workflow
   - Update button generation

2. **Clean up unused lock-in references**
   - Remove from message generation
   - Update tests to reflect new behavior

### Testing Strategy

#### Unit Tests
1. **Vote Progress Display Tests**
   ```typescript
   // Test voting phase progress display
   test('shows user names with checkmarks during voting')
   test('shows red X for abstentions') 
   test('handles empty votes state')
   test('sorts users alphabetically')
   ```

2. **Vote Summary Tests**
   ```typescript
   // Test playing phase summary generation
   test('generates correct vote summary format')
   test('handles mixed votes and abstentions')
   test('handles edge cases (all same vote, all abstain)')
   ```

3. **Message Structure Tests**
   ```typescript
   // Test complete message generation
   test('voting phase shows progress and buttons')
   test('playing phase shows results without buttons')
   test('removes lock-in button from voting interface')
   ```

#### Integration Tests
1. **Real-time Update Flow**
   ```typescript
   // Test complete voting flow
   test('message updates as users vote')
   test('user can change their vote')
   test('play hand reveals all votes and summary')
   ```

2. **Button Interaction Tests**
   ```typescript
   // Test interactive component handling
   test('vote buttons update message immediately')
   test('no lock-in button present')
   test('play hand removes all interactive elements')
   ```

### Implementation Details

#### Vote Progress Text Format
```
Voting Phase:
"*Voting Progress:*
✅ John Doe
✅ Jane Smith  
❌ Mike Wilson
_Waiting for others..._"

Playing Phase:
"*Results:*
John Doe: 5 pts
Jane Smith: 8 pts
Mike Wilson: Abstain

*Summary:* 1 x 5 pts, 1 x 8 pts, 1 x Abstain"
```

#### Message Block Structure
```typescript
// Voting Phase
{
  blocks: [
    { type: 'header', text: '🃏 PROJ-123: Story Title' },
    { type: 'section', text: '*Voting Progress:*\n✅ John\n✅ Jane\n❌ Mike' },
    { type: 'actions', elements: [vote buttons] },
    { type: 'actions', elements: [abstain, play hand] }
  ]
}

// Playing Phase  
{
  blocks: [
    { type: 'header', text: '🃏 PROJ-123: Story Title' },
    { type: 'section', text: '*Results:*\nJohn: 5 pts\nJane: 8 pts\nMike: Abstain' },
    { type: 'section', text: '*Summary:* 2 x 5 pts, 1 x Abstain' }
  ]
}
```

#### Key Functions to Implement/Modify

1. **`generateVoteProgressText(votes, gameState)`**
   - Returns formatted progress string
   - Handles both voting and playing states

2. **`generateVoteSummary(votes)`**
   - Returns aggregated vote summary
   - Groups by point values

3. **Updated `generateVotingMessage()`**
   - Uses new progress display
   - Removes lock-in button
   - Adds summary for playing state

4. **Updated `handleInteractiveComponent()`**
   - Removes lock-in handling
   - Immediate vote updates

### Edge Cases to Handle

1. **No Votes Yet**: Show waiting message
2. **All Abstentions**: Handle summary gracefully  
3. **User Changes Vote**: Update display correctly
4. **Single User**: Don't show waiting message
5. **Long Names**: Truncate if necessary
6. **Special Characters**: Escape for Slack markdown

### Success Criteria

✅ **Real-time Updates**: Message updates immediately when users vote  
✅ **Visual Feedback**: Clear ✅/❌ indicators for vote status  
✅ **No Lock-in Required**: Direct voting without extra confirmation  
✅ **Vote Summary**: Aggregated results after reveal  
✅ **Clean UI**: No buttons after hand is played  
✅ **Backwards Compatible**: Existing tests still pass  
✅ **User Experience**: Intuitive and responsive voting flow

## Implementation Timeline

- **Phase 1**: Vote Progress Display (45 min)
- **Phase 2**: Vote Summary & Results (30 min)  
- **Phase 3**: Remove Lock-in Logic (15 min)
- **Testing & Polish**: (30 min)

**Total Estimated Time**: 2 hours

## Testing Approach

Following TDD principles:
1. Write tests for new vote progress display
2. Write tests for vote summary generation
3. Write tests for updated message structure
4. Run tests (expect failures)
5. Implement features to pass tests
6. Verify no test modifications needed
7. Commit complete feature 