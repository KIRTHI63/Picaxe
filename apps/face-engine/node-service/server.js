const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const wasm = require('@tensorflow/tfjs-backend-wasm');
const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');

const ENGINE_DIR = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ENGINE_DIR, '.env');
const MODEL_VERSION = 'vladmandic-face-api-resnet34-128d';
const EMBEDDING_DIM = 128;
const MAX_BODY_BYTES = 35 * 1024 * 1024;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvFile(ENV_PATH);

const config = {
  port: parseInt(process.env.PORT || '8000', 10),
  host: process.env.HOST || '0.0.0.0',
  minFaceFraction: parseFloat(process.env.MIN_FACE_FRACTION || '0.03'),
  blurThreshold: parseFloat(process.env.BLUR_THRESHOLD || '40.0'),
  minBrightness: parseFloat(process.env.MIN_BRIGHTNESS || '25.0'),
  maxBrightness: parseFloat(process.env.MAX_BRIGHTNESS || '240.0'),
  similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD || '0.45'),
  highConfidenceThreshold: parseFloat(process.env.HIGH_CONFIDENCE_THRESHOLD || '0.65'),
  reviewThreshold: parseFloat(process.env.REVIEW_THRESHOLD || '0.45'),
  storagePath: path.join(ENGINE_DIR, 'qdrant_storage', 'face_vectors.json'),
};

let modelLoaded = false;
let inferQueue = Promise.resolve();

/**
 * Serialize WASM TensorFlow inference calls to avoid concurrent tensor state races.
 */
function runSerialized(fn) {
  const next = inferQueue.then(fn, fn);
  inferQueue = next.catch(() => {});
  return next;
}

class VectorStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.entries = new Map();
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        if (Array.isArray(parsed.points)) {
          for (const item of parsed.points) {
            if (item && item.student_id && Array.isArray(item.vector)) {
              this.entries.set(item.student_id, item);
            }
          }
        }
      }
    } catch (err) {
      console.error(`[VectorStore] Failed loading ${this.filePath}: ${err.message}`);
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp`;
    const payload = {
      model_version: MODEL_VERSION,
      embedding_dimension: EMBEDDING_DIM,
      updated_at: new Date().toISOString(),
      points: Array.from(this.entries.values()),
    };
    fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
    fs.renameSync(tmpPath, this.filePath);
  }

  upsert(studentId, descriptor) {
    const existing = this.entries.get(studentId);
    const pointId = existing?.qdrant_point_id || crypto.randomUUID();
    const record = {
      qdrant_point_id: pointId,
      student_id: studentId,
      vector: Array.from(descriptor, (v) => Number(v)),
      model_version: MODEL_VERSION,
      updated_at: new Date().toISOString(),
    };
    this.entries.set(studentId, record);
    this.save();
    return pointId;
  }

  remove(studentId) {
    const deleted = this.entries.delete(studentId);
    if (deleted) this.save();
    return deleted;
  }

  search(queryDescriptor, threshold, limit) {
    const results = [];
    for (const entry of this.entries.values()) {
      const distance = faceapi.euclideanDistance(queryDescriptor, entry.vector);
      const similarity = Math.max(0, Math.min(1, 1 - distance));
      if (similarity >= threshold) {
        results.push({
          student_id: entry.student_id,
          similarity: Number(similarity.toFixed(4)),
          qdrant_point_id: entry.qdrant_point_id,
          euclidean_distance: Number(distance.toFixed(4)),
        });
      }
    }
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  }
}

const vectorStore = new VectorStore(config.storagePath);

function decodeBase64Image(imageBase64) {
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    const err = new Error('Missing image_base64 payload');
    err.errorCode = 'INVALID_IMAGE';
    err.statusCode = 400;
    throw err;
  }
  const commaIdx = imageBase64.indexOf(',');
  const rawB64 = commaIdx !== -1 && imageBase64.slice(0, commaIdx).includes('base64')
    ? imageBase64.slice(commaIdx + 1)
    : imageBase64;

  const buf = Buffer.from(rawB64.trim(), 'base64');
  if (!buf || buf.length < 16) {
    const err = new Error('Image payload is empty or invalid base64');
    err.errorCode = 'IMAGE_CORRUPTED';
    err.statusCode = 400;
    throw err;
  }
  return buf;
}

/**
 * Computes real image quality metrics (blur, brightness, face fraction) on the RGB crop.
 */
function evaluateQuality(rgbBuffer, imgWidth, imgHeight, bbox, enforceFraction = true) {
  const x1 = Math.max(0, Math.min(imgWidth, Math.round(bbox[0])));
  const y1 = Math.max(0, Math.min(imgHeight, Math.round(bbox[1])));
  const x2 = Math.max(0, Math.min(imgWidth, Math.round(bbox[2])));
  const y2 = Math.max(0, Math.min(imgHeight, Math.round(bbox[3])));

  const cropW = x2 - x1;
  const cropH = y2 - y1;
  if (cropW < 4 || cropH < 4 || imgWidth === 0 || imgHeight === 0) {
    return {
      valid: false,
      score: 0,
      blur_score: 0,
      brightness: 0,
      face_fraction: 0,
      reason: 'FACE_TOO_SMALL',
    };
  }

  const gray = new Float64Array(cropW * cropH);
  let brightnessSum = 0;

  for (let row = 0; row < cropH; row++) {
    const srcRowOffset = (y1 + row) * imgWidth * 3;
    const dstRowOffset = row * cropW;
    for (let col = 0; col < cropW; col++) {
      const idx = srcRowOffset + (x1 + col) * 3;
      const lum = 0.299 * rgbBuffer[idx] + 0.587 * rgbBuffer[idx + 1] + 0.114 * rgbBuffer[idx + 2];
      gray[dstRowOffset + col] = lum;
      brightnessSum += lum;
    }
  }

  const pixelCount = cropW * cropH;
  const brightness = brightnessSum / pixelCount;

  // Discrete 4-neighbor Laplacian variance (matching cv2.Laplacian variance)
  let lapSum = 0;
  let lapSqSum = 0;
  let lapCount = 0;
  for (let row = 1; row < cropH - 1; row++) {
    const rowOff = row * cropW;
    for (let col = 1; col < cropW - 1; col++) {
      const i = rowOff + col;
      const lap =
        gray[i - cropW] +
        gray[i + cropW] +
        gray[i - 1] +
        gray[i + 1] -
        4 * gray[i];
      lapSum += lap;
      lapSqSum += lap * lap;
      lapCount++;
    }
  }
  const lapMean = lapCount > 0 ? lapSum / lapCount : 0;
  const blurScore = lapCount > 0 ? Math.max(0, lapSqSum / lapCount - lapMean * lapMean) : 0;
  const faceFraction = (cropW * cropH) / (imgWidth * imgHeight);

  const blurNorm = Math.min(blurScore / 300.0, 1.0);
  const brightnessNorm = Math.max(0.0, 1.0 - Math.abs(brightness - 128.0) / 128.0);
  const fractionNorm = Math.min(faceFraction / 0.2, 1.0);
  const compositeScore = Number(
    Math.max(0, Math.min(1, 0.5 * blurNorm + 0.3 * brightnessNorm + 0.2 * fractionNorm)).toFixed(4),
  );

  const metrics = {
    valid: true,
    score: compositeScore,
    blur_score: Number(blurScore.toFixed(2)),
    brightness: Number(brightness.toFixed(2)),
    face_fraction: Number(faceFraction.toFixed(4)),
    reason: null,
  };

  if (enforceFraction && faceFraction < config.minFaceFraction) {
    return { ...metrics, valid: false, reason: 'FACE_TOO_SMALL' };
  }
  if (blurScore < config.blurThreshold) {
    return { ...metrics, valid: false, reason: 'IMAGE_TOO_BLURRY' };
  }
  if (brightness < config.minBrightness) {
    return { ...metrics, valid: false, reason: 'IMAGE_TOO_DARK' };
  }
  if (brightness > config.maxBrightness) {
    return { ...metrics, valid: false, reason: 'IMAGE_TOO_BRIGHT' };
  }
  return metrics;
}

function zeroQuality(reason) {
  return {
    valid: false,
    score: 0,
    blur_score: 0,
    brightness: 0,
    face_fraction: 0,
    reason,
  };
}

function classifyTier(similarity) {
  if (similarity >= config.highConfidenceThreshold) return 'HIGH_CONFIDENCE';
  if (similarity >= config.reviewThreshold) return 'REVIEW';
  return 'DISCARD';
}

async function analyzeImage(imageBuffer, minConfidence = 0.48, maxResults = 25) {
  let info;
  let data;
  try {
    const decoded = await sharp(imageBuffer)
      .rotate() // Respect EXIF camera orientation on mobile portraits
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    data = decoded.data;
    info = decoded.info;
  } catch (err) {
    const e = new Error(`Image is corrupted and cannot be decoded: ${err.message}`);
    e.errorCode = 'IMAGE_CORRUPTED';
    e.statusCode = 400;
    throw e;
  }

  return runSerialized(async () => {
    const tensor = faceapi.tf.tensor3d(new Int32Array(data), [info.height, info.width, 3], 'int32');
    try {
      const options = new faceapi.SsdMobilenetv1Options({ minConfidence, maxResults });
      const detections = await faceapi
        .detectAllFaces(tensor, options)
        .withFaceLandmarks()
        .withFaceDescriptors();

      const faces = detections.map((det) => {
        const box = det.detection.box;
        const x1 = Math.max(0, Math.round(box.x));
        const y1 = Math.max(0, Math.round(box.y));
        const x2 = Math.min(info.width, Math.round(box.x + box.width));
        const y2 = Math.min(info.height, Math.round(box.y + box.height));
        return {
          bbox: [x1, y1, x2, y2],
          detectionConfidence: Number(det.detection.score.toFixed(4)),
          descriptor: Array.from(det.descriptor),
        };
      });

      return { width: info.width, height: info.height, rgbBuffer: data, faces };
    } finally {
      tensor.dispose();
    }
  });
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        const err = new Error('Request payload exceeds maximum allowed size');
        err.errorCode = 'IMAGE_TOO_LARGE';
        err.statusCode = 413;
        reject(err);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text ? JSON.parse(text) : {});
      } catch {
        const err = new Error('Malformed JSON request body');
        err.errorCode = 'INVALID_IMAGE';
        err.statusCode = 400;
        reject(err);
      }
    });
    req.on('error', (err) => reject(err));
  });
}

function qualityFailureDetail(quality) {
  switch (quality.reason) {
    case 'FACE_TOO_SMALL':
      return `Face occupies only ${(quality.face_fraction * 100).toFixed(1)}% of the frame (minimum ${(config.minFaceFraction * 100).toFixed(1)}%). Move closer to the camera.`;
    case 'IMAGE_TOO_BLURRY':
      return `Image is too blurry (sharpness score ${quality.blur_score}, minimum ${config.blurThreshold}). Hold steady in better lighting.`;
    case 'IMAGE_TOO_DARK':
      return `Image is too dark (brightness ${quality.brightness}, minimum ${config.minBrightness}).`;
    case 'IMAGE_TOO_BRIGHT':
      return `Image is overexposed (brightness ${quality.brightness}, maximum ${config.maxBrightness}).`;
    default:
      return 'Face quality check failed.';
  }
}

async function handleRequest(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  if (req.method === 'GET' && (pathname === '/' || pathname === '/health')) {
    sendJson(res, 200, {
      status: modelLoaded ? 'ok' : 'loading',
      service: 'face-recognition-engine',
      engine: 'vladmandic-face-api-wasm',
      model_version: MODEL_VERSION,
      embedding_dimension: EMBEDDING_DIM,
      model_loaded: modelLoaded,
      qdrant_connected: true,
      indexed_faces: vectorStore.entries.size,
    });
    return;
  }

  if (!modelLoaded) {
    sendJson(res, 503, {
      success: false,
      error_code: 'MODEL_UNAVAILABLE',
      detail: 'Face recognition neural networks are still initializing',
    });
    return;
  }

  try {
    if (req.method === 'DELETE' && pathname.startsWith('/face/register/')) {
      const studentId = decodeURIComponent(pathname.slice('/face/register/'.length));
      const deleted = vectorStore.remove(studentId);
      sendJson(res, 200, { success: true, student_id: studentId, deleted });
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 404, { success: false, error_code: 'NOT_FOUND', detail: `Route ${pathname} not found` });
      return;
    }

    const body = await readJsonBody(req);
    const imgBuf = decodeBase64Image(body.image_base64);

    if (pathname === '/face/quality-check') {
      const analyzed = await analyzeImage(imgBuf, 0.48, 10);
      if (analyzed.faces.length === 0) {
        sendJson(res, 200, { face_count: 0, quality: zeroQuality('NO_FACE_DETECTED') });
        return;
      }
      const primary = analyzed.faces[0];
      const quality = evaluateQuality(analyzed.rgbBuffer, analyzed.width, analyzed.height, primary.bbox, true);
      if (analyzed.faces.length > 1) {
        quality.valid = false;
        quality.reason = 'TOO_MANY_FACES';
      }
      sendJson(res, 200, { face_count: analyzed.faces.length, quality });
      return;
    }

    if (pathname === '/face/register') {
      const studentId = body.student_id;
      if (!studentId || typeof studentId !== 'string') {
        sendJson(res, 400, {
          success: false,
          error_code: 'INVALID_REQUEST',
          detail: 'student_id is required',
        });
        return;
      }

      const analyzed = await analyzeImage(imgBuf, 0.5, 10);

      if (analyzed.faces.length === 0) {
        sendJson(res, 422, {
          success: false,
          student_id: studentId,
          qdrant_point_id: null,
          model_version: MODEL_VERSION,
          embedding_dimension: EMBEDDING_DIM,
          quality: zeroQuality('NO_FACE_DETECTED'),
          error_code: 'NO_FACE_DETECTED',
          detail: 'No human face was detected. Please upload a clear front-facing photo.',
        });
        return;
      }

      if (analyzed.faces.length > 1) {
        const primary = analyzed.faces[0];
        const quality = evaluateQuality(analyzed.rgbBuffer, analyzed.width, analyzed.height, primary.bbox, true);
        quality.valid = false;
        quality.reason = 'TOO_MANY_FACES';
        sendJson(res, 422, {
          success: false,
          student_id: studentId,
          qdrant_point_id: null,
          model_version: MODEL_VERSION,
          embedding_dimension: EMBEDDING_DIM,
          quality,
          error_code: 'TOO_MANY_FACES',
          detail: `Detected ${analyzed.faces.length} faces in the image. Please upload a solo selfie with only your face.`,
        });
        return;
      }

      const face = analyzed.faces[0];
      const quality = evaluateQuality(analyzed.rgbBuffer, analyzed.width, analyzed.height, face.bbox, true);
      if (!quality.valid) {
        sendJson(res, 422, {
          success: false,
          student_id: studentId,
          qdrant_point_id: null,
          model_version: MODEL_VERSION,
          embedding_dimension: EMBEDDING_DIM,
          quality,
          error_code: quality.reason,
          detail: qualityFailureDetail(quality),
        });
        return;
      }

      const qdrantPointId = vectorStore.upsert(studentId, face.descriptor);
      sendJson(res, 200, {
        success: true,
        student_id: studentId,
        qdrant_point_id: qdrantPointId,
        model_version: MODEL_VERSION,
        embedding_dimension: EMBEDDING_DIM,
        quality,
        error_code: null,
        detail: null,
      });
      return;
    }

    if (pathname === '/face/embed') {
      const analyzed = await analyzeImage(imgBuf, 0.5, 5);
      if (analyzed.faces.length === 0) {
        sendJson(res, 422, {
          success: false,
          error_code: 'NO_FACE_DETECTED',
          detail: 'No face detected to extract embedding from',
        });
        return;
      }
      sendJson(res, 200, { embedding: analyzed.faces[0].descriptor });
      return;
    }

    if (pathname === '/face/search-event') {
      const scoreThreshold = typeof body.score_threshold === 'number'
        ? body.score_threshold
        : config.similarityThreshold;
      const limitPerFace = typeof body.limit_per_face === 'number' ? body.limit_per_face : 5;

      const analyzed = await analyzeImage(imgBuf, 0.45, 25);
      const faces = analyzed.faces.map((face, index) => {
        const quality = evaluateQuality(analyzed.rgbBuffer, analyzed.width, analyzed.height, face.bbox, false);
        const matches = vectorStore.search(face.descriptor, scoreThreshold, limitPerFace).map((m) => ({
          student_id: m.student_id,
          similarity: m.similarity,
          confidence_tier: classifyTier(m.similarity),
          qdrant_point_id: m.qdrant_point_id,
        }));

        return {
          face_index: index,
          bbox: face.bbox,
          detection_confidence: face.detectionConfidence,
          quality,
          matches,
        };
      });

      sendJson(res, 200, {
        total_faces_detected: faces.length,
        faces,
      });
      return;
    }

    if (pathname === '/face/search') {
      const scoreThreshold = typeof body.score_threshold === 'number'
        ? body.score_threshold
        : config.similarityThreshold;
      const limit = typeof body.limit === 'number' ? body.limit : 10;

      const analyzed = await analyzeImage(imgBuf, 0.45, 25);
      const bestByStudent = new Map();
      for (const face of analyzed.faces) {
        for (const match of vectorStore.search(face.descriptor, scoreThreshold, limit)) {
          const prev = bestByStudent.get(match.student_id) || 0;
          if (match.similarity > prev) bestByStudent.set(match.student_id, match.similarity);
        }
      }
      const matches = Array.from(bestByStudent.entries())
        .map(([student_id, score]) => ({ student_id, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      sendJson(res, 200, { matches });
      return;
    }

    sendJson(res, 404, { success: false, error_code: 'NOT_FOUND', detail: `Route ${pathname} not found` });
  } catch (err) {
    const status = err.statusCode || 500;
    const errorCode = err.errorCode || 'INTERNAL_SERVER_ERROR';
    console.error(`[FaceEngine] ${req.method} ${pathname} error (${errorCode}): ${err.message}`);
    sendJson(res, status, {
      success: false,
      error_code: errorCode,
      detail: err.message,
    });
  }
}

async function bootstrap() {
  const wasmPath = require.resolve('@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm.wasm');
  wasm.setWasmPaths(path.dirname(wasmPath) + path.sep);
  await faceapi.tf.setBackend('wasm');
  await faceapi.tf.ready();

  const fapiPkgDir = path.dirname(require.resolve('@vladmandic/face-api/package.json'));
  const modelDir = path.join(fapiPkgDir, 'model');
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelDir);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(modelDir);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(modelDir);

  modelLoaded = true;

  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      console.error('[FaceEngine] Unhandled error:', err);
      sendJson(res, 500, {
        success: false,
        error_code: 'INTERNAL_SERVER_ERROR',
        detail: err.message,
      });
    });
  });

  server.listen(config.port, config.host, () => {
    console.log(
      `[FaceEngine] Listening on http://${config.host}:${config.port} (backend=${faceapi.tf.getBackend()}, model=${MODEL_VERSION}, indexed=${vectorStore.entries.size})`,
    );
  });
}

bootstrap().catch((err) => {
  console.error('[FaceEngine] Fatal startup error:', err);
  process.exit(1);
});
