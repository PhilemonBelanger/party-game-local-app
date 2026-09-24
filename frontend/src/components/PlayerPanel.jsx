import { Buddy } from './Sky.jsx';

// Always-visible roster on the host's right rail: each player's buddy + name (+ score).
// Disconnected players are greyed with 💤. showAnswered: green ✓ badge on players done
// this round (answered / submitted). showScore: trivia/fibbage show points; gartic hides them.
export default function PlayerPanel({ players, showAnswered = false, showScore = true }) {
  if (!players || players.length === 0) return null;
  const sorted = [...players].sort((a, b) => (showScore ? b.score - a.score : 0) || a.name.localeCompare(b.name));
  return (
    <div className={`player-panel ${showScore ? '' : 'noscore'}`}>
      {sorted.map((p) => (
        <div key={p.id} className={`pp-row ${p.connected ? 'on' : 'off'}`}>
          <Buddy player={p} size={40} off={!p.connected} done={showAnswered && p.answered} />
          <span className="pp-name">{p.name}</span>
          {showScore && <span className="pp-score">{p.score}</span>}
        </div>
      ))}
    </div>
  );
}
