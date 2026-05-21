// Re-export the real @atlaskit/editor-common/code-block plus a missing helper
// (getDefaultCodeBlockAttrs) that newer editor-plugin-block-menu expects but the
// installed editor-common version does not export.
export * from '@atlaskit/editor-common/dist/esm/code-block/index.js';

export function getDefaultCodeBlockAttrs() {
  return { language: null, uniqueId: null };
}
