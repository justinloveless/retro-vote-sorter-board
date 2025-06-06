import React from "react";

interface AbstainButtonProps {
  onAbstain: () => void;
  isAbstained: boolean;
  isDisabled: boolean;
}

const AbstainButton: React.FC<AbstainButtonProps> = ({
  onAbstain,
  isAbstained,
  isDisabled,
}) => {
  const colorClass = isAbstained ? "bg-gray-500" : "bg-purple-600 hover:bg-purple-700";

  return (
    <button
      disabled={isDisabled}
      onClick={onAbstain}
      className={`rounded-lg ${colorClass} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <div className="font-neotro text-white text-2xl normal-case pt-4 pb-4 px-4">
        <span>{isAbstained ? "Unabstain" : "Abstain"}</span>
      </div>
    </button>
  );
};

export default AbstainButton;
