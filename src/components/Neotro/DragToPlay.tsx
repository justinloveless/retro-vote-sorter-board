import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { getCardImage } from './PlayingCards/cardImage';
import BetweenCard from './PlayingCards/BetweenCard';
import { useBetweenHoldAnimationPrefs } from '@/lib/betweenHoldAnimationPrefs';

const HOLD_MS = 2000;
const ZONE_GAP = 10;
/** Hold progress 0→1 maps to this fraction of the diagonal wipe so the full hold only reveals half of the BetweenCard. */
const BETWEEN_WIPE_PROGRESS_SCALE = 0.55;

export interface DragState {
  points: number;
  x: number;
  y: number;
  cardWidth: number;
  cardHeight: number;
  /** Center of the hand card that started the drag (for side zones). */
  originX: number;
  originY: number;
  /** When dragging a mixed hand card, high end of the range (`points` is low). */
  betweenHighPoints?: number;
}

function neighborsInDeck(deck: number[], p: number): { lower?: number; higher?: number } {
  const i = deck.indexOf(p);
  if (i < 0) return {};
  return {
    lower: i > 0 ? deck[i - 1] : undefined,
    higher: i < deck.length - 1 ? deck[i + 1] : undefined,
  };
}

/** Single card or mixed pair numeric bounds from drag state. */
function pairBoundsFromDragState(s: DragState): { pairMin: number; pairMax: number } {
  const h = s.betweenHighPoints;
  if (h != null && h !== s.points) {
    return { pairMin: Math.min(s.points, h), pairMax: Math.max(s.points, h) };
  }
  return { pairMin: s.points, pairMax: s.points };
}

/** Neighbors outside the dragged single or mixed pair (for side zones / hold). */
function neighborsOutsideDragPair(pointOptions: number[], s: DragState): {
  lower?: number;
  higher?: number;
} {
  const { pairMin, pairMax } = pairBoundsFromDragState(s);
  const { lower } = neighborsInDeck(pointOptions, pairMin);
  const { higher } = neighborsInDeck(pointOptions, pairMax);
  return { lower, higher };
}

function pointInRect(px: number, py: number, rect: { left: number; top: number; width: number; height: number }): boolean {
  return px >= rect.left && px <= rect.left + rect.width && py >= rect.top && py <= rect.top + rect.height;
}

/**
 * Coordinates as % of box (0–100). p = hold 0…1.
 * Lower (left) zone: wipe front moves TL→BR — original clears from TL first (BetweenCard shows TL first).
 * Higher (right) zone: wipe BR→TL — original clears from BR first.
 */
function diagonalBetweenWipeClipPath(p: number, zone: 'lower' | 'higher'): string {
  const t = Math.min(1, Math.max(0, p));
  if (zone === 'lower') {
    // Visible original: x+y >= s, s goes 0 → 200 (shrink toward BR corner)
    const s = 200 * t;
    if (s <= 0) return 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
    if (s >= 200) return 'polygon(50% 50%, 50% 50%, 50% 50%)';
    if (s <= 100) {
      return `polygon(${s}% 0%, 100% 0%, 100% 100%, 0% 100%, 0% ${s}%)`;
    }
    const x = s - 100;
    return `polygon(100% 100%, 100% ${100 - x}%, ${100 - x}% 100%)`;
  }
  // higher: visible original x+y <= s, s goes 200 → 0 (shrink toward TL)
  const s = 200 * (1 - t);
  if (s >= 200) return 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
  if (s <= 0) return 'polygon(50% 50%, 50% 50%, 50% 50%)';
  if (s <= 100) {
    return `polygon(0% 0%, ${s}%, 0%, 0% ${s}%)`;
  }
  const x = s - 100;
  return `polygon(0% 0%, 100% 0%, 100% ${x}%, ${x}% 100%, 0% 100%)`;
}

function sideZoneRects(state: DragState): { lower: { left: number; top: number; width: number; height: number } | null; higher: { left: number; top: number; width: number; height: number } | null } {
  const { originX, originY, cardWidth, cardHeight } = state;
  const zoneW = cardWidth * 1.15;
  const zoneH = cardHeight * 1.1;
  const halfCard = cardWidth * 0.45;

  const top = originY - zoneH / 2;

  const lowerLeft = originX - halfCard - ZONE_GAP - zoneW;
  const higherLeft = originX + halfCard + ZONE_GAP;

  return {
    lower: { left: lowerLeft, top, width: zoneW, height: zoneH },
    higher: { left: higherLeft, top, width: zoneW, height: zoneH },
  };
}

