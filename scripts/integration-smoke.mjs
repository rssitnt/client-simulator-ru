import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'output', 'playwright');
const login = 'smoke.admin@7271155.ru';
const fio = 'Integration Smoke';
const mimeTypes = new Map([
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'application/javascript; charset=utf-8'],
    ['.css', 'text/css; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.svg', 'image/svg+xml'],
    ['.png', 'image/png'],
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.ico', 'image/x-icon'],
    ['.webmanifest', 'application/manifest+json'],
    ['.txt', 'text/plain; charset=utf-8']
]);

const firebaseAppStub = `
export function initializeApp(config = {}) {
  return { config };
}
`.trim();

const firebaseDatabaseStub = `
const dbState = globalThis.__codexFirebaseDbState || (globalThis.__codexFirebaseDbState = {
  data: {},
  listeners: []
});

function normalizePath(value = '') {
  let normalized = String(value || '');
  while (normalized.startsWith('/')) {
    normalized = normalized.slice(1);
  }
  while (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

function clone(value) {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
}

function getSegments(path = '') {
  return normalizePath(path).split('/').filter(Boolean);
}

function readPath(path = '') {
  const segments = getSegments(path);
  let cursor = dbState.data;
  for (const segment of segments) {
    if (!cursor || typeof cursor !== 'object' || !(segment in cursor)) {
      return null;
    }
    cursor = cursor[segment];
  }
  return clone(cursor);
}

function writePath(path = '', value) {
  const segments = getSegments(path);
  if (!segments.length) {
    dbState.data = clone(value) || {};
    notifyListeners();
    return;
  }

  if (!dbState.data || typeof dbState.data !== 'object') {
    dbState.data = {};
  }

  let cursor = dbState.data;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (!cursor[segment] || typeof cursor[segment] !== 'object') {
      cursor[segment] = {};
    }
    cursor = cursor[segment];
  }

  const lastSegment = segments[segments.length - 1];
  const normalizedValue = clone(value);
  if (normalizedValue === null) {
    delete cursor[lastSegment];
  } else {
    cursor[lastSegment] = normalizedValue;
  }
  notifyListeners();
}

function updatePath(path = '', patch) {
  const current = readPath(path);
  const base = current && typeof current === 'object' ? current : {};
  const normalizedPatch = patch && typeof patch === 'object' ? clone(patch) : {};
  writePath(path, { ...base, ...normalizedPatch });
}

function createSnapshot(path = '') {
  const value = readPath(path);
  return {
    exists() { return value !== null && value !== undefined; },
    val() { return clone(value); }
  };
}

function notifyListeners() {
  for (const listener of dbState.listeners) {
    try {
      listener.callback(createSnapshot(listener.path));
    } catch {}
  }
}

export function getDatabase() {
  return { __codexStubDb: true };
}

export function ref(_db, path = '') {
  return { path: normalizePath(path) };
}

export function onValue(reference, callback) {
  const listener = {
    path: normalizePath(reference?.path),
    callback
  };
  dbState.listeners.push(listener);
  queueMicrotask(() => {
    callback(createSnapshot(listener.path));
  });
  return () => {
    dbState.listeners = dbState.listeners.filter((item) => item !== listener);
  };
}

export async function set(reference, value) {
  writePath(reference?.path, value);
  return null;
}

export async function get(reference) {
  return createSnapshot(reference?.path);
}

export async function update(reference, value) {
  updatePath(reference?.path, value);
  return null;
}
export function onDisconnect() {
  return {
    async set() { return null; },
    async update() { return null; },
    async cancel() { return null; }
  };
}
export function serverTimestamp() { return Date.now(); }
`.trim();

const firebaseAuthStub = `
const authInstance = {
  currentUser: null
};
export function getAuth() {
  return authInstance;
}
export async function sendSignInLinkToEmail() { return null; }
export async function sendPasswordResetEmail() { return null; }
export function isSignInWithEmailLink() { return false; }
export async function signInWithEmailLink() {
  return { user: null };
}
export async function signInWithEmailAndPassword(_auth, email) {
  authInstance.currentUser = { email };
  return { user: authInstance.currentUser };
}
export async function createUserWithEmailAndPassword(_auth, email) {
  authInstance.currentUser = { email };
  return { user: authInstance.currentUser };
}
export async function signOut() {
  authInstance.currentUser = null;
  return null;
}
`.trim();

