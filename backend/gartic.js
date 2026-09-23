// Gartic Phone / Telestrations mode.
//
// N players → N "books". Book b is seeded by player b's prompt (round 0), then
// passed around: at round r, player p works book (p + shift[r]) mod N. shift[0]=0
// (everyone seeds their own), shift[1..N-1] is a shuffled permutation of 1..N-1.
// That's a Latin square, so every book is touched by every player exactly once and
// nobody ever works their own book twice or sees their own previous entry.
// Rounds alternate: 0 = prompt, odd = draw, even(>0) = guess.

import { allDone, connectedKeys, isStale, roster, shuffle } from './shared.js';

// Drawing flipbooks are full-res PNG snapshots; cap how many we keep per entry so a
// long drawing can't balloon a submit past the socket buffer or bloat reveal broadcasts.
export const MAX_FRAMES = 40;

// keep only string frames, thinned evenly to at most MAX_FRAMES (first + last kept)
export function sanitizeFrames(frames) {
  if (!Array.isArray(frames)) return null;
  const list = frames.filter((f) => typeof f === 'string');
  if (list.length === 0) return null;
  if (list.length <= MAX_FRAMES) return list;
  const out = [];
  for (let i = 0; i < MAX_FRAMES; i++) out.push(list[Math.round((i * (list.length - 1)) / (MAX_FRAMES - 1))]);
  return out;
}

function range(a, b) {
  const r = [];
  for (let i = a; i < b; i++) r.push(i);
  return r;
}

export function createGartic({ getPlayers, send, broadcast, createTimer, newGameId, rng = Math.random, drawTime = 100, guessTime = 60 }) {
  let g = null; // null = inactive (mode lobby)
  const timer = createTimer();

  const taskType = (round) => (round === 0 ? 'prompt' : round % 2 === 1 ? 'draw' : 'guess');
  const timeForRound = (round) => (taskType(round) === 'draw' ? drawTime : guessTime);
  const nameOf = (key) => getPlayers().get(key)?.name || '?';
  const stepOf = () => `${g.gameId}:${g.round}`;

  function start(playerKeys) {
    if (g || playerKeys.length < 2) return; // already running / need at least 2 players
    const N = playerKeys.length;
    const shifts = [0, ...shuffle(range(1, N), rng)];
    const assign = shifts.map((s) => playerKeys.map((_, p) => (p + s) % N)); // assign[round][playerIdx] = bookIdx
    const books = playerKeys.map(() => []); // books[b][round] = { type, authorKey, content, frames }
    g = {
      gameId: newGameId(),
      phase: 'round',
      round: 0,
      totalRounds: N,
      playerKeys,
      assign,
      books,
      submitted: new Set(),
      drafts: {},
      reveal: null,
    };
    beginRound();
  }

  function beginRound() {
    g.submitted = new Set();
    g.drafts = {}; // key -> latest in-progress content (used if they never formally submit)
    timer.start(timeForRound(g.round)); // 100s draw, 60s prompt/guess
    for (const key of g.playerKeys) sendTaskTo(key);
    broadcast();
  }

  function taskFor(pIdx) {
    const book = g.assign[g.round][pIdx];
    const prev = g.round > 0 ? g.books[book][g.round - 1]?.content ?? null : null;
    // `done` lets a reconnecting player who already submitted resume in the locked state
    return {
      gameId: g.gameId,
      step: stepOf(),
      round: g.round,
      type: taskType(g.round),
      prev,
      timeLimit: timer.snapshot().timeLimit,
      done: g.submitted.has(g.playerKeys[pIdx]),
    };
  }

  // (re)send the current task to one in-game player
  function sendTaskTo(key) {
    if (!g || g.phase !== 'round') return;
    const pIdx = g.playerKeys.indexOf(key);
    if (pIdx >= 0) send(key, 'gartic:task', taskFor(pIdx));
  }

  function onJoin(key) {
    if (!g) return;
    if (g.playerKeys.includes(key)) sendTaskTo(key); // reconnect → resume current task
    else send(key, 'gartic:task', { type: 'spectator', gameId: g.gameId }); // mid-game joiner → spectate
  }

  // round/gameId tags reject stale emits from a previous round or game
  const staleFor = (p) => !g || g.phase !== 'round' || isStale(p?.round, g.round) || isStale(p?.gameId, g.gameId);

  function submit(key, p) {
    if (staleFor(p)) return;
    const pIdx = g.playerKeys.indexOf(key);
    if (pIdx < 0 || g.submitted.has(key)) return;
    const book = g.assign[g.round][pIdx];
    g.books[book][g.round] = { type: taskType(g.round), authorKey: key, content: p.content ?? null, frames: sanitizeFrames(p.frames) };
    g.submitted.add(key);
    delete g.drafts[key];
    broadcast();
  }

  // periodic in-progress snapshot — the safety net so a connected player's latest
  // work is used even if they never tap submit (timeout / host advances instantly).
  function draft(key, p) {
    if (staleFor(p)) return;
    if (g.playerKeys.indexOf(key) < 0 || g.submitted.has(key)) return;
    // keep existing frames if this draft (heartbeat) didn't carry any
    const prev = g.drafts[key];
    g.drafts[key] = { content: p.content ?? null, frames: sanitizeFrames(p.frames) || prev?.frames || null };
  }

  const allSubmitted = () => allDone(getPlayers(), g.playerKeys, (k) => g.submitted.has(k));
  const canAdvance = () => !!g && g.phase === 'round' && (allSubmitted() || timer.timeUp);

  function next() {
    if (!canAdvance()) return; // host can only advance when ready
    timer.stop();
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
      timer.idle(0);
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
    if (g) timer.idle(0);
    g = null;
  }

  function snapshot() {
    const players = getPlayers();
    // while a game runs, the roster shows only its players (mid-game joiners wait for the
    // next game); in the lobby it shows everyone who'll play.
    // `answered` means "submitted this round" so PlayerPanel works unchanged.
    if (!g) {
      return { phase: 'lobby', title: 'Gartic Phone', gameId: 0, step: 'lobby', players: roster(players, null, () => ({ answered: false })) };
    }
    const out = {
      phase: g.phase,
      title: 'Gartic Phone',
      gameId: g.gameId,
      step: g.phase === 'round' ? stepOf() : `${g.gameId}:reveal`,
      players: roster(players, g.playerKeys, (k) => ({ answered: g.phase === 'round' && g.submitted.has(k) })),
      round: g.round,
      totalRounds: g.totalRounds,
      canAdvance: canAdvance(),
      ...timer.snapshot(),
    };
    if (g.phase === 'round') {
      const conn = connectedKeys(players, g.playerKeys);
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
        frames: e?.frames || null, // drawing process for replay (PNG snapshot flipbook)
        author: nameOf(e?.authorKey),
        atStart: book === 0 && entry === 0,
        atEnd: book === g.playerKeys.length - 1 && entry === g.totalRounds - 1,
      };
    }
    return out;
  }

  const obj = (payload) => (payload && typeof payload === 'object' ? payload : null);
  const events = {
    'gartic:submit': ({ key, payload }) => {
      if (!key) return;
      // accept {round, content, frames} (current) or a bare content value (older client)
      submit(key, obj(payload) || { content: payload });
    },
    'gartic:draft': ({ key, payload }) => {
      if (key && obj(payload)) draft(key, payload);
    },
    'gartic:next': () => next(),
    'gartic:reveal': ({ payload }) => revealNav(payload > 0 ? 1 : -1),
  };

  return { start, reset, snapshot, onJoin, events };
}
