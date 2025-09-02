import { useAudioPlayerContext } from '../context/AudioPlayerContext.tsx';

export const useAudioPlayer = () => {
  return useAudioPlayerContext();
}; 