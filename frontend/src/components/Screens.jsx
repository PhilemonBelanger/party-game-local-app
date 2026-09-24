import { socket } from '../socket';
import QrJoin from './QrJoin.jsx';
import PlayerPanel from './PlayerPanel.jsx';
import { Buddy, Wordmark } from './Sky.jsx';
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

// Host lobby: wordmark + mode + Start (left), QR card (right), everyone's buddy hopping on
// the hill (bottom). `children` slots mode extras (trivia quiz loader) under Start.
export function HostLobby({ logo, players, canStart, needHint, children }) {
  const t = useT();
  return (
    <div className="lobby">
      <div className="hill" />
      <div className="lobby-brand">
        <Wordmark size={110} />
        <div className="lobby-mode">{logo}</div>
        <button className="primary" disabled={!canStart} onClick={() => socket.emit('host:start')}>
          {t('host.startGo')}
        </button>
        {!canStart && needHint && <p className="hint">{needHint}</p>}
        {children}
      </div>
      <div className="lobby-qr">
        <QrJoin size={230} />
        <div className="qr-title">{t('host.scanHop')}</div>
        <QrUrl />
      </div>
      <div className="lobby-crowd">
        {players.length === 0 && <div className="lobby-empty">{t('host.waitingCrowd')}</div>}
        {players.map((p, i) => (
          <div key={p.id} className="who">
            <Buddy player={p} size={104} off={!p.connected} hop={p.connected} delay={i * 0.22} />
            <span className="name-pill" style={{ opacity: p.connected ? 1 : 0.6 }}>{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// the join URL under the lobby QR (QrJoin renders it when showUrl is set)
function QrUrl() {
  return <QrJoin size={0} showUrl urlOnly />;
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
            <li key={p.id}>#{p.rank} {p.name} · {p.score}</li>
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
      <Buddy player={p} size={place === 1 ? 110 : 86} hop={place === 1} />
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
