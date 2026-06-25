import { useEffect, useRef, useState } from 'react';
import { socket } from '../socket';
import TimerBar from '../components/TimerBar.jsx';
import FibbagePrompt, { useLangPick } from '../components/FibbagePrompt.jsx';
import { useT } from '../i18n.jsx';

// must match the server's norm() so own-card detection lines up (accent-folded)
const norm = (s) =>
  String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().replace(/\s+/g, ' ').toLowerCase();

export default function FibbagePlayerView({ state, me }) {
  const t = useT();
  const pick = useLangPick();
  // answer phase
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [truthWarn, setTruthWarn] = useState(false);
  const [suggestionUsed, setSuggestionUsed] = useState(false);
  const [myLie, setMyLie] = useState(''); // my submitted lie text (to hide my own card)
  // vote phase
  const [selectedCard, setSelectedCard] = useState(null);
  const [thumbCard, setThumbCard] = useState(null);
  const [voted, setVoted] = useState(false);
  // shared
  const [lockedOut, setLockedOut] = useState(false); // timer hit 0, input frozen
  const [spectator, setSpectator] = useState(false);
  const [result, setResult] = useState(null);

  const textRef = useRef('');
  textRef.current = text;
  const promptIndex = state?.promptIndex;

  // fresh prompt → reset everything (each prompt restarts at the answer phase)
  useEffect(() => {
    setText('');
    setSubmitted(false);
    setTruthWarn(false);
    setSuggestionUsed(false);
    setMyLie('');
    setSelectedCard(null);
    setThumbCard(null);
    setVoted(false);
    setLockedOut(false);
    setResult(null);
  }, [promptIndex]);

  // private events: per-player result + reconnect resume
  useEffect(() => {
    const onResult = (r) => setResult(r);
    const onSync = (s) => {
      if (s?.spectator) {
        setSpectator(true);
        return;
      }
      if (s?.lie != null) {
        setMyLie(s.lie);
        if (s.phase === 'answer') {
          setSubmitted(true);
        }
      }
      if (s?.votedCardId != null) {
        setSelectedCard(s.votedCardId);
        setVoted(true);
      }
      if (s?.thumbCardId != null) setThumbCard(s.thumbCardId);
    };
    socket.on('result', onResult);
    socket.on('fibbage:sync', onSync);
    return () => {
      socket.off('result', onResult);
      socket.off('fibbage:sync', onSync);
    };
  }, []);

  const timeUp = state?.timeUp;
  const phase = state?.phase;

  // answer draft heartbeat — keeps in-progress text if the round advances before submit
  useEffect(() => {
    if (phase !== 'answer' || submitted || lockedOut || spectator) return;
    const id = setInterval(
      () => socket.emit('fibbage:draft', { promptIndex, text: textRef.current }),
      2000
    );
    return () => clearInterval(id);
  }, [phase, submitted, lockedOut, spectator, promptIndex]);

  // time's up: freeze input (send a final draft for answer phase)
  useEffect(() => {
    if (!timeUp || lockedOut || spectator) return;
    if (phase === 'answer' && !submitted) {
      socket.emit('fibbage:draft', { promptIndex, text: textRef.current });
      setLockedOut(true);
    } else if (phase === 'vote' && !voted) {
      setLockedOut(true);
    }
  }, [timeUp]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) return <div className="screen center">{t('common.connecting')}</div>;
  const { cards = [], suggestions = [], suggestionsFR = [], prompt, rankings } = state;

  if (spectator) {
    return (
      <div className="screen player center">
        <h2>{t('gartic.spectating')}</h2>
        <p className="hint">{t('gartic.spectatingHint')}</p>
      </div>
    );
  }

  if (phase === 'lobby') {
    return (
      <div className="screen player center">
        <h2>{t('gartic.youreIn')}</h2>
        <p className="hint">{t('fibbage.waitStart')}</p>
      </div>
    );
  }

  if (phase === 'podium') {
    const mine = (rankings || []).find((p) => p.id === me);
    const tied = mine && rankings.filter((p) => p.rank === mine.rank).length > 1;
    return (
      <div className="screen player center">
        <h1>{t('player.gameOver')}</h1>
        {mine && <h2>{tied ? t('player.tiedFor', { rank: mine.rank }) : t('player.youFinished', { rank: mine.rank })}</h2>}
        {mine && <p className="score-line">{t('player.finalScore')} <b>{mine.score}</b></p>}
      </div>
    );
  }

  // ---- answer phase ----
  function submitLie() {
    const clean = text.trim();
    if (!clean) return;
    socket.emit('fibbage:submit', { promptIndex, text: clean }, (res) => {
      if (res?.ok) {
        setMyLie(clean);
        setSubmitted(true);
        setTruthWarn(false);
      } else if (res?.reason === 'truth') {
        setTruthWarn(true); // "that's the real answer — pick something else!"
      }
    });
  }
  function getSuggestion() {
    // localized pool: FR list when the player's UI is French (fall back to EN)
    const list = suggestionsFR.length === suggestions.length && suggestionsFR.length ? pick(suggestions, suggestionsFR) : suggestions;
    if (suggestionUsed || list.length === 0) return;
    setText(list[Math.floor(Math.random() * list.length)]);
    setSuggestionUsed(true);
  }

  if (phase === 'answer') {
    return (
      <div className="screen player fibbage-play">
        <TimerBar remaining={state.timeRemaining} limit={state.timeLimit} />
        {submitted ? (
          <div className="center grow">
            <h2>{t('fibbage.lieLocked')}</h2>
            <p className="hint">{t('gartic.waitOthers')}</p>
          </div>
        ) : lockedOut ? (
          <div className="center grow">
            <h2>{t('player.timesUp')}</h2>
            <p className="hint">{t('player.waitReveal')}</p>
          </div>
        ) : (
          <div className="g-task">
            <FibbagePrompt prompt={prompt} />
            <h3 className="fb-instruct">{t('fibbage.writeLie')}</h3>
            {truthWarn && <p className="fb-truth-warn">{t('fibbage.thatsTheTruth')}</p>}
            <input
              value={text}
              maxLength={120}
              autoFocus
              placeholder={t('fibbage.liePlaceholder')}
              onChange={(e) => { setText(e.target.value); setTruthWarn(false); }}
              onKeyDown={(e) => e.key === 'Enter' && submitLie()}
            />
            <button className="ghost" disabled={suggestionUsed || suggestions.length === 0} onClick={getSuggestion}>
              {t('fibbage.getSuggestion')}
            </button>
            <button className="primary big" disabled={!text.trim()} onClick={submitLie}>
              {t('common.submit')}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ---- vote phase ----
  if (phase === 'vote') {
    const myCardId = cards.find((c) => norm(c.text) === norm(myLie))?.id ?? null;
    function lockVote() {
      if (selectedCard == null) return;
      socket.emit('fibbage:vote', { promptIndex, cardId: selectedCard, thumbId: thumbCard });
      setVoted(true);
    }
    return (
      <div className="screen player fibbage-play">
        <TimerBar remaining={state.timeRemaining} limit={state.timeLimit} />
        {voted ? (
          <div className="center grow">
            <h2>{t('fibbage.voteLocked')}</h2>
            <p className="hint">{t('gartic.waitOthers')}</p>
          </div>
        ) : lockedOut ? (
          <div className="center grow">
            <h2>{t('player.timesUp')}</h2>
            <p className="hint">{t('player.waitReveal')}</p>
          </div>
        ) : (
          <div className="g-task">
            <FibbagePrompt prompt={prompt} />
            <h3 className="fb-instruct">{t('fibbage.pickTrue')}</h3>
            <div className="fb-cards">
              {cards.map((c) => {
                const own = c.id === myCardId;
                return (
                  <div key={c.id} className={`fb-card-row ${selectedCard === c.id ? 'sel' : ''} ${own ? 'own' : ''}`}>
                    <button
                      className="fb-card-pick"
                      disabled={own}
                      onClick={() => setSelectedCard(c.id)}
                    >
                      {pick(c.text, c.textFR)}
                      {own && <span className="fb-by">{t('fibbage.yourLie')}</span>}
                    </button>
                    <button
                      className={`fb-thumb ${thumbCard === c.id ? 'on' : ''}`}
                      disabled={own}
                      onClick={() => setThumbCard(thumbCard === c.id ? null : c.id)}
                      title={t('fibbage.thumbHint')}
                    >
                      👍
                    </button>
                  </div>
                );
              })}
            </div>
            <button className="primary big" disabled={selectedCard == null} onClick={lockVote}>
              {t('fibbage.lockIn')}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ---- reveal phase ----
  if (phase === 'reveal') {
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
            {result.guessedRight && <li>{t('fibbage.bdGuessed')}</li>}
            {result.votesOnYou > 0 && <li>{t('fibbage.bdFooled', { n: result.votesOnYou })}</li>}
            {result.thumbBonus && <li>{t('fibbage.bdThumbs')}</li>}
          </ul>
        )}
        {result && <p className="score-line">{t('player.yourScore')} <b>{result.newScore}</b></p>}
        <p className="hint">{t('common.waitingHost')}</p>
      </div>
    );
  }

  return null;
}
