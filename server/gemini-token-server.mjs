import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import { GoogleGenAI, createPartFromBase64 } from '@google/genai';
import { initializeApp as initializeAdminApp, applicationDefault, cert, getApps as getAdminApps } from 'firebase-admin/app';
import { getAppCheck } from 'firebase-admin/app-check';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getDatabase as getAdminDatabase } from 'firebase-admin/database';
import nodemailer from 'nodemailer';

const PORT = Number.parseInt(process.env.PORT || '8787', 10);
const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || '').trim();
const FIREBASE_WEB_API_KEY = String(process.env.FIREBASE_WEB_API_KEY || '').trim();
const FIREBASE_DATABASE_URL = String(process.env.FIREBASE_DATABASE_URL || '').trim().replace(/\/+$/, '');
const FIREBASE_PROJECT_ID = String(
    process.env.FIREBASE_PROJECT_ID
    || process.env.GOOGLE_CLOUD_PROJECT
    || process.env.GCLOUD_PROJECT
    || ''
).trim();
const FIREBASE_APP_CHECK_ENFORCE = String(process.env.FIREBASE_APP_CHECK_ENFORCE || '').trim().toLowerCase() === 'true';
const FIREBASE_SERVICE_ACCOUNT_JSON = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
const FIREBASE_SERVICE_ACCOUNT_PATH = String(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '').trim();
const GOOGLE_APPLICATION_CREDENTIALS_PATH = String(process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
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
const HEALTH_PATH = '/health';
const TOKEN_PATH = '/api/gemini-live-token';
const TRANSCRIBE_PATH = '/api/gemini-live-transcribe';
const PARTNER_INVITE_EMAIL_PATH = '/api/partner-invite-email';
const AUTH_MAGIC_LINK_EMAIL_PATH = '/api/auth-email-link';
const AUTH_PASSWORD_RESET_EMAIL_PATH = '/api/auth-password-reset-email';
const SIMULATOR_WEBHOOK_PROXY_PATH = '/api/simulator-webhook';
const CERTIFICATION_WEBHOOK_PROXY_PATH = '/api/certification-webhook';
const UNIFIED_SIMULATOR_WEBHOOK_UPSTREAM_URL = String(
    process.env.SIMULATOR_WEBHOOK_UPSTREAM_URL || 'https://n8n-api.tradicia-k.ru/webhook/client-simulator'
).trim();
const CERTIFICATION_WEBHOOK_UPSTREAM_URL = String(
    process.env.CERTIFICATION_WEBHOOK_UPSTREAM_URL || UNIFIED_SIMULATOR_WEBHOOK_UPSTREAM_URL
).trim() || UNIFIED_SIMULATOR_WEBHOOK_UPSTREAM_URL;
const WEBHOOK_PROXY_INSECURE_TLS_HOSTS = new Set(
    String(process.env.WEBHOOK_PROXY_INSECURE_TLS_HOSTS || '')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
);
const GEMINI_TRANSCRIBE_MODEL = String(process.env.GEMINI_TRANSCRIBE_MODEL || 'gemini-2.5-flash').trim();
const SMTP_HOST = String(process.env.SMTP_HOST || '').trim();
const SMTP_PORT = (() => {
    const configuredValue = Number.parseInt(String(process.env.SMTP_PORT || ''), 10);
    return Number.isFinite(configuredValue) && configuredValue > 0 ? configuredValue : 587;
})();
const SMTP_SECURE = String(process.env.SMTP_SECURE || '').trim().toLowerCase() === 'true';
const SMTP_REQUIRE_TLS = String(process.env.SMTP_REQUIRE_TLS || '').trim().toLowerCase() !== 'false';
const SMTP_USER = String(process.env.SMTP_USER || '').trim();
const SMTP_PASS = String(process.env.SMTP_PASS || '').trim();
const SMTP_FROM = String(process.env.SMTP_FROM || '').trim();
const SMTP_REPLY_TO = String(process.env.SMTP_REPLY_TO || '').trim();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 15;
const RATE_LIMIT_BUCKET_TTL_MS = RATE_LIMIT_WINDOW_MS * 2;
const FIREBASE_REQUEST_TIMEOUT_MS = (() => {
    const configuredValue = Number.parseInt(String(process.env.FIREBASE_REQUEST_TIMEOUT_MS || ''), 10);
    return Number.isFinite(configuredValue) && configuredValue > 0 ? configuredValue : 8000;
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
const MAX_WEBHOOK_PROXY_JSON_BODY_BYTES = (() => {
    const configuredValue = Number.parseInt(
        String(process.env.MAX_WEBHOOK_PROXY_JSON_BODY_BYTES || process.env.MAX_TRANSCRIBE_JSON_BODY_BYTES || ''),
        10
    );
    return Number.isFinite(configuredValue) && configuredValue > 0 ? configuredValue : 3 * 1024 * 1024;
})();
const WEBHOOK_PROXY_TIMEOUT_MS = (() => {
    const configuredValue = Number.parseInt(String(process.env.WEBHOOK_PROXY_TIMEOUT_MS || ''), 10);
    return Number.isFinite(configuredValue) && configuredValue > 0 ? configuredValue : 30000;
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

function normalizeServerRequestMode(mode = '') {
    const normalized = String(mode || '').trim().toLowerCase();
    return normalized || 'default';
}

function getFirebaseProjectIdResolutionState() {
    const explicitProjectId = String(FIREBASE_PROJECT_ID || '').trim();
    if (explicitProjectId) {
        return {
            projectId: explicitProjectId,
            errorMessage: ''
        };
    }

    if (hasServiceAccountConfig()) {
        try {
            const credentials = loadServiceAccountConfig();
            return {
                projectId: String(credentials?.project_id || credentials?.projectId || '').trim(),
                errorMessage: ''
            };
        } catch (error) {
            return {
                projectId: '',
                errorMessage: String(error?.message || '').trim()
            };
        }
    }

    const databaseProjectId = parseFirebaseProjectIdFromDatabaseUrl(FIREBASE_DATABASE_URL);
    return {
        projectId: databaseProjectId,
        errorMessage: ''
    };
}

export function getMissingServerConfigMessage(mode = 'default', config = {}) {
    const normalizedMode = normalizeServerRequestMode(mode);
    const geminiConfigured = Object.prototype.hasOwnProperty.call(config, 'geminiConfigured')
        ? !!config.geminiConfigured
        : !!GEMINI_API_KEY;
    const firebaseConfigured = Object.prototype.hasOwnProperty.call(config, 'firebaseConfigured')
        ? !!config.firebaseConfigured
        : !!FIREBASE_WEB_API_KEY;
    const appCheckEnforced = Object.prototype.hasOwnProperty.call(config, 'appCheckEnforced')
        ? !!config.appCheckEnforced
        : FIREBASE_APP_CHECK_ENFORCE;
    const hasAdminCredentials = Object.prototype.hasOwnProperty.call(config, 'hasAdminCredentials')
        ? !!config.hasAdminCredentials
        : Object.prototype.hasOwnProperty.call(config, 'hasServiceAccount')
            ? !!config.hasServiceAccount
            : hasFirebaseAdminCredentials();
    const firebaseProjectResolutionState = Object.prototype.hasOwnProperty.call(config, 'firebaseProjectConfigured')
        ? {
            projectId: config.firebaseProjectConfigured ? 'configured' : '',
            errorMessage: ''
        }
        : getFirebaseProjectIdResolutionState();
    const firebaseProjectConfigured = !!firebaseProjectResolutionState.projectId;
    const smtpConfigured = Object.prototype.hasOwnProperty.call(config, 'smtpConfigured')
        ? !!config.smtpConfigured
        : !getInviteMailMissingConfigMessage();

    if (normalizedMode === 'simulator-webhook' || normalizedMode === 'certification-webhook') {
        return '';
    }

    if (normalizedMode === 'gemini-token' || normalizedMode === 'gemini-transcribe') {
        if (!geminiConfigured) {
            return 'Token server is not configured: GEMINI_API_KEY is required for Gemini endpoints.';
        }
    } else if (normalizedMode === 'partner-invite-email' && !smtpConfigured) {
        return getInviteMailMissingConfigMessage();
    } else if (normalizedMode === 'auth-email-link' || normalizedMode === 'auth-password-reset-email') {
        if (!smtpConfigured) {
            return getInviteMailMissingConfigMessage();
        }
        if (!hasAdminCredentials) {
            return normalizedMode === 'auth-password-reset-email'
                ? 'Password reset email endpoint is not configured: FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_PATH, or Google Application Default Credentials are required to generate reset links.'
                : 'Auth email endpoint is not configured: FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_PATH, or Google Application Default Credentials are required to generate sign-in links.';
        }
        if (!firebaseProjectConfigured) {
            if (firebaseProjectResolutionState.errorMessage) {
                return firebaseProjectResolutionState.errorMessage;
            }
            return 'Auth email endpoint is not configured: set FIREBASE_PROJECT_ID or provide Firebase credentials/database URL that resolve a project ID.';
        }
    } else if (normalizedMode !== 'partner-invite-email' && !geminiConfigured) {
        return 'Token server is not configured: set GEMINI_API_KEY.';
    }

    if (!firebaseConfigured) {
        return 'Token server is not configured: FIREBASE_WEB_API_KEY is required.';
    }
    if (appCheckEnforced && !hasAdminCredentials) {
        return 'Token server is not configured: App Check enforcement requires FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_PATH, or Google Application Default Credentials.';
    }
    return '';
}

function getEndpointConfigStatus() {
    const geminiTokenMessage = getMissingServerConfigMessage('gemini-token');
    const geminiTranscribeMessage = getMissingServerConfigMessage('gemini-transcribe');
    const partnerInviteMessage = getMissingServerConfigMessage('partner-invite-email');
    const authMagicLinkMessage = getMissingServerConfigMessage('auth-email-link');
    const authPasswordResetMessage = getMissingServerConfigMessage('auth-password-reset-email');
    return {
        geminiToken: {
            ok: !geminiTokenMessage,
            missingConfig: geminiTokenMessage || null
        },
        geminiTranscribe: {
            ok: !geminiTranscribeMessage,
            missingConfig: geminiTranscribeMessage || null
        },
        partnerInviteEmail: {
            ok: !partnerInviteMessage,
            missingConfig: partnerInviteMessage || null
        },
        authMagicLinkEmail: {
            ok: !authMagicLinkMessage,
            missingConfig: authMagicLinkMessage || null
        },
        authPasswordResetEmail: {
            ok: !authPasswordResetMessage,
            missingConfig: authPasswordResetMessage || null
        }
    };
}

function hasAnyConfiguredEndpoint(status = {}) {
    return Object.values(status).some((entry) => !!entry?.ok);
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
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader(
            'Access-Control-Allow-Headers',
            'Content-Type, Authorization, X-Firebase-AppCheck, X-Request-Id, X-Idempotency-Key, X-Client-Simulator-Request-Type'
        );
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

function sendApiError(res, statusCode, message, code, requestOrigin = '', meta = {}) {
    sendJson(res, statusCode, {
        error: message,
        code,
        ...meta
    }, requestOrigin);
}

function sendText(res, statusCode, text, requestOrigin = '') {
    applyCors(res, requestOrigin);
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(text);
}

function sendRaw(res, statusCode, body, contentType = 'application/json; charset=utf-8', requestOrigin = '') {
    applyCors(res, requestOrigin);
    res.statusCode = statusCode;
    res.setHeader('Content-Type', contentType);
    res.end(body);
}

function buildRequestLogContext(req, requestId, extra = {}) {
    return {
        requestId,
        method: req?.method || '',
        path: req?.url || '',
        origin: String(req?.headers?.origin || ''),
        ip: getClientIp(req),
        ...extra
    };
}

function logRequestEvent(level, payload) {
    const entry = {
        ts: new Date().toISOString(),
        level,
        ...payload
    };
    const text = JSON.stringify(entry);
    if (level === 'error') {
        console.error(text);
    } else {
        console.log(text);
    }
}

function createHttpError(statusCode, message, cause = null) {
    const error = new Error(message);
    error.statusCode = statusCode;
    if (cause) {
        error.cause = cause;
    }
    return error;
}

function validateTokenRequest(body) {
    if (body?.voice && typeof body.voice !== 'string') {
        throw createHttpError(400, 'Voice must be a string.', { code: 'invalid_voice' });
    }
}

export function validateTranscribeRequest(body) {
    const audioPayload = String(body?.audioBase64 || body?.data || body?.audio || '').trim();
    if (!audioPayload) {
        throw createHttpError(400, 'Audio payload is required.', { code: 'missing_audio' });
    }
    if (body?.mimeType != null && typeof body.mimeType !== 'string') {
        throw createHttpError(400, 'mimeType must be a string.', { code: 'invalid_mime_type' });
    }
}

function hasServiceAccountConfig() {
    return !!(FIREBASE_SERVICE_ACCOUNT_JSON || FIREBASE_SERVICE_ACCOUNT_PATH);
}

function getApplicationDefaultCredentialsPath() {
    if (GOOGLE_APPLICATION_CREDENTIALS_PATH) {
        return GOOGLE_APPLICATION_CREDENTIALS_PATH;
    }
    const appData = String(process.env.APPDATA || '').trim();
    if (appData) {
        return path.join(appData, 'gcloud', 'application_default_credentials.json');
    }
    const homeDir = os.homedir();
    if (!homeDir) {
        return '';
    }
    if (process.platform === 'win32') {
        return path.join(homeDir, 'AppData', 'Roaming', 'gcloud', 'application_default_credentials.json');
    }
    return path.join(homeDir, '.config', 'gcloud', 'application_default_credentials.json');
}

function hasApplicationDefaultCredentialsConfig() {
    const credentialsPath = getApplicationDefaultCredentialsPath();
    return !!(credentialsPath && fs.existsSync(credentialsPath));
}

function hasFirebaseAdminCredentials() {
    return hasServiceAccountConfig() || hasApplicationDefaultCredentialsConfig();
}

function parseFirebaseProjectIdFromDatabaseUrl(databaseUrl = '') {
    const normalized = String(databaseUrl || '').trim();
    if (!normalized) return '';
    try {
        const parsed = new URL(normalized);
        const host = String(parsed.hostname || '').trim().toLowerCase();
        if (!host) return '';
        const defaultRtdbMatch = host.match(/^([a-z0-9-]+)-default-rtdb(?:\.[^.]+)?\.(?:firebasedatabase\.app|firebaseio\.com)$/i);
        if (defaultRtdbMatch?.[1]) {
            return defaultRtdbMatch[1];
        }
        const legacyMatch = host.match(/^([a-z0-9-]+)(?:\.[^.]+)?\.firebaseio\.com$/i);
        if (legacyMatch?.[1]) {
            return legacyMatch[1];
        }
    } catch {}
    return '';
}

function resolveFirebaseProjectId(credentials = null) {
    const explicitProjectId = String(FIREBASE_PROJECT_ID || '').trim();
    if (explicitProjectId) return explicitProjectId;
    const credentialsProjectId = String(credentials?.project_id || credentials?.projectId || '').trim();
    if (credentialsProjectId) return credentialsProjectId;
    return parseFirebaseProjectIdFromDatabaseUrl(FIREBASE_DATABASE_URL);
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
    const appOptions = {};
    const projectId = resolveFirebaseProjectId(credentials);
    if (credentials) {
        appOptions.credential = cert(credentials);
    } else if (hasApplicationDefaultCredentialsConfig()) {
        appOptions.credential = applicationDefault();
    } else {
        throw createHttpError(500, 'Firebase admin credentials are missing.');
    }
    if (projectId) {
        appOptions.projectId = projectId;
    }
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
        throw createHttpError(413, `Request body too large. Limit is ${safeMaxBytes} bytes.`, {
            code: 'payload_too_large',
            limitBytes: safeMaxBytes
        });
    }

    const chunks = [];
    let totalBytes = 0;
    for await (const chunk of req) {
        totalBytes += chunk.length;
        if (totalBytes > safeMaxBytes) {
            throw createHttpError(413, `Request body too large. Limit is ${safeMaxBytes} bytes.`, {
                code: 'payload_too_large',
                limitBytes: safeMaxBytes
            });
        }
        chunks.push(chunk);
    }
    if (!chunks.length) return {};
    const rawBody = Buffer.concat(chunks).toString('utf8').trim();
    if (!rawBody) return {};
    try {
        const parsed = JSON.parse(rawBody);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw createHttpError(400, 'JSON body must be an object.', { code: 'invalid_body' });
        }
        return parsed;
    } catch (error) {
        if (error?.statusCode) {
            throw error;
        }
        throw createHttpError(400, 'Invalid JSON body.', { code: 'invalid_body' });
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

export function normalizeRoleFromClaims(claims = null) {
    if (!claims || typeof claims !== 'object') return '';
    if (claims.admin === true) return 'admin';
    const role = String(claims.role || '').trim().toLowerCase();
    return role === 'admin' ? 'admin' : '';
}

export function resolveEffectiveAccessSource(accessState = null, claims = null) {
    const baseAccessSource = String(accessState?.accessSource || '').trim();
    if (!baseAccessSource) return '';
    if (baseAccessSource === 'admin-user') return 'admin-user';
    return normalizeRoleFromClaims(claims) === 'admin' ? 'admin-user' : baseAccessSource;
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
    if (hasFirebaseAdminCredentials()) {
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
    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            throw createHttpError(response.status, 'Firebase RTDB access denied', {
                code: 'firebase_rtdb_access_denied'
            });
        }
        return null;
    }
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

export function resolveLegacyLoginFallbackAccessState(login, options = {}) {
    const normalizedLogin = normalizeLogin(login);
    if (!isValidLogin(normalizedLogin)) {
        throw new Error('Invalid login');
    }

    const allowEmailDomain = Object.prototype.hasOwnProperty.call(options, 'allowEmailDomain')
        ? !!options.allowEmailDomain
        : isAllowedEmailDomain(normalizedLogin);
    const user = normalizeUserRecord(options.userRaw, normalizedLogin);
    const accessRevocation = normalizeAccessRevocation(options.revocationRaw, normalizedLogin);
    const invite = normalizePartnerInvite(options.inviteRaw, normalizedLogin);
    const verifiedAt = user?.emailVerifiedAt || invite?.emailVerifiedAt || null;

    if (user?.isBlocked) {
        throw new Error('User account is blocked');
    }
    if (accessRevocation?.status === 'revoked') {
        throw new Error('Access is revoked');
    }
    if (user?.passwordNeedsSetup) {
        throw new Error('Password setup is incomplete');
    }
    if (user && !verifiedAt) {
        throw new Error('Email verification is required');
    }

    if (user?.role === 'admin') {
        return { login: normalizedLogin, accessSource: 'admin-user' };
    }

    if (allowEmailDomain) {
        return { login: normalizedLogin, accessSource: 'domain-allowlist' };
    }

    if (isPartnerInviteActive(invite)) {
        if (!verifiedAt) {
            throw new Error('Email verification is required');
        }
        return { login: normalizedLogin, accessSource: 'active-invite' };
    }

    throw new Error('Access denied for this login');
}

export function resolveAuthMagicLinkAccessState(login, options = {}) {
    const normalizedLogin = normalizeLogin(login);
    if (!isValidLogin(normalizedLogin)) {
        throw new Error('Invalid login');
    }

    const allowEmailDomain = Object.prototype.hasOwnProperty.call(options, 'allowEmailDomain')
        ? !!options.allowEmailDomain
        : isAllowedEmailDomain(normalizedLogin);
    const user = normalizeUserRecord(options.userRaw, normalizedLogin);
    const accessRevocation = normalizeAccessRevocation(options.revocationRaw, normalizedLogin);
    const invite = normalizePartnerInvite(options.inviteRaw, normalizedLogin);

    if (user?.isBlocked) {
        throw new Error('User account is blocked');
    }
    if (accessRevocation?.status === 'revoked') {
        throw new Error('Access is revoked');
    }
    if (user?.passwordNeedsSetup) {
        throw new Error('Password setup is incomplete');
    }

    if (user?.role === 'admin') {
        return { login: normalizedLogin, accessSource: 'admin-user' };
    }

    if (allowEmailDomain) {
        return { login: normalizedLogin, accessSource: 'domain-allowlist' };
    }

    if (isPartnerInviteActive(invite)) {
        return { login: normalizedLogin, accessSource: 'active-invite' };
    }

    throw new Error('Access denied for this login');
}

async function verifyLoginFallbackAccess(login) {
    const normalizedLogin = normalizeLogin(login);
    if (!isValidLogin(normalizedLogin)) {
        throw createHttpError(400, 'Invalid login');
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
    const allowEmailDomain = isAllowedEmailDomain(normalizedLogin);
    let userRaw = null;
    try {
        userRaw = await readDbJson(`users/${key}`);
    } catch (error) {
        if (!allowEmailDomain || Number(error?.statusCode) !== 504) {
            throw error;
        }
    }
    let revocationRaw = null;
    try {
        revocationRaw = await readDbJson(`access_revocations/${key}`);
    } catch (error) {
        if (!allowEmailDomain || Number(error?.statusCode) !== 504) {
            throw error;
        }
    }
    let inviteRaw = null;
    try {
        inviteRaw = await readDbJson(`partner_invites/${key}`);
    } catch (error) {
        if (!allowEmailDomain || Number(error?.statusCode) !== 504) {
            throw error;
        }
    }

    try {
        return resolveLegacyLoginFallbackAccessState(normalizedLogin, {
            allowEmailDomain,
            userRaw,
            revocationRaw,
            inviteRaw
        });
    } catch (error) {
        const message = String(error?.message || 'Access denied for this login');
        const statusCode = /invalid login/i.test(message)
            ? 400
            : /blocked|revoked|verification|password setup|access denied/i.test(message)
                ? 403
                : 500;
        throw createHttpError(statusCode, message, error);
    }
}

export function shouldAllowInsecureTlsForWebhookUrl(url) {
    if (!url) return false;
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.protocol === 'https:' && WEBHOOK_PROXY_INSECURE_TLS_HOSTS.has(parsedUrl.hostname.toLowerCase());
    } catch (error) {
        return false;
    }
}

async function sendWebhookProxyRequestWithCustomTls(url, options = {}, timeoutMs, timeoutMessage) {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const requestImpl = isHttps ? httpsRequest : httpRequest;
    const requestHeaders = { ...(options?.headers || {}) };
    const requestBody = options?.body == null ? '' : String(options.body);

    if (requestBody && !Object.keys(requestHeaders).some((key) => key.toLowerCase() === 'content-length')) {
        requestHeaders['Content-Length'] = Buffer.byteLength(requestBody);
    }

    return await new Promise((resolve, reject) => {
        let settled = false;
        const finish = (callback) => (value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            callback(value);
        };
        const resolveOnce = finish(resolve);
        const rejectOnce = finish(reject);
        const timeoutId = setTimeout(() => {
            req.destroy(createHttpError(504, timeoutMessage));
        }, timeoutMs);
        timeoutId.unref?.();

        const req = requestImpl(url, {
            method: options?.method || 'GET',
            headers: requestHeaders,
            rejectUnauthorized: !shouldAllowInsecureTlsForWebhookUrl(url)
        }, (upstreamRes) => {
            const chunks = [];
            upstreamRes.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            upstreamRes.on('end', () => {
                const bodyBuffer = chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0);
                const responseHeaders = new Headers();
                Object.entries(upstreamRes.headers || {}).forEach(([key, value]) => {
                    if (Array.isArray(value)) {
                        value.forEach((entry) => responseHeaders.append(key, String(entry)));
                        return;
                    }
                    if (value != null) {
                        responseHeaders.set(key, String(value));
                    }
                });
                resolveOnce(new Response(bodyBuffer, {
                    status: upstreamRes.statusCode || 502,
                    statusText: upstreamRes.statusMessage || '',
                    headers: responseHeaders
                }));
            });
            upstreamRes.on('error', rejectOnce);
        });

        req.on('error', (error) => {
            if (error?.statusCode === 504 || error?.cause?.statusCode === 504) {
                rejectOnce(createHttpError(504, timeoutMessage, error));
                return;
            }
            rejectOnce(error);
        });

        if (requestBody) {
            req.write(requestBody);
        }
        req.end();
    });
}

async function sendWebhookProxyRequest(url, options = {}, timeoutMs, timeoutMessage) {
    if (shouldAllowInsecureTlsForWebhookUrl(url)) {
        return sendWebhookProxyRequestWithCustomTls(url, options, timeoutMs, timeoutMessage);
    }
    return fetchWithTimeout(url, options, timeoutMs, timeoutMessage);
}

async function verifyAuthMagicLinkAccess(login) {
    const normalizedLogin = normalizeLogin(login);
    if (!isValidLogin(normalizedLogin)) {
        throw createHttpError(400, 'Invalid login');
    }

    const key = loginToStorageKey(normalizedLogin);
    const allowEmailDomain = isAllowedEmailDomain(normalizedLogin);
    let userRaw = null;
    try {
        userRaw = await readDbJson(`users/${key}`);
    } catch (error) {
        if (!allowEmailDomain || Number(error?.statusCode) !== 504) {
            throw error;
        }
    }
    let revocationRaw = null;
    try {
        revocationRaw = await readDbJson(`access_revocations/${key}`);
    } catch (error) {
        if (!allowEmailDomain || Number(error?.statusCode) !== 504) {
            throw error;
        }
    }
    let inviteRaw = null;
    try {
        inviteRaw = await readDbJson(`partner_invites/${key}`);
    } catch (error) {
        if (!allowEmailDomain || Number(error?.statusCode) !== 504) {
            throw error;
        }
    }

    try {
        return resolveAuthMagicLinkAccessState(normalizedLogin, {
            allowEmailDomain,
            userRaw,
            revocationRaw,
            inviteRaw
        });
    } catch (error) {
        const message = String(error?.message || 'Access denied for this login');
        const statusCode = /invalid login/i.test(message)
            ? 400
            : /blocked|revoked|password setup|access denied/i.test(message)
                ? 403
                : 500;
        throw createHttpError(statusCode, message, error);
    }
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
        rateLimitBuckets.set(key, {
            windowStart: now,
            resetAt: now + RATE_LIMIT_WINDOW_MS,
            count: 1
        });
        return false;
    }
    bucket.count += 1;
    rateLimitBuckets.set(key, bucket);
    return bucket.count > RATE_LIMIT_MAX_REQUESTS;
}

function getRetryAfterMs(key) {
    const bucket = rateLimitBuckets.get(key);
    if (!bucket) return RATE_LIMIT_WINDOW_MS;
    const resetAt = Number.isFinite(bucket.resetAt)
        ? bucket.resetAt
        : bucket.windowStart + RATE_LIMIT_WINDOW_MS;
    const remaining = resetAt - Date.now();
    return remaining > 0 ? remaining : RATE_LIMIT_WINDOW_MS;
}

function getRequestModeLabel({
    isGeminiTranscribeRequest = false,
    isPartnerInviteEmailRequest = false,
    isAuthMagicLinkEmailRequest = false,
    isAuthPasswordResetEmailRequest = false,
    isSimulatorWebhookProxyRequest = false,
    isCertificationWebhookProxyRequest = false
} = {}) {
    if (isCertificationWebhookProxyRequest) return 'certification-webhook';
    if (isSimulatorWebhookProxyRequest) return 'simulator-webhook';
    if (isAuthPasswordResetEmailRequest) return 'auth-password-reset-email';
    if (isAuthMagicLinkEmailRequest) return 'auth-email-link';
    if (isPartnerInviteEmailRequest) return 'partner-invite-email';
    if (isGeminiTranscribeRequest) return 'gemini-transcribe';
    return 'gemini-token';
}

function validatePartnerInviteEmailRequest(body) {
    if (!body?.email || typeof body.email !== 'string') {
        throw createHttpError(400, 'Invite email is required.', { code: 'missing_email' });
    }
    if (!body?.directInviteLink || typeof body.directInviteLink !== 'string') {
        throw createHttpError(400, 'Direct invite link is required.', { code: 'missing_direct_invite_link' });
    }
    if (body?.appBaseUrl && typeof body.appBaseUrl !== 'string') {
        throw createHttpError(400, 'appBaseUrl must be a string.', { code: 'invalid_app_base_url' });
    }
    if (body?.expiresAt && typeof body.expiresAt !== 'string') {
        throw createHttpError(400, 'expiresAt must be a string.', { code: 'invalid_expires_at' });
    }
}

export function validateAuthMagicLinkEmailRequest(body) {
    if (!body?.email || typeof body.email !== 'string') {
        throw createHttpError(400, 'Auth email is required.', { code: 'missing_email' });
    }
    if (body?.appBaseUrl && typeof body.appBaseUrl !== 'string') {
        throw createHttpError(400, 'appBaseUrl must be a string.', { code: 'invalid_app_base_url' });
    }
    if (body?.purpose != null && typeof body.purpose !== 'string') {
        throw createHttpError(400, 'purpose must be a string.', { code: 'invalid_purpose' });
    }
}

export function validateAuthPasswordResetEmailRequest(body) {
    if (!body?.email || typeof body.email !== 'string') {
        throw createHttpError(400, 'Password reset email is required.', { code: 'missing_email' });
    }
    if (body?.appBaseUrl && typeof body.appBaseUrl !== 'string') {
        throw createHttpError(400, 'appBaseUrl must be a string.', { code: 'invalid_app_base_url' });
    }
}

export function resolveAuthEmailRequestContext(authIdentity = null, requestBody = null) {
    const requestedEmail = normalizeLogin(requestBody?.email || '');
    const verifiedLogin = normalizeLogin(authIdentity?.login || authIdentity?.email || '');
    const issuedEmail = normalizeLogin(authIdentity?.email || '') || requestedEmail || null;
    return {
        requestedEmail,
        verifiedLogin,
        issuedEmail
    };
}

async function verifyFirebaseIdToken(idToken) {
    let decodedToken = null;
    if (hasFirebaseAdminCredentials()) {
        try {
            decodedToken = await getAdminAuth(getFirebaseAdminApp()).verifyIdToken(idToken);
        } catch (error) {
            console.warn('Firebase Admin token verification failed, falling back to identity lookup only:', error);
        }
    }

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

    return {
        ...user,
        customClaims: decodedToken || null
    };
}

function getInviteMailMissingConfigMessage() {
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
        return 'Invite mail server is not configured: set SMTP_HOST, SMTP_USER, SMTP_PASS and SMTP_FROM.';
    }
    return '';
}

let inviteMailTransporter = null;

function getInviteMailTransporter() {
    if (inviteMailTransporter) return inviteMailTransporter;
    const missingConfigMessage = getInviteMailMissingConfigMessage();
    if (missingConfigMessage) {
        throw createHttpError(500, missingConfigMessage, { code: 'missing_invite_mail_config' });
    }
    inviteMailTransporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        requireTLS: SMTP_REQUIRE_TLS,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS
        }
    });
    return inviteMailTransporter;
}

