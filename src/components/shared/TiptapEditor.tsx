import React, { useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { usePokerSessionChat } from '@/hooks/usePokerSessionChat';

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  uploadImage: ReturnType<typeof usePokerSessionChat>['uploadImage'];
}

export const TiptapEditor: React.FC<TiptapEditorProps> = ({
  content,
  onChange,
  onSubmit,
  placeholder,
  uploadImage,
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        strike: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Link.configure({
        openOnClick: true,
        autolink: true,
        linkOnPaste: true,
        validate: href => /^https?:\/\//.test(href),
      }),
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
        class: 'prose dark:prose-invert min-w-full max-w-full focus:outline-none p-2 rounded-md border border-input min-h-[40px] max-h-[120px] overflow-y-auto text-sm',
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
        return false;
      },
    },
  });

  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.getHTML() !== content) {
      editor.commands.setContent(content, false);
    }
  }, [content, editor]);

  return <EditorContent editor={editor} />;
}; 