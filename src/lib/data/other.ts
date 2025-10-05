import { supabase } from '@/integrations/supabase/client';

// Team Action Items (non-realtime helpers)

export async function fetchOpenTeamActionItems(teamId: string): Promise<Array<{ id: string; text: string; assigned_to?: string | null }>> {
    const { data, error } = await supabase
        .from('team_action_items')
        .select('id, text, assigned_to')
        .eq('team_id', teamId)
        .eq('done', false)
        .order('created_at');
    if (error) throw error;
    return data || [];
}

export async function markTeamActionItemDoneById(id: string): Promise<void> {
    const { error } = await supabase
        .from('team_action_items')
        .update({ done: true, done_at: new Date().toISOString() })
        .eq('id', id);
    if (error) throw error;
}

// App Config & Feedback Reports

export async function getAppConfigValue(key: string): Promise<string | ''> {
    const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', key)
        .single();
    if (error && (error as any).code !== 'PGRST116') throw error;
    return (data?.value as string) || '';
}

export async function upsertAppConfig(entries: Array<{ key: string; value: string }>): Promise<void> {
    const { error } = await supabase
        .from('app_config')
        .upsert(entries, { onConflict: 'key' });
    if (error) throw error;
}

export async function insertFeedbackReport(params: {
    userId?: string | null;
    email?: string | null;
    type: string;
    title: string;
    description: string;
    pageUrl: string;
}): Promise<{ id: string }> {
    const { data, error } = await supabase
        .from('feedback_reports')
        .insert({
            user_id: params.userId ?? null,
            email: params.email ?? null,
            type: params.type,
            title: params.title,
            description: params.description,
            page_url: params.pageUrl,
        })
        .select('id')
        .single();
    if (error) throw error;
    return { id: data.id };
}

export async function updateFeedbackReport(id: string, fields: { github_issue_url?: string }): Promise<void> {
    const { error } = await supabase
        .from('feedback_reports')
        .update(fields)
        .eq('id', id);
    if (error) throw error;
}

export async function assignTeamActionItemById(id: string, userId: string | null): Promise<void> {
    const { error } = await supabase
        .from('team_action_items')
        .update({ assigned_to: userId })
        .eq('id', id);
    if (error) throw error;
}
