import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_FRAMES, sanitizeFrames } from '../gartic.js';
import { createTestHub } from './helpers.js';

function startGartic(names, config = {}) {
  const t = createTestHub({ config });
  t.host('host:setmode', 'gartic');
  for (const n of names) t.join(n);
  t.host('host:start');
  return t;
}
const sock = (n) => `s-${n.toLowerCase()}`;

test('needs 2+ players; tasks go out privately with round tags', () => {
  const t = createTestHub();
  t.host('host:setmode', 'gartic');
  t.join('Solo');
  t.host('host:start');
  assert.equal(t.state().phase, 'lobby');

  const g = startGartic(['A', 'B', 'C']);
  assert.equal(g.state().phase, 'round');
  const task = g.last('s-a', 'gartic:task');
  assert.equal(task.type, 'prompt');
  assert.equal(task.round, 0);
  assert.equal(task.step, g.state().step);
});

test('Latin square: every player works every book exactly once', () => {
  const names = ['A', 'B', 'C', 'D'];
  const t = startGartic(names);
  for (let round = 0; round < names.length; round++) {
    for (const n of names) t.emit(sock(n), 'gartic:submit', { round, content: `${n}${round}` });
    t.host('gartic:next');
  }
  assert.equal(t.state().phase, 'reveal');
  // walk every entry of every book via reveal nav and collect authors per book
  const authorsByBook = {};
  for (;;) {
    const r = t.state().reveal;
    (authorsByBook[r.book] ||= []).push(r.author);
    if (r.atEnd) break;
    t.host('gartic:reveal', 1);
  }
  for (const authors of Object.values(authorsByBook)) {
    assert.deepEqual([...authors].sort(), names);
  }
  // book b is seeded by player b
  assert.equal(t.state().reveal.seedAuthor, 'D');
});

test('host can only advance when all submitted or time is up; drafts fill non-submitters', () => {
  const t = startGartic(['A', 'B'], { garticGuessTime: 5 });
  t.emit('s-a', 'gartic:submit', { round: 0, content: 'a cat' });
  assert.equal(t.state().canAdvance, false);
  t.host('gartic:next');
  assert.equal(t.state().round, 0);
  t.emit('s-b', 'gartic:draft', { round: 0, content: 'a do' });
  t.emit('s-b', 'gartic:draft', { round: 0, content: 'a dog' });
  t.clock.tick(5);
  assert.equal(t.state().timeUp, true);
  t.host('gartic:next');
  assert.equal(t.state().round, 1);
  assert.equal(t.state().taskType, 'draw');
  // A now draws B's book, seeded by B's draft
  assert.equal(t.last('s-a', 'gartic:task').prev, 'a dog');
});

test('stale round/gameId emits are ignored', () => {
  const t = startGartic(['A', 'B']);
  const gameId = t.state().gameId;
  t.emit('s-a', 'gartic:submit', { round: 1, content: 'future' });
  t.emit('s-a', 'gartic:submit', { round: 0, gameId: gameId - 1, content: 'old game' });
  assert.equal(t.state().submittedCount, 0);
  t.emit('s-a', 'gartic:submit', { round: 0, gameId, content: 'ok' });
  assert.equal(t.state().submittedCount, 1);
});

test('mid-game joiner spectates; reconnecting player resumes with done flag', () => {
  const t = startGartic(['A', 'B']);
  t.join('Late');
  assert.equal(t.last('s-late', 'gartic:task').type, 'spectator');
  assert.equal(t.state().players.length, 2); // not in the in-game roster

  t.emit('s-a', 'gartic:submit', { round: 0, content: 'x' });
  t.drop('s-a');
  t.join('A', 's-a2');
  assert.equal(t.last('s-a2', 'gartic:task').done, true);
});

test('frames are thinned to MAX_FRAMES and non-strings dropped', () => {
  const many = Array.from({ length: 100 }, (_, i) => `f${i}`);
  const out = sanitizeFrames(many);
  assert.equal(out.length, MAX_FRAMES);
  assert.equal(out[0], 'f0');
  assert.equal(out.at(-1), 'f99');
  assert.equal(sanitizeFrames([1, null]), null);
  assert.equal(sanitizeFrames('nope'), null);
});
