# Local Wi-Fi Trivia — task runner.  Run `just` to list recipes.
set shell := ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command"]

# show all recipes
default:
    @just --list

# ---------- dev (Docker, hot reload) ----------

# start the dev stack with auto-detected LAN IP (recommended)
dev:
    powershell -ExecutionPolicy Bypass -File start.ps1

# build + start containers in the background
up:
    docker compose up -d --build --renew-anon-volumes

# stop containers
down:
    docker compose down

# follow logs
logs:
    docker compose logs -f

# restart containers (after editing server/quiz — nodemon usually handles it)
restart:
    docker compose restart

# ---------- tests ----------

# run the backend game-logic tests (in-process: fake clock, no sockets, no Docker)
test:
    cd backend; npm test

# ---------- production / single exe ----------

# build the single self-contained executable -> ./trivia.exe
build-exe:
    npm run build:exe

# build just the single-file web UI
build-web:
    npm run build:web

# embed the built UI into the backend
bundle:
    npm run bundle

# bundle the backend -> build/server.cjs
build-server:
    npm run build:server

# build everything then run the bundled server (one port, no Docker)
prod: build-web bundle build-server
    npm run start:prod

# build the shareable distributable (the exe) and report where it is
deploy: build-exe
    @Write-Host "Distributable ready: ./trivia.exe — copy to any PC and run it."

# ---------- firewall (needs admin; self-elevates) ----------

# allow phones through Windows Firewall (TCP 5173 + 3001, Private)
firewall-open:
    powershell -ExecutionPolicy Bypass -File scripts/open-firewall.ps1

# remove those firewall rules
firewall-close:
    powershell -ExecutionPolicy Bypass -File scripts/close-firewall.ps1

# ---------- cleanup ----------

# stop containers (with volumes) and remove build artifacts
clean:
    docker compose down -v
    Remove-Item -Recurse -Force build, frontend/dist, trivia.exe, trivia -ErrorAction SilentlyContinue
