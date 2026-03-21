import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { getCardImage } from './PlayingCards/cardImage';

interface DragState {
  points: number;
  x: number;
  y: number;
  cardWidth: number;
  cardHeight: number;
}

interface DragToPlayContextValue {
  dragState: DragState | null;
  startDrag: (points: number, x: number, y: number, cardWidth: number, cardHeight: number) => void;
  updateDrag: (x: number, y: number) => void;
  endDrag: () => void;
  isOverDropZone: boolean;
  setDropZoneRef: (el: HTMLDivElement | null) => void;
}

const DragToPlayContext = createContext<DragToPlayContextValue | null>(null);

export const useDragToPlay = () => useContext(DragToPlayContext);

interface DragToPlayProviderProps {
  children: React.ReactNode;
  onDrop: (points: number) => void;
  disabled?: boolean;
}

export const DragToPlayProvider: React.FC<DragToPlayProviderProps> = ({ children, onDrop, disabled }) => {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isOverDropZone, setIsOverDropZone] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);

  const setDropZoneRef = useCallback((el: HTMLDivElement | null) => {
    dropZoneRef.current = el;
  }, []);

  const checkOverDropZone = useCallback((x: number, y: number) => {
    if (!dropZoneRef.current) return false;
    const rect = dropZoneRef.current.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }, []);

  const startDrag = useCallback((points: number, x: number, y: number, cardWidth: number, cardHeight: number) => {
    if (disabled) return;
    const state = { points, x, y, cardWidth, cardHeight };
    dragStateRef.current = state;
    setDragState(state);
  }, [disabled]);

  const updateDrag = useCallback((x: number, y: number) => {
    if (!dragStateRef.current) return;
    const state = { ...dragStateRef.current, x, y };
    dragStateRef.current = state;
    setDragState(state);
    setIsOverDropZone(checkOverDropZone(x, y));
  }, [checkOverDropZone]);

  const endDrag = useCallback(() => {
    const state = dragStateRef.current;
    if (state && checkOverDropZone(state.x, state.y)) {
      onDrop(state.points);
    }
    dragStateRef.current = null;
    setDragState(null);
    setIsOverDropZone(false);
  }, [onDrop, checkOverDropZone]);

  const isDragging = dragState !== null;

  // Global pointer/touch move and up listeners when dragging
  useEffect(() => {
    if (!isDragging) return;
    const onPointerMove = (e: PointerEvent) => {
      e.preventDefault();
      updateDrag(e.clientX, e.clientY);
    };
    const onPointerUp = () => {
      endDrag();
    };
    // Capture to ensure we get events even when pointer leaves the element
    window.addEventListener('pointermove', onPointerMove, { capture: true });
    window.addEventListener('pointerup', onPointerUp, { capture: true });
    window.addEventListener('pointercancel', onPointerUp, { capture: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove, { capture: true });
      window.removeEventListener('pointerup', onPointerUp, { capture: true });
      window.removeEventListener('pointercancel', onPointerUp, { capture: true });
    };
  }, [isDragging, updateDrag, endDrag]);

  return (
    <DragToPlayContext.Provider value={{ dragState, startDrag, updateDrag, endDrag, isOverDropZone, setDropZoneRef }}>
      {children}
      {dragState && <FloatingCard dragState={dragState} />}
    </DragToPlayContext.Provider>
  );
};

/** The card image that follows the pointer while dragging */
const FloatingCard: React.FC<{ dragState: DragState }> = ({ dragState }) => {
  return ReactDOM.createPortal(
    <div
      className="pointer-events-none fixed z-[9999]"
      style={{
        left: dragState.x - dragState.cardWidth / 2,
        top: dragState.y - dragState.cardHeight * 0.7,
        width: dragState.cardWidth,
        height: dragState.cardHeight,
        transition: 'none',
      }}
    >
      <img
        src={getCardImage(dragState.points)}
        alt={`${dragState.points} points`}
        className="w-full h-full object-contain drop-shadow-2xl"
        style={{
          imageRendering: 'pixelated',
          transform: 'rotate(-5deg) scale(1.15)',
          filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.4))',
        }}
      />
    </div>,
    document.body
  );
};

/** Drop zone overlay that appears on the playing field during drag */
export const DropZoneOverlay: React.FC = () => {
  const ctx = useDragToPlay();
  if (!ctx || !ctx.dragState) return null;

  return (
    <div
      ref={ctx.setDropZoneRef}
      className={`absolute inset-0 z-40 flex items-center justify-center rounded-xl border-2 border-dashed transition-all duration-200 ${
        ctx.isOverDropZone
          ? 'border-primary bg-primary/20 backdrop-blur-sm'
          : 'border-muted-foreground/40 bg-muted/10 backdrop-blur-[2px]'
      }`}
    >
      <div className={`flex flex-col items-center gap-2 transition-all duration-200 ${
        ctx.isOverDropZone ? 'scale-110' : 'scale-100'
      }`}>
        <div className={`rounded-full p-3 ${
          ctx.isOverDropZone ? 'bg-primary/30' : 'bg-muted/30'
        }`}>
          <svg
            className={`h-8 w-8 ${ctx.isOverDropZone ? 'text-primary' : 'text-muted-foreground'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m0 0l-4-4m4 4l4-4" />
          </svg>
        </div>
        <span className={`text-sm font-semibold ${
          ctx.isOverDropZone ? 'text-primary' : 'text-muted-foreground'
        }`}>
          {ctx.isOverDropZone ? 'Release to lock in!' : 'Drop card here'}
        </span>
      </div>
    </div>
  );
};
