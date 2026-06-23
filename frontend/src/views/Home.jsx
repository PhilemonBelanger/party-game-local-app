import { useState } from 'react';
import { useI18n, LANGS } from '../i18n.jsx';

export default function Home({ onPickHost, onPickGartic, onJoin, onCreate }) {
  const { t, lang, setLang } = useI18n();
  const [name, setName] = useState('');
  const valid = name.trim().length > 0;

  return (
    <div className="screen home">
      <h1 className="logo">{t('home.logo')}</h1>

      <div className="card">
        <h2>{t('home.join.heading')}</h2>
        <input
          autoFocus
          value={name}
          maxLength={16}
          placeholder={t('home.name.placeholder')}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && valid && onJoin(name.trim())}
        />
        <label className="field lang-field">
          <span>{t('home.language')}</span>
          <select value={lang} onChange={(e) => setLang(e.target.value)}>
            {Object.entries(LANGS).map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </label>
        <button className="primary big" disabled={!valid} onClick={() => onJoin(name.trim())}>
          {t('home.join')}
        </button>
      </div>

      <button className="ghost" onClick={onPickHost}>
        {t('home.host.trivia')}
      </button>
      <button className="ghost" onClick={onPickGartic}>
        {t('home.host.gartic')}
      </button>
      <button className="ghost" onClick={onCreate}>
        {t('home.create')}
      </button>
    </div>
  );
}
