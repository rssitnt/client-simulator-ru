import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdir, readFile, stat } from 'node:fs/promises';
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
export async function sendSignInLinkToEmail() {
  const delayMs = Number(globalThis.__codexAuthSendLinkDelayMs || 0);
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}
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

function buildLocalPromptsStorageKey() {
    return `localPrompts:v3:login:${loginToStorageKey(login)}`;
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
    await context.route('https://n8n-api.tradicia-k.ru/webhook*/**', async (route) => {
        const url = route.request().url();
        const bodyText = route.request().postData() || '{}';
        const payload = JSON.parse(bodyText);
        scenario.requests.push({ url, payload });
        const requestType = String(payload.requestType || '').trim();

        if (requestType === 'rating') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json; charset=utf-8',
                body: JSON.stringify({
                    summary: 'Smoke rating done',
                    outcome: 'end_conversation',
                    outcomeReason: 'lost_interest',
                    whatKilledDialogue: 'Менеджер слишком быстро отпустил клиента без попытки удержать разговор.',
                    whatWasSalvageable: 'До финального слива диалог ещё можно было вернуть конкретикой по решению и следующему шагу.',
                    whyClientLeft: 'Клиент не увидел смысла продолжать разговор без уверенного предложения.',
                    managerMistakes: [
                        'Не удержал клиента после первого сигнала потери интереса',
                        'Не предложил конкретный следующий шаг'
                    ],
                    crmActions: [
                        'Перезвонить клиенту с конкретной комплектацией',
                        'Зафиксировать потерю по причине слабой обработки'
                    ]
                })
            });
            return;
        }

        if (requestType === 'manager_assist') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Сначала уточню задачу и ограничения по срокам.' })
            });
            return;
        }

        if (requestType === 'chat' || requestType === 'chat_start' || Object.prototype.hasOwnProperty.call(payload, 'chatInput')) {
            const responsePayload = scenario.handleChat(payload);
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(responsePayload)
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
        localStorage.setItem('promptPublicSnapshot:v1', payload.publicPromptSnapshot);
    }, seed);
}

async function seedAuthFlowState(context, options = {}) {
    const authUsers = options.authUsers || {};
    const authSession = options.authSession || null;
    const sendDelayMs = Number(options.sendDelayMs || 0);

    await context.addInitScript((payload) => {
        if (sessionStorage.getItem('__codexAuthFlowSeeded') === '1') {
            globalThis.__codexAuthSendLinkDelayMs = payload.sendDelayMs || 0;
            return;
        }
        sessionStorage.setItem('__codexAuthFlowSeeded', '1');
        localStorage.removeItem('authSession:v1');
        localStorage.setItem('authUsers:v1', JSON.stringify(payload.authUsers || {}));
        localStorage.removeItem('managerName');
        localStorage.removeItem('managerLogin');
        localStorage.removeItem('userRole');
        if (payload.authSession) {
            localStorage.setItem('authSession:v1', payload.authSession);
        }
        globalThis.__codexAuthSendLinkDelayMs = payload.sendDelayMs || 0;
    }, {
        authUsers,
        authSession,
        sendDelayMs
    });
}

