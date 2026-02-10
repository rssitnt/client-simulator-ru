import { createServer } from 'node:http';
import { GoogleGenAI } from '@google/genai';

const PORT = Number.parseInt(process.env.PORT || '8787', 10);
const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || '').trim();
const FIREBASE_WEB_API_KEY = String(process.env.FIREBASE_WEB_API_KEY || '').trim();
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
const ALLOWED_EMAIL_DOMAINS = String(process.env.ALLOWED_EMAIL_DOMAINS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

const GEMINI_LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
const TOKEN_PATH = '/api/gemini-live-token';
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 15;
const rateLimitBuckets = new Map();

if (!GEMINI_API_KEY) {
    console.error('[gemini-token-server] GEMINI_API_KEY is required');
    process.exit(1);
}

if (!FIREBASE_WEB_API_KEY) {
    console.error('[gemini-token-server] FIREBASE_WEB_API_KEY is required');
    process.exit(1);
}

const ai = new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
    httpOptions: { apiVersion: 'v1alpha' }
});

function getCorsOrigin(requestOrigin) {
    if (!requestOrigin) return '';
    if (!ALLOWED_ORIGINS.length) return requestOrigin;
    return ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : '';
}

function applyCors(res, requestOrigin) {
    const corsOrigin = getCorsOrigin(requestOrigin);
    if (corsOrigin) {
        res.setHeader('Access-Control-Allow-Origin', corsOrigin);
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Max-Age', '600');
        res.setHeader('Vary', 'Origin');
    }
    return corsOrigin;
}

function sendJson(res, statusCode, payload, requestOrigin = '') {
    applyCors(res, requestOrigin);
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(chunk);
    }
    if (!chunks.length) return {};
    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
        return {};
    }
}

function extractBearerToken(req) {
    const raw = String(req.headers.authorization || '').trim();
    if (!raw || !raw.toLowerCase().startsWith('bearer ')) return '';
    return raw.slice(7).trim();
}

function isAllowedEmailDomain(email) {
    if (!ALLOWED_EMAIL_DOMAINS.length) return true;
    const normalized = String(email || '').trim().toLowerCase();
    const [, domain = ''] = normalized.split('@');
    return ALLOWED_EMAIL_DOMAINS.includes(domain);
}

function getClientIp(req) {
    const xff = String(req.headers['x-forwarded-for'] || '').trim();
    if (xff) return xff.split(',')[0].trim();
    return String(req.socket?.remoteAddress || 'unknown');
}

function isRateLimited(key) {
    const now = Date.now();
    const bucket = rateLimitBuckets.get(key);
    if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
        rateLimitBuckets.set(key, { windowStart: now, count: 1 });
        return false;
    }
    bucket.count += 1;
    rateLimitBuckets.set(key, bucket);
    return bucket.count > RATE_LIMIT_MAX_REQUESTS;
}

async function verifyFirebaseIdToken(idToken) {
    const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
        }
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const errorMessage = String(payload?.error?.message || 'Firebase verification failed');
        throw new Error(errorMessage);
    }

    const user = Array.isArray(payload?.users) ? payload.users[0] : null;
    if (!user) {
        throw new Error('User record not found');
    }
    if (user.disabled) {
        throw new Error('User account is disabled');
    }

    return user;
}

async function createGeminiEphemeralToken() {
    const now = Date.now();
    const expireTime = new Date(now + 30 * 60 * 1000).toISOString();
    const newSessionExpireTime = new Date(now + 60 * 1000).toISOString();

    return ai.authTokens.create({
        config: {
            uses: 1,
            expireTime,
            newSessionExpireTime,
            liveConnectConstraints: {
                model: GEMINI_LIVE_MODEL,
                config: {
                    responseModalities: ['AUDIO']
                }
            },
            httpOptions: {
                apiVersion: 'v1alpha'
            }
        }
    });
}

const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const requestOrigin = String(req.headers.origin || '');

    if (url.pathname !== TOKEN_PATH) {
        res.statusCode = 404;
        res.end('Not found');
        return;
    }

    const corsOrigin = applyCors(res, requestOrigin);
    if (requestOrigin && !corsOrigin) {
        sendJson(res, 403, { error: 'Origin is not allowed' }, requestOrigin);
        return;
    }

    if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
    }

    if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' }, requestOrigin);
        return;
    }

    const idToken = extractBearerToken(req);
    if (!idToken) {
        sendJson(res, 401, { error: 'Missing Firebase ID token' }, requestOrigin);
        return;
    }

    try {
        const requestBody = await readJsonBody(req);
        const firebaseUser = await verifyFirebaseIdToken(idToken);
        const clientIp = getClientIp(req);
        const rateKey = `${firebaseUser.localId || 'unknown'}:${clientIp}`;

        if (isRateLimited(rateKey)) {
            sendJson(res, 429, { error: 'Too many token requests. Try again in a minute.' }, requestOrigin);
            return;
        }

        if (!isAllowedEmailDomain(firebaseUser.email)) {
            sendJson(res, 403, { error: 'Email domain is not allowed' }, requestOrigin);
            return;
        }

        const token = await createGeminiEphemeralToken();
        const tokenName = String(token?.name || '').trim();
        if (!tokenName) {
            throw new Error('Gemini token response is empty');
        }

        const responsePayload = {
            name: tokenName,
            expireTime: token?.expireTime || null,
            newSessionExpireTime: token?.newSessionExpireTime || null,
            issuedFor: {
                uid: firebaseUser.localId || null,
                email: firebaseUser.email || null
            },
            requestContext: {
                source: requestBody?.source || null
            }
        };

        sendJson(res, 200, responsePayload, requestOrigin);
    } catch (error) {
        const message = String(error?.message || 'Failed to create Gemini token');
        const status = /MISSING|INVALID|EXPIRED|TOKEN/i.test(message) ? 401 : 500;
        sendJson(res, status, { error: message }, requestOrigin);
    }
});

server.listen(PORT, () => {
    console.log(`[gemini-token-server] listening on http://localhost:${PORT}${TOKEN_PATH}`);
});
