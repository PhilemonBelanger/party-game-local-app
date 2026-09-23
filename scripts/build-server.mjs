// Bundles the backend (+ embedded UI + all node_modules) into one self-contained
// CommonJS file: build/server.cjs. Runnable with `node build/server.cjs`, and the
// input that Node SEA turns into a single exe.
import { build } from 'esbuild';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const generated = join(root, 'build', 'embedded.js');
if (!existsSync(generated)) {
  console.error(`Missing ${generated}. Run "npm run bundle" first.`);
  process.exit(1);
}

// server.js imports ./embedded.js — the committed dev stub. Resolve it to the generated
// build/embedded.js (real UI + default quiz + Fibbage pool) instead, so the stub never changes.
const embedGenerated = {
  name: 'embed-generated',
  setup(b) {
    b.onResolve({ filter: /^\.\/embedded\.js$/ }, () => ({ path: generated }));
  },
};

await build({
  plugins: [embedGenerated],
  entryPoints: [join(root, 'backend', 'server.js')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: join(root, 'build', 'server.cjs'),
  // optional native speedups for ws — absent is fine, socket.io uses JS fallbacks
  external: ['bufferutil', 'utf-8-validate'],
  logLevel: 'info',
});

console.log('build/server.cjs written');
