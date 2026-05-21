// Re-export real @atlaskit/editor-common/transforms plus missing helpers
// referenced by newer @atlaskit/editor-plugin-paste.
export * from '@atlaskit/editor-common/dist/esm/transforms/index.js';

// Identity fallback: don't restructure list-item paragraphs on paste.
export function transformSliceEnsureListItemParagraphFirst<T>(slice: T): T {
  return slice;
}
