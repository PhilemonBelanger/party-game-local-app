import { useEffect, useState } from 'react';
import Fireworks from './Fireworks.jsx';
import DrawReplay from './DrawReplay.jsx';
import { useT } from '../i18n.jsx';

// Normalize for matching: strip accents (é/è/ê -> e), lowercase, collapse whitespace.
const norm = (s) =>
  typeof s === 'string'
    ? s
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '') // drop combining diacritic marks
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
    : null;

// Renders one entry of a Gartic story chain (shared by host + player reveal screens).
export default function GarticReveal({ reveal }) {
  const t = useT();
  // manual celebration: each press bumps the counter → remounts Fireworks with a fresh key
  const [boom, setBoom] = useState(0);
  const book = reveal?.book;
  const entry = reveal?.entry;
  // reset manual fireworks when the revealed entry changes (so they don't re-fire on nav)
  useEffect(() => setBoom(0), [book, entry]);
  if (!reveal) return null;
  const { totalBooks, totalEntries, seedAuthor, seedPrompt, type, content, author } = reveal;
  // Match: a guess that CONTAINS the original prompt (accent/case-insensitive) → celebrate.
  // e.g. prompt "blue cat" + guess "a big blue cat" counts; empty prompt never matches.
  const np = norm(seedPrompt);
  const ng = norm(content);
  const exactMatch = type === 'guess' && !!np && !!ng && ng.includes(np);
  return (
    <div className="g-reveal">
      {(exactMatch || boom > 0) && <Fireworks key={`${book}-${entry}-${exactMatch ? 'm' : boom}`} />}
      {exactMatch && <div className="g-match">{t('reveal.exactMatch')}</div>}
      <button className="fw-trigger" title={t('reveal.celebrate')} onClick={() => setBoom((b) => b + 1)}>
        🎆
      </button>
      <div className="g-reveal-meta">
        {t('reveal.storyStep', { book: book + 1, totalBooks, entry: entry + 1, totalEntries })}
        <span className="g-seed">{t('reveal.startedBy', { author: seedAuthor })}</span>
      </div>

      {type === 'prompt' && (
        <>
          <div className="g-reveal-label">{t('reveal.initialPromptBy', { author })}</div>
          <div className="g-reveal-text">{content || t('reveal.noPrompt')}</div>
        </>
      )}

      {type === 'draw' && (
        <>
          <div className="g-reveal-label">{t('reveal.drew', { author })}</div>
          <DrawReplay key={`${book}-${entry}`} frames={reveal.frames} image={content} />
        </>
      )}

      {type === 'guess' && (
        <>
          <div className="g-reveal-label">{t('reveal.guessed', { author })}</div>
          <div className="g-reveal-text">{content || t('reveal.noGuess')}</div>
        </>
      )}
    </div>
  );
}
