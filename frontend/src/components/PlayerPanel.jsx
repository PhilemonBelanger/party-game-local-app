// Always-visible roster (top-right). Connected = green, disconnected = red.
// showAnswered: a ✓ next to players done this round (answered / submitted).
// showScore: trivia shows points; gartic hides them.
export default function PlayerPanel({ players, showAnswered = false, showScore = true }) {
  if (!players || players.length === 0) return null;
  const sorted = [...players].sort((a, b) => (showScore ? b.score - a.score : 0) || a.name.localeCompare(b.name));
  return (
    <div className={`player-panel ${showScore ? '' : 'noscore'}`}>
      {sorted.map((p) => (
        <div key={p.id} className={`pp-row ${p.connected ? 'on' : 'off'}`}>
          <span className="pp-dot" />
          <span className="pp-name">{p.name}</span>
          <span className="pp-check">{showAnswered && p.answered ? '✓' : ''}</span>
          {showScore && <span className="pp-score">{p.score}</span>}
        </div>
      ))}
    </div>
  );
}
