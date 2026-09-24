# CLAUDE.md

Local Wi-Fi party games: a host screen (TV) + players on phones (same Wi-Fi, scan a QR). Three modes, picked on
the host home: **trivia**, **gartic** (Gartic Phone), **fibbage** (bluffing trivia). React + Vite frontend,
Node + Express + Socket.IO backend, all game state in server memory. User docs: [README.md](README.md).

## Read before you change…
- **trivia** gameplay, quiz files or the quiz schema → [docs/modes/trivia.md](docs/modes/trivia.md)
- **gartic** rounds, drawing, drafts or reveal → [docs/modes/gartic.md](docs/modes/gartic.md)
- **fibbage** lies, cards, voting, scoring or EN/FR prompts → [docs/modes/fibbage.md](docs/modes/fibbage.md)
- **running** Docker dev, the prod/exe build, env config, or anything in `scripts/` → [docs/running.md](docs/running.md)

## Commands
- `just test` — backend tests, ~0.1s, no Docker. Run after every backend change.
- `cd frontend; npx vite build` — frontend compile check.
- **Look at the UI** without a backend: run `npx vite` in `frontend/` and open `/?dev=gallery` (every real screen
  with fixture states, `src/dev/fixtures.js`); headless-screenshot it to verify a visual change.
- `just dev` / `just prod` / `just build-exe` — see docs/running.md. The `justfile` lists the rest.

## Architecture
**Hub.** `server.js` adapts Socket.IO onto `hub.js`: `connect(socketId)`, `handle(socketId, event, payload, ack)`,
`disconnect(socketId)`, plus a `transport {toSocket, toAll}` that emits. The hub owns player identity, the
socket→player map, the active mode, and dispatch: hub events (`host:join`, `host:setmode`, `player:join`,
`host:start`, `host:reset`) or the active mode's `events` map (another mode's event acks
`{ok:false, reason:'inactive'}`).

**Players** are keyed by lowercased name and survive disconnects: rejoining with the same name resumes the same
player; if the old socket is still live it is unmapped and sent `player:replaced`. `player:join` takes
`{name, buddy}` (a bare name still works); the **buddy** is the emoji avatar picked on the join screen, stored
as-is and carried in the roster and podium rankings. The hub stores identity only (`{id,name,buddy,connected,socketId}`); each mode keeps its own per-player data under the same key. Readiness counts
**connected** players only (`allDone` in `shared.js`), so a dropped player never stalls the host.

**Mode interface** — trivia.js, gartic.js, fibbage.js each return
`{ start(connectedKeys), reset(), snapshot(), onJoin(key), events: {'x:y': ({key, payload, reply}) => …} }`.
Factories receive a ctx from the hub: `getPlayers`, `send(key, event, payload)` (private, only if connected),
`broadcast()`, `createTimer()` (`countdown.js`: ticks emit `tick`, time-up broadcasts; it never advances the game),
`newGameId()`, and `rng` (from `modes.js`, which builds all three from one config). Mode code talks to the world
only through this ctx — that is what makes it testable. Adding a mode = one factory + one line in `modes.js` +
one `VIEWS` entry in `frontend/src/App.jsx`.

**State contract.** Every `state` snapshot has `mode, phase, title, players, gameId, step, canAdvance` and the timer
fields `timeRemaining/timeLimit/timeUp`. `gameId` is unique per started game across modes (0 in the lobby);
`step` changes whenever a player's input context changes (e.g. `gameId:promptIndex:phase`); `canAdvance` is the
server's verdict on the host's Next/Reveal button. `tick` carries only seconds, keeping base64 images out of the
per-second payload. Private messages carry their own `gameId`/tags, and the server rejects stale ones.

**Frontend.** `App.jsx` routes `VIEWS[state.mode][role]`. Local state that belongs to a step lives in
`useKeyedState(key)` (`hooks.js`), which resets by derivation when `gameId`/`step` changes, so a private message
arriving just after a `state` broadcast lands on the right step. Every timed input goes through `usePhaseInput`:
submitted/lockedOut, the 2s **draft** heartbeat, and a final draft at time-up. Shared screens: `components/Screens.jsx`.

**Look: Sky Candy.** Sky gradient + drifting clouds (`Clouds`, mounted once in App), white cards, pill buttons,
Lilita One (display) + Baloo 2 (text) — bundled from `@fontsource` via `src/fonts.css` (woff2, latin only; the app
runs offline, so nothing loads from a CDN). Building blocks in `components/Sky.jsx`: `Buddy` (a player's emoji in a
bubble; `buddies.js` holds the list and the name-hash fallback), `Ask` (owl host + speech bubble for host
questions), `Wordmark`. `components/Timer.jsx` is the ring countdown (ring + number disc shift green → red);
`className="rail"` pins it top-right on host screens above the `PlayerPanel` roster. Tokens live at the top of
`styles.css`.

## Rules
- The server is **authoritative** for scoring, answer visibility and readiness; clients render `state`.
- Every game-logic change ships with a test in `backend/test/`, driven through `createTestHub()`
  (`test/helpers.js`: real hub + modes, fake clock, seeded rng, recording transport). Advance time with
  `t.clock.tick(n)`; read private messages with `t.last(socketId, event)`.
- Time-up autosave is always a **draft** sent while the input is still mounted; the host's Next then uses the
  latest draft. (Why: [ADR-0001](docs/adr/0001-drafts-not-time-up-submit.md).)
- `backend/embedded.js` stays the committed dev stub; build output lives only in `build/`.

## Agent skills

### Issue tracker

Issues and specs live as local markdown under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`.
