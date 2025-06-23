import React, { useState } from "react";

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
  const colorClass = isAbstained
    ? "bg-gray-500"
    : "bg-purple-600 hover:bg-purple-700";
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      disabled={isDisabled}
      onClick={onAbstain}
      onMouseDown={() => {
        setIsPressed(true);
      }}
      onMouseUp={() => {
        setIsPressed(false);
      }}
      className={`rounded-lg ${colorClass} w-[8em] disabled:opacity-50 disabled:cursor-not-allowed ${
        isAbstained
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
      <div className="font-neotro text-white text-2xl normal-case pt-4 pb-4">
        <span>{isAbstained ? "Unabstain" : "Abstain"}</span>
      </div>
    </button>
  );
};

export default AbstainButton;
