export type BetweenHoldAnimationPrefs = {
  /** Side zone: clip-path fill showing hold progress */
  zoneProgressFill: boolean;
  /** Side zone: "Ns — hold" pill above zone */
  zoneCountdownPill: boolean;
  /** Floating drag card: SVG ring around hold progress */
  floatingProgressRing: boolean;
  /** Floating drag card: horizontal wiggle while holding */
  floatingWiggle: boolean;
  /** Floating drag card: crossfade to split BetweenCard preview */
  floatingBetweenPreview: boolean;
  /** Floating drag card: horizontal wipe original → BetweenCard (takes precedence over crossfade when both on) */
  floatingBetweenWipe: boolean;
  /** When true, drag preview stacks above side zones; when false, side zones are on top. */
  floatingCardAboveSideZones: boolean;
};

/** Shipped between-hold feedback toggles (edit here to change behavior). */
export const BETWEEN_HOLD_ANIMATION_DEFAULTS: BetweenHoldAnimationPrefs = {
  zoneProgressFill: true,
  zoneCountdownPill: true,
  floatingProgressRing: false,
  floatingWiggle: true,
  floatingBetweenPreview: false,
  floatingBetweenWipe: true,
  floatingCardAboveSideZones: true,
};

export function useBetweenHoldAnimationPrefs(): BetweenHoldAnimationPrefs {
  return BETWEEN_HOLD_ANIMATION_DEFAULTS;
}