interface DragToPlayContextValue {
  dragState: DragState | null;
  startDrag: (
    points: number,
    x: number,
    y: number,
    cardWidth: number,
    cardHeight: number,
    originX: number,
    originY: number,
    betweenHighPoints?: number
  ) => void;
  updateDrag: (x: number, y: number) => void;
  endDrag: () => void;
  isOverDropZone: boolean;
  setDropZoneRef: (el: HTMLDivElement | null) => void;
  /** Lower / higher neighbor hold progress (0–1) while pointer is in that zone. */
  sideZoneHold: { lower: number; higher: number };
}

const DragToPlayContext = createContext<DragToPlayContextValue | null>(null);

export const useDragToPlay = () => useContext(DragToPlayContext);

interface DragToPlayProviderProps {
  children: React.ReactNode;
  /** Second arg set when dropping a mixed (between) card so the parent can lock the full range. */
  onDrop: (points: number, betweenHighPoints?: number) => void;
  /** Called after holding over a side zone for 2s (parent should set between vote and lock in). */
  onBetweenSelect?: (low: number, high: number) => void;
  pointOptions?: number[];
  disabled?: boolean;
}

export const DragToPlayProvider: React.FC<DragToPlayProviderProps> = ({
  children,
  onDrop,
  onBetweenSelect,
  pointOptions = [],
  disabled,
}) => {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isOverDropZone, setIsOverDropZone] = useState(false);
  const [sideZoneHold, setSideZoneHold] = useState({ lower: 0, higher: 0 });
  const dropZoneRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const holdRef = useRef<{ zone: 'lower' | 'higher' | null; since: number }>({ zone: null, since: 0 });
  const onBetweenSelectRef = useRef(onBetweenSelect);
  onBetweenSelectRef.current = onBetweenSelect;
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  const setDropZoneRef = useCallback((el: HTMLDivElement | null) => {
    dropZoneRef.current = el;
  }, []);

  const checkOverDropZone = useCallback((x: number, y: number) => {
    if (!dropZoneRef.current) return false;
    const rect = dropZoneRef.current.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }, []);

  const cancelDrag = useCallback(() => {
    dragStateRef.current = null;
    setDragState(null);
    setIsOverDropZone(false);
    setSideZoneHold({ lower: 0, higher: 0 });
    holdRef.current = { zone: null, since: 0 };
  }, []);

  const startDrag = useCallback(
    (
      points: number,
      x: number,
      y: number,
      cardWidth: number,
      cardHeight: number,
      originX: number,
      originY: number,
      betweenHighPoints?: number
    ) => {
      if (disabled) return;
      const state: DragState = {
        points,
        x,
        y,
        cardWidth,
        cardHeight,
        originX,
        originY,
        ...(betweenHighPoints != null ? { betweenHighPoints } : {}),
      };
      dragStateRef.current = state;
      setDragState(state);
      holdRef.current = { zone: null, since: 0 };
      setSideZoneHold({ lower: 0, higher: 0 });
    },
    [disabled]
  );

  const updateDrag = useCallback(
    (x: number, y: number) => {
      if (!dragStateRef.current) return;
      const state = { ...dragStateRef.current, x, y };
      dragStateRef.current = state;
      setDragState(state);
      setIsOverDropZone(checkOverDropZone(x, y));
    },
    [checkOverDropZone]
  );

  const endDrag = useCallback(() => {
    const state = dragStateRef.current;
    if (state && checkOverDropZone(state.x, state.y)) {
      const high = state.betweenHighPoints;
      if (high != null && high !== state.points) {
        onDropRef.current(state.points, high);
      } else {
        onDropRef.current(state.points);
      }
    }
    cancelDrag();
  }, [checkOverDropZone, cancelDrag]);

  const isDragging = dragState !== null;
  const sideZonesEnabled = Boolean(onBetweenSelect && pointOptions.length > 0);

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
    window.addEventListener('pointermove', onPointerMove, { capture: true });
    window.addEventListener('pointerup', onPointerUp, { capture: true });
    window.addEventListener('pointercancel', onPointerUp, { capture: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove, { capture: true });
      window.removeEventListener('pointerup', onPointerUp, { capture: true });
      window.removeEventListener('pointercancel', onPointerUp, { capture: true });
    };
  }, [isDragging, updateDrag, endDrag]);

  // 2s hold timer for side between-zones
  useEffect(() => {
    if (!isDragging || !sideZonesEnabled) return;

    const id = window.setInterval(() => {
      const s = dragStateRef.current;
      const cb = onBetweenSelectRef.current;
      if (!s || !cb) return;

      const { lower, higher } = neighborsOutsideDragPair(pointOptions, s);
      const rects = sideZoneRects(s);
      const { pairMin, pairMax } = pairBoundsFromDragState(s);

      const inLower = lower != null && rects.lower != null && pointInRect(s.x, s.y, rects.lower);
      const inHigher = higher != null && rects.higher != null && pointInRect(s.x, s.y, rects.higher);

      let active: 'lower' | 'higher' | null = null;
      if (inLower && !inHigher) active = 'lower';
      else if (inHigher && !inLower) active = 'higher';

      const now = performance.now();
      if (active !== holdRef.current.zone) {
        holdRef.current = { zone: active, since: now };
        setSideZoneHold({ lower: 0, higher: 0 });
      }

      if (!active) {
        setSideZoneHold({ lower: 0, higher: 0 });
        return;
      }

      const elapsed = now - holdRef.current.since;
      const progress = Math.min(1, elapsed / HOLD_MS);
      if (active === 'lower') {
        setSideZoneHold({ lower: progress, higher: 0 });
      } else {
        setSideZoneHold({ lower: 0, higher: progress });
      }

      if (elapsed >= HOLD_MS) {
        if (active === 'lower' && lower != null) {
          cb(Math.min(lower, pairMin), Math.max(lower, pairMax));
        } else if (active === 'higher' && higher != null) {
          cb(Math.min(higher, pairMin), Math.max(higher, pairMax));
        }
        holdRef.current = { zone: null, since: 0 };
        dragStateRef.current = null;
        setDragState(null);
        setIsOverDropZone(false);
        setSideZoneHold({ lower: 0, higher: 0 });
      }
    }, 50);

    return () => clearInterval(id);
  }, [isDragging, sideZonesEnabled, pointOptions]);

  return (
    <DragToPlayContext.Provider
      value={{
        dragState,
        startDrag,
        updateDrag,
        endDrag,
        isOverDropZone,
        setDropZoneRef,
        sideZoneHold,
      }}
    >
      {children}
      {dragState && (
        <FloatingCard
          dragState={dragState}
          sideZoneHold={sideZoneHold}
          pointOptions={pointOptions}
        />
      )}
      {dragState && sideZonesEnabled && (
        <BetweenSideZonesPortal dragState={dragState} pointOptions={pointOptions} sideZoneHold={sideZoneHold} />
      )}
    </DragToPlayContext.Provider>
  );
};

