import { Node, mergeAttributes } from '@tiptap/core';
import {
  NodeViewWrapper,
  NodeViewContent,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from '@tiptap/react';
import { Plugin } from 'prosemirror-state';
import { Fragment, Slice } from 'prosemirror-model';
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
  addProseMirrorPlugins() {
    const panelType = this.type;

    const isSelectionInsidePanel = (state: { selection: any }) => {
      const { $from } = state.selection;
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type === panelType) return true;
      }
      return false;
    };

    const unwrapPanelsInSlice = (slice: Slice): Slice => {
      // Replace any jiraPanel nodes in the slice with their inner content.
      // This keeps the copied text/blocks, but drops the outer panel wrapper.
      const unwrapFragment = (frag: Fragment): Fragment => {
        const out: Array<import('prosemirror-model').Node> = [];
        frag.forEach((child) => {
          if (child.type === panelType) {
            const inner = unwrapFragment(child.content);
            inner.forEach((n) => out.push(n));
          } else if (child.content && child.content.size) {
            out.push(child.copy(unwrapFragment(child.content)));
          } else {
            out.push(child);
          }
        });
        return Fragment.fromArray(out);
      };

      const nextContent = unwrapFragment(slice.content);
      return new Slice(nextContent, slice.openStart, slice.openEnd);
    };

    const hasNestedPanels = (doc: import('prosemirror-model').Node): boolean => {
      let nested = false;
      doc.descendants((node, pos) => {
        if (nested) return false;
        if (node.type !== panelType) return true;

        // If this panel has any panel ancestor, it's nested.
        const $pos = doc.resolve(pos);
        let panelAncestors = 0;
        for (let d = $pos.depth; d > 0; d--) {
          if ($pos.node(d).type === panelType) panelAncestors++;
          if (panelAncestors > 1) {
            nested = true;
            return false;
          }
        }
        return true;
      });
      return nested;
    };

    return [
      new Plugin({
        props: {
          // Prevent pasting a panel into a panel (unwrap pasted panel(s) first).
          transformPasted: (slice, view) => {
            if (!view) return slice;
            if (!isSelectionInsidePanel(view.state)) return slice;
            return unwrapPanelsInSlice(slice);
          },
          // Prevent copying a panel wrapper when copying from inside a panel.
          transformCopied: (slice, view) => {
            if (!view) return slice;
            if (!isSelectionInsidePanel(view.state)) return slice;
            return unwrapPanelsInSlice(slice);
          },
        },
        filterTransaction: (tr, state) => {
          // Allow non-doc-changing transactions.
          if (!tr.docChanged) return true;
          const next = state.apply(tr);
          // Hard guarantee: never allow a jiraPanel inside a jiraPanel.
          return !hasNestedPanels(next.doc);
        },
      }),
    ];
  },
});
