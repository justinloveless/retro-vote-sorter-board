import React from 'react';
import { getCardImage } from './cardImage';

interface BetweenCardProps {
  lowPoints: number;
  highPoints: number;
  className?: string;
}

/** Diagonal split bottom-left → top-right; low value top-left, high value bottom-right. */
const BetweenCard: React.FC<BetweenCardProps> = ({ lowPoints, highPoints, className = '' }) => {
  const lowSrc = getCardImage(lowPoints);
  const highSrc = getCardImage(highPoints);
  return (
    <div className={`relative h-full w-full ${className}`}>
      <img
        src={lowSrc}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        style={{
          clipPath: 'polygon(0 0, 100% 0, 0 100%)',
          imageRendering: 'pixelated',
        }}
      />
      <img
        src={highSrc}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        style={{
          clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
};

export default BetweenCard;
