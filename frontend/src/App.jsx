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

// state.mode → the host (TV) and player (phone) screen for that mode
const VIEWS = {
  trivia: { host: HostView, player: PlayerView },
  gartic: { host: GarticHostView, player: GarticPlayerView },
  fibbage: { host: FibbageHostView, player: FibbagePlayerView },
};

export default function App() {
  const [role, setRole] = useState(null); // null | 'host' | 'player'
  const [state, setState] = useState(null);
  const [me, setMe] = useState(null); // my player id
  const nameRef = useRef(null); // remembered name for auto-rejoin
  const roleRef = useRef(null);

  // Trap the Android back gesture / button so an accidental edge-swipe (common when drawing
  // from the left edge of the canvas) can't navigate away and close a QR-opened tab.
  // Seed a history entry, then re-seed every time a back navigation pops it.
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const onPop = () => window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const onState = (s) => setState(s);
    // per-second timer update only patches timeRemaining (full state carries images)
    const onTick = (t) => setState((prev) => (prev ? { ...prev, timeRemaining: t } : prev));
    // on (re)connect, re-announce ourselves so a dropped socket resumes the same player
    const onConnect = () => {
      if (roleRef.current === 'host') socket.emit('host:join');
      else if (nameRef.current) socket.emit('player:join', nameRef.current, ({ id }) => setMe(id));
    };
    // the same name joined from another device → this one lost the slot; back to Home
    const onReplaced = () => {
      nameRef.current = null;
      roleRef.current = null;
      setMe(null);
      setRole(null);
    };
    socket.on('state', onState);
    socket.on('tick', onTick);
    socket.on('connect', onConnect);
    socket.on('player:replaced', onReplaced);
    return () => {
      socket.off('state', onState);
      socket.off('tick', onTick);
      socket.off('connect', onConnect);
      socket.off('player:replaced', onReplaced);
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
  const View = (VIEWS[state?.mode] || VIEWS.trivia)[role];
  return <View state={state} me={me} />;
}
