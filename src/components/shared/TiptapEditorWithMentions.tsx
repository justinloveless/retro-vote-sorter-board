import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import { Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { MentionSuggestions, type MentionSuggestionsRef } from './MentionSuggestions';
import type { UploadImageFn } from '../../hooks/usePokerSessionChat.ts';

interface TeamMember {
    id: string;
    user_id: string;
    profiles?: {
        full_name: string | null;
    } | null;
}

interface TiptapEditorWithMentionsProps {
    content: string;
    onChange: (content: string) => void;
    onSubmit: () => void;
    placeholder?: string;
    uploadImage?: UploadImageFn;
    teamMembers?: TeamMember[];
}

// Custom Mention extension for Tiptap
const Mention = Node.create({
    name: 'mention',

    group: 'inline',
    inline: true,
    selectable: false,
    atom: true,

    addAttributes() {
        return {
            userId: {
                default: null,
                parseHTML: element => element.getAttribute('data-user-id'),
                renderHTML: attributes => {
                    if (!attributes.userId) return {};
                    return { 'data-user-id': attributes.userId };
                },
            },
            name: {
                default: null,
                parseHTML: element => element.getAttribute('data-name'),
                renderHTML: attributes => {
                    if (!attributes.name) return {};
                    return { 'data-name': attributes.name };
                },
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-mention-id]',
                getAttrs: element => {
                    const userId = element.getAttribute('data-mention-id') || element.getAttribute('data-user-id');
                    const name = element.getAttribute('data-name') || element.textContent;
                    return userId && name ? { userId, name } : false;
                },
            },
        ];
    },



    renderHTML({ node, HTMLAttributes }) {
        const { userId, name } = node.attrs;
        return [
            'span',
            mergeAttributes(
                {
                    class: 'mention-link inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100 hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors cursor-pointer',
                    'data-mention-id': userId,
                    'data-user-id': userId,
                    'data-name': name,
                },
                HTMLAttributes
            ),
            name,
        ];
    },

    renderText({ node }) {
        const { userId, name } = node.attrs;
        return `[[mention:${userId}:${name}]]`;
    },


});

// Function to convert mention delimiters to styled links
export const processMentionsForDisplay = (htmlContent: string): string => {
    return htmlContent.replace(
        /\[\[mention:([^:]+):([^\]]+)\]\]/g,
        '<span class="mention-link inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100 hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors cursor-pointer" data-mention-id="$1">$2</span>'
    );
};

// Function to extract mentions from content for searching/filtering
export const extractMentions = (htmlContent: string): Array<{ userId: string; name: string }> => {
    const mentions: Array<{ userId: string; name: string }> = [];
    const regex = /\[\[mention:([^:]+):([^\]]+)\]\]/g;
    let match;

    while ((match = regex.exec(htmlContent)) !== null) {
        mentions.push({
            userId: match[1],
            name: match[2]
        });
    }

    return mentions;
};

// Function to convert delimiter format to mention nodes
const convertDelimitersToMentions = (htmlContent: string): string => {
    return htmlContent.replace(
        /\[\[mention:([^:]+):([^\]]+)\]\]/g,
        '<span data-mention-id="$1" data-user-id="$1" data-name="$2" class="mention-link inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">$2</span>'
    );
};

// Function to convert mention spans back to delimiter format
const convertMentionSpansToDelimiters = (htmlContent: string): string => {
    return htmlContent.replace(
        /<span[^>]*data-mention-id="([^"]+)"[^>]*data-user-id="([^"]+)"[^>]*data-name="([^"]+)"[^>]*>([^<]+)<\/span>/g,
        '[[mention:$1:$3]]'
    );
};

