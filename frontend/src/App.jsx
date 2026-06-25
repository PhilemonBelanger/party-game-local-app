import { useEffect, useRef, useState } from 'react';
import { socket } from './socket';
import Home from './views/Home.jsx';
import HostView from './views/HostView.jsx';
import PlayerView from './views/PlayerView.jsx';
import CreatorView from './views/CreatorView.jsx';
import GarticHostView from './views/GarticHostView.jsx';
import GarticPlayerView from './views/GarticPlayerView.jsx';
import FibbageHostView from './views/FibbageHostView.jsx';
import FibbagePlayerView from './views/FibbagePlayerView.jsx';

export default function App() {
  const [role, setRole] = useState(null); // null | 'host' | 'player'
  const [state, setState] = useState(null);
  const [me, setMe] = useState(null); // my player id
  const nameRef = useRef(null); // remembered name for auto-rejoin
  const roleRef = useRef(null);

  useEffect(() => {
    const onState = (s) => setState(s);
    // per-second timer update only patches timeRemaining (full state carries images)
    const onTick = (t) => setState((prev) => (prev ? { ...prev, timeRemaining: t } : prev));
    // on (re)connect, re-announce ourselves so a dropped socket resumes the same player
    const onConnect = () => {
      if (roleRef.current === 'host') socket.emit('host:join');
      else if (nameRef.current) socket.emit('player:join', nameRef.current, ({ id }) => setMe(id));
    };
    socket.on('state', onState);
    socket.on('tick', onTick);
    socket.on('connect', onConnect);
    return () => {
      socket.off('state', onState);
      socket.off('tick', onTick);
      socket.off('connect', onConnect);
    };
  }, []);

  function pickHost(mode = 'trivia') {
    roleRef.current = 'host';
    socket.emit('host:join');
    socket.emit('host:setmode', mode);
    setRole('host');
  }

  function join(name) {
    nameRef.current = name;
    roleRef.current = 'player';
    socket.emit('player:join', name, ({ id }) => setMe(id));
    setRole('player');
  }

  const gartic = state?.mode === 'gartic';
  const fibbage = state?.mode === 'fibbage';

  if (!role) {
    return (
      <Home
        onPickHost={() => pickHost('trivia')}
        onPickGartic={() => pickHost('gartic')}
        onPickFibbage={() => pickHost('fibbage')}
        onJoin={join}
        onCreate={() => setRole('creator')}
      />
    );
  }
  if (role === 'creator') return <CreatorView onBack={() => setRole(null)} />;
  if (role === 'host') return gartic ? <GarticHostView state={state} /> : fibbage ? <FibbageHostView state={state} /> : <HostView state={state} />;
  return gartic ? <GarticPlayerView state={state} /> : fibbage ? <FibbagePlayerView state={state} me={me} /> : <PlayerView state={state} me={me} />;
}
