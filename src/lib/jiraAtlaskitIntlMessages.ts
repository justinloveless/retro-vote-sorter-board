import editorCommonEn from '@atlaskit/afm-i18n-platform-editor-editor-common/i18n/en';
import rendererEn from '@atlaskit/afm-i18n-platform-editor-renderer/i18n/en';

/** Atlaskit renderer/editor strings for react-intl; avoids MISSING_TRANSLATION console noise. */
export const jiraAtlaskitIntlMessages: Record<string, string> = {
  ...editorCommonEn,
  ...rendererEn,
};
