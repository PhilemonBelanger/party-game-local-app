import { useState } from 'react';
import { useI18n, LANGS } from '../i18n.jsx';
import { BUDDIES, loadBuddy, saveBuddy } from '../buddies.js';
import { Buddy, Wordmark } from '../components/Sky.jsx';

// Phone join screen (also where the TV picks a mode to host).
export default function Home({ onPickHost, onPickGartic, onPickFibbage, onJoin, onCreate }) {
  const { t, lang, setLang } = useI18n();
  const [name, setName] = useState('');
  const [buddy, setBuddy] = useState(() => loadBuddy(''));
  const valid = name.trim().length > 0;

  function join() {
    if (!valid) return;
    saveBuddy(buddy);
    onJoin(name.trim(), buddy);
  }

  return (
    <div className="screen home">
      <Wordmark size="clamp(40px, 13vw, 64px)" />
      <div className="join">
        <div className="buddy-hero"><Buddy player={{ buddy }} size={96} hop /></div>
        <div className="label">{t('home.pickBuddy')}</div>
        <div className="buddy-pick" role="radiogroup" aria-label={t('home.pickBuddy')}>
          {BUDDIES.map((b) => (
            <button key={b} role="radio" aria-checked={b === buddy} onClick={() => setBuddy(b)}>
              <Buddy player={{ buddy: b }} size={46} className={b === buddy ? 'sel' : ''} />
            </button>
          ))}
        </div>
        <input
          value={name}
          maxLength={16}
          placeholder={t('home.name.placeholder')}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && join()}
        />
        <div className="seg" role="radiogroup" aria-label={t('home.language')}>
          {Object.entries(LANGS).map(([code, label]) => (
            <button key={code} className={lang === code ? 'on' : ''} onClick={() => setLang(code)}>{label}</button>
          ))}
        </div>
        <button className="primary big" disabled={!valid} onClick={join}>
          {t('home.join')}
        </button>
      </div>

      <div className="host-links-title">{t('home.hostTitle')}</div>
      <div className="host-links">
        <button className="ghost" onClick={onPickHost}>{t('home.host.trivia')}</button>
        <button className="ghost" onClick={onPickGartic}>{t('home.host.gartic')}</button>
        <button className="ghost" onClick={onPickFibbage}>{t('home.host.fibbage')}</button>
        <button className="ghost" onClick={onCreate}>{t('home.create')}</button>
      </div>
    </div>
  );
}