const BetweenSideZonesPortal: React.FC<{
  dragState: DragState;
  pointOptions: number[];
  sideZoneHold: { lower: number; higher: number };
}> = ({ dragState, pointOptions, sideZoneHold }) => {
  const holdPrefs = useBetweenHoldAnimationPrefs();
  const { lower, higher } = neighborsOutsideDragPair(pointOptions, dragState);
  const { pairMin, pairMax } = pairBoundsFromDragState(dragState);
  const rects = sideZoneRects(dragState);

  const renderZone = (
    key: string,
    neighborPts: number | undefined,
    rect: { left: number; top: number; width: number; height: number } | null,
    progress: number,
    label: string
  ) => {
    if (neighborPts == null || rect == null) return null;
    return (
      <div
        key={key}
        className="pointer-events-none fixed flex flex-col items-center"
        style={{
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          zIndex: holdPrefs.floatingCardAboveSideZones ? 10010 : 10020,
        }}
      >
        {holdPrefs.zoneCountdownPill && progress > 0 && progress < 1 && (
          <div className="absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground shadow-md ring-2 ring-primary/30">
            {Math.max(1, Math.ceil((1 - progress) * (HOLD_MS / 1000)))}s — hold
          </div>
        )}
        <div className="flex h-full w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-primary/50 bg-background/85 p-2 shadow-xl ring-2 ring-primary/20 backdrop-blur-md">
          <div className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-md">
            <img
              src={getCardImage(neighborPts)}
              alt=""
              className="max-h-full max-w-full object-contain opacity-45"
              style={{ imageRendering: 'pixelated' }}
            />
            {holdPrefs.zoneProgressFill && progress > 0 && (
              <div
                className="absolute inset-0 bg-primary/30 transition-[clip-path] duration-75 ease-linear"
                style={{
                  clipPath: `inset(${(1 - progress) * 100}% 0 0 0)`,
                }}
              />
            )}
          </div>
          <span className="text-center text-[10px] font-medium leading-tight text-foreground/90">
            {label}
          </span>
        </div>
      </div>
    );
  };

  const rangeLabel =
    pairMin !== pairMax ? `${pairMin}–${pairMax}` : `${pairMin}`;
  return ReactDOM.createPortal(
    <>
      {renderZone(
        'lower',
        lower,
        rects.lower,
        sideZoneHold.lower,
        lower != null ? `Between ${lower} & ${rangeLabel}` : ''
      )}
      {renderZone(
        'higher',
        higher,
        rects.higher,
        sideZoneHold.higher,
        higher != null ? `Between ${rangeLabel} & ${higher}` : ''
      )}
    </>,
    document.body
  );
};

