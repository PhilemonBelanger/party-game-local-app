// Wide bar behind the countdown number. Fills the bar by fraction remaining,
// color interpolates green (full) -> red (empty). Glides each second to match
// the server's 1s tick.
export default function TimerBar({ remaining, limit }) {
  const frac = Math.max(0, Math.min(1, limit ? remaining / limit : 0));
  const hue = 120 * frac; // 120 = green, 0 = red
  return (
    <div className="timerbar">
      <div
        className="timerbar-fill"
        style={{ width: `${frac * 100}%`, background: `hsl(${hue}, 80%, 45%)` }}
      />
      <span className="timerbar-num">{remaining}s</span>
    </div>
  );
}
