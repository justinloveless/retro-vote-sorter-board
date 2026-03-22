import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { wikiCommonToTiptapJSON, tiptapJSONToWikiCommon } from '@/lib/jiraWiki/wikiTiptapBridge';
import { JiraCodeBlock } from '@/lib/jiraWiki/jiraCodeBlockExtension';
import { JiraPanelExtension } from '@/components/Neotro/jiraWiki/JiraPanelExtension';
import { cn } from '@/lib/utils';

export interface JiraIssueWikiEditorProps {
  /** Wiki string used to initialize the editor (typically when entering edit mode). */
  initialValue: string;
  onChange: (wiki: string) => void;
  disabled?: boolean;
  className?: string;
}

export const JiraIssueWikiEditor: React.FC<JiraIssueWikiEditorProps> = ({
  initialValue,
  onChange,
  disabled,
  className,
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
      JiraCodeBlock,
      JiraPanelExtension,
      Link.configure({
        openOnClick: true,
        autolink: true,
        HTMLAttributes: { class: 'text-primary underline' },
      }),
      Placeholder.configure({
        placeholder: 'Add a description…',
      }),
    ],
    content: wikiCommonToTiptapJSON(initialValue),
    editable: !disabled,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none text-sm min-h-[160px] px-2 py-2 rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring',
          className,
        ),
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(tiptapJSONToWikiCommon(ed.getJSON()));
    },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  return <EditorContent editor={editor} />;
};
