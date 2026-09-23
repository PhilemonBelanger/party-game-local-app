# Fibbage mode (`backend/fibbage.js`)

Bluffing trivia: fill-in-the-blank prompt → players write fake answers (lies) → everyone votes for the truth.
Views: `FibbageHostView.jsx`, `FibbagePlayerView.jsx`; `FibbagePrompt` component. Prompt pool:
`backend/fibbage_prompts.json` `{ normal[], final[] }`.

## Flow
`FIBBAGE_PROMPTS` (10) random prompts per game from `normal` + `final` combined. Per prompt:
`answer → vote → reveal`, then the game ends on `podium`. Timers: `FIBBAGE_ANSWER_TIME` (60),
`FIBBAGE_VOTE_TIME` (100); reveal is untimed. The host advances (`fibbage:next`) once everyone connected is done or
time is up.

## Secrecy
The real answer reaches clients only at reveal. The truth check is server-side: `fibbage:submit` rejects a lie
matching `answer`/`alternateSpellings` in **either language**, normalized by `norm` (NFD accent-fold, trim,
collapse whitespace, lowercase) → `{ok:false, reason:'truth'}` plus a `truthAttempts` bonus flag.

## Answer phase
The input drafts on every keystroke, plus the 2s heartbeat and a final draft at time-up, so an unsubmitted
textbox is always captured even when the host advances the instant the timer hits 0. A draft equal to the truth is
dropped. At answer→vote, non-submitters' drafts become their lies; an empty box means no card.

Suggestions: `fibbage:suggestion` meters a **per-game** allowance (`FIBBAGE_MAX_SUGGESTIONS` = 3, survives
reconnect); the server only grants the count, the client picks the text from `state.suggestions[FR]`.

## Cards
At answer→vote the server **coalesces** lies with equal `norm` into one card (first author's casing shown), pads
back up to players+1 cards with distinct random suggestions (authorless decoys — votes/thumbs on them score for
nobody, and they hide coalescing and non-submitters), adds the truth, and shuffles once → stable ids.
Vote-phase `state.cards` is only `{id, text, textFR}`. `fibbage:mycard` privately tells each player which card is
theirs (covers answers auto-filled from drafts).

## Voting
A vote needs BOTH a pick and a 👍 on two **different** cards, neither of them your own; the server rejects anything
else and the client hides/disables accordingly.

## Scoring
Pure `scorePrompt(g, points, thumbMin)` → per-player breakdown; `applyScores` adds it and sends private `result`.
Points (`state.points`, env-overridable): truth guess 150; 100 per vote your lie drew (every author of a coalesced
card); 50 to the most-thumbed lie author(s) when it has ≥ `FIBBAGE_THUMB_MIN` (2) thumbs, ties all win; 100 for
typing the real answer (`state.truthAttempters` on the host, `result.triedTruth` on the phone). The UI renders
point values from `state.points`. Cumulative thumbs drive the podium "most upvoted" mention. Reveal lowercases all
answer text so casing differences don't read as different answers.

## Players and sync
`playerKeys` is snapshotted at start; mid-game joiners get `fibbage:sync {spectator:true, gameId}` and the client
scopes spectating to that gameId. `fibbage:sync` goes to every in-game player at game start and on reconnect:
{gameId, phase, promptIndex, lie, ownCardId, votedCardId, thumbCardId, suggestionsUsed, maxSuggestions}. Every
client payload carries `gameId` + `promptIndex`; stale ones are rejected.

## Prompts and language
`normal` prompts contain `<BLANK>`; `final` prompts have none (the blank is appended). `stripHtml` strips tags
server-side and must keep the literal `<BLANK>` token — keep its regex exactly that narrow.
**Bilingual EN/FR, simultaneously:** each prompt has `questionFR`/`answerFR`/`alternateSpellingsFR`/`suggestionsFR`;
`state` carries both variants (`question`+`questionFR`, `truth`+`truthFR`, cards `text`+`textFR`,
`suggestions`+`suggestionsFR`) and each device renders its own i18n language via `useLangPick`. Player lies are free
text shown as typed; only the truth and filler cards differ by language.
