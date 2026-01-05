import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..', '..');
const remixBuildPath = path.resolve(repoRoot, 'build', 'server', 'index.js');

console.log(
  'ensureRemixBuild.js is no longer used in production startup. ' +
  'Build the Remix app during CI/build and deploy the built assets.',
);
process.exit(0);

