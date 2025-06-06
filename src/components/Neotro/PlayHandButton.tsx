import React from "react";

interface PlayHandButtonProps {
  onHandPlayed: () => void;
  isHandPlayed: boolean;
}

const PlayHandButton: React.FC<PlayHandButtonProps> = ({
  onHandPlayed,
  isHandPlayed,
}) => {
  const colorClass = isHandPlayed ? "bg-gray-500" : "bg-blue-600 hover:bg-blue-700";

  return (
    <button
      onClick={onHandPlayed}
      disabled={isHandPlayed}
      className={`grow pr-[6px] rounded-lg ${colorClass} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <div className="font-neotro text-white text-2xl normal-case">
        <span>
          Play
          <br />
          Hand
        </span>
      </div>
    </button>
  );
};

export default PlayHandButton;
