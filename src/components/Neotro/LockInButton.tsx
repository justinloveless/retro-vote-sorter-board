import React, { useState } from "react";
interface LockInButtonProps {
  onLockIn: () => void;
  isLockedIn: boolean;
  className?: string;
  isDisabled?: boolean;
}

const LockInButton: React.FC<LockInButtonProps> = ({
  onLockIn,
  isLockedIn,
  isDisabled,
}) => {
  const colorClass = isLockedIn
    ? "bg-gray-500"
    : "bg-blue-600 hover:bg-blue-700";
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      onClick={onLockIn}
      onMouseDown={() => {
        setIsPressed(true);
      }}
      onMouseUp={() => {
        setIsPressed(false);
      }}
      disabled={isDisabled}
      className={`rounded-lg ${colorClass} w-[8em] disabled:opacity-50 disabled:cursor-not-allowed ${
        isLockedIn
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
      <div className="font-neotro text-white text-2xl normal-case pt-4 pb-4 px-4">
        <span>{isLockedIn ? "Unlock" : "Lock In"}</span>
      </div>
    </button>
  );
};

export default LockInButton;
