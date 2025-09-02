import React from "react";
import CardState from "./CardState.tsx";

// Define the props for the Tooltip component
interface TooltipProps {
  playerName: string;
  cardState: CardState;
  pointsSelected: number;
  isPointing: boolean;
}

const Tooltip: React.FC<TooltipProps> = ({
  playerName,
  cardState,
  pointsSelected,
  isPointing,
}) => {
  return (
    <div className="bg-[#2e3a3cff] border-4 border-[#ebeff3ff] rounded-2xl p-2">
      <div className="bg-[#e0e0e0] rounded-lg px-8 py-2 mb-2">
        <p className="text-center text-4xl text-black font-bold">
          {playerName}
        </p>
      </div>
      <div className="bg-[#e0e0e0] rounded-lg px-8 py-2">
        {cardState === CardState.Selection ? (
          <p className="text-center text-xl text-[#ff6a55]">Still pointing</p>
        ) : cardState === CardState.Played ? (
          <p className="text-center text-xl text-[#28a745]">
            Points selected: {pointsSelected}
          </p>
        ) : cardState === CardState.Locked ? (
          <p className="text-center text-xl text-[#007bff]">Confirmed points</p>
        ) : (
          <p className="text-center text-xl text-[#ff6a55]">Still pointing</p>
        )}
      </div>
    </div>
  );
};

export default Tooltip;
