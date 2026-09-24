import { socket } from '../socket';
import QrJoin from '../components/QrJoin.jsx';
import Timer from '../components/Timer.jsx';
import { Ask } from '../components/Sky.jsx';
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
  const { phase, players = [], round, taskType, submittedCount, totalInGame, timeRemaining, timeLimit, reveal, canAdvance } = state;

  if (phase === 'lobby') {
    return <HostLobby logo={t('gartic.logo')} players={players} canStart={players.length >= 2} needHint={t('gartic.needTwo')} />;
  }

  if (phase === 'round') {
    return (
      <div className="screen host game center">
        <Timer remaining={timeRemaining} limit={timeLimit} size={180} className="rail" />
        <Ask><h1 className="question">{roundLabel(t, round, taskType)}</h1></Ask>
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
