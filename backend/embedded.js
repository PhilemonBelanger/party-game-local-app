// DEV STUB — committed placeholder, never overwritten. `npm run bundle` writes the real
// single-file UI + default quiz + Fibbage pool to build/embedded.js, and
// scripts/build-server.mjs swaps that in for this file when bundling the prod server / exe.
// With INDEX_HTML=null the server skips static UI serving (Vite serves it in dev) and
// loads quiz.json / fibbage_prompts.json from disk.
export const INDEX_HTML = null;
export const DEFAULT_QUIZ = { title: 'Trivia', questions: [] };
export const DEFAULT_FIBBAGE = { normal: [], final: [] };
