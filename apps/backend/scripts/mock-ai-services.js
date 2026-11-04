const http = require('http');

// Helper to parse JSON body
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

// ---------------------------------------------------------------------
// 1. Mock Face Engine (Port 8000)
// Conforms to docs/contracts/backend-face-engine.md
// ---------------------------------------------------------------------
const faceServer = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return sendJson(res, 204, {});
  }

  const url = req.url || '';

  // GET /health
  if (req.method === 'GET' && (url === '/health' || url === '/')) {
    return sendJson(res, 200, {
      status: 'ok',
      service: 'Picaxe Mock Face Engine',
      port: 8000,
      active: true,
      features: ['/face/embed', '/face/search'],
    });
  }

  // POST /face/embed (512-dim embedding)
  if (req.method === 'POST' && (url === '/face/embed' || url === '/ai/face/embed')) {
    await parseJsonBody(req);
    // Generate deterministic 512-dimensional float vector
    const embedding = Array.from({ length: 512 }, (_, i) =>
      Number((Math.sin(i + 1) * 0.05).toFixed(4))
    );
    console.log('[Face Engine :8000] Generated 512-dim face embedding');
    return sendJson(res, 200, { embedding });
  }

  // POST /face/search (matches detected face with student)
  if (req.method === 'POST' && (url === '/face/search' || url === '/ai/face/search')) {
    await parseJsonBody(req);
    // Returns high-confidence match for registered student Kirthi Vasan
    const matches = [
      {
        student_id: 'fd4a8d9d-dc24-41ee-ad26-4e9270d3e969', // Kirthi Vasan StudentProfile ID
        score: 0.94,
      },
    ];
    console.log('[Face Engine :8000] Face searched -> Matched student Kirthi Vasan (score: 0.94)');
    return sendJson(res, 200, { matches });
  }

  sendJson(res, 404, { error: 'Not Found' });
});

// ---------------------------------------------------------------------
// 2. Mock NLP Engine (Port 8001)
// Conforms to docs/contracts/backend-nlp-engine.md
// ---------------------------------------------------------------------
const nlpServer = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return sendJson(res, 204, {});
  }

  const url = req.url || '';

  // GET /health
  if (req.method === 'GET' && (url === '/health' || url === '/')) {
    return sendJson(res, 200, {
      status: 'ok',
      service: 'Picaxe Mock NLP Engine',
      port: 8001,
      active: true,
      features: ['/certificate/ocr', '/certificate/extract-name', '/certificate/analyze'],
    });
  }

  // POST /certificate/ocr
  if (req.method === 'POST' && url === '/certificate/ocr') {
    await parseJsonBody(req);
    console.log('[NLP Engine :8001] OCR performed on certificate');
    return sendJson(res, 200, {
      raw_text: 'Certificate of Excellence presented to Kirthi Vasan for outstanding performance in Hackathon.',
      confidence: 0.97,
    });
  }

  // POST /certificate/extract-name
  if (req.method === 'POST' && url === '/certificate/extract-name') {
    await parseJsonBody(req);
    console.log('[NLP Engine :8001] Extracted name: Kirthi Vasan');
    return sendJson(res, 200, {
      extracted_name: 'Kirthi Vasan',
      confidence: 0.95,
    });
  }

  // POST /certificate/analyze
  if (req.method === 'POST' && url === '/certificate/analyze') {
    const body = await parseJsonBody(req);
    const targetName = body.target_name || 'Kirthi Vasan';
    console.log(`[NLP Engine :8001] Analyzed certificate -> Matched "${targetName}" (score: 0.95)`);
    return sendJson(res, 200, {
      raw_text: `Certificate of Excellence presented to ${targetName} for outstanding performance in Hackathon.`,
      extracted_name: targetName,
      match_score: 0.95,
    });
  }

  sendJson(res, 404, { error: 'Not Found' });
});

// Start both servers
faceServer.listen(8000, '0.0.0.0', () => {
  console.log('🤖 [Picaxe Face Engine Mock] Running at http://localhost:8000');
});

nlpServer.listen(8001, '0.0.0.0', () => {
  console.log('📄 [Picaxe NLP Engine Mock]  Running at http://localhost:8001');
});
