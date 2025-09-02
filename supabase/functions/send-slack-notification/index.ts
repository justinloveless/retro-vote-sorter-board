// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// More flexible Block type for Slack messages
type Block = {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  fields?: {
    type: string;
    text: string;
  }[];
};

interface SlackMessage {
  blocks: Block[];
  text: string; // Fallback text
  username?: string;
  icon_emoji?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { boardId, teamId, boardTitle, roomId, startedBy } = await req.json()

    // Add a check to prevent duplicate notifications from race conditions
    const oneMinuteAgo = new Date(new Date().getTime() - 60000).toISOString()
    const { count: recentSessionCount, error: recentSessionError } = await supabase
      .from('retro_board_sessions')
      .select('id', { count: 'exact' })
      .eq('board_id', boardId)
      .gte('created_at', oneMinuteAgo)

    if (recentSessionError) {
      console.error('Error checking for recent sessions:', recentSessionError.message)
      // Proceed, but be aware of potential duplicates if this check fails
    }

    if (recentSessionCount && recentSessionCount > 1) {
      console.log(`Found ${recentSessionCount} recent sessions for board ${boardId}. Assuming notification already sent. Skipping.`)
      return new Response(
        JSON.stringify({ success: true, message: 'Duplicate notification skipped' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    console.log('Sending Slack notification for board:', boardId, 'team:', teamId)

    // Get team information, including the Slack bot token and channel ID
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('name, slack_bot_token, slack_channel_id')
      .eq('id', teamId)
      .single()

    if (teamError) {
      throw new Error(`Error fetching team data: ${teamError.message}`)
    }

    if (!team || !team.slack_bot_token || !team.slack_channel_id) {
      console.log(`No Slack integration configured for team ${teamId}. Skipping notification.`)
      return new Response(
        JSON.stringify({ success: true, message: 'No Slack integration configured' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    const { slack_bot_token: botToken, slack_channel_id: channelId, name: teamName = 'Unknown Team' } = team

    // Get user information
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', startedBy)
      .single()

    const userName = profile?.full_name || 'Someone'

    // Create the Slack message using blocks
    const slackMessage: SlackMessage = {
      text: `🎯 Retrospective Session Started!`, // Fallback text
      username: 'RetroScope Bot',
      icon_emoji: ':spiral_calendar_pad:',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🎯 Retrospective Session Started!',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Board Title:*\n${boardTitle}`,
            },
            {
              type: 'mrkdwn',
              text: `*Team:*\n${teamName}`,
            },
            {
              type: 'mrkdwn',
              text: `*Started by:*\n${userName}`,
            },
            {
              type: 'mrkdwn',
              text: `*Room ID:*\n${roomId}`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*<${(Deno.env.get('SITE_URL') || req.headers.get('origin') || 'http://localhost:3000').replace(/\/$/, '')}/retro/${roomId}|Join the retro>*`,
          },
        },
      ],
    }

    // Send the message to Slack
    const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${botToken}`,
      },
      body: JSON.stringify({
        channel: channelId,
        ...slackMessage,
      }),
    })

    const slackResponseData = await slackResponse.json()
    if (!slackResponseData.ok) {
      throw new Error(`Slack API error: ${slackResponseData.error}`)
    }

    console.log('Slack notification sent successfully')

    return new Response(
      JSON.stringify({ success: true, message: 'Slack notification sent' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error sending Slack notification:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