/** The card image that follows the pointer while dragging */
const FloatingCard: React.FC<{
  dragState: DragState;
  sideZoneHold: { lower: number; higher: number };
  pointOptions: number[];
}> = ({ dragState, sideZoneHold, pointOptions }) => {
  const holdPrefs = useBetweenHoldAnimationPrefs();
  const p = Math.max(sideZoneHold.lower, sideZoneHold.higher);
  const h = dragState.betweenHighPoints;
  const draggingPreMixed = h != null && h !== dragState.points;
  const { pairMin, pairMax } = pairBoundsFromDragState(dragState);

  const { lower: lowerNeighbor, higher: higherNeighbor } = neighborsOutsideDragPair(
    pointOptions,
    dragState
  );

  let betweenLow = pairMin;
  let betweenHigh = pairMax;
  if (sideZoneHold.lower > 0 && lowerNeighbor != null) {
    betweenLow = Math.min(lowerNeighbor, pairMin);
    betweenHigh = Math.max(lowerNeighbor, pairMax);
  } else if (sideZoneHold.higher > 0 && higherNeighbor != null) {
    betweenLow = Math.min(higherNeighbor, pairMin);
    betweenHigh = Math.max(higherNeighbor, pairMax);
  }

  const betweenPairActive = p > 0.04 && betweenLow !== betweenHigh;
  const showBetweenWipe = holdPrefs.floatingBetweenWipe && betweenPairActive;
  const showBetweenCrossfade =
    holdPrefs.floatingBetweenPreview && !holdPrefs.floatingBetweenWipe && betweenPairActive;
  const showBetweenLayer = showBetweenWipe || showBetweenCrossfade;
  const wipeZone: 'lower' | 'higher' =
    sideZoneHold.lower >= sideZoneHold.higher ? 'lower' : 'higher';
  const pad = 14;
  const sw = dragState.cardWidth + pad * 2;
  const sh = dragState.cardHeight + pad * 2;
  const ringR = Math.min(dragState.cardWidth, dragState.cardHeight) * 0.52;
  const ringCirc = 2 * Math.PI * ringR;
  const ringDashOffset = ringCirc * (1 - p);

  const wiggleOn = holdPrefs.floatingWiggle && p > 0;

  return ReactDOM.createPortal(
    <div
      className={`pointer-events-none fixed ${wiggleOn ? 'motion-reduce:animate-none animate-drag-charge-wiggle' : ''}`}
      style={{
        left: dragState.x - dragState.cardWidth / 2 - pad,
        top: dragState.y - dragState.cardHeight * 0.7 - pad,
        width: sw,
        height: sh,
        transition: 'none',
        zIndex: holdPrefs.floatingCardAboveSideZones ? 10020 : 10010,
      }}
    >
      {holdPrefs.floatingProgressRing && (
        <svg
          className="absolute overflow-visible text-primary"
          width={sw}
          height={sh}
          aria-hidden
        >
          <circle
            cx={sw / 2}
            cy={sh / 2}
            r={ringR}
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeDasharray={`${ringCirc} ${ringCirc}`}
            strokeDashoffset={ringDashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${sw / 2} ${sh / 2})`}
            className="opacity-90 drop-shadow-sm"
            style={{ opacity: p > 0 ? 0.95 : 0 }}
          />
        </svg>
      )}
      <div
        className="absolute flex items-center justify-center"
        style={{
          left: pad,
          top: pad,
          width: dragState.cardWidth,
          height: dragState.cardHeight,
        }}
      >
        <div className="relative h-full w-full">
          <div
            className="relative h-full w-full"
            style={{
              transform: 'rotate(-5deg) scale(1.15)',
              transformOrigin: 'center center',
              filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.4))',
            }}
          >
            {showBetweenLayer && (
              <div
                className="absolute inset-0 z-[1]"
                style={
                  showBetweenCrossfade ? { opacity: Math.min(1, p * 1.15) } : { opacity: 1 }
                }
              >
                <BetweenCard lowPoints={betweenLow} highPoints={betweenHigh} />
              </div>
            )}
            {showBetweenWipe &&
              (draggingPreMixed ? (
                <div
                  className="pointer-events-none absolute inset-0 z-[2] h-full w-full overflow-hidden"
                  style={{
                    clipPath: diagonalBetweenWipeClipPath(p * BETWEEN_WIPE_PROGRESS_SCALE, wipeZone),
                  }}
                >
                  <BetweenCard lowPoints={pairMin} highPoints={pairMax} />
                </div>
              ) : (
                <img
                  src={getCardImage(dragState.points)}
                  alt={`${dragState.points} points`}
                  className="pointer-events-none absolute inset-0 z-[2] h-full w-full object-contain"
                  style={{
                    imageRendering: 'pixelated',
                    clipPath: diagonalBetweenWipeClipPath(p * BETWEEN_WIPE_PROGRESS_SCALE, wipeZone),
                  }}
                />
              ))}
            {showBetweenCrossfade &&
              !showBetweenWipe &&
              (draggingPreMixed ? (
                <div
                  className="pointer-events-none absolute inset-0 z-[2] h-full w-full"
                  style={{ opacity: Math.max(0.15, 1 - p * 0.92) }}
                >
                  <BetweenCard lowPoints={pairMin} highPoints={pairMax} />
                </div>
              ) : (
                <img
                  src={getCardImage(dragState.points)}
                  alt={`${dragState.points} points`}
                  className="pointer-events-none absolute inset-0 z-[2] h-full w-full object-contain"
                  style={{
                    imageRendering: 'pixelated',
                    opacity: Math.max(0.15, 1 - p * 0.92),
                  }}
                />
              ))}
            {!showBetweenLayer && draggingPreMixed && (
              <BetweenCard
                lowPoints={pairMin}
                highPoints={pairMax}
                className="relative z-0 h-full w-full"
              />
            )}
            {!showBetweenLayer && !draggingPreMixed && (
              <img
                src={getCardImage(dragState.points)}
                alt={`${dragState.points} points`}
                className="relative z-0 h-full w-full object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
            )}
          </div>
        </div>
      </div>
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
      className={`absolute inset-0 z-[5] flex items-center justify-center rounded-xl border-2 border-dashed transition-all duration-200 ${
        ctx.isOverDropZone
          ? 'border-primary bg-primary/20 backdrop-blur-sm'
          : 'border-muted-foreground/40 bg-muted/10 backdrop-blur-[2px]'
      }`}
    >
      <div
        className={`flex flex-col items-center gap-2 transition-all duration-200 ${
          ctx.isOverDropZone ? 'scale-110' : 'scale-100'
        }`}
      >
        <div
          className={`rounded-full p-3 ${
            ctx.isOverDropZone ? 'bg-primary/30' : 'bg-muted/30'
          }`}
        >
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
        <span
          className={`text-sm font-semibold ${
            ctx.isOverDropZone ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          {ctx.isOverDropZone ? 'Release to lock in!' : 'Drop card here'}
        </span>
      </div>
    </div>
  );
};
