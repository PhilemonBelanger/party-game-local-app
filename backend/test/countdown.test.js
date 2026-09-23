import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCountdown } from '../countdown.js';
import { createFakeClock } from './helpers.js';

test('ticks down, then latches timeUp and calls onTimeUp once', () => {
  const clock = createFakeClock();
  const ticks = [];
  let upCalls = 0;
  const c = createCountdown({ clock, onTick: (s) => ticks.push(s), onTimeUp: () => upCalls++ });
  c.start(3);
  assert.deepEqual(c.snapshot(), { timeRemaining: 3, timeLimit: 3, timeUp: false });
  clock.tick(2);
  assert.deepEqual(ticks, [2, 1]);
  assert.equal(c.timeUp, false);
  clock.tick(1);
  assert.equal(c.timeUp, true);
  assert.equal(c.snapshot().timeRemaining, 0);
  assert.equal(upCalls, 1);
  clock.tick(5); // interval cleared at 0
  assert.equal(upCalls, 1);
  assert.equal(clock.active, 0);
});

test('restart clears timeUp; stop and idle leave no running interval', () => {
  const clock = createFakeClock();
  const c = createCountdown({ clock });
  c.start(1);
  clock.tick();
  assert.equal(c.timeUp, true);
  c.start(5);
  assert.equal(c.timeUp, false);
  assert.equal(clock.active, 1);
  c.stop();
  assert.equal(clock.active, 0);
  c.idle(9);
  assert.deepEqual(c.snapshot(), { timeRemaining: 9, timeLimit: 9, timeUp: false });
  assert.equal(clock.active, 0);
});
