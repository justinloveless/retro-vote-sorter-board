# Debugging Plan: "Summarize" Button Audio Playback Failure

This document outlines the step-by-step plan to diagnose and fix the issue where the "Summarize" button in the retro board fails to play audio when `autoPlay` is set to `false`.

## Problem Analysis

The `PlayAudioButton` component works correctly, but it uses `autoPlay: true`. The `ColumnSummary` component, which uses `autoPlay: false` to defer playback, fails with an "Invalid URI. Load of media resource failed" error.

The core issue has been isolated:
- Playback works when `play` is called with `{ autoPlay: true }`.
- Playback fails when `play` is called with `{ autoPlay: false }`.
- A previous attempt to fix this by adding `audio.load()` was not successful.

This points to a fundamental issue in how the `useAudioPlayer` hook manages the `Audio` object and its lifecycle, especially in relation to React's rendering and state updates.

## New Hypothesis

Creating a new `Audio` object on every `play` call is fragile. When playback is deferred (`autoPlay: false`), the reference to the `Audio` object or its blob URL `src` may be getting lost or invalidated between the time it's created and the time the user tries to play it. This is a common source of bugs in React when dealing with external objects that have their own state and lifecycle.

The solution is to refactor the `useAudioPlayer` hook to follow a more robust pattern:
1.  Create a **single, persistent `Audio` object** that lasts for the entire lifecycle of the component using the hook.
2.  Attach event listeners to this single object once, when the hook is first mounted.
3.  The `play` function will no longer create a new `Audio` object. Instead, it will simply update the `.src` property of the existing one.

This approach ensures a stable reference to the `Audio` element and simplifies its state management.

## Debugging & Solution Steps

1.  **Acknowledge previous fix was insufficient.** The `audio.load()` call did not address the root cause.

2.  **Implement the Fix (Current Step):** Refactor `src/hooks/useAudioPlayer.ts`.
    -   Instantiate the `Audio` object once using `useRef(new Audio())`.
    -   Move all event listener assignments (`.onplay`, `.onpause`, etc.) into a `useEffect` with an empty dependency array (`[]`) so they are set up only on mount and cleaned up on unmount.
    -   Modify the `play` function to get the persistent audio object from the ref (`audioRef.current`) and simply update its `src`. It should no longer create a `new Audio()`.
    -   Ensure the `stop`, `pause`, and `resume` functions all operate on this single, persistent `Audio` object.

3.  **Verify the Fix:**
    -   Test the "Summarize" functionality. Confirm that generating a summary and then clicking the play button works as expected without errors.
    -   Test the "Read Aloud" (`PlayAudioButton`) functionality to ensure there are no regressions.

---
### Investigation Log

- **Previously:** Fixed initial state management and UI interaction issues.
- **Previously:** Encountered an "Invalid URI" error.
- **Previously:** Incorrectly attempted to fix the issue with `audio.load()`.
- **Current:** The investigation has revealed a more fundamental architectural issue in `useAudioPlayer`. The new plan is to refactor the hook to use a single, persistent `Audio` object to ensure stability.

*(This section will be updated as steps are completed)* 