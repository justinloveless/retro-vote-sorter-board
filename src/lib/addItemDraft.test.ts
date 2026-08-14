import { describe, expect, it } from 'vitest';
import { parseAddItemDraft, serializeAddItemDraft } from './addItemDraft';

describe('addItemDraft', () => {
  it('round-trips an in-progress draft', () => {
    const draft = { text: '<p>hello</p>', isAnonymous: true, isExpanded: true };
    const raw = serializeAddItemDraft(draft);
    expect(raw).toBeTruthy();
    expect(parseAddItemDraft(raw)).toEqual(draft);
  });

  it('clears empty drafts', () => {
    expect(serializeAddItemDraft({ text: '   ', isAnonymous: false, isExpanded: false })).toBeNull();
  });

  it('re-expands when saved text exists even if isExpanded was false', () => {
    const raw = JSON.stringify({ text: 'keep me', isAnonymous: false, isExpanded: false });
    expect(parseAddItemDraft(raw)).toEqual({
      text: 'keep me',
      isAnonymous: false,
      isExpanded: true,
    });
  });

  it('returns null for invalid JSON', () => {
    expect(parseAddItemDraft('{nope')).toBeNull();
    expect(parseAddItemDraft(null)).toBeNull();
  });
});
