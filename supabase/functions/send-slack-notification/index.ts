import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SlackMessage {
  text: string;
  username?: string;
  icon_emoji?: string;
  attachments?: Array<{
    color: string;
    fields: Array<{
      title: string;
      value: string;
      short: boolean;
    }>;
  }>;
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

    // Get team information, including the Slack webhook URL
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('name, slack_webhook_url')
      .eq('id', teamId)
      .single()

    if (teamError) {
      throw new Error(`Error fetching team data: ${teamError.message}`)
    }

    if (!team || !team.slack_webhook_url) {
      console.log(`No Slack webhook URL configured for team ${teamId}. Skipping notification.`)
      return new Response(
        JSON.stringify({ success: true, message: 'No Slack webhook URL configured' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    const { slack_webhook_url: webhookUrl, name: teamName = 'Unknown Team' } = team

    // Get user information
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', startedBy)
      .single()

    const userName = profile?.full_name || 'Someone'

    // Create the Slack message
    const slackMessage: SlackMessage = {
      text: `🎯 Retrospective Session Started!`,
      username: 'RetroScope Bot',
      icon_emoji: ':spiral_calendar_pad:',
      attachments: [
        {
          color: '#4F46E5',
          fields: [
            {
              title: 'Board Title',
              value: boardTitle,
              short: true
            },
            {
              title: 'Team',
              value: teamName,
              short: true
            },
            {
              title: 'Started by',
              value: userName,
              short: true
            },
            {
              title: 'Room ID',
              value: roomId,
              short: true
            },
            {
              title: 'Join the retro',
              value: `Click here to participate: ${req.headers.get('origin') || 'https://preview--retro-vote-sorter-board.lovable.app'}/retro/${roomId}`,
              short: false
            }
          ]
        }
      ]
    }

    // Send the message to Slack
    const slackResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(slackMessage),
    })

    if (!slackResponse.ok) {
      throw new Error(`Slack API error: ${slackResponse.status} ${slackResponse.statusText}`)
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
