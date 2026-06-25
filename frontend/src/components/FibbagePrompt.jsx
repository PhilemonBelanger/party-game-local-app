import { useI18n } from '../i18n.jsx';

// Picks the FR variant when the viewer's language is French, else the EN value.
// Each device renders independently, so a FR phone and an EN host see the same game
// in their own language. Falls back to the EN field when a FR value is missing.
export function useLangPick() {
  const { lang } = useI18n();
  return (en, fr) => (lang === 'fr' ? fr || en : en);
}

// Renders a Fibbage prompt with its blank filled by `fill` (default a dashed blank).
// `normal` prompts contain "<BLANK>"; `final` prompts are statements with none, so we
// append the blank after the sentence. HTML is already stripped server-side.
export default function FibbagePrompt({ prompt, fill = null, className = '' }) {
  const pick = useLangPick();
  if (!prompt) return null;
  const q = pick(prompt.question, prompt.questionFR) || '';
  const blank = fill ? <b className="fb-fill">{fill}</b> : <span className="fb-blank">______</span>;
  let body;
  if (q.includes('<BLANK>')) {
    const [before, after = ''] = q.split('<BLANK>');
    body = (
      <>
        {before}
        {blank}
        {after}
      </>
    );
  } else {
    body = (
      <>
        {q} {blank}
      </>
    );
  }
  return (
    <div className={`fb-prompt ${className}`}>
      <p className="fb-question">{body}</p>
    </div>
  );
}