const firebaseAppCheckStub = `
export class ReCaptchaV3Provider {
  constructor(siteKey) {
    this.siteKey = siteKey;
  }
}
export function initializeAppCheck() {
  return { token: null };
}
export async function getToken() {
  return { token: '' };
}
`.trim();

function expect(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function logStep(message) {
    process.stdout.write(`[integration-smoke] ${message}\n`);
}

function isRetryableRatingSmokeError(message) {
    const normalized = String(message || '').toLowerCase();
    return (
        normalized.includes('таймаут') ||
        normalized.includes('timeout') ||
        normalized.includes('failed to fetch') ||
        normalized.includes('networkerror') ||
        normalized.includes('http 5')
    );
}

function loginToStorageKey(value) {
    return Array.from(String(value || '').trim().toLowerCase())
        .map((char) => char.codePointAt(0).toString(16))
        .join('_');
}

function buildSeedPayload() {
    const nowIso = new Date().toISOString();
    const userKey = loginToStorageKey(login);
    const localhostDevAuthUser = {
        uid: null,
        login,
        fio,
        role: 'admin',
        passwordHash: '',
        passwordNeedsSetup: false,
        emailVerifiedAt: nowIso,
        emailVerificationSentAt: null,
        failedLoginAttempts: 0,
        isBlocked: false,
        blockedReason: null,
        failedLoginBackoffUntil: null,
        blockedAt: null,
        sessionRevokedAt: null,
        passwordHashScheme: null,
        createdAt: nowIso,
        lastLoginAt: nowIso,
        lastSeenAt: nowIso,
        activeMs: 0
    };
    return {
        authSession: JSON.stringify({
            login,
            signedAt: nowIso,
            devBypass: true
        }),
        authUsers: JSON.stringify({
            [userKey]: localhostDevAuthUser
        }),
        localhostDevAuthUser: JSON.stringify(localhostDevAuthUser),
        prompts: {
            systemPrompt: 'Ты клиент. Отвечай реалистично и по делу.',
            managerPrompt: 'Подсказывай менеджеру коротко.',
            managerCallPrompt: 'Симулируй клиента в звонке.',
            raterPrompt: 'Оцени диалог кратко и структурированно.'
        },
        publicPromptSnapshot: JSON.stringify({
            v: 1,
            t: Date.now(),
            data: {
                client_prompt: 'Ты клиент. Отвечай реалистично и по делу.',
                manager_prompt: 'Подсказывай менеджеру коротко.',
                manager_call_prompt: 'Симулируй клиента в звонке.',
                rater_prompt: 'Оцени диалог кратко и структурированно.'
            }
        }),
        webhookDebugConfig: JSON.stringify({
            ratingAttempts: 1,
            ratingTimeoutMs: 45000,
            ratingRetryBaseMs: 400,
            ratingRetryMaxMs: 1200
        })
    };
}

async function ensureOutputDir() {
    await mkdir(outputDir, { recursive: true });
}

function createStaticFileServer(rootDir) {
    const server = createServer(async (req, res) => {
        try {
            const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
            const pathname = decodeURIComponent(requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname);
            const candidatePath = path.normalize(path.join(rootDir, pathname));
            if (!candidatePath.startsWith(rootDir)) {
                res.writeHead(403).end('Forbidden');
                return;
            }

            let filePath = candidatePath;
            let fileStat = null;
            try {
                fileStat = await stat(filePath);
            } catch {
                res.writeHead(404).end('Not found');
                return;
            }

            if (fileStat.isDirectory()) {
                filePath = path.join(filePath, 'index.html');
            }

            const content = await readFile(filePath);
            const ext = path.extname(filePath).toLowerCase();
            res.writeHead(200, {
                'Content-Type': mimeTypes.get(ext) || 'application/octet-stream',
                'Cache-Control': 'no-store'
            });
            res.end(content);
        } catch (error) {
            res.writeHead(500).end(String(error?.message || error));
        }
    });

    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            resolve({
                server,
                baseUrl: `http://127.0.0.1:${address.port}/index.html`
            });
        });
    });
}

async function installIntegrationRoutes(context) {
    await context.route('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/javascript', body: firebaseAppStub });
    });
    await context.route('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/javascript', body: firebaseDatabaseStub });
    });
    await context.route('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/javascript', body: firebaseAuthStub });
    });
    await context.route('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-check.js', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/javascript', body: firebaseAppCheckStub });
    });
    await context.route('http://127.0.0.1:7243/**', async (route) => {
        await route.fulfill({ status: 204, body: '' });
    });
}

