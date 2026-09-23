import { socket } from '../socket';
import QrJoin from './QrJoin.jsx';
import PlayerPanel from './PlayerPanel.jsx';
import { useT } from '../i18n.jsx';

// Screens shared by the three game modes.

// Centered title + hint (locked in / time's up / waiting …). `grow` fills the remaining height.
export function Notice({ title, hint, grow = false }) {
  return (
    <div className={grow ? 'center grow' : 'screen player center'}>
      {title && <h2>{title}</h2>}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Spectating() {
  const t = useT();
  return <Notice title={t('gartic.spectating')} hint={t('gartic.spectatingHint')} />;
}

// Host lobby: logo, QR, who's in, Start. `children` slots mode extras (trivia quiz loader).
export function HostLobby({ logo, players, canStart, needHint, children }) {
  const t = useT();
  return (
    <div className="screen host center">
      <h1 className="logo">{logo}</h1>
      <p className="hint">{t('host.scanJoin')}</p>
      <QrJoin size={300} showUrl />
      {children}
      <h2>{t('host.playersReady', { n: players.length })}</h2>
      <ul className="playerlist">
        {players.map((p) => (
          <li key={p.id} style={{ opacity: p.connected ? 1 : 0.5 }}>{p.name}</li>
        ))}
      </ul>
      <button className="primary big" disabled={!canStart} onClick={() => socket.emit('host:start')}>
        {t('common.startGame')}
      </button>
      {!canStart && needHint && <p className="hint">{needHint}</p>}
    </div>
  );
}

// Host podium: top 3 (ties can mean more) on steps, the rest listed. `children` = mode extras.
export function HostPodium({ rankings = [], players, children }) {
  const t = useT();
  const onPodium = rankings.filter((p) => p.rank <= 3);
  const rest = rankings.filter((p) => p.rank > 3);
  return (
    <div className="screen host center podium-screen">
      <h1 className="logo">{t('host.finalScores')}</h1>
      <div className="podium">
        {onPodium.map((p) => (
          <Step key={p.id} place={p.rank} p={p} />
        ))}
      </div>
      {children}
      {rest.length > 0 && (
        <ul className="restlist">
          {rest.map((p) => (
            <li key={p.id}>#{p.rank} {p.name} — {p.score}</li>
          ))}
        </ul>
      )}
      <button className="ghost" onClick={() => socket.emit('host:reset')}>{t('common.backToLobby')}</button>
      <PlayerPanel players={players} />
      <div className="qr-corner"><QrJoin size={110} /></div>
    </div>
  );
}

function Step({ place, p }) {
  return (
    <div className={`step step-${place}`}>
      <div className="medal">{place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉'}</div>
      <div className="step-name">{p.name}</div>
      <div className="step-score">{p.score}</div>
      <div className="block">{place}</div>
    </div>
  );
}

// Player's final screen: rank (tie-aware) + final score.
export function PlayerFinal({ rankings = [], me }) {
  const t = useT();
  const mine = rankings.find((p) => p.id === me);
  const tied = mine && rankings.filter((p) => p.rank === mine.rank).length > 1;
  return (
    <div className="screen player center">
      <h1>{t('player.gameOver')}</h1>
      {mine && <h2>{tied ? t('player.tiedFor', { rank: mine.rank }) : t('player.youFinished', { rank: mine.rank })}</h2>}
      {mine && <p className="score-line">{t('player.finalScore')} <b>{mine.score}</b></p>}
    </div>
  );
}
