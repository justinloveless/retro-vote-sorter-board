import { supabase } from '@/integrations/supabase/client';

/**
 * Gets the current Supabase access token from the session
 * @returns Promise<string> - The access token
 * @throws Error if no valid session is found
 */
async function getSupabaseAccessToken(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    throw new Error(`Failed to get session: ${error.message}`);
  }
  
  if (!session?.access_token) {
    throw new Error('No valid session found');
  }
  
  return session.access_token;
}

/**
 * API client for calling the C# passthrough API
 */

export async function apiGetNotifications(limit = 50): Promise<{ items: Array<any> }> {
  const base = import.meta.env.VITE_API_BASE_URL;
  const token = await getSupabaseAccessToken();
  const res = await fetch(`${base}/api/notifications?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function apiGetTeamMembers(teamId: string): Promise<{ items: Array<any> }> {
  const base = import.meta.env.VITE_API_BASE_URL;
  const token = await getSupabaseAccessToken();
  const res = await fetch(`${base}/api/teams/${teamId}/members`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function apiAdminSendNotification(payload: { title: string; body: string; targetUserIds: string[] }): Promise<{ status: string }> {
  const base = import.meta.env.VITE_API_BASE_URL;
  const token = await getSupabaseAccessToken();
  const res = await fetch(`${base}/api/admin/notifications`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}