function resolveInviteMailAppBaseUrl(appBaseUrl = '', requestOrigin = '') {
    const candidate = String(appBaseUrl || requestOrigin || '').trim();
    if (!candidate) {
        throw createHttpError(400, 'appBaseUrl is required.', { code: 'missing_app_base_url' });
    }
    let parsed;
    try {
        parsed = new URL(candidate);
    } catch (error) {
        throw createHttpError(400, 'appBaseUrl is invalid.', { code: 'invalid_app_base_url' });
    }
    if (ALLOWED_ORIGINS.length && !ALLOWED_ORIGINS.includes(parsed.origin)) {
        throw createHttpError(403, 'appBaseUrl origin is not allowed.', { code: 'app_base_url_not_allowed' });
    }
    return parsed.origin;
}

function resolveAuthMailAppBaseUrl(appBaseUrl = '', requestOrigin = '') {
    const candidate = String(appBaseUrl || requestOrigin || '').trim();
    if (!candidate) {
        throw createHttpError(400, 'appBaseUrl is required.', { code: 'missing_app_base_url' });
    }
    let parsed;
    try {
        parsed = new URL(candidate);
    } catch (error) {
        throw createHttpError(400, 'appBaseUrl is invalid.', { code: 'invalid_app_base_url' });
    }
    if (ALLOWED_ORIGINS.length && !ALLOWED_ORIGINS.includes(parsed.origin)) {
        throw createHttpError(403, 'appBaseUrl origin is not allowed.', { code: 'app_base_url_not_allowed' });
    }
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
}

