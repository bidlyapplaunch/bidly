import { spawn } from 'node:child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '../..');
const adminDir = resolve(repoRoot, 'auction-admin');
const backendDir = resolve(__dirname, '..');

console.log('🏗️ Building admin frontend...');
const adminBuild = spawn('npm', ['run', 'build'], {
  cwd: adminDir,
  shell: true,
  stdio: 'inherit'
});

adminBuild.on('exit', (code) => {
  if (code !== 0) {
    console.error('❌ Admin build failed');
    process.exit(code ?? 1);
  }
  
  console.log('✅ Admin build completed');
  console.log('🏗️ Building Remix app...');
  
  const remixBuild = spawn('npm', ['run', 'build'], {
    cwd: repoRoot,
    shell: true,
    stdio: 'inherit'
  });
  
  remixBuild.on('exit', (code) => {
    if (code !== 0) {
      console.error('❌ Remix build failed');
      process.exit(code ?? 1);
    }
    
    console.log('✅ Remix build completed');
    console.log('📦 Installing backend dependencies...');
    
    const backendInstall = spawn('npm', ['install'], {
      cwd: backendDir,
      shell: true,
      stdio: 'inherit'
    });
    
    backendInstall.on('exit', (code) => {
      if (code !== 0) {
        console.error('❌ Backend install failed');
        process.exit(code ?? 1);
      }
      console.log('✅ All builds completed successfully');
      process.exit(0);
    });
  });
});

