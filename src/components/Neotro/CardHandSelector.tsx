import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Info } from "lucide-react";
import { getCardImage } from "./PlayingCards/cardImage";
import BetweenCard from "./PlayingCards/BetweenCard";
import LockInButton from "./LockInButton";
import AbstainButton from "./AbstainButton";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIsCompactViewport } from "@/hooks/use-compact-viewport";
import { useDragToPlay } from "./DragToPlay";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const COMBINE_ANIM_MS = 620;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function adjacentInDeck(deck: number[], a: number, b: number): boolean {
  const i = deck.indexOf(a);
  const j = deck.indexOf(b);
  if (i < 0 || j < 0) return false;
  return Math.abs(i - j) === 1;
}

/** World (viewport) delta → extra translate in slot inner space before outer `rotate(θ) translateY(...)`. */
function worldDeltaToSlotInnerLocal(wdx: number, wdy: number, slotRotateDeg: number): { lx: number; ly: number } {
  const th = (slotRotateDeg * Math.PI) / 180;
  const cos = Math.cos(th);
  const sin = Math.sin(th);
  return {
    lx: wdx * cos + wdy * sin,
    ly: -wdx * sin + wdy * cos,
  };
}

interface CardHandSelectorProps {
  selectedPoints: number;
  betweenHighPoints?: number;
  pointOptions: number[];
  onSelectPoints: (points: number) => void;
  onSelectBetween: (low: number, high: number) => void;
  onLockIn: () => void;
  isLockedIn: boolean;
  onAbstain: () => void;
  isAbstained: boolean;
  isAbstainedDisabled: boolean;
  /** Team-defined labels; legend shows when at least one entry applies to pointOptions. */
  pointValueDescriptions?: Record<number, string>;
}

