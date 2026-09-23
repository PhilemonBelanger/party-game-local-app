// Builds the three game modes from one config object. Shared by server.js (config from
// env) and the tests (config inline, seeded rng). Adding a mode = one factory + one line here.

import { createTrivia } from './trivia.js';
import { createGartic } from './gartic.js';
import { createFibbage, DEFAULT_POINTS } from './fibbage.js';

export const DEFAULT_CONFIG = {
  timeLimit: 30,
  basePoints: 100,
  garticDrawTime: 100,
  garticGuessTime: 60,
  fibbageAnswerTime: 60,
  fibbageVoteTime: 100,
  fibbagePrompts: 10,
  fibbagePoints: DEFAULT_POINTS,
  fibbageThumbMin: 2,
  fibbageMaxSuggestions: 3,
};

// env var → config (all optional; defaults above)
export function configFromEnv(env = process.env) {
  const num = (name, dflt) => {
    const v = parseInt(env[name] ?? '', 10);
    return Number.isFinite(v) ? v : dflt;
  };
  const d = DEFAULT_CONFIG;
  return {
    timeLimit: num('TIME_LIMIT', d.timeLimit),
    basePoints: num('BASE_POINTS', d.basePoints),
    garticDrawTime: num('GARTIC_DRAW_TIME', d.garticDrawTime),
    garticGuessTime: num('GARTIC_GUESS_TIME', d.garticGuessTime),
    fibbageAnswerTime: num('FIBBAGE_ANSWER_TIME', d.fibbageAnswerTime),
    fibbageVoteTime: num('FIBBAGE_VOTE_TIME', d.fibbageVoteTime),
    fibbagePrompts: num('FIBBAGE_PROMPTS', d.fibbagePrompts),
    fibbagePoints: {
      truth: num('FIBBAGE_TRUTH_POINTS', d.fibbagePoints.truth),
      vote: num('FIBBAGE_VOTE_POINTS', d.fibbagePoints.vote),
      thumb: num('FIBBAGE_THUMB_POINTS', d.fibbagePoints.thumb),
      truthAttempt: num('FIBBAGE_TRUTH_ATTEMPT_POINTS', d.fibbagePoints.truthAttempt),
    },
    fibbageThumbMin: num('FIBBAGE_THUMB_MIN', d.fibbageThumbMin),
    fibbageMaxSuggestions: num('FIBBAGE_MAX_SUGGESTIONS', d.fibbageMaxSuggestions),
  };
}

// ctx comes from createHub; quiz/pool are data; rng defaults to Math.random
export function createModes(ctx, { config = DEFAULT_CONFIG, quiz, fibbagePool, rng = Math.random } = {}) {
  const c = { ...DEFAULT_CONFIG, ...config };
  return {
    trivia: createTrivia({ ...ctx, quiz, timeLimit: c.timeLimit, basePoints: c.basePoints }),
    gartic: createGartic({ ...ctx, rng, drawTime: c.garticDrawTime, guessTime: c.garticGuessTime }),
    fibbage: createFibbage({
      ...ctx,
      rng,
      getPool: () => fibbagePool,
      answerTime: c.fibbageAnswerTime,
      voteTime: c.fibbageVoteTime,
      promptsPerGame: c.fibbagePrompts,
      points: c.fibbagePoints,
      thumbMin: c.fibbageThumbMin,
      maxSuggestions: c.fibbageMaxSuggestions,
    }),
  };
}
