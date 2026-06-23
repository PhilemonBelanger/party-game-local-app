import { useEffect, useRef } from 'react';

// Full-screen celebratory fireworks burst (~3s). Self-contained canvas animation.
export default function Fireworks() {
  const ref = useRef(null);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv.getContext('2d');
    const W = (cv.width = window.innerWidth);
    const H = (cv.height = window.innerHeight);
    let parts = [];
    let raf;
    let t0 = null;
    let lastSpawn = -1000;
    let lastT = null;

    function burst(x, y) {
      const n = 44;
      const hue = Math.floor(Math.random() * 360);
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n;
        const sp = 2 + Math.random() * 4.5;
        parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, hue: hue + Math.random() * 30 });
      }
    }

    function frame(t) {
      if (t0 === null) t0 = t;
      if (lastT === null) lastT = t;
      lastT = t;
      const elapsed = t - t0;
      ctx.clearRect(0, 0, W, H);
      if (elapsed < 2600 && t - lastSpawn > 320) {
        lastSpawn = t;
        burst(W * (0.15 + Math.random() * 0.7), H * (0.15 + Math.random() * 0.45));
      }
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // gravity
        p.vx *= 0.99;
        p.life -= 0.012;
      }
      parts = parts.filter((p) => p.life > 0);
      for (const p of parts) {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = `hsl(${p.hue}, 100%, 62%)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (elapsed < 4500 || parts.length) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} className="fireworks" />;
}
