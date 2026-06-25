import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import os from 'os';
// Generated at build time (single-file UI string). Stub exports null in dev.
import { INDEX_HTML, DEFAULT_QUIZ, DEFAULT_FIBBAGE } from './embedded.js';
import { ensureFirewall } from './firewall.js';
import { createGartic } from './gartic.js';
import { createFibbage } from './fibbage.js';

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
const TIME_LIMIT = parseInt(process.env.TIME_LIMIT || '30', 10);
const BASE_POINTS = parseInt(process.env.BASE_POINTS || '100', 10);

// Default quiz: prefer quiz.json on disk, fall back to the embedded one (exe).
// Host can replace it at runtime via upload regardless.
function loadDefaultQuiz() {
  try {
    return JSON.parse(readFileSync(join(__dirname, 'quiz.json'), 'utf-8'));
  } catch {
    return DEFAULT_QUIZ;
  }
}
let quiz = loadDefaultQuiz();

// Fibbage prompt pool ({ normal:[], final:[] }): prefer fibbage_prompts.json on disk,
// fall back to the embedded one (exe).
function loadFibbagePool() {
  try {
    return JSON.parse(readFileSync(join(__dirname, 'fibbage_prompts.json'), 'utf-8'));
  } catch {
    return DEFAULT_FIBBAGE;
  }
}
const fibbagePool = loadFibbagePool();

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

// A choice may be a plain string OR an object { text?, image? }.
// image is any <img src>: a data: URI (base64) or an http(s) URL.
function choiceError(c, n, j) {
  if (typeof c === 'string') return null;
  if (c && typeof c === 'object') {
    if (c.text != null && typeof c.text !== 'string') return `Q${n} choice ${j + 1}: "text" must be a string`;
    if (c.image != null && typeof c.image !== 'string') return `Q${n} choice ${j + 1}: "image" must be a string`;
    if (!c.text && !c.image) return `Q${n} choice ${j + 1}: needs "text" or "image"`;
    return null;
  }
  return `Q${n} choice ${j + 1}: must be a string or { text, image }`;
}

// 'number' = players type a number, closest wins; otherwise multiple choice
function qType(q) {
  return q && q.type === 'number' ? 'number' : 'choice';
}

// section header item — a divider in the flow, not a scored question
function isSection(item) {
  return item && item.type === 'section';
}

function validateQuiz(data) {
  if (!data || typeof data !== 'object') return 'File is not a JSON object';
  if (!Array.isArray(data.questions) || data.questions.length === 0) return 'Missing "questions" array';
  if (!data.questions.some((it) => !isSection(it))) return 'Quiz needs at least one question';
  for (let i = 0; i < data.questions.length; i++) {
    const q = data.questions[i];
    const n = i + 1;
    if (isSection(q)) {
      if (q.title != null && typeof q.title !== 'string') return `Item ${n} (section): "title" must be a string`;
      if (q.image != null && typeof q.image !== 'string') return `Item ${n} (section): "image" must be a string`;
      if (q.description != null && typeof q.description !== 'string') return `Item ${n} (section): "description" must be a string`;
      if (!q.title?.trim() && !q.image) return `Item ${n} (section): needs a title or an image`;
      continue;
    }
    if (!q || typeof q.q !== 'string') return `Q${n}: missing "q" text`;
    if (q.image != null && typeof q.image !== 'string') return `Q${n}: "image" must be a string`;
    if (!q.q.trim() && !q.image) return `Q${n}: needs question text or an image`;
    if (qType(q) === 'number') {
      if (typeof q.answer !== 'number' || !Number.isFinite(q.answer))
        return `Q${n}: number question needs a numeric "answer"`;
    } else {
      if (!Array.isArray(q.choices) || q.choices.length < 2) return `Q${n}: needs at least 2 choices`;
      if (q.choices.length > 6) return `Q${n}: max 6 choices`;
      for (let j = 0; j < q.choices.length; j++) {
        const err = choiceError(q.choices[j], n, j);
        if (err) return err;
      }
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.choices.length)
        return `Q${n}: "answer" must be a 0-based index within choices`;
    }
    if (q.points != null && (typeof q.points !== 'number' || q.points < 0)) return `Q${n}: "points" must be a positive number`;
  }
  return null;
}

