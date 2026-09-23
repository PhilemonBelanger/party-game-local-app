# Time's-up input is captured by Drafts, never by a submit at time-up

When the timer hits zero, a Player who isn't Done must still contribute what they had (a half-finished drawing,
typed text). We capture it with Drafts: the client sends its current input every 2s and on every keystroke, plus
one final Draft at Time's up while the input is still on screen; when the Host advances, the server uses each
non-Done Player's latest Draft. We tried submitting automatically at Time's up and removed it: that submit raced
the Host's instant Next (arriving after the Step had moved on), and by the time it fired the drawing canvas had
already unmounted, so the drawing was lost.

## Consequences

- Every timed input goes through the client's `usePhaseInput` hook; submit and Draft payloads carry `gameId` and
  a round/prompt tag so late arrivals are discarded instead of corrupting the next Step.
- A Draft equal to the Fibbage Truth is dropped, so auto-filled input can never smuggle in the Truth.
