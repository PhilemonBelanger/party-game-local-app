# Party Games

Local Wi-Fi party games played in one room: a shared TV screen runs the game and everyone plays from their phone.

## Language

### Session

**Host**:
The TV-screen device that shows the game and holds the controls (start, next, reveal, reset).
_Avoid_: Admin, server, GM

**Player**:
A person on a phone, identified by the name they joined with; rejoining with the same name is the same Player.
_Avoid_: User, client, participant

**Mode**:
One of the three games the Host can pick: Trivia, Gartic, or Fibbage.
_Avoid_: Game type

**Game**:
One play-through of a Mode, from Start to the final screen.
_Avoid_: Session, round

**Lobby**:
The waiting screen before a Game starts, where Players join.

**In-game Player**:
A Player who was present when the Game started; only they take part in that Game.

**Spectator**:
A Player who joined after the Game started; they watch until the next Game.
_Avoid_: Observer, late joiner

**Roster**:
The Host's always-visible list of Players with their connection state (and score, where the Mode keeps one).

### Pacing

**Phase**:
A named stage of a Game (e.g. question, reveal, answer, vote, podium).
_Avoid_: State, screen

**Step**:
A stretch of play in which each In-game Player owes at most one input (one question, one Gartic round, one Fibbage answer or vote).

**Draft**:
A Player's in-progress, not-yet-submitted input, kept so it counts if time runs out.
_Avoid_: Autosave, partial answer

**Time's up**:
The moment the timer reaches zero: input locks, and the Game waits for the Host.
_Avoid_: Timeout, expiry

**Done**:
A Player has submitted their input for the current Step.
_Avoid_: Answered (outside Trivia), ready

**Reveal**:
The Host-driven Phase that shows the outcome of a Step.

**Podium**:
The final ranking screen; equal scores share a rank.
_Avoid_: Leaderboard, results

### Trivia

**Quiz**:
The ordered list of Items a Trivia Game plays through.

**Item**:
One entry in a Quiz: a Question or a Section.

**Question**:
An Item Players answer: multiple choice, or a number where the closest guess wins.

**Section**:
A divider Item with a title (and optional image/description) that the Host continues past; never scored.
_Avoid_: Round, chapter

### Gartic

**Book**:
One chain that starts from a Prompt and alternates Drawings and Guesses, each entry by a different Player.
_Avoid_: Story, chain

**Round**:
One pass in which every In-game Player adds one entry to a different Book.
_Avoid_: Turn

**Prompt** (Gartic):
The text a Player writes in the first Round to start their Book.

**Drawing**:
An entry in a Book: a Player's picture of the previous entry.

**Guess**:
An entry in a Book: a Player's text describing the previous Drawing.

**Match**:
A Guess that contains the Book's Prompt; celebrated at Reveal.

### Fibbage

**Prompt** (Fibbage):
A fill-in-the-blank fact whose real answer is hidden until Reveal.
_Avoid_: Question, clue

**Truth**:
The real answer to a Fibbage Prompt, in any of its accepted spellings and either language.
_Avoid_: Real answer, correct answer

**Lie**:
A fake answer a Player writes to fool the others.
_Avoid_: Bluff, fake

**Truth attempt**:
A Player typing the Truth as their Lie; refused, but rewarded.

**Card**:
One option shown for voting: a Lie, a Decoy, or the Truth.
_Avoid_: Option, answer

**Coalescing**:
Merging Lies that are the same text (ignoring case, spacing and accents) into one Card shared by their authors.

**Decoy**:
An authorless Card taken from a Prompt's Suggestions so every vote shows one Card more than there are In-game Players.
_Avoid_: Filler

**Suggestion**:
A ready-made Lie from a Prompt's list that a Player may request a limited number of times per Game.

**Vote**:
A Player's pick of the Card they believe is the Truth; never their own.

**Thumb**:
A Player's 👍 on a Card they like, which must be a different Card from their Vote and not their own.
_Avoid_: Like, upvote

## Relationships

- A **Host** runs one **Mode** at a time; each **Game** belongs to one **Mode**.
- A **Game** is a sequence of **Steps**; each **Step** passes through **Phases** and ends in a **Reveal** (Gartic reveals once, at the end).
- **In-game Players** are fixed at Start; anyone joining later is a **Spectator** until the next **Game**.
- At **Time's up**, a **Player** who is not **Done** is represented by their latest **Draft**.
- In Gartic, N In-game Players make N **Books** over N **Rounds**; each Player adds exactly one entry to every Book.
- In Fibbage, each **Prompt** yields one **Card** per distinct **Lie** (after **Coalescing**), plus **Decoys**, plus the **Truth**.

## Flagged ambiguities

- "Prompt" names two things. It is qualified by Mode: a **Gartic Prompt** starts a Book; a **Fibbage Prompt** is a fact with a hidden Truth. (Kept deliberately.)
- "Round" means a Gartic Round only. Trivia's "Round 1"-style dividers are **Sections**.
- "Answered" is Trivia's word for Done. Say **Done** for the general idea across Modes.
- Players see "story" in the Gartic UI. The domain term is **Book**.
