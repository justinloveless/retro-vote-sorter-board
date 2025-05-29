
import React from 'react';
import { useParams } from 'react-router-dom';
import { RetroRoom } from '@/components/RetroRoom';

const Retro = () => {
  const { roomId } = useParams<{ roomId: string }>();

  return <RetroRoom roomId={roomId} />;
};

export default Retro;
