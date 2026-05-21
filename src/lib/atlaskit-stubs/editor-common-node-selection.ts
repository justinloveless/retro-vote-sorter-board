// Stub for @atlaskit/editor-common/node-selection (not present in installed version).
// editor-plugin-block-controls expects selectNodeAtPos; provide a safe no-op.
export function selectNodeAtPos(tr: any, _pos: number) {
  return tr;
}
