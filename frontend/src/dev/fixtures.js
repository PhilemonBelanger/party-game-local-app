// Fixture `state` snapshots for the dev screen gallery (?dev=gallery). Shapes mirror the
// backend's snapshot() output (see backend/trivia.js, gartic.js, fibbage.js) — keep them in
// sync when the state contract changes.

const players = [
  { id: 'alice', name: 'Alice', buddy: '🦊', connected: true, answered: true, score: 1250 },
  { id: 'bob', name: 'Bob', buddy: '🐼', connected: true, answered: false, score: 980 },
  { id: 'chloe', name: 'Chloé', buddy: '🐸', connected: true, answered: true, score: 1400 },
  { id: 'dev', name: 'Dev', buddy: '🦁', connected: true, answered: true, score: 600 },
  { id: 'emile', name: 'Émile', buddy: '🐙', connected: false, answered: false, score: 450 },
  { id: 'fatou', name: 'Fatou', buddy: '🦄', connected: true, answered: false, score: 1100 },
];
const rankings = [
  { id: 'chloe', name: 'Chloé', buddy: '🐸', score: 1400, rank: 1 },
  { id: 'alice', name: 'Alice', buddy: '🦊', score: 1250, rank: 2 },
  { id: 'fatou', name: 'Fatou', buddy: '🦄', score: 1100, rank: 3 },
  { id: 'bob', name: 'Bob', buddy: '🐼', score: 980, rank: 4 },
  { id: 'dev', name: 'Dev', buddy: '🦁', score: 600, rank: 5 },
];
const timer = (remaining, limit) => ({ timeRemaining: remaining, timeLimit: limit, timeUp: remaining === 0 });
const question = {
  type: 'choice', text: 'Which planet has the most known moons?', image: null,
  choices: [{ text: 'Saturn' }, { text: 'Jupiter' }, { text: 'Uranus' }, { text: 'Neptune' }].map((c) => ({ ...c, image: null })),
};
const trivia = { mode: 'trivia', title: 'Summer Quiz', gameId: 1, questionIndex: 3, totalQuestions: 10, questionNumber: 4, players };
const prompt = { category: 'Animals', question: 'A group of crows is called a <BLANK>.', questionFR: 'Un groupe de corbeaux est une <BLANK>.' };
const cards = [
  { id: 0, text: 'murder', textFR: 'bande' }, { id: 1, text: 'parliament', textFR: 'parliament' },
  { id: 2, text: 'caw-nference', textFR: 'caw-nference' }, { id: 3, text: 'flock party', textFR: 'flock party' }, { id: 4, text: 'cabinet', textFR: 'cabinet' },
];
const fib = { mode: 'fibbage', title: 'Fibbage', gameId: 2, promptIndex: 2, totalPrompts: 10, prompt, points: { truth: 150, vote: 100, thumb: 50, truthAttempt: 100 } };

