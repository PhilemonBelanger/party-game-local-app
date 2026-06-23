import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useT } from '../i18n.jsx';

const COLORS = ['#1a1a1a', '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#ffffff'];
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
  function down(e) {
    e.preventDefault();
    drawing.current = true;
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
        <input type="range" min="2" max="26" value={size} onChange={(e) => setSize(+e.target.value)} />
        <button className="tool" title={t('draw.clear')} onClick={clearAll}>
          🗑
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
