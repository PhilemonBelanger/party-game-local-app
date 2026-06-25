import { socket } from '../socket';
import QrJoin from '../components/QrJoin.jsx';
import TimerBar from '../components/TimerBar.jsx';
import PlayerPanel from '../components/PlayerPanel.jsx';
import FibbagePrompt, { useLangPick } from '../components/FibbagePrompt.jsx';
import { useT } from '../i18n.jsx';

export default function FibbageHostView({ state }) {
  const t = useT();
  const pick = useLangPick();
  if (!state) return <div className="screen center">{t('common.connecting')}</div>;
  const {
    phase, players = [], prompt, cards = [], truth, truthId,
    promptIndex, totalPrompts, submittedCount, votedCount, totalInGame,
    timeRemaining, timeLimit, timeUp, rankings, topThumbs,
  } = state;

  if (phase === 'lobby') {
    return (
      <div className="screen host center">
        <h1 className="logo">{t('fibbage.logo')}</h1>
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
        {players.length < 2 && <p className="hint">{t('fibbage.needTwo')}</p>}
      </div>
    );
  }

  if (phase === 'podium') {
    const onPodium = (rankings || []).filter((p) => p.rank <= 3);
    const rest = (rankings || []).filter((p) => p.rank > 3);
    return (
      <div className="screen host center podium-screen">
        <h1 className="logo">{t('host.finalScores')}</h1>
        <div className="podium">
          {onPodium.map((p) => (
            <Step key={p.id} place={p.rank} p={p} />
          ))}
        </div>
        {topThumbs && (
          <div className="fb-mention">{t('fibbage.mostUpvoted', { name: topThumbs.name, n: topThumbs.thumbs })}</div>
        )}
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

  const header = (
    <header className="qheader">
      <span>{t('fibbage.promptXofY', { n: promptIndex + 1, total: totalPrompts })}</span>
    </header>
  );

  if (phase === 'answer') {
    const canNext = (totalInGame > 0 && submittedCount === totalInGame) || timeUp;
    return (
      <div className="screen host game">
        {header}
        <TimerBar remaining={timeRemaining} limit={timeLimit} />
        <FibbagePrompt prompt={prompt} className="big" />
        <p className="g-count">
          {t('fibbage.submitted', { n: submittedCount, total: totalInGame })}{timeUp ? t('gartic.timesUpSuffix') : ''}
        </p>
        <div className="reveal-bar">
          <button className="primary big" disabled={!canNext} onClick={() => socket.emit('fibbage:next')}>
            {canNext ? t('fibbage.toVoting') : t('fibbage.waitingSubmit', { n: submittedCount, total: totalInGame })}
          </button>
        </div>
        <PlayerPanel players={players} showAnswered />
        <div className="qr-corner"><QrJoin size={110} /></div>
      </div>
    );
  }

  if (phase === 'vote') {
    const canNext = (totalInGame > 0 && votedCount === totalInGame) || timeUp;
    return (
      <div className="screen host game">
        {header}
        <TimerBar remaining={timeRemaining} limit={timeLimit} />
        <FibbagePrompt prompt={prompt} />
        <h2 className="fb-instruct">{t('fibbage.whichTrue')}</h2>
        <div className="fb-cards host">
          {cards.map((c) => (
            <div key={c.id} className="fb-card">{pick(c.text, c.textFR)}</div>
          ))}
        </div>
        <p className="g-count">
          {t('fibbage.voted', { n: votedCount, total: totalInGame })}{timeUp ? t('gartic.timesUpSuffix') : ''}
        </p>
        <div className="reveal-bar">
          <button className="primary big" disabled={!canNext} onClick={() => socket.emit('fibbage:next')}>
            {canNext ? t('fibbage.revealResults') : t('fibbage.waitingVote', { n: votedCount, total: totalInGame })}
          </button>
        </div>
        <PlayerPanel players={players} showAnswered />
        <div className="qr-corner"><QrJoin size={110} /></div>
      </div>
    );
  }

  if (phase === 'reveal') {
    const lastPrompt = promptIndex + 1 >= totalPrompts;
    return (
      <div className="screen host game">
        {header}
        <FibbagePrompt prompt={prompt} fill={pick(truth, state.truthFR)} className="big" />
        <div className="fb-cards host reveal">
          {cards.map((c) => (
            <div key={c.id} className={`fb-card ${c.isTruth ? 'truth' : ''}`}>
              <div className="fb-card-text">
                {pick(c.text, c.textFR)}
                {c.isTruth && <span className="fb-truth-tag">{t('fibbage.theTruth')}</span>}
                {!c.isTruth && c.authorNames.length > 0 && (
                  <span className="fb-by">{t('fibbage.by', { names: c.authorNames.join(', ') })}</span>
                )}
              </div>
              <div className="fb-card-meta">
                {c.thumbs > 0 && <span className="fb-thumb-count">👍 {c.thumbs}</span>}
                {c.voterNames.length > 0 && (
                  <span className="chips">
                    {c.voterNames.map((nm, i) => (
                      <span key={i} className="chip">{nm}</span>
                    ))}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="reveal-bar">
          <button className="primary big" onClick={() => socket.emit('fibbage:next')}>
            {lastPrompt ? t('common.showPodium') : t('fibbage.nextPrompt')}
          </button>
        </div>
        <PlayerPanel players={players} />
        <div className="qr-corner"><QrJoin size={110} /></div>
      </div>
    );
  }

  return null;
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
