import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const TEST_ORIGIN = 'http://localhost:3000';
const TEST_LOGIN = 'qa@tradicia-k.ru';

process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.FIREBASE_WEB_API_KEY = 'test-firebase-key';
process.env.FIREBASE_DATABASE_URL = 'https://db.test';
process.env.ALLOWED_ORIGINS = TEST_ORIGIN;
process.env.ALLOW_LEGACY_LOGIN_FALLBACK = 'true';
process.env.FIREBASE_APP_CHECK_ENFORCE = 'false';

const originalFetch = globalThis.fetch;

function jsonResponse(status, payload) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}

globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : String(input?.url || '');

    if (url.startsWith('http://127.0.0.1:') || url.startsWith('http://localhost:')) {
        return originalFetch(input, init);
    }

    if (url.startsWith('https://db.test/users/')) {
        return jsonResponse(200, {
            login: TEST_LOGIN,
            role: 'user',
            emailVerifiedAt: '2026-04-16T00:00:00.000Z'
        });
    }
    if (url.startsWith('https://db.test/access_revocations/')) {
        return jsonResponse(200, null);
    }
    if (url.startsWith('https://db.test/partner_invites/')) {
        return jsonResponse(200, null);
    }
    if (url === 'https://api.openai.com/v1/realtime/sessions') {
        return jsonResponse(400, {
            error: {
                message: 'Bad model',
                code: 'bad_model'
            }
        });
    }
    if (url.includes('generativelanguage.googleapis.com')) {
        return jsonResponse(200, {
            candidates: [{
                content: {
                    parts: [{ text: 'Тестовая транскрипция' }]
                }
            }]
        });
    }

    throw new Error(`Unexpected fetch call: ${url} (${init?.method || 'GET'})`);
};

const moduleUrl = pathToFileURL(path.resolve('server/gemini-token-server.mjs'));
moduleUrl.search = `?contract-smoke=${Date.now()}`;
const { handleTokenServerRequest } = await import(moduleUrl.href);

const server = http.createServer((req, res) => {
    handleTokenServerRequest(req, res).catch((error) => {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: String(error?.message || error) }));
    });
});

try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    const healthResponse = await fetch(`${baseUrl}/health`, {
        headers: { Origin: TEST_ORIGIN }
    });
    assert.equal(healthResponse.status, 200, 'Health endpoint should be ready');
    const healthPayload = await healthResponse.json();
    assert.equal(healthPayload.ok, true, 'Health endpoint should report ok');
    assert.equal(healthPayload.routes?.geminiTranscribe, true, 'Health should expose Gemini transcribe readiness');
    assert.equal(healthPayload.routes?.openaiRealtime, true, 'Health should expose OpenAI readiness');

    for (const body of [
        { login: TEST_LOGIN, audioBase64: 'ZmFrZQ==', mimeType: 'audio/wav' },
        { login: TEST_LOGIN, data: 'ZmFrZQ==', mimeType: 'audio/wav' },
        { login: TEST_LOGIN, audio: 'ZmFrZQ==', mimeType: 'audio/wav' }
    ]) {
        const response = await fetch(`${baseUrl}/api/gemini-live-transcribe`, {
            method: 'POST',
            headers: {
                Origin: TEST_ORIGIN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        assert.equal(response.status, 200, 'Transcribe route should accept supported audio payload aliases');
        const payload = await response.json();
        assert.equal(typeof payload.transcript, 'string', 'Transcribe route should return transcript text');
    }

    const openAiResponse = await fetch(`${baseUrl}/api/openai-realtime-session`, {
        method: 'POST',
        headers: {
            Origin: TEST_ORIGIN,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            login: TEST_LOGIN,
            model: 'bad-model'
        })
    });
    assert.equal(openAiResponse.status, 400, 'OpenAI upstream 400 should stay 400');
    const openAiPayload = await openAiResponse.json();
    assert.equal(openAiPayload.code, 'bad_model', 'OpenAI upstream code should be preserved');
    assert.equal(openAiPayload.upstreamStatus, 400, 'OpenAI upstream status should be exposed');

    console.log('[token-contract] all assertions passed');
} finally {
    server.close();
    await once(server, 'close');
    globalThis.fetch = originalFetch;
}