export const TiptapEditorWithMentions: React.FC<TiptapEditorWithMentionsProps> = ({
    content,
    onChange,
    onSubmit,
    placeholder,
    uploadImage,
    teamMembers = [],
}) => {
    const [showMentions, setShowMentions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionPos, setMentionPos] = useState({ x: 0, y: 0 });
    const mentionSuggestionsRef = useRef<MentionSuggestionsRef>(null);
    const editorRef = useRef<any>(null);




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
            Mention,
        ],
        content: content,
        onUpdate: ({ editor }) => {
            // Get HTML and convert mention spans back to delimiter format
            const htmlContent = editor.getHTML();
            const contentWithDelimiters = convertMentionSpansToDelimiters(htmlContent);

            // Only update content if it actually changed to avoid interference
            if (contentWithDelimiters !== content) {
                onChange(contentWithDelimiters);
            }

            // Handle mention logic
            const { state } = editor;
            const { from } = state.selection;
            const textBefore = state.doc.textBetween(Math.max(0, from - 50), from, '\n', '\n');
            const mentionMatch = textBefore.match(/@(\w*)$/);

            if (mentionMatch && teamMembers.length > 0) {
                if (!showMentions) {
                    // Start showing mentions
                    const coords = editor.view.coordsAtPos(from);
                    setMentionPos({ x: coords.left, y: coords.bottom });
                    setShowMentions(true);
                }
                setMentionQuery(mentionMatch[1]);
            } else if (showMentions) {
                // Hide mentions
                setShowMentions(false);
            }
        },
        editorProps: {
            attributes: {
                class: 'prose dark:prose-invert min-w-full max-w-full focus:outline-none p-2 rounded-md border border-input min-h-[40px] max-h-[120px] overflow-y-auto text-sm',
            },
            handleKeyDown: (view, event) => {
                // Handle mention suggestions navigation
                if (showMentions && mentionSuggestionsRef.current) {
                    const handled = mentionSuggestionsRef.current.onKeyDown(event);
                    if (handled) {
                        return true;
                    }
                }

                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    onSubmit();
                    return true;
                }



                // Handle escape to close mentions
                if (event.key === 'Escape' && showMentions) {
                    setShowMentions(false);
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
        if (editor && !editor.isDestroyed) {
            const currentContent = editor.getHTML();
            const currentWithDelimiters = convertMentionSpansToDelimiters(currentContent);

            // Only update if the content is actually different
            if (currentWithDelimiters !== content) {
                const convertedContent = convertDelimitersToMentions(content);
                editor.commands.setContent(convertedContent, false);
            }
        }
    }, [content, editor]);



    // Store editor reference for mention handling
    useEffect(() => {
        editorRef.current = editor;
    }, [editor]);

    const handleMentionSelect = useCallback((member: TeamMember) => {
        if (!editor) return;

        const { state } = editor;
        const { from } = state.selection;

        // Find the @ symbol position
        const textBefore = state.doc.textBetween(Math.max(0, from - 50), from, '\n', '\n');
        const mentionMatch = textBefore.match(/@(\w*)$/);

        if (mentionMatch) {
            const mentionStart = from - mentionMatch[1].length - 1; // -1 for the @ symbol
            const mentionEnd = from;

            // Replace the @query with the mention using the standard insertContent
            const memberName = member.profiles?.full_name || 'Unknown User';

            editor.chain()
                .deleteRange({ from: mentionStart, to: mentionEnd })
                .insertContent({
                    type: 'mention',
                    attrs: { userId: member.user_id, name: memberName },
                })
                .insertContent(' ')
                .focus()
                .run();
        }

        setShowMentions(false);
    }, [editor]);

    // Click outside to close mentions
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showMentions) {
                setShowMentions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showMentions]);

    return (
        <div className="relative">
            <EditorContent editor={editor} />

            {showMentions && teamMembers.length > 0 && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        left: mentionPos.x,
                        top: mentionPos.y,
                        zIndex: 9999,
                    }}
                >
                    <MentionSuggestions
                        ref={mentionSuggestionsRef}
                        query={mentionQuery}
                        teamMembers={teamMembers}
                        onSelect={handleMentionSelect}
                    />
                </div>,
                document.body
            )}
        </div>
    );
}; 