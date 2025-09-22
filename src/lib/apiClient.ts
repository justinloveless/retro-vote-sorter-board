import { supabase } from '@/integrations/supabase/client';
import { getApiBaseUrl } from '@/config/environment';

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
  const base = getApiBaseUrl();
  const token = await getSupabaseAccessToken();
  const res = await fetch(`${base}/api/notifications?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function apiGetTeamMembers(teamId: string): Promise<{ items: Array<any> }> {
  const base = getApiBaseUrl();
  const token = await getSupabaseAccessToken();
  const res = await fetch(`${base}/api/teams/${teamId}/members`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function apiAdminSendNotification(payload: { 
  recipients: Array<{ userId?: string; email?: string }>; 
  type: string; 
  title: string; 
  message?: string; 
  url?: string; 
}): Promise<{ success: boolean; count?: number; info?: string }> {
  const base = getApiBaseUrl();
  const token = await getSupabaseAccessToken();
  const res = await fetch(`${base}/api/admin/notifications`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function apiMarkNotificationRead(notificationId: string): Promise<{ success: boolean; message: string }> {
  const base = getApiBaseUrl();
  const token = await getSupabaseAccessToken();
  const res = await fetch(`${base}/api/notifications/${notificationId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_read: true })
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function apiMarkAllNotificationsRead(): Promise<{ success: boolean; updated_count: number; message: string }> {
  const base = getApiBaseUrl();
  const token = await getSupabaseAccessToken();
  const res = await fetch(`${base}/api/notifications/mark-all-read`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_read: true })
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}
