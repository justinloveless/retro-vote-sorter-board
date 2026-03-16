import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import ReactCardFlip from "../ReactCardFlip";
import CardState from "./CardState";
import { getCardImage } from "./cardImage";
import backCardImage from "@/assets/Card_Back.png";
import { useIsMobile } from "@/hooks/use-mobile";

interface PlayingCardProps {
  cardState: CardState;
  playerName: string;
  pointsSelected: number;
  isPresent: boolean;
  totalPlayers?: number;
  variant?: 'default' | 'stacked';
}

const CARD_WIDTH = 71;
const CARD_HEIGHT = 95;

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
  variant = 'default',
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [showPortalName, setShowPortalName] = useState(false);
  const [portalPosition, setPortalPosition] = useState({ x: 0, y: 0 });
  const [slideIn, setSlideIn] = useState(false);
  const [prevCardState, setPrevCardState] = useState(cardState);
  const isMobile = useIsMobile();
  const cardRef = useRef<HTMLDivElement>(null);
  const playerNameRef = useRef<HTMLDivElement>(null);

  const scale = getCardScale(totalPlayers, isMobile);
  const frontCardImage = getCardImage(pointsSelected);

  // Track state transitions for slide-in animation
  useEffect(() => {
    if (prevCardState === CardState.Selection && cardState === CardState.Locked) {
      // Player just locked in - trigger slide-in animation
      setSlideIn(true);
    }
    setPrevCardState(cardState);
  }, [cardState, prevCardState]);

  useEffect(() => {
    let flipDelay: NodeJS.Timeout | null = null;
    if (cardState === CardState.Selection) {
      setIsFlipped(false);
      setSlideIn(false);
    } else if (cardState === CardState.Locked) {
      setIsFlipped(false);
    } else if (cardState === CardState.Played) {
      if (variant !== 'stacked') {
        // no translate needed
      }
      flipDelay = setTimeout(() => {
        setIsFlipped(true);
      }, 300);
    }

    return () => {
      if (flipDelay) clearTimeout(flipDelay);
    };
  }, [cardState, isMobile, totalPlayers, variant]);

  const isStacked = variant === 'stacked';
  const isEmptySlot = cardState === CardState.Selection;

  return (
    <div
      ref={cardRef}
      className={`relative z-0 hover:z-10 ${!isStacked ? 'mb-8 md:mb-0' : ''}`}
      style={{
        height: `${CARD_HEIGHT * scale}px`,
        width: `${CARD_WIDTH * scale}px`,
      }}
      onMouseEnter={() => {
        if (!isStacked && playerNameRef.current) {
          const rect = playerNameRef.current.getBoundingClientRect();
          setPortalPosition({ 
            x: rect.left + rect.width / 2, 
            y: rect.top + rect.height / 2 
          });
          setShowPortalName(true);
        }
      }}
      onMouseLeave={() => {
        if (!isStacked) setShowPortalName(false);
      }}
    >
      {!isStacked && (
        <>
          <div className="absolute top-full w-full pt-1">
            <div className="flex items-center justify-center">
              <div 
                ref={playerNameRef}
                className={`text-center bg-card/75 text-foreground text-xs rounded-full px-2 py-1 truncate max-w-full relative ${showPortalName ? 'opacity-0' : ''}`}
                style={{ backdropFilter: 'blur(2px)' }}
              >
                {playerName}
              </div>
            </div>
          </div>
          {showPortalName && createPortal(
            <div 
              className="fixed pointer-events-none"
              style={{ 
                left: portalPosition.x,
                top: portalPosition.y,
                transform: 'translate(-50%, -50%)',
                zIndex: 9999
              }}
            >
              <div
                className="text-center bg-card/75 text-foreground text-xs rounded-full px-2 py-1 truncate animate-in fade-in slide-in-from-bottom-3 duration-200 ease-in-out"
                style={{ 
                  backdropFilter: 'blur(2px)',
                  transform: 'translateY(-16px)',
                  transition: 'transform 0.2s ease-in-out'
                }}
              >
                {playerName}
              </div>
            </div>,
            document.body
          )}
        </>
      )}
      
      {isEmptySlot ? (
        /* Empty dashed outline placeholder for unlocked cards */
        <div 
          className={`w-full h-full rounded-lg border-2 border-dashed border-muted-foreground/40 flex items-center justify-center ${!isPresent ? 'opacity-50' : ''}`}
        >
          <div className="text-muted-foreground/40 text-xs font-neotro text-center">?</div>
        </div>
      ) : (
        /* Card with slide-in animation when locking in */
        <div className={`w-full h-full ${slideIn ? 'animate-card-slide-in' : ''} ${!isPresent && cardState !== CardState.Played ? 'opacity-50' : ''}`}>
          <ReactCardFlip
            isFlipped={isFlipped}
            flipDirection="horizontal"
            infinite={true}
          >
            <div className="card-back w-full h-full">
              <img
                src={backCardImage}
                alt="Card Back"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="card-front w-full h-full">
              <img
                src={frontCardImage}
                alt={`Card ${pointsSelected} Points`}
                className="w-full h-full object-contain"
              />
            </div>
          </ReactCardFlip>
        </div>
      )}
    </div>
  );
};

export default PlayingCard;
