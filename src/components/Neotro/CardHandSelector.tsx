import React from "react";
import { getCardImage } from "./PlayingCards/cardImage";
import LockInButton from "./LockInButton";
import AbstainButton from "./AbstainButton";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIsCompactViewport } from "@/hooks/use-compact-viewport";

interface CardHandSelectorProps {
  selectedPoints: number;
  pointOptions: number[];
  onSelectPoints: (points: number) => void;
  onLockIn: () => void;
  isLockedIn: boolean;
  onAbstain: () => void;
  isAbstained: boolean;
  isAbstainedDisabled: boolean;
}

const CardHandSelector: React.FC<CardHandSelectorProps> = ({
  selectedPoints,
  pointOptions,
  onSelectPoints,
  onLockIn,
  isLockedIn,
  onAbstain,
  isAbstained,
  isAbstainedDisabled,
}) => {
  const isMobile = useIsMobile();
  const isCompact = useIsCompactViewport();
  const totalCards = pointOptions.length;
  
  // Fan layout: each card is rotated around the bottom center
  const maxFanAngle = isMobile ? 30 : 40; // total spread in degrees
  const cardWidth = isMobile ? 48 : 64;
  const cardHeight = isMobile ? 64 : 86;
  // Overlap: ~1/3 of each card (negative margin so cards stack)
  const cardSpacing = -Math.round(cardWidth / 3);

  const fan = (
    <div
      className={`relative flex items-end justify-center ${isCompact ? "" : "mb-4"}`}
      style={{ height: cardHeight + 30 }}
    >
      {pointOptions.map((points, index) => {
        const isSelected = selectedPoints === points;
        const isDisabled = isAbstained || isLockedIn;

        const angleStep = totalCards > 1 ? maxFanAngle / (totalCards - 1) : 0;
        const rotation = -maxFanAngle / 2 + angleStep * index;

        return (
          <button
            key={points}
            onClick={() => !isDisabled && onSelectPoints(points)}
            disabled={isDisabled}
            className={`relative transition-all duration-300 ease-out flex-shrink-0 ${
              isDisabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
            }`}
            style={{
              width: cardWidth,
              height: cardHeight,
              marginLeft: index > 0 ? cardSpacing : 0,
              transform: `rotate(${rotation}deg) translateY(${isSelected ? -20 : 0}px)`,
              transformOrigin: "bottom center",
              zIndex: index,
              filter: isSelected ? "drop-shadow(0 0 12px rgba(52, 152, 219, 0.8))" : "none",
            }}
          >
            <img
              src={getCardImage(points)}
              alt={`${points} points`}
              className={`w-full h-full object-contain transition-transform duration-200 ${
                !isDisabled && !isSelected ? "hover:-translate-y-2" : ""
              }`}
              style={{
                imageRendering: "pixelated",
              }}
            />
            {isSelected && (
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-2 py-0.5 whitespace-nowrap">
                {points} pts
              </div>
            )}
          </button>
        );
      })}
    </div>
  );

  const abstainDisabledDesktop = isAbstainedDisabled;
  const abstainDisabledMobile = isAbstainedDisabled || isLockedIn;

  const lockIn = <LockInButton onLockIn={onLockIn} isLockedIn={isLockedIn} isDisabled={isAbstained} />;
  const abstain = (
    <AbstainButton
      onAbstain={onAbstain}
      isAbstained={isAbstained}
      isDisabled={isMobile ? abstainDisabledMobile : abstainDisabledDesktop}
    />
  );

  return (
    <div className="flex flex-col items-center justify-center font-custom">
      {!isMobile && !isCompact && (
        <div className="text-foreground text-3xl font-neotro mb-2">Your Hand</div>
      )}

      {isCompact ? (
        isMobile ? (
          <div className="flex w-full max-w-full flex-col items-center gap-2 px-1">
            <div className="flex w-full justify-center">{fan}</div>
            <div className="flex w-full flex-wrap items-center justify-center gap-2">
              <div className="shrink-0 origin-bottom scale-[0.82] sm:scale-90">{lockIn}</div>
              <div className="shrink-0 origin-bottom scale-[0.82] sm:scale-90">{abstain}</div>
            </div>
          </div>
        ) : (
          <div className="flex w-full max-w-full flex-row items-end justify-center gap-1 px-1 sm:gap-2">
            <div className="shrink-0 origin-bottom scale-[0.82] sm:scale-90">{lockIn}</div>
            <div className="flex min-w-0 flex-1 items-end justify-center">{fan}</div>
            <div className="shrink-0 origin-bottom scale-[0.82] sm:scale-90">{abstain}</div>
          </div>
        )
      ) : (
        <>
          {fan}
          {isMobile ? (
            <div className="flex gap-3 justify-center w-full">
              {lockIn}
              {abstain}
            </div>
          ) : (
            <div className="flex items-center gap-4">
              {lockIn}
              {abstain}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CardHandSelector;
