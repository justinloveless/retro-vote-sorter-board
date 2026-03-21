import React, { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const SLIDE_MS = 280;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

type SlideState = { dir: 1 | -1; outgoing: React.ReactNode };

/**
 * Horizontal slide when the selected round index changes (round strip prev/next, swipe, or chip).
 * Forward: old exits left, new enters from the right; backward: old exits right, new from the left.
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
  const skipFirst = useRef(true);
  const lastCommittedRoundRef = useRef(roundIndex);
  const lastCommittedChildrenRef = useRef<React.ReactNode>(children);

  const [slide, setSlide] = useState<SlideState | null>(null);
  const [trackTranslatePct, setTrackTranslatePct] = useState(0);
  const [trackTransitionOn, setTrackTransitionOn] = useState(false);

  useLayoutEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      lastCommittedRoundRef.current = roundIndex;
      lastCommittedChildrenRef.current = children;
      return;
    }

    const committedRound = lastCommittedRoundRef.current;

    if (slide !== null) {
      if (committedRound === roundIndex) return;
      if (prefersReducedMotion()) {
        lastCommittedRoundRef.current = roundIndex;
        lastCommittedChildrenRef.current = children;
        setSlide(null);
        return;
      }
      const outgoing = lastCommittedChildrenRef.current;
      const dir = (roundIndex > committedRound ? 1 : -1) as 1 | -1;
      lastCommittedRoundRef.current = roundIndex;
      lastCommittedChildrenRef.current = children;
      setSlide({ dir, outgoing });
      return;
    }

    if (committedRound !== roundIndex) {
      if (prefersReducedMotion()) {
        lastCommittedRoundRef.current = roundIndex;
        lastCommittedChildrenRef.current = children;
        return;
      }
      const outgoing = lastCommittedChildrenRef.current;
      const dir = (roundIndex > committedRound ? 1 : -1) as 1 | -1;
      lastCommittedRoundRef.current = roundIndex;
      lastCommittedChildrenRef.current = children;
      setSlide({ dir, outgoing });
      return;
    }

    lastCommittedChildrenRef.current = children;
  }, [roundIndex, children, slide]);

  useLayoutEffect(() => {
    if (slide === null) return;

    setTrackTransitionOn(false);
    setTrackTranslatePct(slide.dir === 1 ? 0 : -50);

    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTrackTransitionOn(true);
        setTrackTranslatePct(slide.dir === 1 ? -50 : 0);
      });
    });

    return () => cancelAnimationFrame(id);
  }, [slide]);

  const onTrackTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.propertyName !== 'transform' || e.target !== e.currentTarget) return;
    setSlide(null);
    setTrackTransitionOn(false);
    setTrackTranslatePct(0);
  };

  if (slide === null) {
    return (
      <div className={cn('min-w-0 w-full overflow-x-hidden', className)}>
        <div className="min-w-0 w-full">{children}</div>
      </div>
    );
  }

  const { dir, outgoing } = slide;
  const forward = dir === 1;

  return (
    <div className={cn('min-w-0 w-full overflow-x-hidden', className)}>
      <div
        className="flex w-[200%] will-change-transform flex-row"
        style={{
          transform: `translateX(${trackTranslatePct}%)`,
          transition: trackTransitionOn
            ? `transform ${SLIDE_MS}ms ease-in-out`
            : 'none',
        }}
        onTransitionEnd={onTrackTransitionEnd}
      >
        {forward ? (
          <>
            <div className="min-w-0 w-1/2 shrink-0 basis-1/2">{outgoing}</div>
            <div className="min-w-0 w-1/2 shrink-0 basis-1/2">{children}</div>
          </>
        ) : (
          <>
            <div className="min-w-0 w-1/2 shrink-0 basis-1/2">{children}</div>
            <div className="min-w-0 w-1/2 shrink-0 basis-1/2">{outgoing}</div>
          </>
        )}
      </div>
    </div>
  );
}
