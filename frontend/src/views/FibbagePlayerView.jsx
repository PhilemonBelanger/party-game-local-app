import { useEffect, useRef } from 'react';
import { socket } from '../socket';
import Timer from '../components/Timer.jsx';
import FibbagePrompt, { useLangPick } from '../components/FibbagePrompt.jsx';
import { Notice, PlayerFinal, Spectating } from '../components/Screens.jsx';
import { useKeyedState, usePhaseInput } from '../hooks.js';
import { useT } from '../i18n.jsx';

// per-prompt local state (resets when gameId or promptIndex changes)
const PROMPT_INIT = { text: '', truthWarn: false, selectedCard: null, thumbCard: null, ownCardId: null, result: null };
// per-game local state (resets on a new game → clears spectator + suggestion count)
const GAME_INIT = { spectator: false, sugUsed: 0, sugMax: 3 };

export default function FibbagePlayerView({ state, me }) {
  const t = useT();
  const pick = useLangPick();
  const gameId = state?.gameId ?? 0;
  const promptIndex = state?.promptIndex;
  const phase = state?.phase;
  const timeUp = state?.timeUp;
  const promptKey = `${gameId}:${promptIndex}`;

  const [p, setP] = useKeyedState(promptKey, PROMPT_INIT);
  const [game, setGame] = useKeyedState(gameId, GAME_INIT);
  const textRef = useRef('');
  textRef.current = p.text;

  const emitDraft = (text) => socket.emit('fibbage:draft', { gameId, promptIndex, text });
  const answer = usePhaseInput({
    step: `${promptKey}:answer`,
    active: phase === 'answer' && !game.spectator,
    timeUp,
    draft: () => emitDraft(textRef.current),
  });
  const vote = usePhaseInput({ step: `${promptKey}:vote`, active: phase === 'vote' && !game.spectator, timeUp });

  // private events carry their own gameId/promptIndex, so they land on the right step
  const markAnswer = answer.markSubmitted;
  const markVote = vote.markSubmitted;
  useEffect(() => {
    const onResult = (r) => setP({ result: r }, `${r.gameId}:${r.promptIndex}`);
    const onSync = (s) => {
      if (!s) return;
      if (s.spectator) return setGame({ spectator: true }, s.gameId);
      const key = `${s.gameId}:${s.promptIndex}`;
      setGame({ spectator: false, sugUsed: s.suggestionsUsed ?? 0, sugMax: s.maxSuggestions ?? 3 }, s.gameId);
      setP(
        {
          ...(s.ownCardId != null ? { ownCardId: s.ownCardId } : {}),
          ...(s.votedCardId != null ? { selectedCard: s.votedCardId } : {}),
          ...(s.thumbCardId != null ? { thumbCard: s.thumbCardId } : {}),
        },
        key
      );
      if (s.lie != null) markAnswer(`${key}:answer`);
      if (s.votedCardId != null) markVote(`${key}:vote`);
    };
    // which card is ours, sent at vote start (works even when our answer was auto-filled from a draft)
    const onMyCard = (m) => setP({ ownCardId: m?.cardId ?? null }, `${m.gameId}:${m.promptIndex}`);
    socket.on('result', onResult);
    socket.on('fibbage:sync', onSync);
    socket.on('fibbage:mycard', onMyCard);
    return () => {
      socket.off('result', onResult);
      socket.off('fibbage:sync', onSync);
      socket.off('fibbage:mycard', onMyCard);
    };
  }, [setP, setGame, markAnswer, markVote]);

  if (!state) return <div className="screen center">{t('common.connecting')}</div>;
  const { cards = [], suggestions = [], suggestionsFR = [], prompt, rankings, points = {} } = state;

  if (game.spectator) return <Spectating />;
  if (phase === 'lobby') return <Notice title={t('gartic.youreIn')} hint={t('fibbage.waitStart')} />;
  if (phase === 'podium') return <PlayerFinal rankings={rankings} me={me} />;

  // ---- answer phase ----
  function submitLie() {
    const clean = p.text.trim();
    if (!clean) return;
    const forStep = `${promptKey}:answer`;
    socket.emit('fibbage:submit', { gameId, promptIndex, text: clean }, (res) => {
      if (res?.ok) {
        setP({ truthWarn: false }, promptKey);
        answer.markSubmitted(forStep);
      } else if (res?.reason === 'truth') {
        setP({ truthWarn: true }, promptKey); // "that's the real answer — pick something else!"
      }
    });
  }
  function getSuggestion() {
    // localized pool: FR list when the player's UI is French (fall back to EN)
    const list = suggestionsFR.length === suggestions.length && suggestionsFR.length ? pick(suggestions, suggestionsFR) : suggestions;
    if (game.sugUsed >= game.sugMax || list.length === 0) return;
    // server meters the game-wide allowance; only fill the box if it grants one
    socket.emit('fibbage:suggestion', { gameId, promptIndex }, (res) => {
      if (res?.used != null) setGame({ sugUsed: res.used, ...(res.max != null ? { sugMax: res.max } : {}) }, gameId);
      if (res?.ok) {
        const text = list[Math.floor(Math.random() * list.length)];
        setP({ text }, promptKey);
        emitDraft(text);
      }
    });
  }

  if (phase === 'answer') {
    return (
      <div className="screen player fibbage-play">
        <div className="timer-row"><Timer remaining={state.timeRemaining} limit={state.timeLimit} size={64} /></div>
        {answer.submitted ? (
          <Notice grow title={t('fibbage.lieLocked')} hint={t('gartic.waitOthers')} />
        ) : answer.lockedOut ? (
          <Notice grow title={t('player.timesUp')} hint={t('player.waitReveal')} />
        ) : (
          <div className="g-task">
            <FibbagePrompt prompt={prompt} />
            <h3 className="fb-instruct">{t('fibbage.writeLie')}</h3>
            {p.truthWarn && <p className="fb-truth-warn">{t('fibbage.thatsTheTruth', { pts: points.truthAttempt })}</p>}
            <input
              value={p.text}
              maxLength={120}
              autoFocus
              placeholder={t('fibbage.liePlaceholder')}
              onChange={(e) => {
                setP({ text: e.target.value, truthWarn: false });
                // draft every keystroke so an unsubmitted textbox is autosent on time-up
                // even if the host advances the instant the timer hits 0
                emitDraft(e.target.value);
              }}
              onKeyDown={(e) => e.key === 'Enter' && submitLie()}
            />
            <button className="ghost" disabled={game.sugUsed >= game.sugMax || suggestions.length === 0} onClick={getSuggestion}>
              {t('fibbage.getSuggestion')}
            </button>
            <p className="fb-sug-count">{t('fibbage.suggestionsLeft', { used: game.sugUsed, max: game.sugMax })}</p>
            <button className="primary big" disabled={!p.text.trim()} onClick={submitLie}>
              {t('common.submit')}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ---- vote phase ----
  if (phase === 'vote') {
    const { selectedCard, thumbCard, ownCardId } = p;
    // must pick a truth AND thumb a different card before locking in
    const canLock = selectedCard != null && thumbCard != null && selectedCard !== thumbCard;
    function lockVote() {
      if (!canLock) return;
      socket.emit('fibbage:vote', { gameId, promptIndex, cardId: selectedCard, thumbId: thumbCard });
      vote.markSubmitted(`${promptKey}:vote`);
    }
    return (
      <div className="screen player fibbage-play">
        <div className="timer-row"><Timer remaining={state.timeRemaining} limit={state.timeLimit} size={64} /></div>
        {vote.submitted ? (
          <Notice grow title={t('fibbage.voteLocked')} hint={t('gartic.waitOthers')} />
        ) : vote.lockedOut ? (
          <Notice grow title={t('player.timesUp')} hint={t('player.waitReveal')} />
        ) : (
          <div className="g-task">
            <FibbagePrompt prompt={prompt} />
            <h3 className="fb-instruct">{t('fibbage.pickTrue')}</h3>
            <div className="fb-cards">
              {cards.map((c) => {
                const own = c.id === ownCardId;
                return (
                  <div key={c.id} className={`fb-card-row ${selectedCard === c.id ? 'sel' : ''} ${own ? 'own' : ''}`}>
                    <button className="fb-card-pick" disabled={own || thumbCard === c.id} onClick={() => setP({ selectedCard: c.id })}>
                      {pick(c.text, c.textFR)}
                      {own && <span className="fb-by">{t('fibbage.yourLie')}</span>}
                    </button>
                    <button
                      className={`fb-thumb ${thumbCard === c.id ? 'on' : ''}`}
                      disabled={own || selectedCard === c.id}
                      onClick={() => setP({ thumbCard: thumbCard === c.id ? null : c.id })}
                      title={t('fibbage.thumbHint')}
                    >
                      👍
                    </button>
                  </div>
                );
              })}
            </div>
            <button className="primary big" disabled={!canLock} onClick={lockVote}>
              {t('fibbage.lockIn')}
            </button>
            {!canLock && <p className="fb-sug-count">{t('fibbage.pickBothHint')}</p>}
          </div>
        )}
      </div>
    );
  }

  // ---- reveal phase ----
  if (phase === 'reveal') {
    const { result } = p;
    return (
      <div className="screen player center">
        {result && (
          <div className={`verdict ${result.gained > 0 ? 'win' : 'lose'}`}>
            {result.gained > 0 ? t('fibbage.youGained', { n: result.gained }) : t('fibbage.noPoints')}
          </div>
        )}
        <h2>{t('player.answerIs')} <b>{pick(state.truth, state.truthFR)}</b></h2>
        {result && (
          <ul className="fb-breakdown">
            {result.triedTruth && <li>{t('fibbage.bdTriedTruth', { pts: points.truthAttempt })}</li>}
            {result.guessedRight && <li>{t('fibbage.bdGuessed', { pts: points.truth })}</li>}
            {result.votesOnYou > 0 && <li>{t('fibbage.bdFooled', { n: result.votesOnYou, pts: points.vote })}</li>}
            {result.thumbBonus && <li>{t('fibbage.bdThumbs', { pts: points.thumb })}</li>}
          </ul>
        )}
        {result && <p className="score-line">{t('player.yourScore')} <b>{result.newScore}</b></p>}
        <p className="hint">{t('common.waitingHost')}</p>
      </div>
    );
  }

  return null;
}
