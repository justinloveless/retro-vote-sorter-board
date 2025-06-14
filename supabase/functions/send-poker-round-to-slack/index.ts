/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface PokerRoundPayload {
  teamId: string;
  ticketNumber?: string;
  ticketTitle?: string;
  selections: Record<string, { name: string; points: number }>;
  averagePoints: number;
  chatMessages?: { 
    user_name: string; 
    message: string; 
    created_at: string; 
    reactions: { user_name: string; emoji: string }[],
    reply_to_message_user?: string,
    reply_to_message_content?: string,
  }[];
  jiraUrl?: string | null;
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
  image_url?: string;
  alt_text?: string;
  elements?: {
    type: string;
    text: string;
  }[];
};

const postToSlack = async (botToken: string, channelId: string, message: any, threadTs?: string) => {
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${botToken}`,
    },
    body: JSON.stringify({
      channel: channelId,
      ...message,
      ...(threadTs && { thread_ts: threadTs }),
    }),
  });
  return response.json();
};

const formatPokerResultMessage = (payload: PokerRoundPayload) => {
  const { ticketNumber, ticketTitle, selections, averagePoints, jiraUrl } = payload;

  const blocks: Block[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "Poker Round Results",
        emoji: true,
      },
    },
  ];

  if (ticketNumber) {
    const text = jiraUrl
      ? `*<${jiraUrl}|${ticketNumber}>*${ticketTitle ? ': ' + ticketTitle : ''}`
      : `*${ticketNumber}*${ticketTitle ? ': ' + ticketTitle : ''}`;
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text },
    });
  } else if (ticketTitle) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*${ticketTitle}*` },
    });
  }

  blocks.push({
    type: "section",
    fields: [
      {
        type: "mrkdwn",
        text: `*Average Points:*\n${averagePoints.toFixed(2)}`,
      },
    ],
  });

  blocks.push({ type: "divider" });

  const votes: string[] = [];
  const abstained: string[] = [];

  for (const user in selections) {
    const selection = selections[user];
    if (selection.points === -1) {
      abstained.push(selection.name);
    } else {
      votes.push(`${selection.name}: *${selection.points} pts*`);
    }
  }

  if (votes.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Votes:*\n${votes.join('\n')}`,
      },
    });
  }

  if (abstained.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Abstained:*\n${abstained.join(', ')}`,
      },
    });
  }

  return { blocks };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: PokerRoundPayload = await req.json();
    const { teamId, chatMessages } = payload;
    
    // Auth must be handled by the client calling the function
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Missing Authorization header");

    // Can't use service_role_key with RLS. Client must provide user's JWT.
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    
    const { data: team, error: teamError } = await supabaseClient
      .from("teams")
      .select("slack_bot_token, slack_channel_id")
      .eq("id", teamId)
      .single();

    if (teamError) throw teamError;

    if (!team || !team.slack_bot_token || !team.slack_channel_id) {
      throw new Error(`Slack is not configured for team ${teamId}`);
    }

    // Post the main message
    const mainMessage = formatPokerResultMessage(payload);
    const mainMessageResponse = await postToSlack(team.slack_bot_token, team.slack_channel_id, mainMessage);

    if (!mainMessageResponse.ok) {
      console.error("Slack API error (main message):", mainMessageResponse.error);
      throw new Error(`Failed to send message to Slack: ${mainMessageResponse.error || 'Unknown error'}`);
    }

    // Post chat messages as threaded replies
    if (chatMessages && chatMessages.length > 0) {
      const parentTs = mainMessageResponse.ts;
      
      // Sort messages by timestamp before sending
      const sortedMessages = chatMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      const chatSummary = {
        blocks: [{
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Round Chat Summary:*"
          }
        }]
      };
      await postToSlack(team.slack_bot_token, team.slack_channel_id, chatSummary, parentTs);

      for (const chat of sortedMessages) {
        // 1. Parse the main message content into blocks
        const messageContentBlocks: Block[] = [];
        const parts = chat.message.replace(/<p>|<\/p>/g, '').split(/<img src="([^"]+)"[^>]*>/g);
        parts.forEach((part, index) => {
          if (index % 2 === 0) { // Text part
            if (part.trim()) {
              // Convert <pre> blocks to Slack's format
              const withCodeBlocks = part.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, '```\n$1\n```');
              
              // Convert inline <code> tags to Slack's format
              const withInlineCode = withCodeBlocks.replace(/<code>(.*?)<\/code>/g, '`$1`');

              // Convert <a href> tags to Slack's format
              const textWithoutBr = withInlineCode.replace(/<br\s*\/?>/g, ' ').trim();
              const slackText = textWithoutBr.replace(/<a.*?href="([^"]+)".*?>([^<]+)<\/a>/g, '<$1|$2>');
              if (slackText) {
                messageContentBlocks.push({
                  type: 'section',
                  text: { type: 'mrkdwn', text: slackText },
                });
              }
            }
          } else { // Image URL part
            messageContentBlocks.push({
              type: 'image',
              image_url: part,
              alt_text: 'User-uploaded image',
            });
          }
        });

        // 2. Prepend the username to the main message content
        if (messageContentBlocks.length > 0) {
          const firstTextIndex = messageContentBlocks.findIndex(b => b.type === 'section' && b.text);
          if (firstTextIndex !== -1) {
            const firstTextBlock = messageContentBlocks[firstTextIndex];
            if (firstTextBlock.text) {
              firstTextBlock.text.text = `*${chat.user_name}*: ${firstTextBlock.text.text}`;
            }
          } else {
            messageContentBlocks.unshift({
              type: 'section',
              text: { type: 'mrkdwn', text: `*${chat.user_name}*:` },
            });
          }
        }
        
        // 3. Prepend the reply quote block if it exists
        const finalBlocks: Block[] = [];
        if (chat.reply_to_message_user && chat.reply_to_message_content) {
          const cleanReplyContent = chat.reply_to_message_content.replace(/<[^>]+>/g, '');
          finalBlocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `> *${chat.reply_to_message_user}*: ${cleanReplyContent}`
            }
          });
        }
        finalBlocks.push(...messageContentBlocks);

        // 4. Add reactions as a context block
        if (chat.reactions && chat.reactions.length > 0) {
          const reactionsByUser = chat.reactions.reduce((acc, reaction) => {
            if (!acc[reaction.emoji]) {
              acc[reaction.emoji] = [];
            }
            acc[reaction.emoji].push(reaction.user_name);
            return acc;
          }, {} as Record<string, string[]>);

          const reactionText = Object.entries(reactionsByUser)
            .map(([emoji, users]) => `${emoji} ${users.join(', ')}`)
            .join('  |  ');
          
          if(reactionText) {
            finalBlocks.push({
              type: 'context',
              elements: [{ type: 'mrkdwn', text: reactionText }],
            });
          }
        }

        if (finalBlocks.length === 0) continue;

        const chatMessage = { blocks: finalBlocks };
        await postToSlack(team.slack_bot_token, team.slack_channel_id, chatMessage, parentTs);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in send-poker-round-to-slack function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
}); 