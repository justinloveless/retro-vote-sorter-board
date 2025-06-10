import React from "react";

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
  const colorClass = isLockedIn ? "bg-gray-500" : "bg-blue-600 hover:bg-blue-700";

  return (
    <button
      onClick={onLockIn}
      disabled={isDisabled}
      className={`rounded-lg ${colorClass} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <div className="font-neotro text-white text-2xl normal-case pt-4 pb-4 px-4">
        <span>{isLockedIn ? "Unlock" : "Lock In"}</span>
      </div>
    </button>
  );
};

export default LockInButton;
