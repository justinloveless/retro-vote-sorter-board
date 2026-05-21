// Re-export the real @atlaskit/editor-common/code-block plus a missing helper
// (getDefaultCodeBlockAttrs) that newer editor-plugin-block-menu expects but the
// installed editor-common version does not export.
export * from '@atlaskit/editor-common/dist/esm/code-block/index.js';

export function getDefaultCodeBlockAttrs() {
  return { language: null, uniqueId: null };
}

// No-op pass-through used by paste-options-toolbar to wrap markdown code-block slices.
// Returning the input unchanged is safe — we just don't perform the wrapping transform.
export function defaultWrapForMarkdownCodeBlocksInSlice<T>(slice: T): T {
  return slice;
}

// Newer editor-plugin-code-block toolbar reads these prefs; default to false so the
// toolbar renders without line numbers / word-wrap toggles being active.
export function areCodeBlockLineNumbersVisible(_state?: unknown): boolean {
  return false;
}

export function isCodeBlockWordWrapEnabled(_state?: unknown): boolean {
  return false;
}
