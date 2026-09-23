# Running, building, shipping

## Three ways to run
- **Docker dev** (hot reload): `just dev` → `start.ps1` detects the LAN IP → `.env` → compose up. Vite on `:5173`,
  backend (nodemon) on `:3001`.
- **Prod single server**: `just prod` — backend serves the built UI **and** Socket.IO on one port (`3001`).
- **Single exe**: `just build-exe` → `trivia.exe` (Node SEA: runtime + UI + default quiz + Fibbage pool). No install.

The frontend asks `GET /api/config` at runtime for the LAN IP used in the QR/join URL; nothing is baked at build
time and the user never types an IP. `detectLanIp` (server.js) works on the host; inside Docker it sees the
container IP, so `HOST_LAN_IP` overrides it (start.ps1 sets it).

## Build pipeline
`vite build` (single file via vite-plugin-singlefile) → `scripts/bundle-html.mjs` writes `build/embedded.js`
(UI string + default quiz + Fibbage pool) → `scripts/build-server.mjs` (esbuild → `build/server.cjs`; a plugin
resolves `./embedded.js` to `build/embedded.js`) → `scripts/make-sea.mjs` (Node SEA + postject → `trivia.exe`).

`backend/embedded.js` is the committed **dev stub** (`INDEX_HTML=null`: dev serves no UI, loads the JSON files
from disk). The build leaves it untouched; generated output lives only in `build/` (gitignored). `build/embedded.js`
and `build/server.cjs` are single giant lines — inspect them with `wc -c` / `head -c`, never a full read.

## Config
Env vars are read once in `configFromEnv` (`backend/modes.js`; defaults in `DEFAULT_CONFIG`). Process-level extras:
`PORT`, `HOST_LAN_IP`, `SKIP_FIREWALL=1` (skip the Windows firewall rule, e.g. for smoke tests).

## Smoke tests
`PORT=3099 SKIP_FIREWALL=1 node backend/server.js` (or `node build/server.cjs`, or the exe), curl `/api/config`,
`/health`, `/`, and drive gameplay with `socket.io-client` (resolvable from `frontend/node_modules`).

## Gotchas
- **Stale exe:** a running `trivia.exe` locks its own file; `make-sea.mjs` `taskkill`s it first. If new features
  are missing at runtime, confirm no `trivia.exe` is still running.
- **Docker anon `node_modules` volume shadows the image:** after adding a dependency, recreate with
  `docker compose up --build --renew-anon-volumes` (start.ps1 does this).
- **Git Bash rewrites container paths** (`/app/x` → `C:/.../app/x`): prefix `MSYS_NO_PATHCONV=1` on
  `docker compose exec`/`cp` with absolute container paths.
- **`/app` in the frontend container is bind-mounted to `frontend/`:** scratch scripts go in the session
  scratchpad, so nothing leaks into the repo.
- **npm on Windows is a `.ps1` shim** → needs `-ExecutionPolicy Bypass`; the justfile shell already sets it.
