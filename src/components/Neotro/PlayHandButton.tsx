import React, { useState } from "react";

interface PlayHandButtonProps {
  onHandPlayed: () => void;
  isHandPlayed: boolean;
  className?: string;
}

const PlayHandButton: React.FC<PlayHandButtonProps> = ({
  onHandPlayed,
  isHandPlayed,
  className = '',
}) => {
  const colorClass = isHandPlayed
    ? "bg-gray-500"
    : "bg-blue-600 hover:bg-blue-700";
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      onClick={onHandPlayed}
      onMouseDown={() => {
        setIsPressed(true);
      }}
      onMouseUp={() => {
        setIsPressed(false);
      }}
      disabled={isHandPlayed}
      className={`grow pr-[6px] rounded-lg ${colorClass} disabled:opacity-50 disabled:cursor-not-allowed ${className} ${
        isHandPlayed
          ? `${
              isPressed
                ? `translate-y-[8px]`
                : `shadow-[0px_8px_rgba(70,70,90,255)]`
            }`
          : `${
              isPressed
                ? `translate-y-[8px]`
                : `shadow-[0px_8px_rgba(50,50,220,255)]`
            }`
      }`}
    >
      <div className="font-neotro text-white text-2xl normal-case">
        <span>
          Reveal Cards
        </span>
      </div>
    </button>
  );
};

export default PlayHandButton;
