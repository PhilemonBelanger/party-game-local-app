// Process entry: config, HTTP/static serving, and the Socket.IO adapter onto the hub.
// Game logic lives in hub.js (players, dispatch) and trivia.js / gartic.js / fibbage.js.
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import os from 'os';
// Dev stub exports INDEX_HTML=null; the prod/exe bundle swaps in build/embedded.js (real UI).
import { INDEX_HTML, DEFAULT_QUIZ, DEFAULT_FIBBAGE } from './embedded.js';
import { ensureFirewall } from './firewall.js';
import { createHub } from './hub.js';
import { configFromEnv, createModes } from './modes.js';

// ESM dev: derive from import.meta.url. Bundled CJS (exe): that's undefined, so
// fall back to the working dir (the exe relies on embedded assets anyway).
const __dirname = (() => {
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    return process.cwd();
  }
})();

const PORT = parseInt(process.env.PORT || '3001', 10);
const config = configFromEnv();

// Prefer the JSON file on disk, fall back to the embedded copy (exe).
function loadJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(join(__dirname, file), 'utf-8'));
  } catch {
    return fallback;
  }
}
const defaultQuiz = loadJson('quiz.json', DEFAULT_QUIZ); // host can replace it at runtime
const fibbagePool = loadJson('fibbage_prompts.json', DEFAULT_FIBBAGE); // { normal:[], final:[] }

// Best-effort LAN IP detection (skips loopback, VPN, WSL, virtual adapters).
// Works when the server runs on the host (exe); inside Docker it sees the
// container IP, so HOST_LAN_IP env overrides it there.
function detectLanIp() {
  const skip = /(vethernet|wsl|hyper-?v|virtual|vmware|virtualbox|nordlynx|vpn|tailscale|zerotier|tap|loopback|docker|utun)/i;
  const cands = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (skip.test(name)) continue;
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) cands.push(a.address);
    }
  }
  const score = (ip) =>
    ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3;
  cands.sort((x, y) => score(x) - score(y));
  return cands[0] || null;
}
const LAN_IP = (process.env.HOST_LAN_IP || '').trim() || detectLanIp();

const app = express();
app.get('/health', (_req, res) => res.json({ ok: true }));
// frontend asks this at runtime to build the QR / join URL — no manual IP entry
app.get('/api/config', (_req, res) => res.json({ lanIp: LAN_IP, timeLimit: config.timeLimit }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
  // allow large quiz uploads (base64-embedded images) and drawing flipbooks
  maxHttpBufferSize: 50 * 1024 * 1024, // 50 MB
});

const hub = createHub({
  transport: {
    toSocket: (socketId, event, payload) => io.to(socketId).emit(event, payload),
    toAll: (event, payload) => io.emit(event, payload),
  },
  makeModes: (ctx) => createModes(ctx, { config, quiz: defaultQuiz, fibbagePool }),
});

io.on('connection', (socket) => {
  hub.connect(socket.id);
  for (const event of hub.eventNames) {
    socket.on(event, (payload, cb) => hub.handle(socket.id, event, payload, cb));
  }
  socket.on('disconnect', () => hub.disconnect(socket.id));
});

// --- serve the frontend (single-server / exe mode) ---
// Embedded single-file build wins; else a ./public dir; else nothing (dev: Vite serves it).
const PUBLIC_DIR = join(__dirname, 'public');
const servingUI = !!INDEX_HTML || existsSync(PUBLIC_DIR);
if (INDEX_HTML) {
  app.get(/^\/(?!socket\.io|api\/|health).*/, (_req, res) => res.type('html').send(INDEX_HTML));
} else if (existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
  app.get(/^\/(?!socket\.io|api\/|health).*/, (_req, res) => res.sendFile(join(PUBLIC_DIR, 'index.html')));
}

// Exit cleanly when the terminal window is closed or the process is signalled.
// On Windows, closing the console window raises SIGHUP (and SIGBREAK on Ctrl+Break);
// without a handler Node lingers up to the OS kill timeout — handle them to exit now.
let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  try { io.close(); } catch {}
  try { httpServer.close(); } catch {}
  // give close() a beat, then force-exit so nothing keeps the process alive
  setTimeout(() => process.exit(0), 300).unref();
}
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
  process.on(sig, shutdown);
}

// When this process serves the UI on the LAN (exe / prod on Windows), make sure
// the firewall lets phones in. No-op on Linux (Docker dev) and when SKIP_FIREWALL=1.
if (servingUI) ensureFirewall([PORT]);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Trivia server on :${PORT} | ${defaultQuiz.questions.length} questions | ${config.timeLimit}s timer`);
  if (servingUI) {
    const host = LAN_IP || 'localhost';
    console.log(`\n  Open on this PC : http://localhost:${PORT}`);
    console.log(`  Players join at : http://${host}:${PORT}   (same Wi-Fi)\n`);
  } else {
    console.log(`LAN IP: ${LAN_IP || 'unknown'} (UI served by Vite in dev)`);
  }
});
