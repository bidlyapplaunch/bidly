/**
 * Runs `shopify app deploy` with a fresh theme asset cache buster each time.
 * Replaces __BIDLY_ASSET_VERSION__ in auction-app-embed.liquid with Date.now(),
 * deploys, then restores the placeholder so the repo stays stable.
 *
 * Usage: npm run deploy -- [--force] [--config shopify.app.bidly.toml] ...
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LIQUID = path.join(
  ROOT,
  'extensions',
  'theme-app-extension',
  'blocks',
  'auction-app-embed.liquid'
);
const PLACEHOLDER = '__BIDLY_ASSET_VERSION__';

function main() {
  let original;
  try {
    original = fs.readFileSync(LIQUID, 'utf8');
  } catch (e) {
    console.error('Failed to read auction-app-embed.liquid:', e.message);
    process.exit(1);
  }

  if (!original.includes(PLACEHOLDER)) {
    console.warn(
      `Warning: "${PLACEHOLDER}" not found in auction-app-embed.liquid; deploying without cache bump.`
    );
  }

  const version = String(Date.now());
  fs.writeFileSync(LIQUID, original.split(PLACEHOLDER).join(version), 'utf8');

  const deployArgs = process.argv.slice(2);
  const result = spawnSync('npx', ['shopify', 'app', 'deploy', ...deployArgs], {
    stdio: 'inherit',
    cwd: ROOT,
    shell: true,
    env: process.env,
  });

  try {
    fs.writeFileSync(LIQUID, original, 'utf8');
  } catch (e) {
    console.error('Could not restore auction-app-embed.liquid:', e.message);
    console.error(`Manually restore "${PLACEHOLDER}" in:`, LIQUID);
    process.exit(result.status !== 0 ? result.status : 1);
  }

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  process.exit(result.status === null ? 1 : result.status);
}

main();
