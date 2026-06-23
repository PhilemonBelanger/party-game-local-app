// Bundles the backend (+ embedded UI + all node_modules) into one self-contained
// CommonJS file: build/server.cjs. Runnable with `node build/server.cjs`, and the
// input that Node SEA turns into a single exe.
import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

await build({
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
