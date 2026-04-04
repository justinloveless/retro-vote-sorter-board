import React from 'react';

// Minimal stub for `@atlaskit/editor-common/ui`.
// These components are used by Atlaskit renderer as fallbacks for unsupported ADF nodes.

export function BaseTheme(props: { children?: React.ReactNode }) {
  return <>{props.children}</>;
}

export function IntlErrorBoundary(props: { children?: React.ReactNode }) {
  return <>{props.children}</>;
}

export function WidthProvider(props: { children?: React.ReactNode }) {
  return <>{props.children}</>;
}

export function WithCreateAnalyticsEvent(props: { children?: React.ReactNode }) {
  return <>{props.children}</>;
}

export function UnsupportedBlock(props: { children?: React.ReactNode }) {
  return <div>{props.children}</div>;
}

export function UnsupportedInline(props: { children?: React.ReactNode }) {
  return <span>{props.children}</span>;
}

