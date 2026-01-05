import { spawn } from 'node:child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..', '..');
const shouldSkip = process.env.SKIP_PRISMA_MIGRATE === '1';

if (shouldSkip) {
  console.log('Skipping Prisma migrate because SKIP_PRISMA_MIGRATE=1');
  process.exit(0);
}

console.log('🗄️ Ensuring Prisma session table exists via migrate deploy…');

const child = spawn('npx', ['prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'], {
  cwd: repoRoot,
  shell: true,
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

