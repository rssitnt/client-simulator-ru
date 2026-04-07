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
export function initializeAppCheck() {
  return { appCheck: true };
}
export class ReCaptchaV3Provider {
  constructor(siteKey = '') {
    this.siteKey = siteKey;
  }
}
export async function getToken() {
  return { token: 'smoke-app-check-token' };
}
`.trim();

function buildGeminiLiveSdkStub() {
    return `
export const Modality = { AUDIO: 'AUDIO' };
export const MediaResolution = { MEDIA_RESOLUTION_LOW: 'MEDIA_RESOLUTION_LOW' };

function createSilentPcmBase64(durationMs = 280, sampleRate = 24000) {
  const sampleCount = Math.max(1, Math.floor(sampleRate * durationMs / 1000));
  const bytes = new Uint8Array(sampleCount * 2);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

const assistantAudioBase64 = createSilentPcmBase64();

class StubLiveSession {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.closed = false;
    this.handledFirstAudio = false;
  }

  emit(message, delayMs = 0) {
    setTimeout(() => {
      if (this.closed) return;
      this.callbacks.onmessage?.(message);
    }, Math.max(0, Number(delayMs) || 0));
  }

  sendRealtimeInput(params = {}) {
    if (this.closed) return;
    if (params?.audio && !this.handledFirstAudio) {
      this.handledFirstAudio = true;
      const scenario = String(globalThis.__codexGeminiVoiceScenario || 'default');
      if (scenario === 'output-before-first-input-transcript') {
        this.emit({
          serverContent: {
            outputTranscription: {
              text: 'Привет.',
              finished: false
            },
            modelTurn: {
              parts: [
                {
                  inlineData: {
                    data: assistantAudioBase64,
                    mimeType: 'audio/pcm;rate=24000'
                  }
                }
              ]
            }
          }
        }, 40);
        this.emit({
          serverContent: {
            inputTranscription: {
              text: 'Здравствуйте, нужен гидробур на CASE CX260C.',
              finished: false
            }
          }
        }, 120);
        this.emit({
          serverContent: {
            inputTranscription: {
              text: 'Здравствуйте, нужен гидробур на CASE CX260C. Что есть по срокам и сервису?',
              finished: true
            }
          }
        }, 190);
        this.emit({
          serverContent: {
            waitingForInput: true
          }
        }, 280);
        return;
      }
      this.emit({
        serverContent: {
          inputTranscription: {
            text: 'Здравствуйте, нужен гидробур на CASE CX260C.',
            finished: false
          }
        }
      }, 70);
      this.emit({
        serverContent: {
          inputTranscription: {
            text: 'Здравствуйте, нужен гидробур на CASE CX260C. Что есть по срокам и сервису?',
            finished: true
          }
        }
      }, 130);
      if (scenario === 'assistant-interrupted-first-reply') {
        this.emit({
          serverContent: {
            outputTranscription: {
              text: 'Здравствуйте. Есть вариант под вашу задачу, могу быстро обозначить решение.',
              finished: false
            },
            modelTurn: {
              parts: [
                {
                  inlineData: {
                    data: assistantAudioBase64,
                    mimeType: 'audio/pcm;rate=24000'
                  }
                }
              ]
            }
          }
        }, 230);
        this.emit({
          serverContent: {
            interrupted: true
          }
        }, 320);
        this.emit({
          serverContent: {
            waitingForInput: true
          }
        }, 420);
        return;
      }
      if (scenario === 'late-first-transcript') {
        this.emit({
          serverContent: {
            modelTurn: {
              parts: [
                {
                  inlineData: {
                    data: assistantAudioBase64,
                    mimeType: 'audio/pcm;rate=24000'
                  }
                }
              ]
            }
          }
        }, 230);
        this.emit({
          serverContent: {
            waitingForInput: true
          }
        }, 320);
        this.emit({
          serverContent: {
            outputTranscription: {
              text: 'Здравствуйте. Есть рабочий вариант под вашу задачу, могу пройтись по срокам и сервису.',
              finished: false
            }
          }
        }, 360);
        this.emit({
          serverContent: {
            outputTranscription: {
              text: 'Здравствуйте. Есть рабочий вариант под вашу задачу, могу пройтись по срокам и сервису.',
              finished: true
            }
          }
        }, 410);
        return;
      }
      if (scenario === 'waiting-for-input-finalizes-first-reply') {
        this.emit({
          serverContent: {
            outputTranscription: {
              text: 'Привет.',
              finished: false
            }
          }
        }, 230);
        this.emit({
          serverContent: {
            modelTurn: {
              parts: [
                {
                  inlineData: {
                    data: assistantAudioBase64,
                    mimeType: 'audio/pcm;rate=24000'
                  }
                }
              ]
            }
          }
        }, 250);
        this.emit({
          serverContent: {
            waitingForInput: true
          }
        }, 320);
        this.emit({
          serverContent: {
            inputTranscription: {
              text: 'Сказал же, гидробур нужен.',
              finished: true
            }
          }
        }, 470);
        this.emit({
          serverContent: {
            outputTranscription: {
              text: 'Что скажешь по задаче?',
              finished: true
            },
            modelTurn: {
              parts: [
                {
                  inlineData: {
                    data: assistantAudioBase64,
                    mimeType: 'audio/pcm;rate=24000'
                  }
                }
              ]
            }
          }
        }, 620);
        return;
      }
      if (scenario === 'waiting-for-input-finalizes-user-preview') {
        this.emit({
          serverContent: {
            outputTranscription: {
              text: 'Привет.',
              finished: false
            },
            modelTurn: {
              parts: [
                {
                  inlineData: {
                    data: assistantAudioBase64,
                    mimeType: 'audio/pcm;rate=24000'
                  }
                }
              ]
            }
          }
        }, 40);
        this.emit({
          serverContent: {
            inputTranscription: {
              text: 'Здравствуйте, нужен гидробур на CASE CX260C. Что есть по срокам и сервису?',
              finished: false
            }
          }
        }, 140);
        this.emit({
          serverContent: {
            waitingForInput: true
          }
        }, 260);
        return;
      }
      if (scenario === 'audio-only-first-reply-fallback') {
        this.emit({
          serverContent: {
            modelTurn: {
              parts: [
                {
                  inlineData: {
                    data: assistantAudioBase64,
                    mimeType: 'audio/pcm;rate=24000'
                  }
                }
              ]
            }
          }
        }, 230);
        this.emit({
          serverContent: {
            waitingForInput: true
          }
        }, 320);
        this.emit({
          serverContent: {
            inputTranscription: {
              text: 'Привет. Сказал же, гидробур нужен.',
              finished: true
            }
          }
        }, 470);
        this.emit({
          serverContent: {
            outputTranscription: {
              text: 'Что скажешь по задаче?',
              finished: true
            },
            modelTurn: {
              parts: [
                {
                  inlineData: {
                    data: assistantAudioBase64,
                    mimeType: 'audio/pcm;rate=24000'
                  }
                }
              ]
            }
          }
        }, 620);
        return;
      }
      if (scenario === 'partial-first-reply-merged-with-fallback') {
        this.emit({
          serverContent: {
            outputTranscription: {
              text: 'по срокам и сервису.',
              finished: false
            },
            modelTurn: {
              parts: [
                {
                  inlineData: {
                    data: assistantAudioBase64,
                    mimeType: 'audio/pcm;rate=24000'
                  }
                }
              ]
            }
          }
        }, 230);
        this.emit({
          serverContent: {
            waitingForInput: true
          }
        }, 320);
        this.emit({
          serverContent: {
            inputTranscription: {
              text: 'Что скажешь по задаче?',
              finished: true
            }
          }
        }, 470);
        this.emit({
          serverContent: {
            outputTranscription: {
              text: 'Подтверждаю, жду конкретику.',
              finished: true
            },
            modelTurn: {
              parts: [
                {
                  inlineData: {
                    data: assistantAudioBase64,
                    mimeType: 'audio/pcm;rate=24000'
                  }
                }
              ]
            }
          }
        }, 620);
        return;
      }
      this.emit({
        serverContent: {
          outputTranscription: {
            text: 'Здравствуйте. Есть рабочий вариант под вашу задачу, могу пройтись по срокам и сервису.',
            finished: true
          },
          modelTurn: {
            parts: [
              {
                inlineData: {
                  data: assistantAudioBase64,
                  mimeType: 'audio/pcm;rate=24000'
                }
              }
            ]
          },
          turnComplete: true
        }
      }, 230);
      this.emit({
        serverContent: {
          waitingForInput: true
        }
      }, 420);
    }
  }

  sendClientContent() {
    if (this.closed) return;
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.callbacks.onclose?.({ code: 1000, reason: '' });
  }
}

