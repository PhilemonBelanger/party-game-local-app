import Fireworks from './Fireworks.jsx';
import DrawReplay from './DrawReplay.jsx';
import { useT } from '../i18n.jsx';

const norm = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : null);

// Renders one entry of a Gartic story chain (shared by host + player reveal screens).
export default function GarticReveal({ reveal }) {
  const t = useT();
  if (!reveal) return null;
  const { book, entry, totalBooks, totalEntries, seedAuthor, seedPrompt, type, content, author } = reveal;
  // exact match: a guess that equals the original prompt (case-insensitive) → celebrate
  const exactMatch = type === 'guess' && content && norm(content) === norm(seedPrompt);
  return (
    <div className="g-reveal">
      {exactMatch && <Fireworks key={`${book}-${entry}`} />}
      {exactMatch && <div className="g-match">{t('reveal.exactMatch')}</div>}
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