async function seedLocalState(context) {
    const seed = buildSeedPayload();
    await context.addInitScript((payload) => {
        localStorage.setItem('authSession:v1', payload.authSession);
        localStorage.setItem('authUsers:v1', payload.authUsers);
        localStorage.setItem('localhostDevAuthUser:v1', payload.localhostDevAuthUser);
        localStorage.setItem('managerName', 'Integration Smoke');
        localStorage.setItem('managerLogin', 'smoke.admin@7271155.ru');
        localStorage.setItem('userRole', 'admin');
        localStorage.setItem('systemPrompt', payload.prompts.systemPrompt);
        localStorage.setItem('managerPrompt', payload.prompts.managerPrompt);
        localStorage.setItem('managerCallPrompt', payload.prompts.managerCallPrompt);
        localStorage.setItem('raterPrompt', payload.prompts.raterPrompt);
        localStorage.setItem('promptPublicSnapshot:v1', payload.publicPromptSnapshot);
        localStorage.setItem('webhookDebugConfig:v1', payload.webhookDebugConfig);
    }, seed);
}

async function waitForChatReady(page) {
    await page.waitForSelector('#startBtn');
    const localhostDevAuthBtn = page.locator('#localhostDevAuthBtn');
    if (await localhostDevAuthBtn.count()) {
        const isModalOpen = await page.evaluate(() => document.getElementById('nameModal')?.classList.contains('active'));
        if (isModalOpen && await localhostDevAuthBtn.isVisible()) {
            await localhostDevAuthBtn.click();
        }
    }
    await page.waitForFunction(() => {
        const modal = document.getElementById('nameModal');
        return !modal || !modal.classList.contains('active');
    });
    await page.waitForFunction(() => {
        const startBtn = document.getElementById('startBtn');
        return !!startBtn && !startBtn.disabled;
    });
}

async function waitForNewConversationEvent(page, previousAssistantCount, previousNoticeCount) {
    await page.waitForFunction(
        ({ assistantCount, noticeCount }) => {
            const assistantMessages = document.querySelectorAll('.message.assistant').length;
            const notices = document.querySelectorAll('.conversation-action-note').length;
            const errors = document.querySelectorAll('.message.error').length;
            return assistantMessages > assistantCount || notices > noticeCount || errors > 0;
        },
        { assistantCount: previousAssistantCount, noticeCount: previousNoticeCount },
        { timeout: 70000 }
    );
}

async function requestRatingThroughCurrentUi(page) {
    const terminalRateButton = page.locator('.conversation-action-note .btn-conversation-rate');
    if (await terminalRateButton.count()) {
        await terminalRateButton.first().click();
        return;
    }
    await page.click('#rateChat');
}

