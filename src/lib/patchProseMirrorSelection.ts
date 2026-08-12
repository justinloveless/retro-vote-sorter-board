import { Selection } from 'prosemirror-state';

let patched = false;

/**
 * Atlaskit renderer + editor-core both register selection JSON IDs (e.g. "gapcursor").
 * In the Vite production bundle they share one `prosemirror-state`, so the second
 * `Selection.jsonID` call throws and the dynamic `import('@atlaskit/editor-core')`
 * fails permanently — surfacing as "Failed to load editor."
 *
 * Call this before any Atlaskit editor/renderer code evaluates.
 */
export function patchProseMirrorSelectionJsonID(): void {
  if (patched) return;
  patched = true;

  const orig = Selection.jsonID.bind(Selection);
  Selection.jsonID = function patchedSelectionJsonID(id: string, cls: any) {
    try {
      return orig(id, cls);
    } catch (err) {
      if (err instanceof RangeError && /Duplicate use of selection JSON ID/.test(String(err.message))) {
        return cls;
      }
      throw err;
    }
  };
}

// Side effect for `import '@/lib/patchProseMirrorSelection'` from main.tsx
patchProseMirrorSelectionJsonID();
