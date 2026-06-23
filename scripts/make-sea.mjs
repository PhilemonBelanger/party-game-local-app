// Wraps build/server.cjs into a single executable using Node's built-in
// Single Executable Application (SEA) support (Node 20+/stable in 24).
// Produces ./trivia.exe (Windows) or ./trivia (mac/linux) — fully self-contained.
import { execFileSync, execSync } from 'child_process';
import { copyFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const build = join(root, 'build');
if (!existsSync(build)) mkdirSync(build);
if (!existsSync(join(build, 'server.cjs'))) {
  console.error('build/server.cjs missing. Run "npm run build:server" first.');
  process.exit(1);
}

const isWin = process.platform === 'win32';
const outName = isWin ? 'trivia.exe' : 'trivia';
const outPath = join(root, outName);

// 1. SEA config
const seaConfig = join(build, 'sea-config.json');
writeFileSync(
  seaConfig,
  JSON.stringify({
    main: join(build, 'server.cjs'),
    output: join(build, 'sea-prep.blob'),
    disableExperimentalSEAWarning: true,
  })
);

// 2. generate the blob
execFileSync(process.execPath, ['--experimental-sea-config', seaConfig], { stdio: 'inherit' });

// 3. copy the node binary to the target name.
//    Kill any running instance first — a live exe locks the file (EBUSY) and would
//    silently leave the OLD build in place.
try {
  if (isWin) execSync(`taskkill /F /IM ${outName} 2>NUL`, { stdio: 'ignore' });
  else execSync(`pkill -f ${outName} || true`, { stdio: 'ignore' });
} catch {
  /* not running — fine */
}
copyFileSync(process.execPath, outPath);

// 4. inject the blob with postject (fetched via npx). Run through a shell so
//    Windows resolves npx.cmd correctly.
const parts = [
  'npx -y postject',
  `"${outPath}"`,
  'NODE_SEA_BLOB',
  `"${join(build, 'sea-prep.blob')}"`,
  '--sentinel-fuse',
  'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
];
if (process.platform === 'darwin') parts.push('--macho-segment-name NODE_SEA');
execSync(parts.join(' '), { stdio: 'inherit' });

console.log(`\n✅ Built ${outName} — copy it anywhere and double-click to run.`);
console.log('   It serves the game on http://localhost:3001 (and your LAN IP for phones).');
