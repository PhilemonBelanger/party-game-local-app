// Fibbage mode — bluffing trivia.
//
// Each prompt is a fill-in-the-blank fact. Players invent a fake answer ("lie"); the
// real answer is mixed in with all the lies. Everyone votes on which one is true.
// Score: guess the truth, fool others into picking your lie, collect thumbs-up.
//
// Phases per prompt: answer → vote → reveal (repeat for N prompts) → podium.
// Modeled on gartic.js: a self-contained factory, host-driven advancement, per-phase
// timer with timeUp lock, drafts as the safety net so in-progress text isn't lost.

const PROMPTS_PER_GAME = parseInt(process.env.FIBBAGE_PROMPTS || '10', 10);
const PTS_TRUTH = parseInt(process.env.FIBBAGE_TRUTH_POINTS || '150', 10); // guessed the real answer
const PTS_VOTE = parseInt(process.env.FIBBAGE_VOTE_POINTS || '100', 10); // per vote your lie fooled
const PTS_THUMB = parseInt(process.env.FIBBAGE_THUMB_POINTS || '50', 10); // most-thumbed lie bonus
const THUMB_MIN = parseInt(process.env.FIBBAGE_THUMB_MIN || '2', 10); // min thumbs to earn the bonus

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// normalize for both truth-matching and coalescing: strip accents, trim, collapse
// whitespace, lowercase. Accent-folding lets "Détroit"/"detroit" and "café"/"cafe" match,
// which matters for the bilingual truth check (a FR answer typed without accents still blocks).
const norm = (s) =>
  String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().replace(/\s+/g, ' ').toLowerCase();
// strip HTML tags (e.g. <i>…</i>) but keep the literal <BLANK> placeholder token
const stripHtml = (s) => String(s || '').replace(/<(?!BLANK>)[^>]+>/g, '');

