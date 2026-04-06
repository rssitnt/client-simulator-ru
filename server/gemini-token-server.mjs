import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import { GoogleGenAI, createPartFromBase64 } from '@google/genai';
import { initializeApp as initializeAdminApp, cert, getApps as getAdminApps } from 'firebase-admin/app';
import { getAppCheck } from 'firebase-admin/app-check';
import { getDatabase as getAdminDatabase } from 'firebase-admin/database';

const PORT = Number.parseInt(process.env.PORT || '8787', 10);
const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || '').trim();
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || '').trim();
const FIREBASE_WEB_API_KEY = String(process.env.FIREBASE_WEB_API_KEY || '').trim();
const FIREBASE_DATABASE_URL = String(process.env.FIREBASE_DATABASE_URL || '').trim().replace(/\/+$/, '');
const FIREBASE_APP_CHECK_ENFORCE = String(process.env.FIREBASE_APP_CHECK_ENFORCE || '').trim().toLowerCase() === 'true';
const FIREBASE_SERVICE_ACCOUNT_JSON = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
const FIREBASE_SERVICE_ACCOUNT_PATH = String(
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS || ''
).trim();
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
const ALLOWED_EMAIL_DOMAINS = String(process.env.ALLOWED_EMAIL_DOMAINS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
const ALLOW_LEGACY_LOGIN_FALLBACK = String(process.env.ALLOW_LEGACY_LOGIN_FALLBACK || '').trim().toLowerCase() === 'true';

const GEMINI_LIVE_MODEL = String(process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview').trim();
const GEMINI_LIVE_VOICE = String(process.env.GEMINI_LIVE_VOICE || 'Enceladus').trim();
const GEMINI_LIVE_MEDIA_RESOLUTION = 'MEDIA_RESOLUTION_LOW';
const GEMINI_LIVE_THINKING_BUDGET = 0;
const TOKEN_PATH = '/api/gemini-live-token';
const TRANSCRIBE_PATH = '/api/gemini-live-transcribe';
const OPENAI_TOKEN_PATH = '/api/openai-realtime-session';
const GEMINI_TRANSCRIBE_MODEL = String(process.env.GEMINI_TRANSCRIBE_MODEL || 'gemini-2.5-flash').trim();
const OPENAI_REALTIME_MODEL = String(process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview-2025-06-03').trim();
const OPENAI_DEFAULT_VOICE = String(process.env.OPENAI_DEFAULT_VOICE || 'alloy').trim().toLowerCase();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 15;
const RATE_LIMIT_BUCKET_TTL_MS = RATE_LIMIT_WINDOW_MS * 2;
const FIREBASE_REQUEST_TIMEOUT_MS = (() => {
    const configuredValue = Number.parseInt(String(process.env.FIREBASE_REQUEST_TIMEOUT_MS || ''), 10);
    return Number.isFinite(configuredValue) && configuredValue > 0 ? configuredValue : 8000;
})();
const OPENAI_REQUEST_TIMEOUT_MS = (() => {
    const configuredValue = Number.parseInt(String(process.env.OPENAI_REQUEST_TIMEOUT_MS || ''), 10);
    return Number.isFinite(configuredValue) && configuredValue > 0 ? configuredValue : 15000;
})();
const GEMINI_TRANSCRIBE_TIMEOUT_MS = (() => {
    const configuredValue = Number.parseInt(String(process.env.GEMINI_TRANSCRIBE_TIMEOUT_MS || ''), 10);
    return Number.isFinite(configuredValue) && configuredValue > 0 ? configuredValue : 15000;
})();
const MAX_JSON_BODY_BYTES = (() => {
    const configuredValue = Number.parseInt(String(process.env.MAX_JSON_BODY_BYTES || ''), 10);
    return Number.isFinite(configuredValue) && configuredValue > 0 ? configuredValue : 64 * 1024;
})();
const MAX_TRANSCRIBE_JSON_BODY_BYTES = (() => {
    const configuredValue = Number.parseInt(String(process.env.MAX_TRANSCRIBE_JSON_BODY_BYTES || ''), 10);
    return Number.isFinite(configuredValue) && configuredValue > 0 ? configuredValue : 3 * 1024 * 1024;
})();
const rateLimitBuckets = new Map();
let nextRateLimitCleanupAt = 0;

const isDirectRun = (() => {
    const entryPath = String(process.argv[1] || '').trim();
    if (!entryPath) return false;
    try {
        return import.meta.url === pathToFileURL(entryPath).href;
    } catch (error) {
        return false;
    }
})();

const ai = GEMINI_API_KEY
    ? new GoogleGenAI({
        apiKey: GEMINI_API_KEY,
        httpOptions: { apiVersion: 'v1alpha' }
    })
    : null;

const OPENAI_ALLOWED_VOICES = new Set(['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse']);
const GEMINI_ALLOWED_VOICES = new Set([
    'Zephyr',
    'Puck',
    'Charon',
    'Kore',
    'Fenrir',
    'Leda',
    'Orus',
    'Aoede',
    'Callirrhoe',
    'Enceladus',
    'Iapetus',
    'Umbriel',
    'Algieba',
    'Despina',
    'Erinome',
    'Algenib',
    'Rasalgethi',
    'Laomedeia',
    'Achernar',
    'Alnilam',
    'Schedar',
    'Gacrux',
    'Pulcherrima',
    'Achird',
    'Zubenelgenubi',
    'Vindemiatrix',
    'Sadachbia',
    'Sadaltager',
    'Sulafat'
]);

function getMissingServerConfigMessage() {
    if (!GEMINI_API_KEY && !OPENAI_API_KEY) {
        return 'Token server is not configured: set GEMINI_API_KEY or OPENAI_API_KEY.';
    }
    if (!FIREBASE_WEB_API_KEY) {
        return 'Token server is not configured: FIREBASE_WEB_API_KEY is required.';
    }
    if (FIREBASE_APP_CHECK_ENFORCE && !hasServiceAccountConfig()) {
        return 'Token server is not configured: App Check enforcement requires FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH.';
    }
    return '';
}

function getCorsOrigin(requestOrigin) {
    if (!requestOrigin) return '';
    if (!ALLOWED_ORIGINS.length) return '';
    return ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : '';
}

function applyCors(res, requestOrigin) {
    const corsOrigin = getCorsOrigin(requestOrigin);
    if (corsOrigin) {
        res.setHeader('Access-Control-Allow-Origin', corsOrigin);
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
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

function createHttpError(statusCode, message, cause = null) {
    const error = new Error(message);
    error.statusCode = statusCode;
    if (cause) {
        error.cause = cause;
    }
    return error;
}

function hasServiceAccountConfig() {
    return !!(FIREBASE_SERVICE_ACCOUNT_JSON || FIREBASE_SERVICE_ACCOUNT_PATH);
}

function loadServiceAccountConfig() {
    if (FIREBASE_SERVICE_ACCOUNT_JSON) {
        try {
            return JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
        } catch (error) {
            throw createHttpError(500, 'Invalid FIREBASE_SERVICE_ACCOUNT_JSON payload.', error);
        }
    }
    if (FIREBASE_SERVICE_ACCOUNT_PATH) {
        try {
            const raw = fs.readFileSync(FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8');
            return JSON.parse(raw);
        } catch (error) {
            throw createHttpError(500, 'Failed to read FIREBASE_SERVICE_ACCOUNT_PATH.', error);
        }
    }
    return null;
}

let firebaseAdminApp = null;
let firebaseAdminDatabase = null;

function getFirebaseAdminApp() {
    if (firebaseAdminApp) return firebaseAdminApp;
    if (getAdminApps().length) {
        firebaseAdminApp = getAdminApps()[0];
        return firebaseAdminApp;
    }
    const credentials = loadServiceAccountConfig();
    if (!credentials) {
        throw createHttpError(500, 'Firebase service account credentials are missing.');
    }
    const appOptions = {
        credential: cert(credentials)
    };
    if (FIREBASE_DATABASE_URL) {
        appOptions.databaseURL = FIREBASE_DATABASE_URL;
    }
    firebaseAdminApp = initializeAdminApp(appOptions);
    return firebaseAdminApp;
}

function getFirebaseAdminDatabase() {
    if (firebaseAdminDatabase) return firebaseAdminDatabase;
    const app = getFirebaseAdminApp();
    firebaseAdminDatabase = getAdminDatabase(app);
    return firebaseAdminDatabase;
}

function extractAppCheckToken(req) {
    const raw = req?.headers?.['x-firebase-appcheck'];
    if (!raw) return '';
    if (Array.isArray(raw)) {
        return String(raw[0] || '').trim();
    }
    return String(raw || '').trim();
}

async function verifyAppCheckToken(appCheckToken) {
    if (!FIREBASE_APP_CHECK_ENFORCE) return null;
    if (!appCheckToken) {
        throw createHttpError(401, 'Firebase App Check token is required.');
    }
    try {
        const app = getFirebaseAdminApp();
        return await getAppCheck(app).verifyToken(appCheckToken);
    } catch (error) {
        throw createHttpError(401, 'Firebase App Check verification failed.', error);
    }
}

async function readJsonBody(req, maxBytes = MAX_JSON_BODY_BYTES) {
    const safeMaxBytes = Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : MAX_JSON_BODY_BYTES;
    const declaredLength = Number.parseInt(String(req.headers['content-length'] || ''), 10);
    if (Number.isFinite(declaredLength) && declaredLength > safeMaxBytes) {
        throw createHttpError(413, `Request body too large. Limit is ${safeMaxBytes} bytes.`);
    }

    const chunks = [];
    let totalBytes = 0;
    for await (const chunk of req) {
        totalBytes += chunk.length;
        if (totalBytes > safeMaxBytes) {
            throw createHttpError(413, `Request body too large. Limit is ${safeMaxBytes} bytes.`);
        }
        chunks.push(chunk);
    }
    if (!chunks.length) return {};
    const rawBody = Buffer.concat(chunks).toString('utf8').trim();
    if (!rawBody) return {};
    try {
        const parsed = JSON.parse(rawBody);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw createHttpError(400, 'JSON body must be an object.');
        }
        return parsed;
    } catch (error) {
        if (error?.statusCode) {
            throw error;
        }
        throw createHttpError(400, 'Invalid JSON body.');
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

function normalizeRole(value) {
    return String(value || '').trim().toLowerCase() === 'admin' ? 'admin' : 'user';
}

function normalizeUserRecord(raw, loginFallback = '') {
    if (!raw || typeof raw !== 'object') return null;
    const login = normalizeLogin(raw.login || loginFallback);
    if (!isValidLogin(login)) return null;
    return {
        login,
        role: normalizeRole(raw.role),
        emailVerifiedAt: raw.emailVerifiedAt || null,
        passwordNeedsSetup: !!raw.passwordNeedsSetup,
        isBlocked: !!raw.isBlocked
    };
}

function normalizeAccessRevocation(raw, loginFallback = '') {
    if (!raw || typeof raw !== 'object') return null;
    const login = normalizeLogin(raw.login || loginFallback);
    if (!isValidLogin(login)) return null;
    return {
        login,
        status: raw.status === 'active' ? 'active' : 'revoked'
    };
}

function normalizePartnerInvite(raw, loginFallback = '') {
    if (!raw || typeof raw !== 'object') return null;
    const login = normalizeLogin(raw.login || loginFallback);
    if (!isValidLogin(login)) return null;
    return {
        login,
        status: raw.status === 'revoked' ? 'revoked' : 'active',
        expiresAt: raw.expiresAt || null,
        emailVerifiedAt: raw.emailVerifiedAt || null
    };
}

function isPartnerInviteActive(invite) {
    if (!invite || invite.status !== 'active') return false;
    if (!invite.expiresAt) return true;
    const expiresAtMs = parseDateMs(invite.expiresAt);
    return !!expiresAtMs && expiresAtMs > Date.now();
}

async function fetchWithTimeout(url, options = {}, timeoutMs, timeoutMessage) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    timeoutId.unref?.();

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal
        });
    } catch (error) {
        if (controller.signal.aborted) {
            throw createHttpError(504, timeoutMessage, error);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function readJsonWithTimeout(response, timeoutMs, timeoutMessage, fallbackValue = null) {
    let timeoutId = null;
    const bodyPromise = response.json();
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            try {
                response.body?.cancel?.();
            } catch (error) {}
            reject(createHttpError(504, timeoutMessage));
        }, timeoutMs);
        timeoutId.unref?.();
    });

    try {
        return await Promise.race([bodyPromise, timeoutPromise]);
    } catch (error) {
        if (Number(error?.statusCode) === 504) {
            throw error;
        }
        return fallbackValue;
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}

async function readDbJson(path, authToken = '') {
    if (!FIREBASE_DATABASE_URL) return null;
    if (FIREBASE_APP_CHECK_ENFORCE) {
        try {
            const db = getFirebaseAdminDatabase();
            const snapshot = await db.ref(path).get();
            return snapshot.exists() ? snapshot.val() : null;
        } catch (error) {
            console.warn('Admin RTDB read failed, falling back to REST:', error);
        }
    }
    const authSuffix = authToken ? `?auth=${encodeURIComponent(authToken)}` : '';
    const response = await fetchWithTimeout(
        `${FIREBASE_DATABASE_URL}/${path}.json${authSuffix}`,
        {},
        FIREBASE_REQUEST_TIMEOUT_MS,
        'Firebase RTDB request timed out'
    );
    if (!response.ok) return null;
    return readJsonWithTimeout(response, FIREBASE_REQUEST_TIMEOUT_MS, 'Firebase RTDB response body timed out', null);
}

async function resolveVoiceAccess(login, authToken = '') {
    const normalizedLogin = normalizeLogin(login);
    if (!isValidLogin(normalizedLogin)) {
        throw createHttpError(403, 'Access denied for this login');
    }

    const key = loginToStorageKey(normalizedLogin);
    const [userRaw, revocationRaw, inviteRaw] = await Promise.all([
        readDbJson(`users/${key}`, authToken),
        readDbJson(`access_revocations/${key}`, authToken),
        readDbJson(`partner_invites/${key}`, authToken)
    ]);

    const user = normalizeUserRecord(userRaw, normalizedLogin);
    const accessRevocation = normalizeAccessRevocation(revocationRaw, normalizedLogin);
    const invite = normalizePartnerInvite(inviteRaw, normalizedLogin);

    if (user?.isBlocked) {
        throw createHttpError(403, 'User account is blocked');
    }
    if (accessRevocation?.status === 'revoked') {
        throw createHttpError(403, 'Access has been revoked');
    }

    let accessSource = '';
    if (user?.role === 'admin') {
        accessSource = 'admin-user';
    } else if (isAllowedEmailDomain(normalizedLogin)) {
        accessSource = 'domain-allowlist';
    } else if (isPartnerInviteActive(invite)) {
        accessSource = 'active-invite';
    }

    if (!accessSource) {
        throw createHttpError(403, 'Access denied for this login');
    }
    if (user?.passwordNeedsSetup) {
        throw createHttpError(403, 'Password setup is incomplete');
    }

    const verifiedAt = user?.emailVerifiedAt || invite?.emailVerifiedAt || null;
    if (!verifiedAt) {
        throw createHttpError(403, 'Email verification is required');
    }

    return {
        login: normalizedLogin,
        user,
        invite,
        accessSource
    };
}

async function verifyLoginFallbackAccess(login) {
    const normalizedLogin = normalizeLogin(login);
    if (!isValidLogin(normalizedLogin)) {
        throw new Error('Invalid login');
    }

    try {
        const accessState = await resolveVoiceAccess(normalizedLogin);
        return {
            login: accessState.login,
            accessSource: accessState.accessSource
        };
    } catch (error) {
        // Legacy fallback has no Firebase auth context, so keep a narrow
        // compatibility path for temporary migrations when RTDB self-state
        // cannot be resolved here.
    }

    const key = loginToStorageKey(normalizedLogin);
    let userRaw = null;
    try {
        userRaw = await readDbJson(`users/${key}`);
    } catch (error) {
        if (!isAllowedEmailDomain(normalizedLogin) || Number(error?.statusCode) !== 504) {
            throw error;
        }
    }

    const user = userRaw && typeof userRaw === 'object' ? userRaw : null;
    const role = String(user?.role || '').trim().toLowerCase();
    if (role === 'admin') {
        return { login: normalizedLogin, accessSource: 'admin-user' };
    }

    if (isAllowedEmailDomain(normalizedLogin)) {
        return { login: normalizedLogin, accessSource: 'domain-allowlist' };
    }

    const inviteRaw = await readDbJson(`partner_invites/${key}`);
    const invite = inviteRaw && typeof inviteRaw === 'object' ? inviteRaw : null;
    const inviteStatus = String(invite?.status || '').trim().toLowerCase();
    const expiresAtMs = parseDateMs(invite?.expiresAt);
    const isInviteActive = inviteStatus === 'active' && (!expiresAtMs || expiresAtMs > Date.now());
    if (isInviteActive) {
        return { login: normalizedLogin, accessSource: 'active-invite' };
    }

    throw new Error('Access denied for this login');
}

function getClientIp(req) {
    const xff = String(req.headers['x-forwarded-for'] || '').trim();
    if (xff) return xff.split(',')[0].trim();
    return String(req.socket?.remoteAddress || 'unknown');
}

function cleanupRateLimitBuckets(now) {
    if (now < nextRateLimitCleanupAt || rateLimitBuckets.size === 0) return;
    nextRateLimitCleanupAt = now + RATE_LIMIT_WINDOW_MS;
    for (const [key, bucket] of rateLimitBuckets.entries()) {
        if (!bucket || now - bucket.windowStart > RATE_LIMIT_BUCKET_TTL_MS) {
            rateLimitBuckets.delete(key);
        }
    }
}

function isRateLimited(key) {
    const now = Date.now();
    cleanupRateLimitBuckets(now);
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
    const response = await fetchWithTimeout(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
        },
        FIREBASE_REQUEST_TIMEOUT_MS,
        'Firebase identity lookup timed out'
    );

    const payload = await readJsonWithTimeout(
        response,
        FIREBASE_REQUEST_TIMEOUT_MS,
        'Firebase identity response body timed out',
        {}
    );
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

function sanitizeGeminiVoiceName(value) {
    const normalized = String(value || '').trim();
    if (!normalized) return GEMINI_LIVE_VOICE;
    return GEMINI_ALLOWED_VOICES.has(normalized) ? normalized : GEMINI_LIVE_VOICE;
}

async function createGeminiEphemeralToken(requestedVoice) {
    if (!ai) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    const resolvedVoice = sanitizeGeminiVoiceName(requestedVoice);
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
                    responseModalities: ['AUDIO'],
                    mediaResolution: GEMINI_LIVE_MEDIA_RESOLUTION,
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: resolvedVoice
                            }
                        }
                    },
                    thinkingConfig: {
                        thinkingBudget: GEMINI_LIVE_THINKING_BUDGET
                    },
                    inputAudioTranscription: {},
                    outputAudioTranscription: {}
                }
            },
            lockAdditionalFields: [],
            httpOptions: {
                apiVersion: 'v1alpha'
            },
        }
    });
}

