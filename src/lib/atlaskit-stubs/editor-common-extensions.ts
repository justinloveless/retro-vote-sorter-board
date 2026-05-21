import React from 'react';

// Minimal stub for `@atlaskit/editor-common/extensions`.
// The renderer imports this for extension node rendering; we don't support Jira/Confluence extensions
// in Retroscope, so returning a no-op renderer is sufficient.
export function getNodeRenderer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _extensionProvider: any,
  _extensionType: string,
  _extensionKey?: string,
): React.ComponentType<{ node: unknown; actions?: unknown }> {
  return function NoopExtensionNodeRenderer() {
    return null;
  };
}

// Extension-key/type constants used by newer @atlaskit/editor-plugin-extension toolbar code.
export const AGENT_MANAGED_EXTENSION_KEY = 'agent-managed';
export const NATIVE_EMBED_EXTENSION_KEY = 'native-embed';
export const NATIVE_EMBED_EXTENSION_TYPE = 'com.atlassian.native-embed';
export const messages = {} as Record<string, { id: string; defaultMessage: string }>;


