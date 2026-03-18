import { useRef, useCallback, useState, type CSSProperties } from 'react';

interface UseSwipeNavigationOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}

export function useSwipeNavigation({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
}: UseSwipeNavigationOptions) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const locked = useRef<'horizontal' | 'vertical' | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [settling, setSettling] = useState(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    locked.current = null;
    setSettling(false);
    setDragOffset(0);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const rawDx = e.touches[0].clientX - touchStart.current.x;
    const dy = Math.abs(e.touches[0].clientY - touchStart.current.y);
    const absDx = Math.abs(rawDx);

    if (!locked.current) {
      if (absDx > 10 || dy > 10) {
        locked.current = absDx > dy * 1.2 ? 'horizontal' : 'vertical';
      }
      return;
    }

    if (locked.current === 'horizontal') {
      const dampened = Math.sign(rawDx) * Math.pow(absDx, 0.75);
      setDragOffset(dampened);
    }
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const wasHorizontal = locked.current === 'horizontal';
    const start = touchStart.current;
    touchStart.current = null;
    locked.current = null;

    if (!wasHorizontal || !start) {
      setDragOffset(0);
      return;
    }

    const deltaX = e.changedTouches[0].clientX - start.x;
    setSettling(true);
    setDragOffset(0);

    if (Math.abs(deltaX) >= threshold) {
      if (deltaX < 0) onSwipeLeft?.();
      else onSwipeRight?.();
    }

    setTimeout(() => setSettling(false), 250);
  }, [threshold, onSwipeLeft, onSwipeRight]);

  const dragStyle: CSSProperties = {
    transform: dragOffset !== 0 ? `translateX(${dragOffset}px)` : undefined,
    transition: settling ? 'transform 200ms ease-out' : 'none',
    willChange: dragOffset !== 0 ? 'transform' : undefined,
  };

  return { onTouchStart, onTouchMove, onTouchEnd, dragStyle };
}