async function runIntegrationFlow(browser, baseUrl) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    const capturedWebhookRequests = [];
    await installIntegrationRoutes(context);
    await context.route('https://n8n-api.tradicia-k.ru/webhook*/**', async (route) => {
        try {
            const bodyText = route.request().postData() || '{}';
            const payload = JSON.parse(bodyText);
            capturedWebhookRequests.push({
                url: route.request().url(),
                payload
            });
        } catch {
            // Ignore malformed payloads in smoke capture, let request pass through.
        }
        await route.continue();
    });
    await seedLocalState(context);
    const page = await context.newPage();
    const hiddenRaterPrompt = `Integration hidden rater suffix ${Date.now()}`;
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', (error) => {
        pageErrors.push(String(error?.message || error || 'Unknown page error'));
    });
    page.on('console', (message) => {
        if (message.type() === 'error') {
            consoleErrors.push(message.text());
        }
    });

    try {
        logStep('open page');
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await waitForChatReady(page);

        logStep('configure hidden rater prompt');
        await page.evaluate((value) => {
            localStorage.setItem('raterHiddenPrompt:v1', value);
        }, hiddenRaterPrompt);
        await page.waitForFunction((expectedValue) => {
            return (localStorage.getItem('raterHiddenPrompt:v1') || '').includes(expectedValue);
        }, hiddenRaterPrompt);

        logStep('start conversation through live webhook');
        await page.click('#startBtn');
        await page.waitForFunction(() => {
            return document.querySelectorAll('.message.assistant, .conversation-action-note, .message.error').length > 0;
        }, { timeout: 70000 });

        const startErrorCount = await page.locator('.message.error').count();
        expect(startErrorCount === 0, 'Start conversation returned an error');

        const assistantCountBefore = await page.locator('.message.assistant').count();
        const noticeCountBefore = await page.locator('.conversation-action-note').count();

        logStep('send live follow-up');
        await page.fill('#userInput', 'Нужен гидробур на CASE CX260C, дайте решение по комплектации и срокам.');
        await page.click('#sendBtn');
        await waitForNewConversationEvent(page, assistantCountBefore, noticeCountBefore);

        const sendErrorCount = await page.locator('.message.error').count();
        expect(sendErrorCount === 0, 'Chat webhook returned an error after follow-up');

        logStep('request rating through live webhook');
        let previousRatingCount = await page.locator('.message.rating').count();
        let previousErrorCount = await page.locator('.message.error').count();
        let ratingSucceeded = false;

        for (let attempt = 1; attempt <= 2; attempt += 1) {
            await requestRatingThroughCurrentUi(page);
            await page.waitForFunction(
                ({ ratingCount, errorCount }) => {
                    return document.querySelectorAll('.message.rating').length > ratingCount ||
                        document.querySelectorAll('.message.error').length > errorCount;
                },
                { ratingCount: previousRatingCount, errorCount: previousErrorCount },
                { timeout: 85000 }
            );

            const ratingCount = await page.locator('.message.rating').count();
            if (ratingCount > previousRatingCount) {
                ratingSucceeded = true;
                break;
            }

            const ratingErrorCount = await page.locator('.message.error').count();
            const latestErrorText = ratingErrorCount > 0
                ? String(await page.locator('.message.error').last().textContent() || '').trim()
                : '';
            if (attempt < 2 && isRetryableRatingSmokeError(latestErrorText)) {
                logStep(`retry rating after transient error: ${latestErrorText}`);
                previousRatingCount = ratingCount;
                previousErrorCount = ratingErrorCount;
                continue;
            }

            expect(false, `Rating webhook returned an error${latestErrorText ? `: ${latestErrorText}` : ''}`);
        }

        expect(ratingSucceeded, 'Rating message was not rendered');
        const ratingRequest = capturedWebhookRequests.find((item) => item?.payload?.requestType === 'rating');
        expect(!!ratingRequest, 'Rating webhook payload was not captured');
        const effectiveRaterPrompt = String(ratingRequest?.payload?.raterPrompt || '');
        expect(effectiveRaterPrompt.includes(hiddenRaterPrompt), 'Hidden rater prompt was not attached in integration rating payload');
        expect(!effectiveRaterPrompt.includes('СЛУЖЕБНЫЙ КОНТРАКТ ФОРМАТА ОЦЕНКИ'), 'Fixed rating contract must not be attached in integration rating payload');
    } catch (error) {
        await ensureOutputDir();
        await page.screenshot({ path: path.join(outputDir, 'integration-smoke-failure.png'), fullPage: true });
        let debugState = null;
        try {
            debugState = await page.evaluate(() => ({
                hasTestHooks: !!window.__CLIENT_SIMULATOR_TEST_HOOKS__,
                settingsOpen: !!document.getElementById('settingsModal')?.classList.contains('active'),
                nameModalOpen: !!document.getElementById('nameModal')?.classList.contains('active'),
                startBtnDisabled: document.getElementById('startBtn')?.disabled ?? null,
                assistantMessages: document.querySelectorAll('.message.assistant').length,
                errorMessages: Array.from(document.querySelectorAll('.message.error')).map((node) => String(node.textContent || '').trim()),
                currentUrl: location.href
            }));
        } catch {}
        const details = [
            pageErrors.length ? `pageErrors=${JSON.stringify(pageErrors)}` : '',
            consoleErrors.length ? `consoleErrors=${JSON.stringify(consoleErrors)}` : '',
            debugState ? `debugState=${JSON.stringify(debugState)}` : ''
        ].filter(Boolean).join('\n');
        throw new Error(details ? `${error.message}\n${details}` : error.message, { cause: error });
    } finally {
        await context.close();
    }
}

async function main() {
    await ensureOutputDir();
    const { server, baseUrl } = await createStaticFileServer(projectRoot);
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-first-run', '--no-default-browser-check']
    });

    try {
        await runIntegrationFlow(browser, baseUrl);
        logStep('integration smoke passed');
    } finally {
        await browser.close();
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
}

main().catch((error) => {
    console.error('[integration-smoke] failed:', error);
    process.exitCode = 1;
});
