import { useEffect, useRef, useState } from 'react';
import { socket } from '../socket';
import DrawCanvas from '../components/DrawCanvas.jsx';
import Timer from '../components/Timer.jsx';
import GarticReveal from '../components/GarticReveal.jsx';
import { Notice, Spectating } from '../components/Screens.jsx';
import { useKeyedState, usePhaseInput } from '../hooks.js';
import { useT } from '../i18n.jsx';

export default function GarticPlayerView({ state }) {
  const t = useT();
  const [task, setTask] = useState(null); // { gameId, step, round, type, prev, timeLimit, done } | { type:'spectator', gameId }
  const step = task?.step ?? null;
  const [text, setText] = useKeyedState(step, '');
  const canvasRef = useRef(null);
  const textRef = useRef('');
  textRef.current = text;

  const isDraw = task?.type === 'draw';
  const payload = (withFrames) => ({
    gameId: task?.gameId,
    round: task?.round,
    content: isDraw ? canvasRef.current?.getDataURL() ?? null : textRef.current,
    // frames are heavy — only on submit / the final time-up draft, not every heartbeat
    ...(isDraw && withFrames ? { frames: canvasRef.current?.getFrames?.() ?? null } : {}),
  });

  const spectatingThisGame = task?.type === 'spectator' && task.gameId === state?.gameId;
  const input = usePhaseInput({
    step,
    active: state?.phase === 'round' && !!task && task.type !== 'spectator' && task.step === state?.step,
    timeUp: state?.timeUp,
    draft: (final) => socket.emit('gartic:draft', payload(final)),
  });

  const markSubmitted = input.markSubmitted;
  useEffect(() => {
    const onTask = (tk) => {
      setTask(tk);
      if (tk.done) markSubmitted(tk.step); // reconnect after submitting → resume locked
    };
    socket.on('gartic:task', onTask);
    return () => socket.off('gartic:task', onTask);
  }, [markSubmitted]);

  if (!state) return <div className="screen center">{t('common.connecting')}</div>;
  const { phase, timeRemaining, timeLimit, reveal } = state;

  if (phase === 'lobby') return <Notice title={t('gartic.youreIn')} hint={t('gartic.waitStart')} />;

  if (phase === 'reveal') {
    return (
      <div className="screen player center">
        <GarticReveal reveal={reveal} />
        <p className="hint">{t('gartic.followHost')}</p>
      </div>
    );
  }

  // round phase
  if (spectatingThisGame) return <Spectating />;
  if (!task || task.step !== state.step) return <Notice hint={t('gartic.gettingTask')} />;

  function submitText() {
    if (text.trim() === '') return;
    socket.emit('gartic:submit', { ...payload(false), content: text.trim() });
    markSubmitted(step);
  }
  function submitDrawing() {
    socket.emit('gartic:submit', payload(true));
    markSubmitted(step);
  }
  // draft every keystroke (like fibbage) so text isn't lost if the host advances at 0
  function onText(e) {
    setText(e.target.value);
    socket.emit('gartic:draft', { gameId: task.gameId, round: task.round, content: e.target.value });
  }

  return (
    <div className="screen player gartic-play">
      <div className="timer-row"><Timer remaining={timeRemaining} limit={timeLimit} size={64} /></div>

      {input.submitted ? (
        <Notice grow title={t('gartic.lockedIn')} hint={t('gartic.waitOthers')} />
      ) : input.lockedOut ? (
        <Notice grow title={t('player.timesUp')} hint={t('player.waitReveal')} />
      ) : task.type === 'prompt' ? (
        <div className="g-task">
          <h2>{t('gartic.writeFun')}</h2>
          <input
            value={text}
            maxLength={120}
            autoFocus
            placeholder={t('gartic.promptPlaceholder')}
            onChange={onText}
            onKeyDown={(e) => e.key === 'Enter' && submitText()}
          />
          <button className="primary big" disabled={!text.trim()} onClick={submitText}>
            {t('common.submit')}
          </button>
        </div>
      ) : task.type === 'draw' ? (
        <div className="g-task">
          <h3 className="g-prompt">{t('gartic.drawLabel', { prev: '' })}<b>{task.prev || t('gartic.nothing')}</b></h3>
          <DrawCanvas ref={canvasRef} />
          <button className="primary big" onClick={submitDrawing}>{t('gartic.submitDrawing')}</button>
        </div>
      ) : (
        <div className="g-task">
          <h3>{t('gartic.whatIsThis')}</h3>
          {task.prev && <img className="g-drawing" src={task.prev} alt="" />}
          <input
            value={text}
            maxLength={120}
            autoFocus
            placeholder={t('gartic.yourGuess')}
            onChange={onText}
            onKeyDown={(e) => e.key === 'Enter' && submitText()}
          />
          <button className="primary big" disabled={!text.trim()} onClick={submitText}>
            {t('gartic.submitGuess')}
          </button>
        </div>
      )}
    </div>
  );
}
