/**
 * Deterministic Tailwind class sets for parent-issue badges (same parent key → same colors).
 */
const TONES = [
  'bg-rose-100 text-rose-900 border-rose-200/90 dark:bg-rose-950/45 dark:text-rose-100 dark:border-rose-800/70',
  'bg-orange-100 text-orange-900 border-orange-200/90 dark:bg-orange-950/45 dark:text-orange-100 dark:border-orange-800/70',
  'bg-amber-100 text-amber-950 border-amber-200/90 dark:bg-amber-950/45 dark:text-amber-100 dark:border-amber-800/70',
  'bg-lime-100 text-lime-950 border-lime-200/90 dark:bg-lime-950/40 dark:text-lime-100 dark:border-lime-800/70',
  'bg-emerald-100 text-emerald-900 border-emerald-200/90 dark:bg-emerald-950/45 dark:text-emerald-100 dark:border-emerald-800/70',
  'bg-cyan-100 text-cyan-900 border-cyan-200/90 dark:bg-cyan-950/45 dark:text-cyan-100 dark:border-cyan-800/70',
  'bg-sky-100 text-sky-900 border-sky-200/90 dark:bg-sky-950/45 dark:text-sky-100 dark:border-sky-800/70',
  'bg-indigo-100 text-indigo-900 border-indigo-200/90 dark:bg-indigo-950/45 dark:text-indigo-100 dark:border-indigo-800/70',
  'bg-violet-100 text-violet-900 border-violet-200/90 dark:bg-violet-950/45 dark:text-violet-100 dark:border-violet-800/70',
  'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200/90 dark:bg-fuchsia-950/45 dark:text-fuchsia-100 dark:border-fuchsia-800/70',
  'bg-pink-100 text-pink-900 border-pink-200/90 dark:bg-pink-950/45 dark:text-pink-100 dark:border-pink-800/70',
  'bg-teal-100 text-teal-900 border-teal-200/90 dark:bg-teal-950/45 dark:text-teal-100 dark:border-teal-800/70',
] as const;

function hash32(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Stable classes for a parent issue key (siblings share the same badge colors). */
export function parentBadgeClassName(parentKey: string): string {
  return TONES[hash32(parentKey) % TONES.length];
}
