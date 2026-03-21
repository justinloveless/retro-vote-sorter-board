import React, { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const SLIDE_MS = 280;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Horizontal slide when the selected round index changes (round strip prev/next, swipe, or chip).
 * Forward: content enters from the right; backward: from the left.
 */
export function PlayingFieldRoundSlide({
  roundIndex,
  className,
  children,
}: {
  roundIndex: number;
  className?: string;
  children: React.ReactNode;
}) {
  const prevIndexRef = useRef(roundIndex);
  const directionRef = useRef(1);
  const skipFirst = useRef(true);
  const [translateXPct, setTranslateXPct] = useState(0);
  const [transitionOn, setTransitionOn] = useState(false);

  useLayoutEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      prevIndexRef.current = roundIndex;
      return;
    }
    if (prevIndexRef.current === roundIndex) return;

    if (prefersReducedMotion()) {
      prevIndexRef.current = roundIndex;
      setTranslateXPct(0);
      setTransitionOn(false);
      return;
    }

    directionRef.current = roundIndex > prevIndexRef.current ? 1 : -1;
    prevIndexRef.current = roundIndex;

    setTransitionOn(false);
    setTranslateXPct(directionRef.current * 100);

    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransitionOn(true);
        setTranslateXPct(0);
      });
    });

    return () => cancelAnimationFrame(id);
  }, [roundIndex]);

  return (
    <div className={cn('min-w-0 w-full overflow-x-hidden', className)}>
      <div
        className={cn('will-change-transform', transitionOn && 'ease-out')}
        style={{
          transform: `translateX(${translateXPct}%)`,
          transition: transitionOn ? `transform ${SLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)` : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}
