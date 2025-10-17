import { client } from './dataClient';
// import { shouldUseCSharpApi } from '@/config/environment';

export async function fetchCommentsForItems(itemIds: string[]): Promise<any[]> {
    if (itemIds.length === 0) return [];

    // if (shouldUseCSharpApi()) {
    //     const { apiGetCommentsByItemIds } = await import('@/lib/data/csharpApi/apiClient');
    //     const response = await apiGetCommentsByItemIds(itemIds);
    //     return response.items.map(item => ({
    //         id: item.id,
    //         item_id: item.itemId,
    //         text: item.text,
    //         author: item.author,
    //         author_id: item.authorId,
    //         session_id: item.sessionId,
    //         created_at: item.createdAt,
    //         profiles: item.profile ? {
    //             avatar_url: item.profile.avatarUrl,
    //             full_name: item.profile.fullName
    //         } : null
    //     }));
    // }

    const { data, error } = await client
        .from('retro_comments')
        .select('*, profiles(avatar_url, full_name)')
        .in('item_id', itemIds)
        .order('created_at');
    if (error) throw error;
    return data || [];
}

export async function fetchCommentsForItem(itemId: string): Promise<any[]> {
    // if (shouldUseCSharpApi()) {
    //     const { apiGetCommentsByItemId } = await import('@/lib/data/csharpApi/apiClient');
    //     const response = await apiGetCommentsByItemId(itemId);
    //     return response.items.map(item => ({
    //         id: item.id,
    //         item_id: item.itemId,
    //         text: item.text,
    //         author: item.author,
    //         author_id: item.authorId,
    //         session_id: item.sessionId,
    //         created_at: item.createdAt,
    //         profiles: item.profile ? {
    //             avatar_url: item.profile.avatarUrl,
    //             full_name: item.profile.fullName
    //         } : null
    //     }));
    // }

    const { data, error } = await client
        .from('retro_comments')
        .select('*, profiles(avatar_url, full_name)')
        .eq('item_id', itemId)
        .order('created_at');
    if (error) throw error;
    return data || [];
}

export async function addRetroComment(params: { itemId: string; text: string; author: string; authorId?: string | null; sessionId?: string | null }): Promise<any> {
    // if (shouldUseCSharpApi()) {
    //     const { apiCreateComment } = await import('@/lib/data/csharpApi/apiClient');
    //     const item = await apiCreateComment(params.itemId, params.text, params.author, params.authorId, params.sessionId);
    //     return {
    //         id: item.id,
    //         item_id: item.itemId,
    //         text: item.text,
    //         author: item.author,
    //         author_id: item.authorId,
    //         session_id: item.sessionId,
    //         created_at: item.createdAt,
    //         profiles: item.profile ? {
    //             avatar_url: item.profile.avatarUrl,
    //             full_name: item.profile.fullName
    //         } : null
    //     };
    // }

    const { data, error } = await client
        .from('retro_comments')
        .insert([{ item_id: params.itemId, text: params.text, author: params.author, author_id: params.authorId || null, session_id: params.sessionId || null }])
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteRetroComment(commentId: string): Promise<void> {
    // if (shouldUseCSharpApi()) {
    //     const { apiDeleteComment } = await import('@/lib/data/csharpApi/apiClient');
    //     await apiDeleteComment(commentId);
    //     return;
    // }

    const { error } = await client
        .from('retro_comments')
        .delete()
        .eq('id', commentId);
    if (error) throw error;
}
