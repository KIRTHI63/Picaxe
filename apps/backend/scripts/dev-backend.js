const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

const backendDir = path.resolve(__dirname, '..');
const envPath = path.join(backendDir, '.env');
const localDbUrlFile = path.join(backendDir, '.local-db-url');
const pgDataDir = path.join(backendDir, 'pgdata');

function loadEnv() {
  const env = { ...process.env };
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in env)) {
        env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  }
  return env;
}

function testTcp(host, port, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: timeoutMs }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function findFreePort(startPort = 5432) {
  for (let p = startPort; p < startPort + 20; p++) {
    const taken = await testTcp('127.0.0.1', p, 300);
    if (!taken) return p;
  }
  return 0;
}

function runCommandAsync(cmd, args, cwd, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, env, stdio: 'inherit', shell: true });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}`))));
    child.on('error', reject);
  });
}

async function main() {
  const env = loadEnv();
  let useLocalFallback = env.PICAXE_LOCAL_DB === '1';

  if (!useLocalFallback && env.DATABASE_URL) {
    try {
      const parsed = new URL(env.DATABASE_URL);
      const host = parsed.hostname;
      const port = parseInt(parsed.port || '5432', 10);
      const isLocal = host === 'localhost' || host === '127.0.0.1';
      if (!isLocal) {
        const reachable = await testTcp(host, port, 3000);
        if (reachable) {
          console.log(`[backend] Remote PostgreSQL reachable at ${host}:${port}`);
          if (fs.existsSync(localDbUrlFile)) fs.unlinkSync(localDbUrlFile);
        } else {
          console.warn(`[backend] Remote PostgreSQL unreachable at ${host}:${port} (network/firewall blocked).`);
          useLocalFallback = true;
        }
      }
    } catch (err) {
      console.warn(`[backend] Could not parse DATABASE_URL (${err.message}); falling back to local PostgreSQL.`);
      useLocalFallback = true;
    }
  } else if (!env.DATABASE_URL) {
    useLocalFallback = true;
  }

  let db = null;
  let socketServer = null;

  if (useLocalFallback) {
    const { PGlite } = require('@electric-sql/pglite');
    const { PGLiteSocketServer } = require('@electric-sql/pglite-socket');

    fs.mkdirSync(pgDataDir, { recursive: true });
    const port = await findFreePort(5432);
    db = await PGlite.create(pgDataDir);
    socketServer = new PGLiteSocketServer({
      db,
      host: '127.0.0.1',
      port,
      maxConnections: 10,
    });
    await socketServer.start();

    const localUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable&connection_limit=1&pgbouncer=true`;
    env.DATABASE_URL = localUrl;
    fs.writeFileSync(localDbUrlFile, localUrl, 'utf8');
    console.log(`[backend] Started persistent local PostgreSQL (PGlite) on 127.0.0.1:${port} (data: apps/backend/pgdata)`);

    const regCheck = await db.query("SELECT to_regclass('public.users') AS tbl");
    if (!regCheck.rows?.[0]?.tbl) {
      console.log('[backend] Initializing PostgreSQL schema via prisma db push...');
      await runCommandAsync('npx', ['prisma', 'db', 'push', '--skip-generate'], backendDir, env);
    }
  }

  const nestChild = spawn('npx', ['nest', 'start', '--watch'], {
    cwd: backendDir,
    env,
    stdio: 'inherit',
    shell: true,
  });

  const cleanup = async (code = 0) => {
    try {
      if (nestChild && !nestChild.killed) nestChild.kill();
    } catch {}
    try {
      if (socketServer) await socketServer.stop();
    } catch {}
    try {
      if (db) await db.close();
    } catch {}
    process.exit(code);
  };

  nestChild.on('exit', (code) => {
    cleanup(code ?? 0);
  });

  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => cleanup(0));
  }
}

main().catch((err) => {
  console.error('[backend] Fatal startup error:', err);
  process.exit(1);
});
