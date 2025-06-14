import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Admin client for server-side operations
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { teamId, ticketNumber } = await req.json();

    if (!teamId || !ticketNumber) {
      return new Response(JSON.stringify({ error: "teamId and ticketNumber are required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Fetch Jira credentials for the team
    const { data: teamData, error: teamError } = await supabaseAdmin
      .from("teams")
      .select("jira_domain, jira_email, jira_api_key")
      .eq("id", teamId)
      .single();

    if (teamError || !teamData) {
      return new Response(JSON.stringify({ error: "Failed to fetch team credentials" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    const { jira_domain, jira_email, jira_api_key } = teamData;

    if (!jira_domain || !jira_email || !jira_api_key) {
      return new Response(JSON.stringify({ error: "Jira not configured for this team" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Fetch ticket details from Jira API
    const response = await fetch(
      `https://${jira_domain}/rest/api/3/issue/${ticketNumber}`,
      {
        headers: {
          Authorization: `Basic ${btoa(`${jira_email}:${jira_api_key}`)}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
        const errorBody = await response.text();
        return new Response(JSON.stringify({ error: `Jira API error: ${response.statusText}`, details: errorBody }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: response.status,
        });
    }

    const jiraIssue = await response.json();
    const ticketTitle = jiraIssue.fields.summary;

    return new Response(JSON.stringify({ ticketTitle }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
}); 