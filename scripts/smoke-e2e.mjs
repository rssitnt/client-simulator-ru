import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'output', 'playwright');
const login = 'smoke.admin@7271155.ru';
const fio = 'Смоук Тестер';
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
export function getDatabase() { return null; }
export function ref(...args) { return { args }; }
export function onValue(...args) { return () => {}; }
export async function set() { return null; }
export async function get() {
  return {
    exists() { return false; },
    val() { return null; }
  };
}
export async function update() { return null; }
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
export function getAuth() {
  return {
    currentUser: null
  };
}
export async function sendSignInLinkToEmail() { return null; }
export function isSignInWithEmailLink() { return false; }
export async function signInWithEmailLink() {
  return { user: null };
}
`.trim();

function expect(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function logStep(message) {
    process.stdout.write(`[smoke] ${message}\n`);
}

function loginToStorageKey(value) {
    return Array.from(String(value || '').trim().toLowerCase())
        .map((char) => char.codePointAt(0).toString(16))
        .join('_');
}

function buildSeedPayload() {
    const nowIso = new Date().toISOString();
    const userKey = loginToStorageKey(login);
    return {
        authSession: JSON.stringify({
            login,
            signedAt: nowIso
        }),
        authUsers: JSON.stringify({
            [userKey]: {
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
            }
        }),
        prompts: {
            systemPrompt: 'Ты клиент. Отвечай реалистично и по делу.',
            managerPrompt: 'Подсказывай менеджеру коротко.',
            managerCallPrompt: 'Симулируй клиента в звонке.',
            raterPrompt: 'Оцени диалог кратко и структурированно.'
        }
    };
}

function findBrowserExecutable() {
    const candidates = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    ];

    return candidates.find((candidate) => candidate && existsSync(candidate)) || '';
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
            } catch (error) {
                res.writeHead(404).end('Not found');
                return;
            }

            if (fileStat.isDirectory()) {
                filePath = path.join(filePath, 'index.html');
                fileStat = await stat(filePath);
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

async function installCommonRoutes(context, scenario) {
    await context.route('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/javascript', body: firebaseAppStub });
    });
    await context.route('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/javascript', body: firebaseDatabaseStub });
    });
    await context.route('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/javascript', body: firebaseAuthStub });
    });
    await context.route('http://127.0.0.1:7243/**', async (route) => {
        await route.fulfill({ status: 204, body: '' });
    });
    await context.route('https://n8n-api.tradicia-k.ru/webhook/**', async (route) => {
        const url = route.request().url();
        const bodyText = route.request().postData() || '{}';
        const payload = JSON.parse(bodyText);
        scenario.requests.push({ url, payload });

        if (url.endsWith('/client-simulator')) {
            const responsePayload = scenario.handleChat(payload);
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(responsePayload)
            });
            return;
        }

        if (url.endsWith('/rate-manager')) {
            await route.fulfill({
                status: 200,
                contentType: 'text/plain; charset=utf-8',
                body: 'Smoke rating done\nИтог: сценарий завершился корректно.'
            });
            return;
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true })
        });
    });
}

async function seedLocalState(context) {
    const seed = buildSeedPayload();
    await context.addInitScript((payload) => {
        localStorage.setItem('authSession:v1', payload.authSession);
        localStorage.setItem('authUsers:v1', payload.authUsers);
        localStorage.setItem('managerName', 'Смоук Тестер');
        localStorage.setItem('managerLogin', 'smoke.admin@7271155.ru');
        localStorage.setItem('userRole', 'admin');
        localStorage.setItem('systemPrompt', payload.prompts.systemPrompt);
        localStorage.setItem('managerPrompt', payload.prompts.managerPrompt);
        localStorage.setItem('managerCallPrompt', payload.prompts.managerCallPrompt);
        localStorage.setItem('raterPrompt', payload.prompts.raterPrompt);
    }, seed);
}

function createEndConversationScenario() {
    return {
        requests: [],
        chatCount: 0,
        handleChat(payload) {
            if (payload.chatInput === '/start') {
                return { message: 'Здравствуйте. Что у вас за задача?' };
            }
            this.chatCount += 1;
            return {
                message: 'Понял. Тогда дальше неинтересно.',
                conversationAction: {
                    type: 'end_conversation',
                    reason: 'lost_interest',
                    shouldEvaluate: true
                }
            };
        }
    };
}

function createGoSilentScenario() {
    return {
        requests: [],
        chatCount: 0,
        handleChat(payload) {
            if (payload.chatInput === '/start') {
                return { message: 'Добрый день. Что предлагаете?' };
            }
            this.chatCount += 1;
            if (this.chatCount === 1) {
                return {
                    message: '',
                    conversationAction: {
                        type: 'go_silent',
                        reason: 'lost_interest'
                    }
                };
            }
            return {
                message: 'Спасибо, но уже не актуально.',
                conversationAction: {
                    type: 'end_conversation',
                    reason: 'resolved',
                    shouldEvaluate: true
                }
            };
        }
    };
}

async function waitForChatReady(page) {
    await page.waitForSelector('#startBtn');
    await page.waitForFunction(() => {
        const modal = document.getElementById('nameModal');
        return !modal || !modal.classList.contains('active');
    });
    await page.waitForFunction(() => {
        const startBtn = document.getElementById('startBtn');
        return !!startBtn && !startBtn.disabled;
    });
}

async function runEndConversationFlow(browser, baseUrl) {
    const scenario = createEndConversationScenario();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await installCommonRoutes(context, scenario);
    await seedLocalState(context);
    const page = await context.newPage();

    try {
        logStep('run end_conversation scenario');
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await waitForChatReady(page);
        await page.click('#startBtn');
        await page.waitForSelector('text=Здравствуйте. Что у вас за задача?');

        await page.fill('#userInput', 'уходи');
        await page.click('#sendBtn');
        await page.waitForSelector('text=Диалог завершен');
        await page.waitForSelector('.conversation-action-note .btn-conversation-rate');

        const isInputDisabled = await page.locator('#userInput').isDisabled();
        expect(isInputDisabled, 'Input must be locked after end_conversation');

        await page.click('.conversation-action-note .btn-conversation-rate');
        await page.waitForSelector('text=Smoke rating done');
        await page.waitForSelector('text=Диалог завершен');
        expect(scenario.requests.some((item) => item.url.endsWith('/rate-manager')), 'Rating webhook was not called');
    } catch (error) {
        await ensureOutputDir();
        await page.screenshot({ path: path.join(outputDir, 'smoke-end-conversation-failure.png'), fullPage: true });
        throw error;
    } finally {
        await context.close();
    }
}

async function runGoSilentFlow(browser, baseUrl) {
    const scenario = createGoSilentScenario();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await installCommonRoutes(context, scenario);
    await seedLocalState(context);
    const page = await context.newPage();

    try {
        logStep('run go_silent scenario');
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await waitForChatReady(page);
        await page.click('#startBtn');
        await page.waitForSelector('text=Добрый день. Что предлагаете?');

        await page.fill('#userInput', 'пришлите просто общий прайс');
        await page.click('#sendBtn');
        await page.waitForSelector('text=Клиент не ответил, но его ещё можно вернуть');

        const isInputDisabledAfterSilent = await page.locator('#userInput').isDisabled();
        expect(!isInputDisabledAfterSilent, 'Input must remain enabled after go_silent');

        await page.fill('#userInput', 'возвращаю клиента конкретикой');
        await page.click('#sendBtn');
        await page.waitForSelector('text=Диалог завершен');

        const secondChatRequest = scenario.requests
            .filter((item) => item.url.endsWith('/client-simulator') && item.payload.chatInput !== '/start')[1];
        expect(secondChatRequest?.payload?.conversationActionState?.type === 'go_silent', 'go_silent state was not forwarded to the next chat request');
    } catch (error) {
        await ensureOutputDir();
        await page.screenshot({ path: path.join(outputDir, 'smoke-go-silent-failure.png'), fullPage: true });
        throw error;
    } finally {
        await context.close();
    }
}

async function main() {
    const executablePath = findBrowserExecutable();
    expect(executablePath, 'Не найден локальный Chrome/Edge для smoke e2e. Установите Chrome или Edge.');
    await ensureOutputDir();
    const { server, baseUrl } = await createStaticFileServer(projectRoot);
    const browser = await chromium.launch({
        executablePath,
        headless: true,
        args: ['--no-first-run', '--no-default-browser-check']
    });

    try {
        await runEndConversationFlow(browser, baseUrl);
        await runGoSilentFlow(browser, baseUrl);
        logStep('all smoke scenarios passed');
    } finally {
        await browser.close();
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
}

main().catch((error) => {
    console.error('[smoke] failed:', error);
    process.exitCode = 1;
});
