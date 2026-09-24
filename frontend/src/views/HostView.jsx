import { useRef, useState } from 'react';
import { socket } from '../socket';
import Timer from '../components/Timer.jsx';
import { Ask, Buddy } from '../components/Sky.jsx';
import QrJoin from '../components/QrJoin.jsx';
import PlayerPanel from '../components/PlayerPanel.jsx';
import { HostLobby, HostPodium } from '../components/Screens.jsx';
import { useT } from '../i18n.jsx';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export default function HostView({ state }) {
  const t = useT();
  const fileRef = useRef(null);
  const [loadMsg, setLoadMsg] = useState(null); // { ok, text }

  function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-uploading the same filename
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try {
        data = JSON.parse(reader.result);
      } catch {
        setLoadMsg({ ok: false, text: t('host.notValidJson') });
        return;
      }
      socket.emit('host:loadquiz', data, (res) => {
        if (res?.ok) setLoadMsg({ ok: true, text: t('host.loaded', { title: res.title, count: res.count }) });
        else setLoadMsg({ ok: false, text: res?.error || t('host.invalidQuiz') });
      });
    };
    reader.readAsText(file);
  }

  if (!state) return <div className="screen center">{t('common.connecting')}</div>;

  const {
    phase,
    title,
    players,
    questionIndex,
    questionNumber,
    totalQuestions,
    question,
    section,
    lastItem,
    correctIndex,
    correctAnswer,
    timeRemaining,
    timeUp,
    rankings,
    canAdvance,
  } = state;

  if (phase === 'lobby') {
    return (
      <HostLobby logo={title} players={players} canStart={players.length > 0 && totalQuestions > 0}>
        <div className="quizload">
          <span className="quizload-info">
            {t('host.quizLabel')} <b>{title}</b> · {t('host.questionCount', { n: totalQuestions })}
          </span>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
          <button className="ghost" onClick={() => fileRef.current?.click()}>
            {t('host.loadQuiz')}
          </button>
          {loadMsg && <span className={`loadmsg ${loadMsg.ok ? 'ok' : 'err'}`}>{loadMsg.text}</span>}
        </div>
      </HostLobby>
    );
  }

  if (phase === 'section') {
    return (
      <div className="screen host game section-screen">
        <div className="section-body">
          <span className="section-kicker">{t('common.section')}</span>
          {section.title && <h1 className="section-title">{section.title}</h1>}
          {section.image && (
            <div className="qmedia">
              <img className="question-img" src={section.image} alt="" />
            </div>
          )}
          {section.description && <p className="section-desc">{section.description}</p>}
        </div>
        <button className="primary big" onClick={() => socket.emit('host:next')}>
          {lastItem ? t('common.showPodium') : t('common.continue')}
        </button>
        <PlayerPanel players={players} />
        <div className="qr-corner"><QrJoin size={110} /></div>
      </div>
    );
  }

  if (phase === 'question' || phase === 'reveal') {
    const connected = players.filter((p) => p.connected);
    const answeredCount = connected.filter((p) => p.answered).length;
    const everyoneAnswered = connected.length > 0 && answeredCount === connected.length;
    const canReveal = !!canAdvance; // server-computed: everyone connected answered, or time's up
    return (
      <div className="screen host game">
        {phase === 'question' && <Timer remaining={timeRemaining} limit={state.timeLimit} size={180} className="rail" />}

        <Ask kicker={t('host.questionXofY', { n: questionNumber, total: totalQuestions })}>
          {question.text && <h1 className="question">{question.text}</h1>}
        </Ask>
        {question.image && (
          <div className="qmedia">
            <img className="question-img" src={question.image} alt="" />
          </div>
        )}

        {question.type === 'number' ? (
          <NumberPanel phase={phase} players={players} correctAnswer={correctAnswer} />
        ) : (
          <div className={`choices host-choices ${question.choices.length > 4 ? 'many' : ''}`}>
            {question.choices.map((c, i) => {
              const correct = phase === 'reveal' && i === correctIndex;
              // players who picked this choice (only available during reveal); no chip for timeouts
              const pickers = phase === 'reveal' ? players.filter((p) => p.choice === i) : [];
              return (
                <div key={i} className={`choice ${correct ? 'correct' : ''} ${phase === 'reveal' && !correct ? 'dim' : ''}`}>
                  <span className="letter">{LETTERS[i]}</span>
                  <div className="choice-body">
                    {c.image && <img className="choice-img" src={c.image} alt="" />}
                    {c.text && <span className="choice-text">{c.text}</span>}
                  </div>
                  {pickers.length > 0 && (
                    <span className="chips">
                      {pickers.map((p) => (
                        <span key={p.id} className="chip"><Buddy player={p} size={28} />{p.name}</span>
                      ))}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {phase === 'question' && (
          <div className="reveal-bar">
            <button
              className="primary big"
              disabled={!canReveal}
              onClick={() => socket.emit('host:reveal')}
            >
              {canReveal
                ? `${t('host.revealAnswer')}${timeUp && !everyoneAnswered ? t('host.timeUpSuffix') : ''}`
                : t('host.waitingAnswered', { a: answeredCount, c: connected.length })}
            </button>
          </div>
        )}

        {phase === 'reveal' && (
          <div className="reveal-bar">
            <button className="primary big" onClick={() => socket.emit('host:next')}>
              {lastItem ? t('common.showPodium') : t('common.next')}
            </button>
          </div>
        )}

        <PlayerPanel players={players} showAnswered />
        <div className="qr-corner"><QrJoin size={110} /></div>
      </div>
    );
  }

  if (phase === 'podium') return <HostPodium rankings={rankings} players={players} />;

  return null;
}

function NumberPanel({ phase, players, correctAnswer }) {
  const t = useT();
  if (phase === 'question') {
    return <div className="number-prompt">{t('host.numberPrompt')}</div>;
  }
  const guesses = players
    .filter((p) => typeof p.choice === 'number')
    .map((p) => ({ id: p.id, name: p.name, val: p.choice, dist: Math.abs(p.choice - correctAnswer) }))
    .sort((a, b) => a.dist - b.dist);
  const min = guesses.length ? guesses[0].dist : null;
  return (
    <div className="number-reveal">
      <div className="answer-big">{t('host.answer', { n: correctAnswer })}</div>
      <ul className="guesslist">
        {guesses.length === 0 && <li className="off">{t('host.noAnswers')}</li>}
        {guesses.map((g) => (
          <li key={g.id} className={g.dist === min ? 'win' : ''}>
            <span className="g-name">{g.name}</span>
            <b className="g-val">{g.val}</b>
            <span className="g-off">{g.dist === 0 ? t('host.exact') : t('host.off', { d: g.dist })}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

