import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import type { UploadImageFn } from '@/hooks/usePokerSessionChat';
import { RICH_TEXT_EDITOR_CLASS } from '@/lib/richTextDisplay';
import { MarkdownLink, tryPasteMarkdownLinks } from '@/lib/tiptapMarkdownLink';

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  uploadImage: UploadImageFn;
}

export const TiptapEditor: React.FC<TiptapEditorProps> = ({
  content,
  onChange,
  onSubmit,
  placeholder,
  uploadImage,
}) => {
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        strike: false,
        code: {},
        codeBlock: {},
        blockquote: false,
        horizontalRule: false,
      }),
      MarkdownLink,
      Image.configure({
        inline: true,
        allowBase64: false,
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Type a message...',
      }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: RICH_TEXT_EDITOR_CLASS,
      },
      handleKeyDown: (view, event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          onSubmit();
          return true;
        }
        return false;
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        const imageItem = Array.from(items).find(item => item.type.startsWith('image/'));

        if (imageItem) {
          event.preventDefault();
          const file = imageItem.getAsFile();
          if (!file || !uploadImage) return true;

          uploadImage(file).then(url => {
            if (url) {
              const { tr } = view.state;
              const node = view.state.schema.nodes.image.create({ src: url });
              view.dispatch(tr.replaceSelectionWith(node));
            }
          });
          return true;
        }

        if (
          tryPasteMarkdownLinks(event, (html) => {
            editorRef.current?.commands.insertContent(html);
          })
        ) {
          return true;
        }

        return false;
      },
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.getHTML() !== content) {
      editor.commands.setContent(content, false);
    }
  }, [content, editor]);

  return <EditorContent editor={editor} />;
};
