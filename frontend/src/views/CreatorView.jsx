import { useRef, useState } from 'react';
import { useT } from '../i18n.jsx';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const MAX_CHOICES = 6;

let _id = 0;
const uid = () => ++_id;

function newChoice() {
  return { _id: uid(), text: '', image: null };
}
function newQuestion() {
  return { _id: uid(), kind: 'question', type: 'choice', q: '', image: null, choices: [newChoice(), newChoice()], answer: 0, points: '', numAnswer: '' };
}
function newSection() {
  return { _id: uid(), kind: 'section', title: '', image: null, description: '' };
}

// Read a file, downscale to keep base64 small, return a data URI.
function fileToScaledDataUrl(file, maxDim = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        // JPEG keeps size down; fine for trivia photos (drops transparency)
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// map an exported/hand-written quiz JSON into the editor's internal shape
function toInternalQuestions(data) {
  const src = Array.isArray(data?.questions) ? data.questions : [];
  const qs = src.map((q) => {
    if (q?.type === 'section') {
      return { _id: uid(), kind: 'section', title: q.title || '', image: q.image || null, description: q.description || '' };
    }
    const choices = (Array.isArray(q?.choices) ? q.choices : []).map((c) =>
      typeof c === 'string'
        ? { _id: uid(), text: c, image: null }
        : { _id: uid(), text: c?.text || '', image: c?.image || null }
    );
    while (choices.length < 2) choices.push(newChoice());
    const type = q?.type === 'number' ? 'number' : 'choice';
    return {
      _id: uid(),
      kind: 'question',
      type,
      q: typeof q?.q === 'string' ? q.q : '',
      image: q?.image || null,
      choices,
      answer: type === 'choice' && Number.isInteger(q?.answer) && q.answer >= 0 && q.answer < choices.length ? q.answer : 0,
      numAnswer: type === 'number' && typeof q?.answer === 'number' ? String(q.answer) : '',
      points: q?.points != null ? String(q.points) : '',
    };
  });
  return qs.length ? qs : [newQuestion()];
}

export default function CreatorView({ onBack }) {
  const t = useT();
  const [title, setTitle] = useState('My Quiz');
  const [questions, setQuestions] = useState([newQuestion()]);
  const importRef = useRef(null);

  function onImport(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try {
        data = JSON.parse(reader.result);
      } catch {
        alert(t('creator.notJson'));
        return;
      }
      if (!data || typeof data !== 'object' || !Array.isArray(data.questions)) {
        alert(t('creator.notQuiz'));
        return;
      }
      setTitle(typeof data.title === 'string' && data.title.trim() ? data.title : 'My Quiz');
      setQuestions(toInternalQuestions(data));
    };
    reader.onerror = () => alert(t('creator.cantReadFile'));
    reader.readAsText(file);
  }

  // immutably patch one question
  const patchQ = (qi, patch) =>
    setQuestions((qs) => qs.map((q, i) => (i === qi ? { ...q, ...patch } : q)));
  const patchChoice = (qi, ci, patch) =>
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qi ? { ...q, choices: q.choices.map((c, j) => (j === ci ? { ...c, ...patch } : c)) } : q
      )
    );

  const addQuestion = () => setQuestions((qs) => [...qs, newQuestion()]);
  const addSection = () => setQuestions((qs) => [...qs, newSection()]);
  const removeQuestion = (qi) => setQuestions((qs) => qs.filter((_, i) => i !== qi));
  const moveQuestion = (qi, dir) =>
    setQuestions((qs) => {
      const j = qi + dir;
      if (j < 0 || j >= qs.length) return qs;
      const copy = [...qs];
      [copy[qi], copy[j]] = [copy[j], copy[qi]];
      return copy;
    });

  const addChoice = (qi) =>
    setQuestions((qs) =>
      qs.map((q, i) => (i === qi && q.choices.length < MAX_CHOICES ? { ...q, choices: [...q.choices, newChoice()] } : q))
    );
  const removeChoice = (qi, ci) =>
    setQuestions((qs) =>
      qs.map((q, i) => {
        if (i !== qi || q.choices.length <= 2) return q;
        const choices = q.choices.filter((_, j) => j !== ci);
        let answer = q.answer;
        if (ci === answer) answer = 0;
        else if (ci < answer) answer -= 1;
        return { ...q, choices, answer };
      })
    );

  async function pickImage(file, apply) {
    if (!file) return;
    try {
      const dataUrl = await fileToScaledDataUrl(file);
      apply(dataUrl);
    } catch {
      alert(t('creator.cantReadImage'));
    }
  }

  // validation -> list of human messages
  const errors = [];
  if (!title.trim()) errors.push(t('creator.err.needTitle'));
  if (!questions.some((q) => q.kind !== 'section')) errors.push(t('creator.err.needQuestion'));
  let qNum = 0;
  questions.forEach((q, i) => {
    if (q.kind === 'section') {
      if (!q.title.trim() && !q.image) errors.push(t('creator.err.sectionNeeds', { i: i + 1 }));
      return;
    }
    qNum += 1;
    const n = qNum;
    if (!q.q.trim() && !q.image) errors.push(t('creator.err.qNeedsText', { n }));
    if (q.type === 'number') {
      if (q.numAnswer === '' || isNaN(Number(q.numAnswer))) errors.push(t('creator.err.qNeedsNumber', { n }));
    } else {
      if (q.choices.length < 2) errors.push(t('creator.err.qNeedsChoices', { n }));
      q.choices.forEach((c, j) => {
        if (!c.text.trim() && !c.image) errors.push(t('creator.err.choiceNeeds', { n, letter: LETTERS[j] }));
      });
    }
    if (q.points !== '' && (isNaN(Number(q.points)) || Number(q.points) < 0))
      errors.push(t('creator.err.pointsPositive', { n }));
  });
  const valid = errors.length === 0;

  function buildQuiz() {
    return {
      title: title.trim(),
      questions: questions.map((q) => {
        if (q.kind === 'section') {
          const sec = { type: 'section', title: q.title.trim() };
          if (q.image) sec.image = q.image;
          if (q.description.trim()) sec.description = q.description.trim();
          return sec;
        }
        const out = { q: q.q.trim() };
        if (q.image) out.image = q.image;
        if (q.type === 'number') {
          out.type = 'number';
          out.answer = Number(q.numAnswer);
        } else {
          out.choices = q.choices.map((c) =>
            c.image ? { text: c.text.trim(), image: c.image } : c.text.trim()
          );
          out.answer = q.answer;
        }
        if (q.points !== '') out.points = Number(q.points);
        return out;
      }),
    };
  }

  function exportJson() {
    if (!valid) return;
    const json = JSON.stringify(buildQuiz(), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safe = title.trim().replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'quiz';
    a.download = `${safe}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // approximate exported size (base64 images dominate)
  const approxKb = Math.round(JSON.stringify(buildQuiz()).length / 1024);

  return (
    <div className="screen creator">
      <header className="creator-bar">
        <button className="ghost" onClick={onBack}>{t('common.back')}</button>
        <h1>{t('creator.title')}</h1>
        <div className="creator-bar-right">
          <input ref={importRef} type="file" accept="application/json,.json" hidden
            onChange={(e) => { onImport(e.target.files?.[0]); e.target.value = ''; }} />
          <button className="ghost small" onClick={() => importRef.current?.click()}>{t('creator.importJson')}</button>
          <span className="creator-size">~{approxKb} KB</span>
        </div>
      </header>

      <label className="field">
        <span>{t('creator.quizTitle')}</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('creator.quizTitle')} />
      </label>

      {questions.map((q, qi) => {
        if (q.kind === 'section') {
          return (
            <div className="qcard section-card" key={q._id}>
              <div className="qcard-head">
                <h3>{t('creator.sectionHead')}</h3>
                <div className="qcard-actions">
                  <button className="mini" disabled={qi === 0} onClick={() => moveQuestion(qi, -1)}>↑</button>
                  <button className="mini" disabled={qi === questions.length - 1} onClick={() => moveQuestion(qi, 1)}>↓</button>
                  <button className="mini danger" onClick={() => removeQuestion(qi)}>✕</button>
                </div>
              </div>
              <label className="field">
                <span>{t('creator.sectionTitle')}</span>
                <input value={q.title} onChange={(e) => patchQ(qi, { title: e.target.value })} placeholder={t('creator.sectionTitle')} />
              </label>
              <ImageField
                image={q.image}
                onPick={(file) => pickImage(file, (d) => patchQ(qi, { image: d }))}
                onClear={() => patchQ(qi, { image: null })}
                label={t('creator.sectionImage')}
              />
              <label className="field">
                <span>{t('creator.descOptional')}</span>
                <textarea
                  className="qtext"
                  rows={2}
                  value={q.description}
                  onChange={(e) => patchQ(qi, { description: e.target.value })}
                  placeholder={t('creator.descPlaceholder')}
                />
              </label>
            </div>
          );
        }
        const questionNo = questions.slice(0, qi + 1).filter((it) => it.kind !== 'section').length;
        return (
        <div className="qcard" key={q._id}>
          <div className="qcard-head">
            <h3>{t('creator.questionNo', { n: questionNo })}</h3>
            <div className="qcard-actions">
              <button className="mini" disabled={qi === 0} onClick={() => moveQuestion(qi, -1)}>↑</button>
              <button className="mini" disabled={qi === questions.length - 1} onClick={() => moveQuestion(qi, 1)}>↓</button>
              <button className="mini danger" disabled={questions.length === 1} onClick={() => removeQuestion(qi)}>✕</button>
            </div>
          </div>

          <textarea
            className="qtext"
            rows={2}
            value={q.q}
            onChange={(e) => patchQ(qi, { q: e.target.value })}
            placeholder={t('creator.questionPlaceholder')}
          />

          <ImageField
            image={q.image}
            onPick={(file) => pickImage(file, (d) => patchQ(qi, { image: d }))}
            onClear={() => patchQ(qi, { image: null })}
            label={t('creator.questionImage')}
          />

          <div className="type-toggle">
            <label>
              <input type="radio" name={`type-${q._id}`} checked={q.type !== 'number'} onChange={() => patchQ(qi, { type: 'choice' })} />
              {t('creator.multipleChoice')}
            </label>
            <label>
              <input type="radio" name={`type-${q._id}`} checked={q.type === 'number'} onChange={() => patchQ(qi, { type: 'number' })} />
              {t('creator.numberClosest')}
            </label>
          </div>

          {q.type === 'number' ? (
            <label className="field">
              <span>{t('creator.correctNumber')}</span>
              <input
                type="number"
                step="any"
                className="points-input"
                value={q.numAnswer}
                onChange={(e) => patchQ(qi, { numAnswer: e.target.value })}
                placeholder={t('creator.numberExample')}
              />
            </label>
          ) : (
          <div className="choice-editors">
            {q.choices.map((c, ci) => (
              <div className={`choice-editor ${q.answer === ci ? 'is-correct' : ''}`} key={c._id}>
                <label className="correct-radio" title={t('creator.markCorrect')}>
                  <input
                    type="radio"
                    name={`ans-${q._id}`}
                    checked={q.answer === ci}
                    onChange={() => patchQ(qi, { answer: ci })}
                  />
                  <span className="letter">{LETTERS[ci]}</span>
                </label>
                <input
                  className="choice-text-input"
                  value={c.text}
                  onChange={(e) => patchChoice(qi, ci, { text: e.target.value })}
                  placeholder={t('creator.choicePlaceholder', { letter: LETTERS[ci] })}
                />
                <ImageField
                  compact
                  image={c.image}
                  onPick={(file) => pickImage(file, (d) => patchChoice(qi, ci, { image: d }))}
                  onClear={() => patchChoice(qi, ci, { image: null })}
                />
                <button className="mini danger" disabled={q.choices.length <= 2} onClick={() => removeChoice(qi, ci)}>✕</button>
              </div>
            ))}
            <button className="ghost small" disabled={q.choices.length >= MAX_CHOICES} onClick={() => addChoice(qi)}>
              {t('creator.addChoice')}
            </button>
          </div>
          )}

          <label className="field inline">
            <span>{t('creator.pointsOptional')}</span>
            <input
              className="points-input"
              type="number"
              min="0"
              value={q.points}
              onChange={(e) => patchQ(qi, { points: e.target.value })}
              placeholder={t('creator.pointsDefault')}
            />
          </label>
        </div>
        );
      })}

      <div className="add-row">
        <button className="ghost" onClick={addQuestion}>{t('creator.addQuestion')}</button>
        <button className="ghost" onClick={addSection}>{t('creator.addSection')}</button>
      </div>

      {!valid && (
        <ul className="creator-errors">
          {errors.slice(0, 8).map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      <div className="creator-footer">
        <button className="primary big" disabled={!valid} onClick={exportJson}>
          {t('creator.exportJson')}
        </button>
        <p className="hint">{t('creator.exportHint')}</p>
      </div>
    </div>
  );
}

function ImageField({ image, onPick, onClear, label, compact }) {
  const t = useT();
  const ref = useRef(null);
  return (
    <div className={`imgfield ${compact ? 'compact' : ''}`}>
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ''; }} />
      {image ? (
        <div className="imgfield-preview">
          <img src={image} alt="" />
          <button className="mini danger" onClick={onClear}>{t('creator.remove')}</button>
        </div>
      ) : (
        <button className="ghost small" onClick={() => ref.current?.click()}>
          🖼 {label || t('creator.image')}
        </button>
      )}
    </div>
  );
}
