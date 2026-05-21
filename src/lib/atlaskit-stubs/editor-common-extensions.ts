// Re-export the real @atlaskit/editor-common/extensions module and add constants
// missing in this installed version that newer editor plugins import.
import React from 'react';

export * from '@atlaskit/editor-common/dist/esm/extensions.js';

export const AGENT_MANAGED_EXTENSION_KEY = 'agent-managed';
export const NATIVE_EMBED_EXTENSION_KEY = 'native-embed';
export const NATIVE_EMBED_EXTENSION_TYPE = 'com.atlassian.native-embed';

// Fallback no-op renderer (kept for callers that already imported it from this stub).
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