export const SCREENS = [
  { key: 'home', label: 'Phone · Join', device: 'phone', role: null },
  { key: 'trivia-lobby', label: 'TV · Trivia lobby', device: 'tv', role: 'host',
    state: { ...trivia, gameId: 0, phase: 'lobby', questionIndex: -1, ...timer(30, 30) } },
  { key: 'trivia-question', label: 'TV · Question (18s left)', device: 'tv', role: 'host',
    state: { ...trivia, phase: 'question', question, canAdvance: false, ...timer(18, 30) } },
  { key: 'trivia-question-late', label: 'TV · Question (4s left)', device: 'tv', role: 'host',
    state: { ...trivia, phase: 'question', question, canAdvance: false, ...timer(4, 30) } },
  { key: 'trivia-reveal', label: 'TV · Reveal', device: 'tv', role: 'host',
    state: { ...trivia, phase: 'reveal', question, correctIndex: 0, lastItem: false, canAdvance: true,
      players: players.map((p, i) => ({ ...p, choice: [0, 1, 0, 2, null, 0][i] })), ...timer(0, 30) } },
  { key: 'trivia-player', label: 'Phone · Question', device: 'phone', role: 'player', me: 'chloe',
    state: { ...trivia, phase: 'question', question, players: players.map((p) => ({ ...p, answered: false })), ...timer(18, 30) } },
  { key: 'section', label: 'TV · Section', device: 'tv', role: 'host',
    state: { ...trivia, phase: 'section', section: { title: 'Round 2: Space', image: null, description: 'Ten questions about planets, stars and rockets.' }, lastItem: false, canAdvance: true, ...timer(30, 30) } },
  { key: 'podium', label: 'TV · Podium', device: 'tv', role: 'host',
    state: { ...trivia, phase: 'podium', rankings, ...timer(0, 30) } },
  { key: 'player-final', label: 'Phone · Final', device: 'phone', role: 'player', me: 'chloe',
    state: { ...trivia, phase: 'podium', rankings, ...timer(0, 30) } },
  { key: 'gartic-round', label: 'TV · Gartic round', device: 'tv', role: 'host',
    state: { mode: 'gartic', title: 'Gartic Phone', gameId: 3, phase: 'round', round: 1, totalRounds: 5, taskType: 'draw',
      submittedCount: 3, totalInGame: 5, canAdvance: false, players, ...timer(64, 100) } },
  { key: 'gartic-player', label: 'Phone · Gartic guess', device: 'phone', role: 'player', me: 'chloe',
    state: { mode: 'gartic', title: 'Gartic Phone', gameId: 3, phase: 'round', round: 2, totalRounds: 5, taskType: 'guess', players, ...timer(40, 60) } },
  { key: 'gartic-reveal', label: 'TV · Gartic reveal', device: 'tv', role: 'host',
    state: { mode: 'gartic', title: 'Gartic Phone', gameId: 3, phase: 'reveal', round: 5, totalRounds: 5, players, canAdvance: false,
      reveal: { book: 0, entry: 0, totalBooks: 5, totalEntries: 5, seedAuthor: 'Chloé', seedPrompt: 'a cat on a skateboard',
        type: 'prompt', content: 'a cat on a skateboard', frames: null, author: 'Chloé', atStart: true, atEnd: false }, ...timer(0, 0) } },
  { key: 'fibbage-answer', label: 'TV · Fibbage answer', device: 'tv', role: 'host',
    state: { ...fib, phase: 'answer', suggestions: ['flock'], suggestionsFR: ['volée'], submittedCount: 0, totalInGame: 2, canAdvance: false, players, ...timer(51, 60) } },
  { key: 'fibbage-vote', label: 'TV · Fibbage vote', device: 'tv', role: 'host',
    state: { ...fib, phase: 'vote', cards, votedCount: 2, totalInGame: 5, canAdvance: false, players, ...timer(42, 100) } },
  { key: 'fibbage-player-vote', label: 'Phone · Fibbage vote', device: 'phone', role: 'player', me: 'chloe',
    state: { ...fib, phase: 'vote', cards, players, ...timer(42, 100) } },
  { key: 'fibbage-player-answer', label: 'Phone · Fibbage answer', device: 'phone', role: 'player', me: 'chloe',
    state: { ...fib, phase: 'answer', suggestions: ['flock'], suggestionsFR: ['volée'], players, ...timer(51, 60) } },
  { key: 'fibbage-reveal', label: 'TV · Fibbage reveal', device: 'tv', role: 'host',
    state: { ...fib, phase: 'reveal', truth: 'murder', truthFR: 'bande', truthId: 0, truthAttempters: ['Dev'], canAdvance: true, players,
      cards: [
        { id: 0, text: 'murder', textFR: 'bande', isTruth: true, authorNames: [], voterNames: ['Alice', 'Dev'], thumbs: 0 },
        { id: 1, text: 'parliament', textFR: 'parliament', isTruth: false, authorNames: ['Bob'], voterNames: ['Chloé'], thumbs: 2 },
        { id: 2, text: 'caw-nference', textFR: 'caw-nference', isTruth: false, authorNames: ['Chloé'], voterNames: ['Fatou'], thumbs: 1 },
      ], ...timer(100, 100) } },
];
