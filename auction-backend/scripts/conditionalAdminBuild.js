import { spawn } from 'node:child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '../..');
const adminDir = resolve(repoRoot, 'auction-admin');
const customerDir = resolve(repoRoot, 'auction-customer');

const shouldSkip = process.env.SKIP_ADMIN_BUILD === '1';

if (shouldSkip) {
  console.log('Skipping admin & customer build because SKIP_ADMIN_BUILD=1');
  process.exit(0);
}

console.log('Running admin build (set SKIP_ADMIN_BUILD=1 to skip)…');

const adminBuild = spawn('npm', ['run', 'build-admin'], {
  shell: true,
  stdio: 'inherit'
});

adminBuild.on('exit', (code) => {
  if (code !== 0) process.exit(code ?? 1);
  console.log('Running customer marketplace build…');
  const customerBuild = spawn('npm', ['run', 'build'], {
    cwd: customerDir,
    shell: true,
    stdio: 'inherit'
  });
  customerBuild.on('exit', (custCode) => {
    process.exit(custCode ?? 0);
  });
});

