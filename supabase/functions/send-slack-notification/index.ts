
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

serve(async (req) => {
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

    console.log('Sending Slack notification for board:', boardId, 'team:', teamId)

    // For now, use the hardcoded webhook URL
    const webhookUrl = "https://hooks.slack.com/services/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"

    // Get team information
    const { data: team } = await supabase
      .from('teams')
      .select('name')
      .eq('id', teamId)
      .single()

    // Get user information
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', startedBy)
      .single()

    const userName = profile?.full_name || 'Someone'
    const teamName = team?.name || 'Unknown Team'

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
              value: `Click here to participate: ${req.headers.get('origin') || 'https://your-app-url.com'}/retro/${roomId}`,
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
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
