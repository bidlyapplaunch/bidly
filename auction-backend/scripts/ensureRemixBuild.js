import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..', '..');
const remixBuildPath = path.resolve(repoRoot, 'build', 'server', 'index.js');

const shouldSkip = process.env.SKIP_REMIX_BUILD === '1';

if (shouldSkip) {
  console.log('Skipping Remix build because SKIP_REMIX_BUILD=1');
  process.exit(0);
}

// If a build already exists, don't rebuild at runtime (avoids Render OOM)
if (existsSync(remixBuildPath)) {
  console.log('✅ Remix build already present at:', remixBuildPath);
  process.exit(0);
}

// Ensure React Router CLI is available (Render may install only backend deps)
const reactRouterBin = path.join(repoRoot, 'node_modules', '.bin', 'react-router');
if (!existsSync(reactRouterBin)) {
  console.log('📦 Installing root dependencies so React Router CLI is available…');
  const installResult = spawnSync('npm', ['install', '--production=false'], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: true,
  });
  if (installResult.status !== 0) {
    console.error('❌ npm install failed in repo root');
    process.exit(installResult.status ?? 1);
  }
}

console.log('🏗️ Running "npm run build" from repo root to refresh Remix bundle…');

const child = spawn('npm', ['run', 'build'], {
  cwd: repoRoot,
  shell: true,
  stdio: 'inherit',
  env: {
    ...process.env,
    // Render default heap can be small; bump it for the build process
    NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --max_old_space_size=2048`.trim(),
  },
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

