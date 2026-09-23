import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestHub } from './helpers.js';

test('rejoining with the same name (any case) resumes the same player', () => {
  const t = createTestHub();
  const id = t.join('Alice', 's1');
  t.drop('s1');
  assert.equal(t.state().players.find((p) => p.id === id).connected, false);
  const again = t.join('ALICE', 's2');
  assert.equal(again, id);
  assert.equal(t.state().players.length, 1);
  assert.equal(t.state().players[0].connected, true);
});

test('same name from a second live device takes the slot; the old socket is told and ignored', () => {
  const t = createTestHub();
  t.join('Bob', 'phone1');
  t.join('Bob', 'phone2');
  assert.ok(t.last('phone1', 'player:replaced'));
  // old socket's disconnect must not mark the player offline
  t.drop('phone1');
  assert.equal(t.state().players[0].connected, true);
  // and events from the old socket no longer act as Bob
  t.host('host:start'); // section
  t.host('host:next'); // question
  assert.equal(t.state().phase, 'question');
  t.emit('phone1', 'player:answer', 1);
  assert.equal(t.state().players[0].answered, false);
  t.emit('phone2', 'player:answer', 1);
  assert.equal(t.state().players[0].answered, true);
});

test('events for another mode reply inactive', () => {
  const t = createTestHub();
  t.join('Ann');
  assert.deepEqual(t.emit('s-ann', 'fibbage:submit', { text: 'x' }), { ok: false, reason: 'inactive' });
});

test('setmode switches mode, resets every mode, and broadcasts', () => {
  const t = createTestHub();
  t.join('A');
  t.join('B');
  t.host('host:start');
  assert.equal(t.state().phase, 'section');
  t.host('host:setmode', 'gartic');
  assert.equal(t.state().mode, 'gartic');
  assert.equal(t.state().phase, 'lobby');
  t.host('host:setmode', 'trivia');
  assert.equal(t.state().phase, 'lobby');
  t.host('host:setmode', 'nonsense');
  assert.equal(t.state().mode, 'trivia');
});

test('gameIds are unique across games and modes', () => {
  const t = createTestHub();
  t.join('A');
  t.join('B');
  t.host('host:start');
  const g1 = t.state().gameId;
  t.host('host:setmode', 'fibbage');
  t.host('host:start');
  const g2 = t.state().gameId;
  t.host('host:reset');
  t.host('host:start');
  const g3 = t.state().gameId;
  assert.ok(g1 > 0 && g2 > g1 && g3 > g2);
});
