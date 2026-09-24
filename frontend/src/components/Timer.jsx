// Ring countdown around the seconds. The ring empties as time runs out, and both the ring
// and the number's disc shift hue gradually from green (full) to red (empty). Transitions
// glide over each 1s server tick. `size` in px; `className="rail"` pins it to the host's
// right rail (see styles.css).
export default function Timer({ remaining, limit, size = 72, className = '' }) {
  const frac = Math.max(0, Math.min(1, limit ? remaining / limit : 0));
  const hue = Math.round(120 * frac); // 120 = green … 0 = red
  const stroke = Math.max(5, size * 0.09);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ring = `hsl(${hue} 78% 45%)`;
  const disc = `hsl(${hue} 90% 72%)`;
  return (
    <div
      className={`timer ${className}`}
      style={{ width: size, height: size, '--halo': `hsl(${hue} 85% 60% / .35)` }}
      role="timer"
      aria-label={`${remaining}s`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r - stroke * 0.9} fill={disc} className="timer-disc" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.75)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ring}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="timer-ring"
        />
      </svg>
      <span className="timer-num" style={{ fontSize: size * 0.4 }}>{remaining}</span>
    </div>
  );
}
