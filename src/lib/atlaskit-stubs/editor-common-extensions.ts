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

