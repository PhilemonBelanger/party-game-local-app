// DEV STUB — committed placeholder. The build (`npm run bundle`) overwrites this with
// the real single-file UI + default quiz for prod/exe; restore this stub afterward so
// dev never serves a stale UI. With INDEX_HTML=null the server skips static UI serving
// (Vite serves it in dev) and falls back to quiz.json on disk for the default quiz.
export const INDEX_HTML = null;
export const DEFAULT_QUIZ = { title: 'Trivia', questions: [] };
