// Test harness: drives the real hub + modes in-process. No sockets, no wall-clock time.
import { createHub } from '../hub.js';
import { createModes } from '../modes.js';

// Manual clock: intervals only fire when the test calls tick().
export function createFakeClock() {
  let nextId = 1;
  const timers = new Map();
  return {
    setInterval(fn) {
      const id = nextId++;
      timers.set(id, fn);
      return id;
    },
    clearInterval(id) {
      timers.delete(id);
    },
    // advance n seconds
    tick(n = 1) {
      for (let i = 0; i < n; i++) for (const fn of [...timers.values()]) fn();
    },
    get active() {
      return timers.size;
    },
  };
}

// Deterministic rng (mulberry32).
export function seededRng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const QUIZ = {
  title: 'Test Quiz',
  questions: [
    { type: 'section', title: 'Round 1' },
    { q: 'Pick B', choices: ['A', 'B', 'C'], answer: 1, points: 100 },
    { q: 'How many?', type: 'number', answer: 10, points: 200 },
  ],
};

export const FIBBAGE_POOL = {
  normal: [
    {
      category: 'Animals', question: 'A group of crows is called a <BLANK>.', questionFR: 'Un groupe de corbeaux est une <BLANK>.',
      answer: 'murder', answerFR: 'bande', alternateSpellings: ['a murder'], alternateSpellingsFR: [],
      suggestions: ['flock', 'party', 'council', 'gang'], suggestionsFR: ['volée', 'fête', 'conseil', 'gang'],
    },
    {
      category: 'Places', question: 'The Motor City is <BLANK>.', questionFR: 'La ville du moteur est <BLANK>.',
      answer: 'Detroit', answerFR: 'Détroit', alternateSpellings: [], alternateSpellingsFR: [],
      suggestions: ['Chicago', 'Toledo', 'Flint', 'Dayton'], suggestionsFR: ['Chicago', 'Toledo', 'Flint', 'Dayton'],
    },
  ],
  final: [],
};

// A hub wired exactly like server.js, plus helpers to act as host/players and inspect output.
export function createTestHub({ config = {}, quiz = QUIZ, fibbagePool = FIBBAGE_POOL, seed = 1 } = {}) {
  const clock = createFakeClock();
  const sent = []; // { to: socketId | '*', event, payload }
  const transport = {
    toSocket: (to, event, payload) => sent.push({ to, event, payload }),
    toAll: (event, payload) => sent.push({ to: '*', event, payload }),
  };
  const hub = createHub({
    transport,
    clock,
    makeModes: (ctx) => createModes(ctx, { config, quiz, fibbagePool, rng: seededRng(seed) }),
  });

  const t = {
    hub,
    clock,
    sent,
    // emit an event from a socket; returns whatever the server passed to the ack callback
    emit(socketId, event, payload) {
      let res;
      hub.handle(socketId, event, payload, (r) => {
        res = r;
      });
      return res;
    },
    host: (event, payload) => t.emit('host', event, payload),
    join(name, socketId = `s-${name.toLowerCase()}`) {
      hub.connect(socketId);
      return t.emit(socketId, 'player:join', name).id;
    },
    drop: (socketId) => hub.disconnect(socketId),
    state: () => hub.snapshot(),
    // latest private message of `event` sent to a socket
    last(socketId, event) {
      for (let i = sent.length - 1; i >= 0; i--) if (sent[i].to === socketId && sent[i].event === event) return sent[i].payload;
      return undefined;
    },
    count: (socketId, event) => sent.filter((m) => m.to === socketId && m.event === event).length,
    clear: () => {
      sent.length = 0;
    },
  };
  hub.connect('host');
  t.host('host:join');
  return t;
}
