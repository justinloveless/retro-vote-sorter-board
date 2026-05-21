// Re-export real @atlaskit/editor-common/table plus missing helpers used by newer
// @atlaskit/editor-plugin-table that aren't published in the installed version.
export * from '@atlaskit/editor-common/dist/esm/table/index.js';

// Newer plugin expects this helper; safe fallback returns false so plugin treats
// the table as not-yet-resized (no-op for measurement transforms).
export function hasTableBeenResized(_node: unknown): boolean {
  return false;
}

export function isTableInContentMode(_node: unknown): boolean {
  return false;
}

