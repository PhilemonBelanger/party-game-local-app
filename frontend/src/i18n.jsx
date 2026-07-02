import { createContext, useCallback, useContext, useState } from 'react';

// Lightweight homemade i18n (no dependency → no Docker rebuild needed).
// Dictionary values are either strings or functions of params (for interpolation/plurals).
// t(key, params) resolves the current language, falling back to English then the key itself.

const STORAGE_KEY = 'lang';
export const LANGS = { en: 'English', fr: 'Français' };

const dict = {
  en: {
    // Home
    'home.logo': '🎯 Trivia',
    'home.join.heading': 'Join the game',
    'home.name.placeholder': 'Enter your name',
    'home.join': 'Join',
    'home.host.trivia': '📺 Host: Trivia (TV)',
    'home.host.gartic': '🎨 Host: Gartic Phone (TV)',
    'home.host.fibbage': '🃏 Host: Fibbage (TV)',
    'home.create': '🛠 Create a quiz',
    'home.language': 'Language',

    // Shared
    'common.connecting': 'Connecting…',
    'common.section': 'Section',
    'common.startGame': 'Start Game',
    'common.backToLobby': 'Back to Lobby',
    'common.back': '← Back',
    'common.next': 'Next →',
    'common.submit': 'Submit',
    'common.showPodium': 'Show Podium →',
    'common.continue': 'Continue →',
    'common.waitingHost': 'Waiting for the host…',

    // Host — trivia
    'host.scanJoin': 'Scan to join from your phone (same Wi-Fi):',
    'host.quizLabel': 'Quiz:',
    'host.questionCount': ({ n }) => `${n} question${n === 1 ? '' : 's'}`,
    'host.loadQuiz': '📂 Load quiz from JSON',
    'host.playersReady': ({ n }) => `${n} player${n === 1 ? '' : 's'} ready`,
    'host.notValidJson': 'Not valid JSON',
    'host.invalidQuiz': 'Invalid quiz file',
    'host.loaded': ({ title, count }) => `Loaded “${title}” — ${count} question${count === 1 ? '' : 's'}`,
    'host.questionXofY': ({ n, total }) => `Question ${n} / ${total}`,
    'host.revealAnswer': 'Reveal Answer →',
    'host.timeUpSuffix': ' (time up)',
    'host.waitingAnswered': ({ a, c }) => `Waiting… ${a}/${c} answered`,
    'host.finalScores': '🏆 Final Scores',
    'host.numberPrompt': '⌨️ Type a number on your phone — closest wins!',
    'host.answer': ({ n }) => `Answer: ${n}`,
    'host.noAnswers': 'No answers',
    'host.exact': 'exact!',
    'host.off': ({ d }) => `${d} off`,

    // Player — trivia
    'player.youreIn': ({ name }) => `You're in${name ? `, ${name}` : ''}! 🎉`,
    'player.waitStart': 'Waiting for the host to start the game…',
    'player.getReady': 'Get ready… waiting for the host.',
    'player.qShort': ({ n, total }) => `Q ${n}/${total}`,
    'player.answerLocked': 'Answer locked ✅',
    'player.waitReveal': 'Waiting for the host to reveal…',
    'player.timesUp': "⏰ Time's up!",
    'player.waitRevealAnswer': 'Waiting for the host to reveal the answer…',
    'player.numberHint': 'Type a number — closest wins!',
    'player.yourNumber': 'Your number',
    'player.closest': ({ gained }) => `Closest! +${gained}`,
    'player.notClosest': 'Not the closest',
    'player.answerIs': 'Answer:',
    'player.yourGuessLabel': 'Your guess:',
    'player.exact': 'exact!',
    'player.off': ({ d }) => `${d} off`,
    'player.yourScore': 'Your score:',
    'player.correct': ({ gained }) => `Correct! +${gained}`,
    'player.wrong': 'Wrong ✗',
    'player.correctAnswer': 'Correct answer:',
    'player.gameOver': '🏁 Game Over',
    'player.tiedFor': ({ rank }) => `Tied for #${rank}`,
    'player.youFinished': ({ rank }) => `You finished #${rank}`,
    'player.finalScore': 'Final score:',

    // Creator
    'creator.notJson': 'That file is not valid JSON.',
    'creator.notQuiz': 'JSON does not look like a quiz (missing "questions" array).',
    'creator.cantReadFile': 'Could not read that file.',
    'creator.cantReadImage': 'Could not read that image.',
    'creator.title': '🛠 Quiz Creator',
    'creator.importJson': '📥 Import JSON',
    'creator.quizTitle': 'Quiz title',
    'creator.sectionHead': '📑 Section',
    'creator.sectionTitle': 'Section title',
    'creator.sectionImage': 'Section image',
    'creator.descOptional': 'Description (optional)',
    'creator.descPlaceholder': 'Shown on all screens',
    'creator.questionNo': ({ n }) => `Question ${n}`,
    'creator.questionPlaceholder': 'Question text (optional if it has an image)',
    'creator.questionImage': 'Question image',
    'creator.multipleChoice': 'Multiple choice',
    'creator.numberClosest': 'Number (closest wins)',
    'creator.correctNumber': 'Correct answer (number)',
    'creator.numberExample': 'e.g. 42',
    'creator.choicePlaceholder': ({ letter }) => `Choice ${letter} text`,
    'creator.addChoice': '+ Add choice',
    'creator.pointsOptional': 'Points (optional)',
    'creator.pointsDefault': 'default',
    'creator.addQuestion': '+ Add question',
    'creator.addSection': '+ Add section',
    'creator.exportJson': '⬇ Export quiz JSON',
    'creator.exportHint': 'Then go to the Host screen → “Load quiz from JSON” → pick this file.',
    'creator.remove': 'remove',
    'creator.image': 'Image',
    'creator.markCorrect': 'Mark as correct answer',
    // Creator validation
    'creator.err.needTitle': 'Quiz needs a title.',
    'creator.err.needQuestion': 'Add at least one question.',
    'creator.err.sectionNeeds': ({ i }) => `Section ${i}: needs a title or an image.`,
    'creator.err.qNeedsText': ({ n }) => `Q${n}: needs question text or an image.`,
    'creator.err.qNeedsNumber': ({ n }) => `Q${n}: needs a numeric answer.`,
    'creator.err.qNeedsChoices': ({ n }) => `Q${n}: needs at least 2 choices.`,
    'creator.err.choiceNeeds': ({ n, letter }) => `Q${n} choice ${letter}: needs text or an image.`,
    'creator.err.pointsPositive': ({ n }) => `Q${n}: points must be a positive number.`,

    // Gartic — host
    'gartic.logo': '🎨 Gartic Phone',
    'gartic.needTwo': 'Need at least 2 players.',
    'gartic.initialPrompt': '✏️ Initial Prompt',
    'gartic.roundDrawing': ({ round }) => `🎨 Round ${round}: Drawing`,
    'gartic.roundGuessing': ({ round }) => `💭 Round ${round}: Guessing`,
    'gartic.done': ({ n, total }) => `${n} / ${total} done`,
    'gartic.timesUpSuffix': " · time's up",
    'gartic.nextRound': 'Next round →',
    'gartic.waiting': ({ n, total }) => `Waiting… ${n}/${total}`,

    // Gartic — player
    'gartic.youreIn': "You're in! 🎉",
    'gartic.waitStart': 'Waiting for the host to start Gartic Phone…',
    'gartic.followHost': '👀 Follow along on the host screen',
    'gartic.gettingTask': 'Getting your task…',
    'gartic.spectating': '👀 Spectating',
    'gartic.spectatingHint': "A game is already in progress — you'll join the next one. Watch the host screen!",
    'gartic.lockedIn': 'Locked in ✅',
    'gartic.waitOthers': 'Waiting for others…',
    'gartic.writeFun': 'Write something fun to draw & guess',
    'gartic.promptPlaceholder': 'e.g. A cat riding a skateboard',
    'gartic.drawLabel': ({ prev }) => `Draw: ${prev}`,
    'gartic.nothing': '(nothing?)',
    'gartic.submitDrawing': 'Submit drawing',
    'gartic.whatIsThis': 'What is this?',
    'gartic.yourGuess': 'Your guess',
    'gartic.submitGuess': 'Submit guess',

    // Gartic reveal
    'reveal.exactMatch': '🎯 Exact match!',
    'reveal.celebrate': 'Celebrate!',
    'reveal.storyStep': ({ book, totalBooks, entry, totalEntries }) =>
      `Story ${book} / ${totalBooks} · step ${entry} / ${totalEntries}`,
    'reveal.startedBy': ({ author }) => ` — started by ${author}`,
    'reveal.initialPromptBy': ({ author }) => `✏️ Initial prompt — ${author}`,
    'reveal.noPrompt': '(no prompt)',
    'reveal.drew': ({ author }) => `🎨 ${author} drew`,
    'reveal.guessed': ({ author }) => `💭 ${author} guessed`,
    'reveal.noGuess': '(no guess)',

    // Draw canvas / replay
    'draw.customColor': 'Custom color',
    'draw.eraser': 'Eraser',
    'draw.undo': 'Undo',
    'draw.clear': 'Clear',
    'draw.noDrawing': '(no drawing)',
    'draw.replay': '↻ Replay',

    // Fibbage
    'fibbage.logo': '🃏 Fibbage',
    'fibbage.needTwo': 'Need at least 2 players.',
    'fibbage.waitStart': 'Waiting for the host to start Fibbage…',
    'fibbage.promptXofY': ({ n, total }) => `Prompt ${n} / ${total}`,
    'fibbage.writeLie': 'Fill in the blank to fool everyone!',
    'fibbage.liePlaceholder': 'Your lie…',
    'fibbage.getSuggestion': '💡 Get a suggestion',
    'fibbage.thatsTheTruth': "That's the real answer — congrats! 🎉 But enter something else to fool everyone!",
    'fibbage.lieLocked': 'Lie locked in ✅',
    'fibbage.submitted': ({ n, total }) => `${n} / ${total} submitted`,
    'fibbage.toVoting': 'To voting →',
    'fibbage.waitingSubmit': ({ n, total }) => `Waiting… ${n}/${total}`,
    'fibbage.whichTrue': 'Which one is the truth?',
    'fibbage.pickTrue': 'Pick the real answer — 👍 a favorite',
    'fibbage.yourLie': '(your lie)',
    'fibbage.thumbHint': 'Thumbs up (just for fun)',
    'fibbage.lockIn': 'Lock in',
    'fibbage.voteLocked': 'Vote locked in ✅',
    'fibbage.voted': ({ n, total }) => `${n} / ${total} voted`,
    'fibbage.revealResults': 'Reveal results →',
    'fibbage.waitingVote': ({ n, total }) => `Waiting… ${n}/${total}`,
    'fibbage.theTruth': '✓ THE TRUTH',
    'fibbage.by': ({ names }) => `— ${names}`,
    'fibbage.nextPrompt': 'Next prompt →',
    'fibbage.youGained': ({ n }) => `+${n} points!`,
    'fibbage.noPoints': 'No points this round',
    'fibbage.bdGuessed': '🎯 You found the truth (+150)',
    'fibbage.bdFooled': ({ n }) => `🤥 You fooled ${n} ${n === 1 ? 'player' : 'players'} (+${n * 100})`,
    'fibbage.bdThumbs': '👍 Most thumbs-up (+50)',
    'fibbage.mostUpvoted': ({ name, n }) => `👍 Most upvoted: ${name} (${n})`,

    // QR
    'qr.noLan': '⚠ Could not detect a LAN IP. Connect this PC to Wi-Fi/Ethernet so phones can scan.',
  },

  fr: {
    // Home
    'home.logo': '🎯 Trivia',
    'home.join.heading': 'Rejoindre la partie',
    'home.name.placeholder': 'Entrez votre nom',
    'home.join': 'Rejoindre',
    'home.host.trivia': '📺 Animer : Trivia (TV)',
    'home.host.gartic': '🎨 Animer : Gartic Phone (TV)',
    'home.host.fibbage': '🃏 Animer : Fibbage (TV)',
    'home.create': '🛠 Créer un quiz',
    'home.language': 'Langue',

    // Shared
    'common.connecting': 'Connexion…',
    'common.section': 'Section',
    'common.startGame': 'Démarrer la partie',
    'common.backToLobby': 'Retour au salon',
    'common.back': '← Retour',
    'common.next': 'Suivant →',
    'common.submit': 'Envoyer',
    'common.showPodium': 'Voir le podium →',
    'common.continue': 'Continuer →',
    'common.waitingHost': "En attente de l'animateur…",

    // Host — trivia
    'host.scanJoin': 'Scannez pour rejoindre depuis votre téléphone (même Wi-Fi) :',
    'host.quizLabel': 'Quiz :',
    'host.questionCount': ({ n }) => `${n} question${n === 1 ? '' : 's'}`,
    'host.loadQuiz': '📂 Charger un quiz (JSON)',
    'host.playersReady': ({ n }) => `${n} joueur${n === 1 ? '' : 's'} prêt${n === 1 ? '' : 's'}`,
    'host.notValidJson': 'JSON invalide',
    'host.invalidQuiz': 'Fichier de quiz invalide',
    'host.loaded': ({ title, count }) => `« ${title} » chargé — ${count} question${count === 1 ? '' : 's'}`,
    'host.questionXofY': ({ n, total }) => `Question ${n} / ${total}`,
    'host.revealAnswer': 'Révéler la réponse →',
    'host.timeUpSuffix': ' (temps écoulé)',
    'host.waitingAnswered': ({ a, c }) => `En attente… ${a}/${c} ont répondu`,
    'host.finalScores': '🏆 Scores finaux',
    'host.numberPrompt': '⌨️ Tapez un nombre sur votre téléphone — le plus proche gagne !',
    'host.answer': ({ n }) => `Réponse : ${n}`,
    'host.noAnswers': 'Aucune réponse',
    'host.exact': 'exact !',
    'host.off': ({ d }) => `à ${d}`,

    // Player — trivia
    'player.youreIn': ({ name }) => `Vous êtes dans la partie${name ? `, ${name}` : ''} ! 🎉`,
    'player.waitStart': "En attente du démarrage par l'animateur…",
    'player.getReady': "Préparez-vous… en attente de l'animateur.",
    'player.qShort': ({ n, total }) => `Q ${n}/${total}`,
    'player.answerLocked': 'Réponse verrouillée ✅',
    'player.waitReveal': "En attente de la révélation par l'animateur…",
    'player.timesUp': '⏰ Temps écoulé !',
    'player.waitRevealAnswer': "En attente de la révélation de la réponse par l'animateur…",
    'player.numberHint': 'Tapez un nombre — le plus proche gagne !',
    'player.yourNumber': 'Votre nombre',
    'player.closest': ({ gained }) => `Le plus proche ! +${gained}`,
    'player.notClosest': 'Pas le plus proche',
    'player.answerIs': 'Réponse :',
    'player.yourGuessLabel': 'Votre réponse :',
    'player.exact': 'exact !',
    'player.off': ({ d }) => `à ${d}`,
    'player.yourScore': 'Votre score :',
    'player.correct': ({ gained }) => `Correct ! +${gained}`,
    'player.wrong': 'Faux ✗',
    'player.correctAnswer': 'Bonne réponse :',
    'player.gameOver': '🏁 Partie terminée',
    'player.tiedFor': ({ rank }) => `À égalité pour la #${rank}`,
    'player.youFinished': ({ rank }) => `Vous terminez #${rank}`,
    'player.finalScore': 'Score final :',

    // Creator
    'creator.notJson': "Ce fichier n'est pas du JSON valide.",
    'creator.notQuiz': 'Le JSON ne ressemble pas à un quiz (tableau « questions » manquant).',
    'creator.cantReadFile': 'Impossible de lire ce fichier.',
    'creator.cantReadImage': 'Impossible de lire cette image.',
    'creator.title': '🛠 Créateur de quiz',
    'creator.importJson': '📥 Importer JSON',
    'creator.quizTitle': 'Titre du quiz',
    'creator.sectionHead': '📑 Section',
    'creator.sectionTitle': 'Titre de la section',
    'creator.sectionImage': 'Image de la section',
    'creator.descOptional': 'Description (facultatif)',
    'creator.descPlaceholder': 'Affichée sur tous les écrans',
    'creator.questionNo': ({ n }) => `Question ${n}`,
    'creator.questionPlaceholder': "Texte de la question (facultatif s'il y a une image)",
    'creator.questionImage': 'Image de la question',
    'creator.multipleChoice': 'Choix multiple',
    'creator.numberClosest': 'Nombre (le plus proche gagne)',
    'creator.correctNumber': 'Bonne réponse (nombre)',
    'creator.numberExample': 'ex. 42',
    'creator.choicePlaceholder': ({ letter }) => `Texte du choix ${letter}`,
    'creator.addChoice': '+ Ajouter un choix',
    'creator.pointsOptional': 'Points (facultatif)',
    'creator.pointsDefault': 'défaut',
    'creator.addQuestion': '+ Ajouter une question',
    'creator.addSection': '+ Ajouter une section',
    'creator.exportJson': '⬇ Exporter le quiz (JSON)',
    'creator.exportHint': "Allez ensuite à l'écran Animateur → « Charger un quiz (JSON) » → choisissez ce fichier.",
    'creator.remove': 'retirer',
    'creator.image': 'Image',
    'creator.markCorrect': 'Marquer comme bonne réponse',
    // Creator validation
    'creator.err.needTitle': 'Le quiz a besoin d\'un titre.',
    'creator.err.needQuestion': 'Ajoutez au moins une question.',
    'creator.err.sectionNeeds': ({ i }) => `Section ${i} : besoin d'un titre ou d'une image.`,
    'creator.err.qNeedsText': ({ n }) => `Q${n} : besoin d'un texte de question ou d'une image.`,
    'creator.err.qNeedsNumber': ({ n }) => `Q${n} : besoin d'une réponse numérique.`,
    'creator.err.qNeedsChoices': ({ n }) => `Q${n} : besoin d'au moins 2 choix.`,
    'creator.err.choiceNeeds': ({ n, letter }) => `Q${n} choix ${letter} : besoin de texte ou d'une image.`,
    'creator.err.pointsPositive': ({ n }) => `Q${n} : les points doivent être un nombre positif.`,

    // Gartic — host
    'gartic.logo': '🎨 Gartic Phone',
    'gartic.needTwo': 'Au moins 2 joueurs requis.',
    'gartic.initialPrompt': '✏️ Consigne initiale',
    'gartic.roundDrawing': ({ round }) => `🎨 Manche ${round} : Dessin`,
    'gartic.roundGuessing': ({ round }) => `💭 Manche ${round} : Devinette`,
    'gartic.done': ({ n, total }) => `${n} / ${total} terminé`,
    'gartic.timesUpSuffix': ' · temps écoulé',
    'gartic.nextRound': 'Manche suivante →',
    'gartic.waiting': ({ n, total }) => `En attente… ${n}/${total}`,

    // Gartic — player
    'gartic.youreIn': 'Vous êtes dans la partie ! 🎉',
    'gartic.waitStart': "En attente du démarrage de Gartic Phone par l'animateur…",
    'gartic.followHost': "👀 Suivez sur l'écran de l'animateur",
    'gartic.gettingTask': 'Récupération de votre tâche…',
    'gartic.spectating': '👀 Spectateur',
    'gartic.spectatingHint': "Une partie est déjà en cours — vous rejoindrez la prochaine. Regardez l'écran de l'animateur !",
    'gartic.lockedIn': 'Verrouillé ✅',
    'gartic.waitOthers': 'En attente des autres…',
    'gartic.writeFun': 'Écrivez quelque chose d\'amusant à dessiner et deviner',
    'gartic.promptPlaceholder': 'ex. Un chat sur un skateboard',
    'gartic.drawLabel': ({ prev }) => `Dessinez : ${prev}`,
    'gartic.nothing': '(rien ?)',
    'gartic.submitDrawing': 'Envoyer le dessin',
    'gartic.whatIsThis': "Qu'est-ce que c'est ?",
    'gartic.yourGuess': 'Votre réponse',
    'gartic.submitGuess': 'Envoyer la réponse',

    // Gartic reveal
    'reveal.exactMatch': '🎯 Correspondance exacte !',
    'reveal.celebrate': 'Célébrer !',
    'reveal.storyStep': ({ book, totalBooks, entry, totalEntries }) =>
      `Histoire ${book} / ${totalBooks} · étape ${entry} / ${totalEntries}`,
    'reveal.startedBy': ({ author }) => ` — commencée par ${author}`,
    'reveal.initialPromptBy': ({ author }) => `✏️ Consigne initiale — ${author}`,
    'reveal.noPrompt': '(aucune consigne)',
    'reveal.drew': ({ author }) => `🎨 ${author} a dessiné`,
    'reveal.guessed': ({ author }) => `💭 ${author} a deviné`,
    'reveal.noGuess': '(aucune réponse)',

    // Draw canvas / replay
    'draw.customColor': 'Couleur personnalisée',
    'draw.eraser': 'Gomme',
    'draw.undo': 'Annuler',
    'draw.clear': 'Effacer',
    'draw.noDrawing': '(aucun dessin)',
    'draw.replay': '↻ Rejouer',

    // Fibbage
    'fibbage.logo': '🃏 Fibbage',
    'fibbage.needTwo': 'Au moins 2 joueurs requis.',
    'fibbage.waitStart': "En attente du démarrage de Fibbage par l'animateur…",
    'fibbage.promptXofY': ({ n, total }) => `Énigme ${n} / ${total}`,
    'fibbage.writeLie': 'Complétez le blanc pour piéger tout le monde !',
    'fibbage.liePlaceholder': 'Votre bobard…',
    'fibbage.getSuggestion': '💡 Obtenir une suggestion',
    'fibbage.thatsTheTruth': "C'est la vraie réponse — bravo ! 🎉 Mais entrez autre chose pour piéger les autres !",
    'fibbage.lieLocked': 'Bobard verrouillé ✅',
    'fibbage.submitted': ({ n, total }) => `${n} / ${total} envoyés`,
    'fibbage.toVoting': 'Au vote →',
    'fibbage.waitingSubmit': ({ n, total }) => `En attente… ${n}/${total}`,
    'fibbage.whichTrue': 'Laquelle est la vérité ?',
    'fibbage.pickTrue': 'Choisissez la vraie réponse — 👍 un coup de cœur',
    'fibbage.yourLie': '(votre bobard)',
    'fibbage.thumbHint': "Pouce levé (juste pour le plaisir)",
    'fibbage.lockIn': 'Valider',
    'fibbage.voteLocked': 'Vote verrouillé ✅',
    'fibbage.voted': ({ n, total }) => `${n} / ${total} ont voté`,
    'fibbage.revealResults': 'Révéler les résultats →',
    'fibbage.waitingVote': ({ n, total }) => `En attente… ${n}/${total}`,
    'fibbage.theTruth': '✓ LA VÉRITÉ',
    'fibbage.by': ({ names }) => `— ${names}`,
    'fibbage.nextPrompt': 'Énigme suivante →',
    'fibbage.youGained': ({ n }) => `+${n} points !`,
    'fibbage.noPoints': 'Aucun point ce tour-ci',
    'fibbage.bdGuessed': '🎯 Vous avez trouvé la vérité (+150)',
    'fibbage.bdFooled': ({ n }) => `🤥 Vous avez piégé ${n} joueur${n === 1 ? '' : 's'} (+${n * 100})`,
    'fibbage.bdThumbs': '👍 Le plus de pouces levés (+50)',
    'fibbage.mostUpvoted': ({ name, n }) => `👍 Le plus aimé : ${name} (${n})`,

    // QR
    'qr.noLan': '⚠ Impossible de détecter une IP locale. Connectez ce PC au Wi-Fi/Ethernet pour que les téléphones puissent scanner.',
  },
};

const LangContext = createContext({ lang: 'en', setLang: () => {}, t: (k) => k });

function detectInitial() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && dict[saved]) return saved;
  } catch {
    /* ignore */
  }
  const nav = (typeof navigator !== 'undefined' ? navigator.language || 'en' : 'en').slice(0, 2);
  return dict[nav] ? nav : 'en';
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(detectInitial);
  const setLang = useCallback((l) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);
  const t = useCallback(
    (key, params) => {
      const table = dict[lang] || dict.en;
      const entry = (key in table ? table[key] : dict.en[key]) ?? key;
      return typeof entry === 'function' ? entry(params || {}) : entry;
    },
    [lang]
  );
  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useI18n() {
  return useContext(LangContext);
}

export function useT() {
  return useContext(LangContext).t;
}
