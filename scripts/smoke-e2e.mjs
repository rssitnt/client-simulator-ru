import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { pbkdf2Sync } from 'node:crypto';
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
function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}
function createAuthUser(email = '') {
  return {
    email,
    async getIdToken() {
      return 'smoke-firebase-token';
    }
  };
}
function getAuthBehavior(email = '') {
  const behaviorMap = globalThis.__codexFirebaseAuthBehaviorByEmail || {};
  const normalizedEmail = normalizeEmail(email);
  return behaviorMap[normalizedEmail] || behaviorMap['*'] || null;
}
function buildFirebaseAuthError(code = 'auth/internal-error', message = '') {
  const error = new Error(message || code);
  error.code = code;
  return error;
}
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
export async function sendPasswordResetEmail() {
  const delayMs = Number(globalThis.__codexAuthSendLinkDelayMs || 0);
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  const email = normalizeEmail(arguments[1]);
  const history = globalThis.__codexPasswordResetEmails || (globalThis.__codexPasswordResetEmails = []);
  if (email) {
    history.push(email);
  }
  return null;
}
export function isSignInWithEmailLink() { return false; }
export async function signInWithEmailLink() {
  return { user: null };
}
export async function signInWithEmailAndPassword(_auth, email, password) {
  const behavior = getAuthBehavior(email);
  if (behavior?.signInErrorCode) {
    throw buildFirebaseAuthError(behavior.signInErrorCode, behavior.signInErrorMessage || behavior.signInErrorCode);
  }
  if (behavior?.expectedPassword && String(password) !== String(behavior.expectedPassword)) {
    throw buildFirebaseAuthError('auth/wrong-password', 'auth/wrong-password');
  }
  authInstance.currentUser = createAuthUser(email);
  return { user: authInstance.currentUser };
}
export async function createUserWithEmailAndPassword(_auth, email, password) {
  const behavior = getAuthBehavior(email);
  if (behavior?.createErrorCode) {
    throw buildFirebaseAuthError(behavior.createErrorCode, behavior.createErrorMessage || behavior.createErrorCode);
  }
  if (behavior?.createExpectedPassword && String(password) !== String(behavior.createExpectedPassword)) {
    throw buildFirebaseAuthError('auth/weak-password', 'auth/weak-password');
  }
  authInstance.currentUser = createAuthUser(email);
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
    this.assistantResponseWatchdogRecovered = false;
    this.assistantResponseStallRecovered = false;
  }

  emit(message, delayMs = 0) {
    setTimeout(() => {
      if (this.closed) return;
      this.callbacks.onmessage?.(message);
    }, Math.max(0, Number(delayMs) || 0));
  }

  sendRealtimeInput(params = {}) {
    if (this.closed) return;
    const tracker = globalThis.__codexVoiceSmoke || (globalThis.__codexVoiceSmoke = { audioStartCount: 0, activityEndCount: 0 });
    if (params?.activityEnd) {
      tracker.activityEndCount = Number(tracker.activityEndCount || 0) + 1;
    }
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
      if (scenario === 'assistant-response-watchdog-retries-boundary') {
        this.emit({
          serverContent: {
            inputTranscription: {
              text: 'Нужен гидробур на CASE CX260C, 900 лунок.',
              finished: false
            }
          }
        }, 70);
        this.emit({
          serverContent: {
            inputTranscription: {
              text: 'Нужен гидробур на CASE CX260C, 900 лунок. Что предложишь?',
              finished: true
            }
          }
        }, 140);
        return;
      }
      if (scenario === 'assistant-response-stall-recovery') {
        this.emit({
          serverContent: {
            inputTranscription: {
              text: 'Нужен гидробур на CASE, 900 отверстий.',
              finished: false
            }
          }
        }, 70);
        this.emit({
          serverContent: {
            inputTranscription: {
              text: 'Нужен гидробур на CASE, 900 отверстий. Что предложите?',
              finished: true
            }
          }
        }, 140);
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
      if (scenario === 'idle-watchdog-finalizes-user-turn') {
        this.emit({
          serverContent: {
            inputTranscription: {
              text: 'CASE CX260C нужен срочно, 900 свай.',
              finished: false
            }
          }
        }, 230);
        this.emit({
          serverContent: {
            outputTranscription: {
              text: 'Понял. Могу предложить вариант под этот объём.',
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
        }, 2050);
        this.emit({
          serverContent: {
            waitingForInput: true
          }
        }, 2180);
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
    if (params?.activityEnd && !this.closed) {
      const scenario = String(globalThis.__codexGeminiVoiceScenario || 'default');
      if (
        scenario === 'assistant-response-watchdog-retries-boundary' &&
        !this.assistantResponseWatchdogRecovered &&
        Number(tracker.activityEndCount || 0) >= 1
      ) {
        this.assistantResponseWatchdogRecovered = true;
        this.emit({
          serverContent: {
            outputTranscription: {
              text: 'Есть вариант под этот объём. Могу сразу пройтись по комплектации.',
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
        }, 180);
        this.emit({
          serverContent: {
            waitingForInput: true
          }
        }, 320);
      }
      if (
        scenario === 'assistant-response-stall-recovery' &&
        !this.assistantResponseStallRecovered &&
        Number(tracker.activityEndCount || 0) >= 3
      ) {
        this.assistantResponseStallRecovered = true;
        this.emit({
          serverContent: {
            outputTranscription: {
              text: 'Есть рабочий вариант под такой объём. Могу сразу назвать комплектацию и сроки.',
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
        }, 180);
        this.emit({
          serverContent: {
            waitingForInput: true
          }
        }, 320);
      }
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

function buildPasswordHashForSmoke(loginValue, password, saltByte = 7) {
    const normalizedLogin = String(loginValue || '').trim().toLowerCase();
    const secret = `${normalizedLogin}::${String(password || '')}`;
    const salt = Buffer.alloc(16, saltByte);
    const derived = pbkdf2Sync(secret, salt, 120000, 32, 'sha256');
    return `pbkdf2:v1|120000|${salt.toString('base64')}|${derived.toString('base64')}`;
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
        if (request.method() !== 'POST') {
            await route.fulfill({ status: 405, body: 'Method not allowed' });
            return;
        }
        const rawBody = request.postData() || '{}';
        let payload = {};
        try {
            payload = JSON.parse(rawBody);
        } catch {}
        tokenBucket.push({
            url: request.url(),
            payload
        });
        if (typeof payload !== 'object' || Array.isArray(payload)) {
            await route.fulfill({ status: 400, contentType: 'application/json; charset=utf-8', body: JSON.stringify({ error: 'Invalid JSON body' }) });
            return;
        }
        await route.fulfill({
            status: 200,
            contentType: 'application/json; charset=utf-8',
            body: JSON.stringify({
                name: 'smoke-gemini-session-token',
                expireTime: new Date(Date.now() + 60_000).toISOString()
            })
        });
    });
    await context.route('**/api/gemini-live-transcribe', async (route) => {
        const request = route.request();
        if (request.method() !== 'POST') {
            await route.fulfill({ status: 405, body: 'Method not allowed' });
            return;
        }
        const rawBody = request.postData() || '{}';
        let payload = {};
        try {
            payload = JSON.parse(rawBody);
        } catch {}
        transcribeBucket.push({
            url: request.url(),
            payload
        });
        const audioPayload = typeof payload?.audioBase64 === 'string'
            ? payload.audioBase64
            : typeof payload?.data === 'string'
                ? payload.data
                : typeof payload?.audio === 'string'
                    ? payload.audio
                    : '';
        if (!audioPayload.trim()) {
            await route.fulfill({
                status: 400,
                contentType: 'application/json; charset=utf-8',
                body: JSON.stringify({ error: 'Audio payload is required.' })
            });
            return;
        }
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
                this._tickCount = 0;
            }

            __startProcessing() {
                if (this._intervalId) return;
                this._intervalId = setInterval(() => {
                    if (typeof this.onaudioprocess !== 'function') return;
                    this._tickCount += 1;
                    const inputChannel = new Float32Array(4096);
                    const scenario = String(globalThis.__codexGeminiVoiceScenario || 'default');
                    const shouldSimulateSpeechBurst =
                        scenario === 'assistant-response-watchdog-retries-boundary'
                            ? this._tickCount <= 4
                            : true;
                    const level = shouldSimulateSpeechBurst ? 0.03 : 0;
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
        globalThis.__codexVoiceSmoke = { audioStartCount: 0, activityEndCount: 0 };
        globalThis.__codexGeminiVoiceScenario = String(payload?.voiceScenario || 'default');
    }, {
        voiceScenario: String(options?.voiceScenario || 'default')
    });
}

async function seedAuthFlowState(context, options = {}) {
    const authUsers = options.authUsers || {};
    const authSession = options.authSession || null;
    const sendDelayMs = Number(options.sendDelayMs || 0);
    const authBehaviorByEmail = options.authBehaviorByEmail || {};

    await context.addInitScript((payload) => {
        const dbState = globalThis.__codexFirebaseDbState || (globalThis.__codexFirebaseDbState = {
            data: {},
            listeners: []
        });
        if (sessionStorage.getItem('__codexAuthFlowSeeded') === '1') {
            globalThis.__codexAuthSendLinkDelayMs = payload.sendDelayMs || 0;
            globalThis.__codexFirebaseAuthBehaviorByEmail = payload.authBehaviorByEmail || {};
            globalThis.__codexPasswordResetEmails = [];
            dbState.data = {
                ...(dbState.data && typeof dbState.data === 'object' ? dbState.data : {}),
                users: JSON.parse(JSON.stringify(payload.authUsers || {}))
            };
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
        globalThis.__codexFirebaseAuthBehaviorByEmail = payload.authBehaviorByEmail || {};
        globalThis.__codexPasswordResetEmails = [];
        dbState.data = {
            ...(dbState.data && typeof dbState.data === 'object' ? dbState.data : {}),
            users: JSON.parse(JSON.stringify(payload.authUsers || {}))
        };
    }, {
        authUsers,
        authSession,
        sendDelayMs,
        authBehaviorByEmail
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
    const useLocalDrawer = await page.evaluate(() => document.body.classList.contains('local-minimal-ui') && window.innerWidth > 1024);
    if (useLocalDrawer) {
        const drawerOpen = await page.evaluate(() => document.body.classList.contains('local-prompt-open'));
        if (drawerOpen) {
            await page.click('#localPromptCloseBtn');
            await page.waitForFunction(() => !document.body.classList.contains('local-prompt-open'));
        }
        await page.click('#localSettingsTopBtn');
    } else {
        await page.click('#settingsBtn');
    }
    await page.waitForSelector('#settingsModal.active');
}

async function closeSettings(page) {
    const closeButtonVisible = await page.locator('#settingsModalCloseBtn').isVisible().catch(() => false);
    if (closeButtonVisible) {
        await page.click('#settingsModalCloseBtn');
    } else {
        await page.evaluate(() => {
            const modal = document.getElementById('settingsModal');
            if (!modal) return;
            modal.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        });
    }
    await page.waitForFunction(() => !document.getElementById('settingsModal')?.classList.contains('active'));
    const localDrawerOpen = await page.evaluate(() => document.body.classList.contains('local-prompt-open'));
    if (localDrawerOpen) {
        const promptCloseVisible = await page.locator('#localPromptCloseBtn').isVisible().catch(() => false);
        if (promptCloseVisible) {
            await page.click('#localPromptCloseBtn');
        } else {
            await page.evaluate(() => document.body.classList.remove('local-prompt-open'));
        }
        await page.waitForFunction(() => !document.body.classList.contains('local-prompt-open'));
    }
}

async function ensurePromptPanelAvailable(page) {
    const useLocalDrawer = await page.evaluate(() => document.body.classList.contains('local-minimal-ui') && window.innerWidth > 1024);
    if (!useLocalDrawer) return;
    const drawerOpen = await page.evaluate(() => document.body.classList.contains('local-prompt-open'));
    if (drawerOpen) return;
    await page.click('#localPromptToggleBtn');
    await page.waitForFunction(() => document.body.classList.contains('local-prompt-open'));
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

        await ensurePromptPanelAvailable(page);
        await page.click('#promptVisibilityBtn');

        await page.evaluate(() => {
            const preview = document.getElementById('systemPromptPreview');
            preview.innerHTML = `${preview.innerHTML}<p>Smoke draft</p>`;
            preview.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await page.evaluate(() => window.__CLIENT_SIMULATOR_TEST_HOOKS__.forceEndPromptEditing('client'));
        await page.waitForFunction(() => {
            return (document.getElementById('systemPrompt')?.value || '').includes('Smoke draft');
        });

        const publishedContent = await page.evaluate(() => document.getElementById('systemPrompt')?.value || '');
        expect(publishedContent.includes('Smoke draft'), 'Published prompt content did not persist');

        await page.click('#promptHistoryBtn');
        await page.waitForSelector('#promptHistoryModal.active');
        await page.waitForFunction(() => {
            return !!document.getElementById('promptHistoryList');
        });
        await page.click('#promptHistoryModalClose');
        await page.waitForFunction(() => {
            const modal = document.getElementById('promptHistoryModal');
            return !modal || !modal.classList.contains('active');
        });
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
        const ownLogin = 'smoke.admin@7271155.ru';
        const foreignLogin = 'foreign.user@tradicia-k.ru';
        const nowIso = new Date().toISOString();
        const loginToStorageKey = (value) => Array.from(String(value || '').trim().toLowerCase())
            .map((char) => char.codePointAt(0).toString(16))
            .join('_');
        const ownKey = loginToStorageKey(ownLogin);
        const foreignKey = loginToStorageKey(foreignLogin);
        const ownVoiceDialogId = 'dlg_own_voice_1';
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
        const ownDialogId = 'dlg_own_1';
        const foreignDialogId = 'dlg_foreign_1';
        dbState.data.dialog_history_index = dbState.data.dialog_history_index || {};
        dbState.data.dialog_history_messages = dbState.data.dialog_history_messages || {};
        dbState.data.dialog_history_index[ownKey] = dbState.data.dialog_history_index[ownKey] || {};
        dbState.data.dialog_history_index[foreignKey] = dbState.data.dialog_history_index[foreignKey] || {};
        dbState.data.dialog_history_messages[ownKey] = dbState.data.dialog_history_messages[ownKey] || {};
        dbState.data.dialog_history_messages[foreignKey] = dbState.data.dialog_history_messages[foreignKey] || {};
        if (!dbState.data.dialog_history_index[ownKey][ownDialogId]) {
            dbState.data.dialog_history_index[ownKey][ownDialogId] = {
                id: ownDialogId,
                login: ownLogin,
                uid: 'smoke-admin-1',
                mode: 'text',
                title: '',
                autoTitle: 'Гидробур для CASE 260',
                titleEdited: false,
                preview: 'Нужен гидробур на CASE 260.',
                messageCount: 2,
                hasRating: false,
                createdAt: nowIso,
                updatedAt: nowIso,
                lastMessageAt: nowIso,
                closedAt: nowIso,
                ratedAt: null
            };
        }
        if (!dbState.data.dialog_history_index[foreignKey][foreignDialogId]) {
            dbState.data.dialog_history_index[foreignKey][foreignDialogId] = {
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
            };
        }
        if (!dbState.data.dialog_history_messages[ownKey][ownDialogId]) {
            dbState.data.dialog_history_messages[ownKey][ownDialogId] = {
                id: ownDialogId,
                login: ownLogin,
                uid: 'smoke-admin-1',
                mode: 'text',
                createdAt: nowIso,
                updatedAt: nowIso,
                closedAt: nowIso,
                ratedAt: null,
                messages: {
                    m_0001: {
                        id: 'm_0001',
                        seq: 1,
                        role: 'assistant',
                        content: 'Нужен гидробур на CASE 260.'
                    },
                    m_0002: {
                        id: 'm_0002',
                        seq: 2,
                        role: 'user',
                        content: 'Ок. Подберу вариант под задачу.'
                    }
                }
            };
        }
        if (!dbState.data.dialog_history_messages[foreignKey][foreignDialogId]) {
            dbState.data.dialog_history_messages[foreignKey][foreignDialogId] = {
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
            };
        }
        if (!dbState.data.dialog_history_index[ownKey][ownVoiceDialogId]) {
            dbState.data.dialog_history_index[ownKey][ownVoiceDialogId] = {
                id: ownVoiceDialogId,
                login: ownLogin,
                uid: 'smoke-admin-1',
                mode: 'voice',
                title: 'Свой голосовой диалог',
                autoTitle: 'Свой голосовой диалог',
                titleEdited: false,
                preview: 'Созвон по гидробуру',
                messageCount: 2,
                hasRating: true,
                createdAt: nowIso,
                updatedAt: nowIso,
                lastMessageAt: nowIso,
                closedAt: nowIso,
                ratedAt: nowIso
            };
        }
        if (!dbState.data.dialog_history_messages[ownKey][ownVoiceDialogId]) {
            dbState.data.dialog_history_messages[ownKey][ownVoiceDialogId] = {
                id: ownVoiceDialogId,
                login: ownLogin,
                uid: 'smoke-admin-1',
                mode: 'voice',
                createdAt: nowIso,
                updatedAt: nowIso,
                closedAt: nowIso,
                ratedAt: nowIso,
                messages: {
                    m_0001: {
                        id: 'm_0001',
                        seq: 1,
                        role: 'user',
                        content: 'Добрый день. Нужен гидробур на CASE CX260C.'
                    },
                    m_0002: {
                        id: 'm_0002',
                        seq: 2,
                        role: 'assistant',
                        content: 'Да, подскажу по комплекту и срокам.'
                    }
                },
                rating: {
                    text: 'Диалог уже оценён.',
                    createdAt: nowIso
                }
            };
        }
    });
    const page = await context.newPage();

    try {
        logStep('run dialog history persistence scenario');
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await waitForChatReady(page);
        await page.waitForFunction(() => (
            document.body.classList.contains('history-sidebar-collapsed')
            || document.body.classList.contains('local-minimal-ui')
        ));

        await page.waitForSelector('#mainDialogHistoryList .dialog-history-item');
        await page.waitForFunction(() => {
            const meta = document.getElementById('mainDialogHistoryScopeMeta');
            return /диалог/i.test(String(meta?.textContent || ''));
        });

        await page.waitForFunction(() => {
            const listTitle = document.querySelector('#mainDialogHistoryList .dialog-history-item-title');
            const text = String(listTitle?.textContent || '');
            return /гидробур|case/i.test(text);
        });

        await page.click('#mainDialogHistoryList .dialog-history-item-main');
        await page.waitForFunction(() => {
            const stage = document.getElementById('mainDialogHistoryStage');
            const chatMessages = document.getElementById('chatMessages');
            const renderedMessages = Array.from(document.querySelectorAll('#chatMessages .message .message-content'))
                .map((node) => String(node.textContent || '').trim())
                .filter(Boolean);
            return !!chatMessages
                && !chatMessages.hidden
                && (!!stage && stage.hidden)
                && renderedMessages.length >= 2
                && renderedMessages.some((text) => /нужен гидробур/i.test(text))
                && renderedMessages.some((text) => /подберу вариант/i.test(text));
        });

        await page.waitForFunction(() => {
            const input = document.getElementById('userInput');
            return !!input && !input.disabled && !input.classList.contains('locked-dialog');
        });

        await page.fill('#userInput', 'Продолжаю тот же диалог');
        await page.click('#sendBtn');
        await page.waitForFunction(() => {
            const renderedMessages = Array.from(document.querySelectorAll('#chatMessages .message .message-content'))
                .map((node) => String(node.textContent || '').trim())
                .filter(Boolean);
            return renderedMessages.some((text) => text.includes('Продолжаю тот же диалог'));
        });

        await page.waitForFunction(() => {
            const dbState = globalThis.__codexFirebaseDbState || { data: {} };
            const loginToStorageKey = (value) => Array.from(String(value || '').trim().toLowerCase())
                .map((char) => char.codePointAt(0).toString(16))
                .join('_');
            const ownKey = loginToStorageKey('smoke.admin@7271155.ru');
            const payload = ((dbState.data.dialog_history_messages || {})[ownKey] || {}).dlg_own_1;
            const messageMap = payload?.messages || {};
            return Object.keys(messageMap).length >= 3
                && Object.values(messageMap).some((entry) => String(entry?.content || '').includes('Продолжаю тот же диалог'));
        });
        const continuedDialogId = await page.evaluate(() => {
            return window.__CLIENT_SIMULATOR_TEST_HOOKS__?.getDialogWorkspaceStateForTest?.().currentDialogHistoryId || '';
        });
        expect(continuedDialogId === 'dlg_own_1', `Continuation must stay in the same dialog id, got ${continuedDialogId}`);
        await page.evaluate(async (dialogId) => {
            await window.__CLIENT_SIMULATOR_TEST_HOOKS__?.loadDialogHistorySelectionForTest?.(dialogId);
        }, continuedDialogId);

        await page.waitForFunction(() => {
            return document.querySelectorAll('#mainDialogHistoryList .dialog-history-item').length >= 2;
        });

        const activeTitleBeforeDblclick = await page.evaluate(() => {
            const activeItem = document.querySelector('#mainDialogHistoryList .dialog-history-item.is-active');
            const activeTextNode = activeItem?.querySelector('.dialog-history-item-title, .dialog-history-title-input-inline');
            if (activeTextNode instanceof HTMLInputElement) {
                return String(activeTextNode.value || '').trim();
            }
            return String(activeTextNode?.textContent || '').trim();
        });
        await page.locator('#mainDialogHistoryList .dialog-history-item').nth(1).locator('.dialog-history-item-main').dblclick();
        await page.waitForFunction(() => {
            const items = document.querySelectorAll('#mainDialogHistoryList .dialog-history-item');
            const secondItem = items[1];
            return !!secondItem?.querySelector('.dialog-history-title-input-inline');
        });
        const activeTitleAfterDblclick = await page.evaluate(() => {
            const activeItem = document.querySelector('#mainDialogHistoryList .dialog-history-item.is-active');
            const activeTextNode = activeItem?.querySelector('.dialog-history-item-title, .dialog-history-title-input-inline');
            if (activeTextNode instanceof HTMLInputElement) {
                return String(activeTextNode.value || '').trim();
            }
            return String(activeTextNode?.textContent || '').trim();
        });
        expect(
            activeTitleAfterDblclick === activeTitleBeforeDblclick,
            `Double-click rename must not switch the active dialog, got "${activeTitleBeforeDblclick}" -> "${activeTitleAfterDblclick}"`
        );
        await page.keyboard.press('Escape');
        await page.evaluate(async ({ dialogId, title }) => {
            await window.__CLIENT_SIMULATOR_TEST_HOOKS__?.renameDialogHistoryForTest?.(dialogId, title);
        }, { dialogId: continuedDialogId, title: 'Мой тестовый диалог' });
        await page.waitForFunction(() => {
            return Array.from(document.querySelectorAll('#mainDialogHistoryList .dialog-history-item-title'))
                .some((node) => String(node.textContent || '').includes('Мой тестовый диалог'));
        });
        await page.waitForFunction(({ dialogId }) => {
            const dbState = globalThis.__codexFirebaseDbState || { data: {} };
            const loginToStorageKey = (value) => Array.from(String(value || '').trim().toLowerCase())
                .map((char) => char.codePointAt(0).toString(16))
                .join('_');
            const ownKey = loginToStorageKey('smoke.admin@7271155.ru');
            const record = ((dbState.data.dialog_history_index || {})[ownKey] || {})[dialogId];
            return String(record?.title || '').includes('Мой тестовый диалог');
        }, { dialogId: continuedDialogId });

        const ownHistoryState = await page.evaluate((targetDialogId) => {
            const dbState = globalThis.__codexFirebaseDbState || { data: {} };
            const loginToStorageKey = (value) => Array.from(String(value || '').trim().toLowerCase())
                .map((char) => char.codePointAt(0).toString(16))
                .join('_');
            const ownKey = loginToStorageKey('smoke.admin@7271155.ru');
            const ownIndexMap = (dbState.data.dialog_history_index || {})[ownKey] || {};
            const ownMessagesMap = (dbState.data.dialog_history_messages || {})[ownKey] || {};
            const ownIndex = Object.values(ownIndexMap);
            const ownMessages = Object.values(ownMessagesMap);
            const renamedEntry = ownIndexMap[targetDialogId] || null;
            const renamedPayload = renamedEntry ? ownMessagesMap[renamedEntry.id] : null;
            return {
                indexCount: ownIndex.length,
                messagesCount: ownMessages.length,
                title: renamedEntry?.title || '',
                preview: renamedEntry?.preview || '',
                dialogId: renamedEntry?.id || '',
                messageEntries: Object.keys(renamedPayload?.messages || {}).length
            };
        }, continuedDialogId);
        expect(ownHistoryState.indexCount >= 2, `Own dialog history index must contain seeded dialogs plus the continued one, got ${ownHistoryState.indexCount}`);
        expect(ownHistoryState.messagesCount >= 2, `Own dialog history messages must contain seeded dialogs plus the continued one, got ${ownHistoryState.messagesCount}`);
        expect(ownHistoryState.dialogId === continuedDialogId, `Continuation must stay in the same dialog id, got ${ownHistoryState.dialogId}`);
        expect(ownHistoryState.messageEntries >= 3, `Continuation must append messages into the same dialog payload, got ${ownHistoryState.messageEntries}`);
        expect(ownHistoryState.title.includes('Мой тестовый диалог'), 'Renamed dialog title must persist into RTDB state');
        expect(ownHistoryState.preview.trim().length > 0, 'Dialog preview must persist into RTDB state');

        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForChatReady(page);
        await page.waitForSelector('#mainDialogHistoryList .dialog-history-item');
        await page.waitForFunction(() => {
            const listTitle = document.querySelector('#mainDialogHistoryList .dialog-history-item-title');
            const text = String(listTitle?.textContent || '');
            return text.includes('Мой тестовый диалог') || /гидробур|case/i.test(text);
        });

        await page.evaluate(async () => {
            const hooks = window.__CLIENT_SIMULATOR_TEST_HOOKS__;
            if (!hooks?.loadDialogHistorySelectionForTest || !hooks?.openDialogHistoryScopeForTest || !hooks?.getDialogWorkspaceStateForTest) {
                throw new Error('Dialog history parity test hooks are missing');
            }
            await hooks.loadDialogHistorySelectionForTest('dlg_own_voice_1');
        });

        await page.waitForFunction(() => {
            const hooks = window.__CLIENT_SIMULATOR_TEST_HOOKS__;
            const state = hooks?.getDialogWorkspaceStateForTest?.();
            return !!state
                && state.selectedId === 'dlg_own_voice_1'
                && state.currentDialogHistoryId === 'dlg_own_voice_1'
                && state.currentDialogHistoryMode === 'voice'
                && state.isDialogRated === false
                && state.hasPersistedDialogRating === true
                && state.inputDisabled === false
                && state.inputLocked === false
                && state.stageHidden === true
                && state.chatHidden === false
                && state.finishedNoticeCount >= 1
                && state.ratingMessageCount >= 1;
        });

        await page.fill('#userInput', 'Продолжаю сохранённый звонок');
        await page.click('#sendBtn');
        await page.waitForFunction(() => {
            return Array.from(document.querySelectorAll('#chatMessages .message .message-content'))
                .some((node) => String(node.textContent || '').includes('Продолжаю сохранённый звонок'));
        });
        await page.waitForFunction(() => {
            const dbState = globalThis.__codexFirebaseDbState || { data: {} };
            const loginToStorageKey = (value) => Array.from(String(value || '').trim().toLowerCase())
                .map((char) => char.codePointAt(0).toString(16))
                .join('_');
            const ownKey = loginToStorageKey('smoke.admin@7271155.ru');
            const payload = ((dbState.data.dialog_history_messages || {})[ownKey] || {}).dlg_own_voice_1;
            const ratingText = String(payload?.rating?.text || '').trim();
            const messageMap = payload?.messages || {};
            return ratingText.includes('Диалог уже оценён')
                && Object.values(messageMap).some((entry) => String(entry?.content || '').includes('Продолжаю сохранённый звонок'));
        });

        await page.evaluate(async () => {
            const hooks = window.__CLIENT_SIMULATOR_TEST_HOOKS__;
            await hooks.openDialogHistoryScopeForTest('foreign.user@tradicia-k.ru', {
                autoSelectFirst: true,
                selectCurrentDialog: false
            });
        });

        await page.waitForFunction(() => {
            const hooks = window.__CLIENT_SIMULATOR_TEST_HOOKS__;
            const state = hooks?.getDialogWorkspaceStateForTest?.();
            return !!state
                && state.scopeLogin === 'foreign.user@tradicia-k.ru'
                && state.selectedId === 'dlg_foreign_1'
                && state.currentDialogHistoryId === ''
                && state.currentDialogHistoryMode === 'voice'
                && state.inputDisabled === true
                && state.inputLocked === true
                && state.sendDisabled === true
                && state.voiceDisabled === true
                && state.stageHidden === true
                && state.chatHidden === false
                && state.finishedNoticeCount >= 1
                && state.ratingMessageCount >= 1;
        });
    } catch (error) {
        await ensureOutputDir();
        try {
            await page.screenshot({ path: path.join(outputDir, 'smoke-dialog-history-failure.png'), fullPage: true, timeout: 5000 });
        } catch {}
        throw error;
    } finally {
        await context.close();
    }
}

async function enforceHistoryPanelCollapsedState(page, collapsed = true) {
    const isCollapsed = await page.evaluate(() => document.body.classList.contains('history-sidebar-collapsed'));
    if (isCollapsed === collapsed) return;

    const toggleLocator = page.locator('#historySidebarToggle');
    const hasToggle = (await toggleLocator.count()) > 0;
    if (hasToggle) {
        await toggleLocator.click();
        await page.waitForFunction((targetState) => {
            return document.body.classList.contains('history-sidebar-collapsed') === targetState;
        }, collapsed);
        return;
    }

    await page.evaluate((targetState) => {
        document.body.classList.toggle('history-sidebar-collapsed', targetState);
    }, collapsed);
    await page.waitForFunction((targetState) => {
        return document.body.classList.contains('history-sidebar-collapsed') === targetState;
    }, collapsed);
}

async function runCollapsedHistoryPanelNoScrollbarFlow(browser, baseUrl) {
    const scenario = createIdleScenario();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await installCommonRoutes(context, scenario);
    await seedLocalState(context);
    const page = await context.newPage();

    try {
        logStep('run local collapsed history no-scrollbar scenario');
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await waitForChatReady(page);

        const isLocalMinimal = await page.evaluate(() => document.body.classList.contains('local-minimal-ui'));
        expect(isLocalMinimal, 'Collapsed-history scrollbar regression requires local-minimal-ui');

        await enforceHistoryPanelCollapsedState(page, true);
        await page.waitForFunction(() => document.body.classList.contains('history-sidebar-collapsed'));

        await page.waitForSelector('#historyPanel');
        const historyMetrics = await page.evaluate(() => {
            const panel = document.getElementById('historyPanel');
            const listWrap = document.querySelector('#historyPanel .history-thread-list-wrap, #historyPanel .dialog-history-list-wrap');
            const list = document.getElementById('mainDialogHistoryList');
            const compute = (node) => {
                if (!node) {
                    return null;
                }
                const style = getComputedStyle(node);
                return {
                    tagName: node.tagName,
                    overflowX: style.overflowX,
                    overflowY: style.overflowY,
                    scrollWidth: node.scrollWidth,
                    clientWidth: node.clientWidth,
                    scrollHeight: node.scrollHeight,
                    clientHeight: node.clientHeight,
                    scrollTop: node.scrollTop
                };
            };

            const panelBefore = compute(panel);
            const wrapBefore = compute(listWrap);
            const listBefore = compute(list);
            if (panel) panel.scrollTop = 9;
            if (listWrap) listWrap.scrollTop = 9;
            if (list) list.scrollTop = 9;

            return {
                panel,
                wrap: listWrap,
                list,
                panelAfter: compute(panel),
                wrapAfter: compute(listWrap),
                listAfter: compute(list),
                collapsed: document.body.classList.contains('history-sidebar-collapsed')
            };
        });

        expect(historyMetrics.collapsed, 'History panel must be collapsed for this check');

        const noScrollbarTargets = [historyMetrics.panelAfter, historyMetrics.wrapAfter, historyMetrics.listAfter].filter(Boolean);
        for (const target of noScrollbarTargets) {
            expect(
                target.overflowY === 'hidden' || target.overflowY === 'clip' || target.overflowY === 'visible',
                'Collapsed history panel or its descendants must not expose vertical overflow'
            );
            expect(
                target.scrollHeight <= (target.clientHeight + 1),
                'Collapsed history structure must not stay scrollable vertically'
            );
            expect(
                target.scrollTop === 0,
                'Collapsed history panel/descendants must ignore manual vertical scroll attempts'
            );
        }
    } catch (error) {
        await ensureOutputDir();
        await page.screenshot({ path: path.join(outputDir, 'smoke-collapsed-history-no-scrollbar-failure.png'), fullPage: true });
        throw error;
    } finally {
        await context.close();
    }
}

async function runAdminUsersDesktopTableLayoutFlow(browser, baseUrl) {
    const scenario = createIdleScenario();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await installCommonRoutes(context, scenario);
    await seedLocalState(context);
    const page = await context.newPage();

    try {
        logStep('run admin users desktop table layout scenario');
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await waitForChatReady(page);

        await openSettings(page);
        await ensureDetailsOpen(page, '#adminUsersAccessAccordion');
        await page.waitForFunction(() => {
            const details = document.querySelector('#adminUsersAccessAccordion');
            return !!details && details.open === true;
        });

        const refreshBtn = page.locator('#refreshAdminUsersBtn');
        if (await refreshBtn.count().catch(() => 0)) {
            await refreshBtn.first().click().catch(() => {});
        }

        await page.waitForFunction(() => {
            const table = document.querySelector('.admin-users-table');
            const tbody = document.querySelector('#adminUsersTableBody');
            const headerCells = document.querySelectorAll('.admin-users-table thead th');
            return !!table && !!tbody && headerCells.length >= 4;
        });

        const tableDisplayState = await page.evaluate(() => {
            const table = document.querySelector('.admin-users-table');
            const tableWrap = document.querySelector('.admin-table-wrap');
            if (!table || !tableWrap) return null;

            const headerRow = table.querySelector('thead tr');
            const rowElements = Array.from(table.querySelectorAll('thead tr, tbody tr'));
            const headCellElements = Array.from(table.querySelectorAll('thead th'));
            const bodyCellElements = Array.from(table.querySelectorAll('tbody td'));
            const headerCellTagNames = headerRow
                ? Array.from(headerRow.children).map((node) => node?.tagName?.toLowerCase() || '')
                : [];

            const displayOf = (node) => getComputedStyle(node).display;
            return {
                tableDisplay: getComputedStyle(table).display,
                headDisplay: getComputedStyle(table.querySelector('thead')).display,
                bodyDisplay: getComputedStyle(table.querySelector('tbody')).display,
                rowDisplays: rowElements.map((row) => displayOf(row)),
                headCellDisplays: headCellElements.map((cell) => displayOf(cell)),
                bodyCellDisplays: bodyCellElements.map((cell) => displayOf(cell)),
                headerCellTagNames,
                bodyCellTagNames: bodyCellElements.map((cell) => cell?.tagName?.toLowerCase() || ''),
                hiddenHeaderDisplays: Array.from(table.querySelectorAll('thead th:nth-child(3), thead th:nth-child(4)')).map((cell) => getComputedStyle(cell).display),
                wrapOverflowX: getComputedStyle(tableWrap).overflowX,
                wrapDisplay: getComputedStyle(tableWrap).display,
                wrapScrollWidth: tableWrap.scrollWidth,
                wrapClientWidth: tableWrap.clientWidth,
                hasDataRow: !!table.querySelector('tbody tr:not(.admin-empty-row)'),
                firstActionHoverMeta: table.querySelector('tbody tr:not(.admin-empty-row) td:nth-child(6)')?.getAttribute('data-hover-meta') || ''
            };
        });

        expect(!!tableDisplayState, 'Admin users table must be in DOM');
        expect(tableDisplayState.tableDisplay === 'table', 'Admin users table layout must remain native table');
        expect(
            tableDisplayState.headDisplay === 'table-header-group' || tableDisplayState.headDisplay === 'table-row-group' || tableDisplayState.headDisplay === 'table-row',
            'Admin users table header must remain table-like'
        );
        expect(
            tableDisplayState.bodyDisplay === 'table-row-group' || tableDisplayState.bodyDisplay === 'table',
            'Admin users table body must remain table-like'
        );
        expect(tableDisplayState.rowDisplays.length > 0, 'Admin table must expose real table rows in desktop view');
        expect(tableDisplayState.rowDisplays.every((value) => value === 'table-row'), 'Admin users table rows must stay table-row');
        expect(
            tableDisplayState.headerCellTagNames.length > 0 && tableDisplayState.headerCellTagNames.every((name) => name === 'th'),
            'Admin table header row must keep semantic table headers'
        );
        expect(
            tableDisplayState.bodyCellTagNames.length === 0 || tableDisplayState.bodyCellTagNames.every((name) => name === 'td'),
            'Admin users table body must keep semantic table cells'
        );
        expect(
            tableDisplayState.hiddenHeaderDisplays.length === 2 && tableDisplayState.hiddenHeaderDisplays.every((value) => value === 'none'),
            'Admin users table must hide separate access and activity columns on desktop'
        );
        expect(tableDisplayState.wrapDisplay === 'block' || tableDisplayState.wrapDisplay === 'grid', 'Admin table wrapper must remain block-based container');
        expect(tableDisplayState.wrapOverflowX === 'auto' || tableDisplayState.wrapOverflowX === 'scroll', 'Admin users table wrapper must remain horizontally scrollable, not card-grid');
        expect(tableDisplayState.wrapScrollWidth >= tableDisplayState.wrapClientWidth, 'Admin users table wrapper width must keep expected horizontal surface');

        if (tableDisplayState.hasDataRow) {
            expect(
                /Доступ:/i.test(tableDisplayState.firstActionHoverMeta) && /Активность:/i.test(tableDisplayState.firstActionHoverMeta),
                'Admin users table row must keep hover bubble data for access and activity'
            );
            await page.hover('.admin-users-table tbody tr:not(.admin-empty-row)');
            const hoverBubbleState = await page.evaluate(() => {
                const actionCell = document.querySelector('.admin-users-table tbody tr:not(.admin-empty-row) td:nth-child(6)');
                if (!actionCell) return null;
                const pseudo = getComputedStyle(actionCell, '::after');
                return {
                    content: pseudo.content || '',
                    opacity: pseudo.opacity || ''
                };
            });
            expect(!!hoverBubbleState, 'Admin users hover bubble state must be readable');
            expect(/Доступ:/i.test(hoverBubbleState.content) && /Активность:/i.test(hoverBubbleState.content), 'Admin users hover bubble content must include access and activity');
        }

        await closeSettings(page);
    } catch (error) {
        await ensureOutputDir();
        await page.screenshot({ path: path.join(outputDir, 'smoke-admin-users-desktop-table-failure.png'), fullPage: true });
        try {
            await closeSettings(page);
        } catch {}
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
        await ensurePromptPanelAvailable(page);
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

async function runPromptVariationVisibilityFlow(browser, baseUrl) {
    const scenario = createIdleScenario();
    const context = await browser.newContext({ viewport: { width: 430, height: 932 } });
    await installCommonRoutes(context, scenario);
    await seedLocalState(context);
    const page = await context.newPage();
    const altPromptText = `Smoke alt client ${Date.now()}`;

    try {
        logStep('run prompt variation visibility scenario');
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await waitForChatReady(page);

        await page.evaluate((altText) => {
            const hooks = window.__CLIENT_SIMULATOR_TEST_HOOKS__;
            const snapshot = hooks.getPublicPromptsSnapshot();
            const currentVariations = Array.isArray(snapshot.client_variations) ? snapshot.client_variations : [];
            const fallbackBase = {
                id: 'client-smoke-base',
                name: 'Основной',
                content: snapshot.client_prompt || 'Smoke base client prompt'
            };
            const baseVariation = currentVariations.find((variation) => variation && !variation.isLocal) || fallbackBase;
            snapshot.client_variations = [
                {
                    ...baseVariation,
                    id: String(baseVariation.id || 'client-smoke-base'),
                    name: String(baseVariation.name || 'Основной')
                },
                {
                    ...baseVariation,
                    id: 'client-smoke-alt',
                    name: 'Альтернатива',
                    content: altText
                }
            ];
            snapshot.client_activeId = String(baseVariation.id || 'client-smoke-base');
            hooks.simulateRemotePromptsSnapshot(snapshot);
        }, altPromptText);

        await page.waitForFunction(() => {
            const hooks = window.__CLIENT_SIMULATOR_TEST_HOOKS__;
            const state = hooks?.getPromptUiState?.('client');
            return !!state && Array.isArray(state.visibleVariations) && state.visibleVariations.length >= 2;
        });

        await page.click('button.mobile-tab[data-panel="instructions"]');

        await page.waitForFunction(() => {
            const label = document.getElementById('promptVariationsLabel');
            const chips = document.querySelectorAll('#promptVariations .prompt-variation-chip');
            return !!label
                && !label.hidden
                && chips.length >= 2
                && getComputedStyle(chips[0]).width === getComputedStyle(chips[1]).width;
        });
    } catch (error) {
        await ensureOutputDir();
        await page.screenshot({ path: path.join(outputDir, 'smoke-prompt-variation-visibility-failure.png'), fullPage: true });
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
        await page.evaluate(() => {
            if (typeof window.activateShellPanel === 'function') {
                window.activateShellPanel('instructions');
            }
            if (typeof window.setLocalPromptDrawerOpen === 'function') {
                window.setLocalPromptDrawerOpen(true);
            }
        });
        await page.waitForFunction(() => {
            const hooks = window.__CLIENT_SIMULATOR_TEST_HOOKS__;
            if (!hooks?.getPromptUiState) return false;
            const state = hooks.getPromptUiState('client');
            return typeof state?.activeContent === 'string' && state.activeContent.trim().length > 0;
        });

        await page.evaluate(({ localText }) => {
            window.__CLIENT_SIMULATOR_TEST_HOOKS__.forceBeginPromptEditing('client');
            const preview = document.getElementById('systemPromptPreview');
            preview.focus();
            preview.innerHTML = `${preview.innerHTML}<p>${localText}</p>`;
            preview.dispatchEvent(new Event('input', { bubbles: true }));
            if (typeof window.syncCurrentEditorNow === 'function') {
                window.syncCurrentEditorNow('client');
            }
        }, { localText: localDraftText });

        const simulationResult = await page.evaluate(({ remoteText }) => {
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
        }, { remoteText: remoteAdminText });

        expect(simulationResult?.deferred === true, 'Remote prompt snapshot was expected to defer during edit');

        await page.evaluate(() => window.__CLIENT_SIMULATOR_TEST_HOOKS__.forceEndPromptEditing('client'));
        await page.evaluate(() => {
            if (typeof window.preservePromptConflictAsLocalDraft === 'function') {
                window.preservePromptConflictAsLocalDraft('client');
            }
            if (typeof window.renderPromptSyncConflictNotice === 'function') {
                window.renderPromptSyncConflictNotice('client');
            }
        });
        await page.evaluate((remoteText) => {
            const hooks = window.__CLIENT_SIMULATOR_TEST_HOOKS__;
            const snapshot = hooks.getPublicPromptsSnapshot();
            const activeId = snapshot.client_activeId;
            snapshot.client_prompt = remoteText;
            snapshot.client_variations = (snapshot.client_variations || []).map((variation) => (
                variation.id === activeId
                    ? { ...variation, content: remoteText }
                    : variation
            ));
            hooks.simulateRemotePromptsSnapshot(snapshot);
        }, remoteAdminText);
        await page.waitForFunction((expectedValue) => {
            const state = window.__CLIENT_SIMULATOR_TEST_HOOKS__.getPromptUiState('client');
            const hasConflictNotice = (state.conflictMessage || '').includes('локальный скрытый draft');
            const compareActionBtn = document.getElementById('promptSyncConflictActionBtn');
            const compareActionAvailable = !!compareActionBtn && !compareActionBtn.hidden;
            const hasLocalContent = (state.activeContent || '').includes(expectedValue);
            return (state.activeIsLocal || hasConflictNotice || hasLocalContent)
                && (compareActionAvailable || hasConflictNotice || hasLocalContent);
        }, localDraftText);
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
        activityEndCount: Number(globalThis.__codexVoiceSmoke?.activityEndCount || 0),
        lastMessageClassName: String(document.querySelector('#chatMessages .message:last-child')?.className || '').trim(),
        lastMessageText: String(document.querySelector('#chatMessages .message:last-child')?.textContent || '').trim(),
        finishedNoticeCount: document.querySelectorAll('#chatMessages .voice-call-finished-note').length,
        finishedNoticeText: String(document.querySelector('#chatMessages .voice-call-finished-note')?.textContent || '').trim(),
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

        const primaryVoiceButtonVisible = await page.locator('#sendBtn').isVisible().catch(() => false);
        if (primaryVoiceButtonVisible) {
            await page.click('#sendBtn');
        } else {
            await page.click('#startVoiceBtn');
        }

        await page.waitForFunction(() => {
            const sendMode = String(document.getElementById('sendBtn')?.dataset?.mode || '').trim();
            const statusText = String(document.getElementById('voiceModeStatus')?.textContent || '').trim();
            const callNoticeText = String(document.querySelector('.voice-call-note .conversation-action-note-text')?.textContent || '').trim();
            const combinedText = `${statusText}\n${callNoticeText}`;
            return sendMode === 'voice-stop' && (
                combinedText.includes('Клиент на линии. Начинайте разговор.') ||
                combinedText.includes('Клиент на линии. Подготавливаем микрофон…') ||
                combinedText.includes('Клиент на линии. Можно говорить.') ||
                combinedText.includes('Слушаю вас') ||
                combinedText.includes('Клиент говорит…') ||
                combinedText.includes('Клиент отвечает') ||
                combinedText.includes('Ваша очередь говорить.')
            );
        }, null, { timeout: 12000 });

        if (voiceScenario === 'assistant-response-watchdog-retries-boundary') {
            await page.waitForFunction(() => {
                return Number(globalThis.__codexVoiceSmoke?.activityEndCount || 0) >= 1;
            }, null, { timeout: 9000 });
        }

        if (voiceScenario === 'assistant-response-stall-recovery') {
            await page.waitForFunction(() => {
                return Number(globalThis.__codexVoiceSmoke?.activityEndCount || 0) >= 3;
            }, null, { timeout: 14000 });
        }

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

        if (voiceScenario === 'idle-watchdog-finalizes-user-turn') {
            await page.waitForFunction(() => {
                return Array.from(document.querySelectorAll('.message.user'))
                    .some((node) => {
                        const text = String(node.textContent || '').trim();
                        return text.includes('CASE CX260C') && text.includes('900 свай');
                    });
            }, null, { timeout: 5000 });
        }

        const dialogState = await readVoiceSmokeState();

        expect(capturedVoiceRequests.length > 0, 'Voice token endpoint was not called');
        expect(dialogState.sendMode === 'voice-stop', 'Voice call did not switch send button into stop mode');
        expect(dialogState.bodyVoiceCallActive, 'Voice call active body state was not enabled');
        expect(dialogState.audioStartCount > 0, 'Assistant audio playback never started');
        const expectedUserNeedle = voiceScenario === 'assistant-response-stall-recovery'
            ? '900 отверстий'
            : 'CASE CX260C';
        expect(dialogState.userMessages.some((text) => text.includes(expectedUserNeedle)), 'Voice user transcript was not appended to chat');
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
        } else if (voiceScenario === 'idle-watchdog-finalizes-user-turn') {
            expect(
                dialogState.userMessages.some((text) => text.includes('CASE CX260C') && text.includes('900 свай')),
                'Manager turn stayed stuck in preview when Gemini did not send an explicit input boundary'
            );
            const firstUserIndex = dialogState.messageTimeline.findIndex((item) => item.role === 'user' && item.text.includes('900 свай'));
            const firstAssistantIndex = dialogState.messageTimeline.findIndex((item) => item.role === 'assistant' && item.text.includes('Могу предложить вариант'));
            expect(
                firstUserIndex !== -1 && firstAssistantIndex !== -1 && firstUserIndex < firstAssistantIndex,
                'Idle watchdog did not finalize the manager turn before the assistant reply'
            );
        } else if (voiceScenario === 'assistant-response-watchdog-retries-boundary') {
            expect(
                dialogState.assistantMessages.some((text) => text.includes('вариант под этот объём')),
                'Assistant response watchdog did not recover a stalled reply after the manager turn was already finalized'
            );
            expect(
                dialogState.activityEndCount >= 1,
                `Assistant response watchdog was expected to retry activityEnd, got ${dialogState.activityEndCount}`
            );
        } else if (voiceScenario === 'assistant-response-stall-recovery') {
            expect(
                dialogState.assistantMessages.some((text) => text.includes('рабочий вариант') && text.includes('сроки')),
                'Hard stall recovery did not restore a delayed assistant reply'
            );
            expect(
                dialogState.activityEndCount >= 3,
                `Hard stall recovery was expected to escalate repeated activityEnd retries, got ${dialogState.activityEndCount}`
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
        expect(stopState.lastMessageClassName.includes('voice-call-finished-note'), 'Voice end notice is not rendered as the last dialog item');
        expect(stopState.lastMessageText.includes('Разговор сохранён'), 'Final voice notice text is missing at the end of the dialog');
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

        const primaryVoiceButtonVisible = await page.locator('#sendBtn').isVisible().catch(() => false);
        if (primaryVoiceButtonVisible) {
            await page.click('#sendBtn');
        } else {
            await page.click('#startVoiceBtn');
        }
        await page.waitForFunction(() => {
            const sendMode = String(document.getElementById('sendBtn')?.dataset?.mode || '').trim();
            return sendMode === 'voice-stop';
        }, null, { timeout: 12000 });

        const desktopNewDialogVisible = await page.locator('#mainDialogHistoryNewBtn').isVisible().catch(() => false);
        const railNewDialogVisible = await page.locator('#historyRailNewBtn').isVisible().catch(() => false);
        if (desktopNewDialogVisible) {
            await page.click('#mainDialogHistoryNewBtn');
        } else if (railNewDialogVisible) {
            await page.click('#historyRailNewBtn');
        } else {
            throw new Error('Fresh dialog action is not visible during voice reset smoke');
        }
        await page.waitForFunction(() => {
            const sendMode = String(document.getElementById('sendBtn')?.dataset?.mode || '').trim();
            return sendMode !== 'voice-stop';
        }, null, { timeout: 8000 });

        const state = await readVoiceSmokeState();
        expect(capturedVoiceRequests.length > 0, 'Voice token endpoint was not called before starting a fresh dialog');
        expect(!state.bodyVoiceCallActive, 'Voice active body state must clear after chat reset');
        expect(state.sendMode !== 'voice-stop', 'Fresh dialog action must leave the primary action out of stop mode');
        expect(state.startConversationVisible, 'Start conversation block must return after fresh dialog reset');
        expect(state.chatMessagesCount === 0, 'Fresh dialog reset must remove buffered voice bubbles from the current view');
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
        await page.waitForFunction(() => {
            return Array.from(document.querySelectorAll('#chatMessages .message'))
                .some((node) => String(node.textContent || '').includes('Диалог завершен'));
        });
        await page.waitForSelector('.conversation-action-note .btn-conversation-rate');

        const isInputDisabled = await page.locator('#userInput').isDisabled();
        expect(isInputDisabled, 'Input must be locked after end_conversation');

        await page.click('.conversation-action-note .btn-conversation-rate');
        await page.waitForFunction(() => {
            const ratingText = document.querySelector('.message.rating')?.textContent || '';
            return ratingText.includes('Smoke rating done') && ratingText.includes('Что убило диалог');
        });
        await page.waitForFunction(() => {
            return Array.from(document.querySelectorAll('#chatMessages .message'))
                .some((node) => String(node.textContent || '').includes('Диалог завершен'));
        });
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

async function runAttestationStartFlow(browser, baseUrl) {
    const scenario = createEndConversationScenario();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await installCommonRoutes(context, scenario);
    await seedLocalState(context);
    const page = await context.newPage();

    try {
        logStep('run attestation start flow');
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await waitForChatReady(page);
        await page.waitForFunction(() => {
            return !!document.getElementById('startAttestationBtn');
        });

        await page.click('#startAttestationBtn');
        await page.waitForFunction(() => {
            return Array.from(document.querySelectorAll('#chatMessages .message'))
                .some((node) => !node.classList.contains('loading') && String(node.textContent || '').trim().length > 0);
        });
        await page.waitForFunction(() => {
            const startBlock = document.getElementById('startConversation');
            return !startBlock || startBlock.style.display === 'none';
        });

        const attestationState = await page.evaluate(() => ({
            isAttestationMode: document.body.classList.contains('attestation-mode'),
            inputDisabled: !!document.getElementById('userInput')?.disabled,
            exitBtnExists: !!document.getElementById('exitAttestationBtn')
        }));

        expect(attestationState.isAttestationMode, 'Attestation mode was not enabled after clicking the start card');
        expect(!attestationState.inputDisabled, 'Composer must stay enabled after entering attestation mode');
        expect(!attestationState.exitBtnExists, 'Attestation exit button must stay removed from the chat header');

        const startRequest = scenario.requests.find((item) => item.payload.requestType === 'chat_start' && item.payload.chatInput === '/start');
        expect(!!startRequest, 'Attestation start must trigger the same /start chat flow');

        await page.fill('#userInput', 'покажите конкретное решение под 900 лунок');
        await page.click('#sendBtn');
        await page.waitForFunction(() => {
            return Array.from(document.querySelectorAll('#chatMessages .message'))
                .some((node) => String(node.textContent || '').includes('Диалог завершен'));
        });
        await page.waitForSelector('.conversation-action-note .btn-conversation-rate');

        const isInputDisabledAfterEnd = await page.locator('#userInput').isDisabled();
        expect(isInputDisabledAfterEnd, 'Attestation chat must lock composer after terminal conversation action');

        await page.click('.conversation-action-note .btn-conversation-rate');
        await page.waitForFunction(() => {
            const ratingText = document.querySelector('.message.rating')?.textContent || '';
            return ratingText.includes('Smoke rating done') && ratingText.includes('Что убило диалог');
        });
        expect(scenario.requests.some((item) => item.payload.requestType === 'rating'), 'Attestation flow did not call the rating webhook');

        let attestationRequest = null;
        for (let attempt = 0; attempt < 40; attempt += 1) {
            attestationRequest = scenario.requests.find((item) => {
                return String(item.url || '').includes('/webhook/certification')
                    && String(item.payload?.mode || '').trim() === 'attestation';
            });
            if (attestationRequest) break;
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        expect(!!attestationRequest, 'Attestation flow did not send the certification webhook payload');
        expect(String(attestationRequest?.payload?.dialog || '').includes('покажите конкретное решение'), 'Attestation webhook did not include dialog text');
        expect(String(attestationRequest?.payload?.rating || '').includes('Smoke rating done'), 'Attestation webhook did not include rating text');
        expect(!!String(attestationRequest?.payload?.fileBase64 || '').trim(), 'Attestation webhook did not include generated report attachment');
    } catch (error) {
        await ensureOutputDir();
        await page.screenshot({ path: path.join(outputDir, 'smoke-attestation-start-failure.png'), fullPage: true });
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

async function runAuthPasswordResetFlow(browser, baseUrl) {
    const scenario = createIdleScenario();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await installCommonRoutes(context, scenario);
    await seedAuthFlowState(context, {
        authUsers: {},
        authSession: null,
        sendDelayMs: 250
    });
    const page = await context.newPage();

    try {
        logStep('run auth password reset flow');
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#nameModal.active');
        await page.fill('#modalLoginInput', 'resettest@tradicia-k.ru');
        await page.click('#authResetPasswordBtn');

        await page.waitForFunction(() => {
            const btn = document.getElementById('authResetPasswordBtn');
            return !!btn && /Отправляем/.test(String(btn.textContent || ''));
        });

        await page.waitForFunction(() => {
            const notification = document.querySelector('.copy-notification');
            return !!notification && /письмо для сброса/i.test(String(notification.textContent || ''));
        });

        const buttonLabel = await page.locator('#authResetPasswordBtn').textContent();
        expect(String(buttonLabel || '').trim() === 'Сбросить пароль', 'Reset password button label must reset after send');
        const submitDisabled = await page.locator('#modalNameSubmit').evaluate((node) => node.disabled);
        expect(!submitDisabled, 'Auth submit button must be re-enabled after password reset flow');
    } catch (error) {
        await ensureOutputDir();
        await page.screenshot({ path: path.join(outputDir, 'smoke-auth-password-reset-failure.png'), fullPage: true });
        throw error;
    } finally {
        await context.close();
    }
}

async function runAuthFirebasePasswordRecoveryFlow(browser, baseUrl) {
    const scenario = createIdleScenario();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await installCommonRoutes(context, scenario);
    const recoveryLogin = 'recovery@tradicia-k.ru';
    const oldPasswordHash = buildPasswordHashForSmoke(recoveryLogin, 'OldPass123!', 11);
    const nowIso = new Date().toISOString();
    await seedAuthFlowState(context, {
        authUsers: {
            [loginToStorageKey(recoveryLogin)]: {
                login: recoveryLogin,
                fio: 'Восстановление Пароля',
                role: 'user',
                passwordHash: oldPasswordHash,
                passwordNeedsSetup: false,
                emailVerifiedAt: nowIso,
                emailVerificationSentAt: null,
                failedLoginAttempts: 0,
                isBlocked: false,
                blockedReason: null,
                failedLoginBackoffUntil: null,
                blockedAt: null,
                sessionRevokedAt: null,
                passwordHashScheme: 'pbkdf2:v1',
                createdAt: nowIso,
                lastLoginAt: nowIso,
                lastSeenAt: nowIso,
                activeMs: 0
            }
        },
        authSession: null,
        sendDelayMs: 0,
        authBehaviorByEmail: {
            [recoveryLogin]: {
                expectedPassword: 'NewPass123!'
            }
        }
    });
    const page = await context.newPage();

    try {
        logStep('run auth firebase password recovery flow');
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#nameModal.active');
        await page.fill('#modalNameInput', 'Восстановление Пароля');
        await page.fill('#modalLoginInput', recoveryLogin);
        await page.fill('#modalPasswordInput', 'NewPass123!');
        await page.click('#modalNameSubmit');

        await page.waitForFunction(() => !document.getElementById('nameModal')?.classList.contains('active'));

        const result = await page.evaluate(() => {
            const authUsers = JSON.parse(localStorage.getItem('authUsers:v1') || '{}');
            const session = JSON.parse(localStorage.getItem('authSession:v1') || 'null');
            const entry = authUsers['72_65_63_6f_76_65_72_79_40_74_72_61_64_69_63_69_61_2d_6b_2e_72_75'] || null;
            const error = document.getElementById('passwordError');
            return {
                sessionLogin: session?.login || '',
                passwordHash: String(entry?.passwordHash || ''),
                errorVisible: !!error && getComputedStyle(error).display !== 'none' && String(error.textContent || '').trim().length > 0
            };
        });
        expect(result.sessionLogin === recoveryLogin, 'Recovered Firebase password login did not open the session');
        expect(result.passwordHash && result.passwordHash !== oldPasswordHash, 'Local password hash was not updated after Firebase recovery');
        expect(!result.errorVisible, 'Recovered Firebase password flow still shows an auth error');
    } catch (error) {
        await ensureOutputDir();
        await page.screenshot({ path: path.join(outputDir, 'smoke-auth-firebase-password-recovery-failure.png'), fullPage: true });
        throw error;
    } finally {
        await context.close();
    }
}

async function runAuthFirebaseConflictAutoResetFlow(browser, baseUrl) {
    const scenario = createIdleScenario();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await installCommonRoutes(context, scenario);
    const conflictLogin = 'conflict@tradicia-k.ru';
    const localPassword = 'LocalPass123!';
    const nowIso = new Date().toISOString();
    await seedAuthFlowState(context, {
        authUsers: {
            [loginToStorageKey(conflictLogin)]: {
                login: conflictLogin,
                fio: 'Конфликт Пароля',
                role: 'user',
                passwordHash: buildPasswordHashForSmoke(conflictLogin, localPassword, 19),
                passwordNeedsSetup: false,
                emailVerifiedAt: nowIso,
                emailVerificationSentAt: null,
                failedLoginAttempts: 0,
                isBlocked: false,
                blockedReason: null,
                failedLoginBackoffUntil: null,
                blockedAt: null,
                sessionRevokedAt: null,
                passwordHashScheme: 'pbkdf2:v1',
                createdAt: nowIso,
                lastLoginAt: nowIso,
                lastSeenAt: nowIso,
                activeMs: 0
            }
        },
        authSession: null,
        sendDelayMs: 150,
        authBehaviorByEmail: {
            [conflictLogin]: {
                expectedPassword: 'OtherFirebasePass!',
                createErrorCode: 'auth/email-already-in-use'
            }
        }
    });
    const page = await context.newPage();

    try {
        logStep('run auth firebase conflict auto-reset flow');
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#nameModal.active');
        await page.fill('#modalNameInput', 'Конфликт Пароля');
        await page.fill('#modalLoginInput', conflictLogin);
        await page.fill('#modalPasswordInput', localPassword);
        await page.click('#modalNameSubmit');

        await page.waitForFunction(() => {
            const notification = document.querySelector('.copy-notification');
            const error = document.getElementById('passwordError');
            return (
                (!!notification && /сброса пароля/i.test(String(notification.textContent || '')))
                || (!!error && /локальный пароль обновится автоматически/i.test(String(error.textContent || '')))
            );
        });

        const result = await page.evaluate(() => {
            const resetEmails = Array.isArray(globalThis.__codexPasswordResetEmails)
                ? [...globalThis.__codexPasswordResetEmails]
                : [];
            const error = document.getElementById('passwordError');
            return {
                resetEmails,
                errorText: String(error?.textContent || '').trim(),
                modalStillOpen: !!document.getElementById('nameModal')?.classList.contains('active')
            };
        });
        expect(result.modalStillOpen, 'Firebase conflict flow must keep the auth modal open');
        expect(result.resetEmails.includes(conflictLogin), 'Firebase conflict flow did not auto-send a password reset email');
        expect(/локальный пароль обновится автоматически/i.test(result.errorText), 'Firebase conflict flow did not explain the automatic local password sync');
    } catch (error) {
        await ensureOutputDir();
        await page.screenshot({ path: path.join(outputDir, 'smoke-auth-firebase-conflict-auto-reset-failure.png'), fullPage: true });
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
        await page.waitForFunction(() => {
            const hooks = window.__CLIENT_SIMULATOR_TEST_HOOKS__;
            if (!hooks?.getPromptUiState) return false;
            const client = String(hooks.getPromptUiState('client')?.activeContent || '');
            const manager = String(hooks.getPromptUiState('manager')?.activeContent || '');
            const voice = String(hooks.getPromptUiState('manager_call')?.activeContent || '');
            const rater = String(hooks.getPromptUiState('rater')?.activeContent || '');
            return client.length > 40 && manager.length > 30 && voice.length > 30 && rater.length > 30;
        });

        const devSession = await page.evaluate(() => JSON.parse(localStorage.getItem('authSession:v1') || 'null'));
        expect(!!devSession?.devBypass, 'Localhost dev auth must persist devBypass session flag');
        const promptState = await page.evaluate(() => {
            const hooks = window.__CLIENT_SIMULATOR_TEST_HOOKS__;
            return {
                client: String(hooks?.getPromptUiState?.('client')?.activeContent || ''),
                manager: String(hooks?.getPromptUiState?.('manager')?.activeContent || ''),
                voice: String(hooks?.getPromptUiState?.('manager_call')?.activeContent || ''),
                rater: String(hooks?.getPromptUiState?.('rater')?.activeContent || '')
            };
        });
        expect(promptState.client.includes('CASE CX260C'), 'Localhost default client prompt was not applied');
        expect(promptState.manager.includes('Традиция'), 'Localhost default manager prompt was not applied');
        expect(promptState.voice.includes('гидробур'), 'Localhost default voice prompt was not applied');
        expect(promptState.rater.includes('аудитор'), 'Localhost default rater prompt was not applied');

        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => !document.getElementById('nameModal')?.classList.contains('active'));
        await page.waitForFunction(() => {
            const hooks = window.__CLIENT_SIMULATOR_TEST_HOOKS__;
            return String(hooks?.getPromptUiState?.('client')?.activeContent || '').includes('CASE CX260C');
        });
    } catch (error) {
        await ensureOutputDir();
        await page.screenshot({ path: path.join(outputDir, 'smoke-localhost-dev-auth-failure.png'), fullPage: true });
        throw error;
    } finally {
        await context.close();
    }
}

async function runLocalMinimalLayoutRegressionFlow(browser, baseUrl) {
    const scenario = createIdleScenario();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await installCommonRoutes(context, scenario);
    await seedLocalState(context);
    const page = await context.newPage();

    try {
        logStep('run local minimal layout regression scenario');
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await waitForChatReady(page);

        const collapsedState = await page.evaluate(() => {
            const hooks = window.__CLIENT_SIMULATOR_TEST_HOOKS__;
            if (!hooks?.setHistorySidebarCollapsedForTest || !hooks?.getLocalLayoutMetricsForTest) {
                return null;
            }
            hooks.setHistorySidebarCollapsedForTest(true);
            return hooks.getLocalLayoutMetricsForTest();
        });
        expect(!!collapsedState, 'Local test hooks for layout regression are missing');
        expect(collapsedState.history.collapsed, 'History sidebar must switch into collapsed state in local layout smoke');
        expect(collapsedState.history.overflowY === 'hidden', `Collapsed history sidebar must hide vertical overflow, got ${collapsedState.history.overflowY}`);
        expect(collapsedState.history.scrollbarWidth === 'none', `Collapsed history sidebar must hide scrollbar width, got ${collapsedState.history.scrollbarWidth}`);

        const adminState = await page.evaluate(async () => {
            const hooks = window.__CLIENT_SIMULATOR_TEST_HOOKS__;
            if (!hooks?.openSettingsAdminForTest || !hooks?.getLocalLayoutMetricsForTest) {
                return null;
            }
            await hooks.openSettingsAdminForTest();
            return hooks.getLocalLayoutMetricsForTest();
        });
        expect(!!adminState, 'Local test hooks for admin layout regression are missing');
        expect(adminState.admin.settingsOpen, 'Settings modal must be open in admin layout smoke');
        expect(adminState.admin.panelVisible, 'Admin accordion must be visible in admin layout smoke');
        expect(adminState.admin.accessOpen, 'Users/access section must be open in admin layout smoke');
        expect(adminState.admin.layout === 'desktop', `Desktop admin layout flag must stay desktop, got ${adminState.admin.layout}`);
        expect(adminState.admin.rowCount >= 1, 'Admin users table must render at least one row in admin layout smoke');
        expect(adminState.admin.tableDisplay === 'table', `Desktop admin users table must render as table, got ${adminState.admin.tableDisplay}`);
        expect(adminState.admin.tableWrapDisplay === 'block' || adminState.admin.tableWrapDisplay === 'grid', `Admin table wrapper must stay block-like container, got ${adminState.admin.tableWrapDisplay}`);
        expect(adminState.admin.firstRowDisplay === 'table-row', `Desktop admin row must stay a table-row, got ${adminState.admin.firstRowDisplay}`);
        expect(String(adminState.admin.tableMinWidth || '').includes('px'), `Desktop admin table must keep a min-width, got ${adminState.admin.tableMinWidth}`);
        expect(Number(adminState.admin.inviteHeight || 0) > 0 && Number(adminState.admin.inviteHeight || 0) <= 64, `Invite row height must stay compact, got ${adminState.admin.inviteHeight}`);
    } catch (error) {
        await ensureOutputDir();
        await page.screenshot({ path: path.join(outputDir, 'smoke-local-minimal-layout-failure.png'), fullPage: true });
        throw error;
    } finally {
        await context.close();
    }
}

async function runLightThemeMobileRegressionFlow(browser, baseUrl) {
    const scenario = createIdleScenario();
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => {
        window.localStorage.setItem('theme', 'light');
    });
    await installCommonRoutes(context, scenario);
    await seedLocalState(context);
    const page = await context.newPage();

    try {
        logStep('run light theme mobile regression scenario');
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await waitForChatReady(page);

        const metrics = await page.evaluate(() => {
            const startBtn = document.getElementById('startBtn');
            const startVoiceBtn = document.getElementById('startVoiceBtn');
            const startAttestationBtn = document.getElementById('startAttestationBtn');
            const input = document.getElementById('userInput');
            const promptWrapper = document.querySelector('.prompt-wrapper');
            const mobileTabs = document.querySelector('.mobile-tabs');
            const activeMobileTab = document.querySelector('.mobile-tab.active');
            const settingsBtn = document.getElementById('settingsBtn');
            const mobileSettingsTabBtn = document.getElementById('mobileSettingsTabBtn');
            const localSettingsTopBtn = document.getElementById('localSettingsTopBtn');
            const chatPanelHeader = document.querySelector('#chatPanel .panel-header');

            const read = (element) => element ? getComputedStyle(element) : null;
            const startBtnStyle = read(startBtn);
            const startVoiceBtnStyle = read(startVoiceBtn);
            const startAttestationBtnStyle = read(startAttestationBtn);
            const inputStyle = read(input);
            const promptWrapperStyle = read(promptWrapper);
            const mobileTabsStyle = read(mobileTabs);
            const activeMobileTabStyle = read(activeMobileTab);
            const settingsBtnStyle = read(settingsBtn);
            const mobileSettingsTabBtnStyle = read(mobileSettingsTabBtn);
            const localSettingsTopBtnStyle = read(localSettingsTopBtn);
            const chatPanelHeaderStyle = read(chatPanelHeader);

            return {
                lightTheme: document.body.classList.contains('light-theme'),
                mobileTabsDisplay: mobileTabsStyle?.display || '',
                activeMobileTabBackground: activeMobileTabStyle?.backgroundColor || '',
                startBtnBackground: startBtnStyle?.backgroundColor || '',
                startVoiceBtnBackground: startVoiceBtnStyle?.backgroundColor || '',
                startAttestationBtnBackground: startAttestationBtnStyle?.backgroundColor || '',
                inputBackground: inputStyle?.backgroundColor || '',
                promptWrapperBackground: promptWrapperStyle?.backgroundColor || '',
                promptWrapperBorderTopWidth: promptWrapperStyle?.borderTopWidth || '',
                settingsBtnDisplay: settingsBtnStyle?.display || '',
                mobileSettingsTabDisplay: mobileSettingsTabBtnStyle?.display || '',
                localSettingsTopDisplay: localSettingsTopBtnStyle?.display || '',
                chatPanelHeaderDisplay: chatPanelHeaderStyle?.display || ''
            };
        });

        expect(metrics.lightTheme, 'Light theme must be active in mobile light-theme smoke');
        expect(metrics.mobileTabsDisplay === 'grid' || metrics.mobileTabsDisplay === 'flex', `Mobile tabs must be visible on mobile width, got ${metrics.mobileTabsDisplay}`);
        expect(metrics.startBtnBackground === metrics.startVoiceBtnBackground, `Chat and voice start cards must share the same light-theme background, got ${metrics.startBtnBackground} vs ${metrics.startVoiceBtnBackground}`);
        expect(metrics.startBtnBackground === metrics.startAttestationBtnBackground, `Chat and attestation start cards must share the same light-theme background, got ${metrics.startBtnBackground} vs ${metrics.startAttestationBtnBackground}`);
        expect(metrics.inputBackground === 'rgba(0, 0, 0, 0)' || metrics.inputBackground === 'transparent', `Light-theme composer input must stay transparent, got ${metrics.inputBackground}`);
        expect(metrics.promptWrapperBackground === 'rgba(0, 0, 0, 0)' || metrics.promptWrapperBackground === 'transparent', `Prompt wrapper must stay transparent in light theme, got ${metrics.promptWrapperBackground}`);
        expect(metrics.promptWrapperBorderTopWidth === '0px', `Prompt wrapper must not render an inner border in light theme, got ${metrics.promptWrapperBorderTopWidth}`);
        expect(metrics.activeMobileTabBackground !== 'rgb(127, 150, 255)', `Active mobile tab must not fall back to the old accent blue, got ${metrics.activeMobileTabBackground}`);
        expect(
            metrics.mobileSettingsTabDisplay !== 'none' || metrics.settingsBtnDisplay !== 'none',
            `Mobile settings button must live in the top app bar, got inline=${metrics.mobileSettingsTabDisplay}, floating=${metrics.settingsBtnDisplay}`
        );
        expect(metrics.localSettingsTopDisplay === 'none', `Old inline mobile settings button must stay hidden, got ${metrics.localSettingsTopDisplay}`);
        expect(metrics.chatPanelHeaderDisplay === 'none', `Chat panel header must stay hidden on mobile, got ${metrics.chatPanelHeaderDisplay}`);

        await page.click('.mobile-tab[data-panel="history"]');
        await page.waitForTimeout(150);
        const historyMetrics = await page.evaluate(() => {
            const list = document.getElementById('mainDialogHistoryList');
            if (list && list.children.length < 16) {
                list.innerHTML = '';
                for (let index = 0; index < 20; index += 1) {
                    const item = document.createElement('div');
                    item.className = 'dialog-history-item';
                    item.innerHTML = `<button class="dialog-history-item-main" type="button"><div class="dialog-history-item-title">Тестовый диалог ${index + 1}</div><div class="dialog-history-item-meta"><span class="dialog-history-item-badge">ЧАТ</span><span>${index + 1} репл.</span></div></button>`;
                    list.appendChild(item);
                }
            }
            const body = document.querySelector('#historyPanel .history-panel-body');
            if (body) {
                body.scrollTop = 240;
            }
            return {
                overflowY: body ? getComputedStyle(body).overflowY : '',
                scrollHeight: body?.scrollHeight || 0,
                clientHeight: body?.clientHeight || 0,
                scrollTop: body?.scrollTop || 0,
                historyHeaderDisplay: getComputedStyle(document.querySelector('#historyPanel .history-panel-header')).display
            };
        });
        expect(historyMetrics.historyHeaderDisplay === 'none', `History panel header must stay hidden on mobile, got ${historyMetrics.historyHeaderDisplay}`);
        expect(historyMetrics.overflowY === 'auto', `History panel body must stay scrollable on mobile, got ${historyMetrics.overflowY}`);
        expect(historyMetrics.scrollHeight > historyMetrics.clientHeight, `History panel body must overflow with seeded rows, got ${historyMetrics.scrollHeight} vs ${historyMetrics.clientHeight}`);
        expect(historyMetrics.scrollTop > 0, `History panel body must actually scroll on mobile, got ${historyMetrics.scrollTop}`);
    } catch (error) {
        await ensureOutputDir();
        await page.screenshot({ path: path.join(outputDir, 'smoke-light-theme-mobile-failure.png'), fullPage: true });
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
        await runPromptVariationVisibilityFlow(browser, baseUrl);
        await runPromptConflictRecoveryFlow(browser, baseUrl);
        await runPromptWorkflowFlow(browser, baseUrl);
        await runDialogHistoryPersistenceFlow(browser, baseUrl);
        await runCollapsedHistoryPanelNoScrollbarFlow(browser, baseUrl);
        await runAdminUsersDesktopTableLayoutFlow(browser, baseUrl);
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
        await runGeminiVoiceModeSmokeFlow(browser, baseUrl, {
            voiceScenario: 'idle-watchdog-finalizes-user-turn',
            expectedAssistantNeedle: 'вариант под этот объём'
        });
        await runGeminiVoiceModeSmokeFlow(browser, baseUrl, {
            voiceScenario: 'assistant-response-watchdog-retries-boundary',
            expectedAssistantNeedle: 'вариант под этот объём'
        });
        await runGeminiVoiceModeSmokeFlow(browser, baseUrl, {
            voiceScenario: 'assistant-response-stall-recovery',
            expectedAssistantNeedle: 'рабочий вариант'
        });
        await runClearChatStopsVoiceFlow(browser, baseUrl);
        await runEndConversationFlow(browser, baseUrl);
        await runGoSilentFlow(browser, baseUrl);
        await runAttestationStartFlow(browser, baseUrl);
        await runEmailAuthVerificationFlow(browser, baseUrl);
        await runAuthPasswordResetFlow(browser, baseUrl);
        await runAuthFirebasePasswordRecoveryFlow(browser, baseUrl);
        await runAuthFirebaseConflictAutoResetFlow(browser, baseUrl);
        await runLocalhostDevAuthFlow(browser, baseUrl);
        await runLocalMinimalLayoutRegressionFlow(browser, baseUrl);
        await runLightThemeMobileRegressionFlow(browser, baseUrl);
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
