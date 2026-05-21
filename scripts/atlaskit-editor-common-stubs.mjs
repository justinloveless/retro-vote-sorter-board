import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const stubsDir = path.join(root, 'src/lib/atlaskit-stubs');

/**
 * Subpaths that newer Atlaskit editor plugins import but @atlaskit/editor-common
 * does not publish as standalone entry points in npm (breaks Vite/Rollup on Lovable).
 * Do not alias other stubs — real modules like `utils` and `analytics` exist and
 * need nested imports (e.g. `@atlaskit/editor-common/utils/foo`).
 */
const MISSING_SUBPATH_STUB_FILES = {
  'block-type': 'editor-common-block-type.ts',
  'code-block': 'editor-common-code-block.ts',
  'react-node-view': 'editor-common-react-node-view.tsx',
};

const NODE_SELECTION_STUB = 'editor-common-node-selection.ts';

function editorCommonSubpathExists(subpath) {
  const indexPath = path.join(
    root,
    'node_modules/@atlaskit/editor-common/dist/esm',
    subpath,
    'index.js',
  );
  const flatPath = path.join(
    root,
    'node_modules/@atlaskit/editor-common/dist/esm',
    `${subpath}.js`,
  );
  return fs.existsSync(indexPath) || fs.existsSync(flatPath);
}

/** @returns {Map<string, string>} import id → absolute stub file path */
export function loadAtlaskitEditorCommonStubAliases() {
  const aliases = new Map();
  for (const [subpath, file] of Object.entries(MISSING_SUBPATH_STUB_FILES)) {
    const filePath = path.join(stubsDir, file);
    if (fs.existsSync(filePath)) {
      aliases.set(`@atlaskit/editor-common/${subpath}`, filePath);
    }
  }
  if (!editorCommonSubpathExists('node-selection')) {
    const filePath = path.join(stubsDir, NODE_SELECTION_STUB);
    if (fs.existsSync(filePath)) {
      aliases.set('@atlaskit/editor-common/node-selection', filePath);
    }
  }
  return aliases;
}

/** Vite plugin: resolve missing @atlaskit/editor-common/* subpaths (Lovable/bun uses newer editor plugins). */
export function atlaskitEditorCommonStubsPlugin() {
  const aliases = loadAtlaskitEditorCommonStubAliases();
  return {
    name: 'atlaskit-editor-common-stubs',
    enforce: 'pre',
    resolveId(source) {
      return aliases.get(source) ?? null;
    },
  };
}

/** Plain object for vite resolve.alias */
export function atlaskitEditorCommonStubAliasObject() {
  return Object.fromEntries(loadAtlaskitEditorCommonStubAliases());
}
