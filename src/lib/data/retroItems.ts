import { supabase } from '@/integrations/supabase/client';
import { shouldUseCSharpApi } from '@/config/environment';
import { RetroItemRecord } from './types';

export async function fetchRetroItems(boardId: string): Promise<RetroItemRecord[]> {
    if (shouldUseCSharpApi()) {
        const { apiGetRetroItems } = await import('@/lib/data/csharpApi/apiClient');
        try {
            const response = await apiGetRetroItems(boardId);
            return response.items.map(item => ({
                id: item.id,
                board_id: item.boardId,
                column_id: item.columnId,
                text: item.text,
                author: item.author,
                author_id: item.authorId,
                votes: item.votes,
                session_id: item.sessionId,
                created_at: item.createdAt,
                updated_at: item.updatedAt
            }));
        } catch (error) {
            console.error('Error fetching retro items from API:', error);
            return [];
        }
    }

    try {
        const { data, error } = await supabase
            .from('retro_items')
            .select('*, profiles(avatar_url, full_name)')
            .eq('board_id', boardId)
            .order('votes', { ascending: false });

        if (error) throw error;
        return (data || []) as RetroItemRecord[];
    } catch (error) {
        console.error('Error fetching retro items from Supabase:', error);
        return [];
    }
}

export async function createRetroItem(boardId: string, columnId: string, text: string, author: string, authorId?: string, sessionId?: string): Promise<RetroItemRecord> {
    if (shouldUseCSharpApi()) {
        const { apiCreateRetroItem } = await import('@/lib/data/csharpApi/apiClient');
        try {
            const item = await apiCreateRetroItem(boardId, columnId, text, author, authorId, sessionId);
            return {
                id: item.id,
                board_id: item.boardId,
                column_id: item.columnId,
                text: item.text,
                author: item.author,
                author_id: item.authorId,
                votes: item.votes,
                session_id: item.sessionId,
                created_at: item.createdAt,
                updated_at: item.updatedAt
            };
        } catch (error) {
            console.error('Error creating retro item from API:', error);
            throw error;
        }
    }

    try {
        const { data, error } = await supabase
            .from('retro_items')
            .insert([{ board_id: boardId, column_id: columnId, text, author, author_id: authorId, session_id: sessionId }])
            .select()
            .single();

        if (error) throw error;
        return data as RetroItemRecord;
    } catch (error) {
        console.error('Error creating retro item from Supabase:', error);
        throw error;
    }
}

export async function updateRetroItem(itemId: string, updates: { column_id?: string; text?: string }): Promise<void> {
    if (shouldUseCSharpApi()) {
        const { apiUpdateRetroItem } = await import('@/lib/data/csharpApi/apiClient');
        try {
            await apiUpdateRetroItem(itemId, {
                columnId: updates.column_id,
                text: updates.text
            });
            return;
        } catch (error) {
            console.error('Error updating retro item from API:', error);
            throw error;
        }
    }

    try {
        const { error } = await supabase
            .from('retro_items')
            .update(updates)
            .eq('id', itemId);

        if (error) throw error;
    } catch (error) {
        console.error('Error updating retro item from Supabase:', error);
        throw error;
    }
}

export async function deleteRetroItem(itemId: string): Promise<void> {
    if (shouldUseCSharpApi()) {
        const { apiDeleteRetroItem } = await import('@/lib/data/csharpApi/apiClient');
        try {
            await apiDeleteRetroItem(itemId);
            return;
        } catch (error) {
            console.error('Error deleting retro item from API:', error);
            throw error;
        }
    }

    try {
        const { error } = await supabase
            .from('retro_items')
            .delete()
            .eq('id', itemId);

        if (error) throw error;
    } catch (error) {
        console.error('Error deleting retro item from Supabase:', error);
        throw error;
    }
}

export async function getUserVotes(boardId: string, userId?: string | null, sessionId?: string): Promise<string[]> {
    // Direct Supabase for now
    const query = supabase.from('retro_votes').select('item_id').eq('board_id', boardId);
    if (userId) {
        query.eq('user_id', userId);
    } else if (sessionId) {
        query.eq('session_id', sessionId);
    }
    const { data, error } = await query as any;
    if (error) throw error;
    return (data || []).map((v: any) => v.item_id);
}

export async function addVote(params: { boardId: string; itemId: string; userId?: string | null; sessionId?: string }): Promise<void> {
    const { error } = await supabase.from('retro_votes').insert({
        item_id: params.itemId,
        board_id: params.boardId,
        user_id: params.userId,
        session_id: params.sessionId,
    });
    if (error) throw error;
}

export async function removeVote(params: { boardId: string; itemId: string; userId?: string | null; sessionId?: string }): Promise<void> {
    const { error } = await supabase
        .from('retro_votes')
        .delete()
        .match({ item_id: params.itemId, board_id: params.boardId, user_id: params.userId, session_id: params.sessionId });
    if (error) throw error;
}
