// Fibbage mode — bluffing trivia.
//
// Each prompt is a fill-in-the-blank fact. Players invent a fake answer ("lie"); the
// real answer is mixed in with all the lies. Everyone votes on which one is true.
// Score: guess the truth, fool others into picking your lie, collect thumbs-up.
//
// Phases per prompt: answer → vote → reveal (repeat for N prompts) → podium.
// Same shape as gartic.js: host-driven advancement, per-phase timer with timeUp lock,
// drafts as the safety net so in-progress text isn't lost.

import { allDone, connectedKeys, isStale, rankings, roster, shuffle } from './shared.js';

export const DEFAULT_POINTS = {
  truth: 150, // guessed the real answer
  vote: 100, // per vote your lie fooled
  thumb: 50, // most-thumbed lie bonus
  truthAttempt: 100, // typed the real answer (got the "pick something else" popup)
};

// normalize for both truth-matching and coalescing: strip accents, trim, collapse
// whitespace, lowercase. Accent-folding lets "Détroit"/"detroit" and "café"/"cafe" match,
// which matters for the bilingual truth check (a FR answer typed without accents still blocks).
export const norm = (s) =>
  String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().replace(/\s+/g, ' ').toLowerCase();
// strip HTML tags (e.g. <i>…</i>) but keep the literal <BLANK> placeholder token
export const stripHtml = (s) => String(s || '').replace(/<(?!BLANK>)[^>]+>/g, '');

// Pure scoring for one prompt. No mutation, no emits.
// cards: [{ id, authorKeys, isTruth }], votes/thumbs: key -> cardId, truthAttempts: key -> true.
// Returns per-player breakdown, per-card thumb counts, and thumbs each author collected.
export function scorePrompt({ playerKeys, cards, votes, thumbs, truthAttempts }, points = DEFAULT_POINTS, thumbMin = 2) {
  const voteCount = {}; // cardId -> votes
  const thumbCount = {}; // cardId -> thumbs
  for (const cid of Object.values(votes)) voteCount[cid] = (voteCount[cid] || 0) + 1;
  for (const cid of Object.values(thumbs)) thumbCount[cid] = (thumbCount[cid] || 0) + 1;

  const truthCard = cards.find((c) => c.isTruth);
  const gained = Object.fromEntries(
    playerKeys.map((k) => [k, { guessedRight: false, votesOnYou: 0, thumbBonus: false, triedTruth: false, total: 0 }])
  );
  const thumbsByAuthor = Object.fromEntries(playerKeys.map((k) => [k, 0]));

  for (const key of playerKeys) {
    if (truthAttempts[key]) {
      gained[key].triedTruth = true;
      gained[key].total += points.truthAttempt;
    }
  }
  for (const [key, cid] of Object.entries(votes)) {
    if (truthCard && cid === truthCard.id && gained[key]) {
      gained[key].guessedRight = true;
      gained[key].total += points.truth;
    }
  }
  // per vote to each author of a (non-truth) card; authorless filler cards score for nobody
  for (const card of cards) {
    if (card.isTruth) continue;
    const n = voteCount[card.id] || 0;
    if (!n) continue;
    for (const key of card.authorKeys) {
      if (!gained[key]) continue;
      gained[key].votesOnYou += n;
      gained[key].total += n * points.vote;
    }
  }
  // bonus to authors of the most-thumbed non-truth card(s), only if it reached thumbMin (ties all win)
  let maxThumb = 0;
  for (const card of cards) {
    if (card.isTruth) continue;
    const th = thumbCount[card.id] || 0;
    if (th > maxThumb) maxThumb = th;
    for (const key of card.authorKeys) if (thumbsByAuthor[key] != null) thumbsByAuthor[key] += th;
  }
  if (maxThumb >= thumbMin) {
    for (const card of cards) {
      if (card.isTruth || (thumbCount[card.id] || 0) !== maxThumb) continue;
      for (const key of card.authorKeys) {
        if (!gained[key]) continue;
        gained[key].thumbBonus = true;
        gained[key].total += points.thumb;
      }
    }
  }
  return { gained, thumbCount, thumbsByAuthor, truthId: truthCard ? truthCard.id : null };
}

