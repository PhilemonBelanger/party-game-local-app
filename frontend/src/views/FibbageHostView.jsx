import { socket } from '../socket';
import QrJoin from '../components/QrJoin.jsx';
import Timer from '../components/Timer.jsx';
import { Ask } from '../components/Sky.jsx';
import PlayerPanel from '../components/PlayerPanel.jsx';
import FibbagePrompt, { useLangPick } from '../components/FibbagePrompt.jsx';
import { HostLobby, HostPodium } from '../components/Screens.jsx';
import { useT } from '../i18n.jsx';

export default function FibbageHostView({ state }) {
  const t = useT();
  const pick = useLangPick();
  if (!state) return <div className="screen center">{t('common.connecting')}</div>;
  const {
    phase, players = [], prompt, cards = [], truth, truthId, truthAttempters = [],
    promptIndex, totalPrompts, submittedCount, votedCount, totalInGame,
    timeRemaining, timeLimit, rankings, topThumbs, canAdvance, points = {},
  } = state;

  if (phase === 'lobby') {
    return <HostLobby logo={t('fibbage.logo')} players={players} canStart={players.length >= 2} needHint={t('fibbage.needTwo')} />;
  }

  if (phase === 'podium') {
    return (
      <HostPodium rankings={rankings} players={players}>
        {topThumbs && <div className="fb-mention">{t('fibbage.mostUpvoted', { name: topThumbs.name, n: topThumbs.thumbs })}</div>}
      </HostPodium>
    );
  }

  const kicker = t('fibbage.promptXofY', { n: promptIndex + 1, total: totalPrompts });

  if (phase === 'answer') {
    return (
      <div className="screen host game">
        <Timer remaining={timeRemaining} limit={timeLimit} size={180} className="rail" />
        <Ask kicker={kicker}><FibbagePrompt prompt={prompt} className="big" /></Ask>
        <div className="reveal-bar">
          <button className="primary big" disabled={!canAdvance} onClick={() => socket.emit('fibbage:next')}>
            {canAdvance ? t('fibbage.toVoting') : t('fibbage.waitingSubmit', { n: submittedCount, total: totalInGame })}
          </button>
        </div>
        <PlayerPanel players={players} showAnswered />
        <div className="qr-corner"><QrJoin size={110} /></div>
      </div>
    );
  }

  if (phase === 'vote') {
    return (
      <div className="screen host game">
        <Timer remaining={timeRemaining} limit={timeLimit} size={180} className="rail" />
        <Ask kicker={kicker}><FibbagePrompt prompt={prompt} /></Ask>
        <h2 className="fb-instruct">{t('fibbage.whichTrue')}</h2>
        <div className="fb-cards host">
          {cards.map((c) => (
            <div key={c.id} className="fb-card">{pick(c.text, c.textFR)}</div>
          ))}
        </div>
        <div className="reveal-bar">
          <button className="primary big" disabled={!canAdvance} onClick={() => socket.emit('fibbage:next')}>
            {canAdvance ? t('fibbage.revealResults') : t('fibbage.waitingVote', { n: votedCount, total: totalInGame })}
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
        <Ask kicker={kicker}><FibbagePrompt prompt={prompt} fill={pick(truth, state.truthFR)} className="big" /></Ask>
        {truthAttempters.length > 0 && (
          <div className="fb-truth-attempt">{t('fibbage.triedTruthReveal', { names: truthAttempters.join(', '), pts: points.truthAttempt })}</div>
        )}
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
