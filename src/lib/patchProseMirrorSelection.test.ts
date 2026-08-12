import { describe, expect, it } from 'vitest';
import { Selection } from 'prosemirror-state';
import { patchProseMirrorSelectionJsonID } from '@/lib/patchProseMirrorSelection';

describe('patchProseMirrorSelectionJsonID', () => {
  it('allows duplicate selection JSON ID registration', () => {
    patchProseMirrorSelectionJsonID();

    class FirstSel extends Selection {
      eq() {
        return false;
      }
      map() {
        return this;
      }
      getBookmark() {
        return {
          map: () => this,
          resolve: () => this as unknown as Selection,
        };
      }
    }

    class SecondSel extends Selection {
      eq() {
        return false;
      }
      map() {
        return this;
      }
      getBookmark() {
        return {
          map: () => this,
          resolve: () => this as unknown as Selection,
        };
      }
    }

    const id = `test-dup-${Math.random().toString(36).slice(2)}`;
    expect(() => Selection.jsonID(id, FirstSel as any)).not.toThrow();
    expect(() => Selection.jsonID(id, SecondSel as any)).not.toThrow();
  });
});
