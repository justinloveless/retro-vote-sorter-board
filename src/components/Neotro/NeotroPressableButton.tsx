import React, { forwardRef, useState } from 'react';
import { cn } from '@/lib/utils';

const SHADOW_OFFSET = 4;

type NeotroPressableButtonProps = {
  isActive?: boolean;
  isDisabled?: boolean;
  activeShowsPressed?: boolean;
  variant?: 'default' | 'destructive';
  onClick?: (e?: React.MouseEvent) => void;
  type?: 'button' | 'submit';
  'aria-label'?: string;
  children: React.ReactNode;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'default' | 'compact';
  href?: string;
  target?: string;
  rel?: string;
};

export const NeotroPressableButton = forwardRef<HTMLButtonElement | HTMLAnchorElement, NeotroPressableButtonProps>(({
  isActive = false,
  isDisabled,
  activeShowsPressed = true,
  variant = 'default',
  onClick,
  type = 'button',
  'aria-label': ariaLabel,
  children,
  className,
  size = 'md',
  href,
  target,
  rel,
}, ref) => {
  const [isPressed, setIsPressed] = useState(false);
  const showPressed = (activeShowsPressed && isActive) || isPressed;

  const sizeClasses = size === 'xs' ? 'h-6 w-6' : size === 'sm' ? 'h-7 w-7' : size === 'md' ? 'h-9 w-9' : size === 'compact' ? 'h-7 px-3 text-xs min-w-0' : 'h-9 px-4 min-w-[6rem]';

  const colorClasses = variant === 'destructive'
    ? 'bg-red-600 text-white hover:bg-red-700'
    : isActive
      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
      : 'bg-gray-500 text-white hover:bg-gray-600';

  const shadowColor = variant === 'destructive'
    ? 'rgba(100,30,30,255)'
    : isActive
      ? `color-mix(in srgb, hsl(var(--primary)) 65%, black)`
      : 'rgba(70,70,90,255)';

  const sharedProps = {
    ref,
    onMouseDown: () => setIsPressed(true),
    onMouseUp: () => setIsPressed(false),
    onMouseLeave: () => setIsPressed(false),
    'aria-label': ariaLabel,
    className: cn(
      'rounded-lg transition-all flex items-center justify-center no-underline',
      sizeClasses,
      colorClasses,
      showPressed ? 'translate-y-[4px]' : 'translate-y-0',
      variant === 'default' && !isActive && !isDisabled && 'saturate-75',
      isDisabled && 'opacity-50 cursor-not-allowed pointer-events-none',
      className
    ),
    style: {
      boxShadow: showPressed ? 'none' : `0px ${SHADOW_OFFSET}px 0px ${shadowColor}`,
    } as React.CSSProperties,
  };

  if (href) {
    return (
      <a
        href={href}
        target={target}
        rel={rel}
        {...sharedProps}
        ref={ref as React.ForwardedRef<HTMLAnchorElement>}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      {...sharedProps}
    >
      {children}
    </button>
  );
});
NeotroPressableButton.displayName = 'NeotroPressableButton';
