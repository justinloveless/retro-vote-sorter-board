

## Focus Card Feature for Retro Board

### Overview
Add a "Focus" button to each retro card that broadcasts the focused card to all connected users via the existing Supabase realtime channel. A focused card appears as a prominent banner at the top of the board, visible to everyone.

### Technical Approach

Use the existing `presenceChannel` broadcast mechanism (already used for readiness changes and audio summaries) to send/receive focus events -- no new database tables or columns needed.

### Changes

**1. `src/hooks/useRetroBoard.ts`**
- Add `focusedItemId` state (string | null)
- Add `focusItem(itemId: string | null)` function that broadcasts a `focus-card` event via `presenceChannel`
- Listen for `focus-card` broadcast events and update `focusedItemId` state
- Return `focusedItemId` and `focusItem` from the hook

**2. `src/components/RetroBoard.tsx`**
- Consume `focusedItemId` and `focusItem` from the hook
- Find the focused item and its column from the items/columns arrays
- Render a `FocusedCardBanner` component above the columns when a card is focused
- Pass `focusItem` down to `RetroColumn`

**3. `src/components/retro/FocusedCardBanner.tsx` (new file)**
- Displays the focused card content prominently at the top of the board
- Shows the card text, author, column name, and vote count
- Has a "Dismiss" button (which broadcasts unfocus to all users)
- Styled with a highlight border and slight animation to draw attention

**4. `src/components/retro/RetroColumn.tsx`**
- Add a "Focus" button (crosshair/eye icon) to each card's action buttons
- Calls `onFocusItem(itemId)` when clicked
- Highlight the card that is currently focused with a ring/border
- Add `onFocusItem` and `focusedItemId` to the component props

### User Experience
- Any user clicks the focus icon on a card
- All users instantly see the card displayed prominently at the top of the board
- Clicking "Dismiss" or focusing a different card clears/replaces the focus
- The focused card in its column gets a visual highlight ring

