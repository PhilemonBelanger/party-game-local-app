// Trivia mode — multiple-choice + numeric ("closest wins") questions, sections, podium.
//
// Flow items live in quiz.questions and are either questions or section headers
// (`type:"section"`). Phases: lobby → question → reveal → … → podium, plus `section`.
// Reveal is always host-triggered and only once every connected player answered or
// the timer hit 0. Per-player trivia data (score/answered/choice) lives here, keyed by
// the hub's player key; the hub's player map only holds identity + connection.

import { allDone, rankings, roster } from './shared.js';

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

export function validateQuiz(data) {
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

export function createTrivia({ getPlayers, send, broadcast, createTimer, newGameId, quiz: initialQuiz, timeLimit = 30, basePoints = 100 }) {
  let quiz = initialQuiz || { title: 'Trivia', questions: [] };
  const timer = createTimer();
  timer.idle(timeLimit);
  let phase = 'lobby'; // lobby | question | reveal | section | podium
  let questionIndex = -1;
  let gameId = 0;
  const data = new Map(); // key -> { score, answered, choice }

  const rec = (key) => {
    let r = data.get(key);
    if (!r) {
      r = { score: 0, answered: false, choice: null };
      data.set(key, r);
    }
    return r;
  };
  const allKeys = () => [...getPlayers().keys()];
  const current = () => quiz.questions[questionIndex];
  const totalQuestionCount = () => quiz.questions.filter((it) => !isSection(it)).length;
  // 1-based number of the question at idx, ignoring sections
  function questionNumberAt(idx) {
    let n = 0;
    for (let i = 0; i <= idx && i < quiz.questions.length; i++) if (!isSection(quiz.questions[i])) n++;
    return n;
  }
  const isLastItem = (idx) => idx + 1 >= quiz.questions.length;
  // only connected players can answer — a disconnected player never blocks the reveal
  const allAnswered = () => allDone(getPlayers(), allKeys(), (k) => data.get(k)?.answered);
  const canReveal = () => phase === 'question' && (allAnswered() || timer.timeUp);

  function reveal() {
    timer.stop();
    phase = 'reveal';
    const q = current();
    const pts = q.points || basePoints;
    const keys = allKeys();

    if (qType(q) === 'number') {
      const ans = q.answer;
      // closest guess(es) win; ties all win
      let min = Infinity;
      for (const k of keys) {
        const c = data.get(k)?.choice;
        if (typeof c === 'number') min = Math.min(min, Math.abs(c - ans));
      }
      for (const k of keys) {
        const r = rec(k);
        const has = typeof r.choice === 'number';
        const dist = has ? Math.abs(r.choice - ans) : null;
        const win = has && min !== Infinity && dist === min;
        if (win) r.score += pts;
        send(k, 'result', { correct: win, gained: win ? pts : 0, yourAnswer: has ? r.choice : null, correctAnswer: ans, distance: dist });
      }
    } else {
      for (const k of keys) {
        const r = rec(k);
        const correct = r.choice === q.answer;
        if (correct) r.score += pts;
        // private per-player feedback (others never see this)
        send(k, 'result', { correct, gained: correct ? pts : 0, yourChoice: r.choice });
      }
    }
    broadcast();
  }

  // move to a specific item; dispatch by type (section pauses for the host, question runs the timer)
  function gotoItem(idx) {
    timer.stop();
    questionIndex = idx;
    if (idx >= quiz.questions.length) {
      phase = 'podium';
      broadcast();
      return;
    }
    if (isSection(quiz.questions[idx])) {
      phase = 'section';
      broadcast(); // no timer; host advances with host:next
      return;
    }
    phase = 'question';
    for (const r of data.values()) {
      r.answered = false;
      r.choice = null;
    }
    timer.start(timeLimit);
    broadcast();
  }

  function start() {
    if (phase !== 'lobby' && phase !== 'podium') return;
    data.clear();
    gameId = newGameId();
    gotoItem(0);
  }

  function reset() {
    timer.idle(timeLimit);
    phase = 'lobby';
    questionIndex = -1;
    data.clear();
  }

  function snapshot() {
    const players = getPlayers();
    // expose each player's pick ONLY during reveal (no leak mid-question)
    const withChoice = phase === 'reveal';
    const out = {
      phase,
      gameId,
      step: `${gameId}:${questionIndex}:${phase}`,
      title: quiz.title || 'Trivia',
      players: roster(players, null, (k) => {
        const r = data.get(k);
        return {
          score: r?.score || 0,
          answered: !!r?.answered,
          ...(withChoice ? { choice: r?.choice ?? null } : {}),
        };
      }),
      questionIndex,
      totalQuestions: totalQuestionCount(),
      canAdvance: phase === 'question' ? canReveal() : phase === 'reveal' || phase === 'section',
      ...timer.snapshot(),
    };
    if (phase === 'question' || phase === 'reveal') {
      const q = current();
      out.question = { type: qType(q), text: q.q, image: q.image || null };
      if (qType(q) === 'choice') out.question.choices = normChoices(q.choices);
      out.questionNumber = questionNumberAt(questionIndex);
    }
    if (phase === 'reveal') {
      const q = current();
      if (qType(q) === 'choice') out.correctIndex = q.answer;
      else out.correctAnswer = q.answer;
      out.lastItem = isLastItem(questionIndex);
    }
    if (phase === 'section') {
      const s = current();
      out.section = { title: s.title || '', image: s.image || null, description: s.description || '' };
      out.lastItem = isLastItem(questionIndex);
    }
    if (phase === 'podium') {
      out.rankings = rankings(allKeys().map((k) => ({ id: k, name: players.get(k)?.name || '?', score: data.get(k)?.score || 0 })));
    }
    return out;
  }

  const events = {
    'player:answer': ({ key, payload }) => {
      if (phase !== 'question' || timer.timeUp || !key) return; // locked once time's up
      const r = rec(key);
      if (r.answered) return;
      if (qType(current()) === 'number') {
        const num = Number(payload);
        if (!Number.isFinite(num)) return; // ignore invalid numeric entry
        r.choice = num;
      } else {
        r.choice = payload; // choice index
      }
      r.answered = true;
      broadcast(); // host decides when to reveal
    },
    'host:reveal': () => {
      if (canReveal()) reveal();
    },
    // advance after a reveal, or continue past a section header
    'host:next': () => {
      if (phase !== 'reveal' && phase !== 'section') return;
      gotoItem(questionIndex + 1);
    },
    'host:loadquiz': ({ payload, reply }) => {
      const err = validateQuiz(payload);
      if (err) return reply({ ok: false, error: err });
      quiz = { title: payload.title || 'Trivia', questions: payload.questions };
      reset(); // back to lobby, scores cleared
      broadcast();
      reply({ ok: true, title: quiz.title, count: quiz.questions.length });
    },
  };

  return {
    start,
    reset,
    snapshot,
    onJoin: () => {},
    events,
    questionCount: () => quiz.questions.length,
  };
}
