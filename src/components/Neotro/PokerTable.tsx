import React, { useState, useEffect } from "react";
import PointSelector from "@/components/Neotro/PointSelector";
import PlayingCard from "@/components/Neotro/PlayingCards/PlayingCard";
import PlayHandButton from "@/components/Neotro/PlayHandButton";
import CardState from "@/components/Neotro/PlayingCards/CardState";
import GameState from "../GameState";
import PointsDetails from "@/components/Neotro/PointDetails";
import NextRoundButton from "@/components/Neotro/NextRoundButton";
import "@/components/Neotro/neotro.css";
/* CSS for Neotro */

interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  profiles?: {
    full_name: string | null;
  } | null;
}

interface NeotroProps {
  teamMembers: TeamMember[];
  activeUserId: string | undefined;
}

const Neotro: React.FC<NeotroProps> = ({ teamMembers, activeUserId }) => {
  const pointOptions = [1, 2, 3, 5, 8, 13, 21];

  const [currentIndex, setCurrentIndex] = useState(3); // Start at index 3 for value 5
  const [currentSelectorIndex, setCurrentSelectorIndex] =
    useState(currentIndex);
  const [pointsSelected, setPointsSelected] = useState(pointOptions[3]);
  const [cardStateActivePlayer, setCardStateActivePlayer] = useState(
    CardState.Selection,
  );
  const [pointsSelectedOtherPlayers, setPointsSelectedOtherPlayers] = useState(
    pointOptions[3],
  );
  const [cardStateOtherPlayers, setCardStateOtherPlayers] = useState(
    CardState.Selection,
  );
  const [lockedInSelection, setLockedInSelection] = useState(false);
  const [abstainSelection, setAbstainSelection] = useState(false);
  const [isHandPlayed, setIsHandPlayed] = useState(false);
  const [gameState, setGameState] = useState(GameState.Selection);

  const shakeRef = React.useRef<HTMLDivElement>(null);

  const handleDecrement = () => {
    if (!lockedInSelection) {
      setCurrentIndex((prevIndex) => {
        const newIndex = Math.max(0, prevIndex - 1);
        return newIndex;
      });
    }
  };

  const handleIncrement = () => {
    const container = shakeRef.current;
    if (container) {
      // Reset the animation
      container.style.animation = "none";
      // Use requestAnimationFrame to ensure the reset is processed before reapplying
      requestAnimationFrame(() => {
        setTimeout(() => {
          switch (pointsSelected) {
            case 21:
              container.style.animation = "shake 0.5s";
              break;
            case 13:
              container.style.animation = "shake  0.5s";
            default:
              container.style.animation = "";
          }
        }, 0);
      });
    }

    if (!lockedInSelection) {
      setCurrentIndex((prevIndex) => {
        const newIndex = Math.min(pointOptions.length - 1, prevIndex + 1);
        return newIndex;
      });
    }
  };

  const handleLockIn = () => {
    setLockedInSelection(!lockedInSelection);
    setCardStateActivePlayer(
      lockedInSelection ? CardState.Selection : CardState.Locked,
    );
  };

  const handleAbstain = () => {
    setAbstainSelection(!abstainSelection);
    setPointsSelected(-1);
    setCardStateActivePlayer(
      abstainSelection ? CardState.Selection : CardState.Locked,
    );
  };

  const handlePlayHand = () => {
    setIsHandPlayed(!isHandPlayed);
    setCardStateActivePlayer(CardState.Played);
    setCardStateOtherPlayers(CardState.Played);
    setGameState(GameState.Playing);
  };

  const handleNextRound = () => {
    setIsHandPlayed(!isHandPlayed);
    setAbstainSelection(false);
    setLockedInSelection(false);
    setPointsSelected(pointOptions[3]);
    setCurrentSelectorIndex(3);
    setCurrentIndex(3);
    setCardStateActivePlayer(CardState.Selection);
    setCardStateOtherPlayers(CardState.Selection);
    setGameState(GameState.Selection);
  };

  useEffect(() => {
    setPointsSelected(pointOptions[currentIndex]);
    setCurrentSelectorIndex(currentIndex);
  }, [currentIndex]);

  console.log("lockedInSelection: ", lockedInSelection);
  console.log("cardState: ", cardStateActivePlayer);

  return (
    <div ref={shakeRef} className="poker-table relative flex flex-col h-full w-full">
      <div className="flex flex-1">
        <div className="w-1/4 p-4">
          <div>
            <div className="bg-[#2d2d2d] h-full border-l-10 border-r-10 border-[#025b95ff] p-4">
              <PointsDetails
                selectedPoint={pointsSelected}
                isHandPlayed={isHandPlayed}
              />
              <div className="p-2 flex justify-between">
                <PlayHandButton
                  onHandPlayed={handlePlayHand}
                  isHandPlayed={isHandPlayed}
                />
                <NextRoundButton
                  onHandPlayed={handleNextRound}
                  isHandPlayed={isHandPlayed}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="w-3/4 flex flex-col p-4">
          <div className="flex-grow flex items-center justify-center">
            <div className="grid grid-cols-4 gap-4">
              {teamMembers.map((member) => (
                <PlayingCard
                  key={member.user_id}
                  cardState={member.user_id === activeUserId ? cardStateActivePlayer : cardStateOtherPlayers}
                  playerName={member.profiles?.full_name || 'Anonymous'}
                  pointsSelected={member.user_id === activeUserId ? pointsSelected : 1}
                />
              ))}
            </div>
          </div>
          <div className="flex-shrink-0 flex items-center justify-center p-4">
            <div>
              <PointSelector
                pointsIndex={currentSelectorIndex}
                selectedPoints={pointsSelected}
                pointOptions={pointOptions}
                onPointsDecrease={handleDecrement}
                onPointsIncrease={handleIncrement}
                onLockIn={handleLockIn}
                isLockedIn={lockedInSelection}
                isLockInDisabled={
                  abstainSelection || gameState != GameState.Selection
                }
                onAbstain={handleAbstain}
                isAbstained={abstainSelection}
                isAbstainedDisabled={
                  lockedInSelection || gameState != GameState.Selection
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Neotro;
