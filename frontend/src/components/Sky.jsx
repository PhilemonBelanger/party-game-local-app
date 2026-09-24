import { buddyOf } from '../buddies.js';

// Sky Candy building blocks shared by every screen.

// Drifting clouds behind everything (fixed layer, mounted once in App).
export function Clouds() {
  return (
    <div className="clouds" aria-hidden>
      <span className="cloud c1" />
      <span className="cloud c2" />
      <span className="cloud c3" />
      <span className="cloud c4" />
    </div>
  );
}

// "partypack" wordmark (size: px number or any CSS length, e.g. a clamp())
export function Wordmark({ size = 64 }) {
  return (
    <div className="wordmark" style={{ fontSize: size }}>
      party<span>pack</span>
    </div>
  );
}

// A player's buddy in a white bubble. `done` adds the green ✓ badge; `off` greys it out.
export function Buddy({ player, size = 56, done = false, off = false, hop = false, delay = 0, className = '' }) {
  return (
    <span
      className={`face ${off ? 'off' : ''} ${hop ? 'hop' : ''} ${className}`}
      style={{ '--sz': `${size}px`, animationDelay: `${delay}s` }}
    >
      {off ? '💤' : buddyOf(player)}
      {done && <span className="ok">✓</span>}
    </span>
  );
}

// The owl host asking something in a speech bubble. `kicker` is the small line on top.
export function Ask({ kicker, children, className = '' }) {
  return (
    <div className={`ask ${className}`}>
      <span className="owl" aria-hidden>🦉</span>
      <div className="bubble">
        {kicker && <div className="kicker">{kicker}</div>}
        {children}
      </div>
    </div>
  );
}
