import assert from 'node:assert/strict';
import { createServer } from 'node:http';

process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'smoke-gemini-key';
process.env.FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || 'smoke-firebase-key';
process.env.ALLOW_LEGACY_LOGIN_FALLBACK = 'false';

const { handleTokenServerRequest } = await import('../server/gemini-token-server.mjs');

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to resolve test server address'));
        return;
      }
      resolve(address.port);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function postJson(baseUrl, path, payload) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return {
    status: response.status,
    json,
    text
  };
}

const server = createServer(handleTokenServerRequest);

try {
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  const missingAudio = await postJson(baseUrl, '/api/gemini-live-transcribe', {});
  assert.equal(missingAudio.status, 400);
  assert.equal(missingAudio.json?.code, 'missing_audio');

  for (const payload of [
    { audioBase64: 'UklGRg==', mimeType: 'audio/wav' },
    { data: 'UklGRg==', mimeType: 'audio/wav' },
    { audio: 'UklGRg==', mimeType: 'audio/wav' }
  ]) {
    const acceptedContract = await postJson(baseUrl, '/api/gemini-live-transcribe', payload);
    assert.equal(
      acceptedContract.status,
      401,
      `Expected auth gate for transcribe payload ${JSON.stringify(payload)}`
    );
    assert.equal(acceptedContract.json?.code, 'missing_id_token');
  }

  const invalidOpenAiModel = await postJson(baseUrl, '/api/openai-realtime-session', {
    model: 42
  });
  assert.equal(invalidOpenAiModel.status, 400);
  assert.equal(invalidOpenAiModel.json?.code, 'invalid_model');

  console.log('token-server contract smoke passed');
} finally {
  await close(server);
}
