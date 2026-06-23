import { useEffect, useState } from 'react';
import { useT } from '../i18n.jsx';

// Flipbook replay of the recorded drawing snapshots (data URLs). Shows the final
// image when there's no recording. Data URIs are inline, so frame swaps are instant.
export default function DrawReplay({ frames, image }) {
  const t = useT();
  const list = Array.isArray(frames) ? frames : [];
  const has = list.length > 0;
  const [idx, setIdx] = useState(0);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (!has || list.length === 1) return undefined;
    setIdx(0);
    let i = 0;
    const per = Math.max(80, Math.min(450, Math.round(3500 / list.length))); // ~3.5s total
    const id = setInterval(() => {
      i += 1;
      if (i >= list.length) clearInterval(id);
      else setIdx(i);
    }, per);
    return () => clearInterval(id);
  }, [run, has, list.length]);

  if (!has) {
    return image ? <img className="replay-img" src={image} alt="" /> : <div className="g-reveal-text">{t('draw.noDrawing')}</div>;
  }

  return (
    <div className="replay">
      <img className="replay-img" src={list[Math.min(idx, list.length - 1)]} alt="" />
      <button className="ghost small" onClick={() => setRun((r) => r + 1)}>
        {t('draw.replay')}
      </button>
    </div>
  );
}
