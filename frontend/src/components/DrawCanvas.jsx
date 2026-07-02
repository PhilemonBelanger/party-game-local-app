import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useT } from '../i18n.jsx';

const COLORS = [
  '#1a1a1a', '#6b6b6b', '#1d54c4',
  '#ffffff', '#b3b3b3', '#35bdf0',
  '#157a3a', '#8a0d0d', '#8a4a22',
  '#22bf4d', '#ff1f1f', '#f0822a',
  '#b07d22', '#9c0f5c', '#cc6f6f',
  '#ffc233', '#ff1f9c', '#f3a9b3',
];
const W = 900;
const H = 640;

// Drawing surface with pen / eraser / color / size.
// Records the drawing PROCESS as periodic downscaled snapshots (getFrames) — this uses
// toDataURL, the one capture path that works reliably across devices. Final image via getDataURL.
const DrawCanvas = forwardRef(function DrawCanvas(_props, ref) {
  const t = useT();
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const frames = useRef([]); // array of snapshot dataURLs (the flipbook)
  const dirty = useRef(false); // canvas changed since last snapshot?
  const undoStack = useRef([]); // ImageData snapshots, one per stroke/clear (for undo)
  const [canUndo, setCanUndo] = useState(false);
  const [color, setColor] = useState('#1a1a1a');
  const [customColor, setCustomColor] = useState('#ff5da2');
  const [size, setSize] = useState(6);
  const [eraser, setEraser] = useState(false);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
  }, []);

  // full-resolution PNG snapshot (crisp — same as the final image, no downscale/jpeg blur)
  function snapshot() {
    return canvasRef.current.toDataURL('image/png');
  }

  // periodically capture a frame when the canvas has changed
  useEffect(() => {
    const id = setInterval(() => {
      if (dirty.current) {
        frames.current.push(snapshot());
        dirty.current = false;
      }
    }, 900);
    return () => clearInterval(id);
  }, []);

  useImperativeHandle(ref, () => ({
    getDataURL: () => canvasRef.current.toDataURL('image/png'),
    getFrames: () => {
      if (dirty.current) {
        frames.current.push(snapshot()); // capture the final state
        dirty.current = false;
      }
      return frames.current;
    },
  }));

  const ctx = () => canvasRef.current.getContext('2d');
  const lineW = () => (eraser ? size * 3 : size);
  const paint = () => (eraser ? '#ffffff' : color);

  function pos(e) {
    const r = canvasRef.current.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - r.left) * (W / r.width), y: (t.clientY - r.top) * (H / r.height) };
  }
  // save current canvas so the next stroke/clear can be undone (cap stack depth)
  function pushUndo() {
    const c = ctx();
    undoStack.current.push(c.getImageData(0, 0, W, H));
    if (undoStack.current.length > 40) undoStack.current.shift();
    setCanUndo(true);
  }
  function undo() {
    const snap = undoStack.current.pop();
    if (!snap) return;
    ctx().putImageData(snap, 0, 0);
    dirty.current = true;
    setCanUndo(undoStack.current.length > 0);
  }
  function down(e) {
    e.preventDefault();
    drawing.current = true;
    pushUndo();
    const p = pos(e);
    last.current = p;
    dirty.current = true;
    const c = ctx();
    c.fillStyle = paint();
    c.beginPath();
    c.arc(p.x, p.y, lineW() / 2, 0, Math.PI * 2);
    c.fill();
  }
  function move(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const p = pos(e);
    const c = ctx();
    c.strokeStyle = paint();
    c.lineWidth = lineW();
    c.beginPath();
    c.moveTo(last.current.x, last.current.y);
    c.lineTo(p.x, p.y);
    c.stroke();
    last.current = p;
    dirty.current = true;
  }
  function up() {
    drawing.current = false;
    last.current = null;
  }
  function clearAll() {
    pushUndo();
    const c = ctx();
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, W, H);
    dirty.current = true;
  }

  return (
    <div className="draw">
      <div className="draw-tools">
        {COLORS.map((col) => (
          <button
            key={col}
            className={`swatch ${!eraser && color === col ? 'sel' : ''}`}
            style={{ background: col }}
            onClick={() => {
              setColor(col);
              setEraser(false);
            }}
          />
        ))}
        {/* custom color — opens the browser's color picker (wheel / sliders) */}
        <label
          className={`swatch rainbow ${!eraser && color === customColor ? 'sel' : ''}`}
          title={t('draw.customColor')}
          style={!eraser && color === customColor ? { background: customColor } : undefined}
        >
          <input
            type="color"
            value={customColor}
            onChange={(e) => {
              setCustomColor(e.target.value);
              setColor(e.target.value);
              setEraser(false);
            }}
          />
        </label>
        <button className={`tool ${eraser ? 'sel' : ''}`} title={t('draw.eraser')} onClick={() => setEraser((e) => !e)}>
          🧽
        </button>
        <input
          type="range"
          min="2"
          max="44"
          value={size}
          style={{ '--pct': `${((size - 2) / (44 - 2)) * 100}%` }}
          onChange={(e) => setSize(+e.target.value)}
        />
        <button className="tool icon-white" title={t('draw.undo')} onClick={undo} disabled={!canUndo}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 14 4 9l5-5" />
            <path d="M4 9h11a6 6 0 0 1 0 12h-4" />
          </svg>
        </button>
        <button className="tool icon-white" title={t('draw.clear')} onClick={clearAll}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="draw-canvas"
        onMouseDown={down}
        onMouseMove={move}
        onMouseUp={up}
        onMouseLeave={up}
        onTouchStart={down}
        onTouchMove={move}
        onTouchEnd={up}
        onTouchCancel={up}
      />
    </div>
  );
});

export default DrawCanvas;
