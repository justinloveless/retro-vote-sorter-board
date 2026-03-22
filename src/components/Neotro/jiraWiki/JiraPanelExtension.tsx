import { Node, mergeAttributes } from '@tiptap/core';
import {
  NodeViewWrapper,
  NodeViewContent,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from '@tiptap/react';
import { Card, CardContent } from '@/components/ui/card';
import { ensurePanelContrast } from '@/lib/jiraWiki/panelColors';

function JiraPanelView(props: NodeViewProps) {
  const attrs = String(props.node.attrs.panelAttrs ?? '');
  const bgMatch = attrs.match(/bgColor=([#\w]+)/);
  const bgColor = bgMatch ? bgMatch[1] : undefined;
  return (
    <NodeViewWrapper className="jira-panel-nodeview my-3">
      <Card
        className="border overflow-hidden"
        style={bgColor ? { backgroundColor: ensurePanelContrast(bgColor) } : undefined}
      >
        <CardContent className="p-4">
          <NodeViewContent className="[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[1.25rem] [&_p]:my-1 [&_h1]:mt-2 [&_h2]:mt-2" />
        </CardContent>
      </Card>
    </NodeViewWrapper>
  );
}

export const JiraPanelExtension = Node.create({
  name: 'jiraPanel',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      panelAttrs: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-jira-panel]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-jira-panel': 'true' }), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(JiraPanelView);
  },
});
