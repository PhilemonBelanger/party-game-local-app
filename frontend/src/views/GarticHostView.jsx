import { socket } from '../socket';
import QrJoin from '../components/QrJoin.jsx';
import TimerBar from '../components/TimerBar.jsx';
import GarticReveal from '../components/GarticReveal.jsx';
import PlayerPanel from '../components/PlayerPanel.jsx';
import { useT } from '../i18n.jsx';

function roundLabel(t, round, taskType) {
  if (round === 0) return t('gartic.initialPrompt');
  if (taskType === 'draw') return t('gartic.roundDrawing', { round });
  return t('gartic.roundGuessing', { round });
}

export default function GarticHostView({ state }) {
  const t = useT();
  if (!state) return <div className="screen center">{t('common.connecting')}</div>;
  const { phase, players = [], round, taskType, submittedCount, totalInGame, timeRemaining, timeLimit, timeUp, reveal } = state;

  if (phase === 'lobby') {
    return (
      <div className="screen host center">
        <h1 className="logo">{t('gartic.logo')}</h1>
        <p className="hint">{t('host.scanJoin')}</p>
        <QrJoin size={300} showUrl />
        <h2>{t('host.playersReady', { n: players.length })}</h2>
        <ul className="playerlist">
          {players.map((p) => (
            <li key={p.id} style={{ opacity: p.connected ? 1 : 0.5 }}>{p.name}</li>
          ))}
        </ul>
        <button className="primary big" disabled={players.length < 2} onClick={() => socket.emit('host:start')}>
          {t('common.startGame')}
        </button>
        {players.length < 2 && <p className="hint">{t('gartic.needTwo')}</p>}
      </div>
    );
  }

  if (phase === 'round') {
    const canNext = (totalInGame > 0 && submittedCount === totalInGame) || timeUp;
    return (
      <div className="screen host game center">
        <h1 className="question">{roundLabel(t, round, taskType)}</h1>
        <TimerBar remaining={timeRemaining} limit={timeLimit} />
        <p className="g-count">{t('gartic.done', { n: submittedCount, total: totalInGame })}{timeUp ? t('gartic.timesUpSuffix') : ''}</p>
        <button className="primary big" disabled={!canNext} onClick={() => socket.emit('gartic:next')}>
          {canNext ? t('gartic.nextRound') : t('gartic.waiting', { n: submittedCount, total: totalInGame })}
        </button>
        <PlayerPanel players={players} showAnswered showScore={false} />
        <div className="qr-corner"><QrJoin size={110} /></div>
      </div>
    );
  }

  if (phase === 'reveal') {
    return (
      <div className="screen host center has-roster">
        <GarticReveal reveal={reveal} />
        <PlayerPanel players={players} showScore={false} />
        <div className="g-reveal-nav">
          <button className="primary" disabled={reveal?.atStart} onClick={() => socket.emit('gartic:reveal', -1)}>
            {t('common.back')}
          </button>
          {reveal?.atEnd ? (
            <button className="primary" onClick={() => socket.emit('host:reset')}>{t('common.backToLobby')}</button>
          ) : (
            <button className="primary" onClick={() => socket.emit('gartic:reveal', 1)}>{t('common.next')}</button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
