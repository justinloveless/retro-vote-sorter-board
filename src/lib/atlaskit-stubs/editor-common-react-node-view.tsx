// Re-export real react-node-view plus missing NodeViewContentHole shim.
import React from 'react';
export * from '@atlaskit/editor-common/dist/esm/react-node-view/index.js';
export { default } from '@atlaskit/editor-common/dist/esm/react-node-view/index.js';

// Minimal shim — used as a content placeholder by newer plugins.
export const NodeViewContentHole: React.FC<{ children?: React.ReactNode }> = ({ children }) =>
  React.createElement(React.Fragment, null, children);
