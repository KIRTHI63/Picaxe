const http = require('http');

function makeRequest(url, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runPipelineHealthCheck() {
  console.log('\n======================================================');
  console.log('🔍 PICAXE REAL 4-SERVICE HEALTH CHECK');
  console.log('======================================================\n');

  let faceOk = false;
  let nlpOk = false;
  let backendOk = false;
  let frontendOk = false;

  try {
    const health = await makeRequest('http://localhost:8000/health');
    if (health.status === 200) {
      faceOk = true;
      console.log(`✅ 1. FACE ENGINE (:8000): ${health.data.status} — model_loaded=${health.data.model_loaded}, qdrant=${health.data.qdrant_connected}`);
    } else {
      console.log(`⚠️ 1. FACE ENGINE (:8000): HTTP ${health.status}`);
    }
  } catch (err) {
    console.log(`❌ 1. FACE ENGINE (:8000): OFFLINE (${err.message})`);
  }

  try {
    const health = await makeRequest('http://localhost:8001/health');
    if (health.status === 200) {
      nlpOk = true;
      console.log(`✅ 2. NLP ENGINE (:8001): ${health.data.status} — ${health.data.service}`);
    } else {
      console.log(`⚠️ 2. NLP ENGINE (:8001): HTTP ${health.status}`);
    }
  } catch (err) {
    console.log(`❌ 2. NLP ENGINE (:8001): OFFLINE (${err.message})`);
  }

  try {
    const res = await makeRequest('http://localhost:3001/auth/me');
    backendOk = res.status === 401 || res.status === 200;
    console.log(`✅ 3. BACKEND GATEWAY (:3001): ONLINE (HTTP ${res.status})`);
  } catch (err) {
    console.log(`❌ 3. BACKEND GATEWAY (:3001): OFFLINE (${err.message})`);
  }

  try {
    const res = await makeRequest('http://localhost:3000/');
    frontendOk = res.status === 200;
    console.log(`✅ 4. FRONTEND (:3000): ONLINE (HTTP ${res.status})`);
  } catch (err) {
    console.log(`❌ 4. FRONTEND (:3000): OFFLINE (${err.message})`);
  }

  console.log('\n======================================================');
  console.log(
    faceOk && nlpOk && backendOk && frontendOk
      ? '🎉 ALL 4 REAL SERVICES ARE RUNNING TOGETHER!'
      : 'ℹ️ Start missing services with npm run dev:face / dev:nlp / dev:backend / dev:frontend'
  );
  console.log('======================================================\n');
}

runPipelineHealthCheck();