export function createFibbage({
  getPlayers, send, broadcast, createTimer, newGameId, getPool, rng = Math.random,
  answerTime = 60, voteTime = 100, promptsPerGame = 10, points = DEFAULT_POINTS, thumbMin = 2, maxSuggestions = 3,
}) {
  let g = null; // null = inactive (mode lobby)
  const timer = createTimer();

  const nameOf = (key) => getPlayers().get(key)?.name || '?';
  const curPrompt = () => g.prompts[g.promptIndex];
  const stepOf = () => `${g.gameId}:${g.promptIndex}:${g.phase}`;

  function pickPrompts() {
    const pool = getPool() || {};
    const all = [...(pool.normal || []), ...(pool.final || [])];
    const chosen = shuffle(all, rng).slice(0, Math.min(promptsPerGame, all.length));
    return chosen.map((p) => {
      const sug = Array.isArray(p.suggestions) ? p.suggestions : [];
      const sugFR = Array.isArray(p.suggestionsFR) ? p.suggestionsFR : [];
      return {
        category: p.category || '',
        question: stripHtml(p.question || ''),
        questionFR: stripHtml(p.questionFR || p.question || ''),
        answer: String(p.answer ?? ''),
        answerFR: String(p.answerFR ?? p.answer ?? ''),
        // accepted "this is the truth" strings — BOTH languages, so a FR player typing the
        // FR answer (or an EN player the EN answer) is blocked regardless of host language.
        truthSet: new Set(
          [p.answer, ...(p.alternateSpellings || []), p.answerFR, ...(p.alternateSpellingsFR || [])].map(norm).filter(Boolean)
        ),
        // paired EN/FR suggestions so filler cards + the "get a suggestion" button localize
        suggestions: sug.map((en, i) => ({ en, fr: sugFR[i] ?? en })),
      };
    });
  }

  function start(playerKeys) {
    if (g || playerKeys.length < 2) return; // already running / need at least 2 players
    g = {
      gameId: newGameId(),
      phase: 'answer', // answer | vote | reveal | podium
      promptIndex: 0,
      prompts: pickPrompts(),
      playerKeys,
      scores: Object.fromEntries(playerKeys.map((k) => [k, 0])),
      totalThumbs: Object.fromEntries(playerKeys.map((k) => [k, 0])),
      suggestionsUsed: Object.fromEntries(playerKeys.map((k) => [k, 0])), // game-wide, capped at maxSuggestions
      truthAttempts: {}, // key -> true if they tried to submit the real answer (this prompt)
      lies: {}, // key -> raw lie text (this prompt)
      drafts: {}, // key -> latest in-progress text
      cards: [], // [{ id, text, textFR, authorKeys:[], isTruth }] (built at answer→vote)
      votes: {}, // key -> cardId
      thumbs: {}, // key -> cardId
      thumbCount: {}, // cardId -> thumbs (set at scoring, shown at reveal)
    };
    g.totalPrompts = g.prompts.length;
    beginPhase('answer');
    // new game → every in-game device gets a fresh sync (clears a stale spectator screen)
    for (const key of playerKeys) syncTo(key);
  }

  function beginPhase(phase) {
    g.phase = phase;
    if (phase === 'answer') {
      g.lies = {};
      g.drafts = {};
      g.cards = [];
      g.votes = {};
      g.thumbs = {};
      g.thumbCount = {};
      g.truthAttempts = {}; // per-prompt; suggestionsUsed persists across the game
    }
    if (phase === 'reveal') timer.idle(voteTime); // reveal is untimed; host advances
    else timer.start(phase === 'answer' ? answerTime : voteTime);
    broadcast();
  }

  // promptIndex/gameId tags reject stale emits from a previous prompt or game
  const staleFor = (phase, p) =>
    !g || g.phase !== phase || isStale(p?.promptIndex, g.promptIndex) || isStale(p?.gameId, g.gameId);

  // ---- answer phase ----
  function submitLie(key, p) {
    if (staleFor('answer', p)) return { ok: false, reason: 'stale' };
    if (g.playerKeys.indexOf(key) < 0 || timer.timeUp) return { ok: false, reason: 'locked' };
    const clean = String(p?.text || '').trim();
    if (!clean) return { ok: false, reason: 'empty' };
    if (curPrompt().truthSet.has(norm(clean))) {
      g.truthAttempts[key] = true; // earns a bonus at reveal; still must enter a lie
      return { ok: false, reason: 'truth' };
    }
    g.lies[key] = clean;
    delete g.drafts[key];
    broadcast();
    return { ok: true };
  }

  function draftLie(key, p) {
    if (staleFor('answer', p)) return;
    if (g.playerKeys.indexOf(key) < 0 || g.lies[key] != null) return;
    const clean = String(p?.text || '').trim();
    if (!clean) {
      delete g.drafts[key]; // box emptied → drop stale draft (empty = no card)
      return;
    }
    if (curPrompt().truthSet.has(norm(clean))) return; // never let a draft become the truth
    g.drafts[key] = clean;
  }

  // Server-authoritative suggestion allowance: maxSuggestions for the whole game (survives
  // reconnect). Text selection stays client-side; here we only meter the count.
  function useSuggestion(key) {
    if (!g || g.phase !== 'answer' || g.playerKeys.indexOf(key) < 0) return { ok: false };
    if ((g.suggestionsUsed[key] || 0) >= maxSuggestions) return { ok: false, used: g.suggestionsUsed[key], max: maxSuggestions };
    g.suggestionsUsed[key] = (g.suggestionsUsed[key] || 0) + 1;
    return { ok: true, used: g.suggestionsUsed[key], max: maxSuggestions };
  }

  // ---- vote phase ----
  function buildCards() {
    // coalesce lies by normalized text; first submitter's casing wins for display.
    // A player's lie is free text in whatever language they typed — shown as-is to everyone
    // (textFR mirrors text). Only the truth and filler cards carry distinct EN/FR variants.
    const byNorm = new Map(); // normText -> { text, authorKeys:[] }
    for (const key of g.playerKeys) {
      const lie = g.lies[key];
      if (!lie) continue;
      const n = norm(lie);
      if (!byNorm.has(n)) byNorm.set(n, { text: lie, authorKeys: [] });
      byNorm.get(n).authorKeys.push(key);
    }
    // A player who leaves the box EMPTY at time-up has no lie: no card (a filler decoy
    // pads the count); they can still vote but earn nothing from votes/thumbs.
    const lieCards = [...byNorm.values()].map((c) => ({ text: c.text, textFR: c.text, authorKeys: c.authorKeys, isTruth: false }));
    const truthCard = { text: curPrompt().answer, textFR: curPrompt().answerFR, authorKeys: [], isTruth: true };
    // Always show (players + 1) cards: coalesced duplicates / non-submitters shrink the
    // lie count, so pad back up with distinct random suggestions (authorless decoys).
    // Keeps coalescing invisible to voters.
    const used = new Set([norm(truthCard.text), norm(truthCard.textFR), ...byNorm.keys()]);
    const fillerNeeded = g.playerKeys.length - lieCards.length;
    const fillers = [];
    if (fillerNeeded > 0) {
      for (const sug of shuffle(curPrompt().suggestions, rng)) {
        if (fillers.length >= fillerNeeded) break;
        const n = norm(sug.en);
        const nFR = norm(sug.fr);
        if (!n || used.has(n) || used.has(nFR)) continue;
        used.add(n);
        used.add(nFR);
        fillers.push({ text: sug.en, textFR: sug.fr, authorKeys: [], isTruth: false });
      }
    }
    g.cards = shuffle([...lieCards, ...fillers, truthCard], rng).map((c, i) => ({ id: i, ...c }));
  }

  function vote(key, p) {
    if (staleFor('vote', p)) return;
    if (g.playerKeys.indexOf(key) < 0 || timer.timeUp || g.votes[key] != null) return;
    const cardId = p.cardId;
    const thumbId = p.thumbId ?? null;
    const card = g.cards.find((c) => c.id === cardId);
    if (!card || card.authorKeys.includes(key)) return; // must vote, can't pick own
    // thumb is mandatory and must be a DIFFERENT, non-own card (client enforces too)
    if (thumbId == null || thumbId === cardId) return;
    const tcard = g.cards.find((c) => c.id === thumbId);
    if (!tcard || tcard.authorKeys.includes(key)) return;
    g.votes[key] = cardId;
    g.thumbs[key] = thumbId;
    broadcast();
  }

  // ---- reveal phase (scoring) ----
  function applyScores() {
    const res = scorePrompt(g, points, thumbMin);
    g.thumbCount = res.thumbCount;
    for (const key of g.playerKeys) {
      const gk = res.gained[key];
      g.scores[key] += gk.total;
      g.totalThumbs[key] += res.thumbsByAuthor[key];
      send(key, 'result', {
        gameId: g.gameId,
        promptIndex: g.promptIndex,
        gained: gk.total,
        guessedRight: gk.guessedRight,
        votesOnYou: gk.votesOnYou,
        thumbBonus: gk.thumbBonus,
        triedTruth: gk.triedTruth,
        votedFor: g.votes[key] ?? null,
        truthId: res.truthId,
        newScore: g.scores[key],
      });
    }
  }

  // ---- host advance ----
  const allSubmitted = () => allDone(getPlayers(), g.playerKeys, (k) => g.lies[k] != null);
  const allVoted = () => allDone(getPlayers(), g.playerKeys, (k) => g.votes[k] != null);
  function canAdvance() {
    if (!g) return false;
    if (g.phase === 'answer') return allSubmitted() || timer.timeUp;
    if (g.phase === 'vote') return allVoted() || timer.timeUp;
    return g.phase === 'reveal';
  }

  function next() {
    if (!canAdvance()) return;
    if (g.phase === 'answer') {
      // fill non-submitters from their latest draft (else no card)
      for (const key of g.playerKeys) {
        if (g.lies[key] == null && g.drafts[key]) g.lies[key] = g.drafts[key];
      }
      buildCards();
      beginPhase('vote');
      // privately tell each player which card is theirs, so the client can hide/disable it —
      // needed when the answer was auto-filled from a draft (no submit callback happened).
      for (const key of g.playerKeys) send(key, 'fibbage:mycard', { gameId: g.gameId, promptIndex: g.promptIndex, cardId: ownCardIdOf(key) });
    } else if (g.phase === 'vote') {
      timer.stop();
      applyScores();
      beginPhase('reveal');
    } else if (g.phase === 'reveal') {
      g.promptIndex += 1;
      if (g.promptIndex >= g.totalPrompts) {
        g.phase = 'podium';
        timer.idle(0);
        broadcast();
        return;
      }
      beginPhase('answer');
    }
  }

  // id of the card this player authored (coalesced cards may hold several authors), or null
  const ownCardIdOf = (key) => g.cards.find((c) => c.authorKeys.includes(key))?.id ?? null;

  // resume a (re)connecting player into their current locked/unlocked state
  function syncTo(key) {
    if (!g || !g.playerKeys.includes(key)) return;
    send(key, 'fibbage:sync', {
      gameId: g.gameId,
      phase: g.phase,
      promptIndex: g.promptIndex,
      lie: g.lies[key] ?? null,
      // own card id during vote/reveal (cards exist then) so a reconnecting player can't vote it
      ownCardId: g.cards.length ? ownCardIdOf(key) : null,
      votedCardId: g.votes[key] ?? null,
      thumbCardId: g.thumbs[key] ?? null,
      suggestionsUsed: g.suggestionsUsed[key] ?? 0,
      maxSuggestions,
    });
  }

  function onJoin(key) {
    if (!g) return;
    if (g.playerKeys.includes(key)) syncTo(key); // reconnect → resume locked/unlocked state
    else send(key, 'fibbage:sync', { spectator: true, gameId: g.gameId }); // mid-game joiner → spectate
  }

  function reset() {
    if (g) timer.idle(0);
    g = null;
  }

  function snapshot() {
    const players = getPlayers();
    if (!g) {
      return {
        phase: 'lobby', title: 'Fibbage', gameId: 0, step: 'lobby', points,
        players: roster(players, null, () => ({ answered: false, score: 0 })),
      };
    }
    const isSubmitted = (k) =>
      (g.phase === 'answer' && g.lies[k] != null) || (g.phase === 'vote' && g.votes[k] != null);
    const out = {
      phase: g.phase,
      title: 'Fibbage',
      gameId: g.gameId,
      step: stepOf(),
      points,
      // roster shows the in-game players with live scores + a ✓ once done this phase
      players: roster(players, g.playerKeys, (k) => ({ answered: isSubmitted(k), score: g.scores[k] || 0 })),
      promptIndex: g.promptIndex,
      totalPrompts: g.totalPrompts,
      canAdvance: canAdvance(),
      ...timer.snapshot(),
    };
    if (g.phase === 'podium') {
      out.rankings = rankings(g.playerKeys.map((k) => ({ id: k, name: nameOf(k), score: g.scores[k] || 0 })));
      // special mention: most cumulative thumbs (only if anyone got any)
      let top = null;
      for (const k of g.playerKeys) {
        const th = g.totalThumbs[k] || 0;
        if (th > 0 && (!top || th > top.thumbs)) top = { name: nameOf(k), thumbs: th };
      }
      out.topThumbs = top;
      return out;
    }

    // Both language variants travel in `state`; each client renders by its own i18n lang.
    const p = curPrompt();
    out.prompt = { category: p.category, question: p.question, questionFR: p.questionFR };
    const conn = connectedKeys(players, g.playerKeys);
    if (g.phase === 'answer') {
      out.suggestions = p.suggestions.map((s) => s.en);
      out.suggestionsFR = p.suggestions.map((s) => s.fr);
      out.submittedCount = conn.filter((k) => g.lies[k] != null).length;
      out.totalInGame = conn.length;
    } else if (g.phase === 'vote') {
      out.cards = g.cards.map((c) => ({ id: c.id, text: c.text, textFR: c.textFR })); // no author/vote leak
      out.votedCount = conn.filter((k) => g.votes[k] != null).length;
      out.totalInGame = conn.length;
    } else if (g.phase === 'reveal') {
      // lowercase answers at reveal so casing differences don't read as different answers
      const low = (s) => String(s || '').toLowerCase();
      out.truth = low(p.answer);
      out.truthFR = low(p.answerFR);
      const truthCard = g.cards.find((c) => c.isTruth);
      out.truthId = truthCard ? truthCard.id : null;
      // names of players who typed the real answer (each earned the attempt bonus)
      out.truthAttempters = g.playerKeys.filter((k) => g.truthAttempts[k]).map(nameOf);
      const voters = {}; // cardId -> [names]
      for (const [key, cid] of Object.entries(g.votes)) (voters[cid] = voters[cid] || []).push(nameOf(key));
      out.cards = g.cards.map((c) => ({
        id: c.id,
        text: low(c.text),
        textFR: low(c.textFR),
        isTruth: c.isTruth,
        authorNames: c.authorKeys.map(nameOf),
        voterNames: voters[c.id] || [],
        thumbs: g.thumbCount[c.id] || 0,
      }));
    }
    return out;
  }

  const obj = (payload) => (payload && typeof payload === 'object' ? payload : null);
  const events = {
    'fibbage:submit': ({ key, payload, reply }) => {
      if (!key) return reply({ ok: false, reason: 'inactive' });
      reply(submitLie(key, obj(payload) || { text: payload }));
    },
    'fibbage:draft': ({ key, payload }) => {
      if (key && obj(payload)) draftLie(key, payload);
    },
    'fibbage:suggestion': ({ key, reply }) => reply(key ? useSuggestion(key) : { ok: false }),
    'fibbage:vote': ({ key, payload }) => {
      if (key && obj(payload)) vote(key, payload);
    },
    'fibbage:next': () => next(),
  };

  return { start, reset, snapshot, onJoin, events };
}
