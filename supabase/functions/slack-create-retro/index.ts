
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Parse the form data from Slack
    const formData = await req.formData()
    const command = formData.get('command')
    const text = formData.get('text')
    const userId = formData.get('user_id')
    const userName = formData.get('user_name')
    const teamId = formData.get('team_id')
    const teamDomain = formData.get('team_domain')

    console.log('Slack slash command received:', {
      command,
      text,
      userId,
      userName,
      teamId,
      teamDomain
    })

    // Extract board title from the text parameter, or use default
    const boardTitle = text && text.toString().trim()
      ? text.toString().trim()
      : `${userName}'s Retrospective`

    // Generate a room ID
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase()

    // Create the retro board
    const { data: board, error: boardError } = await supabase
      .from('retro_boards')
      .insert([{
        room_id: roomId,
        title: boardTitle,
        creator_id: null, // No authenticated user for Slack commands
        is_private: false, // Make public by default for Slack integration
        password_hash: null
      }])
      .select()
      .single()

    if (boardError) {
      console.error('Error creating board:', boardError)
      throw new Error('Failed to create retro board')
    }

    console.log('Board created successfully:', board)

    // Create default columns for the board
    const defaultColumns = [
      { title: 'What went well?', color: '#10B981', position: 0, is_action_items: false },
      { title: 'What could be improved?', color: '#F59E0B', position: 1, is_action_items: false },
      { title: 'Action items', color: '#EF4444', position: 2, is_action_items: true }
    ]

    const { error: columnsError } = await supabase
      .from('retro_columns')
      .insert(
        defaultColumns.map(col => ({
          ...col,
          board_id: board.id
        }))
      )

    if (columnsError) {
      console.error('Error creating columns:', columnsError)
      // Don't fail the request if columns fail, board still exists
    }

    // Create board config with default settings
    const { error: configError } = await supabase
      .from('retro_board_config')
      .insert([{
        board_id: board.id,
        allow_anonymous: true,
        voting_enabled: true,
        max_votes_per_user: 3,
        show_author_names: true
      }])

    if (configError) {
      console.error('Error creating board config:', configError)
      // Don't fail the request if config fails
    }

    // Generate the board URL
    const boardUrl = `${req.headers.get('origin') || 'https://retroscope.lovelesslabstx.com'}/retro/${roomId}`

    // Create Slack response
    const slackResponse = {
      response_type: 'in_channel', // Make the response visible to everyone in the channel
      text: `🎯 Retrospective Board Created!`,
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
              title: 'Room ID',
              value: roomId,
              short: true
            },
            {
              title: 'Join the Retro',
              value: `<${boardUrl}|Click here to join the retrospective>`,
              short: false
            }
          ],
          footer: 'RetroScope Bot',
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    }

    return new Response(
      JSON.stringify(slackResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in slack-create-retro function:', error)

    // Return error response to Slack
    const errorResponse = {
      response_type: 'ephemeral', // Only visible to the user who ran the command
      text: '❌ Sorry, there was an error creating the retro board. Please try again.',
    }

    return new Response(
      JSON.stringify(errorResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Always return 200 to Slack, even for errors
      }
    )
  }
})
