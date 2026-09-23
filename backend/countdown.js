// Per-phase countdown shared by every mode.
//
// At 0 it latches `timeUp` (input locked) and calls onTimeUp — it never advances the
// game itself; the host always does. Between seconds it calls onTick(remaining) so the
// server can send the lightweight `tick` event instead of a full state snapshot.
//
// `clock` is injectable ({ setInterval, clearInterval }) so tests drive time by hand.

export const realClock = {
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (id) => clearInterval(id),
};

export function createCountdown({ clock = realClock, onTick = () => {}, onTimeUp = () => {} } = {}) {
  let id = null;
  let limit = 0;
  let remaining = 0;
  let timeUp = false;

  function stop() {
    if (id != null) clock.clearInterval(id);
    id = null;
  }

  // set the displayed values without running (untimed phases, lobby)
  function idle(sec = 0) {
    stop();
    limit = sec;
    remaining = sec;
    timeUp = false;
  }

  function start(sec) {
    idle(sec);
    id = clock.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        stop();
        remaining = 0;
        timeUp = true;
        onTimeUp();
      } else {
        onTick(remaining);
      }
    }, 1000);
  }

  return {
    start,
    stop,
    idle,
    get timeUp() {
      return timeUp;
    },
    snapshot: () => ({ timeRemaining: remaining, timeLimit: limit, timeUp }),
  };
}
