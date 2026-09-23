import { socket } from '../socket';
import QrJoin from '../components/QrJoin.jsx';
import TimerBar from '../components/TimerBar.jsx';
import GarticReveal from '../components/GarticReveal.jsx';
import PlayerPanel from '../components/PlayerPanel.jsx';
import { HostLobby } from '../components/Screens.jsx';
import { useT } from '../i18n.jsx';

function roundLabel(t, round, taskType) {
  if (round === 0) return t('gartic.initialPrompt');
  if (taskType === 'draw') return t('gartic.roundDrawing', { round });
  return t('gartic.roundGuessing', { round });
}

export default function GarticHostView({ state }) {
  const t = useT();
  if (!state) return <div className="screen center">{t('common.connecting')}</div>;
  const { phase, players = [], round, taskType, submittedCount, totalInGame, timeRemaining, timeLimit, timeUp, reveal, canAdvance } = state;

  if (phase === 'lobby') {
    return <HostLobby logo={t('gartic.logo')} players={players} canStart={players.length >= 2} needHint={t('gartic.needTwo')} />;
  }

  if (phase === 'round') {
    return (
      <div className="screen host game center">
        <h1 className="question">{roundLabel(t, round, taskType)}</h1>
        <TimerBar remaining={timeRemaining} limit={timeLimit} />
        <p className="g-count">{t('gartic.done', { n: submittedCount, total: totalInGame })}{timeUp ? t('gartic.timesUpSuffix') : ''}</p>
        <button className="primary big" disabled={!canAdvance} onClick={() => socket.emit('gartic:next')}>
          {canAdvance ? t('gartic.nextRound') : t('gartic.waiting', { n: submittedCount, total: totalInGame })}
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
