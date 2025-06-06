import React from "react";

interface PlayHandButtonProps {
  onHandPlayed: () => void;
  isHandPlayed: boolean;
}

const NextRoundButton: React.FC<PlayHandButtonProps> = ({
  onHandPlayed,
  isHandPlayed,
}) => {
  const colorClass = isHandPlayed ? "bg-purple-600 hover:bg-purple-700" : "bg-gray-500";

  return (
    <button
      onClick={onHandPlayed}
      disabled={!isHandPlayed}
      className={`grow pl-[6px] rounded-lg ${colorClass} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <div className="font-neotro text-white text-2xl normal-case">
        <span>
          Next
          <br />
          Round
        </span>
      </div>
    </button>
  );
};

export default NextRoundButton;