async function seedBrokenEmptyLocalPromptOverride(context) {
    const storageKey = buildLocalPromptsStorageKey();
    await context.addInitScript((key) => {
        localStorage.setItem(key, JSON.stringify({
            client_variations: [
                {
                    id: 'broken-empty-local-client',
                    name: 'Основной',
                    content: ''
                }
            ],
            client_activeId: 'broken-empty-local-client'
        }));
    }, storageKey);
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

function createIdleScenario() {
    return {
        requests: [],
        handleChat(payload) {
            if (payload.chatInput === '/start') {
                return { message: 'Готов обсудить задачу.' };
            }
            return { message: 'Ок.' };
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
    await page.waitForFunction(() => {
        const textarea = document.getElementById('systemPrompt');
        const preview = document.getElementById('systemPromptPreview');
        const textareaValue = String(textarea?.value || '');
        const previewText = String(preview?.innerText || '').trim();
        return textareaValue.trim().length > 0 && previewText.length > 0;
    });
}

async function openSettings(page) {
    await page.click('#settingsBtn');
    await page.waitForSelector('#settingsModal.active');
}

async function closeSettings(page) {
    await page.click('#settingsBtn');
    await page.waitForFunction(() => !document.getElementById('settingsModal')?.classList.contains('active'));
}

async function ensureDetailsOpen(page, selector) {
    await page.evaluate((targetSelector) => {
        const details = document.querySelector(targetSelector);
        if (details && !details.hasAttribute('open')) {
            details.setAttribute('open', '');
        }
    }, selector);
}

async function runPromptWorkflowFlow(browser, baseUrl) {
    const scenario = createIdleScenario();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await installCommonRoutes(context, scenario);
    await seedLocalState(context);
    const page = await context.newPage();

    try {
        logStep('run prompt compare/publish/rollback scenario');
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await waitForChatReady(page);

        const originalContent = await page.evaluate(() => document.getElementById('systemPrompt')?.value || '');

        await page.click('#promptVisibilityBtn');
        await page.waitForFunction(() => {
            const btn = document.getElementById('promptCompareBtn');
            return !!btn && getComputedStyle(btn).display !== 'none';
        });

        await page.evaluate(() => {
            const preview = document.getElementById('systemPromptPreview');
            preview.innerHTML = `${preview.innerHTML}<p>Smoke draft</p>`;
            preview.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await page.evaluate(() => window.__CLIENT_SIMULATOR_TEST_HOOKS__.forceEndPromptEditing('client'));
        await page.waitForFunction(() => {
            return (document.getElementById('systemPrompt')?.value || '').includes('Smoke draft');
        });

        await page.click('#promptCompareBtn');
        await page.waitForSelector('#promptCompareModal.active');
        await page.waitForFunction(() => {
            return (document.getElementById('promptCompareDiffView')?.textContent || '').includes('Smoke draft');
        });
        await page.click('#promptComparePublish');
        await page.waitForFunction(() => !document.getElementById('promptCompareModal')?.classList.contains('active'));

        const publishedContent = await page.evaluate(() => document.getElementById('systemPrompt')?.value || '');
        expect(publishedContent.includes('Smoke draft'), 'Published prompt content did not persist');

        await page.waitForFunction(() => {
            const btn = document.getElementById('promptRollbackBtn');
            return !!btn && getComputedStyle(btn).display !== 'none';
        });
        await page.click('#promptRollbackBtn');
        await page.waitForFunction((expectedContent) => {
            return (document.getElementById('systemPrompt')?.value || '') === expectedContent;
        }, originalContent);
    } catch (error) {
        await ensureOutputDir();
        await page.screenshot({ path: path.join(outputDir, 'smoke-prompt-workflow-failure.png'), fullPage: true });
        throw error;
    } finally {
        await context.close();
    }
}

async function runScenarioLibraryFlow(browser, baseUrl) {
    const scenario = createIdleScenario();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await installCommonRoutes(context, scenario);
    await seedLocalState(context);
    const page = await context.newPage();
    const scenarioId = 'service-risk';
    const scenarioMarker = 'SCENARIO_ID: service-risk';

    try {
        logStep('run scenario library quick-start scenario');
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await waitForChatReady(page);

        await page.waitForFunction(() => {
            const strip = document.getElementById('activeScenarioStrip');
            if (!strip) return false;
            const style = getComputedStyle(strip);
            return strip.hidden && style.display === 'none';
        });

        await openSettings(page);
        await ensureDetailsOpen(page, '#adminScenarioLibraryAccordion');
        await page.click(`[data-scenario-action="apply"][data-scenario-id="${scenarioId}"]`);
        await page.waitForFunction((expectedId) => {
            const storedId = localStorage.getItem('activeTestScenario:v1') || '';
            const userInput = document.getElementById('userInput');
            const strip = document.getElementById('activeScenarioStrip');
            return storedId === expectedId
                && (userInput?.value || '').trim().length > 20
                && !!strip
                && !strip.hidden;
        }, scenarioId);
        const starterMessage = await page.evaluate(() => (document.getElementById('userInput')?.value || '').trim());
        expect(starterMessage.length > 20, 'Scenario starter message was not prefilled');
        await closeSettings(page);

        await page.click('#activeScenarioStartBtn');
        await page.waitForSelector('text=Готов обсудить задачу.');
        await page.waitForSelector('text=Ок.');

        const startRequest = scenario.requests.find((item) => item.payload.requestType === 'chat_start' && item.payload.chatInput === '/start');
        const firstChatRequest = scenario.requests.find((item) => item.payload.requestType === 'chat' && item.payload.chatInput !== '/start');
        expect(startRequest?.payload?.systemPrompt?.includes(scenarioMarker), 'Scenario marker was not appended to start systemPrompt');
        expect(firstChatRequest?.payload?.chatInput === starterMessage, 'Scenario starter message was not sent to chat webhook');
    } catch (error) {
        await ensureOutputDir();
        await page.screenshot({ path: path.join(outputDir, 'smoke-scenario-library-failure.png'), fullPage: true });
        throw error;
    } finally {
        await context.close();
    }
}

async function runHiddenClientPromptFlow(browser, baseUrl) {
    const scenario = createIdleScenario();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await installCommonRoutes(context, scenario);
    await seedLocalState(context);
    const page = await context.newPage();
    const hiddenPrompt = `Smoke hidden suffix ${Date.now()}`;

    try {
        logStep('run hidden client prompt persistence scenario');
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await waitForChatReady(page);

        await openSettings(page);
        await ensureDetailsOpen(page, '#adminHiddenClientPromptAccordion');
        await page.fill('#adminHiddenClientPromptInput', hiddenPrompt);
        await page.click('#adminHiddenClientPromptSaveBtn');
        await page.waitForFunction((expectedValue) => {
            return (localStorage.getItem('clientConversationActionPrompt:v1') || '').includes(expectedValue);
        }, hiddenPrompt);

        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForChatReady(page);
        await openSettings(page);
        await ensureDetailsOpen(page, '#adminHiddenClientPromptAccordion');
        await page.waitForFunction((expectedValue) => {
            return (document.getElementById('adminHiddenClientPromptInput')?.value || '').includes(expectedValue);
        }, hiddenPrompt);
        await closeSettings(page);

        await page.click('#startBtn');
        await page.waitForSelector('text=Готов обсудить задачу.');
        const startRequest = scenario.requests.find((item) => item.payload.requestType === 'chat_start' && item.payload.chatInput === '/start');
        expect(startRequest?.payload?.systemPrompt?.includes(hiddenPrompt), 'Hidden client prompt was not appended to webhook systemPrompt');
    } catch (error) {
        await ensureOutputDir();
        await page.screenshot({ path: path.join(outputDir, 'smoke-hidden-client-prompt-failure.png'), fullPage: true });
        throw error;
    } finally {
        await context.close();
    }
}

async function runBrokenLocalPromptRecoveryFlow(browser, baseUrl) {
    const scenario = createIdleScenario();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await installCommonRoutes(context, scenario);
    await seedLocalState(context);
    await seedBrokenEmptyLocalPromptOverride(context);
    const page = await context.newPage();

    try {
        logStep('run broken empty local prompt recovery scenario');
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await waitForChatReady(page);

        await page.waitForFunction(() => {
            const hooks = window.__CLIENT_SIMULATOR_TEST_HOOKS__;
            const state = hooks?.getPromptUiState?.('client');
            return !!state
                && !state.activeIsLocal
                && String(state.activeContent || '').trim().length > 0;
        });
    } catch (error) {
        await ensureOutputDir();
        await page.screenshot({ path: path.join(outputDir, 'smoke-broken-local-prompt-recovery-failure.png'), fullPage: true });
        throw error;
    } finally {
        await context.close();
    }
}

async function runRolePreviewVisibilityFlow(browser, baseUrl) {
    const scenario = createIdleScenario();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await installCommonRoutes(context, scenario);
    await seedLocalState(context);
    const page = await context.newPage();
    const adminOnlyText = `Smoke admin secret ${Date.now()}`;

    try {
        logStep('run admin/user preview visibility scenario');
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await waitForChatReady(page);

        const originalContent = await page.evaluate(() => document.getElementById('systemPrompt')?.value || '');
        await page.click('#promptVisibilityBtn');
        await page.evaluate((secret) => {
            const preview = document.getElementById('systemPromptPreview');
            preview.focus();
            preview.innerHTML = `${preview.innerHTML}<p>${secret}</p>`;
            preview.dispatchEvent(new Event('input', { bubbles: true }));
        }, adminOnlyText);
        await page.evaluate(() => window.__CLIENT_SIMULATOR_TEST_HOOKS__.forceEndPromptEditing('client'));
        await page.waitForFunction((expectedValue) => {
            return (window.__CLIENT_SIMULATOR_TEST_HOOKS__.getPromptUiState('client').activeContent || '').includes(expectedValue);
        }, adminOnlyText);

        await openSettings(page);
        await page.click('#changeRoleBtn');
        await page.waitForFunction(() => {
            return (document.getElementById('currentRoleDisplay')?.textContent || '').includes('Юзер');
        });
        await closeSettings(page);

        await page.waitForFunction((expectedPublicContent) => {
            const state = window.__CLIENT_SIMULATOR_TEST_HOOKS__.getPromptUiState('client');
            const visibilityBtn = document.getElementById('promptVisibilityBtn');
            const isVisibilityHidden = !visibilityBtn || getComputedStyle(visibilityBtn).display === 'none';
            return !state.activeIsLocal && state.activeContent === expectedPublicContent && isVisibilityHidden;
        }, originalContent);

        await openSettings(page);
        await page.click('#changeRoleBtn');
        await page.waitForFunction(() => {
            return (document.getElementById('currentRoleDisplay')?.textContent || '').includes('Админ');
        });
        await closeSettings(page);

        await page.waitForFunction((expectedValue) => {
            const state = window.__CLIENT_SIMULATOR_TEST_HOOKS__.getPromptUiState('client');
            const visibilityBtn = document.getElementById('promptVisibilityBtn');
            const isVisibilityVisible = !!visibilityBtn && getComputedStyle(visibilityBtn).display !== 'none';
            return state.activeIsLocal && (state.activeContent || '').includes(expectedValue) && isVisibilityVisible;
        }, adminOnlyText);
    } catch (error) {
        await ensureOutputDir();
        await page.screenshot({ path: path.join(outputDir, 'smoke-role-preview-visibility-failure.png'), fullPage: true });
        throw error;
    } finally {
        await context.close();
    }
}

async function runPromptConflictRecoveryFlow(browser, baseUrl) {
    const scenario = createIdleScenario();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await installCommonRoutes(context, scenario);
    await seedLocalState(context);
    const page = await context.newPage();
    const localDraftText = `Smoke conflict local ${Date.now()}`;
    const remoteAdminText = `Smoke remote admin ${Date.now()}`;

    try {
        logStep('run public prompt conflict recovery scenario');
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await waitForChatReady(page);

        const simulationResult = await page.evaluate(({ localText, remoteText }) => {
            window.__CLIENT_SIMULATOR_TEST_HOOKS__.forceBeginPromptEditing('client');
            const preview = document.getElementById('systemPromptPreview');
            preview.focus();
            preview.innerHTML = `${preview.innerHTML}<p>${localText}</p>`;
            preview.dispatchEvent(new Event('input', { bubbles: true }));

            const hooks = window.__CLIENT_SIMULATOR_TEST_HOOKS__;
            const snapshot = hooks.getPublicPromptsSnapshot();
            const activeId = snapshot.client_activeId;
            snapshot.client_prompt = remoteText;
            snapshot.client_variations = (snapshot.client_variations || []).map((variation) => (
                variation.id === activeId
                    ? { ...variation, content: remoteText }
                    : variation
            ));
            return hooks.simulateRemotePromptsSnapshot(snapshot);
        }, { localText: localDraftText, remoteText: remoteAdminText });

        expect(simulationResult?.deferred === true, 'Remote prompt snapshot was expected to defer during edit');

        await page.evaluate(() => window.__CLIENT_SIMULATOR_TEST_HOOKS__.forceEndPromptEditing('client'));
        await page.waitForFunction((expectedValue) => {
            const state = window.__CLIENT_SIMULATOR_TEST_HOOKS__.getPromptUiState('client');
            return state.activeIsLocal
                && (state.activeContent || '').includes(expectedValue)
                && (state.conflictMessage || '').includes('локальный скрытый draft');
        }, localDraftText);

        await page.waitForFunction(() => {
            const compareBtn = document.getElementById('promptCompareBtn');
            return !!compareBtn && getComputedStyle(compareBtn).display !== 'none';
        });
    } catch (error) {
        await ensureOutputDir();
        await page.screenshot({ path: path.join(outputDir, 'smoke-prompt-conflict-failure.png'), fullPage: true });
        throw error;
    } finally {
        await context.close();
    }
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
        await page.waitForFunction(() => {
            const ratingText = document.querySelector('.message.rating')?.textContent || '';
            return ratingText.includes('Smoke rating done') && ratingText.includes('Что убило диалог');
        });
        await page.waitForSelector('text=Диалог завершен');
        expect(scenario.requests.some((item) => item.payload.requestType === 'rating'), 'Rating webhook was not called');

        const startRequest = scenario.requests.find((item) => item.payload.requestType === 'chat_start' && item.payload.chatInput === '/start');
        const ratingRequest = scenario.requests.find((item) => item.payload.requestType === 'rating');
        expect(startRequest?.payload?.requestId, 'Start requestId was not captured');
        expect(ratingRequest?.payload?.requestId, 'Rating requestId was not captured');
        expect(ratingRequest?.payload?.conversationOutcome === 'end_conversation', 'Rating request must include conversation outcome');
        expect(String(ratingRequest?.payload?.raterPrompt || '').includes('СЛУЖЕБНЫЙ КОНТРАКТ ФОРМАТА ОЦЕНКИ'), 'Rating prompt contract was not attached');

        await page.click('#settingsBtn');
        await page.waitForSelector('#settingsModal.active');
        await page.click('#adminWebhookDebugAccordion > summary');
        await page.waitForFunction(({ startRequestId, ratingRequestId }) => {
            const text = document.getElementById('adminWebhookDebugList')?.textContent || '';
            return text.includes(startRequestId) && text.includes(ratingRequestId) && text.includes('Старт') && text.includes('Оценка');
        }, {
            startRequestId: startRequest.payload.requestId,
            ratingRequestId: ratingRequest.payload.requestId
        });

        await page.click('#adminWebhookDebugClearBtn');
        await page.waitForFunction(() => {
            return (document.getElementById('adminWebhookDebugList')?.textContent || '').includes('Лог пока пуст');
        });
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
            .filter((item) => item.payload.requestType === 'chat' && item.payload.chatInput !== '/start')[1];
        expect(secondChatRequest?.payload?.conversationActionState?.type === 'go_silent', 'go_silent state was not forwarded to the next chat request');
    } catch (error) {
        await ensureOutputDir();
        await page.screenshot({ path: path.join(outputDir, 'smoke-go-silent-failure.png'), fullPage: true });
        throw error;
    } finally {
        await context.close();
    }
}

async function runEmailAuthVerificationFlow(browser, baseUrl) {
    const scenario = createIdleScenario();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await installCommonRoutes(context, scenario);
    await seedAuthFlowState(context, {
        authUsers: {},
        authSession: null,
        sendDelayMs: 450
    });
    const page = await context.newPage();

    try {
        logStep('run email auth verification flow');
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#nameModal.active');
        await page.fill('#modalNameInput', 'Тестовый Пользователь');
        await page.fill('#modalLoginInput', 'authtest@tradicia-k.ru');
        await page.fill('#modalPasswordInput', 'Passw0rd!');
        await page.click('#modalNameSubmit');

        await page.waitForFunction(() => {
            const btn = document.getElementById('modalNameSubmit');
            return !!btn && /Проверяем|Отправляем/.test(String(btn.textContent || ''));
        });

        await page.waitForFunction(() => {
            const error = document.getElementById('passwordError');
            return !!error && /Мы отправили ссылку подтверждения/.test(String(error.textContent || ''));
        });

        const buttonLabel = await page.locator('#modalNameSubmit').textContent();
        expect(String(buttonLabel || '').trim() === 'Войти', 'Auth submit button label must reset after email link flow');
        const helpVisible = await page.locator('#authMailHelp').evaluate((el) => !el.hidden);
        expect(helpVisible, 'Auth mail help must become visible after verification email flow');
    } catch (error) {
        await ensureOutputDir();
        await page.screenshot({ path: path.join(outputDir, 'smoke-auth-verification-failure.png'), fullPage: true });
        throw error;
    } finally {
        await context.close();
    }
}

async function runLocalhostDevAuthFlow(browser, baseUrl) {
    const scenario = createIdleScenario();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await installCommonRoutes(context, scenario);
    await seedAuthFlowState(context, {
        authUsers: {},
        authSession: null,
        sendDelayMs: 0
    });
    const page = await context.newPage();

    try {
        logStep('run localhost dev auth flow');
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#nameModal.active');
        await page.fill('#modalNameInput', 'Локальный Тестер');
        await page.fill('#modalLoginInput', 'local.dev@tradicia-k.ru');
        await page.fill('#modalPasswordInput', 'Passw0rd!');
        await page.click('#localhostDevAuthBtn');

        await page.waitForFunction(() => !document.getElementById('nameModal')?.classList.contains('active'));
        await page.waitForFunction(() => {
            const startBtn = document.getElementById('startBtn');
            return !!startBtn && !startBtn.disabled;
        });

        const devSession = await page.evaluate(() => JSON.parse(localStorage.getItem('authSession:v1') || 'null'));
        expect(!!devSession?.devBypass, 'Localhost dev auth must persist devBypass session flag');

        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => !document.getElementById('nameModal')?.classList.contains('active'));
    } catch (error) {
        await ensureOutputDir();
        await page.screenshot({ path: path.join(outputDir, 'smoke-localhost-dev-auth-failure.png'), fullPage: true });
        throw error;
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
        await runScenarioLibraryFlow(browser, baseUrl);
        await runHiddenClientPromptFlow(browser, baseUrl);
        await runBrokenLocalPromptRecoveryFlow(browser, baseUrl);
        await runRolePreviewVisibilityFlow(browser, baseUrl);
        await runPromptConflictRecoveryFlow(browser, baseUrl);
        await runPromptWorkflowFlow(browser, baseUrl);
        await runEndConversationFlow(browser, baseUrl);
        await runGoSilentFlow(browser, baseUrl);
        await runEmailAuthVerificationFlow(browser, baseUrl);
        await runLocalhostDevAuthFlow(browser, baseUrl);
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
