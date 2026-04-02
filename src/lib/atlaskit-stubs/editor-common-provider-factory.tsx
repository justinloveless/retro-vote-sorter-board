import React from 'react';

// Minimal stub for `@atlaskit/editor-common/provider-factory`.
// Atlaskit renderer uses this to resolve optional providers (e.g. extensionProvider).
// It also imports ProviderFactory / ProviderFactoryProvider for context wiring.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class ProviderFactory {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setProvider(_name: string, _provider: any) {}
  removeProvider(_name: string) {}
  destroy() {}
}

export function ProviderFactoryProvider(props: { providerFactory: ProviderFactory; children?: React.ReactNode }) {
  return <>{props.children}</>;
}

export function WithProviders(props: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  providers?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  providerFactory?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderNode: (providers: any) => React.ReactNode;
}) {
  return <>{props.renderNode({})}</>;
}

