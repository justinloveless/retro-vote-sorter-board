import { supabase } from '@/integrations/supabase/client';
import { shouldUseCSharpApi } from '@/config/environment';
import { RetroBoardRecord } from './types';
import { createRetroBoardConfig } from './retroBoardConfig';

export async function fetchRetroBoardSummary(roomId: string): Promise<{ board: any; team?: { id: string; name: string; members: Array<{ userId: string; role: string }> } }> {
    if (shouldUseCSharpApi()) {
        const { apiGetRetroBoardSummary } = await import('@/lib/data/csharpApi/apiClient');
        return apiGetRetroBoardSummary(roomId);
    }
    const { data, error } = await supabase
        .from('retro_boards')
        .select(`
      *,
      teams(
        id,
        name,
        team_members(user_id, role)
      )
    `)
        .eq('room_id', roomId)
        .single();
    if (error && (error as any).code !== 'PGRST116') throw error;
    return { board: data } as any;
}

export async function createRetroBoardWithDefaults(params: { roomId: string; title: string; creatorId?: string | null }): Promise<any> {
    // Direct Supabase path only (no C# API implementation yet)
    const { data: newBoard, error: boardError } = await supabase
        .from('retro_boards')
        .insert([{ room_id: params.roomId, title: params.title, creator_id: params.creatorId || null, is_private: false }])
        .select()
        .single();
    if (boardError) throw boardError;

    // Create config using dataClient function
    try {
        await createRetroBoardConfig(newBoard.id, {
            allow_anonymous: true,
            voting_enabled: true,
            max_votes_per_user: 3,
            show_author_names: true,
            retro_stages_enabled: false,
            enforce_stage_readiness: false,
            allow_self_votes: true,
            vote_emoji: '👍'
        });
    } catch (configError) {
        // non-fatal, log and continue
        console.error('Error creating board config:', configError);
    }

    const { data: board, error } = await supabase
        .from('retro_boards')
        .select(`
      *,
      teams(
        id,
        name,
        team_members(user_id, role)
      )
    `)
        .eq('room_id', params.roomId)
        .single();
    if (error) throw error;
    return board;
}

export async function updateRetroBoardPrivacyByRoom(roomId: string, payload: { is_private: boolean; password_hash: string | null }): Promise<void> {
    const { error } = await supabase
        .from('retro_boards')
        .update(payload)
        .eq('room_id', roomId);
    if (error) throw error;
}

export async function fetchRetroBoards(teamId: string, includeDeleted: boolean = false): Promise<RetroBoardRecord[]> {
    if (shouldUseCSharpApi()) {
        const { apiGetRetroBoards } = await import('@/lib/data/csharpApi/apiClient');
        const response = await apiGetRetroBoards(teamId, includeDeleted);
        return (response.items || []).map(item => ({
            id: item.id,
            room_id: item.roomId,
            title: item.title,
            is_private: item.isPrivate,
            password_hash: item.passwordHash,
            archived: item.archived,
            archived_at: item.archivedAt,
            archived_by: item.archivedBy,
            deleted: item.deleted,
            team_id: item.teamId,
            retro_stage: item.retroStage,
            creator_id: item.creatorId,
            created_at: item.createdAt,
            updated_at: item.updatedAt,
        }));
    }

    const query = supabase
        .from('retro_boards')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

    if (!includeDeleted) {
        query.neq('deleted', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as RetroBoardRecord[];
}

export async function fetchRetroBoardTitles(boardIds: string[]): Promise<Array<{ id: string; title: string }>> {
    if (shouldUseCSharpApi()) {
        const { apiGetRetroBoardTitlesByIds } = await import('@/lib/data/csharpApi/apiClient');
        const response = await apiGetRetroBoardTitlesByIds(boardIds);
        return response.items || [];
    }

    if (boardIds.length === 0) return [];

    const { data, error } = await supabase
        .from('retro_boards')
        .select('id, title')
        .in('id', boardIds);

    if (error) throw error;
    return data || [];
}

export async function createRetroBoard(params: {
    roomId: string;
    title: string;
    isPrivate?: boolean;
    passwordHash?: string | null;
    teamId?: string | null;
}): Promise<RetroBoardRecord> {
    if (shouldUseCSharpApi()) {
        const { apiCreateRetroBoard } = await import('@/lib/data/csharpApi/apiClient');
        const board = await apiCreateRetroBoard(
            params.roomId,
            params.title,
            params.isPrivate ?? false,
            params.passwordHash ?? null,
            params.teamId ?? null
        );
        return {
            id: board.id,
            room_id: board.roomId,
            title: board.title,
            is_private: board.isPrivate,
            password_hash: board.passwordHash,
            archived: board.archived,
            archived_at: board.archivedAt,
            archived_by: board.archivedBy,
            deleted: board.deleted,
            team_id: board.teamId,
            retro_stage: board.retroStage,
            creator_id: board.creatorId,
            created_at: board.createdAt,
            updated_at: board.updatedAt,
        };
    }

    const { data, error } = await supabase
        .from('retro_boards')
        .insert([{
            room_id: params.roomId,
            title: params.title,
            is_private: params.isPrivate ?? false,
            password_hash: params.passwordHash ?? null,
            team_id: params.teamId ?? null,
        }])
        .select()
        .single();

    if (error) throw error;
    return data as RetroBoardRecord;
}

export async function updateRetroBoard(boardId: string, updates: {
    title?: string;
    is_private?: boolean;
    password_hash?: string | null;
    archived?: boolean;
    archived_at?: string | null;
    archived_by?: string | null;
    deleted?: boolean;
    retro_stage?: string | null;
}): Promise<void> {
    if (shouldUseCSharpApi()) {
        const { apiUpdateRetroBoard } = await import('@/lib/data/csharpApi/apiClient');
        await apiUpdateRetroBoard(boardId, {
            title: updates.title,
            isPrivate: updates.is_private,
            passwordHash: updates.password_hash,
            archived: updates.archived,
            archivedAt: updates.archived_at,
            archivedBy: updates.archived_by,
            deleted: updates.deleted,
            retroStage: updates.retro_stage,
        });
        return;
    }

    const { error } = await supabase
        .from('retro_boards')
        .update(updates)
        .eq('id', boardId);

    if (error) throw error;
}

export async function deleteRetroBoard(boardId: string): Promise<void> {
    if (shouldUseCSharpApi()) {
        const { apiDeleteRetroBoard } = await import('@/lib/data/csharpApi/apiClient');
        await apiDeleteRetroBoard(boardId);
        return;
    }

    const { error } = await supabase
        .from('retro_boards')
        .delete()
        .eq('id', boardId);

    if (error) throw error;
}
