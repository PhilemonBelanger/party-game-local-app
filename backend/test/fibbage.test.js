import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_POINTS, scorePrompt } from '../fibbage.js';
import { createTestHub } from './helpers.js';

function startFibbage(names, config = {}) {
  const t = createTestHub({ config });
  t.host('host:setmode', 'fibbage');
  for (const n of names) t.join(n);
  t.host('host:start');
  return t;
}
const sock = (n) => `s-${n.toLowerCase()}`;
// the truth for whichever prompt the seeded shuffle picked first
const truthOf = (t) => (t.state().prompt.question.includes('crows') ? 'murder' : 'Detroit');

test('scorePrompt: truth, fooled votes, thumb bonus with min + ties, truth attempts', () => {
  const cards = [
    { id: 0, authorKeys: [], isTruth: true },
    { id: 1, authorKeys: ['a'], isTruth: false },
    { id: 2, authorKeys: ['b', 'c'], isTruth: false }, // coalesced
    { id: 3, authorKeys: [], isTruth: false }, // filler
  ];
  const res = scorePrompt({
    playerKeys: ['a', 'b', 'c', 'd'],
    cards,
    votes: { a: 2, b: 0, c: 1, d: 3 },
    thumbs: { a: 3, b: 1, c: 1, d: 2 },
    truthAttempts: { d: true },
  });
  assert.equal(res.gained.b.guessedRight, true);
  assert.equal(res.gained.a.votesOnYou, 1); // c voted card 1
  assert.equal(res.gained.a.thumbBonus, true); // card 1 has 2 thumbs = max, >= min 2
  assert.equal(res.gained.a.total, DEFAULT_POINTS.vote + DEFAULT_POINTS.thumb);
  assert.equal(res.gained.b.total, DEFAULT_POINTS.truth + DEFAULT_POINTS.vote); // a voted card 2
  assert.equal(res.gained.c.total, DEFAULT_POINTS.vote);
  assert.equal(res.gained.d.total, DEFAULT_POINTS.truthAttempt); // filler vote scores nobody
  assert.equal(res.thumbsByAuthor.a, 2);
  assert.equal(res.truthId, 0);
});

test('scorePrompt: no thumb bonus below thumbMin', () => {
  const res = scorePrompt(
    { playerKeys: ['a', 'b'], cards: [{ id: 0, authorKeys: [], isTruth: true }, { id: 1, authorKeys: ['a'], isTruth: false }], votes: {}, thumbs: { b: 1 }, truthAttempts: {} },
    DEFAULT_POINTS,
    2
  );
  assert.equal(res.gained.a.thumbBonus, false);
});

test('truth is rejected in either language, accent-insensitive, and earns the attempt flag', () => {
  const t = startFibbage(['A', 'B']);
  const { gameId, promptIndex } = t.state();
  const truth = truthOf(t);
  const fr = truth === 'murder' ? 'BANDE' : 'detroit';
  assert.deepEqual(t.emit('s-a', 'fibbage:submit', { gameId, promptIndex, text: `  ${truth.toUpperCase()} ` }), { ok: false, reason: 'truth' });
  assert.deepEqual(t.emit('s-b', 'fibbage:submit', { gameId, promptIndex, text: fr }), { ok: false, reason: 'truth' });
  assert.deepEqual(t.emit('s-a', 'fibbage:submit', { gameId, promptIndex, text: '' }), { ok: false, reason: 'empty' });
  assert.deepEqual(t.emit('s-a', 'fibbage:submit', { gameId: gameId + 99, promptIndex, text: 'x' }), { ok: false, reason: 'stale' });
  // the real answer is never in state before reveal
  assert.ok(!JSON.stringify(t.state()).toLowerCase().includes(`"${truth.toLowerCase()}"`));
});

