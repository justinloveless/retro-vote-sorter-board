import { describe, expect, it } from 'vitest';
import { Selection } from 'prosemirror-state';
import { Step, StepResult } from 'prosemirror-transform';
import {
  patchProseMirrorJsonIDs,
  patchProseMirrorSelectionJsonID,
  patchProseMirrorStepJsonID,
} from '@/lib/patchProseMirrorSelection';

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

    const id = `test-dup-sel-${Math.random().toString(36).slice(2)}`;
    expect(() => Selection.jsonID(id, FirstSel as any)).not.toThrow();
    expect(() => Selection.jsonID(id, SecondSel as any)).not.toThrow();
  });
});

describe('patchProseMirrorStepJsonID', () => {
  it('allows duplicate step JSON ID registration', () => {
    patchProseMirrorStepJsonID();

    class FirstStep extends Step {
      apply() {
        return StepResult.fail('noop');
      }
      invert() {
        return this;
      }
      map() {
        return null;
      }
      toJSON() {
        return { stepType: 'test' };
      }
      static fromJSON() {
        return new FirstStep();
      }
    }

    class SecondStep extends Step {
      apply() {
        return StepResult.fail('noop');
      }
      invert() {
        return this;
      }
      map() {
        return null;
      }
      toJSON() {
        return { stepType: 'test' };
      }
      static fromJSON() {
        return new SecondStep();
      }
    }

    const id = `test-dup-step-${Math.random().toString(36).slice(2)}`;
    expect(() => Step.jsonID(id, FirstStep as any)).not.toThrow();
    expect(() => Step.jsonID(id, SecondStep as any)).not.toThrow();
  });

  it('allows re-registering atlaskit-table-sorting-ordering style IDs', () => {
    patchProseMirrorJsonIDs();

    class SortStepA extends Step {
      apply() {
        return StepResult.fail('noop');
      }
      invert() {
        return this;
      }
      map() {
        return null;
      }
      toJSON() {
        return { stepType: 'atlaskit-table-sorting-ordering' };
      }
      static fromJSON() {
        return new SortStepA();
      }
    }

    class SortStepB extends Step {
      apply() {
        return StepResult.fail('noop');
      }
      invert() {
        return this;
      }
      map() {
        return null;
      }
      toJSON() {
        return { stepType: 'atlaskit-table-sorting-ordering' };
      }
      static fromJSON() {
        return new SortStepB();
      }
    }

    // Use a unique id so we don't collide with a real Atlaskit registration in this process,
    // but exercise the same duplicate-ID code path that fails editor-core load.
    const id = `atlaskit-table-sorting-ordering-test-${Math.random().toString(36).slice(2)}`;
    expect(() => Step.jsonID(id, SortStepA as any)).not.toThrow();
    expect(() => Step.jsonID(id, SortStepB as any)).not.toThrow();
  });
});
