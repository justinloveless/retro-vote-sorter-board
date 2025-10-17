import { client } from './dataClient';
// import { shouldUseCSharpApi } from '@/config/environment';
import { RetroColumnRecord } from './types';

export async function fetchRetroColumns(boardId: string): Promise<RetroColumnRecord[]> {
    // if (shouldUseCSharpApi()) {
    //     const { apiGetRetroColumns } = await import('@/lib/data/csharpApi/apiClient');
    //     try {
    //         const response = await apiGetRetroColumns(boardId);
    //         return response.items.map(item => ({
    //             id: item.id,
    //             board_id: item.boardId,
    //             title: item.title,
    //             color: item.color,
    //             position: item.position,
    //             sort_order: item.sortOrder,
    //             is_action_items: item.isActionItems,
    //             created_at: item.createdAt
    //         }));
    //     } catch (error) {
    //         console.error('Error fetching retro columns from API:', error);
    //         return [];
    //     }
    // }

    try {
        const { data, error } = await client
            .from('retro_columns')
            .select('*')
            .eq('board_id', boardId)
            .order('position');

        if (error) throw error;
        return (data || []) as RetroColumnRecord[];
    } catch (error) {
        console.error('Error fetching retro columns from Supabase:', error);
        return [];
    }
}

export async function createRetroColumn(boardId: string, title: string, color: string, position: number, isActionItems?: boolean, sortOrder?: number): Promise<RetroColumnRecord> {
    // if (shouldUseCSharpApi()) {
    //     const { apiCreateRetroColumn } = await import('@/lib/data/csharpApi/apiClient');
    //     try {
    //         const item = await apiCreateRetroColumn(boardId, title, color, position, isActionItems, sortOrder);
    //         return {
    //             id: item.id,
    //             board_id: item.boardId,
    //             title: item.title,
    //             color: item.color,
    //             position: item.position,
    //             sort_order: item.sortOrder,
    //             is_action_items: item.isActionItems,
    //             created_at: item.createdAt
    //         };
    //     } catch (error) {
    //         console.error('Error creating retro column from API:', error);
    //         throw error;
    //     }
    // }

    try {
        const { data, error } = await client
            .from('retro_columns')
            .insert([{ board_id: boardId, title, color, position, sort_order: sortOrder, is_action_items: isActionItems }])
            .select()
            .single();

        if (error) throw error;
        return data as RetroColumnRecord;
    } catch (error) {
        console.error('Error creating retro column from Supabase:', error);
        throw error;
    }
}

export async function updateRetroColumn(columnId: string, updates: Partial<RetroColumnRecord>): Promise<void> {
    // if (shouldUseCSharpApi()) {
    //     const { apiUpdateRetroColumn } = await import('@/lib/data/csharpApi/apiClient');
    //     try {
    //         await apiUpdateRetroColumn(columnId, {
    //             title: updates.title,
    //             color: updates.color,
    //             position: updates.position,
    //             sortOrder: updates.sort_order,
    //             isActionItems: updates.is_action_items
    //         });
    //         return;
    //     } catch (error) {
    //         console.error('Error updating retro column from API:', error);
    //         throw error;
    //     }
    // }

    try {
        const { error } = await client
            .from('retro_columns')
            .update(updates)
            .eq('id', columnId);

        if (error) throw error;
    } catch (error) {
        console.error('Error updating retro column from Supabase:', error);
        throw error;
    }
}

export async function deleteRetroColumn(columnId: string): Promise<void> {
    // if (shouldUseCSharpApi()) {
    //     const { apiDeleteRetroColumn } = await import('@/lib/data/csharpApi/apiClient');
    //     try {
    //         await apiDeleteRetroColumn(columnId);
    //         return;
    //     } catch (error) {
    //         console.error('Error deleting retro column from API:', error);
    //         throw error;
    //     }
    // }

    try {
        const { error } = await client
            .from('retro_columns')
            .delete()
            .eq('id', columnId);

        if (error) throw error;
    } catch (error) {
        console.error('Error deleting retro column from Supabase:', error);
        throw error;
    }
}

export async function updateRetroColumnsBatch(updates: Array<{ id: string; position: number; sort_order: number }>): Promise<void> {
    // if (shouldUseCSharpApi()) {
    //     const { apiUpdateRetroColumnsBatch } = await import('@/lib/data/csharpApi/apiClient');
    //     try {
    //         await apiUpdateRetroColumnsBatch(updates.map(update => ({
    //             id: update.id,
    //             position: update.position,
    //             sortOrder: update.sort_order
    //         })));
    //         return;
    //     } catch (error) {
    //         console.error('Error updating retro columns batch from API:', error);
    //         throw error;
    //     }
    // }

    try {
        // Update each column individually since Supabase doesn't support batch updates easily
        for (const update of updates) {
            const { error } = await client
                .from('retro_columns')
                .update({ position: update.position, sort_order: update.sort_order })
                .eq('id', update.id);

            if (error) throw error;
        }
    } catch (error) {
        console.error('Error updating retro columns batch from Supabase:', error);
        throw error;
    }
}
