import { spawn } from 'node:child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');

// The standalone `auction-admin` dashboard is an unrelated codebase that is
// deployed separately. The Shopify/Remix app build must NOT depend on it, so we
// skip it by default. Opt in explicitly with BUILD_ADMIN=1 if you really want
// this script to also build auction-admin.
const shouldBuildAdmin = process.env.BUILD_ADMIN === '1';

if (!shouldBuildAdmin) {
  console.log('Skipping auction-admin build (set BUILD_ADMIN=1 to include it).');
  process.exit(0);
}

console.log('Building auction-admin frontend...');
const buildProcess = spawn('npm', ['run', 'build'], {
  cwd: join(repoRoot, 'auction-admin'),
  shell: true,
  stdio: 'inherit'
});

buildProcess.on('exit', (code) => {
  process.exit(code ?? 0);
});
