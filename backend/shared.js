// Small helpers shared by every game mode.

// Fisher–Yates on a copy. `rng` is injectable so tests can seed it.
export function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Standard competition ranking: equal scores share a rank (1, 1, 3, …).
// entries: [{ id, name, score }] → same objects sorted desc with `rank`.
export function rankings(entries) {
  const sorted = [...entries].sort((a, b) => b.score - a.score);
  let rank = 0;
  let prev = null;
  return sorted.map((p, i) => {
    if (p.score !== prev) {
      rank = i + 1;
      prev = p.score;
    }
    return { ...p, rank };
  });
}

// Keys from `keys` whose player currently has a live socket.
export function connectedKeys(players, keys) {
  return keys.filter((k) => players.get(k)?.connected);
}

// True when every connected in-game player satisfies `done(key)` (and there is at least one).
// Disconnected players never block the host.
export function allDone(players, keys, done) {
  const conn = connectedKeys(players, keys);
  return conn.length > 0 && conn.every(done);
}

// Roster rows for PlayerPanel / lobby lists: { id, name, buddy, connected, ...extra(key) }.
// `keys` null → every known player (lobby); otherwise just the in-game snapshot.
export function roster(players, keys, extra = () => ({})) {
  const list = keys ?? [...players.keys()];
  return list.map((key) => {
    const p = players.get(key);
    return { id: key, name: p?.name || '?', buddy: p?.buddy ?? null, connected: !!p?.connected, ...extra(key) };
  });
}

// Podium entries: { id, name, buddy, score } for rankings().
export function podiumEntries(players, keys, scoreOf) {
  return keys.map((k) => ({ id: k, name: players.get(k)?.name || '?', buddy: players.get(k)?.buddy ?? null, score: scoreOf(k) }));
}

// A payload is stale if it carries a gameId/tag that doesn't match the live one.
// Missing tags are tolerated (older clients).
export function isStale(payloadTag, liveTag) {
  return payloadTag != null && payloadTag !== liveTag;
}
