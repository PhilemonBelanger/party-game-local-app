import { useEffect, useState } from 'react';
import { socket } from '../socket';
import TimerBar from '../components/TimerBar.jsx';
import { useT } from '../i18n.jsx';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export default function PlayerView({ state, me }) {
  const t = useT();
  const [result, setResult] = useState(null); // {correct, gained, ...}
  const [guess, setGuess] = useState(''); // numeric-question entry

  useEffect(() => {
    socket.on('result', setResult);
    return () => socket.off('result', setResult);
  }, []);

  // clear last result + entry when a new question starts
  useEffect(() => {
    if (state?.phase === 'question') {
      setResult(null);
      setGuess('');
    }
  }, [state?.questionIndex, state?.phase]);

  if (!state) return <div className="screen center">{t('common.connecting')}</div>;

  const { phase, question, section, correctIndex, correctAnswer, questionNumber, totalQuestions, timeRemaining, timeLimit, timeUp, players, rankings } = state;
  const myPlayer = players.find((p) => p.id === me);
  const myScore = myPlayer?.score ?? 0;

  if (phase === 'lobby') {
    return (
      <div className="screen player center">
        <h2>{t('player.youreIn', { name: myPlayer ? myPlayer.name : '' })}</h2>
        <p className="hint">{t('player.waitStart')}</p>
      </div>
    );
  }

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
          <div className="center grow">
            <h2>{t('player.answerLocked')}</h2>
            <p className="hint">{t('player.waitReveal')}</p>
          </div>
        ) : timeUp ? (
          <div className="center grow">
            <h2>{t('player.timesUp')}</h2>
            <p className="hint">{t('player.waitRevealAnswer')}</p>
          </div>
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

  if (phase === 'podium') {
    const mine = rankings.find((p) => p.id === me);
    const tied = mine && rankings.filter((p) => p.rank === mine.rank).length > 1;
    return (
      <div className="screen player center">
        <h1>{t('player.gameOver')}</h1>
        {mine && <h2>{tied ? t('player.tiedFor', { rank: mine.rank }) : t('player.youFinished', { rank: mine.rank })}</h2>}
        <p className="score-line">{t('player.finalScore')} <b>{myScore}</b></p>
      </div>
    );
  }

  return null;
}
