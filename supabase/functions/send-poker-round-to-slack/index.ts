/// <reference types="https://deno.land/x/supa_fly/types.d.ts" />

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders } from "../_shared/cors.ts";

interface PokerRoundPayload {
  teamId: string;
  ticketNumber?: string;
  ticketTitle?: string;
  selections: Record<string, { name: string; points: number }>;
  averagePoints: number;
  chatMessages?: { user_name: string; message: string }[];
}

type Block = 
  | {
      type: "header";
      text: {
        type: "plain_text";
        text: string;
        emoji?: boolean;
      };
    }
  | {
      type: "section";
      text?: {
        type: "mrkdwn";
        text: string;
      };
      fields?: {
        type: "mrkdwn";
        text: string;
      }[];
    }
  | {
      type: "divider";
    }
  | {
      type: "context",
      elements: {
        type: "mrkdwn",
        text: string
      }[]
    };

const postToSlack = async (webhookUrl: string, message: any) => {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  const responseText = await response.text();

  return {
    ok: response.ok && responseText === 'ok',
    error: response.ok ? null : responseText
  };
};

const formatPokerResultMessage = (payload: PokerRoundPayload) => {
  const { ticketNumber, ticketTitle, selections, averagePoints, chatMessages } = payload;

  const getJiraUrl = (ticket: string) => `https://runway.atlassian.net/browse/${ticket}`;

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
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*<${getJiraUrl(ticketNumber)}|${ticketNumber}>*: ${ticketTitle || 'No Title'}`,
      },
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

  if (chatMessages && chatMessages.length > 0) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Round Chat Summary:*"
      }
    });
    chatMessages.forEach(chat => {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `*${chat.user_name}*: ${chat.message}`,
          },
        ],
      });
    });
  }

  return { blocks };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: PokerRoundPayload = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: team, error: teamError } = await supabaseAdmin
      .from("teams")
      .select("slack_webhook_url")
      .eq("id", payload.teamId)
      .single();

    if (teamError || !team || !team.slack_webhook_url) {
      throw new Error(`Could not find a Slack webhook URL for team ${payload.teamId}`);
    }

    const message = formatPokerResultMessage(payload);
    const slackResponse = await postToSlack(team.slack_webhook_url, message);

    if (slackResponse.ok === false) {
      console.error("Slack API error:", slackResponse.error);
      throw new Error(`Failed to send message to Slack: ${slackResponse.error || 'Unknown error'}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
}); 