async function createGeminiAudioTranscription(requestBody = {}) {
    if (!ai) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    const audioBase64 = String(requestBody?.audioBase64 || requestBody?.data || '').trim();
    const mimeType = String(requestBody?.mimeType || 'audio/wav').trim().toLowerCase();
    if (!audioBase64) {
        throw createHttpError(400, 'audioBase64 is required');
    }
    if (!mimeType.startsWith('audio/')) {
        throw createHttpError(400, 'mimeType must be an audio/* value');
    }

    const prompt = 'Сделай дословную транскрипцию речи на аудио. Верни только сам текст без комментариев, без кавычек, без форматирования. Если речи нет или она неразборчива, верни пустую строку.';
    let timeoutId = null;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(createHttpError(504, 'Gemini audio transcription timed out'));
        }, GEMINI_TRANSCRIBE_TIMEOUT_MS);
        timeoutId.unref?.();
    });

    const requestPromise = ai.models.generateContent({
        model: GEMINI_TRANSCRIBE_MODEL,
        contents: [{
            role: 'user',
            parts: [
                { text: prompt },
                createPartFromBase64(audioBase64, mimeType)
            ]
        }],
        config: {
            responseMimeType: 'text/plain',
            temperature: 0
        }
    });

    try {
        const response = await Promise.race([requestPromise, timeoutPromise]);
        const transcript = String(response?.text || '').trim();
        return {
            transcript
        };
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
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

    const response = await fetchWithTimeout(
        'https://api.openai.com/v1/realtime/sessions',
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(buildOpenAiRealtimeSessionConfig(requestBody))
        },
        OPENAI_REQUEST_TIMEOUT_MS,
        'OpenAI realtime session request timed out'
    );

    const payload = await readJsonWithTimeout(
        response,
        OPENAI_REQUEST_TIMEOUT_MS,
        'OpenAI realtime session response body timed out',
        {}
    );
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

