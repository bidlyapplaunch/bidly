import { spawn } from 'node:child_process';

const shouldSkip = process.env.SKIP_ADMIN_BUILD === '1';

if (shouldSkip) {
  console.log('Skipping admin build because SKIP_ADMIN_BUILD=1');
  process.exit(0);
}

console.log('Running admin build (set SKIP_ADMIN_BUILD=1 to skip)…');

const child = spawn('npm', ['run', 'build-admin'], {
  shell: true,
  stdio: 'inherit'
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