// normalize choices to { text, image } so the client never branches on type
function normChoices(choices) {
  return choices.map((c) =>
    typeof c === 'string' ? { text: c, image: null } : { text: c.text || '', image: c.image || null }
  );
}

const app = express();
app.get('/health', (_req, res) => res.json({ ok: true }));
// frontend asks this at runtime to build the QR / join URL — no manual IP entry
app.get('/api/config', (_req, res) => res.json({ lanIp: LAN_IP, timeLimit: TIME_LIMIT }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
  // allow large quiz uploads (base64-embedded images)
  maxHttpBufferSize: 50 * 1024 * 1024, // 50 MB
});

// ---- authoritative game state ----
let mode = 'trivia'; // 'trivia' | 'gartic' | 'fibbage'
const state = {
  phase: 'lobby', // lobby | question | reveal | section | podium
  questionIndex: -1,
  timeRemaining: TIME_LIMIT,
  timeLimit: TIME_LIMIT,
  timeUp: false, // timer hit 0: answering locked, awaiting host reveal
};
// Players persist across disconnects, keyed by lowercased name so reconnecting
// with the same name resumes the same player (score/answers kept).
const players = new Map(); // nameKey -> { id, name, score, answered, choice, connected, socketId }
const socketToKey = new Map(); // socketId -> nameKey
const nameKey = (name) => String(name || '').trim().toLowerCase();
let timer = null;

function currentQuestion() {
  return quiz.questions[state.questionIndex];
}

// total real questions (sections don't count)
function totalQuestionCount() {
  return quiz.questions.filter((it) => !isSection(it)).length;
}
// 1-based number of the question at idx, ignoring sections
function questionNumberAt(idx) {
  let n = 0;
  for (let i = 0; i <= idx && i < quiz.questions.length; i++) if (!isSection(quiz.questions[i])) n++;
  return n;
}
function isLastItem(idx) {
  return idx + 1 >= quiz.questions.length;
}

function playersPublic(withChoice) {
  return [...players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    score: p.score,
    answered: p.answered,
    connected: p.connected,
    ...(withChoice ? { choice: p.choice } : {}),
  }));
}

function buildState() {
  if (mode === 'gartic') {
    // while a game runs, the roster shows only its players (mid-game joiners wait for the
    // next game); in the lobby it shows everyone who'll play.
    // `answered` reuses to mean "submitted this round" so PlayerPanel works unchanged.
    const list = gartic.active()
      ? gartic.getPlayerKeys().map((key) => {
          const p = players.get(key);
          return { id: key, name: p?.name || '?', connected: !!p?.connected, answered: gartic.isSubmitted(key) };
        })
      : [...players.values()].map((p) => ({ id: p.id, name: p.name, connected: p.connected, answered: false }));
    return { mode, title: 'Gartic Phone', players: list, ...gartic.buildState() };
  }
  if (mode === 'fibbage') {
    // roster shows the in-game players while running (with live scores + a ✓ once
    // they've submitted/voted this phase), or everyone in the lobby.
    const list = fibbage.active()
      ? fibbage.getPlayerKeys().map((key) => {
          const p = players.get(key);
          return {
            id: key, name: p?.name || '?', connected: !!p?.connected,
            answered: fibbage.isSubmitted(key), score: fibbage.scoreOf(key),
          };
        })
      : [...players.values()].map((p) => ({ id: p.id, name: p.name, connected: p.connected, answered: false, score: 0 }));
    return { mode, title: 'Fibbage', players: list, ...fibbage.buildState() };
  }
  const out = {
    mode,
    phase: state.phase,
    title: quiz.title || 'Trivia',
    // expose each player's pick ONLY during reveal (no leak mid-question)
    players: playersPublic(state.phase === 'reveal'),
    questionIndex: state.questionIndex,
    totalQuestions: totalQuestionCount(),
    timeRemaining: state.timeRemaining,
    timeLimit: state.timeLimit,
    timeUp: state.timeUp,
  };

  if (state.phase === 'question' || state.phase === 'reveal') {
    const q = currentQuestion();
    out.question = { type: qType(q), text: q.q, image: q.image || null };
    if (qType(q) === 'choice') out.question.choices = normChoices(q.choices);
    out.questionNumber = questionNumberAt(state.questionIndex);
  }
  if (state.phase === 'reveal') {
    const q = currentQuestion();
    if (qType(q) === 'choice') out.correctIndex = q.answer;
    else out.correctAnswer = q.answer;
    out.lastItem = isLastItem(state.questionIndex);
  }
  if (state.phase === 'section') {
    const s = currentQuestion();
    out.section = { title: s.title || '', image: s.image || null, description: s.description || '' };
    out.lastItem = isLastItem(state.questionIndex);
  }
  if (state.phase === 'podium') {
    const sorted = [...players.values()]
      .map((p) => ({ id: p.id, name: p.name, score: p.score }))
      .sort((a, b) => b.score - a.score);
    // standard competition ranking: equal scores share a rank (1, 1, 3, …)
    let rank = 0;
    let prevScore = null;
    out.rankings = sorted.map((p, i) => {
      if (p.score !== prevScore) {
        rank = i + 1;
        prevScore = p.score;
      }
      return { ...p, rank };
    });
  }
  return out;
}

