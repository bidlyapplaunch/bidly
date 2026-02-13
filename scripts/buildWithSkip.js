import { spawn } from 'node:child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');

const shouldSkip = process.env.SKIP_ADMIN_BUILD === '1';

if (shouldSkip) {
  console.log('Skipping admin build because SKIP_ADMIN_BUILD=1');
  process.exit(0);
}

console.log('Building admin frontend...');
const buildProcess = spawn('npm', ['run', 'build'], {
  cwd: join(repoRoot, 'auction-admin'),
  shell: true,
  stdio: 'inherit'
});

buildProcess.on('exit', (code) => {
  process.exit(code ?? 0);
});

