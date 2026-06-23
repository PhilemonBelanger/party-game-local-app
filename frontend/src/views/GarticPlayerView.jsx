import { useEffect, useRef, useState } from 'react';
import { socket } from '../socket';
import DrawCanvas from '../components/DrawCanvas.jsx';
import TimerBar from '../components/TimerBar.jsx';
import GarticReveal from '../components/GarticReveal.jsx';
import { useT } from '../i18n.jsx';

export default function GarticPlayerView({ state }) {
  const t = useT();
  const [task, setTask] = useState(null); // { round, type, prev, timeLimit }
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [lockedOut, setLockedOut] = useState(false); // timer hit 0 — input frozen
  const canvasRef = useRef(null);
  const textRef = useRef('');
  textRef.current = text;

  const curContent = () => (task?.type === 'draw' ? canvasRef.current?.getDataURL() ?? null : textRef.current);
  const curFrames = () => (task?.type === 'draw' ? canvasRef.current?.getFrames?.() ?? null : null);

  useEffect(() => {
    const onTask = (t) => {
      setTask(t);
      setText('');
      setSubmitted(!!t.done); // reconnect after submitting → resume locked
      setLockedOut(false);
    };
    socket.on('gartic:task', onTask);
    return () => socket.off('gartic:task', onTask);
  }, []);

  // Heartbeat: every 2s send the current canvas/text as a draft. The server uses the
  // latest draft if the round advances before a formal submit, so in-progress work is
  // never lost — no submit race. Stops once submitted or locked out (canvas unmounts).
  useEffect(() => {
    if (!task || submitted || lockedOut || task.type === 'spectator') return;
    // heartbeat carries only the image (frames are heavy — sent on submit / timeout)
    const id = setInterval(() => socket.emit('gartic:draft', { round: task.round, content: curContent() }), 2000);
    return () => clearInterval(id);
  }, [task, submitted, lockedOut]); // eslint-disable-line react-hooks/exhaustive-deps

  const timeUp = state?.timeUp;
  // When time runs out: capture a final draft WHILE the canvas is still mounted, then lock.
  useEffect(() => {
    if (state?.phase !== 'round' || !timeUp || submitted || lockedOut || !task || task.type === 'spectator') return;
    socket.emit('gartic:draft', { round: task.round, content: curContent(), frames: curFrames() });
    setLockedOut(true);
  }, [timeUp]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) return <div className="screen center">{t('common.connecting')}</div>;
  const { phase, timeRemaining, timeLimit, reveal } = state;

  if (phase === 'lobby') {
    return (
      <div className="screen player center">
        <h2>{t('gartic.youreIn')}</h2>
        <p className="hint">{t('gartic.waitStart')}</p>
      </div>
    );
  }

  if (phase === 'reveal') {
    return (
      <div className="screen player center">
        <GarticReveal reveal={reveal} />
        <p className="hint">{t('gartic.followHost')}</p>
      </div>
    );
  }

  // round phase
  if (!task) {
    return (
      <div className="screen player center">
        <p className="hint">{t('gartic.gettingTask')}</p>
      </div>
    );
  }

  if (task.type === 'spectator') {
    return (
      <div className="screen player center">
        <h2>{t('gartic.spectating')}</h2>
        <p className="hint">{t('gartic.spectatingHint')}</p>
      </div>
    );
  }

  function submitText() {
    if (text.trim() === '') return;
    socket.emit('gartic:submit', { round: task.round, content: text.trim() });
    setSubmitted(true);
  }
  function submitDrawing() {
    socket.emit('gartic:submit', { round: task.round, content: canvasRef.current?.getDataURL() || null, frames: curFrames() });
    setSubmitted(true);
  }

  return (
    <div className="screen player gartic-play">
      <TimerBar remaining={timeRemaining} limit={timeLimit} />

      {submitted ? (
        <div className="center grow">
          <h2>{t('gartic.lockedIn')}</h2>
          <p className="hint">{t('gartic.waitOthers')}</p>
        </div>
      ) : lockedOut ? (
        <div className="center grow">
          <h2>{t('player.timesUp')}</h2>
          <p className="hint">{t('player.waitReveal')}</p>
        </div>
      ) : task.type === 'prompt' ? (
        <div className="g-task">
          <h2>{t('gartic.writeFun')}</h2>
          <input
            value={text}
            maxLength={120}
            autoFocus
            placeholder={t('gartic.promptPlaceholder')}
            onChange={(e) => setText(e.target.value)}
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
            onChange={(e) => setText(e.target.value)}
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
