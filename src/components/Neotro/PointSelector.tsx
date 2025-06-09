import React from "react";

interface PointSelectorProps {
  pointsIndex: number;
  selectedPoints: number;
  pointOptions: number[];
  onPointsDecrease: () => void;
  onPointsIncrease: () => void;
}

const PointSelector: React.FC<PointSelectorProps> = ({
  pointsIndex,
  selectedPoints,
  pointOptions,
  onPointsDecrease,
  onPointsIncrease,
}) => {
  return (
    <div className="p-2 md:p-8 flex flex-col items-center justify-center font-['Press_Start_2P']">
      <div className="text-foreground text-2xl md:text-4xl mb-[4px] font-neotro">
        Your Points
      </div>

      <div className="flex items-center">
        {/* Left Arrow Button */}
        <button
          onClick={onPointsDecrease}
          className="bg-[#ff4c40ff] text-white text-3xl md:text-5xl font-neotro cursor-pointer select-none ml-2 md:ml-4 mr-2 md:mr-4 selector-buttons shadow-[0px_8px_rgba(200,50,50,255)] hover:bg-red-600 active:bg-red-700 transition-colors duration-200 rounded-2xl"
        >
          <div className="p-2 md:p-6">&lt;</div>
        </button>

        {/* Points Display and Position Indicator */}
        <div className="border-2 md:border-4 border-foreground bg-background/50 rounded-2xl p-2 md:p-4 w-40 md:w-64 flex flex-col items-center justify-center">
          <div className="text-foreground text-4xl md:text-6xl mb-2 md:mb-4">
            {selectedPoints}
          </div>
          <div className="flex space-x-1 md:space-x-2">
            {pointOptions.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${
                  index === pointsIndex
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
          className="bg-[#ff4c40ff] text-white text-3xl md:text-5xl font-neotro rounded-2xl cursor-pointer select-none ml-2 md:ml-4 mr-2 md:mr-4 selector-buttons shadow-[0px_8px_rgba(200,50,50,255)] hover:bg-red-600 active:bg-red-700 disabled:bg-yellow-700 transition-colors duration-200"
        >
          <div className="p-2 md:p-6">&gt;</div>
        </button>
      </div>
    </div>
  );
};

export default PointSelector;