export async function handleTokenServerRequest(req, res) {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const requestOrigin = String(req.headers.origin || '');
    const isGeminiTokenRequest = url.pathname === TOKEN_PATH;
    const isGeminiTranscribeRequest = url.pathname === TRANSCRIBE_PATH;
    const isOpenAiTokenRequest = url.pathname === OPENAI_TOKEN_PATH;

    if (!isGeminiTokenRequest && !isGeminiTranscribeRequest && !isOpenAiTokenRequest) {
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

    const missingConfigMessage = getMissingServerConfigMessage();
    if (missingConfigMessage) {
        sendJson(res, 500, { error: missingConfigMessage }, requestOrigin);
        return;
    }

    const idToken = extractBearerToken(req);
    const appCheckToken = extractAppCheckToken(req);

    try {
        if (FIREBASE_APP_CHECK_ENFORCE) {
            await verifyAppCheckToken(appCheckToken);
        }
        const requestBody = await readJsonBody(
            req,
            isGeminiTranscribeRequest ? MAX_TRANSCRIBE_JSON_BODY_BYTES : MAX_JSON_BODY_BYTES
        );
        let authIdentity = null;

        if (idToken) {
            const firebaseUser = await verifyFirebaseIdToken(idToken);
            const accessState = await resolveVoiceAccess(firebaseUser.email || '', idToken);
            authIdentity = {
                uid: firebaseUser.localId || null,
                email: firebaseUser.email || null,
                login: normalizeLogin(firebaseUser.email || ''),
                source: 'firebase-id-token',
                accessSource: accessState.accessSource
            };
        } else if (ALLOW_LEGACY_LOGIN_FALLBACK) {
            const loginFromBody = normalizeLogin(requestBody?.login || requestBody?.email || '');
            const fallbackAuth = await verifyLoginFallbackAccess(loginFromBody);
            authIdentity = {
                uid: null,
                email: fallbackAuth.login,
                login: fallbackAuth.login,
                source: 'legacy-login-fallback',
                accessSource: fallbackAuth.accessSource || null
            };
        } else {
            sendJson(res, 401, { error: 'Firebase ID token is required' }, requestOrigin);
            return;
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
                    authSource: authIdentity.source,
                    accessSource: authIdentity.accessSource || null
                }
            }, requestOrigin);
            return;
        }

        if (isGeminiTranscribeRequest) {
            const result = await createGeminiAudioTranscription(requestBody);
            sendJson(res, 200, {
                transcript: result.transcript,
                model: GEMINI_TRANSCRIBE_MODEL,
                issuedFor: {
                    uid: authIdentity.uid || null,
                    email: authIdentity.email || null
                },
                requestContext: {
                    source: requestBody?.source || null,
                    authSource: authIdentity.source,
                    accessSource: authIdentity.accessSource || null
                }
            }, requestOrigin);
            return;
        }

        const requestedVoice = sanitizeGeminiVoiceName(requestBody?.voice);
        const token = await createGeminiEphemeralToken(requestedVoice);
        const tokenName = String(token?.name || '').trim();
        if (!tokenName) {
            throw new Error('Gemini token response is empty');
        }

        sendJson(res, 200, {
            name: tokenName,
            expireTime: token?.expireTime || null,
            newSessionExpireTime: token?.newSessionExpireTime || null,
            voice: requestedVoice,
                issuedFor: {
                    uid: authIdentity.uid || null,
                    email: authIdentity.email || null
                },
                requestContext: {
                    source: requestBody?.source || null,
                    authSource: authIdentity.source,
                    accessSource: authIdentity.accessSource || null
                }
            }, requestOrigin);
    } catch (error) {
        const message = String(error?.message || 'Failed to create voice session token');
        const status = Number.isInteger(error?.statusCode)
            ? error.statusCode
            : /MISSING|INVALID|EXPIRED|TOKEN/i.test(message)
                ? 401
                : 500;
        sendJson(res, status, { error: message }, requestOrigin);
    }
}

if (isDirectRun) {
    const missingConfigMessage = getMissingServerConfigMessage();
    if (missingConfigMessage) {
        console.error(`[gemini-token-server] ${missingConfigMessage}`);
        process.exit(1);
    }

    const server = createServer(handleTokenServerRequest);
    server.listen(PORT, () => {
        console.log(`[gemini-token-server] listening on http://localhost:${PORT} (paths: ${TOKEN_PATH}, ${TRANSCRIBE_PATH}, ${OPENAI_TOKEN_PATH})`);
    });
}