export class GoogleGenAI {
  constructor(_options = {}) {
    this.live = {
      connect: async ({ callbacks = {} } = {}) => {
        const session = new StubLiveSession(callbacks);
        setTimeout(() => {
          if (session.closed) return;
          callbacks.onopen?.();
        }, 10);
        setTimeout(() => {
          if (session.closed) return;
          callbacks.onmessage?.({ setupComplete: {} });
        }, 80);
        return session;
      }
    };
  }
}
`.trim();
}

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
    await context.route('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-check.js', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/javascript', body: firebaseAppCheckStub });
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

async function installGeminiVoiceSmokeRoutes(context, tokenBucket, transcribeBucket, options = {}) {
    const voiceScenario = String(options?.voiceScenario || 'default');
    await context.route('https://cdn.jsdelivr.net/npm/@google/genai@1.40.0/+esm', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/javascript; charset=utf-8',
            body: buildGeminiLiveSdkStub()
        });
    });
    await context.route('**/api/gemini-live-token', async (route) => {
        const request = route.request();
        const rawBody = request.postData() || '{}';
        let payload = {};
        try {
            payload = JSON.parse(rawBody);
        } catch {}
        tokenBucket.push({
            url: request.url(),
            payload
        });
        await route.fulfill({
            status: 200,
            contentType: 'application/json; charset=utf-8',
            body: JSON.stringify({
                client_secret: {
                    value: 'smoke-gemini-session-token'
                }
            })
        });
    });
    await context.route('**/api/gemini-live-transcribe', async (route) => {
        const request = route.request();
        const rawBody = request.postData() || '{}';
        let payload = {};
        try {
            payload = JSON.parse(rawBody);
        } catch {}
        transcribeBucket.push({
            url: request.url(),
            payload
        });
        const transcript = voiceScenario === 'audio-only-first-reply-fallback'
            ? 'Здравствуйте. Под задачу есть вариант, могу коротко по срокам и сервису.'
            : voiceScenario === 'partial-first-reply-merged-with-fallback'
                ? 'Здравствуйте. Под задачу есть вариант, могу коротко по срокам и сервису.'
                : '';
        await route.fulfill({
            status: 200,
            contentType: 'application/json; charset=utf-8',
            body: JSON.stringify({ transcript })
        });
    });
}

async function seedLocalState(context) {
    const seed = buildSeedPayload();
    await context.addInitScript((payload) => {
        localStorage.setItem('authSession:v1', payload.authSession);
        localStorage.setItem('authUsers:v1', payload.authUsers);
        localStorage.setItem('localhostDevAuthUser:v1', payload.localhostDevAuthUser);
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

async function seedVoiceModeRuntime(context, options = {}) {
    await context.addInitScript((payload) => {
        class FakeAudioBuffer {
            constructor(channels, length, sampleRate) {
                this.numberOfChannels = channels;
                this.length = length;
                this.sampleRate = sampleRate;
                this.duration = length / sampleRate;
                this._channels = Array.from({ length: channels }, () => new Float32Array(length));
            }

            getChannelData(index) {
                return this._channels[index];
            }
        }

        class FakeNode {
            connect(target) {
                if (target && typeof target.__startProcessing === 'function') {
                    target.__startProcessing();
                }
                return target;
            }

            disconnect() {}
        }

        class FakeMediaStreamSource extends FakeNode {}

        class FakeScriptProcessor extends FakeNode {
            constructor() {
                super();
                this.onaudioprocess = null;
                this._intervalId = 0;
            }

            __startProcessing() {
                if (this._intervalId) return;
                this._intervalId = setInterval(() => {
                    if (typeof this.onaudioprocess !== 'function') return;
                    const inputChannel = new Float32Array(4096);
                    const level = 0.03;
                    for (let index = 0; index < inputChannel.length; index += 1) {
                        inputChannel[index] = index % 2 === 0 ? level : -level;
                    }
                    this.onaudioprocess({
                        inputBuffer: {
                            sampleRate: 48000,
                            getChannelData() {
                                return inputChannel;
                            }
                        }
                    });
                }, 120);
            }

            disconnect() {
                if (this._intervalId) {
                    clearInterval(this._intervalId);
                    this._intervalId = 0;
                }
            }
        }

        class FakeGainNode extends FakeNode {
            constructor() {
                super();
                this.gain = {
                    value: 0,
                    cancelScheduledValues() {},
                    setValueAtTime() {},
                    linearRampToValueAtTime() {}
                };
            }
        }

        class FakeOscillator extends FakeNode {
            constructor() {
                super();
                this.type = 'sine';
                this.frequency = { value: 0 };
            }
            start() {}
            stop() {}
        }

        class FakeBufferSource extends FakeNode {
            constructor(context) {
                super();
                this.context = context;
                this.buffer = null;
                this.onended = null;
            }

            start(when = 0) {
                const tracker = globalThis.__codexVoiceSmoke || (globalThis.__codexVoiceSmoke = { audioStartCount: 0 });
                const now = this.context.currentTime;
                const delayMs = Math.max(0, (Number(when) - now) * 1000);
                const durationMs = Math.max(40, ((this.buffer?.duration || 0.08) * 1000));
                setTimeout(() => {
                    tracker.audioStartCount += 1;
                }, delayMs);
                setTimeout(() => {
                    try {
                        this.onended?.();
                    } catch {}
                }, delayMs + durationMs);
            }

            stop() {
                try {
                    this.onended?.();
                } catch {}
            }
        }

        class FakeAudioContext {
            constructor() {
                this.state = 'running';
                this.destination = {};
                this._startedAt = performance.now();
            }

            get currentTime() {
                return (performance.now() - this._startedAt) / 1000;
            }

            async resume() {
                this.state = 'running';
            }

            createMediaStreamSource() {
                return new FakeMediaStreamSource();
            }

            createScriptProcessor() {
                return new FakeScriptProcessor();
            }

            createGain() {
                return new FakeGainNode();
            }

            createOscillator() {
                return new FakeOscillator();
            }

            createBuffer(channels, length, sampleRate) {
                return new FakeAudioBuffer(channels, length, sampleRate);
            }

            createBufferSource() {
                return new FakeBufferSource(this);
            }

            async decodeAudioData(buffer) {
                const byteLength = Number(buffer?.byteLength || 0);
                const sampleRate = 24000;
                const frameCount = Math.max(1, Math.floor(byteLength / 2));
                return this.createBuffer(1, frameCount, sampleRate);
            }
        }

        const fakeStream = {
            getTracks() {
                return [{
                    stop() {}
                }];
            }
        };

        const mediaDevices = navigator.mediaDevices || {};
        mediaDevices.getUserMedia = async () => fakeStream;
        try {
            Object.defineProperty(navigator, 'mediaDevices', {
                configurable: true,
                value: mediaDevices
            });
        } catch {
            navigator.mediaDevices = mediaDevices;
        }

        globalThis.AudioContext = FakeAudioContext;
        globalThis.webkitAudioContext = FakeAudioContext;
        globalThis.__codexVoiceSmoke = { audioStartCount: 0 };
        globalThis.__codexGeminiVoiceScenario = String(payload?.voiceScenario || 'default');
    }, {
        voiceScenario: String(options?.voiceScenario || 'default')
    });
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
    try {
        await page.waitForFunction(() => {
            const textarea = document.getElementById('systemPrompt');
            const preview = document.getElementById('systemPromptPreview');
            const textareaValue = String(textarea?.value || '');
            const previewText = String(preview?.innerText || '').trim();
            return textareaValue.trim().length > 0 || previewText.length > 0;
        });
    } catch (error) {
        const debugState = await page.evaluate(() => {
            const textarea = document.getElementById('systemPrompt');
            const preview = document.getElementById('systemPromptPreview');
            const wrapper = document.querySelector('.prompt-wrapper.instruction-editor.active');
            return {
                bodyClass: document.body.className,
                textareaValueLength: String(textarea?.value || '').trim().length,
                textareaDisplay: textarea ? getComputedStyle(textarea).display : 'missing',
                previewTextLength: String(preview?.innerText || '').trim().length,
                previewDisplay: preview ? getComputedStyle(preview).display : 'missing',
                wrapperDisplay: wrapper ? getComputedStyle(wrapper).display : 'missing',
                userRole: localStorage.getItem('userRole'),
                authSession: localStorage.getItem('authSession:v1'),
                localhostDevAuthUser: localStorage.getItem('localhostDevAuthUser:v1'),
                promptPublicSnapshot: localStorage.getItem('promptPublicSnapshot:v1')
            };
        });
        throw new Error(`waitForChatReady debug: ${JSON.stringify(debugState)}`, { cause: error });
    }
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

        await page.click('#promptHistoryBtn');
        await page.waitForSelector('#promptHistoryModal.active');
        const baselineHistoryEntry = page.locator('#promptHistoryList .change-item').filter({ hasText: 'База' }).first();
        await baselineHistoryEntry.waitFor();
        await baselineHistoryEntry.locator('.btn-restore').click();
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

async function runDialogHistoryPersistenceFlow(browser, baseUrl) {
    const scenario = createIdleScenario();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await installCommonRoutes(context, scenario);
    await seedLocalState(context);
    await context.addInitScript(() => {
        const foreignLogin = 'foreign.user@tradicia-k.ru';
        const nowIso = new Date().toISOString();
        const loginToStorageKey = (value) => Array.from(String(value || '').trim().toLowerCase())
            .map((char) => char.codePointAt(0).toString(16))
            .join('_');
        const foreignKey = loginToStorageKey(foreignLogin);
        const authUsers = JSON.parse(localStorage.getItem('authUsers:v1') || '{}');
        authUsers[foreignKey] = {
            uid: 'foreign-user-1',
            login: foreignLogin,
            fio: 'Чужой Пользователь',
            role: 'user',
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
        localStorage.setItem('authUsers:v1', JSON.stringify(authUsers));

        const dbState = globalThis.__codexFirebaseDbState || (globalThis.__codexFirebaseDbState = {
            data: {},
            listeners: []
        });
        const foreignDialogId = 'dlg_foreign_1';
        dbState.data.dialog_history_index = dbState.data.dialog_history_index || {};
        dbState.data.dialog_history_messages = dbState.data.dialog_history_messages || {};
        dbState.data.dialog_history_index[foreignKey] = {
            [foreignDialogId]: {
                id: foreignDialogId,
                login: foreignLogin,
                uid: 'foreign-user-1',
                mode: 'voice',
                title: 'Чужой диалог',
                autoTitle: 'Чужой диалог',
                titleEdited: false,
                preview: 'Добрый день. Нужен гидробур.',
                messageCount: 2,
                hasRating: true,
                createdAt: nowIso,
                updatedAt: nowIso,
                lastMessageAt: nowIso,
                closedAt: nowIso,
                ratedAt: nowIso
            }
        };
        dbState.data.dialog_history_messages[foreignKey] = {
            [foreignDialogId]: {
                id: foreignDialogId,
                login: foreignLogin,
                uid: 'foreign-user-1',
                mode: 'voice',
                createdAt: nowIso,
                updatedAt: nowIso,
                closedAt: nowIso,
                ratedAt: nowIso,
                messages: {
                    m_0001: {
                        id: 'm_0001',
                        seq: 1,
                        role: 'assistant',
                        content: 'Добрый день. Нужен гидробур.'
                    },
                    m_0002: {
                        id: 'm_0002',
                        seq: 2,
                        role: 'user',
                        content: 'Есть варианты под CASE 260.'
                    }
                },
                rating: {
                    text: 'Хороший звонок',
                    createdAt: nowIso
                }
            }
        };
    });
    const page = await context.newPage();

    try {
        logStep('run dialog history persistence scenario');
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await waitForChatReady(page);

        await page.click('#startBtn');
        await page.waitForSelector('text=Готов обсудить задачу.');
        await page.fill('#userInput', 'Нужен гидробур на CASE 260.');
        await page.click('#sendBtn');
        await page.waitForSelector('text=Ок.');

        await openSettings(page);
        await ensureDetailsOpen(page, '#dialogHistoryAccordion');
        await page.waitForSelector('#dialogHistoryList .dialog-history-item');
        await page.waitForFunction(() => {
            const meta = document.getElementById('dialogHistoryScopeMeta');
            return String(meta?.textContent || '').includes('Ваши диалоги');
        });

        await page.fill('#dialogHistoryTitleInput', 'Мой тестовый диалог');
        await page.locator('#dialogHistoryTitleInput').blur();
        await page.waitForFunction(() => {
            const titleInput = document.getElementById('dialogHistoryTitleInput');
            const listTitle = document.querySelector('#dialogHistoryList .dialog-history-item-title');
            return String(titleInput?.value || '').includes('Мой тестовый диалог')
                && String(listTitle?.textContent || '').includes('Мой тестовый диалог');
        });

        const ownHistoryState = await page.evaluate(() => {
            const dbState = globalThis.__codexFirebaseDbState || { data: {} };
            const loginToStorageKey = (value) => Array.from(String(value || '').trim().toLowerCase())
                .map((char) => char.codePointAt(0).toString(16))
                .join('_');
            const ownKey = loginToStorageKey('smoke.admin@7271155.ru');
            const ownIndex = Object.values((dbState.data.dialog_history_index || {})[ownKey] || {});
            const ownMessages = Object.values((dbState.data.dialog_history_messages || {})[ownKey] || {});
            return {
                indexCount: ownIndex.length,
                messagesCount: ownMessages.length,
                title: ownIndex[0]?.title || '',
                preview: ownIndex[0]?.preview || ''
            };
        });
        expect(ownHistoryState.indexCount === 1, 'Own dialog history index must contain one saved dialog');
        expect(ownHistoryState.messagesCount === 1, 'Own dialog history messages must contain one saved dialog');
        expect(ownHistoryState.title.includes('Мой тестовый диалог'), 'Renamed dialog title must persist into RTDB state');
        expect(ownHistoryState.preview.trim().length > 0, 'Dialog preview must persist into RTDB state');

        await closeSettings(page);
        await openSettings(page);
        await ensureDetailsOpen(page, '#dialogHistoryAccordion');
        await page.waitForFunction(() => {
            const meta = document.getElementById('dialogHistoryScopeMeta');
            const titleInput = document.getElementById('dialogHistoryTitleInput');
            return String(meta?.textContent || '').includes('Ваши диалоги')
                && String(titleInput?.value || '').includes('Мой тестовый диалог');
        });
    } catch (error) {
        await ensureOutputDir();
        await page.screenshot({ path: path.join(outputDir, 'smoke-dialog-history-failure.png'), fullPage: true });
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
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (error) => {
        pageErrors.push(String(error?.message || error));
    });
    page.on('console', (message) => {
        if (message.type() === 'error') {
            consoleErrors.push(message.text());
        }
    });
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
        if (pageErrors.length || consoleErrors.length) {
            throw new Error(
                `${error.message}\npageErrors=${JSON.stringify(pageErrors)}\nconsoleErrors=${JSON.stringify(consoleErrors)}`,
                { cause: error }
            );
        }
        throw error;
    } finally {
        await context.close();
    }
}

async function runHiddenRaterPromptFlow(browser, baseUrl) {
    const scenario = createEndConversationScenario();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await installCommonRoutes(context, scenario);
    await seedLocalState(context);
    const page = await context.newPage();
    const hiddenRaterPrompt = `Smoke hidden rater suffix ${Date.now()}`;

    try {
        logStep('run hidden rater prompt persistence scenario');
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await waitForChatReady(page);

        await openSettings(page);
        await ensureDetailsOpen(page, '#adminHiddenRaterPromptAccordion');
        await page.fill('#adminHiddenRaterPromptInput', hiddenRaterPrompt);
        await page.click('#adminHiddenRaterPromptSaveBtn');
        await page.waitForFunction((expectedValue) => {
            return (localStorage.getItem('raterHiddenPrompt:v1') || '').includes(expectedValue);
        }, hiddenRaterPrompt);
        await closeSettings(page);

        await page.click('#startBtn');
        await page.waitForSelector('text=Здравствуйте. Что у вас за задача?');
        await page.fill('#userInput', 'уходи');
        await page.click('#sendBtn');
        await page.waitForSelector('.conversation-action-note .btn-conversation-rate');
        await page.click('.conversation-action-note .btn-conversation-rate');
        await page.waitForFunction(() => {
            const ratingText = document.querySelector('.message.rating')?.textContent || '';
            return ratingText.includes('Smoke rating done');
        });

        const ratingRequest = scenario.requests.find((item) => item.payload.requestType === 'rating');
        const ratingPrompt = String(ratingRequest?.payload?.raterPrompt || '');
        expect(ratingRequest, 'Rating webhook was not called for hidden rater prompt flow');
        expect(ratingPrompt.includes(hiddenRaterPrompt), 'Hidden rater prompt was not appended to webhook raterPrompt');
        expect(!ratingPrompt.includes('СЛУЖЕБНЫЙ КОНТРАКТ ФОРМАТА ОЦЕНКИ'), 'Fixed rating contract must not be attached');
    } catch (error) {
        await ensureOutputDir();
        await page.screenshot({ path: path.join(outputDir, 'smoke-hidden-rater-prompt-failure.png'), fullPage: true });
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
            const compareBtn = document.getElementById('promptCompareBtn');
            const compareVisible = !!compareBtn && getComputedStyle(compareBtn).display !== 'none';
            const hasConflictNotice = (state.conflictMessage || '').includes('локальный скрытый draft');
            return (state.activeContent || '').includes(expectedValue)
                && (state.activeIsLocal || compareVisible || hasConflictNotice);
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

async function runGeminiVoiceModeSmokeFlow(browser, baseUrl, options = {}) {
    const expectedAssistantNeedle = String(options?.expectedAssistantNeedle || 'срокам');
    const voiceScenario = String(options?.voiceScenario || 'default');
    const scenario = createIdleScenario();
    const capturedVoiceRequests = [];
    const capturedTranscribeRequests = [];
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await installCommonRoutes(context, scenario);
    await installGeminiVoiceSmokeRoutes(context, capturedVoiceRequests, capturedTranscribeRequests, { voiceScenario });
    await seedLocalState(context);
    await seedVoiceModeRuntime(context, { voiceScenario });
    const page = await context.newPage();
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', (error) => {
        pageErrors.push(String(error?.message || error));
    });
    page.on('console', (message) => {
        if (message.type() === 'error') {
            consoleErrors.push(message.text());
        }
    });

    const readVoiceSmokeState = async () => page.evaluate(() => ({
        sendMode: String(document.getElementById('sendBtn')?.dataset?.mode || '').trim(),
        voiceStatus: String(document.getElementById('voiceModeStatus')?.textContent || '').trim(),
        callNoticeText: String(document.querySelector('.voice-call-note .conversation-action-note-text')?.textContent || '').trim(),
        audioStartCount: Number(globalThis.__codexVoiceSmoke?.audioStartCount || 0),
        rateVisible: (() => {
            const btn = document.getElementById('voiceModeRateBtn');
            return !!btn && !btn.hidden;
        })(),
        bodyVoiceCallActive: document.body?.classList?.contains('voice-call-active') === true,
        userMessages: Array.from(document.querySelectorAll('.message.user')).map((node) => String(node.textContent || '').trim()),
        assistantMessages: Array.from(document.querySelectorAll('.message.assistant')).map((node) => String(node.textContent || '').trim()),
        messageTimeline: Array.from(document.querySelectorAll('.message.user, .message.assistant')).map((node) => ({
            role: node.classList.contains('assistant') ? 'assistant' : 'user',
            text: String(node.textContent || '').trim()
        })),
        errorMessages: Array.from(document.querySelectorAll('.message.error')).map((node) => String(node.textContent || '').trim())
    }));

    try {
        logStep(`run gemini voice mode smoke scenario (${voiceScenario})`);
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await waitForChatReady(page);

        await page.click('#sendBtn');

        await page.waitForFunction(() => {
            const sendMode = String(document.getElementById('sendBtn')?.dataset?.mode || '').trim();
            const statusText = String(document.getElementById('voiceModeStatus')?.textContent || '').trim();
            const callNoticeText = String(document.querySelector('.voice-call-note .conversation-action-note-text')?.textContent || '').trim();
            const combinedText = `${statusText}\n${callNoticeText}`;
            return sendMode === 'voice-stop' && (
                combinedText.includes('Клиент на линии. Начинайте разговор.') ||
                combinedText.includes('Клиент на линии. Подготавливаем микрофон…') ||
                combinedText.includes('Слушаю вас') ||
                combinedText.includes('Клиент говорит…') ||
                combinedText.includes('Клиент отвечает') ||
                combinedText.includes('Ваша очередь говорить.')
            );
        }, null, { timeout: 12000 });

        await page.waitForFunction(() => {
            const userMessages = document.querySelectorAll('.message.user').length;
            const assistantMessages = document.querySelectorAll('.message.assistant').length;
            return userMessages > 0 && assistantMessages > 0;
        }, null, { timeout: 12000 });

        await page.waitForFunction(() => {
            return Number(globalThis.__codexVoiceSmoke?.audioStartCount || 0) > 0;
        }, null, { timeout: 12000 });

        if (voiceScenario === 'audio-only-first-reply-fallback') {
            await page.waitForFunction(() => {
                return Array.from(document.querySelectorAll('.message.assistant'))
                    .some((node) => {
                        const text = String(node.textContent || '').trim();
                        return text.includes('вариант') && text.includes('срокам и сервису');
                    });
            }, null, { timeout: 12000 });
        }

        if (voiceScenario === 'partial-first-reply-merged-with-fallback') {
            await page.waitForFunction(() => {
                return Array.from(document.querySelectorAll('.message.assistant'))
                    .some((node) => {
                        const text = String(node.textContent || '').trim();
                        return text.includes('Здравствуйте.') && text.includes('срокам и сервису');
                    });
            }, null, { timeout: 12000 });
        }

        const dialogState = await readVoiceSmokeState();

        expect(capturedVoiceRequests.length > 0, 'Voice token endpoint was not called');
        expect(dialogState.sendMode === 'voice-stop', 'Voice call did not switch send button into stop mode');
        expect(dialogState.bodyVoiceCallActive, 'Voice call active body state was not enabled');
        expect(dialogState.audioStartCount > 0, 'Assistant audio playback never started');
        expect(dialogState.userMessages.some((text) => text.includes('CASE CX260C')), 'Voice user transcript was not appended to chat');
        if (voiceScenario === 'output-before-first-input-transcript') {
            expect(
                dialogState.assistantMessages.some((text) => text.trim() === 'Привет.'),
                'First assistant voice reply was lost when it arrived before user transcription'
            );
            const firstUserIndex = dialogState.messageTimeline.findIndex((item) => item.role === 'user' && item.text.includes('CASE CX260C'));
            const firstAssistantIndex = dialogState.messageTimeline.findIndex((item) => item.role === 'assistant' && item.text.trim() === 'Привет.');
            expect(
                firstUserIndex !== -1 && firstAssistantIndex !== -1 && firstUserIndex < firstAssistantIndex,
                'First assistant reply was rendered before the opening manager turn'
            );
        } else if (voiceScenario === 'waiting-for-input-finalizes-user-preview') {
            expect(
                dialogState.userMessages.some((text) => text.includes('CASE CX260C') && text.includes('срокам и сервису')),
                'Opening manager turn was lost when Gemini only provided an unfinished user preview'
            );
            expect(
                dialogState.assistantMessages.some((text) => text.trim() === 'Привет.'),
                'Buffered first assistant reply was not preserved while finalizing the opening manager preview'
            );
            const firstUserIndex = dialogState.messageTimeline.findIndex((item) => item.role === 'user' && item.text.includes('CASE CX260C'));
            const firstAssistantIndex = dialogState.messageTimeline.findIndex((item) => item.role === 'assistant' && item.text.trim() === 'Привет.');
            expect(
                firstUserIndex !== -1 && firstAssistantIndex !== -1 && firstUserIndex < firstAssistantIndex,
                'Opening manager preview was not finalized before the buffered first assistant reply'
            );
        } else if (voiceScenario === 'waiting-for-input-finalizes-first-reply') {
            expect(
                dialogState.assistantMessages.some((text) => text.trim() === 'Привет.'),
                'First assistant voice reply was not finalized as a separate chat bubble'
            );
        } else if (voiceScenario === 'audio-only-first-reply-fallback') {
            expect(
                dialogState.assistantMessages.some((text) => text.includes('вариант') && text.includes('срокам и сервису')),
                'Audio-only first assistant reply was not restored via fallback transcription'
            );
        } else if (voiceScenario === 'partial-first-reply-merged-with-fallback') {
            expect(
                dialogState.assistantMessages.some((text) => text.includes('Здравствуйте.') && text.includes('срокам и сервису')),
                'Fallback transcript did not restore the missing beginning of the first assistant reply'
            );
        } else {
            expect(
                dialogState.assistantMessages.some((text) => text.includes(expectedAssistantNeedle) || text.includes('сервису')),
                'Voice assistant reply was not appended to chat'
            );
        }
        if (voiceScenario === 'waiting-for-input-finalizes-first-reply') {
            expect(dialogState.assistantMessages.length >= 1, 'Assistant messages must contain the finalized first reply');
        }
        if (voiceScenario === 'audio-only-first-reply-fallback' || voiceScenario === 'partial-first-reply-merged-with-fallback') {
            expect(capturedTranscribeRequests.length > 0, 'Voice transcript fallback endpoint was not called');
        }
        expect(dialogState.errorMessages.length === 0, `Voice mode rendered an error: ${dialogState.errorMessages.join(' | ')}`);

        await page.evaluate(() => {
            document.getElementById('sendBtn')?.click();
        });

        await page.waitForFunction(() => {
            const sendMode = String(document.getElementById('sendBtn')?.dataset?.mode || '').trim();
            const bodyVoiceCallActive = document.body?.classList?.contains('voice-call-active') === true;
            return !bodyVoiceCallActive && sendMode !== 'voice-stop';
        }, null, { timeout: 8000 });

        const stopState = await readVoiceSmokeState();

        expect(stopState.sendMode !== 'voice-stop', 'Voice call did not leave stop mode after ending');
        expect(!stopState.bodyVoiceCallActive, 'Voice call active body state did not clear after ending');
    } catch (error) {
        await ensureOutputDir();
        await page.screenshot({ path: path.join(outputDir, 'smoke-gemini-voice-failure.png'), fullPage: true });
        let debugState = null;
        try {
            debugState = await readVoiceSmokeState();
        } catch {}
        if (pageErrors.length || consoleErrors.length) {
            throw new Error(
                `${error.message}\npageErrors=${JSON.stringify(pageErrors)}\nconsoleErrors=${JSON.stringify(consoleErrors)}\ndebugState=${JSON.stringify(debugState)}`,
                { cause: error }
            );
        }
        if (debugState) {
            throw new Error(`${error.message}\ndebugState=${JSON.stringify(debugState)}`, { cause: error });
        }
        throw error;
    } finally {
        await context.close();
    }
}

async function runClearChatStopsVoiceFlow(browser, baseUrl) {
    const scenario = createIdleScenario();
    const capturedVoiceRequests = [];
    const capturedTranscribeRequests = [];
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await installCommonRoutes(context, scenario);
    await installGeminiVoiceSmokeRoutes(context, capturedVoiceRequests, capturedTranscribeRequests, {
        voiceScenario: 'default'
    });
    await seedLocalState(context);
    const page = await context.newPage();
    page.on('dialog', async (dialog) => {
        await dialog.accept();
    });

    const readVoiceSmokeState = () => page.evaluate(() => ({
        sendMode: String(document.getElementById('sendBtn')?.dataset?.mode || '').trim(),
        rateVisible: (() => {
            const btn = document.getElementById('voiceModeRateBtn');
            return !!btn && !btn.hidden;
        })(),
        voiceModeActionsVisible: (() => {
            const panel = document.getElementById('voiceModeActions');
            return !!panel && !panel.hidden;
        })(),
        bodyVoiceCallActive: document.body?.classList?.contains('voice-call-active') === true,
        startConversationVisible: !!document.getElementById('startConversation'),
        chatMessagesCount: document.querySelectorAll('.message.user, .message.assistant').length,
        voiceStatus: String(document.getElementById('voiceModeStatus')?.textContent || '').trim()
    }));

    try {
        logStep('run clear chat while voice call is active');
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await waitForChatReady(page);

        await page.click('#sendBtn');
        await page.waitForFunction(() => {
            const sendMode = String(document.getElementById('sendBtn')?.dataset?.mode || '').trim();
            return sendMode === 'voice-stop';
        }, null, { timeout: 12000 });

        await page.click('#clearChat');
        await page.waitForFunction(() => {
            const sendMode = String(document.getElementById('sendBtn')?.dataset?.mode || '').trim();
            return sendMode !== 'voice-stop';
        }, null, { timeout: 8000 });

        const state = await readVoiceSmokeState();
        expect(capturedVoiceRequests.length > 0, 'Voice token endpoint was not called before clear chat');
        expect(!state.bodyVoiceCallActive, 'Voice active body state must clear after chat reset');
        expect(state.sendMode !== 'voice-stop', 'Clear chat must leave the primary action out of stop mode');
        expect(state.startConversationVisible, 'Start conversation block must return after clear chat');
        expect(state.chatMessagesCount === 0, 'Clear chat must remove buffered voice bubbles from the current view');
        expect(
            !state.rateVisible || !state.voiceModeActionsVisible,
            'Rate button must not stay visible to the user after full chat reset'
        );
    } catch (error) {
        await ensureOutputDir();
        await page.screenshot({ path: path.join(outputDir, 'smoke-clear-chat-voice-failure.png'), fullPage: true });
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
        expect(!String(ratingRequest?.payload?.raterPrompt || '').includes('СЛУЖЕБНЫЙ КОНТРАКТ ФОРМАТА ОЦЕНКИ'), 'Fixed rating contract must not be attached');
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
        await runHiddenClientPromptFlow(browser, baseUrl);
        await runHiddenRaterPromptFlow(browser, baseUrl);
        await runBrokenLocalPromptRecoveryFlow(browser, baseUrl);
        await runRolePreviewVisibilityFlow(browser, baseUrl);
        await runPromptConflictRecoveryFlow(browser, baseUrl);
        await runPromptWorkflowFlow(browser, baseUrl);
        await runDialogHistoryPersistenceFlow(browser, baseUrl);
        await runGeminiVoiceModeSmokeFlow(browser, baseUrl);
        await runGeminiVoiceModeSmokeFlow(browser, baseUrl, {
            voiceScenario: 'assistant-interrupted-first-reply',
            expectedAssistantNeedle: 'вариант'
        });
        await runGeminiVoiceModeSmokeFlow(browser, baseUrl, {
            voiceScenario: 'late-first-transcript',
            expectedAssistantNeedle: 'срокам и сервису'
        });
        await runGeminiVoiceModeSmokeFlow(browser, baseUrl, {
            voiceScenario: 'output-before-first-input-transcript',
            expectedAssistantNeedle: 'Привет.'
        });
        await runGeminiVoiceModeSmokeFlow(browser, baseUrl, {
            voiceScenario: 'waiting-for-input-finalizes-first-reply',
            expectedAssistantNeedle: 'Что скажешь по задаче?'
        });
        await runGeminiVoiceModeSmokeFlow(browser, baseUrl, {
            voiceScenario: 'waiting-for-input-finalizes-user-preview',
            expectedAssistantNeedle: 'Привет.'
        });
        await runGeminiVoiceModeSmokeFlow(browser, baseUrl, {
            voiceScenario: 'audio-only-first-reply-fallback',
            expectedAssistantNeedle: 'срокам и сервису'
        });
        await runGeminiVoiceModeSmokeFlow(browser, baseUrl, {
            voiceScenario: 'partial-first-reply-merged-with-fallback',
            expectedAssistantNeedle: 'срокам и сервису'
        });
        await runClearChatStopsVoiceFlow(browser, baseUrl);
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
