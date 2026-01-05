import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..', '..');

const shouldSkip = process.env.SKIP_REMIX_BUILD === '1';

if (shouldSkip) {
  console.log('Skipping Remix build because SKIP_REMIX_BUILD=1');
  process.exit(0);
}

console.log('🏗️ Running "npm run build" from repo root to refresh Remix bundle…');

const child = spawn('npm', ['run', 'build'], {
  cwd: repoRoot,
  shell: true,
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

