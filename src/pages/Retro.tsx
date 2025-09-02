import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { RetroRoom } from '../components/RetroRoom.tsx';
import { useBackground } from '../contexts/BackgroundContext.tsx';

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
