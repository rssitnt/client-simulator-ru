import { createServer } from 'node:http';
import { GoogleGenAI } from '@google/genai';

const PORT = Number.parseInt(process.env.PORT || '8787', 10);
const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || '').trim();
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || '').trim();
const FIREBASE_WEB_API_KEY = String(process.env.FIREBASE_WEB_API_KEY || '').trim();
const FIREBASE_DATABASE_URL = String(process.env.FIREBASE_DATABASE_URL || '').trim().replace(/\/+$/, '');
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
const ALLOWED_EMAIL_DOMAINS = String(process.env.ALLOWED_EMAIL_DOMAINS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

const GEMINI_LIVE_MODEL = String(process.env.GEMINI_LIVE_MODEL || 'gemini-2.5-flash-native-audio-preview-09-2025').trim();
const TOKEN_PATH = '/api/gemini-live-token';
const OPENAI_TOKEN_PATH = '/api/openai-realtime-session';
const OPENAI_REALTIME_MODEL = String(process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview-2025-06-03').trim();
const OPENAI_DEFAULT_VOICE = String(process.env.OPENAI_DEFAULT_VOICE || 'alloy').trim().toLowerCase();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 15;
const rateLimitBuckets = new Map();

if (!GEMINI_API_KEY && !OPENAI_API_KEY) {
    console.error('[gemini-token-server] Set at least one API key: GEMINI_API_KEY or OPENAI_API_KEY');
    process.exit(1);
}

if (!FIREBASE_WEB_API_KEY) {
    console.error('[gemini-token-server] FIREBASE_WEB_API_KEY is required');
    process.exit(1);
}

const ai = GEMINI_API_KEY
    ? new GoogleGenAI({
        apiKey: GEMINI_API_KEY,
        httpOptions: { apiVersion: 'v1alpha' }
    })
    : null;

const OPENAI_ALLOWED_VOICES = new Set(['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse']);

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

function normalizeLogin(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[<>"]/g, '');
}

function isValidLogin(value) {
    const email = normalizeLogin(value);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function loginToStorageKey(login) {
    const normalized = normalizeLogin(login);
    return Array.from(normalized)
        .map((char) => char.codePointAt(0).toString(16))
        .join('_');
}

function parseDateMs(value) {
    const ms = new Date(value || '').getTime();
    return Number.isFinite(ms) ? ms : null;
}

async function readDbJson(path) {
    if (!FIREBASE_DATABASE_URL) return null;
    const response = await fetch(`${FIREBASE_DATABASE_URL}/${path}.json`);
    if (!response.ok) return null;
    return response.json().catch(() => null);
}

async function verifyLoginFallbackAccess(login) {
    const normalizedLogin = normalizeLogin(login);
    if (!isValidLogin(normalizedLogin)) {
        throw new Error('Invalid login');
    }
    const key = loginToStorageKey(normalizedLogin);
    const [userRaw, inviteRaw] = await Promise.all([
        readDbJson(`users/${key}`),
        readDbJson(`partner_invites/${key}`)
    ]);

    const user = userRaw && typeof userRaw === 'object' ? userRaw : null;
    const invite = inviteRaw && typeof inviteRaw === 'object' ? inviteRaw : null;
    const role = String(user?.role || '').trim().toLowerCase();
    if (role === 'admin') {
        return { login: normalizedLogin, source: 'admin-user' };
    }

    if (isAllowedEmailDomain(normalizedLogin)) {
        return { login: normalizedLogin, source: 'domain-allowlist' };
    }

    const inviteStatus = String(invite?.status || '').trim().toLowerCase();
    const expiresAtMs = parseDateMs(invite?.expiresAt);
    const isInviteActive = inviteStatus === 'active' && (!expiresAtMs || expiresAtMs > Date.now());
    if (isInviteActive) {
        return { login: normalizedLogin, source: 'active-invite' };
    }

    throw new Error('Access denied for this login');
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
    if (!ai) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    const now = Date.now();
    const expireTime = new Date(now + 30 * 60 * 1000).toISOString();
    const newSessionExpireTime = new Date(now + 60 * 1000).toISOString();

    return ai.authTokens.create({
        config: {
            uses: 1,
            expireTime,
            newSessionExpireTime,
            liveConnectConstraints: {
                model: GEMINI_LIVE_MODEL
            },
            httpOptions: {
                apiVersion: 'v1alpha'
            }
        }
    });
}

function sanitizeOpenAiVoiceName(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return OPENAI_DEFAULT_VOICE;
    return OPENAI_ALLOWED_VOICES.has(normalized) ? normalized : OPENAI_DEFAULT_VOICE;
}

function buildOpenAiRealtimeSessionConfig(requestBody = {}) {
    const requestedModel = String(requestBody?.model || '').trim();
    const instructions = String(requestBody?.instructions || '').trim().slice(0, 12000);
    const voice = sanitizeOpenAiVoiceName(requestBody?.voice);

    const session = {
        model: requestedModel || OPENAI_REALTIME_MODEL,
        voice
    };
    if (instructions) {
        session.instructions = instructions;
    }
    return session;
}

async function createOpenAiRealtimeSession(requestBody = {}) {
    if (!OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not configured');
    }

    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(buildOpenAiRealtimeSessionConfig(requestBody))
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const errorMessage = String(payload?.error?.message || payload?.message || 'Failed to create OpenAI realtime session');
        throw new Error(errorMessage);
    }

    const clientSecret = String(payload?.client_secret?.value || '').trim();
    if (!clientSecret) {
        throw new Error('OpenAI session response is missing client_secret');
    }

    return {
        client_secret: {
            value: clientSecret,
            expires_at: payload?.client_secret?.expires_at || null
        },
        model: String(payload?.model || OPENAI_REALTIME_MODEL),
        voice: sanitizeOpenAiVoiceName(payload?.voice || OPENAI_DEFAULT_VOICE)
    };
}

const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const requestOrigin = String(req.headers.origin || '');
    const isGeminiTokenRequest = url.pathname === TOKEN_PATH;
    const isOpenAiTokenRequest = url.pathname === OPENAI_TOKEN_PATH;

    if (!isGeminiTokenRequest && !isOpenAiTokenRequest) {
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

    try {
        const requestBody = await readJsonBody(req);
        let authIdentity = null;

        if (idToken) {
            const firebaseUser = await verifyFirebaseIdToken(idToken);
            authIdentity = {
                uid: firebaseUser.localId || null,
                email: firebaseUser.email || null,
                login: normalizeLogin(firebaseUser.email || ''),
                source: 'firebase-id-token'
            };

            if (!isAllowedEmailDomain(firebaseUser.email)) {
                sendJson(res, 403, { error: 'Email domain is not allowed' }, requestOrigin);
                return;
            }
        } else {
            const loginFromBody = normalizeLogin(requestBody?.login || requestBody?.email || '');
            const fallbackAuth = await verifyLoginFallbackAccess(loginFromBody);
            authIdentity = {
                uid: null,
                email: fallbackAuth.login,
                login: fallbackAuth.login,
                source: fallbackAuth.source
            };
        }

        const clientIp = getClientIp(req);
        const rateKey = `${authIdentity.uid || authIdentity.login || 'unknown'}:${clientIp}`;

        if (isRateLimited(rateKey)) {
            sendJson(res, 429, { error: 'Too many token requests. Try again in a minute.' }, requestOrigin);
            return;
        }

        if (isOpenAiTokenRequest) {
            const session = await createOpenAiRealtimeSession(requestBody);
            sendJson(res, 200, {
                client_secret: session.client_secret,
                model: session.model,
                voice: session.voice,
                issuedFor: {
                    uid: authIdentity.uid || null,
                    email: authIdentity.email || null
                },
                requestContext: {
                    source: requestBody?.source || null,
                    authSource: authIdentity.source
                }
            }, requestOrigin);
            return;
        }

        const token = await createGeminiEphemeralToken();
        const tokenName = String(token?.name || '').trim();
        if (!tokenName) {
            throw new Error('Gemini token response is empty');
        }

        sendJson(res, 200, {
            name: tokenName,
            expireTime: token?.expireTime || null,
            newSessionExpireTime: token?.newSessionExpireTime || null,
            issuedFor: {
                uid: authIdentity.uid || null,
                email: authIdentity.email || null
            },
            requestContext: {
                source: requestBody?.source || null,
                authSource: authIdentity.source
            }
        }, requestOrigin);
    } catch (error) {
        const message = String(error?.message || 'Failed to create voice session token');
        const status = /MISSING|INVALID|EXPIRED|TOKEN/i.test(message) ? 401 : 500;
        sendJson(res, status, { error: message }, requestOrigin);
    }
});

server.listen(PORT, () => {
    console.log(`[gemini-token-server] listening on http://localhost:${PORT} (paths: ${TOKEN_PATH}, ${OPENAI_TOKEN_PATH})`);
});
