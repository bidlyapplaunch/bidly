import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..', '..');
const remixBuildPath = path.resolve(repoRoot, 'build', 'server', 'index.js');

const shouldSkip = process.env.SKIP_REMIX_BUILD === '1';

if (shouldSkip) {
  console.log('Skipping Remix build because SKIP_REMIX_BUILD=1');
  process.exit(0);
}

if (existsSync(remixBuildPath)) {
  console.log('✅ Remix build already present at:', remixBuildPath);
  process.exit(0);
}

console.log('🏗️ Remix build not found. Running "npm run build" from repo root…');

const child = spawn('npm', ['run', 'build'], {
  cwd: repoRoot,
  shell: true,
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