function resolveAuthMagicLinkPurpose(value = '') {
    return String(value || '').trim().toLowerCase() === 'invite' ? 'invite' : 'verify';
}

function buildAuthMagicLinkActionUrl(email, appBaseUrl = '', requestOrigin = '', purpose = 'verify') {
    const actionUrl = new URL(resolveAuthMailAppBaseUrl(appBaseUrl, requestOrigin));
    actionUrl.searchParams.set('auth_link', '1');
    actionUrl.searchParams.set('email_action', resolveAuthMagicLinkPurpose(purpose));
    actionUrl.searchParams.set('email', normalizeLogin(email));
    return actionUrl.toString();
}

function buildAuthPasswordResetContinueUrl(email, appBaseUrl = '', requestOrigin = '') {
    const continueUrl = new URL(resolveAuthMailAppBaseUrl(appBaseUrl, requestOrigin));
    continueUrl.searchParams.set('email_action', 'reset-password');
    continueUrl.searchParams.set('email', normalizeLogin(email));
    return continueUrl.toString();
}

function formatInviteExpiryLabel(expiresAt = '') {
    const expiresAtMs = parseDateMs(expiresAt);
    if (!expiresAtMs) return '';
    try {
        return new Date(expiresAtMs).toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return '';
    }
}

async function dispatchPartnerInviteEmail(payload, requestOrigin = '', requestedBy = '') {
    const normalizedEmail = normalizeLogin(payload?.email || '');
    if (!isValidLogin(normalizedEmail)) {
        throw createHttpError(400, 'Invite email is invalid.', { code: 'invalid_email' });
    }
    const directInviteLink = String(payload?.directInviteLink || '').trim();
    if (!directInviteLink) {
        throw createHttpError(400, 'Direct invite link is required.', { code: 'missing_direct_invite_link' });
    }
    let parsedDirectInviteUrl;
    try {
        parsedDirectInviteUrl = new URL(directInviteLink);
    } catch (error) {
        throw createHttpError(400, 'Direct invite link is invalid.', { code: 'invalid_direct_invite_link' });
    }
    const appBaseOrigin = resolveInviteMailAppBaseUrl(payload?.appBaseUrl || '', requestOrigin);
    if (parsedDirectInviteUrl.origin !== appBaseOrigin) {
        throw createHttpError(400, 'Direct invite link origin does not match app base URL.', { code: 'invite_link_origin_mismatch' });
    }

    const transporter = getInviteMailTransporter();
    const expiresLabel = formatInviteExpiryLabel(payload?.expiresAt || '');
    const requestedByLabel = normalizeLogin(requestedBy || '');
    const expiryLine = expiresLabel ? `Срок ссылки: ${expiresLabel}` : 'Ссылка активна до её отзыва или перевыпуска.';
    const requestedByLine = requestedByLabel ? `Инвайт выдал: ${requestedByLabel}` : '';
    const subject = 'Приглашение в клиентский тренажёр';
    const text = [
        `Здравствуйте.`,
        '',
        `Для вас подготовлена ссылка приглашения в клиентский тренажёр.`,
        `Откройте её, чтобы подтвердить приглашение и задать пароль:`,
        directInviteLink,
        '',
        expiryLine,
        requestedByLine,
        '',
        `Если кнопка или ссылка не открывается, просто вставьте адрес в браузер вручную.`,
        '',
        `Это письмо отправлено автоматически.`
    ].filter(Boolean).join('\n');
    const html = [
        '<div style="font-family:Arial,sans-serif;line-height:1.55;color:#1f2933">',
        '<p>Здравствуйте.</p>',
        '<p>Для вас подготовлена ссылка приглашения в клиентский тренажёр.</p>',
        '<p><a href="' + directInviteLink + '" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#111827;color:#ffffff;text-decoration:none">Открыть приглашение</a></p>',
        '<p style="word-break:break-all">' + directInviteLink + '</p>',
        '<p>' + expiryLine + '</p>',
        requestedByLine ? '<p>' + requestedByLine + '</p>' : '',
        '<p>Если кнопка не открывается, вставьте ссылку в браузер вручную.</p>',
        '<p style="color:#6b7280">Это письмо отправлено автоматически.</p>',
        '</div>'
    ].filter(Boolean).join('');

    const info = await transporter.sendMail({
        from: SMTP_FROM,
        to: normalizedEmail,
        replyTo: SMTP_REPLY_TO || undefined,
        subject,
        text,
        html
    });
    return {
        sentAt: new Date().toISOString(),
        messageId: String(info?.messageId || '').trim() || null
    };
}

