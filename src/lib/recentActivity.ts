import { supabase } from '@/integrations/supabase/client';

export type RecentActivityEntityType = 'team' | 'board' | 'poker_session';

const RECENT_ACTIVITY_DEDUPE_MS = 30_000;
const recentWriteCache = new Map<string, number>();

export const trackRecentActivity = async (
  userId: string,
  entityType: RecentActivityEntityType,
  entityId: string
) => {
  if (!userId || !entityId) return;

  const cacheKey = `${userId}:${entityType}:${entityId}`;
  const now = Date.now();
  const lastWriteAt = recentWriteCache.get(cacheKey);

  if (lastWriteAt && now - lastWriteAt < RECENT_ACTIVITY_DEDUPE_MS) {
    return;
  }

  recentWriteCache.set(cacheKey, now);

  const { error } = await supabase
    .from('user_recent_activity')
    .upsert(
      {
        user_id: userId,
        entity_type: entityType,
        entity_id: entityId,
        last_accessed_at: new Date(now).toISOString(),
      },
      {
        onConflict: 'user_id,entity_type,entity_id',
      }
    );

  if (error) {
    recentWriteCache.delete(cacheKey);
    throw error;
  }
};
