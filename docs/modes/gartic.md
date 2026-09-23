# Gartic Phone mode (`backend/gartic.js`)

Telestrations: prompt → draw → guess chains, then a host-driven reveal.
Views: `GarticHostView.jsx`, `GarticPlayerView.jsx`; `DrawCanvas`, `DrawReplay`, `GarticReveal` components.

## Chain passing (Latin square)
N players → N books. `assign[round][playerIdx] = (playerIdx + shift[round]) % N`, `shift[0]=0`, `shift[1..N-1]`
a shuffled permutation of 1..N-1. Every player works every book exactly once and never their own twice.
Round 0 = prompt, odd = draw, even = guess. (At N=3 "different source each round" is impossible — only cyclic
3×3 squares exist.)

Phases: `lobby → round → reveal`. Timer per round: draw `GARTIC_DRAW_TIME` (100s), prompt/guess
`GARTIC_GUESS_TIME` (60s). The host advances each round once all connected players submitted or time is up.

## Drafts (time-up autosave)
Unfinished work reaches the next player through **drafts**: the client sends `gartic:draft` every 2s (text rounds
also on every keystroke), and `usePhaseInput` sends one final draft at time-up while the canvas is still mounted.
On advance the server uses the latest draft for any non-submitter, else a placeholder, so chains stay intact.
Why Drafts and not a submit at time-up: [ADR-0001](../adr/0001-drafts-not-time-up-submit.md).
`submit` and `draft` carry `round` + `gameId` and are ignored when stale.

## Players
The player set is snapshotted at start (`playerKeys`). A mid-game joiner gets `{type:'spectator', gameId}` and is
left out of the gartic roster until the next game. Reconnecting by name resumes the same slot; the task's `done`
flag resumes an already-submitted player in the locked state.

## Tasks
`gartic:task` (private): {gameId, step, round, type, prev, timeLimit, done}. `prev` is the previous entry of the
book this player works (text, or a drawing's PNG data URL).

## Drawing
`DrawCanvas`: palette + rainbow swatch wrapping `<input type=color>`, 🪣 scanline flood fill (tolerance + 2px
dilation to swallow anti-aliased stroke halos; fill and eraser are mutually exclusive), undo stack, clear.
The drawing process is a flipbook of full-res PNG snapshots (`getFrames()`, ~every 0.9s while dirty; why not
vector strokes: [ADR-0003](../adr/0003-drawing-replay-png-flipbook.md)). `MAX_FRAMES` = 40 on both sides — the client thins
older frames, the server's `sanitizeFrames` samples evenly — keeping a submit well under the socket buffer.
Frames ride on submit and the final draft only, never the heartbeat.

## Reveal
Walks book by book, entry by entry; `state.reveal` holds only the current entry (drawings are base64, so the
payload stays one entry). It includes `seedPrompt`; `GarticReveal` fires `Fireworks` + a banner when a guess
contains the seed prompt (accent/case-insensitive). `DrawReplay` replays the frames (~3.5s), falling back to the
final PNG.
