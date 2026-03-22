import CodeBlock from '@tiptap/extension-code-block';

/** Preserves optional `{noformat:attrs}` when round-tripping through the wiki editor. */
export const JiraCodeBlock = CodeBlock.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      jiraNoformatAttrs: { default: '' },
    };
  },
});
