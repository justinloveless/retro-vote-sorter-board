import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { RetroRoom } from '@/components/RetroRoom';
import { useBackground } from '@/contexts/BackgroundContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { trackRecentActivity } from '@/lib/recentActivity';

const Retro = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { setOverlayVisible } = useBackground();
  const { profile } = useAuth();

  useEffect(() => {
    setOverlayVisible(true);
    return () => setOverlayVisible(false);
  }, [setOverlayVisible]);

  useEffect(() => {
    const trackBoardActivity = async () => {
      if (!profile?.id || !roomId) return;
      let attempts = 0;
      while (attempts < 6) {
        const { data, error } = await supabase
          .from('retro_boards')
          .select('id')
          .eq('room_id', roomId)
          .maybeSingle();

        if (error) return;
        if (data?.id) {
          await trackRecentActivity(profile.id, 'board', data.id);
          return;
        }

        attempts += 1;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    };

    trackBoardActivity().catch((error) => {
      console.error('Failed to track recent board activity:', error);
    });
  }, [profile?.id, roomId]);

  return <RetroRoom roomId={roomId} />;
};

export default Retro;