async function dispatchAuthMagicLinkEmail(payload, requestOrigin = '', requestedBy = '') {
    const normalizedEmail = normalizeLogin(payload?.email || '');
    if (!isValidLogin(normalizedEmail)) {
        throw createHttpError(400, 'Auth email is invalid.', { code: 'invalid_email' });
    }

    const purpose = resolveAuthMagicLinkPurpose(payload?.purpose || 'verify');
    const actionUrl = buildAuthMagicLinkActionUrl(
        normalizedEmail,
        payload?.appBaseUrl || '',
        requestOrigin,
        purpose
    );
    const actionCodeSettings = {
        url: actionUrl,
        handleCodeInApp: true
    };

    const link = await getAdminAuth(getFirebaseAdminApp())
        .generateSignInWithEmailLink(normalizedEmail, actionCodeSettings);
    const transporter = getInviteMailTransporter();
    const requestedByLabel = normalizeLogin(requestedBy || '');
    const actionLabel = purpose === 'invite'
        ? 'подтвердить приглашение и войти'
        : 'подтвердить email и войти';
    const subject = purpose === 'invite'
        ? 'Ссылка для подтверждения приглашения'
        : 'Ссылка для входа в клиентский тренажёр';
    const requestedByLine = requestedByLabel ? `Запрос инициировал: ${requestedByLabel}` : '';
    const text = [
        'Здравствуйте.',
        '',
        `Чтобы ${actionLabel}, откройте ссылку ниже:`,
        link,
        '',
        'Ссылка одноразовая. Если кнопка или переход не открываются, вставьте адрес в браузер вручную.',
        requestedByLine,
        '',
        'Это письмо отправлено автоматически.'
    ].filter(Boolean).join('\n');
    const html = [
        '<div style="font-family:Arial,sans-serif;line-height:1.55;color:#1f2933">',
        '<p>Здравствуйте.</p>',
        `<p>Чтобы ${actionLabel}, откройте ссылку ниже.</p>`,
        `<p><a href="${link}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#111827;color:#ffffff;text-decoration:none">Открыть ссылку входа</a></p>`,
        `<p style="word-break:break-all">${link}</p>`,
        '<p>Ссылка одноразовая. Если кнопка не открывается, вставьте адрес в браузер вручную.</p>',
        requestedByLine ? `<p>${requestedByLine}</p>` : '',
        '<p style="color:#6b7280">Это письмо отправлено автоматически.</p>',
        '</div>'
    ].filter(Boolean).join('');

    const info = await transporter.sendMail({
        from: SMTP_FROM,
        to: normalizedEmail,
        replyTo: SMTP_REPLY_TO || undefined,
        subject,
        text,
        html
    });
    return {
        sentAt: new Date().toISOString(),
        messageId: String(info?.messageId || '').trim() || null,
        purpose,
        link
    };
}

