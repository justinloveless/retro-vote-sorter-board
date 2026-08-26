import { Selection } from 'prosemirror-state';
import { Step } from 'prosemirror-transform';

let selectionPatched = false;
let stepPatched = false;

/**
 * Atlaskit renderer + editor-core both register selection JSON IDs (e.g. "gapcursor")
 * and step JSON IDs (e.g. "atlaskit-table-sorting-ordering").
 * In the Vite production bundle they share one `prosemirror-state` /
 * `prosemirror-transform`, so the second `Selection.jsonID` / `Step.jsonID` call
 * throws and the dynamic `import('@atlaskit/editor-core')` fails permanently —
 * surfacing as "Failed to load editor."
 *
 * Call this before any Atlaskit editor/renderer code evaluates.
 */
export function patchProseMirrorSelectionJsonID(): void {
  patchProseMirrorJsonIDs();
}

export function patchProseMirrorStepJsonID(): void {
  if (stepPatched) return;
  stepPatched = true;

  const orig = Step.jsonID.bind(Step);
  Step.jsonID = function patchedStepJsonID(id: string, cls: any) {
    try {
      return orig(id, cls);
    } catch (err) {
      if (err instanceof RangeError && /Duplicate use of step JSON ID/.test(String(err.message))) {
        return cls;
      }
      throw err;
    }
  };
}

export function patchProseMirrorJsonIDs(): void {
  if (!selectionPatched) {
    selectionPatched = true;

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

  patchProseMirrorStepJsonID();
}

// Side effect for `import '@/lib/patchProseMirrorSelection'` from main.tsx
patchProseMirrorJsonIDs();
