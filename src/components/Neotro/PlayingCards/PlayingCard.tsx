
import React, { useState, useEffect, useRef } from "react";
import ReactCardFlip from "../ReactCardFlip";
import CardState from "./CardState";
import Tooltip from "./Tooltip";
import { getCardImage } from "./cardImage";
import backCardImage from "@/assets/Card_Back.png";

// Define the possible states of the card

interface PlayingCardProps {
  cardState: CardState;
  playerName: string;
  pointsSelected: number; // For example, 5 for 5 of diamonds, 8 for 8 of spades etc.
  isPresent: boolean;
}

const CARD_WIDTH = 71; // pixels, adjust as needed based on your card image size
const CARD_HEIGHT = 95; // pixels, adjust as needed based on your card image size
const SCALE = 1.6; // Scale factor for the card, adjust as needed

const PlayingCard: React.FC<PlayingCardProps> = ({
  cardState,
  playerName,
  pointsSelected,
  isPresent,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [translateY, setTranslateY] = useState("translate-y-0");
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom'>('top');
  const cardRef = useRef<HTMLDivElement>(null);

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
      setTranslateY(`-translate-y-1/2`); // Half of card height
    } else if (cardState === CardState.Played) {
      // When entering Played state, translate and then flip
      setTranslateY(`-translate-y-full`); // 1.5 times card height
      flipDelay = setTimeout(() => {
        setIsFlipped(true);
      }, 300); // Small delay to allow translation animation to start before flip
    }

    return () => {
      if (flipDelay) {
        clearTimeout(flipDelay);
      }
    };
  }, [cardState]);

  const handleMouseEnter = () => {
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
    setIsHovered(false);
  };

  return (
    <div
      ref={cardRef}
      className={`relative transition-transform duration-500 ease-in-out ${translateY} ${!isPresent ? 'opacity-50' : ''}`}
      style={{
        height: `${CARD_HEIGHT * SCALE}px`,
        width: `${CARD_WIDTH * SCALE}px`,
      }} // Approximate aspect ratio
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* The Tooltip */}
      {isHovered && (
        <div className={`absolute left-1/2 -translate-x-1/2 ${
          tooltipPosition === 'top' 
            ? 'bottom-full mb-2' 
            : 'top-full mt-2'
        }`}>
          <Tooltip
            playerName={playerName}
            cardState={cardState}
            pointsSelected={pointsSelected}
            isPointing={cardState != CardState.Locked}
          />
        </div>
      )}
      <ReactCardFlip
        isFlipped={isFlipped}
        flipDirection="horizontal"
        infinite={true}
      >
        {/* Back of the card (Selection state) */}
        <div className="card-back w-full h-full">
          {/* TODO: Use canvas with image-rendering:pixelated css attribute to get sharp pixel art */}
          <img
            src={backCardImage}
            alt="Card Back"
            className="w-full h-full object-contain"
          />
        </div>

        {/* Front of the card (Played state) */}
        <div className="card-front w-full h-full">
          {/* TODO: Use canvas with image-rendering:pixelated css attribute to get sharp pixel art */}
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
