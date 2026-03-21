import React, { useState, forwardRef } from 'react';
import { cn } from '@/lib/utils';

type TicketDetailsNeotroButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Matches Reveal Cards / Lock In / Abstain neotro button styling (rounded-lg, 8px shadow, press translate), emerald palette.
 */
export const TicketDetailsNeotroButton = forwardRef<HTMLButtonElement, TicketDetailsNeotroButtonProps>(
  ({ disabled, className, onMouseDown, onMouseUp, onMouseLeave, ...rest }, ref) => {
    const [isPressed, setIsPressed] = useState(false);
    const colorClass = disabled ? 'bg-gray-500' : 'bg-emerald-600 hover:bg-emerald-700';
    const elevationClass = disabled
      ? isPressed
        ? 'translate-y-[8px]'
        : 'shadow-[0px_8px_rgba(70,70,90,255)]'
      : isPressed
        ? 'translate-y-[8px]'
        : 'shadow-[0px_8px_rgba(5,100,75,255)]';

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        {...rest}
        className={cn(
          'grow rounded-lg pr-[6px] disabled:opacity-50 disabled:cursor-not-allowed',
          colorClass,
          elevationClass,
          className
        )}
        onMouseDown={(e) => {
          setIsPressed(true);
          onMouseDown?.(e);
        }}
        onMouseUp={(e) => {
          setIsPressed(false);
          onMouseUp?.(e);
        }}
        onMouseLeave={(e) => {
          setIsPressed(false);
          onMouseLeave?.(e);
        }}
      >
        <div className="font-neotro text-white text-2xl normal-case py-2 px-2 sm:py-3 sm:px-3">
          <span>Ticket Details</span>
        </div>
      </button>
    );
  }
);

TicketDetailsNeotroButton.displayName = 'TicketDetailsNeotroButton';