function broadcast() {
  io.emit('state', buildState());
}

const gartic = createGartic({
  io,
  getPlayers: () => players,
  broadcast,
  drawTime: parseInt(process.env.GARTIC_DRAW_TIME || '100', 10),
  guessTime: parseInt(process.env.GARTIC_GUESS_TIME || '60', 10),
});

const fibbage = createFibbage({
  io,
  getPlayers: () => players,
  broadcast,
  getPool: () => fibbagePool,
  answerTime: parseInt(process.env.FIBBAGE_ANSWER_TIME || '60', 10),
  voteTime: parseInt(process.env.FIBBAGE_VOTE_TIME || '100', 10),
});

function allAnswered() {
  // only connected players can answer — don't let a disconnected player block the reveal
  const ps = [...players.values()].filter((p) => p.connected);
  return ps.length > 0 && ps.every((p) => p.answered);
}

// send a private event to a player if they currently have a live socket
function emitToPlayer(p, event, payload) {
  if (p.connected && p.socketId) io.to(p.socketId).emit(event, payload);
}

function startTimer() {
  clearInterval(timer);
  state.timeRemaining = state.timeLimit;
  state.timeUp = false;
  broadcast();
  timer = setInterval(() => {
    state.timeRemaining -= 1;
    if (state.timeRemaining <= 0) {
      // time's up: lock answering, but wait for the host to reveal (no auto-reveal)
      clearInterval(timer);
      state.timeRemaining = 0;
      state.timeUp = true;
      broadcast();
    } else {
      // lightweight per-second update — avoids re-sending question images every tick
      io.emit('tick', state.timeRemaining);
    }
  }, 1000);
}

function reveal() {
  clearInterval(timer);
  state.phase = 'reveal';
  const q = currentQuestion();
  const pts = q.points || BASE_POINTS;

  if (qType(q) === 'number') {
    const ans = q.answer;
    // closest guess(es) win; ties all win
    let min = Infinity;
    for (const p of players.values()) {
      if (typeof p.choice === 'number') min = Math.min(min, Math.abs(p.choice - ans));
    }
    for (const p of players.values()) {
      const has = typeof p.choice === 'number';
      const dist = has ? Math.abs(p.choice - ans) : null;
      const win = has && min !== Infinity && dist === min;
      if (win) p.score += pts;
      emitToPlayer(p, 'result', {
        correct: win,
        gained: win ? pts : 0,
        yourAnswer: has ? p.choice : null,
        correctAnswer: ans,
        distance: dist,
      });
    }
  } else {
    for (const p of players.values()) {
      const correct = p.choice === q.answer;
      if (correct) p.score += pts;
      // private per-player feedback (others never see this)
      emitToPlayer(p, 'result', { correct, gained: correct ? pts : 0, yourChoice: p.choice });
    }
  }
  broadcast();
}