async function dispatchAuthPasswordResetEmail(payload, requestOrigin = '', requestedBy = '') {
    const normalizedEmail = normalizeLogin(payload?.email || '');
    if (!isValidLogin(normalizedEmail)) {
        throw createHttpError(400, 'Password reset email is invalid.', { code: 'invalid_email' });
    }

    const actionCodeSettings = {
        url: buildAuthPasswordResetContinueUrl(
            normalizedEmail,
            payload?.appBaseUrl || '',
            requestOrigin
        )
    };

    let link = '';
    try {
        link = await getAdminAuth(getFirebaseAdminApp())
            .generatePasswordResetLink(normalizedEmail, actionCodeSettings);
    } catch (error) {
        const code = String(error?.code || '').trim();
        if (code === 'auth/user-not-found') {
            throw createHttpError(404, 'User not found', { code });
        }
        throw error;
    }

    const transporter = getInviteMailTransporter();
    const requestedByLabel = normalizeLogin(requestedBy || '');
    const requestedByLine = requestedByLabel ? `Запрос инициировал: ${requestedByLabel}` : '';
    const subject = 'Сброс пароля для клиентского тренажёра';
    const text = [
        'Здравствуйте.',
        '',
        'Чтобы задать новый пароль, откройте ссылку ниже:',
        link,
        '',
        'Если кнопка не открывается, вставьте ссылку в браузер вручную. После смены пароля вернитесь на сайт и войдите с новым паролем.',
        requestedByLine,
        '',
        'Это письмо отправлено автоматически.'
    ].filter(Boolean).join('\n');
    const html = [
        '<div style="font-family:Arial,sans-serif;line-height:1.55;color:#1f2933">',
        '<p>Здравствуйте.</p>',
        '<p>Чтобы задать новый пароль, откройте ссылку ниже.</p>',
        `<p><a href="${link}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#111827;color:#ffffff;text-decoration:none">Сменить пароль</a></p>`,
        `<p style="word-break:break-all">${link}</p>`,
        '<p>Если кнопка не открывается, вставьте ссылку в браузер вручную. После смены пароля вернитесь на сайт и войдите с новым паролем.</p>',
        requestedByLine ? `<p>${requestedByLine}</p>` : '',
        '<p style="color:#6b7280">Это письмо отправлено автоматически.</p>',
        '</div>'
    ].filter(Boolean).join('');

    const info = await transporter.sendMail({
        from: SMTP_FROM,
        to: normalizedEmail,
        replyTo: SMTP_REPLY_TO || undefined,
        subject,
        text,
        html
    });
    return {
        sentAt: new Date().toISOString(),
        messageId: String(info?.messageId || '').trim() || null,
        link
    };
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

    const audioBase64 = String(requestBody?.audioBase64 || requestBody?.data || requestBody?.audio || '').trim();
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

async function proxyWebhookRequest({ req, res, requestOrigin, requestId, requestMode, upstreamUrl }) {
    const requestBody = await readJsonBody(req, MAX_WEBHOOK_PROXY_JSON_BODY_BYTES);
    const requestType = String(req.headers['x-client-simulator-request-type'] || requestBody?.requestType || '').trim();
    const requestIdHeader = String(req.headers['x-request-id'] || requestBody?.requestId || '').trim();
    const idempotencyKey = String(req.headers['x-idempotency-key'] || '').trim();

    const upstreamHeaders = {
        'Content-Type': 'application/json'
    };
    if (requestType) {
        upstreamHeaders['X-Client-Simulator-Request-Type'] = requestType;
    }
    if (requestIdHeader) {
        upstreamHeaders['X-Request-Id'] = requestIdHeader;
    }
    if (idempotencyKey) {
        upstreamHeaders['X-Idempotency-Key'] = idempotencyKey;
    }

    const upstreamResponse = await sendWebhookProxyRequest(
        upstreamUrl,
        {
            method: 'POST',
            headers: upstreamHeaders,
            body: JSON.stringify(requestBody)
        },
        WEBHOOK_PROXY_TIMEOUT_MS,
        `Upstream ${requestMode} timed out`
    );

    const responseText = await upstreamResponse.text();
    const contentType = String(upstreamResponse.headers.get('content-type') || 'application/json; charset=utf-8').trim();
    sendRaw(res, upstreamResponse.status, responseText, contentType, requestOrigin);
}

export async function handleTokenServerRequest(req, res) {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const requestOrigin = String(req.headers.origin || '');
    const requestId = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const isGeminiTokenRequest = url.pathname === TOKEN_PATH;
    const isGeminiTranscribeRequest = url.pathname === TRANSCRIBE_PATH;
    const isPartnerInviteEmailRequest = url.pathname === PARTNER_INVITE_EMAIL_PATH;
    const isAuthMagicLinkEmailRequest = url.pathname === AUTH_MAGIC_LINK_EMAIL_PATH;
    const isAuthPasswordResetEmailRequest = url.pathname === AUTH_PASSWORD_RESET_EMAIL_PATH;
    const isSimulatorWebhookProxyRequest = url.pathname === SIMULATOR_WEBHOOK_PROXY_PATH;
    const isCertificationWebhookProxyRequest = url.pathname === CERTIFICATION_WEBHOOK_PROXY_PATH;
    const isHealthCheck = url.pathname === HEALTH_PATH;
    const isAuthEmailRequest = isAuthMagicLinkEmailRequest || isAuthPasswordResetEmailRequest;
    const requestMode = getRequestModeLabel({
        isGeminiTranscribeRequest,
        isPartnerInviteEmailRequest,
        isAuthMagicLinkEmailRequest,
        isAuthPasswordResetEmailRequest,
        isSimulatorWebhookProxyRequest,
        isCertificationWebhookProxyRequest
    });
    const isWebhookProxyRequest = isSimulatorWebhookProxyRequest || isCertificationWebhookProxyRequest;

    if (!isGeminiTokenRequest && !isGeminiTranscribeRequest && !isPartnerInviteEmailRequest && !isAuthEmailRequest && !isWebhookProxyRequest && !isHealthCheck) {
        sendText(res, 404, 'Not found', requestOrigin);
        return;
    }

    const corsOrigin = applyCors(res, requestOrigin);
    if (requestOrigin && !corsOrigin) {
        logRequestEvent('warn', buildRequestLogContext(req, requestId, {
            status: 403,
            reason: 'origin-not-allowed'
        }));
        sendJson(res, 403, { error: 'Origin is not allowed' }, requestOrigin);
        return;
    }

    if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        logRequestEvent('info', buildRequestLogContext(req, requestId, { status: 204, reason: 'cors-preflight' }));
        return;
    }

    if (isHealthCheck && req.method === 'GET') {
        const endpointConfig = getEndpointConfigStatus();
        const ok = hasAnyConfiguredEndpoint(endpointConfig);
        const payload = {
            ok,
            service: 'gemini-token-server',
            geminiConfigured: !!GEMINI_API_KEY,
            firebaseConfigured: !!FIREBASE_WEB_API_KEY,
            appCheckEnforced: FIREBASE_APP_CHECK_ENFORCE,
            endpoints: endpointConfig
        };
        sendJson(res, ok ? 200 : 503, payload, requestOrigin);
        logRequestEvent(ok ? 'info' : 'warn', buildRequestLogContext(req, requestId, {
            status: ok ? 200 : 503,
            reason: ok ? 'health-ok' : 'health-missing-config'
        }));
        return;
    }

    if (req.method !== 'POST') {
        sendApiError(res, 405, 'Method not allowed', 'method_not_allowed', requestOrigin);
        logRequestEvent('warn', buildRequestLogContext(req, requestId, {
            status: 405,
            reason: 'method-not-allowed'
        }));
        return;
    }

    const missingConfigMessage = getMissingServerConfigMessage(requestMode);
    if (missingConfigMessage) {
        sendApiError(res, 500, missingConfigMessage, 'missing_config', requestOrigin);
        logRequestEvent('error', buildRequestLogContext(req, requestId, {
            status: 500,
            reason: 'missing-config',
            message: missingConfigMessage
        }));
        return;
    }

    const idToken = extractBearerToken(req);
    const appCheckToken = extractAppCheckToken(req);

    const startedAt = Date.now();
    try {
        if (isWebhookProxyRequest) {
            await proxyWebhookRequest({
                req,
                res,
                requestOrigin,
                requestId,
                requestMode,
                upstreamUrl: isCertificationWebhookProxyRequest
                    ? CERTIFICATION_WEBHOOK_UPSTREAM_URL
                    : UNIFIED_SIMULATOR_WEBHOOK_UPSTREAM_URL
            });
            logRequestEvent('info', buildRequestLogContext(req, requestId, {
                status: res.statusCode || 200,
                durationMs: Date.now() - startedAt,
                mode: requestMode
            }));
            return;
        }

        if (FIREBASE_APP_CHECK_ENFORCE) {
            await verifyAppCheckToken(appCheckToken);
        }
        const requestBody = await readJsonBody(
            req,
            isGeminiTranscribeRequest ? MAX_TRANSCRIBE_JSON_BODY_BYTES : MAX_JSON_BODY_BYTES
        );
        if (isGeminiTranscribeRequest) {
            validateTranscribeRequest(requestBody);
        } else if (isPartnerInviteEmailRequest) {
            validatePartnerInviteEmailRequest(requestBody);
        } else if (isAuthPasswordResetEmailRequest) {
            validateAuthPasswordResetEmailRequest(requestBody);
        } else if (isAuthMagicLinkEmailRequest) {
            validateAuthMagicLinkEmailRequest(requestBody);
        } else {
            validateTokenRequest(requestBody);
        }
        let authIdentity = null;

        if (idToken) {
            const firebaseUser = await verifyFirebaseIdToken(idToken);
            const accessState = isAuthEmailRequest
                ? await verifyAuthMagicLinkAccess(firebaseUser.email || '')
                : await resolveVoiceAccess(firebaseUser.email || '', idToken);
            authIdentity = {
                uid: firebaseUser.localId || firebaseUser.uid || null,
                email: firebaseUser.email || null,
                login: normalizeLogin(firebaseUser.email || ''),
                source: 'firebase-id-token',
                accessSource: resolveEffectiveAccessSource(accessState, firebaseUser.customClaims),
                claimsRole: normalizeRoleFromClaims(firebaseUser.customClaims)
            };
        } else if (ALLOW_LEGACY_LOGIN_FALLBACK) {
            const loginFromBody = normalizeLogin(requestBody?.login || requestBody?.email || '');
            const fallbackAuth = isAuthEmailRequest
                ? await verifyAuthMagicLinkAccess(loginFromBody)
                : await verifyLoginFallbackAccess(loginFromBody);
            authIdentity = {
                uid: null,
                email: fallbackAuth.login,
                login: fallbackAuth.login,
                source: 'legacy-login-fallback',
                accessSource: fallbackAuth.accessSource || null
            };
        } else {
            sendApiError(res, 401, 'Firebase ID token is required', 'missing_id_token', requestOrigin);
            logRequestEvent('warn', buildRequestLogContext(req, requestId, {
                status: 401,
                durationMs: Date.now() - startedAt,
                mode: requestMode,
                authSource: null,
                accessSource: null,
                error: 'Firebase ID token is required'
            }));
            return;
        }

        const clientIp = getClientIp(req);
        const rateKey = `${authIdentity.uid || authIdentity.login || 'unknown'}:${clientIp}`;

        if (isRateLimited(rateKey)) {
            const retryAfterMs = getRetryAfterMs(rateKey);
            res.setHeader('Retry-After', Math.ceil(retryAfterMs / 1000));
            sendApiError(
                res,
                429,
                'Too many token requests. Try again in a minute.',
                'rate_limited',
                requestOrigin,
                { retryAfterMs }
            );
            logRequestEvent('warn', buildRequestLogContext(req, requestId, {
                status: 429,
                durationMs: Date.now() - startedAt,
                mode: requestMode,
                authSource: authIdentity.source,
                accessSource: authIdentity.accessSource || null,
                retryAfterMs
            }));
            return;
        }

        if (isPartnerInviteEmailRequest) {
            if (authIdentity.accessSource !== 'admin-user') {
                sendApiError(res, 403, 'Admin access is required for invite email dispatch.', 'admin_required', requestOrigin);
                logRequestEvent('warn', buildRequestLogContext(req, requestId, {
                    status: 403,
                    durationMs: Date.now() - startedAt,
                    mode: requestMode,
                    authSource: authIdentity.source,
                    accessSource: authIdentity.accessSource || null,
                    error: 'Admin access is required for invite email dispatch.'
                }));
                return;
            }
            const result = await dispatchPartnerInviteEmail(requestBody, requestOrigin, authIdentity.login || authIdentity.email || '');
            sendJson(res, 200, {
                ok: true,
                delivery: 'smtp',
                sentAt: result.sentAt,
                messageId: result.messageId,
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
            logRequestEvent('info', buildRequestLogContext(req, requestId, {
                status: 200,
                durationMs: Date.now() - startedAt,
                mode: requestMode,
                authSource: authIdentity.source,
                accessSource: authIdentity.accessSource || null
            }));
            return;
        }

        const authEmailRequestContext = isAuthEmailRequest
            ? resolveAuthEmailRequestContext(authIdentity, requestBody)
            : null;

        if (isAuthEmailRequest) {
            if (!authEmailRequestContext?.requestedEmail || authEmailRequestContext.requestedEmail !== authEmailRequestContext.verifiedLogin) {
                sendApiError(res, 403, 'Auth email can only be sent for the verified login in this request.', 'email_mismatch', requestOrigin);
                logRequestEvent('warn', buildRequestLogContext(req, requestId, {
                    status: 403,
                    durationMs: Date.now() - startedAt,
                    mode: requestMode,
                    authSource: authIdentity.source,
                    accessSource: authIdentity.accessSource || null,
                    error: 'Auth email target does not match authenticated login.'
                }));
                return;
            }
        }

        if (isAuthPasswordResetEmailRequest) {
            const result = await dispatchAuthPasswordResetEmail(requestBody, requestOrigin, authIdentity.login || authIdentity.email || '');
            sendJson(res, 200, {
                ok: true,
                delivery: 'smtp',
                sentAt: result.sentAt,
                messageId: result.messageId,
                issuedFor: {
                    uid: authIdentity.uid || null,
                    email: authEmailRequestContext?.issuedEmail || null
                },
                requestContext: {
                    source: requestBody?.source || null,
                    authSource: authIdentity.source,
                    accessSource: authIdentity.accessSource || null
                }
            }, requestOrigin);
            logRequestEvent('info', buildRequestLogContext(req, requestId, {
                status: 200,
                durationMs: Date.now() - startedAt,
                mode: requestMode,
                authSource: authIdentity.source,
                accessSource: authIdentity.accessSource || null
            }));
            return;
        }

        if (isAuthMagicLinkEmailRequest) {
            const result = await dispatchAuthMagicLinkEmail(requestBody, requestOrigin, authIdentity.login || authIdentity.email || '');
            sendJson(res, 200, {
                ok: true,
                delivery: 'smtp',
                purpose: result.purpose,
                sentAt: result.sentAt,
                messageId: result.messageId,
                issuedFor: {
                    uid: authIdentity.uid || null,
                    email: authEmailRequestContext?.issuedEmail || null
                },
                requestContext: {
                    source: requestBody?.source || null,
                    authSource: authIdentity.source,
                    accessSource: authIdentity.accessSource || null
                }
            }, requestOrigin);
            logRequestEvent('info', buildRequestLogContext(req, requestId, {
                status: 200,
                durationMs: Date.now() - startedAt,
                mode: requestMode,
                authSource: authIdentity.source,
                accessSource: authIdentity.accessSource || null
            }));
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
            logRequestEvent('info', buildRequestLogContext(req, requestId, {
                status: 200,
                durationMs: Date.now() - startedAt,
                mode: requestMode,
                authSource: authIdentity.source,
                accessSource: authIdentity.accessSource || null
            }));
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
        logRequestEvent('info', buildRequestLogContext(req, requestId, {
            status: 200,
            durationMs: Date.now() - startedAt,
            mode: 'gemini-token',
            authSource: authIdentity.source,
            accessSource: authIdentity.accessSource || null
        }));
    } catch (error) {
        const message = String(error?.message || 'Failed to create voice session token');
        const status = Number.isInteger(error?.statusCode)
            ? error.statusCode
            : /MISSING|INVALID|EXPIRED|TOKEN/i.test(message)
                ? 401
                : 500;
        const errorCode = error?.cause?.code || error?.code || (status === 401 ? 'unauthorized' : 'server_error');
        const meta = {};
        if (error?.cause?.limitBytes) {
            meta.limitBytes = error.cause.limitBytes;
        }
        sendApiError(res, status, message, errorCode, requestOrigin, meta);
        logRequestEvent('error', buildRequestLogContext(req, requestId, {
            status,
            durationMs: Date.now() - startedAt,
            error: message
        }));
    }
}

if (isDirectRun) {
    const endpointConfig = getEndpointConfigStatus();
    if (!hasAnyConfiguredEndpoint(endpointConfig)) {
        const messages = Array.from(new Set(
            Object.values(endpointConfig)
                .map((entry) => String(entry?.missingConfig || '').trim())
                .filter(Boolean)
        ));
        console.warn(
            `[gemini-token-server] ${messages.join(' ')} Health endpoint will report 503 until configuration is fixed.`
        );
    }

    const server = createServer(handleTokenServerRequest);
    server.listen(PORT, () => {
        console.log(`[gemini-token-server] listening on http://localhost:${PORT} (paths: ${TOKEN_PATH}, ${TRANSCRIBE_PATH}, ${PARTNER_INVITE_EMAIL_PATH}, ${AUTH_MAGIC_LINK_EMAIL_PATH}, ${AUTH_PASSWORD_RESET_EMAIL_PATH}, ${SIMULATOR_WEBHOOK_PROXY_PATH}, ${CERTIFICATION_WEBHOOK_PROXY_PATH}, ${HEALTH_PATH})`);
    });
}
