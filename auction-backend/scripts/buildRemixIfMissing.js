import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..', '..');
const serverBuild = path.resolve(repoRoot, 'build', 'server', 'index.js');
const clientAssets = path.resolve(repoRoot, 'build', 'client', 'assets');

const hasBuild = existsSync(serverBuild) && existsSync(clientAssets);

if (process.env.SKIP_REMIX_BUILD === '1') {
  console.log('Skipping Remix build because SKIP_REMIX_BUILD=1');
  process.exit(0);
}

if (hasBuild) {
  console.log('✅ Remix build already present, skipping build:', serverBuild);
  process.exit(0);
}

console.log('🏗️ Remix build missing. Installing root deps and building…');

const env = {
  ...process.env,
  NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --max_old_space_size=2048`.trim(),
};

const install = spawnSync('npm', ['install', '--production=false'], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: true,
  env,
});
if (install.status !== 0) {
  process.exit(install.status ?? 1);
}

const build = spawnSync('npm', ['run', 'build'], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: true,
  env,
});
process.exit(build.status ?? 0);


