import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { teamId, searchText, statusFilter, startAt = 0, maxResults = 50 } = await req.json();

    if (!teamId) {
      throw new Error('Missing required parameter: teamId');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: teamData, error: teamError } = await supabaseClient
      .from('teams')
      .select("jira_domain, jira_email, jira_api_key, jira_ticket_prefix, jira_board_id")
      .eq('id', teamId)
      .single();

    if (teamError) throw teamError;

    const { jira_domain, jira_email, jira_api_key, jira_ticket_prefix, jira_board_id } = teamData;

    if (!jira_domain || !jira_api_key || !jira_email) {
      return new Response(
        JSON.stringify({ error: 'Jira credentials are not fully configured for this team.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Build JQL query
    const jqlParts: string[] = [];
    
    // Use board ID (project key) if configured
    const projectKey = jira_board_id || jira_ticket_prefix;
    if (projectKey) {
      jqlParts.push(`project = "${projectKey}"`);
    }

    // Filter by status (exclude Done by default)
    if (statusFilter === 'all') {
      // No status filter
    } else if (statusFilter) {
      jqlParts.push(`status = "${statusFilter}"`);
    } else {
      jqlParts.push(`status != "Done"`);
    }

    // Text search
    if (searchText) {
      jqlParts.push(`(summary ~ "${searchText}" OR key = "${searchText}")`);
    }

    jqlParts.push('ORDER BY rank ASC');

    const jql = jqlParts.join(' AND ');
    const auth = btoa(`${jira_email}:${jira_api_key}`);
    
    const params = new URLSearchParams({
      jql,
      startAt: String(startAt),
      maxResults: String(maxResults),
      fields: 'summary,status,priority,assignee,issuetype,customfield_10016', // customfield_10016 = story points in most Jira setups
    });

    const jiraUrl = `${jira_domain}/rest/api/2/search?${params.toString()}`;

    const jiraResponse = await fetch(jiraUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    if (!jiraResponse.ok) {
      const errorBody = await jiraResponse.text();
      throw new Error(`Jira API error (${jiraResponse.status}): ${errorBody}`);
    }

    const searchData = await jiraResponse.json();

    // Transform to a simpler shape
    const issues = (searchData.issues || []).map((issue: any) => ({
      key: issue.key,
      summary: issue.fields?.summary || '',
      status: issue.fields?.status?.name || '',
      statusCategory: issue.fields?.status?.statusCategory?.key || '',
      priority: issue.fields?.priority?.name || '',
      priorityIconUrl: issue.fields?.priority?.iconUrl || '',
      assignee: issue.fields?.assignee?.displayName || null,
      issueType: issue.fields?.issuetype?.name || '',
      issueTypeIconUrl: issue.fields?.issuetype?.iconUrl || '',
      storyPoints: issue.fields?.customfield_10016 || null,
    }));

    return new Response(JSON.stringify({
      issues,
      total: searchData.total || 0,
      startAt: searchData.startAt || 0,
      maxResults: searchData.maxResults || maxResults,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
