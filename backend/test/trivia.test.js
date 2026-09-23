import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateQuiz } from '../trivia.js';
import { createTestHub } from './helpers.js';

function toQuestion(t) {
  t.host('host:start'); // section header
  assert.equal(t.state().phase, 'section');
  assert.equal(t.state().canAdvance, true);
  t.host('host:next'); // Q1 (choice)
  assert.equal(t.state().phase, 'question');
}

test('validateQuiz accepts the schema and rejects bad items', () => {
  assert.equal(validateQuiz({ questions: [{ q: 'x', choices: ['a', 'b'], answer: 1 }] }), null);
  assert.match(validateQuiz({ questions: [] }), /Missing/);
  assert.match(validateQuiz({ questions: [{ type: 'section', title: 's' }] }), /at least one question/);
  assert.match(validateQuiz({ questions: [{ q: 'x', choices: ['a'], answer: 0 }] }), /at least 2 choices/);
  assert.match(validateQuiz({ questions: [{ q: 'x', choices: ['a', 'b'], answer: 2 }] }), /0-based index/);
  assert.match(validateQuiz({ questions: [{ q: 'x', type: 'number', answer: 'ten' }] }), /numeric "answer"/);
});

test('reveal is refused until every connected player answered or time is up', () => {
  const t = createTestHub();
  t.join('A');
  t.join('B');
  toQuestion(t);
  t.emit('s-a', 'player:answer', 1);
  assert.equal(t.state().canAdvance, false);
  t.host('host:reveal');
  assert.equal(t.state().phase, 'question'); // B hasn't answered
  t.drop('s-b'); // a dropped player never blocks
  assert.equal(t.state().canAdvance, true);
  t.host('host:reveal');
  assert.equal(t.state().phase, 'reveal');
});

test('timer at 0 locks answering and enables reveal', () => {
  const t = createTestHub({ config: { timeLimit: 3 } });
  t.join('A');
  toQuestion(t);
  t.clock.tick(3);
  assert.equal(t.state().timeUp, true);
  t.emit('s-a', 'player:answer', 1);
  assert.equal(t.state().players[0].answered, false);
  assert.equal(t.state().canAdvance, true);
});

test('choice scoring, private results, choices hidden until reveal, closest-number ties, podium', () => {
  const t = createTestHub();
  t.join('A');
  t.join('B');
  t.join('C');
  toQuestion(t);
  t.emit('s-a', 'player:answer', 1);
  t.emit('s-b', 'player:answer', 0);
  t.emit('s-c', 'player:answer', 1);
  assert.equal(t.state().players[0].choice, undefined); // no leak mid-question
  t.host('host:reveal');
  assert.deepEqual(t.last('s-a', 'result'), { correct: true, gained: 100, yourChoice: 1 });
  assert.equal(t.last('s-b', 'result').correct, false);
  assert.equal(t.state().correctIndex, 1);
  assert.equal(t.state().players.find((p) => p.id === 'b').choice, 0);

  t.host('host:next'); // numeric, answer 10
  t.emit('s-a', 'player:answer', 12);
  t.emit('s-b', 'player:answer', 8); // tie with A (distance 2)
  t.emit('s-c', 'player:answer', 'abc'); // ignored
  assert.equal(t.state().players.find((p) => p.id === 'c').answered, false);
  t.emit('s-c', 'player:answer', 30);
  t.host('host:reveal');
  assert.equal(t.last('s-a', 'result').correct, true);
  assert.equal(t.last('s-b', 'result').correct, true);
  assert.equal(t.last('s-c', 'result').distance, 20);
  assert.equal(t.state().lastItem, true);

  t.host('host:next');
  const r = t.state().rankings;
  assert.deepEqual(r.map((p) => [p.id, p.score, p.rank]), [['a', 300, 1], ['b', 200, 2], ['c', 100, 3]]);
});

test('start from podium clears scores; loadquiz validates and resets', () => {
  const t = createTestHub();
  t.join('A');
  toQuestion(t);
  t.emit('s-a', 'player:answer', 1);
  t.host('host:reveal');
  assert.equal(t.state().players[0].score, 100);
  const bad = t.host('host:loadquiz', { questions: [] });
  assert.equal(bad.ok, false);
  const ok = t.host('host:loadquiz', { title: 'New', questions: [{ q: 'x', choices: ['a', 'b'], answer: 0 }] });
  assert.deepEqual(ok, { ok: true, title: 'New', count: 1 });
  assert.equal(t.state().phase, 'lobby');
  assert.equal(t.state().players[0].score, 0);
  assert.equal(t.state().totalQuestions, 1);
});
