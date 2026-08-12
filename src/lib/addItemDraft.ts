export type AddItemDraftState = {
  text: string;
  isAnonymous: boolean;
  isExpanded: boolean;
};

export const addItemDraftStorageKey = (draftKey: string) => `retro-add-item-draft:${draftKey}`;

export const parseAddItemDraft = (raw: string | null): AddItemDraftState | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AddItemDraftState;
    if (typeof parsed?.text !== 'string') return null;
    return {
      text: parsed.text,
      isAnonymous: !!parsed.isAnonymous,
      isExpanded: !!parsed.isExpanded || parsed.text.trim().length > 0,
    };
  } catch {
    return null;
  }
};

export const serializeAddItemDraft = (draft: AddItemDraftState): string | null => {
  if (!draft.text.trim() && !draft.isExpanded && !draft.isAnonymous) {
    return null;
  }
  return JSON.stringify(draft);
};
