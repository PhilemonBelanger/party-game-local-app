// DEV ONLY — screen gallery: the real views rendered with fixture states, no backend needed.
// Open http://localhost:5173/?dev=gallery (all screens) or ?dev=gallery&solo=<key> (one).
// Each screen renders in its own iframe at true device size (1280×720 TV, 390×800 phone), so
// vh units and position:fixed behave as on a real screen. Headless-screenshot it to check UI:
//   chrome --headless=new --window-size=1400,4000 --screenshot=out.png "http://localhost:5173/?dev=gallery"
import { useLayoutEffect, useRef, useState } from 'react';
import { SCREENS } from './fixtures.js';
import { Clouds } from '../components/Sky.jsx';
import Home from '../views/Home.jsx';
import HostView from '../views/HostView.jsx';
import PlayerView from '../views/PlayerView.jsx';
import GarticHostView from '../views/GarticHostView.jsx';
import GarticPlayerView from '../views/GarticPlayerView.jsx';
import FibbageHostView from '../views/FibbageHostView.jsx';
import FibbagePlayerView from '../views/FibbagePlayerView.jsx';

const VIEWS = {
  trivia: { host: HostView, player: PlayerView },
  gartic: { host: GarticHostView, player: GarticPlayerView },
  fibbage: { host: FibbageHostView, player: FibbagePlayerView },
};
const SIZE = { tv: [1280, 720], phone: [390, 800] };
const noop = () => {};

function Solo({ screen }) {
  let view;
  if (!screen.role) view = <Home onPickHost={noop} onPickGartic={noop} onPickFibbage={noop} onJoin={noop} onCreate={noop} />;
  else {
    const View = VIEWS[screen.state.mode][screen.role];
    view = <View state={screen.state} me={screen.me} />;
  }
  return (
    <>
      <Clouds />
      {view}
    </>
  );
}

function Frame({ screen }) {
  const [w, h] = SIZE[screen.device];
  const max = screen.device === 'tv' ? 620 : 300;
  const ref = useRef(null);
  const [scale, setScale] = useState(max / w);
  useLayoutEffect(() => {
    const el = ref.current;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / w));
    ro.observe(el);
    return () => ro.disconnect();
  }, [w]);
  return (
    <figure style={{ margin: 0, width: '100%', maxWidth: max }}>
      <figcaption style={{ font: '700 12px/1 system-ui', letterSpacing: '.06em', textTransform: 'uppercase', color: '#9aa', marginBottom: 8 }}>
        {screen.label} <span style={{ opacity: 0.6 }}>· {screen.key}</span>
      </figcaption>
      <div ref={ref} style={{ width: '100%', aspectRatio: `${w} / ${h}`, position: 'relative', overflow: 'hidden', borderRadius: screen.device === 'tv' ? 8 : 30, boxShadow: '0 0 0 5px #222, 0 0 0 6px #444' }}>
        <iframe
          title={screen.key}
          src={`?dev=gallery&solo=${screen.key}`}
          style={{ width: w, height: h, border: 0, transform: `scale(${scale})`, transformOrigin: '0 0', position: 'absolute', inset: 0 }}
        />
      </div>
    </figure>
  );
}

export default function Gallery() {
  const solo = new URLSearchParams(location.search).get('solo');
  if (solo) {
    const screen = SCREENS.find((s) => s.key === solo);
    return screen ? <Solo screen={screen} /> : <p>Unknown screen: {solo}</p>;
  }
  const tv = SCREENS.filter((s) => s.device === 'tv');
  const phone = SCREENS.filter((s) => s.device === 'phone');
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'auto', background: '#161616', color: '#eee', padding: 28, font: '14px system-ui' }}>
      <h1 style={{ fontSize: 20, marginBottom: 20, fontFamily: 'system-ui' }}>Screen gallery (dev) — real views, fixture states</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 620px))', gap: 30, marginBottom: 40 }}>
        {tv.map((s) => <Frame key={s.key} screen={s} />)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 30 }}>
        {phone.map((s) => <Frame key={s.key} screen={s} />)}
      </div>
    </div>
  );
}