export function createFibbage({ io, getPlayers, broadcast, answerTime = 60, voteTime = 30, getPool }) {
  let g = null; // null = inactive (mode lobby)

  const nameOf = (key) => getPlayers().get(key)?.name || '?';

  function inGameConnected() {
    const players = getPlayers();
    return g.playerKeys.filter((k) => players.get(k)?.connected);
  }

  function pickPrompts() {
    const pool = getPool() || {};
    const all = [...(pool.normal || []), ...(pool.final || [])];
    const chosen = shuffle(all).slice(0, Math.min(PROMPTS_PER_GAME, all.length));
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
          [
            p.answer, ...(p.alternateSpellings || []),
            p.answerFR, ...(p.alternateSpellingsFR || []),
          ].map(norm).filter(Boolean)
        ),
        // paired EN/FR suggestions so filler cards + the "get a suggestion" button localize
        suggestions: sug.map((en, i) => ({ en, fr: sugFR[i] ?? en })),
      };
    });
  }

  function start(playerKeys) {
    g = {
      phase: 'answer', // answer | vote | reveal
      promptIndex: 0,
      totalPrompts: 0,
      prompts: pickPrompts(),
      playerKeys,
      scores: Object.fromEntries(playerKeys.map((k) => [k, 0])),
      totalThumbs: Object.fromEntries(playerKeys.map((k) => [k, 0])),
      lies: {}, // key -> raw lie text (this prompt)
      drafts: {}, // key -> latest in-progress text
      cards: [], // [{ id, text, authorKeys:[], isTruth }] (built at answer→vote)
      votes: {}, // key -> cardId
      thumbs: {}, // key -> cardId
      timeLimit: answerTime,
      timeRemaining: answerTime,
      timeUp: false,
      timer: null,
    };
    g.totalPrompts = g.prompts.length;
    beginPhase('answer');
  }

  const curPrompt = () => g.prompts[g.promptIndex];

  function beginPhase(phase) {
    clearInterval(g.timer);
    g.phase = phase;
    g.timeUp = false;
    g.timeLimit = phase === 'answer' ? answerTime : voteTime;
    g.timeRemaining = g.timeLimit;
    if (phase === 'answer') {
      g.lies = {};
      g.drafts = {};
      g.cards = [];
      g.votes = {};
      g.thumbs = {};
    }
    broadcast();
    if (phase === 'reveal') return; // reveal is untimed; host advances
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

  // ---- answer phase ----
  function submitLie(key, promptIndex, text) {
    if (!g || g.phase !== 'answer' || (promptIndex != null && promptIndex !== g.promptIndex))
      return { ok: false, reason: 'stale' };
    if (g.playerKeys.indexOf(key) < 0 || g.timeUp) return { ok: false, reason: 'locked' };
    const clean = String(text || '').trim();
    if (!clean) return { ok: false, reason: 'empty' };
    if (curPrompt().truthSet.has(norm(clean))) return { ok: false, reason: 'truth' };
    g.lies[key] = clean;
    delete g.drafts[key];
    broadcast();
    return { ok: true };
  }

  function draftLie(key, promptIndex, text) {
    if (!g || g.phase !== 'answer' || (promptIndex != null && promptIndex !== g.promptIndex)) return;
    if (g.playerKeys.indexOf(key) < 0 || g.lies[key] != null) return;
    const clean = String(text || '').trim();
    if (!clean || curPrompt().truthSet.has(norm(clean))) return; // never let a draft become the truth
    g.drafts[key] = clean;
  }

  // ---- vote phase ----
  function buildCards() {
    // coalesce lies by normalized text; first submitter's casing wins for display
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
    const lieCards = [...byNorm.values()].map((c) => ({ text: c.text, textFR: c.text, authorKeys: c.authorKeys, isTruth: false }));
    const truthCard = { text: curPrompt().answer, textFR: curPrompt().answerFR, authorKeys: [], isTruth: true };
    // Always show (players + 1) cards: coalesced duplicates / non-submitters shrink the
    // lie count, so pad back up with distinct random suggestions (authorless decoys — a
    // vote/thumb on them scores for nobody). Keeps coalescing invisible to voters.
    const used = new Set([norm(truthCard.text), norm(truthCard.textFR), ...byNorm.keys()]);
    const fillerNeeded = g.playerKeys.length - lieCards.length;
    const fillers = [];
    if (fillerNeeded > 0) {
      for (const sug of shuffle(curPrompt().suggestions)) {
        if (fillers.length >= fillerNeeded) break;
        const n = norm(sug.en);
        const nFR = norm(sug.fr);
        if (!n || used.has(n) || used.has(nFR)) continue;
        used.add(n);
        used.add(nFR);
        fillers.push({ text: sug.en, textFR: sug.fr, authorKeys: [], isTruth: false });
      }
    }
    g.cards = shuffle([...lieCards, ...fillers, truthCard]).map((c, i) => ({ id: i, ...c }));
  }

  function vote(key, promptIndex, cardId, thumbId) {
    if (!g || g.phase !== 'vote' || (promptIndex != null && promptIndex !== g.promptIndex)) return;
    if (g.playerKeys.indexOf(key) < 0 || g.timeUp || g.votes[key] != null) return;
    const card = g.cards.find((c) => c.id === cardId);
    if (!card || card.authorKeys.includes(key)) return; // must vote, can't pick own
    g.votes[key] = cardId;
    if (thumbId != null) {
      const tcard = g.cards.find((c) => c.id === thumbId);
      if (tcard && !tcard.authorKeys.includes(key)) g.thumbs[key] = thumbId; // can't thumb own
    }
    broadcast();
  }

  // ---- reveal phase (scoring) ----
  function score() {
    const voteCount = {}; // cardId -> votes
    const thumbCount = {}; // cardId -> thumbs
    for (const cid of Object.values(g.votes)) voteCount[cid] = (voteCount[cid] || 0) + 1;
    for (const cid of Object.values(g.thumbs)) thumbCount[cid] = (thumbCount[cid] || 0) + 1;

    const truthCard = g.cards.find((c) => c.isTruth);

    // +150 to truth-guessers
    const gained = Object.fromEntries(g.playerKeys.map((k) => [k, { guessedRight: false, votesOnYou: 0, thumbBonus: false, total: 0 }]));
    for (const [key, cid] of Object.entries(g.votes)) {
      if (truthCard && cid === truthCard.id && gained[key]) {
        gained[key].guessedRight = true;
        gained[key].total += PTS_TRUTH;
      }
    }
    // +100 per vote to each author of a (non-truth) card
    for (const card of g.cards) {
      if (card.isTruth) continue;
      const votes = voteCount[card.id] || 0;
      if (!votes) continue;
      for (const key of card.authorKeys) {
        if (!gained[key]) continue;
        gained[key].votesOnYou += votes;
        gained[key].total += votes * PTS_VOTE;
      }
    }
    // +50 to authors of most-thumbed non-truth card(s); accumulate cumulative thumbs
    let maxThumb = 0;
    for (const card of g.cards) {
      if (card.isTruth) continue;
      const th = thumbCount[card.id] || 0;
      if (th > maxThumb) maxThumb = th;
      for (const key of card.authorKeys) if (g.totalThumbs[key] != null) g.totalThumbs[key] += th;
    }
    // bonus only when the top lie has at least THUMB_MIN thumbs (ties all win)
    if (maxThumb >= THUMB_MIN) {
      for (const card of g.cards) {
        if (card.isTruth || (thumbCount[card.id] || 0) !== maxThumb) continue;
        for (const key of card.authorKeys) {
          if (!gained[key]) continue;
          gained[key].thumbBonus = true;
          gained[key].total += PTS_THUMB;
        }
      }
    }

    // apply + emit private results
    const players = getPlayers();
    for (const key of g.playerKeys) {
      g.scores[key] += gained[key].total;
      const p = players.get(key);
      if (p?.connected && p.socketId) {
        io.to(p.socketId).emit('result', {
          gained: gained[key].total,
          guessedRight: gained[key].guessedRight,
          votesOnYou: gained[key].votesOnYou,
          thumbBonus: gained[key].thumbBonus,
          votedFor: g.votes[key] ?? null,
          truthId: truthCard ? truthCard.id : null,
          newScore: g.scores[key],
        });
      }
    }
    g._voteCount = voteCount;
    g._thumbCount = thumbCount;
  }

  // ---- host advance ----
  function allSubmitted() {
    const conn = inGameConnected();
    return conn.length > 0 && conn.every((k) => g.lies[k] != null);
  }
  function allVoted() {
    const conn = inGameConnected();
    return conn.length > 0 && conn.every((k) => g.votes[k] != null);
  }

  function next() {
    if (!g) return;
    if (g.phase === 'answer') {
      if (!allSubmitted() && !g.timeUp) return;
      // fill non-submitters from their latest draft (else no card)
      for (const key of g.playerKeys) {
        if (g.lies[key] == null && g.drafts[key]) g.lies[key] = g.drafts[key];
      }
      buildCards();
      beginPhase('vote');
    } else if (g.phase === 'vote') {
      if (!allVoted() && !g.timeUp) return;
      clearInterval(g.timer);
      score();
      beginPhase('reveal');
    } else if (g.phase === 'reveal') {
      g.promptIndex += 1;
      if (g.promptIndex >= g.totalPrompts) {
        clearInterval(g.timer);
        g.phase = 'podium';
        broadcast();
        return;
      }
      beginPhase('answer');
    }
  }

  // resume a (re)connecting player into their current locked/unlocked state
  function syncTo(key) {
    if (!g || !g.playerKeys.includes(key)) return;
    const p = getPlayers().get(key);
    if (!p?.connected || !p.socketId) return;
    io.to(p.socketId).emit('fibbage:sync', {
      phase: g.phase,
      promptIndex: g.promptIndex,
      lie: g.lies[key] ?? null,
      votedCardId: g.votes[key] ?? null,
      thumbCardId: g.thumbs[key] ?? null,
    });
  }

  function reset() {
    if (g) clearInterval(g.timer);
    g = null;
  }

  function buildState() {
    if (!g) return { phase: 'lobby' };
    const out = {
      phase: g.phase,
      promptIndex: g.promptIndex,
      totalPrompts: g.totalPrompts,
      timeRemaining: g.timeRemaining,
      timeLimit: g.timeLimit,
      timeUp: g.timeUp,
    };
    if (g.phase === 'podium') {
      const sorted = g.playerKeys
        .map((k) => ({ id: k, name: nameOf(k), score: g.scores[k] || 0 }))
        .sort((a, b) => b.score - a.score);
      let rank = 0;
      let prev = null;
      out.rankings = sorted.map((p, i) => {
        if (p.score !== prev) {
          rank = i + 1;
          prev = p.score;
        }
        return { ...p, rank };
      });
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
    const conn = inGameConnected();
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
      out.truth = p.answer;
      out.truthFR = p.answerFR;
      const truthCard = g.cards.find((c) => c.isTruth);
      out.truthId = truthCard ? truthCard.id : null;
      const voters = {}; // cardId -> [names]
      for (const [key, cid] of Object.entries(g.votes)) {
        (voters[cid] = voters[cid] || []).push(nameOf(key));
      }
      out.cards = g.cards.map((c) => ({
        id: c.id,
        text: c.text,
        textFR: c.textFR,
        isTruth: c.isTruth,
        authorNames: c.authorKeys.map(nameOf),
        voterNames: voters[c.id] || [],
        thumbs: g._thumbCount?.[c.id] || 0,
      }));
    }
    return out;
  }

  const isSubmitted = (key) =>
    !!g && ((g.phase === 'answer' && g.lies[key] != null) || (g.phase === 'vote' && g.votes[key] != null));
  const isInGame = (key) => !!g && g.playerKeys.includes(key);
  const getPlayerKeys = () => (g ? g.playerKeys : []);
  const scoreOf = (key) => (g ? g.scores[key] || 0 : 0);

  return {
    start, submitLie, draftLie, vote, next, syncTo, reset, buildState,
    isSubmitted, isInGame, getPlayerKeys, scoreOf, active: () => !!g,
  };
}
