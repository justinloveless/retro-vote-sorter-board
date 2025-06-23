// Message generation utilities for Slack poker bot
// Separated from main index.ts to avoid Supabase initialization during testing

export function generateVoteProgressText(
  currentVotes: Record<string, { points: number; display_name: string }>,
  gameState: 'Voting' | 'Playing'
): string {
  if (gameState === 'Playing') {
    // Playing phase: Show actual votes
    const sortedVotes = Object.values(currentVotes)
      .filter(vote => vote && typeof vote.display_name === 'string')
      .sort((a, b) => a.display_name.localeCompare(b.display_name));
    
    const resultLines = sortedVotes.map(vote => 
      `${vote.display_name}: ${vote.points === -1 ? 'Abstain' : vote.points + ' pts'}`
    );
    
    return `*Results:*\n${resultLines.join('\n')}`;
  }
  
  // Voting phase: Show progress with checkmarks
  if (Object.keys(currentVotes).length === 0) {
    return '*Voting Progress:*\n_Waiting for votes..._';
  }
  
  const sortedVotes = Object.values(currentVotes)
    .filter(vote => vote && typeof vote.display_name === 'string')
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
  
  const progressLines = sortedVotes.map(vote => 
    `${vote.points === -1 ? '❌' : '✅'} ${vote.display_name}`
  );
  
  return `*Voting Progress:*\n${progressLines.join('\n')}`;
}

export function generateVoteSummary(
  votes: Record<string, { points: number; display_name: string }>
): string {
  if (Object.keys(votes).length === 0) {
    return '0 votes';
  }
  
  // Group votes by point value
  const voteGroups: Record<number, number> = {};
  Object.values(votes)
    .filter(vote => vote && typeof vote.points === 'number')
    .forEach(vote => {
      voteGroups[vote.points] = (voteGroups[vote.points] || 0) + 1;
    });
  
  // Sort by point value, with abstentions (-1) at the end
  const sortedEntries = Object.entries(voteGroups)
    .map(([points, count]) => ({ points: parseInt(points), count }))
    .sort((a, b) => {
      if (a.points === -1) return 1;
      if (b.points === -1) return -1;
      return a.points - b.points;
    });
  
  const summaryParts = sortedEntries.map(({ points, count }) => 
    `${count} x ${points === -1 ? 'Abstain' : points + ' pts'}`
  );
  
  return summaryParts.join(', ');
}

export function generateVotingMessage(
  ticketNumber: string | null,
  ticketTitle: string | null,
  currentVotes: Record<string, { points: number; display_name: string }>,
  gameState: 'Voting' | 'Playing',
  teamId?: string,
  roundNumber?: number
): any {
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
        text: generateVoteProgressText(currentVotes, gameState)
      }
    }
  ];

  // Add link to poker session if team ID is available
  if (teamId) {
    const baseUrl = 'https://retro-scope.lovable.app';
    const sessionUrl = roundNumber 
      ? `${baseUrl}/teams/${teamId}/neotro?round=${roundNumber}`
      : `${baseUrl}/teams/${teamId}/neotro`;
    
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🔗 <${sessionUrl}|View in RetroScope>`
      }
    });
  }

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
          text: { type: 'plain_text', text: '🎴 Play Hand' },
          action_id: 'play_hand',
          value: 'play_hand',
          style: 'primary'
        }
      ]
    });
  } else if (gameState === 'Playing') {
    // Add vote summary for playing phase
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Summary:* ${generateVoteSummary(currentVotes)}`
      }
    });
  }

  return { blocks };
} 