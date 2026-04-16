import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';

const realFetch = global.fetch.bind(globalThis);
const originalEnv = { ...process.env };

function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8'
        }
    });
}

async function requestJson(baseUrl, pathname, body = null, options = {}) {
    const response = await realFetch(`${baseUrl}${pathname}`, {
        method: options.method || (body ? 'POST' : 'GET'),
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        body: body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json();
    return {
        status: response.status,
        payload
    };
}

try {
    process.env.GEMINI_API_KEY = 'smoke-gemini-key';
    process.env.OPENAI_API_KEY = 'smoke-openai-key';
    process.env.FIREBASE_WEB_API_KEY = 'smoke-firebase-web-key';
    process.env.ALLOW_LEGACY_LOGIN_FALLBACK = 'true';
    process.env.ALLOWED_EMAIL_DOMAINS = 'example.com';
    delete process.env.FIREBASE_APP_CHECK_ENFORCE;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    delete process.env.FIREBASE_DATABASE_URL;

    global.fetch = async (input, init = {}) => {
        const url = typeof input === 'string' ? input : input?.url || '';
        if (/googleapis\.com|generativelanguage\.googleapis\.com/i.test(url)) {
            return jsonResponse({
                candidates: [
                    {
                        content: {
                            parts: [{ text: 'Smoke transcript' }]
                        }
                    }
                ]
            });
        }
        if (url === 'https://api.openai.com/v1/realtime/sessions') {
            return jsonResponse({
                error: {
                    message: 'Invalid voice',
                    code: 'invalid_voice'
                }
            }, 400);
        }
        throw new Error(`Unexpected outbound fetch: ${url}`);
    };

    const { handleTokenServerRequest } = await import(`../server/gemini-token-server.mjs?ts=${Date.now()}`);
    const server = createServer(handleTokenServerRequest);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');

    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const baseUrl = `http://127.0.0.1:${port}`;

    const health = await requestJson(baseUrl, '/health', null, { method: 'GET', headers: {} });
    assert.equal(health.status, 200);
    assert.equal(health.payload?.ok, true);
    assert.equal(health.payload?.routes?.geminiTranscribe?.ready, true);
    assert.equal(health.payload?.routes?.openaiRealtime?.ready, true);

    for (const body of [
        { login: 'user@example.com', audioBase64: 'U01PS0U=', mimeType: 'audio/wav' },
        { login: 'user@example.com', data: 'U01PS0U=', mimeType: 'audio/wav' },
        { login: 'user@example.com', audio: 'U01PS0U=', mimeType: 'audio/wav' }
    ]) {
        const result = await requestJson(baseUrl, '/api/gemini-live-transcribe', body);
        assert.equal(result.status, 200);
        assert.equal(result.payload?.transcript, 'Smoke transcript');
    }

    const openAiFailure = await requestJson(baseUrl, '/api/openai-realtime-session', {
        login: 'user@example.com',
        voice: 'bad-voice'
    });
    assert.equal(openAiFailure.status, 400);
    assert.equal(openAiFailure.payload?.code, 'invalid_voice');
    assert.equal(openAiFailure.payload?.upstreamStatus, 400);

    await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });

    console.log('token-server-contract-smoke: ok');
} finally {
    global.fetch = realFetch;
    for (const key of Object.keys(process.env)) {
        if (!(key in originalEnv)) {
            delete process.env[key];
        }
    }
    for (const [key, value] of Object.entries(originalEnv)) {
        process.env[key] = value;
    }
}
