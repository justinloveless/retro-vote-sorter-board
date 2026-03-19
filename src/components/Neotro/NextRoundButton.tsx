import React, { useState } from "react";
import { usePokerTable } from "./PokerTableComponent/context";

interface PlayHandButtonProps {
  onHandPlayed: () => void;
  isHandPlayed: boolean;
  className?: string;
  label?: string;
  systemMessagePrefix?: string;
}

const NextRoundButton: React.FC<PlayHandButtonProps> = ({
  onHandPlayed,
  isHandPlayed,
  className = '',
  label = 'Next Round',
  systemMessagePrefix = 'Round completed by',
}) => {
  const { activeUserSelection, sendSystemMessage } = usePokerTable();
  const colorClass = isHandPlayed
    ? "bg-purple-600 hover:bg-purple-700"
    : "bg-gray-500";
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      onClick={async () => {
        const pressedBy = (activeUserSelection?.name || '').trim() || 'Someone';
        // Important: await before calling onHandPlayed so the message is written to the
        // currently active round (pre-advance), not the newly created round.
        await sendSystemMessage(
          `<p>${systemMessagePrefix} ${pressedBy}</p>`
        );
        onHandPlayed();
      }}
      disabled={!isHandPlayed}
      className={`grow pl-[6px] rounded-lg ${colorClass} disabled:opacity-50 disabled:cursor-not-allowed ${className} ${
        !isHandPlayed
          ? `${
              isPressed
                ? `translate-y-[8px]`
                : `shadow-[0px_8px_rgba(70,70,90,255)]`
            }`
          : `${
              isPressed
                ? `translate-y-[8px]`
                : `shadow-[0px_8px_rgba(80,30,145,255)]`
            }`
      }`}
    >
      <div className="font-neotro text-white text-2xl normal-case">
        <span>
          {label}
        </span>
      </div>
    </button>
  );
};

export default NextRoundButton;
