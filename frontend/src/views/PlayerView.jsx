import { useEffect } from 'react';
import { socket } from '../socket';
import TimerBar from '../components/TimerBar.jsx';
import { Notice, PlayerFinal } from '../components/Screens.jsx';
import { useKeyedState } from '../hooks.js';
import { useT } from '../i18n.jsx';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export default function PlayerView({ state, me }) {
  const t = useT();
  // result + numeric entry belong to one question; they reset when the question changes
  const [q, setQ] = useKeyedState(`${state?.gameId}:${state?.questionIndex}`, { result: null, guess: '' });
  const { result, guess } = q;
  const setGuess = (v) => setQ({ guess: v });

  useEffect(() => {
    const onResult = (r) => setQ({ result: r });
    socket.on('result', onResult);
    return () => socket.off('result', onResult);
  }, [setQ]);

  if (!state) return <div className="screen center">{t('common.connecting')}</div>;

  const { phase, question, section, correctIndex, correctAnswer, questionNumber, totalQuestions, timeRemaining, timeLimit, timeUp, players, rankings } = state;
  const myPlayer = players.find((p) => p.id === me);
  const myScore = myPlayer?.score ?? 0;

  if (phase === 'lobby') return <Notice title={t('player.youreIn', { name: myPlayer ? myPlayer.name : '' })} hint={t('player.waitStart')} />;

  if (phase === 'section') {
    return (
      <div className="screen player center">
        <span className="section-kicker">{t('common.section')}</span>
        {section.title && <h1 className="section-title">{section.title}</h1>}
        {section.image && <img className="question-img" src={section.image} alt="" />}
        {section.description && <p className="section-desc">{section.description}</p>}
        <p className="hint">{t('player.getReady')}</p>
      </div>
    );
  }

  if (phase === 'question') {
    const answered = myPlayer?.answered;
    return (
      <div className="screen player">
        <header className="pheader">
          <span>{t('player.qShort', { n: questionNumber, total: totalQuestions })}</span>
          <span>⭐ {myScore}</span>
        </header>

        <TimerBar remaining={timeRemaining} limit={timeLimit} />

        {question.text && <h2 className="player-question">{question.text}</h2>}
        {question.image && <img className="question-img" src={question.image} alt="" />}

        {answered ? (
          <Notice grow title={t('player.answerLocked')} hint={t('player.waitReveal')} />
        ) : timeUp ? (
          <Notice grow title={t('player.timesUp')} hint={t('player.waitRevealAnswer')} />
        ) : question.type === 'number' ? (
          <form
            className="number-entry"
            onSubmit={(e) => {
              e.preventDefault();
              if (guess.trim() !== '') socket.emit('player:answer', Number(guess));
            }}
          >
            <p className="hint">{t('player.numberHint')}</p>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={guess}
              autoFocus
              placeholder={t('player.yourNumber')}
              onChange={(e) => setGuess(e.target.value)}
            />
            <button className="primary big" type="submit" disabled={guess.trim() === ''}>
              {t('common.submit')}
            </button>
          </form>
        ) : (
          <div className="choices">
            {question.choices.map((c, i) => (
              <button key={i} className="choice tap" onClick={() => socket.emit('player:answer', i)}>
                <span className="letter">{LETTERS[i]}</span>
                <div className="choice-body">
                  {c.image && <img className="choice-img" src={c.image} alt="" />}
                  {c.text && <span className="choice-text">{c.text}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (phase === 'reveal' && question.type === 'number') {
    return (
      <div className="screen player center">
        {result && (
          <div className={`verdict ${result.correct ? 'win' : 'lose'}`}>
            {result.correct ? t('player.closest', { gained: result.gained }) : t('player.notClosest')}
          </div>
        )}
        <h2>{t('player.answerIs')} <b>{correctAnswer}</b></h2>
        {result && result.yourAnswer != null && (
          <p className="score-line">
            {t('player.yourGuessLabel')} <b>{result.yourAnswer}</b> ({result.distance === 0 ? t('player.exact') : t('player.off', { d: result.distance })})
          </p>
        )}
        <p className="score-line">{t('player.yourScore')} <b>{myScore}</b></p>
        <p className="hint">{t('common.waitingHost')}</p>
      </div>
    );
  }

  if (phase === 'reveal') {
    return (
      <div className="screen player center">
        {result && (
          <div className={`verdict ${result.correct ? 'win' : 'lose'}`}>
            {result.correct ? t('player.correct', { gained: result.gained }) : t('player.wrong')}
          </div>
        )}
        <h2>{t('player.correctAnswer')}</h2>
        <div className="choice correct big-answer">
          <span className="letter">{LETTERS[correctIndex]}</span>
          <div className="choice-body">
            {question.choices[correctIndex].image && (
              <img className="choice-img" src={question.choices[correctIndex].image} alt="" />
            )}
            {question.choices[correctIndex].text && (
              <span className="choice-text">{question.choices[correctIndex].text}</span>
            )}
          </div>
        </div>
        <p className="score-line">{t('player.yourScore')} <b>{myScore}</b></p>
        <p className="hint">{t('common.waitingHost')}</p>
      </div>
    );
  }

  if (phase === 'podium') return <PlayerFinal rankings={rankings} me={me} />;

  return null;
}
