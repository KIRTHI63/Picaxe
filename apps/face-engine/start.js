const { spawnSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '../..');
const faceDir = __dirname;
const venvPython = process.platform === 'win32'
  ? path.join(repoRoot, '.venv-ai', 'Scripts', 'python.exe')
  : path.join(repoRoot, '.venv-ai', 'bin', 'python');
const venvUvicorn = process.platform === 'win32'
  ? path.join(repoRoot, '.venv-ai', 'Scripts', 'uvicorn.exe')
  : path.join(repoRoot, '.venv-ai', 'bin', 'uvicorn');

function hasPythonInsightFace() {
  if (!fs.existsSync(venvPython) || !fs.existsSync(venvUvicorn)) return false;
  const check = spawnSync(
    venvPython,
    ['-c', 'import insightface, cv2, fastapi, qdrant_client'],
    { cwd: faceDir, stdio: 'ignore' },
  );
  return check.status === 0;
}

const usePython = process.env.FACE_ENGINE_RUNTIME === 'python' || hasPythonInsightFace();

let child;
if (usePython) {
  console.log('[face-engine] Starting Python InsightFace runtime on port 8000...');
  child = spawn(venvUvicorn, ['main:app', '--host', '0.0.0.0', '--port', '8000'], {
    cwd: faceDir,
    stdio: 'inherit',
  });
} else {
  const serverPath = path.join(faceDir, 'node-service', 'server.js');
  const nodeModulesPath = path.join(faceDir, 'node-service', 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    console.error('[face-engine] Missing node-service/node_modules. Run: npm --prefix apps/face-engine/node-service install');
    process.exit(1);
  }
  console.log('[face-engine] Starting FaceNet WASM runtime on port 8000...');
  child = spawn(process.execPath, [serverPath], {
    cwd: faceDir,
    stdio: 'inherit',
  });
}

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (!child.killed) child.kill(sig);
  });
}
