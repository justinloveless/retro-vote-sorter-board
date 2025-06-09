import React, { useState, useEffect, useRef } from "react";
import ReactCardFlip from "../ReactCardFlip";
import CardState from "./CardState";
import Tooltip from "./Tooltip";
import { getCardImage } from "./cardImage";
import backCardImage from "@/assets/Card_Back.png";
import { useIsMobile } from "@/hooks/use-mobile";

// Define the possible states of the card

interface PlayingCardProps {
  cardState: CardState;
  playerName: string;
  pointsSelected: number; // For example, 5 for 5 of diamonds, 8 for 8 of spades etc.
  isPresent: boolean;
  totalPlayers?: number; // New prop to determine card size
}

const CARD_WIDTH = 71; // pixels, adjust as needed based on your card image size
const CARD_HEIGHT = 95; // pixels, adjust as needed based on your card image size

// Dynamic scale based on number of players
const getCardScale = (totalPlayers: number, isMobile: boolean) => {
  if (isMobile) {
    if (totalPlayers <= 4) return 1.4;
    if (totalPlayers <= 6) return 1.2;
    if (totalPlayers <= 8) return 1.0;
    return 0.8;
  } else {
    if (totalPlayers <= 4) return 1.6;
    if (totalPlayers <= 6) return 1.4;
    if (totalPlayers <= 8) return 1.2;
    if (totalPlayers <= 12) return 1.0;
    return 0.8;
  }
};

const PlayingCard: React.FC<PlayingCardProps> = ({
  cardState,
  playerName,
  pointsSelected,
  isPresent,
  totalPlayers = 4,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [translateY, setTranslateY] = useState("translate-y-0");
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom'>('top');
  const isMobile = useIsMobile();
  const cardRef = useRef<HTMLDivElement>(null);

  const scale = getCardScale(totalPlayers, isMobile);

  // Determine the front card image based on pointsSelected
  const frontCardImage = getCardImage(pointsSelected);

  useEffect(() => {
    let flipDelay: NodeJS.Timeout | null = null;
    console.log(`Card state changed to: ${cardState}`);
    if (cardState === CardState.Selection) {
      // When going back to Selection, flip first then translate
      setIsFlipped(false);
      flipDelay = setTimeout(() => {
        setTranslateY("translate-y-0");
      }, 300); // Small delay to allow flip animation to start before translation
    } else if (cardState === CardState.Locked) {
      setIsFlipped(false); // Ensure it's not flipped in Locked state
      setTranslateY(`-translate-y-1/4`); 
    } else if (cardState === CardState.Played) {
      // When entering Played state, translate and then flip
      // Reduce translation distance for many players to keep cards visible
      const translateDistance = totalPlayers > 8 ? "-translate-y-1/4" : (isMobile ? "-translate-y-1/4" : `-translate-y-3/4`);
      setTranslateY(translateDistance); 
      flipDelay = setTimeout(() => {
        setIsFlipped(true);
      }, 300); // Small delay to allow translation animation to start before flip
    }

    return () => {
      if (flipDelay) {
        clearTimeout(flipDelay);
      }
    };
  }, [cardState, isMobile, totalPlayers]);

  const handleMouseEnter = () => {
    if (isMobile) return;
    setIsHovered(true);
    
    // Check if there's enough space above the card for the tooltip
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const tooltipHeight = 120; // Approximate tooltip height
      const spaceAbove = rect.top;
      
      // If there's not enough space above, position tooltip below
      setTooltipPosition(spaceAbove < tooltipHeight ? 'bottom' : 'top');
    }
  };

  const handleMouseLeave = () => {
    if (isMobile) return;
    setIsHovered(false);
  };

  return (
    <div
      ref={cardRef}
      className={`relative transition-transform duration-500 ease-in-out ${translateY} ${!isPresent ? 'opacity-50' : ''} z-0 hover:z-10 mb-8 md:mb-0`}
      style={{
        height: `${CARD_HEIGHT * scale}px`,
        width: `${CARD_WIDTH * scale}px`,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isMobile ? (
        <div className="absolute top-full w-full pt-1">
          <div className="flex items-center justify-center">
            <div className="text-center bg-gray-800 text-white text-xs rounded-full px-2 py-1 truncate max-w-full" style={{ backdropFilter: 'blur(2px)' }}>
              {playerName}
            </div>
          </div>
        </div>
      ) : (
        isHovered && (
          <div
            className={`absolute left-1/2 -translate-x-1/2 z-10 ${
              tooltipPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
            }`}
          >
            <Tooltip
              playerName={playerName}
              cardState={cardState}
              pointsSelected={pointsSelected}
              isPointing={cardState !== CardState.Locked}
            />
          </div>
        )
      )}
      <ReactCardFlip
        isFlipped={isFlipped}
        flipDirection="horizontal"
        infinite={true}
      >
        {/* Back of the card (Selection state) */}
        <div className="card-back w-full h-full">
          <img
            src={backCardImage}
            alt="Card Back"
            className="w-full h-full object-contain"
          />
        </div>

        {/* Front of the card (Played state) */}
        <div className="card-front w-full h-full">
          <img
            src={frontCardImage}
            alt={`Card ${pointsSelected} Points`}
            className="w-full h-full object-contain"
          />
        </div>
      </ReactCardFlip>
    </div>
  );
};

export default PlayingCard;
