const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const backendDir = path.resolve(__dirname, '..');
const localDbUrlFile = path.join(backendDir, '.local-db-url');
const envFile = path.join(backendDir, '.env');

const env = { ...process.env };

if (fs.existsSync(localDbUrlFile)) {
  const localUrl = fs.readFileSync(localDbUrlFile, 'utf8').trim();
  if (localUrl) {
    env.DATABASE_URL = localUrl;
    console.log('[studio] Connecting Prisma Studio to active local database (127.0.0.1:5432)...');
  }
} else if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in env)) {
      env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  console.log('[studio] Connecting Prisma Studio to database in .env...');
}

const child = spawn(
  'npx',
  ['prisma', 'studio', '--schema', path.join(backendDir, 'prisma', 'schema.prisma'), '--port', '5555'],
  {
    cwd: backendDir,
    env,
    stdio: 'inherit',
    shell: true,
  },
);

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (!child.killed) child.kill(sig);
  });
}
