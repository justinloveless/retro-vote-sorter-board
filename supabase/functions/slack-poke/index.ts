import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { 
  generateVoteProgressText, 
  generateVoteSummary, 
  generateVotingMessage 
} from "./message-utils.ts";

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Types
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
  slack_message_ts?: string;
}

// Utility Functions
export function parseTicketFromText(text: string): {
  ticketNumber: string | null;
  ticketTitle: string | null;
} {
  if (!text || typeof text !== 'string') {
    return { ticketNumber: null, ticketTitle: null };
  }

  // Extract from Jira URLs: https://company.atlassian.net/browse/PROJ-123
  const jiraUrlMatch = text.match(/\/browse\/([A-Z]+-\d+)/);
  if (jiraUrlMatch) {
    return { ticketNumber: jiraUrlMatch[1], ticketTitle: null };
  }

  // Extract from plain text: ABC-123, PROJ-456, etc.
  const ticketMatch = text.match(/\b([A-Z]+-\d+)\b/);
  if (ticketMatch) {
    return { ticketNumber: ticketMatch[1], ticketTitle: null };
  }

  return { ticketNumber: null, ticketTitle: null };
}

export function generateAnonymousUserId(slackUserId: string, teamId: string): string {
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

export function verifySlackRequest(
  body: string,
  signature: string,
  timestamp: string
): boolean {
  const signingSecret = Deno.env.get('SLACK_SIGNING_SECRET');
  if (!signingSecret) {
    console.warn('SLACK_SIGNING_SECRET not configured');
    return true; // Allow for development/testing
  }

  // Check timestamp to prevent replay attacks (within 5 minutes)
  const currentTime = Math.floor(Date.now() / 1000);
  const requestTime = parseInt(timestamp);
  
  if (Math.abs(currentTime - requestTime) > 300) {
    return false;
  }

  // Verify signature
  const baseString = `v0:${timestamp}:${body}`;
  
  // For now, return true for valid format signatures
  // In production, would implement proper HMAC-SHA256 verification
  return signature.startsWith('v0=') && signature.length > 10;
}

export async function findTeamByChannelId(channelId: string): Promise<Team | null> {
  try {
    const { data, error } = await supabase
      .from('teams')
      .select('id, name, slack_channel_id, slack_bot_token')
      .eq('slack_channel_id', channelId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No team found
      }
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error finding team by channel ID:', error);
    throw error;
  }
}

export async function getOrCreatePokerSession(teamId: string): Promise<PokerSession> {
  try {
    // First, try to find existing session
    const { data: existingSession } = await supabase
      .from('poker_sessions')
      .select('*')
      .eq('room_id', teamId)
      .single();

    if (existingSession) {
      return existingSession;
    }

    // Create new session
    const { data: newSession, error } = await supabase
      .from('poker_sessions')
      .insert({
        team_id: teamId,
        room_id: teamId,
        current_round_number: 0,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return newSession;
  } catch (error) {
    console.error('Error getting or creating poker session:', error);
    throw error;
  }
}

export async function createNewRound(
  sessionId: string,
  ticketNumber: string | null,
  ticketTitle: string | null
): Promise<PokerSessionRound> {
  try {
    // Get the current round number
    const { data: session } = await supabase
      .from('poker_sessions')
      .select('current_round_number')
      .eq('id', sessionId)
      .single();
    
    const newRoundNumber = (session?.current_round_number || 0) + 1;
    
    // Update session with new round number
    await supabase
      .from('poker_sessions')
      .update({ current_round_number: newRoundNumber })
      .eq('id', sessionId);

    // Create new round
    const { data: newRound, error } = await supabase
      .from('poker_session_rounds')
      .insert({
        session_id: sessionId,
        round_number: newRoundNumber,
        ticket_number: ticketNumber,
        ticket_title: ticketTitle,
        selections: {},
        game_state: 'Selection',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return newRound;
  } catch (error) {
    console.error('Error creating new round:', error);
    throw error;
  }
}

export async function processVote(
  roundId: string,
  anonymousUserId: string,
  displayName: string,
  points: number
): Promise<void> {
  try {
    // Get current round
    const { data: round } = await supabase
      .from('poker_session_rounds')
      .select('selections')
      .eq('id', roundId)
      .single();

    const currentSelections = round?.selections || {};
    
    // Add/update vote
    currentSelections[anonymousUserId] = {
      points: points,
      display_name: displayName
    };

    // Update round with new selections
    const { error } = await supabase
      .from('poker_session_rounds')
      .update({ selections: currentSelections })
      .eq('id', roundId);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error processing vote:', error);
    throw error;
  }
}

// Functions now imported from message-utils.ts

export function updateVotingMessage(
  originalMessage: any,
  currentVotes: Record<string, { points: number; display_name: string }>,
  gameState: string,
  teamId?: string,
  roundNumber?: number
): any {
  // Extract ticket info from original message if possible
  const ticketInfo = originalMessage?.blocks?.[0]?.text?.text || 'Planning Poker Session';
  const ticketNumber = ticketInfo.includes(':') ? ticketInfo.split(':')[0].replace('🃏 ', '') || null : null;
  const ticketTitle = ticketInfo.includes(':') ? ticketInfo.split(':').slice(1).join(':').trim() || null : null;

  return generateVotingMessage(
    ticketNumber as string | null,
    ticketTitle as string | null,
    currentVotes,
    gameState as 'Voting' | 'Playing',
    teamId,
    roundNumber
  );
}

export async function handleSlackCommand(payload: SlackCommandPayload): Promise<Response> {
  try {
    // Find team by channel ID
    const team = await findTeamByChannelId(payload.channel_id);
    if (!team) {
      return new Response(JSON.stringify({
        text: "❌ This channel is not configured for RetroScope poker sessions. Please contact your team admin.",
        response_type: "ephemeral"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      });
    }

    // Check if bot token is available
    if (!team.slack_bot_token) {
      return new Response(JSON.stringify({
        text: "❌ Bot token not configured for this team. Please contact your admin.",
        response_type: "ephemeral"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      });
    }

    // Parse ticket information
    const { ticketNumber, ticketTitle } = parseTicketFromText(payload.text);

    // Get or create poker session
    const session = await getOrCreatePokerSession(team.id);

    // Create new round
    const round = await createNewRound(session.id, ticketNumber, ticketTitle);

    // Generate initial message
    const message = generateVotingMessage(ticketNumber, ticketTitle, {}, 'Voting', team.id, round.round_number);

    // Post message via Slack API instead of HTTP response
    const messageTs = await postSlackMessage(
      team.slack_bot_token,
      payload.channel_id,
      message
    );

    if (messageTs) {
      // Store the message timestamp in the round for future updates
      await supabase
        .from('poker_session_rounds')
        .update({ slack_message_ts: messageTs })
        .eq('id', round.id);

      // Return ephemeral confirmation to the user who ran the command
      return new Response(JSON.stringify({
        text: "Poker Round Started! 🎴",
        response_type: "ephemeral"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      });
    } else {
      return new Response(JSON.stringify({
        text: "❌ Failed to post poker session message. Please try again.",
        response_type: "ephemeral"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      });
    }

  } catch (error) {
    console.error('Error handling Slack command:', error);
    return new Response(JSON.stringify({
      text: "❌ An error occurred while starting the poker session. Please try again.",
      response_type: "ephemeral"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });
  }
}

export async function handleInteractiveComponent(payload: SlackInteractivePayload): Promise<Response> {
  try {
    const action = payload.actions[0];
    const anonymousUserId = generateAnonymousUserId(payload.user.id, payload.team.id);
    const displayName = payload.user.username;

    // Find team and session
    const team = await findTeamByChannelId(payload.channel.id);
    if (!team) {
      return new Response(JSON.stringify({
        text: "❌ Team not found for this channel."
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      });
    }

    const session = await getOrCreatePokerSession(team.id);

    // Get current round
    const { data: currentRound } = await supabase
      .from('poker_session_rounds')
      .select('*')
      .eq('session_id', session.id)
      .order('round_number', { ascending: false })
      .limit(1)
      .single();

    if (!currentRound) {
      return new Response(JSON.stringify({
        text: "❌ No active poker round found."
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      });
    }

    if (action.action_id.startsWith('vote_') || action.action_id === 'abstain') {
      // Process vote
      const points = parseInt(action.value);
      await processVote(currentRound.id, anonymousUserId, displayName, points);

      // Get updated votes
      const { data: updatedRound } = await supabase
        .from('poker_session_rounds')
        .select('selections')
        .eq('id', currentRound.id)
        .single();

      // Parse selections if they come as JSON string
      let selections = updatedRound?.selections || {};
      if (typeof selections === 'string') {
        try {
          selections = JSON.parse(selections);
        } catch (e) {
          console.error('Failed to parse selections JSON:', e);
          selections = {};
        }
      }

      const updatedMessage = updateVotingMessage(
        payload.message,
        selections,
        'Voting',
        team.id,
        currentRound.round_number
      );

      // Update the Slack message using chat.update API
      const messageTs = currentRound.slack_message_ts || payload.message.ts;
      if (messageTs && team.slack_bot_token) {
        await updateSlackMessage(
          team.slack_bot_token,
          payload.channel.id,
          messageTs,
          updatedMessage
        );
      }

      // Return simple acknowledgment response
      return new Response(JSON.stringify({
        text: "Vote recorded! ✅"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      });
    }

    if (action.action_id === 'play_hand') {
      // Reveal votes - change game state to Playing
      await supabase
        .from('poker_session_rounds')
        .update({ game_state: 'Playing' })
        .eq('id', currentRound.id);

      // Parse selections if they come as JSON string
      let selections = currentRound.selections || {};
      if (typeof selections === 'string') {
        try {
          selections = JSON.parse(selections);
        } catch (e) {
          console.error('Failed to parse selections JSON:', e);
          selections = {};
        }
      }

      const updatedMessage = updateVotingMessage(
        payload.message,
        selections,
        'Playing',
        team.id,
        currentRound.round_number
      );

      // Update the Slack message using chat.update API
      const messageTs = currentRound.slack_message_ts || payload.message.ts;
      if (messageTs && team.slack_bot_token) {
        await updateSlackMessage(
          team.slack_bot_token,
          payload.channel.id,
          messageTs,
          updatedMessage
        );
      }

      // Return simple acknowledgment response
      return new Response(JSON.stringify({
        text: "Hand played! Cards revealed! 🃏"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      });
    }

    // Note: lock_in action removed - no longer needed for Slack workflow

    // Default response
    return new Response(JSON.stringify({
      text: "Action processed."
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });

  } catch (error) {
    console.error('Error handling interactive component:', error);
    return new Response(JSON.stringify({
      text: "❌ An error occurred while processing your action."
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });
  }
}

/**
 * Posts a message to Slack using the chat.postMessage API
 */
export async function postSlackMessage(
  botToken: string,
  channelId: string,
  messageContent: any
): Promise<string | null> {
  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channelId,
        blocks: messageContent.blocks,
        text: messageContent.text || 'Poker session started'
      })
    });

    const result = await response.json();
    
    if (!result.ok) {
      console.error('Slack chat.postMessage failed:', result.error);
      return null;
    }

    console.log('Successfully posted Slack message');
    return result.ts; // Return message timestamp
  } catch (error) {
    console.error('Error posting Slack message:', error);
    return null;
  }
}

/**
 * Updates a Slack message using the chat.update API
 */
export async function updateSlackMessage(
  botToken: string,
  channelId: string,
  messageTs: string,
  messageContent: any
): Promise<boolean> {
  try {
    const response = await fetch('https://slack.com/api/chat.update', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channelId,
        ts: messageTs,
        blocks: messageContent.blocks,
        text: messageContent.text || 'Poker session update'
      })
    });

    const result = await response.json();
    
    if (!result.ok) {
      console.error('Slack chat.update failed:', result.error);
      return false;
    }

    console.log('Successfully updated Slack message');
    return true;
  } catch (error) {
    console.error('Error updating Slack message:', error);
    return false;
  }
}

// Main handler
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('req', req);
    const contentType = req.headers.get('content-type') || '';
    let payload: SlackCommandPayload | SlackInteractivePayload;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      // Slack command or interactive component
      const formData = await req.formData();
      
      if (formData.has('payload')) {
        // Interactive component
        const payloadStr = formData.get('payload') as string;
        payload = JSON.parse(payloadStr);
        return await handleInteractiveComponent(payload as SlackInteractivePayload);
      } else {
        // Slash command
        payload = Object.fromEntries(formData.entries()) as any;
        return await handleSlackCommand(payload as SlackCommandPayload);
      }
    }

    return new Response(JSON.stringify({ error: 'Unsupported content type' }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400
    });

  } catch (error) {
    console.error('Handler error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
}); 