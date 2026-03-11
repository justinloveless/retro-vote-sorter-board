import React, { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Endorsement } from '@/hooks/useEndorsements';
import { EndorsementType } from '@/hooks/useEndorsementTypes';

interface EndorsementCelebrationProps {
  pendingCelebration: Endorsement | null;
  endorsementTypes: EndorsementType[];
  memberNames: Record<string, string>;
  onClear: () => void;
}

const CELEBRATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3';

export const EndorsementCelebration: React.FC<EndorsementCelebrationProps> = ({
  pendingCelebration,
  endorsementTypes,
  memberNames,
  onClear,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!pendingCelebration) return;

    // Fire confetti
    const duration = 2000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();

    // Play sound
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(CELEBRATION_SOUND_URL);
        audioRef.current.volume = 0.4;
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch {}

    const type = endorsementTypes.find(t => t.id === pendingCelebration.endorsement_type_id);
    const fromName = memberNames[pendingCelebration.from_user_id] || 'Someone';

    // Auto-clear after showing
    const timeout = setTimeout(onClear, 4000);
    return () => clearTimeout(timeout);
  }, [pendingCelebration, endorsementTypes, memberNames, onClear]);

  if (!pendingCelebration) return null;

  const type = endorsementTypes.find(t => t.id === pendingCelebration.endorsement_type_id);
  const fromName = memberNames[pendingCelebration.from_user_id] || 'Someone';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="bg-background/95 backdrop-blur-sm border-2 border-primary rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-300 pointer-events-auto max-w-sm text-center">
        <div className="text-5xl mb-3">{type?.icon_url || '🏆'}</div>
        <h3 className="text-xl font-bold text-foreground mb-1">You got endorsed!</h3>
        <p className="text-muted-foreground">
          <span className="font-semibold text-foreground">{fromName}</span> endorsed you as
        </p>
        <p className="text-lg font-bold text-primary mt-1">{type?.name || 'Unknown'}</p>
        <button
          onClick={onClear}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};
