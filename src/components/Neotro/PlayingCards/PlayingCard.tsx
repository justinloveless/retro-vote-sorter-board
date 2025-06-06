import React, { useState, useEffect } from "react";
import ReactCardFlip from "../ReactCardFlip";
import CardState from "./CardState";
import Tooltip from "./Tooltip";
import { getCardImage } from "./cardImage";
import backCardImage from "@/assets/card_back.png";

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

  return (
    <div
      className={`relative transition-transform duration-500 ease-in-out ${translateY} ${!isPresent ? 'opacity-50' : ''}`}
      style={{
        height: `${CARD_HEIGHT * SCALE}px`,
        width: `${CARD_WIDTH * SCALE}px`,
      }} // Approximate aspect ratio
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* The Tooltip */}
      {isHovered && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2">
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
