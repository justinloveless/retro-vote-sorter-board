// Minimal stub for `@atlaskit/editor-common/utils`.
// Used by Atlaskit renderer to normalize extension handlers.
export function getExtensionRenderer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): (node: any, adfDocument?: any) => any {
  if (typeof handler === 'function') return handler;
  if (handler && typeof handler === 'object' && typeof handler.render === 'function') {
    return handler.render.bind(handler);
  }
  return () => null;
}

// Used for table layout; we don't need it for our usage.
// Returning `undefined` makes the renderer fall back to default behavior.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getColumnWidths(_tableNode: any): number[] | undefined {
  return undefined;
}

// Analytics helpers (no-op)
export function getAnalyticsAppearance() {
  return undefined;
}

export function getAnalyticsEventSeverity() {
  return undefined;
}

export function shouldForceTracking() {
  return false;
}

export function resolveOrder(order?: number): number | undefined {
  if (order == null) return undefined;
  const n = Math.floor(Number(order));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getItemCounterDigitsSize(opts: { order?: number; itemsCount?: any }): number | undefined {
  const start = resolveOrder(opts.order ?? 1) ?? 1;
  const count = typeof opts.itemsCount === 'number' ? opts.itemsCount : 0;
  const last = Math.max(start, start + Math.max(0, count - 1));
  return String(last).length;
}

