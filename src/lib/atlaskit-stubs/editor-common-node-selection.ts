// Stub for @atlaskit/editor-common/node-selection when the subpath is absent from the installed package.
import { NodeSelection } from '@atlaskit/editor-prosemirror/state';
import { selectTableClosestToPos } from '@atlaskit/editor-tables/utils';

export function getNodeSelectionForPos(doc: { nodeAt: (pos: number) => { type: { name: string }; childCount: number } | null; resolve: (pos: number) => unknown }, start: number) {
  const node = doc.nodeAt(start);
  if (!node) {
    return false;
  }
  if (node.type.name === 'mediaGroup' && node.childCount === 1) {
    return new NodeSelection(doc.resolve(start + 1) as ConstructorParameters<typeof NodeSelection>[0]);
  }
  return new NodeSelection(doc.resolve(start) as ConstructorParameters<typeof NodeSelection>[0]);
}

export function selectTableNodeAtPos(tr: { doc: { resolve: (pos: number) => unknown } }, tableNodePos: number) {
  selectTableClosestToPos(tr as Parameters<typeof selectTableClosestToPos>[0], tr.doc.resolve(tableNodePos + 1) as Parameters<typeof selectTableClosestToPos>[1]);
  return tr;
}

export function selectNodeAtPos(
  tr: { doc: Parameters<typeof getNodeSelectionForPos>[0]; setSelection: (sel: NodeSelection) => void },
  nodePos: number,
  nodeType?: string,
) {
  if (nodeType === 'table') {
    return selectTableNodeAtPos(tr, nodePos);
  }
  const selection = getNodeSelectionForPos(tr.doc, nodePos);
  if (selection) {
    tr.setSelection(selection);
  }
  return tr;
}
