# Debugging Plan: "Summarize" Button Regression

This document outlines the step-by-step plan to diagnose and fix the regression where the "Summarize" button in the retro board does not play the generated audio.

The last known working commit is `1dc3a6b914ec5a99fdb9e7e585223d2b092fd95e`.

## Analysis of `git diff`

The primary change between the working commit and the current state is the removal of the `updateAudioSummaryState` prop from `ColumnSummary` and `RetroColumn`. The component was refactored to use the `presenceChannel` to broadcast state changes directly.

-   **`ColumnSummary.tsx`**: No longer receives or calls `updateAudioSummaryState`. Instead, uses `presenceChannel.send()` to broadcast `'audio-summary-state'` events.
-   **`RetroColumn.tsx`**: No longer passes `updateAudioSummaryState` to `ColumnSummary`.
-   **`useRetroBoard.ts`**: The `updateAudioSummaryState` function still exists but is no longer passed down as a prop. A listener for `'audio-summary-state'` was added to the presence channel `useEffect`.

## Potential Causes of Regression

1.  **State Management & Event Flow (FIXED):** The `audioSummaryState` was not being correctly propagated because the component was only broadcasting events and not updating its own state. This was fixed by reverting to the prop-based `updateAudioSummaryState` function.

2.  **UI Interaction & Component Lifecycle (FIXED):** The `onClick` handler was not firing. This was a symptom of the state management issue.

3.  **Script Generation & State (Current Focus):**
    - The `generate-script` function may be returning an empty or invalid script.
    - The script value might be getting lost in the `audioSummaryState` object.

4.  **`useAudioPlayer` Hook Logic:**
    -   This is now a possibility again. The hook might not be handling the `src` correctly.

## Debugging Steps

-   [x] **Step 1 & 2: Complete.** UI interaction and state flow have been debugged and fixed. The button now correctly triggers the summary generation process.

-   [ ] **Step 3: Investigate Script Generation and State (Current Step).**
    -   [ ] Add logging in `ColumnSummary.tsx` to inspect the `script` returned from the `generate-script` function.
    -   [ ] Add logging in `ColumnSummary.tsx` inside the playback `useEffect` to check the value of `audioSummaryState.script` right before it's passed to the `play()` function.
    -   [ ] Read the `useAudioPlayer.ts` hook to understand how it handles the source.


---
### Investigation Log

- **2023-10-27:** Identified that the UI was not firing events.
- **2023-10-27:** Fixed the state management architecture by restoring `updateAudioSummaryState` prop. This resolved the UI interaction issue.
- **2023-10-27:** New issue: Audio playback error. The player is receiving an empty `src`. Investigation now focused on the script generation and propagation.

*(This section will be updated as steps are completed)* 