const CardHandSelector: React.FC<CardHandSelectorProps> = ({
  selectedPoints,
  betweenHighPoints,
  pointOptions,
  onSelectPoints,
  onSelectBetween,
  onLockIn,
  isLockedIn,
  onAbstain,
  isAbstained,
  isAbstainedDisabled,
  pointValueDescriptions,
}) => {
  const isMobile = useIsMobile();
  const isCompact = useIsCompactViewport();
  const dragCtx = useDragToPlay();
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  /** First card when using two Shift-clicks without a prior single selection (desktop). */
  const shiftBetweenAnchorRef = useRef<number | null>(null);
  /** Shift held at pointer down (pointerup may not see Shift if released early). */
  const shiftHeldAtPointerDownRef = useRef(false);

  const skipCombineIntroMountRef = useRef(true);
  const prevBetweenPairAdjacentRef = useRef(false);
  const combineLiftDeckIndexRef = useRef<number | null>(null);
  /** Deck-index → outer slot wrapper (unmerged hand) for FLIP measure. */
  const combineSlotRefs = useRef<Record<number, HTMLDivElement | null>>({});

  type BetweenCombinePhase = {
    lo: number;
    hi: number;
    loLift: number;
    hiLift: number;
  };
  const [betweenCombine, setBetweenCombine] = useState<BetweenCombinePhase | null>(null);
  const [combineMotion, setCombineMotion] = useState<{
    lo: { tx: number; ty: number; tr: number };
    hi: { tx: number; ty: number; tr: number };
    targetVP: { x: number; y: number };
    rotMerged: number;
  } | null>(null);
  const [combineMotionPlay, setCombineMotionPlay] = useState(false);

  const selectedDescriptionText = useMemo(() => {
    if (!pointValueDescriptions || isAbstained || selectedPoints === -1) return null;
    const descFor = (p: number) => {
      const t = pointValueDescriptions[p];
      return typeof t === "string" ? t.trim() : "";
    };
    if (betweenHighPoints != null && betweenHighPoints !== selectedPoints) {
      const low = Math.min(selectedPoints, betweenHighPoints);
      const high = Math.max(selectedPoints, betweenHighPoints);
      const a = descFor(low);
      const b = descFor(high);
      if (!a && !b) return null;
      if (a && b) return `${a} · ${b}`;
      return a || b;
    }
    if (!pointOptions.includes(selectedPoints)) return null;
    const single = descFor(selectedPoints);
    return single || null;
  }, [
    pointValueDescriptions,
    isAbstained,
    selectedPoints,
    betweenHighPoints,
    pointOptions,
  ]);

  const legendEl = selectedDescriptionText ? (
    <p className="text-muted-foreground max-w-lg px-2 text-center text-xs leading-relaxed">
      {selectedDescriptionText}
    </p>
  ) : null;

  const maxFanAngle = isMobile ? 30 : 40;
  const cardWidth = isMobile ? 48 : 64;
  const cardHeight = isMobile ? 64 : 86;
  const cardSpacing = -Math.round(cardWidth / 3);

  const DRAG_THRESHOLD = 8;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isAbstained || isLockedIn) return;
      shiftHeldAtPointerDownRef.current = e.shiftKey;
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      isDragging.current = false;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [isAbstained, isLockedIn]
  );

  const handlePointerMove = useCallback(
    (
      points: number,
      e: React.PointerEvent,
      dragVisualWidth?: number,
      dragVisualHeight?: number,
      betweenHighForDrag?: number
    ) => {
      if (!dragStartPos.current || !dragCtx) return;
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (!isDragging.current && dist >= DRAG_THRESHOLD) {
        isDragging.current = true;
        const el = e.currentTarget as HTMLElement;
        const r = el.getBoundingClientRect();
        const originX = r.left + r.width / 2;
        const originY = r.top + r.height / 2;
        const w = dragVisualWidth ?? cardWidth * 1.3;
        const h = dragVisualHeight ?? cardHeight * 1.3;
        dragCtx.startDrag(
          points,
          e.clientX,
          e.clientY,
          w,
          h,
          originX,
          originY,
          betweenHighForDrag
        );
      }
      if (isDragging.current) {
        dragCtx.updateDrag(e.clientX, e.clientY);
      }
    },
    [dragCtx, cardWidth, cardHeight]
  );

  const handlePointerUp = useCallback(
    (points: number, e: React.PointerEvent) => {
      if (isDragging.current && dragCtx) {
        dragCtx.endDrag();
      } else if (dragStartPos.current && !isAbstained && !isLockedIn) {
        const canUseShiftBetween = !isMobile && shiftHeldAtPointerDownRef.current;

        if (canUseShiftBetween && shiftBetweenAnchorRef.current === null) {
          const hasSingleSelection = betweenHighPoints == null;
          if (
            hasSingleSelection &&
            points !== selectedPoints &&
            adjacentInDeck(pointOptions, selectedPoints, points)
          ) {
            combineLiftDeckIndexRef.current = pointOptions.indexOf(selectedPoints);
            onSelectBetween(
              Math.min(selectedPoints, points),
              Math.max(selectedPoints, points)
            );
          } else {
            shiftBetweenAnchorRef.current = points;
            onSelectPoints(points);
          }
        } else if (shiftBetweenAnchorRef.current !== null) {
          const anchor = shiftBetweenAnchorRef.current;
          if (adjacentInDeck(pointOptions, anchor, points)) {
            const low = Math.min(anchor, points);
            const high = Math.max(anchor, points);
            combineLiftDeckIndexRef.current = pointOptions.indexOf(anchor);
            onSelectBetween(low, high);
          } else {
            onSelectPoints(points);
          }
          shiftBetweenAnchorRef.current = null;
        } else {
          shiftBetweenAnchorRef.current = null;
          onSelectPoints(points);
        }
      }
      dragStartPos.current = null;
      isDragging.current = false;
      shiftHeldAtPointerDownRef.current = false;
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    },
    [
      dragCtx,
      isAbstained,
      isLockedIn,
      isMobile,
      betweenHighPoints,
      selectedPoints,
      onSelectBetween,
      onSelectPoints,
      pointOptions,
    ]
  );

  const hasBetweenSelection = betweenHighPoints != null;
  const betweenLowIdx = hasBetweenSelection ? pointOptions.indexOf(selectedPoints) : -1;
  const betweenHighIdx =
    hasBetweenSelection && betweenHighPoints != null
      ? pointOptions.indexOf(betweenHighPoints)
      : -1;

  const betweenPairAdjacent =
    hasBetweenSelection &&
    betweenLowIdx >= 0 &&
    betweenHighIdx >= 0 &&
    betweenLowIdx !== betweenHighIdx &&
    Math.abs(betweenLowIdx - betweenHighIdx) === 1;

  useEffect(() => {
    if (skipCombineIntroMountRef.current) {
      skipCombineIntroMountRef.current = false;
      prevBetweenPairAdjacentRef.current = betweenPairAdjacent;
      return;
    }
    if (!betweenPairAdjacent) {
      setBetweenCombine(null);
      setCombineMotion(null);
      setCombineMotionPlay(false);
      prevBetweenPairAdjacentRef.current = false;
      return;
    }
    if (
      betweenPairAdjacent &&
      !prevBetweenPairAdjacentRef.current &&
      !prefersReducedMotion()
    ) {
      prevBetweenPairAdjacentRef.current = true;
      const lo = Math.min(betweenLowIdx, betweenHighIdx);
      const hi = Math.max(betweenLowIdx, betweenHighIdx);
      const liftIdx = combineLiftDeckIndexRef.current;
      combineLiftDeckIndexRef.current = null;
      setBetweenCombine({
        lo,
        hi,
        loLift: liftIdx === lo ? -20 : 0,
        hiLift: liftIdx === hi ? -20 : 0,
      });
      const t = window.setTimeout(() => {
        setBetweenCombine(null);
        setCombineMotion(null);
        setCombineMotionPlay(false);
      }, COMBINE_ANIM_MS);
      return () => window.clearTimeout(t);
    }
    prevBetweenPairAdjacentRef.current = betweenPairAdjacent;
  }, [betweenPairAdjacent, betweenHighIdx, betweenLowIdx]);

  useLayoutEffect(() => {
    if (!betweenCombine) {
      setCombineMotion(null);
      setCombineMotionPlay(false);
      return;
    }
    setCombineMotionPlay(false);
    let cancelled = false;
    const run = () => {
      const { lo, hi } = betweenCombine;
      const elLo = combineSlotRefs.current[lo];
      const elHi = combineSlotRefs.current[hi];
      if (!elLo || !elHi) return;
      const rLo = elLo.getBoundingClientRect();
      const rHi = elHi.getBoundingClientRect();
      const n = pointOptions.length;
      const angleStepBefore = n > 1 ? maxFanAngle / (n - 1) : 0;
      const rotBefore = (i: number) => -maxFanAngle / 2 + angleStepBefore * i;
      const nAfter = n - 1;
      const angleStepAfter = nAfter > 1 ? maxFanAngle / (nAfter - 1) : 0;
      const rotMerged = -maxFanAngle / 2 + angleStepAfter * lo;
      const bcLo = { x: rLo.left + rLo.width / 2, y: rLo.bottom };
      const bcHi = { x: rHi.left + rHi.width / 2, y: rHi.bottom };
      const target = { x: (bcLo.x + bcHi.x) / 2, y: (bcLo.y + bcHi.y) / 2 };
      const wdxLo = target.x - bcLo.x;
      const wdyLo = target.y - bcLo.y;
      const wdxHi = target.x - bcHi.x;
      const wdyHi = target.y - bcHi.y;
      const rL = rotBefore(lo);
      const rH = rotBefore(hi);
      const { lx: lxLo, ly: lyLo } = worldDeltaToSlotInnerLocal(wdxLo, wdyLo, rL);
      const { lx: lxHi, ly: lyHi } = worldDeltaToSlotInnerLocal(wdxHi, wdyHi, rH);
      if (cancelled) return;
      setCombineMotion({
        lo: { tx: lxLo, ty: lyLo, tr: rotMerged - rL },
        hi: { tx: lxHi, ty: lyHi, tr: rotMerged - rH },
        targetVP: target,
        rotMerged,
      });
      requestAnimationFrame(() => {
        if (!cancelled) setCombineMotionPlay(true);
      });
    };
    requestAnimationFrame(() => requestAnimationFrame(run));
    return () => {
      cancelled = true;
    };
  }, [betweenCombine, maxFanAngle, pointOptions.length]);

  /** Footprint of the two merged fan slots plus a little air for the diagonal split. */
  const betweenSlotWidth =
    cardWidth * 2 + cardSpacing + Math.round(cardWidth * 0.15);

  type FanEntry =
    | { kind: "single"; points: number; index: number }
    | {
        kind: "between";
        low: number;
        high: number;
      };

  const showMergedBetweenSlot =
    betweenPairAdjacent && betweenHighPoints != null && betweenCombine == null;

  const visibleHand: FanEntry[] = (() => {
    if (!showMergedBetweenSlot) {
      return pointOptions.map((points, index) => ({ kind: "single" as const, points, index }));
    }
    const lo = Math.min(betweenLowIdx, betweenHighIdx);
    const hi = Math.max(betweenLowIdx, betweenHighIdx);
    const out: FanEntry[] = [];
    let i = 0;
    while (i < pointOptions.length) {
      if (i === lo) {
        out.push({
          kind: "between",
          low: selectedPoints,
          high: betweenHighPoints,
        });
        i = hi + 1;
      } else {
        out.push({ kind: "single", points: pointOptions[i], index: i });
        i += 1;
      }
    }
    return out;
  })();

  const visibleCount = visibleHand.length;

  const betweenLowVal =
    betweenHighPoints != null ? Math.min(selectedPoints, betweenHighPoints) : selectedPoints;
  const betweenHighVal =
    betweenHighPoints != null ? Math.max(selectedPoints, betweenHighPoints) : selectedPoints;

  const fan = (
    <div
      className={`relative flex items-end justify-center ${isCompact ? "" : "mb-4"}`}
      style={{ height: cardHeight + 30 }}
    >
      {betweenCombine != null && combineMotion != null && betweenHighPoints != null && (
        <div
          className="motion-reduce:hidden pointer-events-none fixed z-[10050]"
          style={{
            left: combineMotion.targetVP.x - betweenSlotWidth / 2,
            top: combineMotion.targetVP.y - cardHeight,
            width: betweenSlotWidth,
            height: cardHeight,
            transform: `rotate(${combineMotion.rotMerged}deg) translateY(-20px)`,
            transformOrigin: "bottom center",
            opacity: combineMotionPlay ? 1 : 0,
            transition: "opacity 280ms ease-out 320ms",
          }}
        >
          <BetweenCard lowPoints={betweenLowVal} highPoints={betweenHighVal} />
        </div>
      )}
      {visibleHand.map((entry, fanIndex) => {
        const isBetweenSlot = entry.kind === "between";
        const dragPoints = isBetweenSlot ? entry.low : entry.points;
        const deckIndex = entry.kind === "single" ? entry.index : -1;
        const betweenHighForDrag =
          entry.kind === "between"
            ? entry.high
            : entry.points === selectedPoints && betweenHighPoints != null
              ? betweenHighPoints
              : undefined;

        const inBetweenPair =
          betweenPairAdjacent &&
          betweenHighPoints != null &&
          entry.kind === "single" &&
          (entry.points === selectedPoints || entry.points === betweenHighPoints);
        const isSelected =
          entry.kind === "between" ||
          inBetweenPair ||
          (entry.kind === "single" && selectedPoints === entry.points && betweenHighPoints == null);

        const isCombiningSlot =
          betweenCombine != null &&
          entry.kind === "single" &&
          (deckIndex === betweenCombine.lo || deckIndex === betweenCombine.hi);

        let liftY = 0;
        if (betweenCombine && entry.kind === "single") {
          if (deckIndex === betweenCombine.lo) liftY = betweenCombine.loLift;
          else if (deckIndex === betweenCombine.hi) liftY = betweenCombine.hiLift;
        } else if (isSelected) {
          liftY = -20;
        }

        const isDisabled = isAbstained || isLockedIn;
        const ds = dragCtx?.dragState;
        const isBeingDragged =
          ds != null &&
          ds.points === dragPoints &&
          (betweenHighForDrag === undefined
            ? ds.betweenHighPoints == null
            : ds.betweenHighPoints === betweenHighForDrag);

        const slotWidth = isBetweenSlot ? betweenSlotWidth : cardWidth;

        const angleStep = visibleCount > 1 ? maxFanAngle / (visibleCount - 1) : 0;
        const rotation = -maxFanAngle / 2 + angleStep * fanIndex;

        const motion =
          combineMotion != null && entry.kind === "single"
            ? deckIndex === betweenCombine?.lo
              ? combineMotion.lo
              : deckIndex === betweenCombine?.hi
                ? combineMotion.hi
                : null
            : null;

        const innerCombineWrapperStyle: React.CSSProperties = {
          width: "100%",
          height: "100%",
          transformOrigin: "bottom center",
          ...(combineMotion && motion
            ? {
                transform: combineMotionPlay
                  ? `translate3d(${motion.tx}px, ${motion.ty}px, 0) rotate(${motion.tr}deg)`
                  : "translate3d(0, 0, 0) rotate(0deg)",
                transition: "transform 620ms cubic-bezier(0.22, 1, 0.36, 1)",
              }
            : {}),
        };

        const imgCombineOpacityStyle: React.CSSProperties =
          combineMotion != null && isCombiningSlot
            ? {
                opacity: combineMotionPlay ? 0 : 1,
                transition: "opacity 260ms ease-out 360ms",
                imageRendering: "pixelated",
              }
            : { imageRendering: "pixelated" };

        return (
          <div
            key={isBetweenSlot ? `between-${entry.low}-${entry.high}` : entry.points}
            ref={(el) => {
              if (entry.kind === "single") {
                combineSlotRefs.current[entry.index] = el;
              }
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={(e) =>
              handlePointerMove(
                dragPoints,
                e,
                isBetweenSlot ? betweenSlotWidth * 1.1 : undefined,
                undefined,
                betweenHighForDrag
              )
            }
            onPointerUp={(e) => handlePointerUp(dragPoints, e)}
            className={`relative flex-shrink-0 select-none ${
              betweenCombine ? "" : "transition-all duration-300 ease-out"
            } ${isDisabled ? "opacity-60 cursor-not-allowed" : "cursor-grab active:cursor-grabbing"} ${
              isBeingDragged ? "opacity-30 scale-90" : ""
            } ${isCombiningSlot ? "pointer-events-none" : ""}`}
            style={{
              width: slotWidth,
              height: cardHeight,
              marginLeft: fanIndex > 0 ? cardSpacing : 0,
              transform: `rotate(${rotation}deg) translateY(${liftY}px)`,
              transformOrigin: "bottom center",
              zIndex: isCombiningSlot ? 50 : fanIndex,
              filter: isSelected ? "drop-shadow(0 0 12px rgba(52, 152, 219, 0.8))" : "none",
              touchAction: "none",
              ...(betweenCombine ? { transition: "none" } : {}),
            }}
          >
            {isBetweenSlot ? (
              <div
                className={`relative h-full w-full transition-transform duration-200 pointer-events-none ${
                  !isDisabled ? "hover:-translate-y-2" : ""
                }`}
              >
                <BetweenCard lowPoints={entry.low} highPoints={entry.high} />
              </div>
            ) : isCombiningSlot ? (
              <div style={innerCombineWrapperStyle}>
                <img
                  src={getCardImage(entry.points)}
                  alt={`${entry.points} points`}
                  className={`h-full w-full object-contain pointer-events-none ${
                    !isDisabled && !isSelected ? "hover:-translate-y-2" : ""
                  }`}
                  style={imgCombineOpacityStyle}
                  draggable={false}
                />
              </div>
            ) : (
              <img
                src={getCardImage(entry.points)}
                alt={`${entry.points} points`}
                className={`h-full w-full object-contain transition-transform duration-200 pointer-events-none ${
                  !isDisabled && !isSelected ? "hover:-translate-y-2" : ""
                }`}
                style={{
                  imageRendering: "pixelated",
                }}
                draggable={false}
              />
            )}
            {isSelected && !isBeingDragged && (
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-2 py-0.5 whitespace-nowrap">
                {entry.kind === "between"
                  ? `${entry.low}–${entry.high}`
                  : betweenHighPoints != null && inBetweenPair
                    ? `${betweenLowVal}–${betweenHighVal}`
                    : `${entry.points} pts`}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const abstainDisabledDesktop = isAbstainedDisabled;
  const abstainDisabledMobile = isAbstainedDisabled || isLockedIn;

  const lockIn = <LockInButton onLockIn={onLockIn} isLockedIn={isLockedIn} isDisabled={isAbstained} />;
  const abstain = (
    <AbstainButton
      onAbstain={onAbstain}
      isAbstained={isAbstained}
      isDisabled={isMobile ? abstainDisabledMobile : abstainDisabledDesktop}
    />
  );

  return (
    <div className="flex flex-col items-center justify-center font-custom">
      {(isMobile || isCompact) && legendEl ? (
        <div className="mb-2 w-full">{legendEl}</div>
      ) : null}
      {!isMobile && !isCompact && (
        <TooltipProvider delayDuration={200}>
          <div className="mb-2 flex flex-col items-center gap-1">
            <div className="flex items-center justify-center gap-2">
              <div className="text-foreground text-3xl font-neotro">Your Hand</div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label="How to vote between two values"
                  >
                    <Info className="h-4 w-4 shrink-0" strokeWidth={2} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-left">
                  <p className="text-xs leading-relaxed">
                    Select a card, then hold{" "}
                    <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
                      Shift
                    </kbd>{" "}
                    and click an adjacent card to vote between those values. Or hold{" "}
                    <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
                      Shift
                    </kbd>{" "}
                    and click twice on adjacent cards.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            {legendEl}
          </div>
        </TooltipProvider>
      )}

      {isCompact ? (
        isMobile ? (
          <div className="flex w-full max-w-full flex-col items-center gap-2 px-1">
            <div className="flex w-full justify-center">{fan}</div>
            <div className="flex w-full flex-wrap items-center justify-center gap-2">
              <div className="shrink-0 origin-bottom scale-[0.82] sm:scale-90">{lockIn}</div>
              <div className="shrink-0 origin-bottom scale-[0.82] sm:scale-90">{abstain}</div>
            </div>
          </div>
        ) : (
          <div className="flex w-full max-w-full flex-row items-end justify-center gap-1 px-1 sm:gap-2">
            <div className="shrink-0 origin-bottom scale-[0.82] sm:scale-90">{lockIn}</div>
            <div className="flex min-w-0 flex-1 items-end justify-center">{fan}</div>
            <div className="shrink-0 origin-bottom scale-[0.82] sm:scale-90">{abstain}</div>
          </div>
        )
      ) : (
        <>
          {fan}
          {isMobile ? (
            <div className="flex gap-3 justify-center w-full">
              {lockIn}
              {abstain}
            </div>
          ) : (
            <div className="flex items-center gap-4">
              {lockIn}
              {abstain}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CardHandSelector;
