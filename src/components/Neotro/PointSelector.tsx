import React from "react";
import LockInButton from "@/components/Neotro/LockInButton";
import AbstainButton from "@/components/Neotro/AbstainButton";
import { useIsMobile } from "@/hooks/use-mobile";

interface PointSelectorProps {
  pointsIndex: number;
  selectedPoints: number;
  pointOptions: number[];
  onPointsDecrease: () => void;
  onPointsIncrease: () => void;
  onLockIn: () => void;
  isLockedIn: boolean;
  onAbstain: () => void;
  isAbstained: boolean;
  isAbstainedDisabled: boolean;
}

const PointSelector: React.FC<PointSelectorProps> = ({
  pointsIndex,
  selectedPoints,
  pointOptions,
  onPointsDecrease,
  onPointsIncrease,
  onLockIn,
  isLockedIn,
  onAbstain,
  isAbstained,
  isAbstainedDisabled,
}) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="p-4 flex flex-col items-center justify-center font-['Press_Start_2P'] bg-black/20 backdrop-blur rounded-2xl">
        <div className="text-white text-2xl mb-4 font-neotro text-center">
          Your Points
        </div>

        <div className="flex items-center justify-center w-full mb-4">
          {/* Left Arrow Button */}
          <button
            onClick={onPointsDecrease}
            disabled={isAbstained || isLockedIn}
            className="bg-[#ff4c40ff] text-white text-3xl font-neotro cursor-pointer select-none selector-buttons shadow-[0px_6px_rgba(200,50,50,255)] hover:bg-red-600 active:bg-red-700 transition-colors duration-200 rounded-xl mr-3"
          >
            <div className="p-3">&lt;</div>
          </button>

          {/* Points Display */}
          <div className="border-3 border-white bg-white/20 backdrop-blur rounded-xl p-3 min-w-[120px] flex flex-col items-center justify-center">
            <div className="text-white text-4xl mb-2">
              {selectedPoints}
            </div>
            <div className="flex space-x-1">
              {pointOptions.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full ${index === pointsIndex
                    ? "bg-white"
                    : "bg-white/50"
                    }`}
                ></div>
              ))}
            </div>
          </div>

          {/* Right Arrow Button */}
          <button
            onClick={onPointsIncrease}
            disabled={isAbstained || isLockedIn}
            className="bg-[#ff4c40ff] text-white text-3xl font-neotro rounded-xl cursor-pointer select-none ml-3 selector-buttons shadow-[0px_6px_rgba(200,50,50,255)] hover:bg-red-600 active:bg-red-700 transition-colors duration-200"
          >
            <div className="p-3">&gt;</div>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-center w-full">
          <LockInButton
            onLockIn={onLockIn}
            isLockedIn={isLockedIn}
            isDisabled={isAbstained}
          />
          <AbstainButton
            onAbstain={onAbstain}
            isAbstained={isAbstained}
            isDisabled={isAbstainedDisabled}
          />
        </div>
      </div>
    );
  }

  // Desktop layout (unchanged)
  return (
    <div className="p-8 flex flex-col items-center justify-center font-['Press_Start_2P']">
      <div className="text-foreground text-4xl mb-[4px] font-neotro">
        Your Points
      </div>

      <div className="flex items-center">
        {/* Lock In Button */}
        <div>
          <LockInButton
            onLockIn={onLockIn}
            isLockedIn={isLockedIn}
            isDisabled={isAbstained}
          />
        </div>
        {/* Left Arrow Button */}
        <button
          onClick={onPointsDecrease}
          disabled={isAbstained || isLockedIn}
          className="bg-[#ff4c40ff] text-white text-5xl font-neotro cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 select-none ml-4 mr-4 selector-buttons shadow-[0px_8px_rgba(200,50,50,255)] hover:bg-red-600 active:bg-red-700 transition-colors duration-200 rounded-2xl"
        >
          <div className="p-6">&lt;</div>
        </button>

        {/* Points Display and Position Indicator */}
        <div className="border-4 border-foreground bg-background/50 rounded-2xl p-4 w-64 flex flex-col items-center justify-center">
          <div className="text-foreground text-6xl mb-4">
            {selectedPoints}
          </div>
          <div className="flex space-x-2">
            {pointOptions.map((_, index) => (
              <div
                key={index}
                className={`w-3 h-3 rounded-full ${index === pointsIndex
                  ? "bg-foreground"
                  : "bg-muted-foreground/50"
                  }`}
              ></div>
            ))}
          </div>
        </div>
        {/* Right Arrow Button */}
        <button
          onClick={onPointsIncrease}
          disabled={isAbstained || isLockedIn}
          className="bg-[#ff4c40ff] text-white text-5xl font-neotro rounded-2xl cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 select-none ml-4 mr-4 selector-buttons shadow-[0px_8px_rgba(200,50,50,255)] hover:bg-red-600 active:bg-red-700 transition-colors duration-200"
        >
          <div className="p-6">&gt;</div>
        </button>
        {/* Abstain Button */}
        <div>
          <AbstainButton
            onAbstain={onAbstain}
            isAbstained={isAbstained}
            isDisabled={isAbstainedDisabled}
          />
        </div>
      </div>
    </div>
  );
};

export default PointSelector;
