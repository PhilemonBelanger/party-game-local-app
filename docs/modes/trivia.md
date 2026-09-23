# Trivia mode (`backend/trivia.js`)

Multiple-choice and numeric ("closest wins") questions, images, per-question timer, sections, podium.
Views: `HostView.jsx` (TV), `PlayerView.jsx` (phone). Quiz authoring GUI: `CreatorView.jsx`.

## Flow
Phases: `lobby → question → reveal → … → podium`, plus `section` for section-header items.
`gotoItem(idx)` dispatches by item type: a question runs the timer, a section pauses (no timer) until the host
continues. `host:next` advances after a reveal **or** past a section.

Reveal is host-triggered via `host:reveal` and accepted once every connected player answered or the timer hit 0
(`canAdvance`). At 0 the countdown latches `timeUp`: `player:answer` is rejected, players see "Time's up", and the
round stays in `question` until the host reveals.

`state` carries `questionNumber`/`totalQuestions` (sections excluded) and `lastItem` (host button label:
"Show podium" vs "Next").

## Privacy
A player's `choice` appears in `state.players` only during `reveal`. Right/wrong reaches each player privately via
`result` ({correct, gained, yourChoice} or, numeric, {yourAnswer, correctAnswer, distance}).

## Scoring
Question `points` (else `BASE_POINTS`). Choice: exact index. Numeric: closest guess(es) win, ties all win.
Per-player trivia data (`score/answered/choice`) lives in the module's own map keyed by player key; `start` clears it.

## Events
`player:answer`(index | number), `host:reveal`, `host:next`, `host:loadquiz`(quiz, cb→{ok,title,count}|{ok:false,error})
— loading a quiz validates, replaces it, and resets to the lobby.

## Quiz JSON schema
```jsonc
{ "title": "…", "questions": [
  // multiple choice
  { "q": "…", "image"?: "data:…|url", "choices": ["A", {"text":"B","image":"…"}], "answer": 0, "points"?: 100 },
  // numeric — closest guess wins; ties all win
  { "q": "…", "type": "number", "answer": 412, "points"?: 100 },
  // section header — divider shown on all screens; host taps Continue. Not scored, not counted.
  { "type": "section", "title": "…", "image"?: "…", "description"?: "…" }
]}
```
`answer` = 0-based choice index, or the target number for `type:"number"`. `choices` 2–6, string or
`{text?,image?}`. `validateQuiz` in `trivia.js` is the single source of truth for these rules; the creator GUI
builds/imports/exports the same shape.
