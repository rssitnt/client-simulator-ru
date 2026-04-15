import assert from 'node:assert/strict';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const serverModulePath = path.join(projectRoot, 'server', 'gemini-token-server.mjs');

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-key';
process.env.FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || 'test-firebase-key';
process.env.ALLOW_LEGACY_LOGIN_FALLBACK = 'true';
process.env.ALLOWED_EMAIL_DOMAINS = process.env.ALLOWED_EMAIL_DOMAINS || 'example.com';

const { handleTokenServerRequest } = await import(`${pathToFileURL(serverModulePath).href}?t=${Date.now()}`);

function createMockRequest(pathname, payload) {
    const body = Buffer.from(JSON.stringify(payload));
    const req = Readable.from([body]);
    req.method = 'POST';
    req.url = pathname;
    req.headers = {
        'content-type': 'application/json',
        'content-length': String(body.length),
        host: 'localhost:8787'
    };
    req.socket = { remoteAddress: '127.0.0.1' };
    return req;
}

function createMockResponse() {
    const headers = new Map();
    let body = '';
    return {
        statusCode: 200,
        setHeader(name, value) {
            headers.set(String(name).toLowerCase(), value);
        },
        end(chunk = '') {
            body += String(chunk);
        },
        get json() {
            return body ? JSON.parse(body) : null;
        },
        get headers() {
            return headers;
        }
    };
}

async function dispatch(pathname, payload) {
    const req = createMockRequest(pathname, payload);
    const res = createMockResponse();
    await handleTokenServerRequest(req, res);
    return res;
}

const acceptedAudioBase64 = await dispatch('/api/gemini-live-transcribe', {
    login: 'qa@example.com',
    audioBase64: 'AAAA',
    mimeType: 'audio/wav'
});

assert.equal(
    acceptedAudioBase64.statusCode,
    500,
    'audioBase64 payload should pass request validation and fail only on missing Gemini key in this contract check'
);
assert.match(
    String(acceptedAudioBase64.json?.error || ''),
    /GEMINI_API_KEY is not configured/i,
    'audioBase64 contract check should reach Gemini transcription handler'
);

const rejectedMissingAudio = await dispatch('/api/gemini-live-transcribe', {
    login: 'qa@example.com',
    mimeType: 'audio/wav'
});

assert.equal(rejectedMissingAudio.statusCode, 400, 'Missing audio payload must still be rejected');
assert.equal(rejectedMissingAudio.json?.code, 'missing_audio', 'Missing audio payload should keep missing_audio code');

console.log('[server-contract] gemini transcribe payload contract passed');
