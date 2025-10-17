import { currentEnvironment } from '@/config/environment';
import { client } from './dataClient';

// Storage and File Upload Functions

export async function getImpersonatedEmailIfAdmin(targetUserId: string): Promise<string | null> {
    const { data, error } = await client.rpc('get_user_email_if_admin', { target_user: targetUserId });
    if (error) return null;
    return (data as any) || null;
}

export async function adminSetAvatar(userId: string, blob: Blob): Promise<string> {
    const arrayBuffer = await blob.arrayBuffer();
    const { data: { session } } = await client.auth.getSession();
    const resp = await fetch(`${currentEnvironment.supabaseUrl}/functions/v1/admin-set-avatar?user_id=${userId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'image/png',
            'Authorization': `Bearer ${session?.access_token ?? ''}`
        },
        body: arrayBuffer
    });
    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(err || 'Failed to set avatar as admin');
    }
    const json = await resp.json();
    return json.publicUrl || json.PublicUrl || '';
}

export async function uploadAvatarForUser(userId: string, blob: Blob): Promise<string> {
    // if (shouldUseCSharpApi()) {
    //     const base = getApiBaseUrl();
    //     const { data: { session } } = await supabase.auth.getSession();
    //     const form = new FormData();
    //     form.append('file', blob, `${userId}.png`);
    //     const resp = await fetch(`${base}/api/avatars/${userId}`, {
    //         method: 'POST',
    //         headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
    //         body: form
    //     });
    //     if (!resp.ok) throw new Error(`Upload failed ${resp.status}`);
    //     const json = await resp.json();
    //     return json.publicUrl || json.PublicUrl || '';
    // }
    const fileName = `${userId}.png`;
    await client.storage.from('avatars').upload(fileName, blob, { upsert: true, contentType: 'image/png' });
    const { data } = client.storage.from('avatars').getPublicUrl(fileName);
    return data.publicUrl;
}

// Retro Timer Audio Storage

export function getRetroAudioPublicUrl(fileName: string): string {
    return client.storage.from('retro-audio').getPublicUrl(fileName).data.publicUrl;
}

export async function uploadRetroAudio(userId: string, file: File): Promise<{ fileName: string; publicUrl: string }> {
    const fileExt = file.name.split('.').pop();
    const fileName = `retro-music-${userId}-${Date.now()}.${fileExt}`;
    const { error: uploadError } = await client.storage.from('retro-audio').upload(fileName, file);
    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = client.storage.from('retro-audio').getPublicUrl(fileName);
    if (!publicUrl) throw new Error('Failed to get public URL');
    return { fileName, publicUrl };
}

export async function deleteRetroAudio(fileName: string): Promise<void> {
    const { error } = await client.storage.from('retro-audio').remove([fileName]);
    if (error) throw error;
}
