import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { RetroRoom } from '@/components/RetroRoom';
import { useBackground } from '@/contexts/BackgroundContext';

const Retro = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { setOverlayVisible } = useBackground();

  useEffect(() => {
    setOverlayVisible(true);
    return () => setOverlayVisible(false);
  }, [setOverlayVisible]);

  return <RetroRoom roomId={roomId} />;
};

export default Retro;
