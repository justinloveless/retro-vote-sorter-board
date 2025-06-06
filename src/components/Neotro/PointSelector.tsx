import React from "react";
import LockInButton from "@/components/Neotro/LockInButton";
import AbstainButton from "@/components/Neotro/AbstainButton";

interface PointSelectorProps {
  pointsIndex: number;
  selectedPoints: number;
  pointOptions: number[];
  onPointsDecrease: () => void;
  onPointsIncrease: () => void;
  onLockIn: () => void;
  isLockedIn: boolean;
  isLockInDisabled: boolean;
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
  isLockInDisabled,
  onAbstain,
  isAbstained,
  isAbstainedDisabled,
}) => {
  return (
    <div className="p-8 flex flex-col items-center justify-center font-['Press_Start_2P']">
      <div className="text-white text-4xl mb-[4px] font-neotro">
        Your Points
      </div>

      <div className="flex items-center">
        {/* Lock In Button */}
        <div>
          <LockInButton
            onLockIn={onLockIn}
            isLockedIn={isLockedIn}
            isDisabled={isLockInDisabled}
          />
        </div>
        {/* Left Arrow Button */}
        <button
          onClick={onPointsDecrease}
          className="bg-[#ff4c40ff] text-white text-5xl p-6 font-neotro cursor-pointer select-none ml-4 mr-4 selector-buttons shadow-[0px_8px_rgba(200,50,50,255)] hover:bg-red-600 active:bg-red-700 transition-colors duration-200"
        >
          <div className="p-6">&lt;</div>
        </button>

        {/* Points Display and Position Indicator */}
        <div className="border-4 border-white rounded-2xl p-4 w-64 flex flex-col items-center justify-center">
          <div className="text-white text-6xl mb-4 text-shadow-[5px_5px_rgba(0,0,0,255)]">
            {selectedPoints}
          </div>
          <div className="flex space-x-2">
            {pointOptions.map((_, index) => (
              <div
                key={index}
                className={`w-3 h-3 rounded-full ${
                  index === pointsIndex ? "bg-white" : "bg-[#173a2bff]"
                }`}
              ></div>
            ))}
          </div>
        </div>
        {/* Right Arrow Button */}
        <button
          onClick={onPointsIncrease}
          className="bg-[#ff4c40ff] text-white text-5xl rounded-2xl cursor-pointer select-none ml-4 mr-4 selector-buttons shadow-[0px_8px_rgba(200,50,50,255)] hover:bg-red-600 active:bg-red-700 disabled:bg-yellow-700 transition-colors duration-200"
          disabled={false}
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