// move to a specific item; dispatch by type (section pauses for the host, question runs the timer)
function gotoItem(idx) {
  clearInterval(timer);
  if (idx >= quiz.questions.length) {
    state.phase = 'podium';
    state.questionIndex = idx;
    broadcast();
    return;
  }
  state.questionIndex = idx;
  if (isSection(quiz.questions[idx])) {
    state.phase = 'section';
    broadcast(); // no timer; host advances with host:next
    return;
  }
  state.phase = 'question';
  for (const p of players.values()) {
    p.answered = false;
    p.choice = null;
  }
  startTimer();
}

function advance() {
  gotoItem(state.questionIndex + 1);
}

function resetGame() {
  clearInterval(timer);
  state.phase = 'lobby';
  state.questionIndex = -1;
  state.timeRemaining = state.timeLimit;
  state.timeUp = false;
  for (const p of players.values()) {
    p.score = 0;
    p.answered = false;
    p.choice = null;
  }
  broadcast();
}

io.on('connection', (socket) => {
  // send current snapshot to the freshly connected client
  socket.emit('state', buildState());

  socket.on('host:join', () => {
    socket.join('host');
    socket.emit('state', buildState());
  });

  socket.on('host:setmode', (m) => {
    mode = m === 'gartic' ? 'gartic' : m === 'fibbage' ? 'fibbage' : 'trivia';
    gartic.reset();
    fibbage.reset();
    resetGame(); // trivia back to lobby; harmless for the other modes
    broadcast();
  });

  socket.on('player:join', (name, cb) => {
    const clean = String(name || '').trim().slice(0, 16) || 'Player';
    const key = nameKey(clean);
    let p = players.get(key);
    if (p) {
      // reconnect / resume — keep score, answers, everything
      p.connected = true;
      p.socketId = socket.id;
      p.name = clean;
    } else {
      p = { id: key, name: clean, score: 0, answered: false, choice: null, connected: true, socketId: socket.id };
      players.set(key, p);
    }
    socketToKey.set(socket.id, key);
    if (typeof cb === 'function') cb({ id: p.id });
    broadcast();
    if (mode === 'gartic' && gartic.active()) {
      if (gartic.isInGame(key)) gartic.sendTaskTo(key); // reconnect → resume current task
      else socket.emit('gartic:task', { type: 'spectator' }); // mid-game joiner → spectate
    }
    if (mode === 'fibbage' && fibbage.active()) {
      if (fibbage.isInGame(key)) fibbage.syncTo(key); // reconnect → resume locked/unlocked state
      else socket.emit('fibbage:sync', { spectator: true }); // mid-game joiner → spectate
    }
  });

  socket.on('host:loadquiz', (data, cb) => {
    const err = validateQuiz(data);
    if (err) {
      if (typeof cb === 'function') cb({ ok: false, error: err });
      return;
    }
    quiz = { title: data.title || 'Trivia', questions: data.questions };
    resetGame(); // back to lobby, scores cleared, broadcast new title/count
    if (typeof cb === 'function') cb({ ok: true, title: quiz.title, count: quiz.questions.length });
  });

  socket.on('host:start', () => {
    if (mode === 'gartic') {
      if (gartic.active()) return; // already running
      const keys = [...players.values()].filter((p) => p.connected).map((p) => p.id);
      if (keys.length < 2) return; // need at least 2 players
      gartic.start(keys);
      return;
    }
    if (mode === 'fibbage') {
      if (fibbage.active()) return; // already running
      const keys = [...players.values()].filter((p) => p.connected).map((p) => p.id);
      if (keys.length < 2) return; // need at least 2 players
      fibbage.start(keys);
      return;
    }
    if (state.phase !== 'lobby' && state.phase !== 'podium') return;
    for (const p of players.values()) p.score = 0;
    state.questionIndex = -1;
    advance();
  });

  // ---- gartic phone events ----
  socket.on('gartic:submit', (payload) => {
    const key = socketToKey.get(socket.id);
    if (mode !== 'gartic' || !key) return;
    const obj = payload && typeof payload === 'object';
    // accept {round, content, frames} (current) or a bare content value (older client)
    gartic.submit(key, obj ? payload.round : undefined, obj ? payload.content : payload, obj ? payload.frames : null);
  });
  socket.on('gartic:draft', (payload) => {
    const key = socketToKey.get(socket.id);
    if (mode !== 'gartic' || !key || !(payload && typeof payload === 'object')) return;
    gartic.draft(key, payload.round, payload.content, payload.frames);
  });
  socket.on('gartic:next', () => {
    if (mode === 'gartic') gartic.next();
  });
  socket.on('gartic:reveal', (dir) => {
    if (mode === 'gartic') gartic.revealNav(dir > 0 ? 1 : -1);
  });

  // ---- fibbage events ----
  socket.on('fibbage:submit', (payload, cb) => {
    const key = socketToKey.get(socket.id);
    if (mode !== 'fibbage' || !key) {
      if (typeof cb === 'function') cb({ ok: false, reason: 'inactive' });
      return;
    }
    const obj = payload && typeof payload === 'object';
    const res = fibbage.submitLie(key, obj ? payload.promptIndex : undefined, obj ? payload.text : payload);
    if (typeof cb === 'function') cb(res);
  });
  socket.on('fibbage:draft', (payload) => {
    const key = socketToKey.get(socket.id);
    if (mode !== 'fibbage' || !key || !(payload && typeof payload === 'object')) return;
    fibbage.draftLie(key, payload.promptIndex, payload.text);
  });
  socket.on('fibbage:vote', (payload) => {
    const key = socketToKey.get(socket.id);
    if (mode !== 'fibbage' || !key || !(payload && typeof payload === 'object')) return;
    fibbage.vote(key, payload.promptIndex, payload.cardId, payload.thumbId ?? null);
  });
  socket.on('fibbage:next', () => {
    if (mode === 'fibbage') fibbage.next();
  });

  socket.on('player:answer', (value) => {
    if (state.phase !== 'question' || state.timeUp) return; // locked once time's up
    const p = players.get(socketToKey.get(socket.id));
    if (!p || p.answered) return;
    if (qType(currentQuestion()) === 'number') {
      const num = Number(value);
      if (!Number.isFinite(num)) return; // ignore invalid numeric entry
      p.choice = num;
    } else {
      p.choice = value; // choice index
    }
    p.answered = true;
    broadcast(); // host decides when to reveal (timer still auto-reveals at 0)
  });

  socket.on('host:reveal', () => {
    if (state.phase === 'question') reveal();
  });

  socket.on('host:next', () => {
    // advance after a reveal, or continue past a section header
    if (state.phase !== 'reveal' && state.phase !== 'section') return;
    advance();
  });

  socket.on('host:reset', () => {
    if (mode === 'gartic') {
      gartic.reset(); // back to gartic lobby
      broadcast();
      return;
    }
    if (mode === 'fibbage') {
      fibbage.reset(); // back to fibbage lobby
      broadcast();
      return;
    }
    resetGame();
  });

  socket.on('disconnect', () => {
    const key = socketToKey.get(socket.id);
    socketToKey.delete(socket.id);
    if (!key) return;
    const p = players.get(key);
    // only mark offline if this socket is still the player's active one
    // (a reconnect may have already taken over the slot)
    if (p && p.socketId === socket.id) {
      p.connected = false;
      p.socketId = null;
      // broadcast so the host's Reveal button can enable if the remaining
      // connected players have all answered
      broadcast();
    }
  });
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
  console.log(`Trivia server on :${PORT} | ${quiz.questions.length} questions | ${TIME_LIMIT}s timer`);
  if (servingUI) {
    const host = LAN_IP || 'localhost';
    console.log(`\n  Open on this PC : http://localhost:${PORT}`);
    console.log(`  Players join at : http://${host}:${PORT}   (same Wi-Fi)\n`);
  } else {
    console.log(`LAN IP: ${LAN_IP || 'unknown'} (UI served by Vite in dev)`);
  }
});
