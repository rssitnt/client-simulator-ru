import { Readable, Writable } from 'node:stream';

function expect(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

class MockRequest extends Readable {
    constructor({ method = 'POST', url = '/', body = '', headers = {} } = {}) {
        super();
        this.method = method;
        this.url = url;
        this.headers = {
            host: 'localhost:8787',
            'content-type': 'application/json',
            'content-length': String(Buffer.byteLength(body)),
            ...headers
        };
        this.socket = { remoteAddress: '127.0.0.1' };
        this._body = body;
        this._sent = false;
    }

    _read() {
        if (this._sent) {
            this.push(null);
            return;
        }
        this._sent = true;
        this.push(Buffer.from(this._body));
        this.push(null);
    }
}

class MockResponse extends Writable {
    constructor() {
        super();
        this.statusCode = 200;
        this.headers = {};
        this.chunks = [];
    }

    setHeader(name, value) {
        this.headers[String(name || '').toLowerCase()] = value;
    }

    _write(chunk, _encoding, callback) {
        this.chunks.push(Buffer.from(chunk));
        callback();
    }

    end(chunk) {
        if (chunk) {
            this.chunks.push(Buffer.from(chunk));
        }
        this.emit('finish');
    }

    json() {
        return JSON.parse(Buffer.concat(this.chunks).toString('utf8') || '{}');
    }
}

async function invokeHandler(handleTokenServerRequest, requestOptions) {
    const body = JSON.stringify(requestOptions?.body || {});
    const req = new MockRequest({
        method: requestOptions?.method || 'POST',
        url: requestOptions?.url || '/',
        body
    });
    const res = new MockResponse();
    await handleTokenServerRequest(req, res);
    return {
        statusCode: res.statusCode,
        payload: res.json()
    };
}

process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'smoke-gemini-key';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'smoke-openai-key';
process.env.FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || 'smoke-firebase-web-key';
process.env.ALLOW_LEGACY_LOGIN_FALLBACK = 'true';
process.env.ALLOWED_EMAIL_DOMAINS = '7271155.ru';

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input) => {
    const url = String(input || '');
    if (url === 'https://api.openai.com/v1/realtime/sessions') {
        return new Response(
            JSON.stringify({
                error: {
                    message: 'Unsupported voice parameter',
                    type: 'invalid_request_error',
                    code: 'invalid_value'
                }
            }),
            {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
    throw new Error(`Unexpected fetch during token-server contract smoke: ${url}`);
};

try {
    const { handleTokenServerRequest } = await import('../server/gemini-token-server.mjs');

    const transcribeResponse = await invokeHandler(handleTokenServerRequest, {
        url: '/api/gemini-live-transcribe',
        body: {
            login: 'smoke.admin@7271155.ru',
            audioBase64: 'AAAA',
            mimeType: 'text/plain'
        }
    });

    expect(
        transcribeResponse.statusCode === 400,
        `Expected transcribe invalid mimeType to stay a 400, got ${transcribeResponse.statusCode}`
    );
    expect(
        String(transcribeResponse.payload?.error || '').includes('mimeType must be an audio/* value'),
        `Expected transcribe request with audioBase64 to reach mime validation, got ${JSON.stringify(transcribeResponse.payload)}`
    );
    expect(
        transcribeResponse.payload?.code !== 'missing_audio',
        'Transcribe request still fails as missing_audio for audioBase64 payload'
    );

    const openAiResponse = await invokeHandler(handleTokenServerRequest, {
        url: '/api/openai-realtime-session',
        body: {
            login: 'smoke.admin@7271155.ru',
            voice: 'alloy'
        }
    });

    expect(
        openAiResponse.statusCode === 400,
        `Expected upstream OpenAI 400 to stay a 400, got ${openAiResponse.statusCode}`
    );
    expect(
        openAiResponse.payload?.code === 'invalid_value',
        `Expected OpenAI error code to survive, got ${JSON.stringify(openAiResponse.payload)}`
    );

    process.stdout.write('[token-server-contract] all contract checks passed\n');
} finally {
    globalThis.fetch = originalFetch;
}
