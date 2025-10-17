import { client } from './dataClient';
import { shouldUseCSharpApi } from '@/config/environment';
import { RetroBoardConfigRecord } from './types';

export async function fetchRetroBoardConfig(boardId: string): Promise<RetroBoardConfigRecord | null> {
    // if (shouldUseCSharpApi()) {
    //     const { apiGetRetroBoardConfig } = await import('@/lib/data/csharpApi/apiClient');
    //     try {
    //         const response = await apiGetRetroBoardConfig(boardId);
    //         return {
    //             id: response.config.id,
    //             board_id: response.config.boardId,
    //             allow_anonymous: response.config.allowAnonymous,
    //             voting_enabled: response.config.votingEnabled,
    //             max_votes_per_user: response.config.maxVotesPerUser,
    //             show_author_names: response.config.showAuthorNames,
    //             retro_stages_enabled: response.config.retroStagesEnabled,
    //             enforce_stage_readiness: response.config.enforceStageReadiness,
    //             allow_self_votes: response.config.allowSelfVotes,
    //             vote_emoji: response.config.voteEmoji,
    //             created_at: response.config.createdAt,
    //             updated_at: response.config.updatedAt
    //         };
    //     } catch (error) {
    //         console.error('Error fetching retro board config from API:', error);
    //         return null;
    //     }
    // }

    try {
        const { data, error } = await client
            .from('retro_board_config')
            .select('*')
            .eq('board_id', boardId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null; // Config doesn't exist yet
            }
            throw error;
        }

        return data as RetroBoardConfigRecord;
    } catch (error) {
        console.error('Error fetching retro board config from Supabase:', error);
        return null;
    }
}

export async function createRetroBoardConfig(boardId: string, config: Partial<RetroBoardConfigRecord>): Promise<RetroBoardConfigRecord> {
    // if (shouldUseCSharpApi()) {
    //     const { apiCreateRetroBoardConfig } = await import('@/lib/data/csharpApi/apiClient');
    //     try {
    //         const item = await apiCreateRetroBoardConfig(boardId, {
    //             allowAnonymous: config.allow_anonymous,
    //             votingEnabled: config.voting_enabled,
    //             maxVotesPerUser: config.max_votes_per_user,
    //             showAuthorNames: config.show_author_names,
    //             retroStagesEnabled: config.retro_stages_enabled,
    //             enforceStageReadiness: config.enforce_stage_readiness,
    //             allowSelfVotes: config.allow_self_votes,
    //             voteEmoji: config.vote_emoji
    //         });
    //         return {
    //             id: item.id,
    //             board_id: item.boardId,
    //             allow_anonymous: item.allowAnonymous,
    //             voting_enabled: item.votingEnabled,
    //             max_votes_per_user: item.maxVotesPerUser,
    //             show_author_names: item.showAuthorNames,
    //             retro_stages_enabled: item.retroStagesEnabled,
    //             enforce_stage_readiness: item.enforceStageReadiness,
    //             allow_self_votes: item.allowSelfVotes,
    //             vote_emoji: item.voteEmoji,
    //             created_at: item.createdAt,
    //             updated_at: item.updatedAt
    //         };
    //     } catch (error) {
    //         console.error('Error creating retro board config from API:', error);
    //         throw error;
    //     }
    // }

    try {
        const { data, error } = await client
            .from('retro_board_config')
            .insert([{ board_id: boardId, ...config }])
            .select()
            .single();

        if (error) throw error;
        return data as RetroBoardConfigRecord;
    } catch (error) {
        console.error('Error creating retro board config from Supabase:', error);
        throw error;
    }
}

export async function updateRetroBoardConfig(boardId: string, updates: Partial<RetroBoardConfigRecord>): Promise<void> {
    // if (shouldUseCSharpApi()) {
    //     const { apiUpdateRetroBoardConfig } = await import('@/lib/data/csharpApi/apiClient');
    //     try {
    //         await apiUpdateRetroBoardConfig(boardId, {
    //             allowAnonymous: updates.allow_anonymous,
    //             votingEnabled: updates.voting_enabled,
    //             maxVotesPerUser: updates.max_votes_per_user,
    //             showAuthorNames: updates.show_author_names,
    //             retroStagesEnabled: updates.retro_stages_enabled,
    //             enforceStageReadiness: updates.enforce_stage_readiness,
    //             allowSelfVotes: updates.allow_self_votes,
    //             voteEmoji: updates.vote_emoji
    //         });
    //         return;
    //     } catch (error) {
    //         console.error('Error updating retro board config from API:', error);
    //         throw error;
    //     }
    // }

    try {
        const { error } = await client
            .from('retro_board_config')
            .update(updates)
            .eq('board_id', boardId);

        if (error) throw error;
    } catch (error) {
        console.error('Error updating retro board config from Supabase:', error);
        throw error;
    }
}
