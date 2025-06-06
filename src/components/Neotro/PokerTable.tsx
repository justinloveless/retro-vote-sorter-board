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

const Neotro: React.FC = () => {
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

  const isBgAnimated = true;

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
    <div ref={shakeRef} className="relative min-h-screen poker-table">
      {isBgAnimated && (
        <></>
        // <>
        //   <div className="absolute inset-0 bg-[#336852ff]"></div>
        //   {/* Blue Blob */}
        //   <div className="absolute top-1/3 right-1/4 w-64 h-64 sm:w-72 sm:h-72 md:w-400 md:h-400 bg-blue-500 rounded-full opacity-60 mix-blend-lighten filter blur-2xl sm:blur-3xl md:blur-[300px] animate-blob-2"></div>
        //   {/* Green Blob */}
        //   <div className="absolute bottom-1/3 left-1/2 w-64 h-64 sm:w-72 sm:h-72 md:w-400 md:h-400 bg-green-500 rounded-full opacity-60 mix-blend-lighten filter blur-2xl sm:blur-3xl md:blur-[300px] animate-blob-2"></div>
        //   {/* Red Blob */}
        //   <div className="absolute bottom-1/4 right-1/2 w-64 h-64 sm:w-80 sm:h-80 md:w-400 md:h-400 bg-red-500 rounded-full opacity-60 mix-blend-lighten filter blur-2xl sm:blur-3xl md:blur-[300px] animate-blob-1"></div>
        //   <div className="absolute top-1/4 left-1/2 w-64 h-64 sm:w-80 sm:h-80 md:w-400 md:h-400 bg-red-500 rounded-full opacity-60 mix-blend-lighten filter blur-2xl sm:blur-3xl md:blur-[300px] animate-blob-1"></div>
        //   {/* Yellow Blob */}
        //   <div className="absolute bottom-1/4 left-1/3 w-56 h-56 sm:w-64 sm:h-64 md:w-400 md:h-400 bg-yellow-400 rounded-full opacity-60 mix-blend-lighten filter blur-2xl sm:blur-10xl md:blur-[300px] animate-blob-3"></div>
        // </>
      )}
      <div className="flex justify-center items-center">
        <div className="w-3/12 h-screen pl-10 pr-5">
          <div>
            <div className="px-5 bg-[#2d2d2d] h-screen border-l-10 border-r-10 border-[#025b95ff]">
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
        <div className="w-9/12 h-screen pt-80 pb-80 pl-40 pr-40">
          <div className="h-[80%] flex items-center">
            <div>
              <PlayingCard
                cardState={cardStateActivePlayer}
                playerName={"Kim"}
                pointsSelected={pointsSelected}
              />
            </div>
            <div>
              <PlayingCard
                cardState={cardStateOtherPlayers}
                playerName={"Phil"}
                pointsSelected={1}
              />
            </div>
            <div>
              <PlayingCard
                cardState={cardStateOtherPlayers}
                playerName={"John"}
                pointsSelected={2}
              />
            </div>
            <div>
              <PlayingCard
                cardState={cardStateOtherPlayers}
                playerName={"Diogo"}
                pointsSelected={3}
              />
            </div>
            <div>
              <PlayingCard
                cardState={cardStateOtherPlayers}
                playerName={"Justin"}
                pointsSelected={5}
              />
            </div>
            <div>
              <PlayingCard
                cardState={cardStateOtherPlayers}
                playerName={"Carlos"}
                pointsSelected={8}
              />
            </div>
            <div>
              <PlayingCard
                cardState={cardStateOtherPlayers}
                playerName={"Tiago"}
                pointsSelected={13}
              />
            </div>
            <div>
              <PlayingCard
                cardState={cardStateOtherPlayers}
                playerName={"Lee"}
                pointsSelected={21}
              />
            </div>
          </div>
          <div className="flex flex-row items-center justify-center">
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
