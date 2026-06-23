# 🎯 Local Wi-Fi Party Games

Two party games on one stack. One screen is the **Host (TV)**; everyone else joins from
their phone on the same Wi-Fi (scan a QR) and plays. Pick the game on the host's home screen:

- **🎯 Trivia** — multiple-choice **and** "closest number wins" questions, optional images
  (base64 or URL), live timer, scores, podium with proper tie handling, section headers.
- **🎨 Gartic Phone** — write a prompt → draw it → guess the drawing → draw the guess → …
  one chain per player, then the host walks everyone through each story at the reveal.

Stack: React + Vite (frontend) · Node + Socket.IO (backend). Runs three ways:
**Docker (dev)**, **single Node server (prod)**, or **one self-contained `.exe`**.

The LAN IP for the QR/join URL is **auto-detected** — no manual entry.

---

## Commands (`just`)

Everything is wrapped in a [`justfile`](justfile). Run `just` to list recipes
([install just](https://github.com/casey/just#installation)):

| Recipe | What it does |
|---|---|
| `just dev` | Start the dev stack (Docker, hot reload, auto LAN IP) — **the usual one** |
| `just up` / `just down` | Start / stop containers |
| `just logs` | Follow container logs |
| `just build-exe` | Build the single self-contained **`trivia.exe`** |
| `just prod` | Build + run the bundled server on one port (no Docker) |
| `just deploy` | Build the shareable exe and report its path |
| `just firewall-open` / `just firewall-close` | Allow/remove phone access through Windows Firewall (admin) |
| `just clean` | Stop containers + delete build artifacts |

The recipes just call the npm scripts / PowerShell scripts documented below, so you
can run either form.

---

## Run it — pick one

### A. Docker (development, hot reload)
```powershell
just dev          # or: powershell -ExecutionPolicy Bypass -File start.ps1
```
Detects your LAN IP, writes `.env`, runs `docker compose up`. Two containers
(Vite :5173 + backend :3001). Host/TV: open `http://localhost:5173` → *Open Host Screen*.
Phones scan the QR.

First run after pulling new deps:
```powershell
just up
```

### B. Single self-contained exe (share / no install)
```powershell
just build-exe    # or: npm run build:exe
```
Produces **`trivia.exe`** (~90 MB, bundles the Node runtime + UI + default quiz).
Copy it to any Windows PC, double-click, open `http://localhost:3001`. No Node, no Docker.
(`npm run build:exe` on a Mac/Linux box produces a `trivia` binary instead.)

### C. Plain Node server (prod, no exe)
```powershell
just prod            # build-web + bundle + build-server + start:prod
```
Or step by step:
```powershell
npm run build:web    # build the single-file UI
npm run bundle       # embed it into the backend
npm run build:server # bundle backend -> build/server.cjs
npm run start:prod   # node build/server.cjs
```

For B and C the whole app is served on **one port (3001)** — phones and TV both use it.

---

## Connecting phones
- The QR encodes `http://<auto-detected-LAN-IP>:<port>`. Just scan it.
- Same Wi-Fi required.
- **Firewall is automatic in the exe / `just prod`:** on startup (Windows) it checks for
  the inbound rule and, if missing, adds it via a single **UAC prompt** — accept it once.
  - It only prompts when a rule is actually missing (checks first, no admin needed for that).
  - Adds TCP on the serving port, Private profile. Disable with `SKIP_FIREWALL=1`.
  - Docker dev doesn't auto-open (Linux container) — use `just firewall-open` once, or it's
    usually covered by the Docker/Node "Allow access?" popup on first run.
- Manual control any time: `just firewall-open` / `just firewall-close`.
- If the QR shows a ⚠ warning, the PC isn't on a detectable LAN (connect Wi-Fi/Ethernet).

## Configure
- **Timer / points:** `docker-compose.yml` env (`TIME_LIMIT`, `BASE_POINTS`) for Docker,
  or env vars for the server/exe. Restart to apply.
- **Questions:** edit `backend/quiz.json`, **or** build a quiz in the UI (Home → *Create a quiz*),
  **or** upload one at the Host screen → *Load quiz from JSON*.

### Quiz JSON format
```json
{
  "title": "My Quiz",
  "questions": [
    { "q": "Capital of France?", "choices": ["Paris","Lyon","Nice","Lille"], "answer": 0, "points": 100 },

    { "q": "What is this?", "image": "data:image/jpeg;base64,...", "choices": [
        "Plain text",
        { "text": "With caption", "image": "https://..." },
        { "image": "data:image/png;base64,..." }
      ], "answer": 1 },

    { "q": "How many jelly beans?", "type": "number", "answer": 412, "points": 100 },

    { "type": "section", "title": "Round 2", "description": "Harder now…", "image": "data:…" }
  ]
}
```
- `answer` = 0-based choice index (multiple choice) or the target number (`type: "number"`, closest wins).
- `choices`: 2–6, each a string or `{ text?, image? }`. `image` = `data:` URI or URL.
- `points` optional (falls back to `BASE_POINTS`).
- **Section headers** (`type: "section"`): a divider shown on all screens (title + optional
  image/description). The host taps **Continue →** to move on. Sections don't count toward
  "Question X / N". Add them in the creator with **+ Add section**.

## Players & reconnect
- The host screen shows a live **roster** (top-right) with scores — **green** = connected,
  **red** = disconnected. Everyone who ever joined stays listed.
- **Reconnect is by name**: if a phone drops (Wi-Fi blip → auto-reconnects) or the page is
  reloaded, re-entering the **same name** resumes that player with their score and progress intact.
- A disconnected player never stalls the round — the host's **Reveal** button enables once all
  *connected* players have answered (it also shows live progress, e.g. "Waiting… 1/2 answered"),
  and the answered ✓ shows beside each player in the roster.

## Gartic Phone
- Host home → **🎨 Host: Gartic Phone**. Players join the same way (name on phone). Needs **2+ players**.
- Rounds (one per player): everyone writes an **initial prompt** → next round everyone gets
  *someone else's* prompt to **draw** → next round everyone gets a **drawing to guess** → draw the
  guess → … each chain passes through every player exactly once.
- Round timers: **100s to draw, 60s to prompt/guess** (env `GARTIC_DRAW_TIME` / `GARTIC_GUESS_TIME`).
  When time runs out the player's current work **auto-submits** (partial text or the incomplete drawing).
  The host's **Next** advances once everyone submits or the timer hits 0.
- **Reveal:** the host steps through each story (prompt → drawing → guess → …) with **Back/Next**;
  phones mirror the current step.
- Drawing tool: pen, eraser, color swatches, brush size. Drawings travel as base64 over the socket.
- Note: the "you never get a drawing from the same person twice" rule holds for larger groups but is
  impossible at exactly 3 players (only 2 others) — chains are always valid regardless.

## How it works
- The **backend holds all game state** (players, scores, timer, who answered). Phones/TV are
  thin clients reacting to `state` events; a player only learns right/wrong via a private `result`.
- A top-level `mode` (`trivia` | `gartic`) selects the game; the host sets it via `host:setmode`.
- Flow: `lobby → question → reveal → … → podium`. **The host always triggers the reveal** with a button.
  It enables once all connected players answer, or when the timer hits 0 — at 0 answering locks
  (players see "Time's up — waiting for host") but the round stays put until the host clicks Reveal.
- Timer ticks are sent separately from full state so base64 images aren't re-broadcast each second.
- `/api/config` reports the auto-detected LAN IP to the frontend at runtime.

## Layout
```
backend/    Socket.IO server + game logic + quiz.json + embedded.js (build stub)
frontend/   Vite React app (Home / Host / Player / Creator views)
scripts/    bundle-html · build-server · make-sea · open/close-firewall
justfile · docker-compose.yml · start.ps1 · package.json (build scripts)
```
