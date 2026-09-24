// Buddies: the emoji avatar each player picks when joining. The server just stores the
// chosen string; players without one (older clients) get a stable pick from their name.
export const BUDDIES = [
  '🦊', '🐼', '🐸', '🦁', '🐙', '🐧', '🐨', '🦄',
  '🐯', '🐰', '🐻', '🐷', '🐵', '🐔', '🐢', '🦖',
  '🐳', '🦋', '🐝', '🐞', '🦀', '🐶', '🐱', '🦒',
  '🦔', '🐹', '🐮', '🦥', '🦩', '🐲',
];

function hash(s) {
  let h = 0;
  for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

// a player's buddy: their pick, else a stable default from their name
export const buddyOf = (p) => p?.buddy || BUDDIES[hash(p?.name) % BUDDIES.length];

// remembered on this device so the picker opens on your last buddy
const KEY = 'buddy';
export function loadBuddy(name) {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && BUDDIES.includes(saved)) return saved;
  } catch {
    /* ignore */
  }
  return buddyOf({ name });
}
export function saveBuddy(b) {
  try {
    localStorage.setItem(KEY, b);
  } catch {
    /* ignore */
  }
}
