// Minimal stub for `@atlaskit/editor-common/validator`.
// These helpers are used for mark ordering/merging in Atlaskit renderer.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMarksByOrder(marks: any[]): any[] {
  return Array.isArray(marks) ? marks : [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isSameMark(a: any, b: any): boolean {
  try {
    if (a?.eq && typeof a.eq === 'function') return !!a.eq(b);
  } catch {
    // ignore
  }
  return a?.type === b?.type;
}