test('full prompt: coalescing, padding to players+1 cards, own-card + thumb rules, scoring, reveal', () => {
  const t = startFibbage(['A', 'B', 'C'], { fibbagePrompts: 1 });
  const { gameId, promptIndex } = t.state();
  assert.deepEqual(t.state().points, DEFAULT_POINTS);
  t.emit('s-a', 'fibbage:submit', { gameId, promptIndex, text: 'Banana' });
  t.emit('s-b', 'fibbage:submit', { gameId, promptIndex, text: '  banana ' }); // coalesces with A
  assert.equal(t.state().canAdvance, false);
  t.emit('s-c', 'fibbage:draft', { gameId, promptIndex, text: 'Pizza' }); // never submits
  t.drop('s-c');
  assert.equal(t.state().canAdvance, true); // dropped player doesn't block
  t.host('fibbage:next');

  const s = t.state();
  assert.equal(s.phase, 'vote');
  assert.equal(s.cards.length, 4); // 3 players + 1: banana, pizza (draft), truth, 1 filler
  assert.ok(s.cards.every((c) => Object.keys(c).sort().join() === 'id,text,textFR')); // no author leak
  const mine = t.last('s-a', 'fibbage:mycard').cardId;
  assert.equal(t.last('s-b', 'fibbage:mycard').cardId, mine); // coalesced → same card
  const banana = s.cards.find((c) => c.id === mine);
  assert.equal(banana.text, 'Banana');
  const pizza = s.cards.find((c) => c.text === 'Pizza');
  assert.ok(pizza);

  t.join('C', 's-c2'); // C back for voting
  // own card, missing thumb, same card for both → all rejected
  t.emit('s-a', 'fibbage:vote', { gameId, promptIndex, cardId: mine, thumbId: pizza.id });
  t.emit('s-a', 'fibbage:vote', { gameId, promptIndex, cardId: pizza.id });
  t.emit('s-a', 'fibbage:vote', { gameId, promptIndex, cardId: pizza.id, thumbId: pizza.id });
  assert.equal(t.state().votedCount, 0);

  // a card that is neither Banana nor Pizza (truth or filler) to receive thumbs
  const other = s.cards.find((c) => c.id !== pizza.id && c.id !== mine).id;
  t.emit('s-a', 'fibbage:vote', { gameId, promptIndex, cardId: pizza.id, thumbId: other });
  t.emit('s-b', 'fibbage:vote', { gameId, promptIndex, cardId: pizza.id, thumbId: other });
  t.emit('s-c2', 'fibbage:vote', { gameId, promptIndex, cardId: mine, thumbId: pizza.id }); // thumb on own card
  assert.equal(t.state().votedCount, 2);
  t.emit('s-c2', 'fibbage:vote', { gameId, promptIndex, cardId: mine, thumbId: other });
  assert.equal(t.state().canAdvance, true);
  t.host('fibbage:next');

  assert.equal(t.state().phase, 'reveal');
  const rc = t.last('s-c2', 'result');
  assert.equal(rc.votesOnYou, 2); // A and B picked C's auto-filled draft
  assert.equal(rc.gained, 2 * DEFAULT_POINTS.vote);
  const ra = t.last('s-a', 'result');
  assert.equal(ra.votesOnYou, 1); // C picked the coalesced Banana card
  assert.equal(ra.gameId, gameId);
  const rev = t.state();
  assert.equal(rev.truth, truthOf(t).toLowerCase());
  assert.deepEqual(rev.cards.find((c) => c.id === mine).authorNames, ['A', 'B']);
  assert.equal(rev.cards.find((c) => c.id === rev.truthId).isTruth, true);

  t.host('fibbage:next');
  assert.equal(t.state().phase, 'podium');
  assert.equal(t.state().rankings[0].name, 'C');
});

test('suggestions are metered per game and survive reconnect', () => {
  const t = startFibbage(['A', 'B'], { fibbageMaxSuggestions: 2 });
  assert.deepEqual(t.emit('s-a', 'fibbage:suggestion', {}), { ok: true, used: 1, max: 2 });
  assert.deepEqual(t.emit('s-a', 'fibbage:suggestion', {}), { ok: true, used: 2, max: 2 });
  assert.equal(t.emit('s-a', 'fibbage:suggestion', {}).ok, false);
  t.drop('s-a');
  t.join('A', 's-a2');
  assert.equal(t.last('s-a2', 'fibbage:sync').suggestionsUsed, 2);
});

test('mid-game spectator is re-synced as a player when the next game starts', () => {
  const t = startFibbage(['A', 'B']);
  const first = t.state().gameId;
  t.join('Late');
  const spec = t.last('s-late', 'fibbage:sync');
  assert.deepEqual(spec, { spectator: true, gameId: first });
  t.host('host:reset');
  t.host('host:start');
  const sync = t.last('s-late', 'fibbage:sync');
  assert.equal(sync.spectator, undefined);
  assert.notEqual(sync.gameId, first);
  assert.equal(t.state().players.length, 3);
});

test('vote time-up locks voting and lets the host reveal', () => {
  const t = startFibbage(['A', 'B'], { fibbageAnswerTime: 2, fibbageVoteTime: 2 });
  t.clock.tick(2);
  t.host('fibbage:next');
  assert.equal(t.state().phase, 'vote');
  t.clock.tick(2);
  const { gameId, promptIndex, cards } = t.state();
  t.emit('s-a', 'fibbage:vote', { gameId, promptIndex, cardId: cards[0].id, thumbId: cards[1].id });
  assert.equal(t.state().votedCount, 0);
  t.host('fibbage:next');
  assert.equal(t.state().phase, 'reveal');
});
