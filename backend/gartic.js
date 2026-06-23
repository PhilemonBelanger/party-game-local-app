// Gartic Phone / Telestrations mode.
//
// N players → N "books". Book b is seeded by player b's prompt (round 0), then
// passed around: at round r, player p works book (p + shift[r]) mod N. shift[0]=0
// (everyone seeds their own), shift[1..N-1] is a shuffled permutation of 1..N-1.
// That's a Latin square, so every book is touched by every player exactly once and
// nobody ever works their own book twice or sees their own previous entry.
// Rounds alternate: 0 = prompt, odd = draw, even(>0) = guess.

function range(a, b) {
  const r = [];
  for (let i = a; i < b; i++) r.push(i);
  return r;
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createGartic({ io, getPlayers, broadcast, drawTime = 100, guessTime = 60 }) {
  let g = null; // null = inactive (mode lobby)

  const taskType = (round) => (round === 0 ? 'prompt' : round % 2 === 1 ? 'draw' : 'guess');
  const timeForRound = (round) => (taskType(round) === 'draw' ? drawTime : guessTime);
  const nameOf = (key) => getPlayers().get(key)?.name || '?';

  function inGameConnected() {
    const players = getPlayers();
    return g.playerKeys.filter((k) => players.get(k)?.connected);
  }

  function start(playerKeys) {
    const N = playerKeys.length;
    const shifts = [0, ...shuffle(range(1, N))];
    const assign = shifts.map((s) => playerKeys.map((_, p) => (p + s) % N)); // assign[round][playerIdx] = bookIdx
    const books = playerKeys.map(() => []); // books[b][round] = { type, authorKey, content }
    g = {
      phase: 'round',
      round: 0,
      totalRounds: N,
      playerKeys,
      assign,
      books,
      submitted: new Set(),
      drafts: {},
      timeLimit: guessTime,
      timeRemaining: guessTime,
      timeUp: false,
      timer: null,
      reveal: null,
    };
    beginRound();
  }

  function beginRound() {
    clearInterval(g.timer);
    g.submitted = new Set();
    g.drafts = {}; // key -> latest in-progress content (used if they never formally submit)
    g.timeUp = false;
    g.timeLimit = timeForRound(g.round); // 100s draw, 60s prompt/guess
    g.timeRemaining = g.timeLimit;
    sendTasks();
    broadcast();
    g.timer = setInterval(() => {
      g.timeRemaining -= 1;
      if (g.timeRemaining <= 0) {
        clearInterval(g.timer);
        g.timeRemaining = 0;
        g.timeUp = true; // lock input; host still advances
        broadcast();
      } else {
        io.emit('tick', g.timeRemaining);
      }
    }, 1000);
  }

  function taskFor(pIdx) {
    const book = g.assign[g.round][pIdx];
    const prev = g.round > 0 ? g.books[book][g.round - 1]?.content ?? null : null;
    // `done` lets a reconnecting player who already submitted resume in the locked state
    return { round: g.round, type: taskType(g.round), prev, timeLimit: g.timeLimit, done: g.submitted.has(g.playerKeys[pIdx]) };
  }

  function sendTasks() {
    const players = getPlayers();
    g.playerKeys.forEach((key, pIdx) => {
      const p = players.get(key);
      if (p?.connected && p.socketId) io.to(p.socketId).emit('gartic:task', taskFor(pIdx));
    });
  }

  // resend the current task to a (re)connecting player
  function sendTaskTo(key) {
    if (!g || g.phase !== 'round') return;
    const pIdx = g.playerKeys.indexOf(key);
    if (pIdx < 0) return;
    const p = getPlayers().get(key);
    if (p?.connected && p.socketId) io.to(p.socketId).emit('gartic:task', taskFor(pIdx));
  }

  function submit(key, round, content, frames) {
    // validate round only when the client provides it (tolerates older clients that don't)
    if (!g || g.phase !== 'round' || (round != null && round !== g.round)) return;
    const pIdx = g.playerKeys.indexOf(key);
    if (pIdx < 0 || g.submitted.has(key)) return;
    const book = g.assign[g.round][pIdx];
    g.books[book][g.round] = { type: taskType(g.round), authorKey: key, content, frames: frames || null };
    g.submitted.add(key);
    delete g.drafts[key];
    broadcast();
  }

  // periodic in-progress snapshot — the safety net so a connected player's latest
  // work is used even if they never tap submit (timeout / host advances instantly).
  function draft(key, round, content, frames) {
    if (!g || g.phase !== 'round' || (round != null && round !== g.round)) return;
    if (g.playerKeys.indexOf(key) < 0 || g.submitted.has(key)) return;
    // keep existing frames if this draft (heartbeat) didn't carry any
    const prev = g.drafts[key];
    g.drafts[key] = { content, frames: frames || prev?.frames || null };
  }

  function allSubmitted() {
    const conn = inGameConnected();
    return conn.length > 0 && conn.every((k) => g.submitted.has(k));
  }

  function next() {
    if (!g || g.phase !== 'round') return;
    if (!allSubmitted() && !g.timeUp) return; // host can only advance when ready
    advanceRound();
  }

  function advanceRound() {
    clearInterval(g.timer);
    // fill any non-submitted entries: use the latest draft if we have one,
    // otherwise a placeholder (truly absent / disconnected before drawing anything)
    g.playerKeys.forEach((key, pIdx) => {
      if (!g.submitted.has(key)) {
        const book = g.assign[g.round][pIdx];
        const t = taskType(g.round);
        const d = g.drafts[key];
        const content = d !== undefined ? d.content : t === 'draw' ? null : '(no answer)';
        g.books[book][g.round] = { type: t, authorKey: key, content, frames: d?.frames || null };
      }
    });
    g.round += 1;
    if (g.round >= g.totalRounds) {
      g.phase = 'reveal';
      g.reveal = { book: 0, entry: 0 };
      broadcast();
      return;
    }
    beginRound();
  }

  function revealNav(dir) {
    if (!g || g.phase !== 'reveal') return;
    const books = g.playerKeys.length;
    let { book, entry } = g.reveal;
    if (dir > 0) {
      entry += 1;
      if (entry >= g.totalRounds) {
        book += 1;
        entry = 0;
      }
      if (book >= books) {
        book = books - 1;
        entry = g.totalRounds - 1;
      }
    } else {
      entry -= 1;
      if (entry < 0) {
        book -= 1;
        entry = g.totalRounds - 1;
      }
      if (book < 0) {
        book = 0;
        entry = 0;
      }
    }
    g.reveal = { book, entry };
    broadcast();
  }

  function reset() {
    if (g) clearInterval(g.timer);
    g = null;
  }

  function buildState() {
    if (!g) return { phase: 'lobby' };
    const out = {
      phase: g.phase,
      round: g.round,
      totalRounds: g.totalRounds,
      timeRemaining: g.timeRemaining,
      timeLimit: g.timeLimit,
      timeUp: g.timeUp,
    };
    if (g.phase === 'round') {
      const conn = inGameConnected();
      out.taskType = taskType(g.round);
      out.submittedCount = conn.filter((k) => g.submitted.has(k)).length;
      out.totalInGame = conn.length;
    }
    if (g.phase === 'reveal') {
      const { book, entry } = g.reveal;
      const e = g.books[book]?.[entry];
      out.reveal = {
        book,
        entry,
        totalBooks: g.playerKeys.length,
        totalEntries: g.totalRounds,
        seedAuthor: nameOf(g.playerKeys[book]),
        seedPrompt: g.books[book]?.[0]?.content ?? null, // for exact-match detection

        type: e?.type || null,
        content: e?.content ?? null,
        frames: e?.frames || null, // drawing process for replay (snapshot flipbook)
        author: nameOf(e?.authorKey),
        atStart: book === 0 && entry === 0,
        atEnd: book === g.playerKeys.length - 1 && entry === g.totalRounds - 1,
      };
    }
    return out;
  }

  const isSubmitted = (key) => !!g && g.phase === 'round' && g.submitted.has(key);
  // a player is "in" the current game only if they were present when it started;
  // mid-game joiners are not in playerKeys → they spectate until the next game
  const isInGame = (key) => !!g && g.playerKeys.includes(key);
  const getPlayerKeys = () => (g ? g.playerKeys : []);

  return { start, submit, draft, next, revealNav, reset, buildState, sendTaskTo, isSubmitted, isInGame, getPlayerKeys, active: () => !!g };
}
