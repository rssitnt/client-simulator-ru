import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, onDisconnect, set, get, update, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import {
    getAuth,
    sendSignInLinkToEmail,
    isSignInWithEmailLink,
    signInWithEmailLink,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

// Initialize Firebase
let db = null;
let firebaseApp = null;
let auth = null;
try {
    if (firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("EXAMPLE")) {
        firebaseApp = initializeApp(firebaseConfig);
        db = getDatabase(firebaseApp);
        auth = getAuth(firebaseApp);
        console.log("Firebase initialized");
    } else {
        console.warn("Firebase config is using placeholders.");
    }
} catch (e) {
    console.error("Firebase initialization failed:", e);
}

// n8n Webhook Configuration
// Unified simulator flows must use the production webhook; `webhook-test` only works while the workflow is armed in n8n.
const UNIFIED_SIMULATOR_WEBHOOK_URL = 'https://n8n-api.tradicia-k.ru/webhook/client-simulator';
const WEBHOOK_URL = UNIFIED_SIMULATOR_WEBHOOK_URL;
const RATE_WEBHOOK_URL = UNIFIED_SIMULATOR_WEBHOOK_URL;
const ATTESTATION_WEBHOOK_URL = 'https://n8n-api.tradicia-k.ru/webhook/certification';
const MANAGER_ASSISTANT_WEBHOOK_URL = UNIFIED_SIMULATOR_WEBHOOK_URL;
const AI_IMPROVE_WEBHOOK_URL = UNIFIED_SIMULATOR_WEBHOOK_URL;
const GEMINI_SDK_CDN_URL = 'https://cdn.jsdelivr.net/npm/@google/genai@1.40.0/+esm';
const GEMINI_LIVE_MODEL = 'gemini-3.1-flash-live-preview';
const GEMINI_LIVE_REMOTE_TOKEN_ENDPOINT = 'https://ti-client-simulator-studio.vercel.app/api/gemini-live-token';
const GEMINI_LIVE_TOKEN_ENDPOINT_STORAGE_KEY = 'geminiLiveTokenEndpoint';
const GEMINI_LIVE_VOICE_NAME_STORAGE_KEY = 'geminiLiveVoiceName';
const LEGACY_GEMINI_LIVE_API_KEY_STORAGE_KEY = 'geminiLiveApiKey';
const GEMINI_LIVE_DEFAULT_TOKEN_ENDPOINT = '/api/gemini-live-token';
const GEMINI_LIVE_ALLOWED_TOKEN_ENDPOINT_PATH = '/api/gemini-live-token';
const TRUSTED_VOICE_TOKEN_ENDPOINT_ORIGINS = new Set([
    'https://client-simulator.ru',
    'https://www.client-simulator.ru',
    'https://ti-client-simulator-studio.vercel.app'
]);
const GEMINI_FIRST_REPLY_HINT_DELAY_MS = 1800;
const GEMINI_LIVE_DEFAULT_VOICE = 'Enceladus';
const GEMINI_LIVE_MEDIA_RESOLUTION = 'MEDIA_RESOLUTION_LOW';
const GEMINI_LIVE_THINKING_BUDGET = 0;
const VOICE_FAST_PACE_INSTRUCTIONS = 'Говори максимально быстро и энергично, но разборчиво. Отвечай кратко: 1-2 предложения без повторов.';
const ATTESTATION_QUEUE_STORAGE_KEY = 'attestationQueue:v1';
const ATTESTATION_SEND_ATTEMPTS = 3;
const ATTESTATION_QUEUE_MAX_FAILURES = 8;
const ATTESTATION_SEND_RETRY_BASE_MS = 800;
const ATTESTATION_QUEUE_RETRY_DELAY_MS = 12000;
const RATING_SEND_ATTEMPTS = 5;
const RATING_SEND_RETRY_BASE_MS = 700;
const RATING_SEND_RETRY_MAX_MS = 5000;
const MARKDOWN_CACHE_MAX_SIZE = 250;
const MARKDOWN_CACHE_TEXT_LIMIT = 40000;
const AUTH_USERS_DB_PATH = 'users';
const AUTH_USERS_BY_UID_DB_PATH = 'users_by_uid';
const PARTNER_INVITES_DB_PATH = 'partner_invites';
const APP_CONFIG_DB_PATH = 'app_config';
const ACCESS_REVOKE_DB_PATH = 'access_revocations';
const USER_PRESENCE_DB_PATH = 'user_presence';
const PROMPT_OVERRIDES_DB_PATH = 'prompt_overrides';
const AUTH_LOCAL_STORAGE_KEY = 'authUsers:v1';
const PARTNER_INVITES_STORAGE_KEY = 'partnerInvites:v1';
const ACCESS_REVOKES_STORAGE_KEY = 'accessRevocations:v1';
const ACTIVE_TIME_CARRYOVER_STORAGE_KEY = 'activeTimeCarryover:v1';
const AUTH_SESSION_STORAGE_KEY = 'authSession:v1';
const LOCALHOST_DEV_AUTH_STORAGE_KEY = 'localhostDevAuthUser:v1';
const EMAIL_LINK_CONTEXT_STORAGE_KEY = 'emailLinkContext:v1';
const PENDING_EMAIL_SIGNIN_LINK_STORAGE_KEY = 'pendingEmailSignInLink:v1';
const EMAIL_LINK_HINT_STORAGE_KEY = 'emailLinkHint:v1';
const EMAIL_LINK_VERIFIED_HINT_STORAGE_KEY = 'emailLinkVerifiedHint:v1';
const EMAIL_LINK_AUTH_READY_STORAGE_KEY = 'emailLinkAuthReady:v1';
const EMAIL_LINK_PROCESSED_STORAGE_KEY = 'emailLinkProcessed:v1';
const CLIENT_CONVERSATION_ACTION_PROMPT_STORAGE_KEY = 'clientConversationActionPrompt:v1';
const RATER_HIDDEN_PROMPT_STORAGE_KEY = 'raterHiddenPrompt:v1';
const WEBHOOK_DEBUG_CONFIG_STORAGE_KEY = 'webhookDebugConfig:v1';
const WEBHOOK_DEBUG_LOG_STORAGE_KEY = 'webhookDebugLog:v1';
const WEBHOOK_DEBUG_LOG_MAX_ENTRIES = 40;
const ENABLE_LOCAL_WEBHOOK_DEBUG = false;
const FIREBASE_FRONTEND_GET_TIMEOUT_MS = 4000;
const EMAIL_LINK_PROCESSED_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_ID_STORAGE_KEY = 'sessionId';
const EMAIL_LINK_HINT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const EMAIL_LINK_VERIFIED_HINT_MAX_AGE_MS = 30 * 60 * 1000;
const EMAIL_LINK_AUTH_READY_MAX_AGE_MS = 30 * 60 * 1000;
const ACCESS_CONTROL_DECISION_REASON = {
    ADMIN: 'admin',
    CORPORATE: 'corporate',
    INVITE: 'invite',
    REVOKED: 'revoked',
    BLOCKED: 'blocked',
    NOT_FOUND: 'not_found'
};

const ACCESS_CONTROL_DECISION_ACTION = {
    REFRESH: 'refresh',
    CLOSE_SESSION: 'close_session',
    SHOW_HELP: 'show_help'
};
const CONVERSATION_ACTION_TYPE = {
    END: 'end_conversation',
    GO_SILENT: 'go_silent'
};
const LEGACY_WARN_EXIT_ACTION_TYPE = 'warn_exit';
const DEFAULT_CLIENT_CONVERSATION_ACTION_PROMPT_SUFFIX = `
СЛУЖЕБНЫЙ КОНТРАКТ ПЛАТФОРМЫ
Ты играешь клиента и можешь не только отвечать обычным текстом, но и управлять состоянием диалога.

Когда клиент продолжает разговор:
- можешь вернуть обычный текст
- или JSON вида {"message":"текст клиента"}

Когда клиент перестал отвечать, но его ещё можно вернуть:
- всегда возвращай JSON вида {"message":"","conversationAction":{"type":"go_silent","reason":"lost_interest"}}
- если выбрал go_silent, поле "message" должно быть пустым
- не добавляй текст ради вежливости, формальности, пояснения ухода или последней реплики

Когда клиент окончательно завершил разговор:
- по умолчанию верни JSON вида {"message":"","conversationAction":{"type":"end_conversation","reason":"manager_failed","shouldEvaluate":true}}
- добавляй финальную реплику только если без неё смысл завершения теряется

Используй go_silent или end_conversation, когда это реалистично:
- клиента не устроили цена, сроки, условия, наличие, сервис или общая уверенность в решении
- менеджер слабо обработал возражение и не убедил продолжать разговор
- менеджер явно сливает диалог, грубит, обесценивает запрос или прямо отказывает
- клиент получил всё нужное и разговор логично завершён

Приоритет выбора инструмента:
- go_silent выбирай, когда клиенту не хватило качества ответа: цена, сроки, условия или возражения обработаны слабо, доверие не появилось, интерес упал, и клиент просто молча уходит смотреть другие варианты
- end_conversation выбирай, когда разговор для клиента закрыт окончательно: менеджер явно сливает диалог, посылает «смотрите сайт», «возвращайтесь потом», даёт только общий прайс вместо решения, грубит, обесценивает запрос, прямо отказывает или клиент сам внутренне принял окончательное решение больше не продолжать
- клиент жёсткий и прагматичный: даже удовлетворительная, но неубедительная работа менеджера может привести к go_silent
- если сомневаешься между ними: молчаливый уход без ответа = go_silent, явный окончательный разрыв = end_conversation
- если клиента не устроили цена, сроки, сервис, наличие, риски или уверенность в решении, и менеджер не смог убедительно это обработать, по умолчанию выбирай go_silent
- даже если клиент внутри уже решил не покупать, но реалистично он бы просто пропал и пошёл к конкурентам, всё равно выбирай go_silent, а не end_conversation
- не используй end_conversation только потому, что предложение слабое, дорогое, долгое или неубедительное; для таких кейсов обычно реалистичнее go_silent
- end_conversation используй только когда клиент реально проговаривает окончательный разрыв или когда поведение менеджера настолько плохое, что молчаливый уход уже не выглядит естественным

Правила:
- если клиент уже фактически ушёл, не продолжай обычный разговор из вежливости
- не объясняй формат JSON
- возвращай либо обычный текст клиента, либо JSON-объект целиком
- reason пиши коротким slug латиницей: lost_interest, price_rejection, manager_failed, lost_trust, resolved и т.д.
`.trim();
const DEFAULT_RATING_RESULT_PROMPT_SUFFIX = `
СЛУЖЕБНЫЙ КОНТРАКТ ФОРМАТА ОЦЕНКИ
Оцени диалог кратко, конкретно и без воды.

Если можешь, возвращай JSON-объект такого вида:
{
  "summary": "короткий итог в 1-2 предложениях",
  "outcome": "go_silent | end_conversation | continue | unknown",
  "outcomeReason": "короткий slug причины, например lost_interest",
  "whatKilledDialogue": "что именно сломало диалог",
  "whatWasSalvageable": "что ещё можно было спасти или в какой точке разговор ещё можно было вернуть",
  "whyClientLeft": "почему клиент выбрал именно такой исход",
  "managerMistakes": ["короткая ошибка 1", "короткая ошибка 2"],
  "managerWins": ["сильный момент 1"],
  "nextBestStep": "лучший следующий шаг менеджера",
  "crmActions": ["действие для CRM 1", "действие для CRM 2"]
}

Правила:
- не заполняй поля выдумками; если данных нет, оставляй пустую строку или пустой массив
- managerMistakes, managerWins и crmActions делай короткими массивами без длинных абзацев
- whatKilledDialogue, whatWasSalvageable и whyClientLeft делай простым человеческим языком
- если JSON неудобен, верни обычный текст, но по возможности придерживайся этой структуры
`.trim();
const CORPORATE_EMAIL_DOMAINS = new Set([
    '7271155.ru',
    '7274069.ru',
    '9263541.ru',
    'butoboy.ru',
    'd-m.com.tr',
    'delta-makina.com',
    'deltaparts.ru',
    'gidromolot.ru',
    'hammer-kaz.kz',
    'hammer-master.ru',
    'hammer-rus.ru',
    'hammerkaz.kz',
    'hammermaster.kz',
    'hammermaster.ru',
    'hhammer.ru',
    'im-pulse.cn',
    'impulse-evo.com',
    'impulse.su',
    'impulse120.ru',
    'mirdelta.ru',
    'roxwell.ru',
    'tradicia-k.kz',
    'tradicia-k.ru',
    'tradicia-m.ru',
    'tradidgit.ru',
    'wearblade.ru',
    'wearscrew.ru',
    'wearservice.ru'
]);
const USER_ROLE_KEY = 'userRole';
const USER_NAME_KEY = 'managerName';
const USER_LOGIN_KEY = 'managerLogin';
const THEME_STORAGE_KEY = 'theme';
const ACCENT_COLOR_STORAGE_KEY = 'accentColor';
const RATER_PROMPT_VERSION_STORAGE_KEY = 'raterPromptVersion';
const MAX_FAILED_PASSWORD_ATTEMPTS = 15;
const ACTIVE_IDLE_TIMEOUT_MS = 60000;
const ACTIVE_TICK_MS = 8000;
const ACTIVE_FLUSH_MS = 15000;
const ACTIVE_REMOTE_USER_FLUSH_MS = 60000;
const USER_ACTIVITY_PRESENCE_SYNC_THROTTLE_MS = 3000;
const USER_ACTIVITY_TRACKING_LOOP_THROTTLE_MS = 3000;
const USER_ACTIVITY_WAKEUP_DEDUPE_MS = 400;
const USER_ACTIVITY_BLUR_PAUSE_DELAY_MS = 120;
const ACTIVE_TIME_CARRYOVER_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_REVOCATION_CHECK_MS = 20000;
const ADMIN_PRESENCE_RELATIVE_LABEL_REFRESH_MS = 90 * 1000;
const ADMIN_USERS_TABLE_RENDER_DEBOUNCE_MS = 80;
const ADMIN_REALTIME_INITIAL_DATA_WAIT_MS = 250;
const WEBHOOK_DEFAULT_TIMEOUT_MS = 45000;
const CHAT_WEBHOOK_TIMEOUT_MS = 45000;
const AI_HELPER_WEBHOOK_TIMEOUT_MS = 30000;
const RATING_WEBHOOK_TIMEOUT_MS = 45000;
const ATTESTATION_WEBHOOK_TIMEOUT_MS = 30000;
const AUTH_SESSION_RESTORE_TIMEOUT_MS = 10000;
const AUTH_FLOW_STEP_TIMEOUT_MS = 12000;
const AUTH_MAGIC_LINK_SEND_TIMEOUT_MS = 20000;
const PROMPTS_REST_FALLBACK_TIMEOUT_MS = 5000;
const PROTECTED_REALTIME_RECOVERY_DELAY_MS = 2000;
const PROMPT_REMOTE_SYNC_RETRY_DELAY_MS = 2000;
const FIREBASE_FRONTEND_WRITE_TIMEOUT_MS = 8000;
const ELEVENLABS_WIDGET_ELEMENT_NAME = 'elevenlabs-convai';
const ELEVENLABS_WIDGET_LOAD_TIMEOUT_MS = 4500;
const ELEVENLABS_WIDGET_VERSION = '0.10.3';
const ELEVENLABS_WIDGET_PRIMARY_SRC = `https://unpkg.com/@elevenlabs/convai-widget-embed@${ELEVENLABS_WIDGET_VERSION}/dist/index.js`;
const ELEVENLABS_WIDGET_FALLBACK_SRC = `https://cdn.jsdelivr.net/npm/@elevenlabs/convai-widget-embed@${ELEVENLABS_WIDGET_VERSION}/dist/index.js`;
const ELEVENLABS_WIDGET_SOURCES = [
    ELEVENLABS_WIDGET_PRIMARY_SRC,
    ELEVENLABS_WIDGET_FALLBACK_SRC
];
const EXTERNAL_SCRIPT_LOAD_TIMEOUT_MS = 8000;
const DOCX_LIBRARY_SRC = 'https://unpkg.com/docx@7.1.0/build/index.js';
const MAMMOTH_LIBRARY_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
const FILESAVER_LIBRARY_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js';
const TRUSTED_EXTERNAL_SCRIPT_METADATA = new Map([
    [ELEVENLABS_WIDGET_PRIMARY_SRC, { integrity: 'sha384-5tWP0n8XpR8xOqp5MbYmYLibF6/Ou7UFDhWn2ESUAz+qz6OlS9o8Fy1d+lMTQRuD' }],
    [ELEVENLABS_WIDGET_FALLBACK_SRC, { integrity: 'sha384-5tWP0n8XpR8xOqp5MbYmYLibF6/Ou7UFDhWn2ESUAz+qz6OlS9o8Fy1d+lMTQRuD' }],
    [DOCX_LIBRARY_SRC, { integrity: 'sha384-lGLqE+x3VglMuTcmrdpm32ZSDEh1a93PZ+jHuVZ8jG4DayHt4qNBJtmwL76C855e' }],
    [MAMMOTH_LIBRARY_SRC, { integrity: 'sha384-nFoSjZIoH3CCp8W639jJyQkuPHinJ2NHe7on1xvlUA7SuGfJAfvMldrsoAVm6ECz' }],
    [FILESAVER_LIBRARY_SRC, { integrity: 'sha384-PlRSzpewlarQuj5alIadXwjNUX+2eNMKwr0f07ShWYLy8B6TjEbm7ZlcN/ScSbwy' }]
]);
const EXTERNAL_SCRIPT_LOAD_PROMISES = new Map();
const SANITIZED_HTML_TAGS = [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'b', 'strong', 'i', 'em', 'del',
    'pre', 'code',
    'blockquote', 'a', 'span',
    'div', 'hr', 'br'
];
const SANITIZED_HTML_ATTRIBUTES = ['class', 'href', 'title', 'target', 'rel'];

const RATER_PROMPT_VERSION = '2025-01-30';
const PASSWORD_HASH_ALGORITHM = 'PBKDF2';
const PASSWORD_HASH_ITERATIONS = 120000;
const PASSWORD_HASH_KEY_BYTES = 32;
const PASSWORD_HASH_SALT_BYTES = 16;
const PASSWORD_HASH_FORMAT_PREFIX = 'pbkdf2:v1';
const PASSWORD_HASH_FALLBACK_PREFIX = 'sha256:v1';
const LEGACY_PASSWORD_HASH_HEX_RE = /^[a-fA-F0-9]{64}$/;
const FAILED_LOGIN_BACKOFF_BASE_MS = 1200;
const FAILED_LOGIN_BACKOFF_MAX_MS = 60 * 1000;
const DEFAULT_RATER_PROMPT = `РОЛЬ
Ты — строгий аудитор звонков компании. Твоя задача: автоматически классифицировать звонок (Сервисный центр или Сбыт навесного оборудования и запчастей) и оценить его по соответствующему регламенту. Работай только по правилам ниже, без домыслов, с прозрачными доказательствами из транскрипта.

ВХОДНЫЕ ДАННЫЕ
Полный транскрипт разговора (текст).
Метаданные (если есть): статус клиента (новый, CRM, постоянный, стратегический), является ли торгующей организацией, количество контактов за 30 дней, тип запроса (оборудование или запчасть), есть ли точный артикул, канал связи (входящий или исходящий).

ШАГ 1 — КЛАССИФИКАЦИЯ ДОМЕНА
Определи, к какому направлению относится звонок:

Направление SC (сервис):
Признаки: ремонт, диагностика, выезд или приезд в сервис, адрес и график зоны приёмки, условия оказания услуг, сроки выполнения работ, гарантия, сервисные работы, упоминание мастера, заявка в сервис, слова выезд или стационар.

Направление Sales (сбыт навесного и запчастей):
Признаки: подбор или покупка навесного оборудования (гидромолот, ковш, шнек, БСМ, адаптер, гидролинии, МК / БРС), коммерческое предложение (КП), цена и наличие, сроки поставки, сопутствующие товары, акции, презентация преимуществ продукции.

Если признаки смешаны, выбери то, что является основной целью клиента в разговоре (ремонт и услуги не равны покупке и подбору). Укажи уверенность в классификации (от 0 до 1) и объясни ключевые фразы.

СПЕЦСЛУЧАИ ОТБОРА И ИСКЛЮЧЕНИЯ
Sales / ЗИП: если клиент чётко знает конкретную запчасть (точный артикул или позицию) и звонит лишь узнать цену, наличие или попросить счёт — звонок НЕ оценивай (пропуск оценки, причина: только цена/наличие по точному артикулу).
Торгующие организации (Sales): если клиент помечен как торгующая организация и за последние 30 дней было 5 или более контактов — не включай в оценку.
Если статус в CRM постоянный или стратегический — отметь, что оценка качества не проводится (верни краткий разбор без баллов, пропуск оценки).

ШАГ 2 — ОЦЕНКА ПО ВЫБРАННОМУ РЕГЛАМЕНТУ

А) РЕГЛАМЕНТ SC (СЕРВИСНЫЙ ЦЕНТР)
Максимум позитивных баллов: 9 (без учёта штрафов).

Критерии и баллы:
Корпоративное приветствие: 0 при соблюдении; -1 при нарушении (неполное представление, не уточнил имя клиента).
Выявление потребности (проблемы или задачи по услугам): +1 при выявлении; -1 при отсутствии или недостаточных вопросах.
Условия оказания услуг: +2 если озвучены график работы, адрес зоны приёмки, формат выполнения (выезд или стационар); -1 если не озвучено или озвучено частично.
Цена и сроки оказания услуг: +2 при названии вилки цен и сроков; -1 если нет или частично.
Работа с возражениями: если возражений не было — +1; если были и отработаны по методике — +2; если были и не отработаны или отработаны не по методике — -2.
Сбор контактной информации (телефон, email, ФИО): +1 при выполнении; -1 при нарушении.
Договорённость в финале (подведение итогов, следующий шаг): +1; -1 при отсутствии.
Телефонный этикет (нейтральность, не перебивать, не задавать повторные вопросы, инициативность): 0 при норме; -2 при нарушениях.

Б) РЕГЛАМЕНТ Sales (СБЫТ НАВЕСНОГО И ЗАПЧАСТЕЙ)
Максимум позитивных баллов: 11 (без учёта штрафов).

Критерии и баллы:
Корпоративное приветствие: 0 при соблюдении; -0.5 за каждый подпункт нарушения (неполное представление; ни разу не назвал клиента по имени).
Выявление потребности (задача, объём работ, сроки, бюджет, материал; для ковшей — ширина; для запчастей и инструмента — тоже выявлять): +1.5 при выявлении; -1.5 при отсутствии или недостаточных вопросах.
Подбор оборудования на основе потребности: Базовое правило: +2, если предложены релевантные варианты на основе потребности и учтены известные ТТХ базовой машины, даны экспертные рекомендации с обоснованиями. В подбор гидравлики входит уточнение МК, гидролиний, БСМ или пальцев.
Ошибки и нарушения: -1 за техническую ошибку; 0 если подбор сделан без уточнений по МК / БРС, гидролиниям или БСМ (баллы не засчитывать), причем уточнения могут быть сделаны в любом месте диалога, в том числе в конце как дополнительные продажи; -0.5 если не учтена базовая машина; -2 если рекомендации основаны на домыслах, а не характеристиках.
Условия поставки (цена и сроки): +0.5 за цену; +0.5 за сроки. Если оба озвучены, всего +1. -0.5 за отсутствие каждого подпункта.
Работа с возражениями: Если возражений не было и НЕ было презентации из трёх преимуществ — 0. Если возражения были и отработаны по методике — +2. Если возражений не было, но сделана презентация (3 и более преимущества) — +1. +1 также, если начал отработку возражений по методике, но без явного подтверждения клиента.
Презентация преимуществ оборудования и возможностей компании: +0.5 за каждое названное преимущество (до +1.5 итого). Цель — назвать 3 и более преимущества. Автоматически +1.5: при отказе клиента слушать преимущества; при запросе на ЗИП; при запросе от эксплуатирующих компаний со статусом Постоянный. 0 при нарушении.
Сбор дополнительной информации на будущее: +0.5 за вопрос про технику (парк или состояние) и +0.5 за вопрос про сферу деятельности (засчитывать и при отказе клиента отвечать). 0 если попытки не было (не включая базовую машину для текущей задачи).
Предложение сопутствующих товаров или услуг и рассказ об актуальной акции: +1 при выполнении; 0 если нет.
Сбор контактной информации (телефон, email, контактное лицо): 0 при выполнении; -2 при нарушении. Для Постоянных клиентов — 0, если нет новой информации; для клиентов из CRM — достаточно уточнения канала отправки КП или перезвона.
Договорённость (итог разговора): +1 при наличии; -1 при отсутствии.
Телефонный этикет: 0 при норме; -2 при нарушениях (негатив, перебивания, повторные вопросы, отсутствие инициативы).

ШАГ 3 — ПОДСЧЁТ И ИТОГ
Суммируй все начисления и вычеты по выбранному регламенту. Итоговый сырой балл равен сумме баллов (может быть отрицательным из-за штрафов).
Максимальный балл равен 9 для Сервиса или 11 для Сбыта (эти числа не включают приветствие, контакты и этикет, где базовое значение 0).
Рассчитай процент выполнения: (сырой балл / максимальный балл) * 100. Округли до целого.
Вынесли вердикт: Отлично: 85 и более процентов. Норма: 70–84 процента. Нужны улучшения: 50–69 процентов. Критично: менее 50 процентов.
В пояснениях к каждому пункту указывай цитаты или маркеры из транскрипта, подтверждающие оценку.

ОСОБЫЕ ПРАВИЛА ПРИМЕНЕНИЯ
Всегда объясняй каждое начисление или штраф одной короткой цитатой или выдержкой из реплики.
Если пункт не применим к выбранному регламенту — ставь 0 и записывай пометку "не применимо".
Для Сбыта (пункт 3): без уточнений по МК / БРС, гидролиниям или БСМ начисление за подбор не засчитывай.
Для Сбыта (пункт 6): фиксируй 3 и более конкретных преимущества; если клиент отказался слушать, запросил запчасти или имеет статус Постоянный — ставь авто +1.5 и помечай причину.
Для Сервиса: условия оказания услуг и цена/сроки — это два разных пункта, не смешивай их.
При спорных ситуациях всегда выбирай более строгую трактовку (в пользу снижения балла) и указывай, чего не хватило до полного зачёта.

ФАКТ-ПРОВЕРКА ПЕРЕД ШТРАФОМ
Штраф "не назвал клиента по имени" допускается только если имя клиента НЕ встречается ни в одной реплике менеджера. Учитывай любые формы обращения: имя, имя+отчество, полное ФИО, фамилия+имя. Если хотя бы одно из них встречается — штраф запрещен. Всегда подтверждай штраф цитатой из реплики менеджера.

ФОРМАТ ВЫХОДА
Предоставь ответ в структурированном виде, содержащем следующие поля:
Домен (Сервисный центр, Сбыт или Пропуск).
Уверенность классификации (число).
Причины классификации.
Статус пропуска (да/нет) и причина пропуска (если есть).
Детальные оценки по каждому пункту:
Приветствие (балл, заметка).
Выявление потребности (балл, заметка).
Условия / Предложение (для Сервиса — график/адрес/формат; для Сбыта — цена/сроки) (балл, заметка).
Технический подбор или Стоимость услуг (для Сервиса — цена/сроки услуг; для Сбыта — подбор ТТХ/МК/БСМ/гидролинии) (балл, заметка).
Работа с возражениями (балл, заметка).
Презентация преимуществ (только Сбыт, иначе 0) (балл, заметка).
Дополнительная информация на будущее (только Сбыт, иначе 0) (балл, заметка).
Кросс-продажи и акции (только Сбыт, иначе 0) (балл, заметка).
Сбор контактов (балл, заметка).
Договоренность (балл, заметка).
Этикет (балл, заметка).
Итоговый сырой балл.
Максимально возможный балл для этого типа звонка.
Процент выполнения.
Вердикт (отлично, норма, нужны улучшения, критично).
Советы для коучинга (до 5 конкретных советов в повелительном наклонении на основе потерь баллов).
Действия для CRM (следующие шаги: отправить КП, уточнить данные, записать на диагностику и т.д.).
Метаданные (распознанный статус клиента, является ли торгующей организацией, применялась ли фильтрация торгующих организаций).`;

const localStorageScalarCache = new Map();
let isLocalStorageAccessible = true;

function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
}

// Generate unique session ID
let baseSessionId = getCachedStorageValue(SESSION_ID_STORAGE_KEY);
if (!baseSessionId) {
    baseSessionId = generateSessionId();
}
let clientSessionId = '';
let managerSessionId = '';
let raterSessionId = '';
let chatUiSessionVersion = 0;
const activeChatUiRequestControllers = new Set();

function createChatUiSessionResetError() {
    const error = new Error('Chat session changed');
    error.name = 'AbortError';
    error.code = 'CHAT_SESSION_RESET';
    return error;
}

function createChatUiRequestStaleError(message = 'Chat context changed') {
    const error = new Error(message);
    error.name = 'AbortError';
    error.code = 'CHAT_CONTEXT_STALE';
    return error;
}

function isChatUiRequestCancelledError(error) {
    return error?.code === 'CHAT_SESSION_RESET'
        || error?.code === 'CHAT_CONTEXT_STALE'
        || error?.name === 'AbortError';
}

function beginChatUiRequestGuard() {
    const controller = new AbortController();
    activeChatUiRequestControllers.add(controller);
    return {
        version: chatUiSessionVersion,
        sessionId: baseSessionId,
        controller,
        signal: controller.signal
    };
}

function finishChatUiRequestGuard(guard) {
    const controller = guard?.controller;
    if (!controller) return;
    activeChatUiRequestControllers.delete(controller);
}

function invalidateActiveChatUiRequests() {
    chatUiSessionVersion += 1;
    const controllers = Array.from(activeChatUiRequestControllers);
    activeChatUiRequestControllers.clear();
    controllers.forEach((controller) => {
        try {
            controller.abort(createChatUiSessionResetError());
        } catch (_) {}
    });
}

function ensureChatUiRequestGuardCurrent(guard) {
    if (!guard) return;
    if (guard.signal?.aborted || guard.version !== chatUiSessionVersion || guard.sessionId !== baseSessionId) {
        throw createChatUiSessionResetError();
    }
}

function refreshSessionIds(sessionId = baseSessionId) {
    baseSessionId = String(sessionId || generateSessionId());
    setCachedStorageValue(SESSION_ID_STORAGE_KEY, baseSessionId);
    clientSessionId = `${baseSessionId}_client`;
    managerSessionId = `${baseSessionId}_manager`;
    raterSessionId = `${baseSessionId}_rater`;
}

refreshSessionIds(baseSessionId);

const TEXT_EXTENSIONS = ['.txt', '.md', '.json', '.xml', '.csv', '.html', '.htm', '.rtf', '.log'];
const ENABLE_AGENT_LOGS = false;
const ENABLE_DEBUG_LOGS = false;
const AGENT_LOG_WEBHOOK_URL = 'http://127.0.0.1:7243/ingest/987d1d6f-727d-4fc5-a54f-c42484f79884';

function debugLog(...args) {
    if (!ENABLE_DEBUG_LOGS) return;
    console.log(...args);
}

function bindEvent(element, eventName, handler, options) {
    if (!element) return;
    element.addEventListener(eventName, handler, options);
}

function agentLog(message, dataFactory, meta = {}) {
    if (!ENABLE_AGENT_LOGS) return;
    try {
        const payloadData = typeof dataFactory === 'function' ? dataFactory() : dataFactory;
        fetch(AGENT_LOG_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                data: payloadData,
                timestamp: Date.now(),
                sessionId: typeof baseSessionId !== 'undefined' ? baseSessionId : 'unknown',
                ...meta
            })
        }).catch(() => {});
    } catch (e) {}
}

// Utility function for fetch with timeout
async function fetchWithTimeout(url, options = {}, timeoutMs = WEBHOOK_DEFAULT_TIMEOUT_MS) {
    const requestUrl = typeof url === 'string' ? url : String(url?.url || url || '');
    debugLog(`[Fetch] Starting request to: ${requestUrl.slice(0, 50)}... with timeout: ${timeoutMs/1000}s`);
    const startTime = Date.now();

    const controller = new AbortController();
    const externalSignal = options?.signal;
    let didTimeout = false;
    let externalAbortHandler = null;
    if (externalSignal) {
        if (externalSignal.aborted) {
            controller.abort(externalSignal.reason);
        } else {
            externalAbortHandler = () => controller.abort(externalSignal.reason);
            externalSignal.addEventListener('abort', externalAbortHandler, { once: true });
        }
    }
    const timeoutId = setTimeout(() => {
        didTimeout = true;
        controller.abort();
    }, timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        debugLog(`[Fetch] Request completed in ${duration}s`);
        return response;
        
    } catch (error) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.error(`[Fetch] Request failed after ${duration}s:`, error);
        
        if (error.name === 'AbortError') {
            if (didTimeout) {
                throw new Error(`Таймаут запроса (${timeoutMs/1000}с). Проверьте n8n workflow.`);
            }
            throw error;
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
        if (externalSignal && externalAbortHandler) {
            externalSignal.removeEventListener('abort', externalAbortHandler);
        }
    }
}

async function withPromiseTimeout(promise, timeoutMs, timeoutMessage = 'Операция превысила лимит ожидания.') {
    let timeoutId = null;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    });
    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}

function setAuthSubmitState(isLoading = false, label = AUTH_SUBMIT_DEFAULT_LABEL) {
    if (!modalNameSubmit) return;
    modalNameSubmit.disabled = !!isLoading;
    modalNameSubmit.textContent = String(label || AUTH_SUBMIT_DEFAULT_LABEL).trim() || AUTH_SUBMIT_DEFAULT_LABEL;
    modalNameSubmit.dataset.loading = isLoading ? 'true' : 'false';
    modalNameSubmit.setAttribute('aria-busy', isLoading ? 'true' : 'false');
}

async function runAuthStep(label, promiseFactory, timeoutMs = AUTH_FLOW_STEP_TIMEOUT_MS, timeoutMessage = '') {
    setAuthSubmitState(true, label);
    return withPromiseTimeout(
        Promise.resolve().then(() => promiseFactory()),
        timeoutMs,
        timeoutMessage || `Шаг авторизации превысил лимит ожидания (${timeoutMs / 1000}с).`
    );
}

function createFirebaseSnapshotShim(value) {
    return {
        exists() {
            return value !== null && value !== undefined;
        },
        val() {
            return value;
        }
    };
}

function firstSuccessfulPromise(promises = []) {
    const items = Array.isArray(promises) ? promises.filter(Boolean) : [];
    if (!items.length) {
        return Promise.reject(new Error('No promises to resolve.'));
    }

    return new Promise((resolve, reject) => {
        const errors = [];
        let pending = items.length;

        items.forEach((promise, index) => {
            Promise.resolve(promise)
                .then((value) => {
                    resolve(value);
                })
                .catch((error) => {
                    errors[index] = error;
                    pending -= 1;
                    if (pending <= 0) {
                        reject(errors.find(Boolean) || new Error('All strategies failed.'));
                    }
                });
        });
    });
}

async function firebaseGetWithTimeout(dbPath, timeoutMs = FIREBASE_FRONTEND_GET_TIMEOUT_MS) {
    if (!db) return null;
    const readStrategies = [
        get(ref(db, dbPath)),
        fetchFirebaseJsonViaRest(dbPath, timeoutMs).then((value) => createFirebaseSnapshotShim(value))
    ];
    return withPromiseTimeout(
        firstSuccessfulPromise(readStrategies),
        timeoutMs,
        `Firebase read timeout for ${dbPath}`
    );
}

async function firebaseWriteWithTimeout(writeOperation, timeoutMs = FIREBASE_FRONTEND_WRITE_TIMEOUT_MS, label = 'Firebase write') {
    if (typeof writeOperation !== 'function') return null;
    return withPromiseTimeout(
        Promise.resolve().then(() => writeOperation()),
        timeoutMs,
        `${label} timeout (${timeoutMs / 1000}с).`
    );
}

async function readResponseTextWithTimeout(response, timeoutMs = WEBHOOK_DEFAULT_TIMEOUT_MS, timeoutMessage = '') {
    let timeoutId = null;
    const effectiveTimeoutMessage = timeoutMessage || `Таймаут чтения ответа (${timeoutMs/1000}с). Проверьте n8n workflow.`;
    const textPromise = response.text();
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            try {
                response.body?.cancel?.();
            } catch (error) {}
            reject(new Error(effectiveTimeoutMessage));
        }, timeoutMs);
    });

    try {
        return await Promise.race([textPromise, timeoutPromise]);
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}

async function readResponseJsonWithTimeout(
    response,
    timeoutMs = WEBHOOK_DEFAULT_TIMEOUT_MS,
    timeoutMessage = '',
    fallbackValue
) {
    const rawText = await readResponseTextWithTimeout(
        response,
        timeoutMs,
        timeoutMessage || `Таймаут чтения JSON-ответа (${timeoutMs/1000}с).`
    );
    const trimmedText = String(rawText || '').trim();

    if (!trimmedText) {
        if (arguments.length >= 4) {
            return fallbackValue;
        }
        throw new Error('Сервер вернул пустой JSON-ответ.');
    }

    try {
        return JSON.parse(trimmedText);
    } catch (error) {
        if (arguments.length >= 4) {
            return fallbackValue;
        }
        throw new Error('Сервер вернул некорректный JSON-ответ.');
    }
}

function buildFirebaseRestUrl(path = '') {
    const baseUrl = String(firebaseConfig?.databaseURL || '').trim().replace(/\/+$/, '');
    const normalizedPath = String(path || '').trim().replace(/^\/+/, '');
    if (!baseUrl) return '';
    if (!normalizedPath) return `${baseUrl}.json`;
    return `${baseUrl}/${normalizedPath}.json`;
}

async function fetchFirebaseJsonViaRest(path, timeoutMs = PROMPTS_REST_FALLBACK_TIMEOUT_MS, options = {}) {
    const includeAuth = options?.includeAuth !== false;
    const url = buildFirebaseRestUrl(path);
    if (!url) return null;
    let requestUrl = url;
    if (includeAuth) {
        const token = await getFirebaseAuthIdToken().catch(() => '');
        if (token) {
            requestUrl += (requestUrl.includes('?') ? '&' : '?') + `auth=${encodeURIComponent(token)}`;
        }
    }
    const response = await fetchWithTimeout(requestUrl, {
        method: 'GET',
        credentials: 'omit',
        cache: 'no-store'
    }, timeoutMs);
    if (!response.ok) {
        throw new Error(`Firebase REST ${path} failed with HTTP ${response.status}`);
    }
    return readResponseJsonWithTimeout(
        response,
        timeoutMs,
        `Таймаут чтения Firebase REST ${path} (${timeoutMs / 1000}с).`,
        null
    );
}

async function writeFirebaseJsonViaRest(path, value, method = 'PUT', timeoutMs = FIREBASE_FRONTEND_WRITE_TIMEOUT_MS, options = {}) {
    const includeAuth = options?.includeAuth !== false;
    const url = buildFirebaseRestUrl(path);
    if (!url) return null;

    let requestUrl = url;
    if (includeAuth) {
        const token = await getFirebaseAuthIdToken().catch(() => '');
        if (token) {
            requestUrl += (requestUrl.includes('?') ? '&' : '?') + `auth=${encodeURIComponent(token)}`;
        }
    }

    const normalizedMethod = String(method || 'PUT').trim().toUpperCase();
    const requestOptions = {
        method: normalizedMethod,
        credentials: 'omit',
        cache: 'no-store',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (normalizedMethod !== 'DELETE') {
        requestOptions.body = JSON.stringify(value);
    }

    const response = await fetchWithTimeout(requestUrl, requestOptions, timeoutMs);
    if (!response.ok) {
        const errorText = await readResponseTextWithTimeout(
            response,
            timeoutMs,
            `Таймаут чтения ошибки Firebase REST ${normalizedMethod} ${path} (${timeoutMs / 1000}с).`,
            ''
        ).catch(() => '');
        throw new Error(`Firebase REST ${normalizedMethod} ${path} failed with HTTP ${response.status}${errorText ? `: ${errorText}` : ''}`);
    }

    return true;
}

async function firebaseWritePathWithFallback(dbPath, sdkWriteOperation, restPayload, restMethod = 'PUT', timeoutMs = FIREBASE_FRONTEND_WRITE_TIMEOUT_MS, label = 'Firebase write') {
    const strategies = [];
    if (db && typeof sdkWriteOperation === 'function') {
        strategies.push(Promise.resolve().then(() => sdkWriteOperation()));
    }
    strategies.push(writeFirebaseJsonViaRest(dbPath, restPayload, restMethod, timeoutMs));

    return withPromiseTimeout(
        firstSuccessfulPromise(strategies),
        timeoutMs,
        `${label} timeout (${timeoutMs / 1000}с).`
    );
}

function clearLocalStoreRecordByKey(localStore = {}, key = '', saveLocalStore = null) {
    if (!key || !localStore || typeof localStore !== 'object') return false;
    if (!Object.prototype.hasOwnProperty.call(localStore, key)) return false;
    delete localStore[key];
    if (typeof saveLocalStore === 'function') {
        saveLocalStore(localStore);
    }
    return true;
}

async function loadSingleFirebaseRecordWithVerifiedLocalFallback(options = {}) {
    const {
        dbPath = '',
        key = '',
        localStore = {},
        saveLocalStore = null,
        normalizeRecord = null,
        normalizeArgs = [],
        recordLabel = 'record'
    } = options;

    if (!key || typeof normalizeRecord !== 'function') {
        return null;
    }

    const localRecord = normalizeRecord(localStore[key], ...normalizeArgs);
    const remotePath = `${String(dbPath || '').replace(/\/+$/, '')}/${key}`;

    const readRestRecord = async () => {
        const restValue = await fetchFirebaseJsonViaRest(remotePath, FIREBASE_FRONTEND_GET_TIMEOUT_MS);
        const hasRemoteValue = !!restValue && typeof restValue === 'object';
        return {
            hasRemoteValue,
            normalized: hasRemoteValue ? normalizeRecord(restValue, ...normalizeArgs) : null
        };
    };

    if (db) {
        try {
            const snapshot = await firebaseGetWithTimeout(remotePath);
            if (snapshot.exists()) {
                const sdkValue = snapshot.val();
                const normalizedSdkRecord = normalizeRecord(sdkValue, ...normalizeArgs);
                if (normalizedSdkRecord) {
                    return normalizedSdkRecord;
                }
                console.warn(`Malformed ${recordLabel} record from Firebase SDK, keeping local fallback if present.`);
                return localRecord;
            }

            try {
                const restRecord = await readRestRecord();
                if (restRecord.normalized) {
                    return restRecord.normalized;
                }
                if (restRecord.hasRemoteValue) {
                    console.warn(`Malformed ${recordLabel} record from Firebase REST, keeping local fallback if present.`);
                    return localRecord;
                }
            } catch (restError) {
                console.error(`Failed to verify missing ${recordLabel} via Firebase REST:`, restError);
                return localRecord;
            }

            clearLocalStoreRecordByKey(localStore, key, saveLocalStore);
            return null;
        } catch (error) {
            console.error(`Failed to load ${recordLabel} from Firebase:`, error);
            try {
                const restRecord = await readRestRecord();
                if (restRecord.normalized) {
                    return restRecord.normalized;
                }
                if (restRecord.hasRemoteValue) {
                    console.warn(`Malformed ${recordLabel} record from Firebase REST, keeping local fallback if present.`);
                    return localRecord;
                }
            } catch (restError) {
                console.error(`Failed to load ${recordLabel} via Firebase REST:`, restError);
            }
            return localRecord;
        }
    }

    return localRecord;
}

async function waitForFirebaseAuthReady() {
    if (!auth) return;
    try {
        if (typeof auth.authStateReady === 'function') {
            await auth.authStateReady();
        }
    } catch (error) {
        console.warn('waitForFirebaseAuthReady failed:', error);
    }
}

function getFirebaseAuthLogin() {
    return normalizeLogin(auth?.currentUser?.email || '');
}

function hasFirebaseAuthSessionForLogin(login = '') {
    const normalizedLogin = normalizeLogin(login);
    if (!normalizedLogin) return false;
    return getFirebaseAuthLogin() === normalizedLogin;
}

async function ensureFirebaseAuthPasswordSession(login, password) {
    if (!auth || !login || !password) {
        throw new Error('Firebase Auth недоступен для открытия сессии.');
    }
    const email = normalizeLogin(login);
    if (!isValidLogin(email)) {
        throw new Error('Укажите корректный email для Firebase Auth.');
    }

    await waitForFirebaseAuthReady();

    if (auth.currentUser) {
        if (hasFirebaseAuthSessionForLogin(email)) {
            try {
                await auth.currentUser.getIdToken(true);
            } catch (error) {
                console.warn('Firebase ID token refresh failed:', error);
            }
            return true;
        }
        try {
            await signOut(auth);
        } catch (error) {
            console.warn('Firebase signOut before re-login failed:', error);
        }
    }

    let lastError = null;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        if (hasFirebaseAuthSessionForLogin(email)) {
            return true;
        }
    } catch (e1) {
        lastError = e1;
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            if (hasFirebaseAuthSessionForLogin(email)) {
                return true;
            }
        } catch (e2) {
            const c2 = String(e2?.code || '');
            if (c2 === 'auth/email-already-in-use') {
                try {
                    await signInWithEmailAndPassword(auth, email, password);
                    if (hasFirebaseAuthSessionForLogin(email)) {
                        return true;
                    }
                } catch (e3) {
                    lastError = e3;
                    console.warn(
                        'Firebase Auth: аккаунт уже существует, но пароль не подошёл (возможен только вход по ссылке из письма).',
                        e3?.code || e3
                    );
                }
            } else {
                lastError = e2;
                console.warn('ensureFirebaseAuthPasswordSession:', c2 || e2);
            }
        }
    }

    if (lastError) {
        throw lastError;
    }
    throw new Error('Не удалось открыть Firebase Auth-сессию.');
}

function buildRequestId(prefix = 'req') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildJsonRequestHeaders(requestId, scope = 'request', requestType = '') {
    const headers = { 'Content-Type': 'application/json' };
    if (requestId) {
        headers['X-Request-Id'] = requestId;
        headers['X-Idempotency-Key'] = `${scope}:${requestId}`;
    }
    if (requestType) {
        headers['X-Client-Simulator-Request-Type'] = String(requestType).trim();
    }
    return headers;
}

function buildUnifiedSimulatorWebhookPayload(requestType, payload = {}) {
    const normalizedRequestType = String(requestType || '').trim() || 'chat';
    const normalizedPayload = payload && typeof payload === 'object'
        ? { ...payload }
        : {};
    // Call sites provide the canonical fields; this helper backfills
    // compatibility aliases so the n8n workflow can migrate safely.
    const ensureStringAlias = (targetKey, sourceValue) => {
        const targetValue = String(normalizedPayload[targetKey] || '').trim();
        const nextValue = String(sourceValue || '').trim();
        if (!targetValue && nextValue) {
            normalizedPayload[targetKey] = nextValue;
        }
    };
    const ensureCanonicalString = (targetKey, fallbackKeys = []) => {
        const currentValue = String(normalizedPayload[targetKey] || '').trim();
        if (currentValue) return currentValue;
        for (const fallbackKey of fallbackKeys) {
            const fallbackValue = String(normalizedPayload[fallbackKey] || '').trim();
            if (!fallbackValue) continue;
            normalizedPayload[targetKey] = fallbackValue;
            return fallbackValue;
        }
        return '';
    };

    if (normalizedRequestType === 'chat' || normalizedRequestType === 'chat_start') {
        const userMessage = ensureCanonicalString('userMessage', ['chatInput', 'prompt', 'guardrailsInput', 'inputText']);
        const dialogHistory = ensureCanonicalString('dialogHistory', ['historyText']);
        const systemPrompt = ensureCanonicalString('systemPrompt', ['systemText']);
        ensureStringAlias('chatInput', userMessage);
        ensureStringAlias('prompt', userMessage);
        ensureStringAlias('guardrailsInput', userMessage);
        ensureStringAlias('inputText', userMessage);
        ensureStringAlias('historyText', dialogHistory);
        ensureStringAlias('systemText', systemPrompt);
    }

    if (normalizedRequestType === 'manager_assist') {
        const userMessage = ensureCanonicalString('userMessage', ['chatInput', 'prompt', 'guardrailsInput', 'inputText']);
        const dialogHistory = ensureCanonicalString('dialogHistory', ['historyText']);
        const systemPrompt = ensureCanonicalString('systemPrompt', ['systemText']);
        ensureStringAlias('chatInput', userMessage);
        ensureStringAlias('prompt', userMessage);
        ensureStringAlias('guardrailsInput', userMessage);
        ensureStringAlias('inputText', userMessage);
        ensureStringAlias('historyText', dialogHistory);
        ensureStringAlias('systemText', systemPrompt);
    }

    if (normalizedRequestType === 'improve') {
        const userMessage = ensureCanonicalString('userMessage', ['chatInput', 'prompt', 'guardrailsInput', 'inputText']);
        ensureStringAlias('chatInput', userMessage);
        ensureStringAlias('prompt', userMessage);
        ensureStringAlias('guardrailsInput', userMessage);
        ensureStringAlias('inputText', userMessage);
    }

    if (normalizedRequestType === 'rating') {
        const dialog = ensureCanonicalString('dialog', ['dialogHistory', 'chatInput', 'userMessage', 'prompt', 'guardrailsInput', 'inputText', 'historyText']);
        const systemPrompt = ensureCanonicalString('systemPrompt', ['raterPrompt', 'systemText']);
        ensureStringAlias('raterPrompt', systemPrompt);
        ensureStringAlias('dialogHistory', dialog);
        ensureStringAlias('chatInput', dialog);
        ensureStringAlias('userMessage', dialog);
        ensureStringAlias('prompt', dialog);
        ensureStringAlias('guardrailsInput', dialog);
        ensureStringAlias('inputText', dialog);
        ensureStringAlias('historyText', dialog);
        ensureStringAlias('systemText', systemPrompt);
    }

    return {
        requestType: normalizedRequestType,
        source: 'client-simulator-web',
        ...normalizedPayload
    };
}

async function requestAiImproveResponseText(requestId, userMessage, timeoutMs = AI_HELPER_WEBHOOK_TIMEOUT_MS, options = {}) {
    const response = await fetchWithTimeout(AI_IMPROVE_WEBHOOK_URL, {
        method: 'POST',
        headers: buildJsonRequestHeaders(requestId, 'improve', 'improve'),
        signal: options?.signal,
        body: JSON.stringify(buildUnifiedSimulatorWebhookPayload('improve', {
            userMessage,
            requestId
        }))
    }, timeoutMs);

    if (!response.ok) {
        const httpError = new Error(`HTTP ${response.status}`);
        httpError.httpStatus = response.status;
        throw httpError;
    }

    const responseText = await readResponseTextWithTimeout(
        response,
        timeoutMs,
        `Таймаут чтения ответа AI helper (${timeoutMs/1000}с). Проверьте n8n workflow.`
    );

    if (!responseText || !responseText.trim()) {
        throw new Error('Единый n8n workflow не вернул ответ для requestType=improve.');
    }

    return {
        response,
        responseText,
        endpoint: AI_IMPROVE_WEBHOOK_URL
    };
}

// DOM Elements
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const clearChatBtn = document.getElementById('clearChat');
const systemPromptInput = document.getElementById('systemPrompt');
const raterPromptInput = document.getElementById('raterPrompt');
const managerPromptInput = document.getElementById('managerPrompt');
const managerCallPromptInput = document.getElementById('managerCallPrompt');
const exportChatBtn = document.getElementById('exportChat');
const exportCurrentPromptBtn = document.getElementById('exportCurrentPrompt');
const promptVisibilityBtn = document.getElementById('promptVisibilityBtn');
const voiceBtn = document.getElementById('voiceBtn');
const aiAssistBtn = document.getElementById('aiAssistBtn');
const rateChatBtn = document.getElementById('rateChat');
const startBtn = document.getElementById('startBtn');
const startConversation = document.getElementById('startConversation');
const managerNameInput = document.getElementById('managerName');
const exitAttestationBtn = document.getElementById('exitAttestationBtn');
const startAttestationBtn = document.getElementById('startAttestationBtn');
const nameModal = document.getElementById('nameModal');
const authForm = document.getElementById('authForm');
const modalNameInput = document.getElementById('modalNameInput');
const modalLoginInput = document.getElementById('modalLoginInput');
const modalNameSubmit = document.getElementById('modalNameSubmit');
const nameModalStep1 = document.getElementById('nameModalStep1');
const modalPasswordInput = document.getElementById('modalPasswordInput');
const authMailHelp = document.getElementById('authMailHelp');
const authMailHelpImage = document.getElementById('authMailHelpImage');
const localhostDevAuthActions = document.getElementById('localhostDevAuthActions');
const localhostDevAuthBtn = document.getElementById('localhostDevAuthBtn');
const togglePasswordVisibilityBtn = document.getElementById('togglePasswordVisibility');
const authErrorText = document.getElementById('passwordError');
const promptVariationsContainer = document.getElementById('promptVariations');
const promptSyncConflictNotice = document.getElementById('promptSyncConflictNotice');
const promptLengthInfo = document.getElementById('promptLengthInfo');
const AUTH_SUBMIT_DEFAULT_LABEL = String(modalNameSubmit?.textContent || 'Войти').trim() || 'Войти';

// AI Improve Modal Elements
const aiImproveBtn = document.getElementById('aiImproveBtn');
const promptHistoryBtn = document.getElementById('promptHistoryBtn');
const promptCompareBtn = document.getElementById('promptCompareBtn');
const aiImproveModal = document.getElementById('aiImproveModal');
const aiImproveModalClose = document.getElementById('aiImproveModalClose');
const aiImproveModalTitle = document.getElementById('aiImproveModalTitle');
const aiImproveModalDescription = document.getElementById('aiImproveModalDescription');
const promptHistoryModal = document.getElementById('promptHistoryModal');
const promptHistoryModalClose = document.getElementById('promptHistoryModalClose');
const promptHistoryTitle = document.getElementById('promptHistoryTitle');
const promptHistoryList = document.getElementById('promptHistoryList');
const promptHistoryItemModal = document.getElementById('promptHistoryItemModal');
const promptHistoryItemModalClose = document.getElementById('promptHistoryItemModalClose');
const promptHistoryItemCloseBtn = document.getElementById('promptHistoryItemCloseBtn');
const promptHistoryItemTitle = document.getElementById('promptHistoryItemTitle');
const promptHistoryItemMeta = document.getElementById('promptHistoryItemMeta');
const promptHistoryItemDiffView = document.getElementById('promptHistoryItemDiffView');
const promptCompareModal = document.getElementById('promptCompareModal');
const promptCompareModalClose = document.getElementById('promptCompareModalClose');
const promptCompareTitle = document.getElementById('promptCompareTitle');
const promptCompareSummary = document.getElementById('promptCompareSummary');
const promptCompareDiffView = document.getElementById('promptCompareDiffView');
const promptCompareCancel = document.getElementById('promptCompareCancel');
const promptComparePublish = document.getElementById('promptComparePublish');
const voiceModeScreen = document.getElementById('voiceModeScreen');
const voiceModeActions = document.getElementById('voiceModeActions');
const voiceModeExitBtn = document.getElementById('voiceModeExitBtn');
const voiceModeRateBtn = document.getElementById('voiceModeRateBtn');
const elevenlabsConvaiWidget = document.getElementById('elevenlabsConvaiWidget');
const voiceModeStartBtn = document.getElementById('voiceModeStartBtn');
const voiceModeStopBtn = document.getElementById('voiceModeStopBtn');
const voiceModeStatus = document.getElementById('voiceModeStatus');

const aiImproveStep1 = document.getElementById('aiImproveStep1');
const aiImproveInput = document.getElementById('aiImproveInput');
const aiImproveSubmit = document.getElementById('aiImproveSubmit');
const aiImproveCancel = document.getElementById('aiImproveCancel');

const aiImproveStep2 = document.getElementById('aiImproveStep2');
const aiDiffView = document.getElementById('aiDiffView');
const aiImproveBack = document.getElementById('aiImproveBack');
const aiImproveApplyNew = document.getElementById('aiImproveApplyNew');
const aiImproveApplyCurrent = document.getElementById('aiImproveApplyCurrent');

// Settings Modal Elements
const adminPreviewToggleBtn = document.getElementById('adminPreviewToggleBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const currentUserName = document.getElementById('currentUserName');
const settingsNameInput = document.getElementById('settingsNameInput');
const accountLoginValue = document.getElementById('accountLoginValue');
const themeToggle = document.getElementById('themeToggle');
const currentRoleDisplay = document.getElementById('currentRoleDisplay');
const changeRoleBtn = document.getElementById('changeRoleBtn');
const roleChangePassword = document.getElementById('roleChangePassword');
const roleChangePasswordInput = document.getElementById('roleChangePasswordInput');
const roleChangeCancelBtn = document.getElementById('roleChangeCancelBtn');
const roleChangeConfirmBtn = document.getElementById('roleChangeConfirmBtn');
const roleChangeError = document.getElementById('roleChangeError');
const exportChatSettings = document.getElementById('exportChatSettings');
const exportPromptSettings = document.getElementById('exportPromptSettings');
const exportMenu = document.getElementById('exportMenu');
const exportPromptMenu = document.getElementById('exportPromptMenu');
const exportChatSettingsMenu = document.getElementById('exportChatSettingsMenu');
const exportPromptSettingsMenu = document.getElementById('exportPromptSettingsMenu');
const geminiApiKeyInput = document.getElementById('geminiApiKeyInput');
const geminiTokenEndpointInput = document.getElementById('geminiTokenEndpointInput');
const geminiVoiceNameInput = document.getElementById('geminiVoiceNameInput');
const saveVoiceConfigBtn = document.getElementById('saveVoiceConfigBtn');
const clearVoiceConfigBtn = document.getElementById('clearVoiceConfigBtn');
const adminHiddenClientPromptAccordion = document.getElementById('adminHiddenClientPromptAccordion');
const adminHiddenClientPromptInput = document.getElementById('adminHiddenClientPromptInput');
const adminHiddenClientPromptSaveBtn = document.getElementById('adminHiddenClientPromptSaveBtn');
const adminHiddenClientPromptResetBtn = document.getElementById('adminHiddenClientPromptResetBtn');
const adminHiddenRaterPromptAccordion = document.getElementById('adminHiddenRaterPromptAccordion');
const adminHiddenRaterPromptInput = document.getElementById('adminHiddenRaterPromptInput');
const adminHiddenRaterPromptSaveBtn = document.getElementById('adminHiddenRaterPromptSaveBtn');
const adminHiddenRaterPromptResetBtn = document.getElementById('adminHiddenRaterPromptResetBtn');
const adminWebhookDebugAccordion = document.getElementById('adminWebhookDebugAccordion');
const adminWebhookDebugMeta = document.getElementById('adminWebhookDebugMeta');
const adminWebhookDebugList = document.getElementById('adminWebhookDebugList');
const adminWebhookDebugClearBtn = document.getElementById('adminWebhookDebugClearBtn');
const adminUsersAccessAccordion = document.getElementById('adminUsersAccessAccordion');
const adminPanelAccordion = document.getElementById('adminPanelAccordion');
const adminPanel = document.getElementById('adminPanel');
const adminRefreshBtn = document.getElementById('adminRefreshBtn');
const adminUsersTableBody = document.getElementById('adminUsersTableBody');
const partnerInviteEmailInput = document.getElementById('partnerInviteEmailInput');
const partnerInviteDaysInput = document.getElementById('partnerInviteDaysInput');
const partnerInviteAddBtn = document.getElementById('partnerInviteAddBtn');
const instructionSelectEl = document.getElementById('instructionSelect');
const panelsContainer = document.querySelector('.panels-container');
const instructionsPanelElement = document.getElementById('instructionsPanel');
const instructionTabs = Array.from(document.querySelectorAll('.instruction-tab'));
const instructionEditors = Array.from(document.querySelectorAll('.instruction-editor'));
const instructionOptions = Array.from(document.querySelectorAll('.dropdown-option'));
const selectedInstructionText = document.getElementById('selectedInstructionText');
const instructionDropdown = document.getElementById('instructionDropdown');
const activeScenarioStrip = document.getElementById('activeScenarioStrip');
const activeScenarioTitle = document.getElementById('activeScenarioTitle');
const activeScenarioSummary = document.getElementById('activeScenarioSummary');
const activeScenarioPrefillBtn = document.getElementById('activeScenarioPrefillBtn');
const activeScenarioStartBtn = document.getElementById('activeScenarioStartBtn');
const activeScenarioClearBtn = document.getElementById('activeScenarioClearBtn');

const promptInputsByRole = {
    client: systemPromptInput,
    manager: managerPromptInput,
    manager_call: managerCallPromptInput,
    rater: raterPromptInput
};

const promptPreviewByRole = {
    client: document.getElementById('systemPromptPreview'),
    manager: document.getElementById('managerPromptPreview'),
    manager_call: document.getElementById('managerCallPromptPreview'),
    rater: document.getElementById('raterPromptPreview')
};

const SEND_BUTTON_ICON = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
    </svg>
`;

const VOICE_MODE_BUTTON_ICON = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.86 19.86 0 0 1 11.19 18.7a19.5 19.5 0 0 1-5.9-5.9A19.86 19.86 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.12.9.32 1.78.59 2.63a2 2 0 0 1-.45 2.11L8 9.67a16 16 0 0 0 6.33 6.33l1.21-1.2a2 2 0 0 1 2.11-.45c.85.27 1.73.47 2.63.59A2 2 0 0 1 22 16.92z"></path>
    </svg>
`;

const EYE_OPEN_ICON = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    </svg>
`;

const EYE_OFF_ICON = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 3l18 18"></path>
        <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83"></path>
        <path d="M9.9 4.24A10.9 10.9 0 0 1 12 4c7 0 11 8 11 8a21.2 21.2 0 0 1-5.08 5.94"></path>
        <path d="M6.61 6.61A20.7 20.7 0 0 0 1 12s4 8 11 8a10.9 10.9 0 0 0 5.08-1.24"></path>
    </svg>
`;

const CHIP_DELETE_ICON = `
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
        <path d="M3 3l6 6"></path>
        <path d="M9 3L3 9"></path>
    </svg>
`;

let pendingImprovedPrompt = null;
let pendingRole = null;
let pendingName = null;
let pendingVariationId = null;
let activePromptCompareContext = null;
let pendingRatingImproveContext = null;
let aiImproveMode = 'default';
let aiImproveRequestVersion = 0;
let aiImproveRequestController = null;
let webhookDebugEntries = ENABLE_LOCAL_WEBHOOK_DEBUG ? loadWebhookDebugEntries() : [];
let webhookDebugRenderQueued = false;
const LOCAL_PROMPTS_STORAGE_VERSION = 'v3';
const LEGACY_LOCAL_PROMPTS_STORAGE_VERSION = 'v2';
const HISTORY_LIMIT = 50;
const PROMPT_HISTORY_REMOTE_SYNC_DEBOUNCE_MS = 500;
const LOCAL_PROMPTS_HISTORY_STORAGE_KEY = 'promptHistory';
const LOCAL_PROMPTS_PUBLIC_SNAPSHOT_STORAGE_KEY = 'promptPublicSnapshot:v1';
const LOCAL_PROMPTS_EMERGENCY_BACKUP_STORAGE_KEY = 'promptPublicEmergencyBackup:v1';
let promptHistory = [];
let lastHistoryContent = {
    client: {},
    manager: {},
    manager_call: {},
    rater: {}
};
let isAttestationMode = false;
let attestationPrevState = null;

// State
let conversationHistory = [];
let conversationHistoryText = '';
let conversationHistoryRevision = 0;
let isProcessing = false;
let lastRating = null;
let isDialogRated = false;
let conversationTerminalAction = null;
let conversationRecoverableAction = null;
let isUserEditing = false;
let lastFirebaseData = null;
let lastPromptsFirebaseSnapshot = null;
let lastPromptsFirebaseSnapshotState = null;
let selectedRole = 'user';
let currentUser = null;
let activeAuthRestoreAttemptId = 0;
let pendingAuthRestoreMessage = '';
let isAppBootstrapped = false;
let isWindowLoaded = document.readyState !== 'loading';
let isChatReady = false;
let lockedPromptRole = null;
let lockedPromptVariationId = null;
let recognition = null;
let isRecording = false;
let isSpeechRecognitionAvailable = false;
let geminiSdkModulePromise = null;
let geminiLiveSession = null;
let geminiLiveApiClient = null;
let geminiVoiceInputStream = null;
let geminiVoiceAudioContext = null;
let geminiVoiceSourceNode = null;
let geminiVoiceProcessorNode = null;
let geminiVoiceSilenceGain = null;
let geminiVoicePlaybackCursor = 0;
let isGeminiVoiceConnecting = false;
let isGeminiVoiceActive = false;
let geminiVoiceCloseExpected = false;
let geminiVoiceStartTimestamp = 0;
let geminiVoiceStartAttemptId = 0;
let geminiVoiceStartAbortController = null;
let geminiVoiceDialogLines = [];
let geminiVoiceUserDraft = '';
let geminiVoiceAssistantDraft = '';
let geminiVoiceUserPreview = '';
let geminiVoiceAssistantPreview = '';
let geminiVoiceHasAssistantReply = false;
let geminiVoiceFirstReplyHintTimer = null;
let geminiVoiceSetupComplete = false;
let geminiVoiceFirstTurnRequested = false;
let geminiVoiceConversationFinished = false;
let openAiVoicePeerConnection = null;
let openAiVoiceDataChannel = null;
let openAiVoiceRemoteAudio = null;
let openAiResponsePending = false;
let openAiResponseQueued = false;
let openAiPendingUserTurn = '';
let openAiHasUnansweredUserTurn = false;
let openAiLastUserTurnCompact = '';
let openAiLastUserTurnAt = 0;
let openAiUserTranscriptByItemId = new Map();
let elevenLabsSocketBridgeInstalled = false;
let elevenLabsActiveSocketCount = 0;
let elevenLabsConversationFinished = false;
let elevenLabsWidgetLoadPromise = null;
let activeVoiceModeProvider = 'gemini';
let voiceModeOpenRequestId = 0;
let voiceModeWidgetHideTimerId = 0;
const elevenLabsSocketOpenState = new WeakMap();
let reratePromptElement = null;
let conversationActionNoticeElement = null;
let attestationQueue = [];
let isAttestationQueueFlushInProgress = false;
let attestationQueueRetryTimer = null;
let currentUserAccessMirrorSyncPromise = null;
let currentUserRecordUnsubscribe = null;
let currentUserRecordSubscriptionHealthy = false;
let authPasswordAutocompleteRequestId = 0;
let currentUserRecordListenerLogin = '';
let currentUserPromptOverridesUnsubscribe = null;
let currentUserPromptOverridesListenerLogin = '';
let currentUserPromptOverridesSubscriptionHealthy = false;
let currentUserPromptOverridesRecoveryTimerId = null;
let currentUserPromptOverridesStore = null;
let currentUserPromptOverridesStoreState = null;
let currentUserPromptOverridesSaveTimer = null;
let queuedPromptOverridesPayload = null;
let queuedPromptOverridesPayloadState = null;
let lastPromptOverridesRemoteHash = '';
let pendingPromptOverridesRemoteStore = null;
let pendingPromptOverridesRemoteStoreState = null;
let pendingPromptOverridesRemoteHash = '';
let currentUserPresenceConnectedUnsubscribe = null;
let currentUserPresencePath = '';
let currentUserPresenceDisconnect = null;
let currentUserPresenceSubscriptionHealthy = false;
let currentUserPresenceRecoveryTimerId = null;
let currentUserPresenceState = 'offline';
let currentUserPresenceLastPayloadKey = '';
let protectedRealtimeUnsubscribes = [];
let protectedRealtimeRecoveryTimerId = null;
let adminRealtimeUnsubscribes = [];
let adminRealtimeUsers = null;
let adminRealtimeInvites = null;
let adminRealtimeRevocations = null;
let adminRealtimePresence = null;
let adminRealtimeUsersByLogin = null;
let adminRealtimeInvitesByLogin = null;
let adminRealtimeRevocationsByLogin = null;
let adminRealtimePresenceByLogin = null;
let adminRealtimeSortedLogins = null;
let adminRealtimeRecoveryTimerId = null;
let adminUsersTableRenderDebounceTimerId = null;
let pendingAdminUsersTableRenderMode = '';
let adminStatusRefreshTimerId = null;
let adminRealtimeTableDataReadyWaiters = [];
let adminUsersTableRenderInProgress = false;
let adminUsersTableRenderWatchdogTimer = null;
let adminUserRowsByLogin = new Map();
let adminUsersTableInitialized = false;
let pendingPromptsFirebaseSnapshot = null;
let pendingPromptsFirebaseSnapshotState = null;
let publicPromptSyncRetryTimerId = null;
let publicPromptSyncRetryFullReplace = false;
let publicPromptSyncInFlight = false;
let lastPublicPromptsSnapshotHash = '';
let lastEmergencyPromptsSnapshotHash = '';
let lastPromptHistorySnapshotHash = '';
let promptHistoryRemoteSyncTimer = null;
let promptHistoryRemoteSyncInFlight = false;
let queuedPromptHistoryRemoteEntries = new Map();
let syncedPromptHistoryEntryIds = new Set();
const dirtyPromptOverrideRoles = new Set();
let promptOverridesSyncRetryTimerId = null;
let promptOverridesSyncInFlight = false;
let currentEditingPromptRole = '';
let activeTickTimerId = null;
let activeTimeFlushInFlight = false;
let pendingActiveMs = 0;
let lastActiveTimeRemoteFlushAt = 0;
let lastActiveTickAt = Date.now();
let lastUserActivityAt = Date.now();
let lastPresenceSyncTriggerAt = 0;
let lastActiveLoopEnsureAt = 0;
let lastForcedActivityWakeupAt = 0;
let lastForcedActivityWakeupSource = '';
let pendingBlurPauseTimerId = null;
const USER_ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart', 'wheel'];
let hasActivityListeners = false;
let lastSessionRevocationCheckAt = 0;
let sessionRevocationCheckInFlight = false;
let sessionRevocationListenersInitialized = false;
let currentUserPageExitHandled = false;
let activityTrackingHandlers = null;
let sessionRevocationWakeupHandler = null;
let authModalInitialFocusTimerId = null;
let didInteractWithAuthModalSinceOpen = false;
let fioSaveTimeout = null;
let didClearLegacyLocalPromptsStorageKeys = false;
let partnerInviteCreateInFlight = false;
let sharedAppConfig = {
    geminiTokenEndpoint: '',
    clientConversationActionPrompt: '',
    raterHiddenPrompt: ''
};
let publicActiveIds = {
    client: null,
    manager: null,
    manager_call: null,
    rater: null
};
const PROMPT_ROLES = ['client', 'manager', 'manager_call', 'rater'];
const ATTESTATION_PROMPT_ROLES = ['client', 'manager', 'rater'];
const MANAGER_CALL_PROMPT_MAX_CHARS = 4000;

// Prompt Variations Data
let promptsData = {
    client: { variations: [], activeId: null },
    manager: { variations: [], activeId: null },
    manager_call: { variations: [], activeId: null },
    rater: { variations: [], activeId: null }
};
const promptEditRemoteBaselineHashes = {};
const promptSyncConflictMessages = {};

function normalizeFio(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function sanitizeAuthName(value) {
    const raw = String(value || '');
    if (!raw) return '';

    const normalizedSpaces = raw.replace(/\s+/g, ' ');
    if (!/@/.test(normalizedSpaces)) {
        return normalizedSpaces;
    }

    return normalizedSpaces
        .split(' ')
        .filter(Boolean)
        .filter((part) => !/@/.test(part))
        .join(' ');
}

function normalizeLogin(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[<>"]/g, '');
}

function isValidFio(value) {
    const fio = normalizeFio(value);
    if (fio.length < 8) return false;
    return fio.split(' ').filter(Boolean).length >= 2;
}

function isValidLogin(value) {
    const email = normalizeLogin(value);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(value) {
    return String(value || '').length >= 6;
}

function normalizeRole(value) {
    return String(value || '').trim().toLowerCase() === 'admin' ? 'admin' : 'user';
}

function getRoleLabelUi(role) {
    if (role === 'admin') return 'Админ';
    return 'Юзер';
}

function getRoleIcon(role) {
    if (role === 'admin') return '🔑';
    return '👤';
}

function hasAdminAccount(user = currentUser) {
    return normalizeRole(user?.role || 'user') === 'admin';
}

removeCachedStorageValue('activeTestScenario:v1');
removeSafeLocalStorageValue(WEBHOOK_DEBUG_CONFIG_STORAGE_KEY);
removeSafeLocalStorageValue(WEBHOOK_DEBUG_LOG_STORAGE_KEY);
webhookDebugEntries = [];

function isLocalhostAdminPreviewHost() {
    const hostname = String(window?.location?.hostname || '').trim().toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function normalizeDebugPositiveInt(value, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.round(parsed)));
}

function getLocalWebhookDebugConfig() {
    if (!ENABLE_LOCAL_WEBHOOK_DEBUG) return {};
    if (!isLocalhostAdminPreviewHost()) return {};
    try {
        const parsed = getCachedLocalStorageJson(WEBHOOK_DEBUG_CONFIG_STORAGE_KEY);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        console.warn('Failed to read webhook debug config:', error);
        return {};
    }
}

function getRuntimeRatingRequestConfig() {
    const debugConfig = getLocalWebhookDebugConfig();
    return {
        attempts: normalizeDebugPositiveInt(debugConfig.ratingAttempts, RATING_SEND_ATTEMPTS, 1, RATING_SEND_ATTEMPTS),
        timeoutMs: normalizeDebugPositiveInt(debugConfig.ratingTimeoutMs, RATING_WEBHOOK_TIMEOUT_MS, 5000, 120000),
        retryBaseMs: normalizeDebugPositiveInt(debugConfig.ratingRetryBaseMs, RATING_SEND_RETRY_BASE_MS, 0, RATING_SEND_RETRY_MAX_MS),
        retryMaxMs: normalizeDebugPositiveInt(debugConfig.ratingRetryMaxMs, RATING_SEND_RETRY_MAX_MS, 0, 30000)
    };
}

function canUseAdminPreviewControls(user = currentUser) {
    return hasAdminAccount(user) || isLocalhostAdminPreviewHost();
}

function syncSelectedRole(nextRole = selectedRole) {
    const normalizedNextRole = normalizeRole(nextRole);
    const effectiveRole = canUseAdminPreviewControls()
        ? (normalizedNextRole === 'admin' ? 'admin' : 'user')
        : 'user';

    selectedRole = effectiveRole;
    setCachedStorageValue(USER_ROLE_KEY, effectiveRole);

    if (currentRoleDisplay) {
        currentRoleDisplay.textContent = getRoleLabelUi(effectiveRole);
    }
    syncAdminPreviewToggle(effectiveRole);

    return effectiveRole;
}

function isCorporateEmail(login) {
    const email = normalizeLogin(login);
    const atIndex = email.lastIndexOf('@');
    if (atIndex <= 0 || atIndex === email.length - 1) return false;
    const domain = email.slice(atIndex + 1);
    return CORPORATE_EMAIL_DOMAINS.has(domain);
}

function loginToStorageKey(login) {
    const normalized = normalizeLogin(login);
    return Array.from(normalized)
        .map((char) => char.codePointAt(0).toString(16))
        .join('_');
}

function decodeStorageKeyToLogin(storageKey = '') {
    if (!storageKey || typeof storageKey !== 'string') return '';
    const parts = storageKey.split('_');
    if (!parts.length) return '';
    const chars = [];
    for (const part of parts) {
        if (!part) return '';
        if (!/^[0-9a-fA-F]+$/.test(part)) return '';
        const codePoint = Number.parseInt(part, 16);
        if (!Number.isFinite(codePoint) || codePoint <= 0 || codePoint > 0x10FFFF) return '';
        chars.push(String.fromCodePoint(codePoint));
    }
    return normalizeLogin(chars.join(''));
}

function resolveNormalizedLogin(raw, loginFallback = '', loginKey = '') {
    const candidates = [
        raw?.login,
        raw?.email,
        raw?.legacyLogin,
        raw?.legacyKey,
        loginFallback,
        decodeStorageKeyToLogin(loginKey)
    ];
    for (const candidate of candidates) {
        const normalizedLogin = normalizeLogin(candidate);
        if (isValidLogin(normalizedLogin)) return normalizedLogin;
    }
    const decodedCandidate = decodeStorageKeyToLogin(raw?.legacyKey);
    if (isValidLogin(decodedCandidate)) return decodedCandidate;
    return '';
}

function getCurrentAuthUid() {
    return String(auth?.currentUser?.uid || '').trim();
}

function resolveAuthUidForLogin(login, fallback = '') {
    const normalizedLogin = normalizeLogin(login);
    const fallbackUid = String(fallback || '').trim();
    const authUid = getCurrentAuthUid();
    const authEmail = normalizeLogin(auth?.currentUser?.email || '');
    if (authUid && normalizedLogin && authEmail === normalizedLogin) {
        return authUid;
    }
    return fallbackUid || null;
}

function canSyncCurrentUserAccessMirror(user = currentUser) {
    if (!db || !user) return false;
    const normalizedLogin = normalizeLogin(user?.login || '');
    const authUid = getCurrentAuthUid();
    const authEmail = normalizeLogin(auth?.currentUser?.email || '');
    return !!(authUid && normalizedLogin && authEmail === normalizedLogin);
}

async function syncCurrentUserAccessMirror(user = currentUser, options = {}) {
    const requireRemote = !!options.requireRemote;
    const normalizedUser = normalizeUserRecord(user, user?.login);
    if (!normalizedUser || !canSyncCurrentUserAccessMirror(normalizedUser)) {
        if (requireRemote) {
            throw new Error('Невозможно синхронизировать access mirror без активной Firebase Auth-сессии.');
        }
        return false;
    }

    const uid = resolveAuthUidForLogin(normalizedUser.login, normalizedUser.uid);
    if (!uid) {
        if (requireRemote) {
            throw new Error('Не удалось определить uid для синхронизации access mirror.');
        }
        return false;
    }

    const payload = {
        uid,
        login: normalizedUser.login,
        role: normalizeRole(normalizedUser.role),
        legacyKey: loginToStorageKey(normalizedUser.login),
        updatedAt: new Date().toISOString()
    };

    try {
        await firebaseWritePathWithFallback(
            `${AUTH_USERS_BY_UID_DB_PATH}/${uid}`,
            () => set(ref(db, `${AUTH_USERS_BY_UID_DB_PATH}/${uid}`), payload),
            payload,
            'PUT',
            FIREBASE_FRONTEND_WRITE_TIMEOUT_MS,
            `Синхронизация access mirror превысила лимит (${FIREBASE_FRONTEND_WRITE_TIMEOUT_MS / 1000}с)`
        );
        return true;
    } catch (error) {
        console.error('Failed to sync user access mirror:', error);
        if (requireRemote) {
            throw error;
        }
        return false;
    }
}

async function ensureCurrentUserAccessMirror(user = currentUser, options = {}) {
    const requireRemote = !!options.requireRemote;
    if (!canSyncCurrentUserAccessMirror(user)) {
        if (requireRemote) {
            throw new Error('Firebase Auth-сессия не готова для записи access mirror.');
        }
        return false;
    }
    if (currentUserAccessMirrorSyncPromise) {
        const result = await currentUserAccessMirrorSyncPromise;
        if (requireRemote && !result) {
            throw new Error('Не удалось синхронизировать access mirror.');
        }
        return result;
    }

    currentUserAccessMirrorSyncPromise = (async () => {
        const normalizedUser = normalizeUserRecord(user, user?.login);
        if (!normalizedUser) return false;

        const resolvedUid = resolveAuthUidForLogin(normalizedUser.login, normalizedUser.uid);
        if (!resolvedUid) return false;

        let syncedUser = normalizedUser;
        if (normalizedUser.uid !== resolvedUid) {
            const patched = await patchUserRecord(normalizedUser.login, {
                uid: resolvedUid
            }, requireRemote ? { requireRemote: true } : {});
            syncedUser = normalizeUserRecord({
                ...normalizedUser,
                ...(patched || {}),
                uid: resolvedUid
            }, normalizedUser.login) || normalizedUser;
            if (currentUser && currentUser.login === syncedUser.login) {
                currentUser = syncedUser;
                currentUser.passwordHash = '';
                currentUser.passwordHashScheme = null;
            }
        }

        return syncCurrentUserAccessMirror(syncedUser, { requireRemote });
    })().finally(() => {
        currentUserAccessMirrorSyncPromise = null;
    });

    const result = await currentUserAccessMirrorSyncPromise;
    if (requireRemote && !result) {
        throw new Error('Не удалось синхронизировать access mirror.');
    }
    return result;
}

const LOCAL_JSON_STORAGE_FLUSH_MS = 160;
const localJsonStorageCache = new Map();
const localJsonStorageDirtyKeys = new Set();
const localJsonStorageRemovedKeys = new Set();
let localJsonStorageFlushTimer = null;

function getSafeLocalStorageValue(key) {
    if (!isLocalStorageAccessible) return null;
    try {
        return localStorage.getItem(key);
    } catch (error) {
        isLocalStorageAccessible = false;
        console.warn('LocalStorage read unavailable:', error);
        return null;
    }
}

function setSafeLocalStorageValue(key, value) {
    if (!isLocalStorageAccessible) return false;
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (error) {
        isLocalStorageAccessible = false;
        console.warn('LocalStorage write unavailable:', error);
        return false;
    }
}

function removeSafeLocalStorageValue(key) {
    if (!isLocalStorageAccessible) return false;
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        isLocalStorageAccessible = false;
        console.warn('LocalStorage remove unavailable:', error);
        return false;
    }
}

function normalizeLocalStorageJson(raw) {
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
}

function getCachedLocalStorageJson(key) {
    if (localJsonStorageCache.has(key)) {
        return localJsonStorageCache.get(key);
    }

    try {
        const parsed = normalizeLocalStorageJson(getSafeLocalStorageValue(key));
        localJsonStorageCache.set(key, parsed);
        return parsed;
    } catch (error) {
        console.error('Failed to parse local storage JSON:', key, error);
        const fallback = {};
        localJsonStorageCache.set(key, fallback);
        return fallback;
    }
}

function setCachedLocalStorageJson(key, value) {
    if (value === null || typeof value !== 'object') {
        clearCachedLocalStorageJson(key);
        return;
    }
    localJsonStorageCache.set(key, value);
    localJsonStorageRemovedKeys.delete(key);
    localJsonStorageDirtyKeys.add(key);
    scheduleLocalJsonStorageFlush();
}

function clearCachedLocalStorageJson(key, fallback = {}) {
    const normalizedFallback = (fallback && typeof fallback === 'object') ? fallback : {};
    localJsonStorageCache.set(key, normalizedFallback);
    localJsonStorageRemovedKeys.add(key);
    localJsonStorageDirtyKeys.add(key);
    scheduleLocalJsonStorageFlush();
}

function flushLocalJsonStorageCache() {
    if (localJsonStorageFlushTimer) {
        clearTimeout(localJsonStorageFlushTimer);
        localJsonStorageFlushTimer = null;
    }

    if (!localJsonStorageDirtyKeys.size) return;

    const keys = Array.from(localJsonStorageDirtyKeys);
    localJsonStorageDirtyKeys.clear();

    keys.forEach((key) => {
        if (localJsonStorageRemovedKeys.has(key)) {
            localJsonStorageRemovedKeys.delete(key);
            removeSafeLocalStorageValue(key);
            return;
        }

        const data = localJsonStorageCache.get(key);
        if (!data) {
            removeSafeLocalStorageValue(key);
            return;
        }

        try {
            setSafeLocalStorageValue(key, JSON.stringify(data));
        } catch (error) {
            console.error('Failed to persist local storage key:', key, error);
        }
    });
}

function scheduleLocalJsonStorageFlush(delayMs = LOCAL_JSON_STORAGE_FLUSH_MS) {
    if (localJsonStorageFlushTimer) return;
    localJsonStorageFlushTimer = setTimeout(flushLocalJsonStorageCache, delayMs);
}

function flushLocalJsonStorageCacheNow() {
    if (!localJsonStorageFlushTimer && !localJsonStorageDirtyKeys.size) return;
    flushLocalJsonStorageCache();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.addEventListener('beforeunload', flushLocalJsonStorageCacheNow);
    window.addEventListener('pagehide', flushLocalJsonStorageCacheNow);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            flushLocalJsonStorageCacheNow();
        }
    });
}

function getCachedStorageValue(key, fallback = '') {
    if (localStorageScalarCache.has(key)) {
        return localStorageScalarCache.get(key);
    }

    const raw = getSafeLocalStorageValue(key);
    const value = raw === null ? fallback : raw;
    localStorageScalarCache.set(key, value);
    return value;
}

function setCachedStorageValue(key, value) {
    const normalized = value == null ? '' : String(value);
    localStorageScalarCache.set(key, normalized);
    setSafeLocalStorageValue(key, normalized);
    return normalized;
}

function removeCachedStorageValue(key) {
    localStorageScalarCache.delete(key);
    removeSafeLocalStorageValue(key);
}

function listSafeLocalStorageKeysByPrefix(prefix = '') {
    if (!isLocalStorageAccessible) return [];
    try {
        const keys = [];
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = String(localStorage.key(index) || '');
            if (!key) continue;
            if (prefix && !key.startsWith(prefix)) continue;
            keys.push(key);
        }
        return keys;
    } catch (error) {
        isLocalStorageAccessible = false;
        console.warn('LocalStorage key enumeration unavailable:', error);
        return [];
    }
}

function setAuthSession(login, options = {}) {
    const normalizedLogin = normalizeLogin(login);
    const sessionPayload = {
        login: normalizedLogin,
        signedAt: new Date().toISOString()
    };
    if (options.devBypass && isLocalhostAdminPreviewHost()) {
        sessionPayload.devBypass = true;
    }
    setCachedStorageValue(AUTH_SESSION_STORAGE_KEY, JSON.stringify(sessionPayload));
}

function getAuthSession() {
    try {
        const raw = getCachedStorageValue(AUTH_SESSION_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed.login === 'string' ? parsed : null;
    } catch (error) {
        return null;
    }
}

function clearAuthSession() {
    removeCachedStorageValue(AUTH_SESSION_STORAGE_KEY);
}

function isLocalhostDevBypassSession(session = getAuthSession()) {
    return !!(isLocalhostAdminPreviewHost() && session?.devBypass && normalizeLogin(session?.login || ''));
}

function clearAuthCacheIdentity() {
    removeCachedStorageValue(USER_ROLE_KEY);
    removeCachedStorageValue(USER_NAME_KEY);
    removeCachedStorageValue(USER_LOGIN_KEY);
}

function clearAuthCacheIdentityForLogin(login = '') {
    const normalizedLogin = normalizeLogin(login);
    if (!normalizedLogin) return false;
    const cachedLogin = normalizeLogin(getCachedStorageValue(USER_LOGIN_KEY));
    if (cachedLogin !== normalizedLogin) return false;
    clearAuthCacheIdentity();
    return true;
}

function parseIsoMs(value) {
    const ms = new Date(value || '').getTime();
    return Number.isFinite(ms) ? ms : null;
}

function isSessionRevokedForSignedAt(sessionSignedAt, sessionRevokedAt) {
    const signedAtMs = parseIsoMs(sessionSignedAt);
    const revokedAtMs = parseIsoMs(sessionRevokedAt);
    if (!revokedAtMs) return false;
    if (!signedAtMs) return true;
    return signedAtMs <= revokedAtMs;
}

function loadLocalUsersStore() {
    return getCachedLocalStorageJson(AUTH_LOCAL_STORAGE_KEY);
}

function saveLocalUsersStore(store) {
    setCachedLocalStorageJson(AUTH_LOCAL_STORAGE_KEY, store || {});
}

function getLocalhostDevAuthUser() {
    if (!isLocalhostAdminPreviewHost()) return null;
    const stored = getCachedLocalStorageJson(LOCALHOST_DEV_AUTH_STORAGE_KEY);
    return normalizeUserRecord(stored, stored?.login);
}

function getLocalhostDevAuthUserByLogin(login = '') {
    const normalizedLogin = normalizeLogin(login);
    const stored = getLocalhostDevAuthUser();
    if (!stored) return null;
    if (normalizedLogin && stored.login !== normalizedLogin) return null;
    return stored;
}

function saveLocalhostDevAuthUser(record) {
    if (!isLocalhostAdminPreviewHost()) return null;
    const normalized = normalizeUserRecord(record, record?.login);
    if (!normalized) throw new Error('Invalid localhost dev auth user');
    setCachedLocalStorageJson(LOCALHOST_DEV_AUTH_STORAGE_KEY, toLocalUserCachePayload(normalized));
    return normalized;
}

function saveUserRecordToLocalCache(record) {
    const normalized = normalizeUserRecord(record, record?.login);
    if (!normalized) throw new Error('Invalid local user record');
    const key = loginToStorageKey(normalized.login);
    const localStore = loadLocalUsersStore();
    localStore[key] = toLocalUserCachePayload(normalized);
    saveLocalUsersStore(localStore);
    return normalized;
}

function toLocalUserCachePayload(record) {
    if (!record || typeof record !== 'object') return null;
    const normalized = normalizeUserRecord(record, record?.login);
    if (!normalized) return null;
    const cachedPasswordHash = String(record?.passwordHash || '').trim();
    const cachedPasswordHashScheme = String(record?.passwordHashScheme || '').trim();
    const shouldKeepPasswordHash = cachedPasswordHash.length > 0;

    return {
        uid: normalized.uid,
        login: normalized.login,
        fio: normalized.fio,
        role: normalized.role,
        passwordHash: shouldKeepPasswordHash ? cachedPasswordHash : '',
        passwordNeedsSetup: normalized.passwordNeedsSetup,
        emailVerifiedAt: normalized.emailVerifiedAt,
        emailVerificationSentAt: normalized.emailVerificationSentAt,
        failedLoginAttempts: normalized.failedLoginAttempts,
        isBlocked: normalized.isBlocked,
        blockedReason: normalized.blockedReason,
        failedLoginBackoffUntil: normalized.failedLoginBackoffUntil,
        blockedAt: normalized.blockedAt,
        sessionRevokedAt: normalized.sessionRevokedAt,
        passwordHashScheme: shouldKeepPasswordHash
            ? (cachedPasswordHashScheme || null)
            : null,
        createdAt: normalized.createdAt,
        lastLoginAt: normalized.lastLoginAt,
        lastSeenAt: normalized.lastSeenAt,
        activeMs: normalized.activeMs
    };
}

function loadLocalPartnerInvitesStore() {
    return getCachedLocalStorageJson(PARTNER_INVITES_STORAGE_KEY);
}

function loadLocalAccessRevokesStore() {
    return getCachedLocalStorageJson(ACCESS_REVOKES_STORAGE_KEY);
}

function saveLocalAccessRevokesStore(store) {
    setCachedLocalStorageJson(ACCESS_REVOKES_STORAGE_KEY, store || {});
}

function loadActiveTimeCarryoverStore() {
    return getCachedLocalStorageJson(ACTIVE_TIME_CARRYOVER_STORAGE_KEY);
}

function saveActiveTimeCarryoverStore(store, options = {}) {
    const normalizedStore = (store && typeof store === 'object') ? store : {};
    if (Object.keys(normalizedStore).length > 0) {
        setCachedLocalStorageJson(ACTIVE_TIME_CARRYOVER_STORAGE_KEY, normalizedStore);
    } else {
        clearCachedLocalStorageJson(ACTIVE_TIME_CARRYOVER_STORAGE_KEY);
    }
    if (options.flushNow) {
        flushLocalJsonStorageCacheNow();
    }
}

function normalizeActiveTimeCarryover(raw, loginFallback = '') {
    if (!raw || typeof raw !== 'object') return null;
    const login = normalizeLogin(raw.login || loginFallback);
    if (!isValidLogin(login)) return null;

    const pendingMs = Math.max(0, Math.round(Number(raw.pendingMs) || 0));
    const updatedAtMs = parseIsoMs(raw.updatedAt || '');
    const inFlightMs = Math.max(0, Math.round(Number(raw.inFlightMs) || 0));
    const inFlightAtMs = parseIsoMs(raw.inFlightAt || '');
    if (!pendingMs && !inFlightMs) return null;
    if (!updatedAtMs) return null;
    if ((Date.now() - updatedAtMs) > ACTIVE_TIME_CARRYOVER_TTL_MS) return null;

    return {
        login,
        pendingMs,
        updatedAt: new Date(updatedAtMs).toISOString(),
        inFlightMs: Math.min(pendingMs || inFlightMs, inFlightMs),
        inFlightAt: inFlightAtMs ? new Date(inFlightAtMs).toISOString() : null
    };
}

function pruneActiveTimeCarryoverStore(store = {}) {
    const next = {};
    Object.entries(store || {}).forEach(([key, value]) => {
        const normalized = normalizeActiveTimeCarryover(value);
        if (!normalized) return;
        next[key] = normalized;
    });
    return next;
}

function getActiveTimeCarryover(login = '') {
    const normalizedLogin = normalizeLogin(login);
    if (!normalizedLogin) return null;
    const key = loginToStorageKey(normalizedLogin);
    const store = pruneActiveTimeCarryoverStore(loadActiveTimeCarryoverStore());
    saveActiveTimeCarryoverStore(store);
    return store[key] || null;
}

function updateActiveTimeCarryover(login, updater, options = {}) {
    const normalizedLogin = normalizeLogin(login);
    if (!normalizedLogin || typeof updater !== 'function') return null;

    const key = loginToStorageKey(normalizedLogin);
    const store = pruneActiveTimeCarryoverStore(loadActiveTimeCarryoverStore());
    const current = store[key] || {
        login: normalizedLogin,
        pendingMs: 0,
        updatedAt: new Date().toISOString(),
        inFlightMs: 0,
        inFlightAt: null
    };
    const next = updater(current);
    const normalizedNext = normalizeActiveTimeCarryover(next, normalizedLogin);
    if (normalizedNext) {
        store[key] = normalizedNext;
    } else {
        delete store[key];
    }
    saveActiveTimeCarryoverStore(store, options);
    return normalizedNext || null;
}

function addActiveTimeCarryover(login, deltaMs, options = {}) {
    const increment = Math.max(0, Math.round(Number(deltaMs) || 0));
    if (!increment) return getActiveTimeCarryover(login);
    return updateActiveTimeCarryover(login, (current) => ({
        ...current,
        pendingMs: Math.max(0, Number(current.pendingMs) || 0) + increment,
        updatedAt: new Date().toISOString()
    }), options);
}

function markActiveTimeCarryoverInFlight(login, deltaMs, inFlightAt, options = {}) {
    const increment = Math.max(0, Math.round(Number(deltaMs) || 0));
    const atIso = parseIsoMs(inFlightAt) ? new Date(inFlightAt).toISOString() : new Date().toISOString();
    if (!increment) return getActiveTimeCarryover(login);
    return updateActiveTimeCarryover(login, (current) => {
        const pendingMs = Math.max(Math.max(0, Number(current.pendingMs) || 0), increment);
        return {
            ...current,
            pendingMs,
            inFlightMs: Math.min(pendingMs, increment),
            inFlightAt: atIso,
            updatedAt: atIso
        };
    }, options);
}

function acknowledgeActiveTimeCarryover(login, deltaMs, options = {}) {
    const decrement = Math.max(0, Math.round(Number(deltaMs) || 0));
    if (!decrement) return getActiveTimeCarryover(login);
    return updateActiveTimeCarryover(login, (current) => {
        const pendingMs = Math.max(0, (Number(current.pendingMs) || 0) - decrement);
        if (!pendingMs) return null;
        return {
            ...current,
            pendingMs,
            inFlightMs: 0,
            inFlightAt: null,
            updatedAt: new Date().toISOString()
        };
    }, options);
}

function reconcileActiveTimeCarryover(login, lastSeenAt = '') {
    const carryover = getActiveTimeCarryover(login);
    if (!carryover?.inFlightMs || !carryover.inFlightAt) return carryover;
    const lastSeenAtMs = parseIsoMs(lastSeenAt || '');
    const inFlightAtMs = parseIsoMs(carryover.inFlightAt);
    if (!lastSeenAtMs || !inFlightAtMs || lastSeenAtMs < inFlightAtMs) {
        return carryover;
    }
    return acknowledgeActiveTimeCarryover(login, carryover.inFlightMs, { flushNow: true });
}

function normalizeUserPresence(raw, loginFallback = '') {
    if (!raw || typeof raw !== 'object') return null;
    const login = normalizeLogin(raw.login || loginFallback);
    if (!isValidLogin(login)) return null;

    const state = ['online', 'idle', 'away', 'hidden', 'offline'].includes(raw.state)
        ? raw.state
        : 'offline';
    const updatedAtMs = parseIsoMs(raw.updatedAt);
    const lastActiveAtMs = parseIsoMs(raw.lastActiveAt);

    return {
        login,
        state,
        sessionId: String(raw.sessionId || '').trim(),
        role: normalizeRole(raw.role),
        updatedAt: updatedAtMs ? new Date(updatedAtMs).toISOString() : null,
        lastActiveAt: lastActiveAtMs ? new Date(lastActiveAtMs).toISOString() : null
    };
}

function normalizeAccessRevocation(raw, loginFallback = '', loginKey = '') {
    if (!raw || typeof raw !== 'object') return null;
    const login = resolveNormalizedLogin(raw, loginFallback, loginKey);
    if (!isValidLogin(login)) return null;
    return {
        login,
        status: raw.status === 'active' ? 'active' : 'revoked',
        revokedAt: raw.revokedAt || null,
        updatedAt: raw.updatedAt || null,
        updatedBy: normalizeLogin(raw.updatedBy || ''),
        reason: String(raw.reason || '').trim() || 'admin'
    };
}

function saveLocalPartnerInvitesStore(store) {
    setCachedLocalStorageJson(PARTNER_INVITES_STORAGE_KEY, store || {});
}

async function getAccessRevocation(login) {
    const normalizedLogin = normalizeLogin(login);
    if (!isValidLogin(normalizedLogin)) return null;
    const key = loginToStorageKey(normalizedLogin);
    const localStore = loadLocalAccessRevokesStore();
    return loadSingleFirebaseRecordWithVerifiedLocalFallback({
        dbPath: ACCESS_REVOKE_DB_PATH,
        key,
        localStore,
        saveLocalStore: saveLocalAccessRevokesStore,
        normalizeRecord: normalizeAccessRevocation,
        normalizeArgs: [normalizedLogin, key],
        recordLabel: 'access revocation'
    });
}

async function setAccessRevocation(login, isRevoked, meta = {}, options = {}) {
    const requireRemote = !!options.requireRemote;
    const normalizedLogin = normalizeLogin(login);
    if (!isValidLogin(normalizedLogin)) return null;
    const key = loginToStorageKey(normalizedLogin);
    const nowIso = new Date().toISOString();
    const payload = {
        login: normalizedLogin,
        status: isRevoked ? 'revoked' : 'active',
        updatedBy: normalizeLogin(meta.updatedBy || ''),
        reason: isRevoked ? String(meta.reason || 'admin') : 'active',
        revokedAt: isRevoked ? (meta.revokedAt || nowIso) : null,
        updatedAt: nowIso
    };

    if (requireRemote && !db) {
        throw new Error('Firebase RTDB недоступна для обязательной записи отзыва доступа.');
    }

    if (db) {
        try {
            await firebaseWritePathWithFallback(
                `${ACCESS_REVOKE_DB_PATH}/${key}`,
                () => isRevoked
                    ? set(ref(db, `${ACCESS_REVOKE_DB_PATH}/${key}`), payload)
                    : set(ref(db, `${ACCESS_REVOKE_DB_PATH}/${key}`), null),
                isRevoked ? payload : null,
                'PUT',
                FIREBASE_FRONTEND_WRITE_TIMEOUT_MS,
                `Firebase write for ${ACCESS_REVOKE_DB_PATH}/${key}`
            );
        } catch (error) {
            console.error('Failed to save access revocation in Firebase:', error);
            if (requireRemote) {
                throw error;
            }
        }
    }

    const localStore = loadLocalAccessRevokesStore();
    if (isRevoked) {
        localStore[key] = payload;
    } else if (Object.prototype.hasOwnProperty.call(localStore, key)) {
        delete localStore[key];
    }
    saveLocalAccessRevokesStore(localStore);
    return payload;
}

async function listAccessRevocations() {
    const localStore = loadLocalAccessRevokesStore();
    const sortAccessRevocationRecords = (records = []) => [...records].sort((a, b) => {
        const aTime = parseIsoMs(a.updatedAt);
        const bTime = parseIsoMs(b.updatedAt);
        if (aTime && bTime) return bTime - aTime;
        if (aTime) return -1;
        if (bTime) return 1;
        return a.login.localeCompare(b.login);
    });
    const buildAccessRevocationRecords = (store = {}) => sortAccessRevocationRecords(
        Object.entries(store || {})
            .map(([key, item]) => normalizeAccessRevocation(item, '', key))
            .filter((item) => item && item.status === 'revoked')
    );
    const localRecords = buildAccessRevocationRecords(localStore);
    if (db) {
        try {
            const snapshot = await firebaseGetWithTimeout(ACCESS_REVOKE_DB_PATH);
            if (snapshot.exists()) {
                const raw = snapshot.val();
                const records = buildAccessRevocationRecords(raw || {});
                if (records.length > 0) {
                    return records;
                }
            }
            return localRecords;
        } catch (error) {
            console.error('Failed to load access revocations from Firebase:', error);
            return localRecords;
        }
    }

    return localRecords;
}

function isAccessRevokedForLogin(accessRevocation, login) {
    const normalizedLogin = normalizeLogin(login);
    if (!normalizedLogin || !accessRevocation) return false;
    return accessRevocation.login === normalizedLogin && accessRevocation.status === 'revoked';
}

function buildAccessPolicyDeny(reason, options = {}) {
    return {
        decision: 'deny',
        reason,
        nextAction: options.nextAction || ACCESS_CONTROL_DECISION_ACTION.SHOW_HELP,
        ...options
    };
}

function buildAccessPolicyAllow(reason, options = {}) {
    return {
        decision: 'allow',
        reason,
        nextAction: ACCESS_CONTROL_DECISION_ACTION.REFRESH,
        ...options
    };
}

function resolveAccessPolicyDecisionMessage(decision) {
    if (!decision || decision.decision !== 'deny') return '';
    switch (decision.reason) {
        case ACCESS_CONTROL_DECISION_REASON.REVOKED:
            return 'Доступ закрыт администратором. Обратитесь для восстановления.';
        case ACCESS_CONTROL_DECISION_REASON.BLOCKED:
            return decision.blockedReason || 'Доступ временно закрыт по безопасности.';
        case ACCESS_CONTROL_DECISION_REASON.NOT_FOUND:
            return 'Используйте корпоративную почту, если вы сотрудник компании. Если вы партнёр, получите ссылку по приглашению.';
        default:
            return 'Вход в систему запрещён.';
    }
}

function applySessionPolicy(accessDecision, options = {}) {
    const {
        userLogin = '',
        onDeny = null
    } = options;

    if (!accessDecision || accessDecision.decision === 'allow') {
        return false;
    }

    const message = String(resolveAccessPolicyDecisionMessage(accessDecision) || '').trim();

    if (accessDecision.nextAction === ACCESS_CONTROL_DECISION_ACTION.CLOSE_SESSION) {
        clearAuthSession();
        const normalizedUserLogin = normalizeLogin(userLogin);
        const shouldClearIdentity = normalizedUserLogin
            ? clearAuthCacheIdentityForLogin(normalizedUserLogin) || !!(currentUser && normalizeLogin(currentUser.login) === normalizedUserLogin)
            : false;
        if (shouldClearIdentity) {
            resetCurrentSessionToAuth(message);
        } else if (message) {
            setAuthError(message);
        } else if (typeof onDeny === 'function') {
            onDeny();
        }
        return true;
    }

    if (message) {
        setAuthError(message);
    } else if (typeof onDeny === 'function') {
        onDeny();
    }
    return false;
}

function saveEmailLinkContext(context) {
    try {
        setCachedStorageValue(EMAIL_LINK_CONTEXT_STORAGE_KEY, JSON.stringify(context || {}));
    } catch (error) {}
}

function getEmailLinkContext() {
    try {
        const raw = getCachedStorageValue(EMAIL_LINK_CONTEXT_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
        return null;
    }
}

function clearEmailLinkContext() {
    removeCachedStorageValue(EMAIL_LINK_CONTEXT_STORAGE_KEY);
}

function savePendingEmailSignInLink(linkValue) {
    try {
        const normalized = String(linkValue || '').trim();
        if (!normalized) return;
        setCachedStorageValue(PENDING_EMAIL_SIGNIN_LINK_STORAGE_KEY, normalized);
    } catch (error) {}
}

function getPendingEmailSignInLink() {
    try {
        const raw = String(getCachedStorageValue(PENDING_EMAIL_SIGNIN_LINK_STORAGE_KEY) || '').trim();
        return raw || '';
    } catch (error) {
        return '';
    }
}

function clearPendingEmailSignInLink() {
    removeCachedStorageValue(PENDING_EMAIL_SIGNIN_LINK_STORAGE_KEY);
}

function saveEmailLinkHint(hint) {
    try {
        const login = normalizeLogin(hint?.login || hint?.email || '');
        const action = String(hint?.action || '').trim().toLowerCase();
        if (!isValidLogin(login)) return;
        if (action !== 'invite' && action !== 'verify') return;
        setCachedStorageValue(EMAIL_LINK_HINT_STORAGE_KEY, JSON.stringify({
            login,
            action,
            savedAt: new Date().toISOString()
        }));
    } catch (error) {}
}

function saveEmailLinkVerifiedHint(hint) {
    try {
        const login = normalizeLogin(hint?.login || hint?.email || '');
        const action = String(hint?.action || '').trim().toLowerCase();
        if (!isValidLogin(login)) return;
        if (action !== 'invite' && action !== 'verify') return;
        setCachedStorageValue(EMAIL_LINK_VERIFIED_HINT_STORAGE_KEY, JSON.stringify({
            login,
            action,
            verifiedAt: new Date().toISOString(),
            source: 'email-link'
        }));
    } catch (error) {}
}

function getEmailLinkVerifiedHint() {
    try {
        const raw = getCachedStorageValue(EMAIL_LINK_VERIFIED_HINT_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        const login = normalizeLogin(parsed.login || '');
        const action = String(parsed.action || '').trim().toLowerCase();
        const verifiedAt = String(parsed.verifiedAt || parsed.savedAt || '').trim();
        if (!isValidLogin(login) || !verifiedAt) return null;
        if (action !== 'invite' && action !== 'verify') return null;
        const savedAtMs = parseIsoMs(verifiedAt);
        if (!savedAtMs) return null;
        if ((Date.now() - savedAtMs) > EMAIL_LINK_VERIFIED_HINT_MAX_AGE_MS) return null;
        return { login, action, verifiedAt };
    } catch (error) {
        return null;
    }
}

function clearEmailLinkVerifiedHint() {
    removeCachedStorageValue(EMAIL_LINK_VERIFIED_HINT_STORAGE_KEY);
}

function saveEmailLinkAuthReady(login, action = 'verify') {
    try {
        const normalizedLogin = normalizeLogin(login);
        const normalizedAction = String(action || '').trim().toLowerCase();
        if (!isValidLogin(normalizedLogin)) return;
        if (normalizedAction !== 'invite' && normalizedAction !== 'verify') return;

        setCachedStorageValue(EMAIL_LINK_AUTH_READY_STORAGE_KEY, JSON.stringify({
            login: normalizedLogin,
            action: normalizedAction,
            readyAt: new Date().toISOString()
        }));
    } catch (error) {}
}

function getEmailLinkAuthReady(login) {
    try {
        const raw = getCachedStorageValue(EMAIL_LINK_AUTH_READY_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;

        const loginToMatch = normalizeLogin(login || '');
        const parsedLogin = normalizeLogin(parsed.login || '');
        const action = String(parsed.action || '').trim().toLowerCase();
        const readyAt = String(parsed.readyAt || '').trim();

        if (!isValidLogin(parsedLogin) || action !== 'invite' && action !== 'verify') return null;
        const readyAtMs = parseIsoMs(readyAt);
        if (!readyAtMs) return null;
        if ((Date.now() - readyAtMs) > EMAIL_LINK_AUTH_READY_MAX_AGE_MS) {
            clearEmailLinkAuthReady();
            return null;
        }
        if (loginToMatch && loginToMatch !== parsedLogin) return null;

        return {
            login: parsedLogin,
            action,
            readyAt
        };
    } catch (error) {
        return null;
    }
}

function clearEmailLinkAuthReady() {
    removeCachedStorageValue(EMAIL_LINK_AUTH_READY_STORAGE_KEY);
}

function getEmailLinkHint() {
    try {
        const raw = getCachedStorageValue(EMAIL_LINK_HINT_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        const login = normalizeLogin(parsed.login || '');
        const action = String(parsed.action || '').trim().toLowerCase();
        const savedAt = String(parsed.savedAt || '').trim();
        if (!isValidLogin(login)) return null;
        if (action !== 'invite' && action !== 'verify') return null;
        const savedAtMs = parseIsoMs(savedAt);
        if (!savedAtMs) return null;
        if ((Date.now() - savedAtMs) > EMAIL_LINK_HINT_MAX_AGE_MS) return null;
        return {
            login,
            action,
            savedAt
        };
    } catch (error) {
        return null;
    }
}

function clearEmailLinkHint() {
    removeCachedStorageValue(EMAIL_LINK_HINT_STORAGE_KEY);
}

function loadEmailLinkProcessedState() {
    return getCachedLocalStorageJson(EMAIL_LINK_PROCESSED_STORAGE_KEY);
}

function saveEmailLinkProcessedState(state = {}) {
    setCachedLocalStorageJson(EMAIL_LINK_PROCESSED_STORAGE_KEY, state || {});
}

function pruneEmailLinkProcessedState(state = {}) {
    const now = Date.now();
    const next = {};
    Object.entries(state || {}).forEach(([key, item]) => {
        if (!item || typeof item !== 'object') return;
        const processedAt = parseIsoMs(item.processedAt || '');
        if (!processedAt) return;
        if ((now - processedAt) > EMAIL_LINK_PROCESSED_TTL_MS) return;
        next[key] = item;
    });
    return next;
}

function normalizeEmailLinkProcessingAction(action = '') {
    const normalized = String(action || '').trim().toLowerCase();
    return normalized === 'invite' ? 'invite' : 'verify';
}

function buildEmailLinkProcessingKey(login, signInLink, action = 'verify') {
    const normalizedLogin = normalizeLogin(login);
    const normalizedAction = normalizeEmailLinkProcessingAction(action);
    const normalizedLink = String(signInLink || '').trim();
    const linkMarker = btoa(unescape(encodeURIComponent(normalizedLink))).replace(/=+$/g, '');
    return `${normalizedLogin}|${normalizedAction}|${linkMarker}`;
}

function isEmailLinkProcessed(login, signInLink, action = 'verify') {
    const normalizedLogin = normalizeLogin(login);
    const normalizedLink = String(signInLink || '').trim();
    if (!normalizedLogin || !normalizedLink) return false;
    const state = pruneEmailLinkProcessedState(loadEmailLinkProcessedState());
    const key = buildEmailLinkProcessingKey(normalizedLogin, normalizedLink, action);
    saveEmailLinkProcessedState(state);
    return !!state[key];
}

function markEmailLinkProcessed(login, signInLink, action = 'verify') {
    const normalizedLogin = normalizeLogin(login);
    const normalizedLink = String(signInLink || '').trim();
    const normalizedAction = normalizeEmailLinkProcessingAction(action);
    if (!normalizedLogin || !normalizedLink) return;

    const state = pruneEmailLinkProcessedState(loadEmailLinkProcessedState());
    const key = buildEmailLinkProcessingKey(normalizedLogin, normalizedLink, normalizedAction);
    state[key] = {
        login: normalizedLogin,
        action: normalizedAction,
        processedAt: new Date().toISOString()
    };
    saveEmailLinkProcessedState(state);
}

function tryDecodeUrlValue(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
        return decodeURIComponent(raw);
    } catch (error) {
        return raw;
    }
}

function collectEmailLinkUrlCandidates(rawUrl = window.location.href) {
    const queue = [String(rawUrl || '').trim()];
    const visited = new Set();
    const candidates = [];

    while (queue.length > 0 && candidates.length < 16) {
        const current = String(queue.shift() || '').trim();
        if (!current || visited.has(current)) continue;
        visited.add(current);
        candidates.push(current);

        try {
            const parsed = new URL(current);
            const nestedParamNames = ['link', 'deep_link_id', 'continueUrl', 'continue_url', 'redirectUrl', 'redirect_url', 'url'];
            nestedParamNames.forEach((paramName) => {
                const value = String(parsed.searchParams.get(paramName) || '').trim();
                if (!value) return;
                if (!visited.has(value)) queue.push(value);
                const decodedValue = tryDecodeUrlValue(value);
                if (decodedValue && !visited.has(decodedValue)) queue.push(decodedValue);
            });

            parsed.searchParams.forEach((value) => {
                const normalized = String(value || '').trim();
                if (!normalized) return;
                if (/^https?:\/\//i.test(normalized) || /^https?:%2f%2f/i.test(normalized)) {
                    if (!visited.has(normalized)) queue.push(normalized);
                    const decoded = tryDecodeUrlValue(normalized);
                    if (decoded && !visited.has(decoded)) queue.push(decoded);
                }
            });
        } catch (error) {}
    }

    return candidates;
}

function resolveEmailSignInLink(rawUrl = window.location.href) {
    if (!auth) return null;
    const candidates = collectEmailLinkUrlCandidates(rawUrl);
    for (const candidate of candidates) {
        try {
            if (isSignInWithEmailLink(auth, candidate)) {
                return candidate;
            }
        } catch (error) {}
    }
    return null;
}

function getEmailActionFromCurrentLink(rawUrl = window.location.href) {
    const urlCandidates = collectEmailLinkUrlCandidates(rawUrl);
    for (const urlValue of urlCandidates) {
        try {
            const parsedUrl = new URL(urlValue);
            const action = String(parsedUrl.searchParams.get('email_action') || '').trim().toLowerCase();
            if (action === 'invite' || action === 'verify') {
                return action;
            }
        } catch (error) {
            continue;
        }
    }
    return '';
}

function getAppBaseUrl() {
    return `${window.location.origin}${window.location.pathname}`;
}

function getEmailFromCurrentLink(rawUrl = window.location.href) {
    const urlCandidates = collectEmailLinkUrlCandidates(rawUrl);
    const emailParamNames = ['email', 'invited_email', 'login'];

    for (const urlValue of urlCandidates) {
        try {
            const parsedUrl = new URL(urlValue);
            const candidates = emailParamNames.map((paramName) => parsedUrl.searchParams.get(paramName));
            const email = candidates.map(normalizeLogin).find(isValidLogin);
            if (email) return email;
            let fallbackEmail = '';
            parsedUrl.searchParams.forEach((value) => {
                if (fallbackEmail) return;
                const maybeEmail = normalizeLogin(value);
                if (isValidLogin(maybeEmail)) {
                    fallbackEmail = maybeEmail;
                }
            });
            if (fallbackEmail) return fallbackEmail;
        } catch (error) {
            continue;
        }
    }
    const fromContext = normalizeLogin(getEmailLinkContext()?.email || '');
    if (isValidLogin(fromContext)) return fromContext;
    return null;
}

function cleanupEmailLinkUrl() {
    try {
        const cleanUrl = getAppBaseUrl();
        window.history.replaceState({}, document.title, cleanUrl);
    } catch (error) {}
}

function getReadableFirebaseAuthError(error, context = 'generic') {
    const code = String(error?.code || '').trim();
    if (code === 'auth/configuration-not-found' || code === 'auth/operation-not-allowed') {
        return 'Email-подтверждение не настроено в Firebase. Включите Authentication -> Sign-in method -> Email link (passwordless) и добавьте домен сайта в Authorized domains.';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials' || code === 'auth/wrong-password') {
        return 'Firebase Auth не смог открыть сессию по этому email/паролю. Выйдите и войдите заново. Если не поможет: в Firebase Authentication включите Email/Password и проверьте, что для этого email не остался старый пароль.';
    }
    if (code === 'auth/email-already-in-use') {
        return 'Для этого email уже есть отдельный аккаунт в Firebase Auth с другим паролем. Нужен вход тем паролем или сброс/очистка этого аккаунта в Firebase Authentication.';
    }
    if (code === 'auth/unauthorized-domain') {
        return 'Домен сайта не разрешен в Firebase Auth. Добавьте текущий домен в Authorized domains.';
    }
    if (code === 'auth/invalid-email') {
        return 'Укажите корректный email.';
    }
    if (code === 'auth/user-mismatch') {
        return 'Этот email не совпадает с адресом в ссылке подтверждения. Введите email из письма.';
    }
    if (code === 'auth/network-request-failed') {
        return 'Ошибка сети при обращении к Firebase. Проверьте интернет и повторите попытку.';
    }
    if (code === 'auth/too-many-requests' || code === 'auth/quota-exceeded') {
        return 'Превышен лимит отправки писем Firebase. Подождите и повторите позже или проверьте квоты в Authentication -> Usage.';
    }
    if (code === 'auth/invalid-continue-uri' || code === 'auth/missing-continue-uri' || code === 'auth/unauthorized-continue-uri') {
        return 'Ссылка продолжения настроена неверно. Проверьте authorized domains и URL приложения в настройках Firebase Auth.';
    }
    if (code === 'auth/expired-action-code' || code === 'auth/invalid-action-code') {
        return 'Ссылка подтверждения устарела. Запросите новую и повторите вход.';
    }

    const fallback = String(error?.message || '').trim();
    if (!fallback) {
        if (context === 'invite') return 'Не удалось отправить инвайт-письмо.';
        if (context === 'verify') return 'Не удалось отправить письмо подтверждения.';
        return 'Ошибка авторизации.';
    }
    return fallback;
}

async function sendMagicLinkToEmail(email, purpose = 'verify') {
    const normalizedEmail = normalizeLogin(email);
    if (!isValidLogin(normalizedEmail)) {
        throw new Error('Некорректный email');
    }
    if (!auth) {
        throw new Error('Email-сервис не инициализирован. Проверьте Firebase Auth.');
    }

    const actionUrl = new URL(getAppBaseUrl());
    actionUrl.searchParams.set('auth_link', '1');
    actionUrl.searchParams.set('email_action', purpose);
    actionUrl.searchParams.set('email', normalizedEmail);

    const actionCodeSettings = {
        url: actionUrl.toString(),
        handleCodeInApp: true
    };

    await withPromiseTimeout(
        sendSignInLinkToEmail(auth, normalizedEmail, actionCodeSettings),
        AUTH_MAGIC_LINK_SEND_TIMEOUT_MS,
        `Не удалось дождаться отправки письма (${AUTH_MAGIC_LINK_SEND_TIMEOUT_MS / 1000}с).`
    );
    saveEmailLinkContext({
        email: normalizedEmail,
        purpose,
        sentAt: new Date().toISOString()
    });
}

function normalizePartnerInvite(raw, loginFallback = '', loginKey = '') {
    if (!raw || typeof raw !== 'object') return null;
    const login = resolveNormalizedLogin(raw, loginFallback, loginKey);
    if (!isValidLogin(login)) return null;
    const role = 'user';
    const status = raw.status === 'revoked' ? 'revoked' : 'active';
    return {
        login,
        role,
        status,
        createdAt: raw.createdAt || new Date().toISOString(),
        createdBy: normalizeLogin(raw.createdBy || ''),
        expiresAt: raw.expiresAt || null,
        emailVerifiedAt: raw.emailVerifiedAt || null,
        note: String(raw.note || '')
    };
}

function isPartnerInviteActive(invite) {
    if (!invite || invite.status !== 'active') return false;
    if (!invite.expiresAt) return true;
    const expiresAt = new Date(invite.expiresAt).getTime();
    if (!Number.isFinite(expiresAt)) return false;
    return expiresAt > Date.now();
}

async function getPartnerInviteByLogin(login) {
    const normalizedLogin = normalizeLogin(login);
    if (!isValidLogin(normalizedLogin)) return null;
    const key = loginToStorageKey(normalizedLogin);
    const localStore = loadLocalPartnerInvitesStore();
    return loadSingleFirebaseRecordWithVerifiedLocalFallback({
        dbPath: PARTNER_INVITES_DB_PATH,
        key,
        localStore,
        saveLocalStore: saveLocalPartnerInvitesStore,
        normalizeRecord: normalizePartnerInvite,
        normalizeArgs: [normalizedLogin, key],
        recordLabel: 'partner invite'
    });
}

async function savePartnerInvite(invite, options = {}) {
    const requireRemote = !!options.requireRemote;
    const normalized = normalizePartnerInvite(invite, invite?.login);
    if (!normalized) throw new Error('Invalid partner invite');
    const key = loginToStorageKey(normalized.login);
    const payload = {
        login: normalized.login,
        role: normalized.role,
        status: normalized.status,
        createdAt: normalized.createdAt,
        createdBy: normalized.createdBy,
        expiresAt: normalized.expiresAt,
        emailVerifiedAt: normalized.emailVerifiedAt,
        note: normalized.note
    };

    if (requireRemote && !db) {
        throw new Error('Firebase RTDB недоступна для обязательной записи инвайта.');
    }

    if (db) {
        try {
            await firebaseWritePathWithFallback(
                `${PARTNER_INVITES_DB_PATH}/${key}`,
                () => set(ref(db, `${PARTNER_INVITES_DB_PATH}/${key}`), payload),
                payload,
                'PUT',
                FIREBASE_FRONTEND_WRITE_TIMEOUT_MS,
                `Firebase write for ${PARTNER_INVITES_DB_PATH}/${key}`
            );
        } catch (error) {
            console.error('Failed to save partner invite to Firebase:', error);
            if (requireRemote) {
                throw error;
            }
        }
    }

    const localStore = loadLocalPartnerInvitesStore();
    localStore[key] = payload;
    saveLocalPartnerInvitesStore(localStore);
    return payload;
}

async function patchPartnerInvite(login, patch = {}, options = {}) {
    const requireRemote = !!options.requireRemote;
    const normalizedLogin = normalizeLogin(login);
    if (!isValidLogin(normalizedLogin)) return null;
    const key = loginToStorageKey(normalizedLogin);
    const sanitizedPatch = { ...patch };

    if (Object.prototype.hasOwnProperty.call(sanitizedPatch, 'role')) {
        sanitizedPatch.role = 'user';
    }
    if (Object.prototype.hasOwnProperty.call(sanitizedPatch, 'status')) {
        sanitizedPatch.status = sanitizedPatch.status === 'revoked' ? 'revoked' : 'active';
    }
    if (Object.prototype.hasOwnProperty.call(sanitizedPatch, 'expiresAt')) {
        sanitizedPatch.expiresAt = sanitizedPatch.expiresAt || null;
    }
    if (Object.prototype.hasOwnProperty.call(sanitizedPatch, 'emailVerifiedAt')) {
        sanitizedPatch.emailVerifiedAt = sanitizedPatch.emailVerifiedAt || null;
    }

    if (requireRemote && !db) {
        throw new Error('Firebase RTDB недоступна для обязательного обновления инвайта.');
    }

    if (db) {
        try {
            await firebaseWritePathWithFallback(
                `${PARTNER_INVITES_DB_PATH}/${key}`,
                () => update(ref(db, `${PARTNER_INVITES_DB_PATH}/${key}`), sanitizedPatch),
                sanitizedPatch,
                'PATCH',
                FIREBASE_FRONTEND_WRITE_TIMEOUT_MS,
                `Firebase patch for ${PARTNER_INVITES_DB_PATH}/${key}`
            );
        } catch (error) {
            console.error('Failed to patch partner invite in Firebase:', error);
            if (requireRemote) {
                throw error;
            }
        }
    }

    const localStore = loadLocalPartnerInvitesStore();
    const merged = {
        ...(localStore[key] || { login: normalizedLogin, role: 'user', status: 'active' }),
        ...sanitizedPatch,
        login: normalizedLogin
    };
    localStore[key] = merged;
    saveLocalPartnerInvitesStore(localStore);
    return normalizePartnerInvite(merged, normalizedLogin);
}

async function deletePartnerInvite(login) {
    const normalizedLogin = normalizeLogin(login);
    if (!isValidLogin(normalizedLogin)) return false;
    const key = loginToStorageKey(normalizedLogin);

    if (db) {
        try {
            await firebaseWriteWithTimeout(
                () => set(ref(db, `${PARTNER_INVITES_DB_PATH}/${key}`), null),
                FIREBASE_FRONTEND_WRITE_TIMEOUT_MS,
                `Firebase delete for ${PARTNER_INVITES_DB_PATH}/${key}`
            );
        } catch (error) {
            console.error('Failed to delete partner invite in Firebase:', error);
        }
    }

    const localStore = loadLocalPartnerInvitesStore();
    if (Object.prototype.hasOwnProperty.call(localStore, key)) {
        delete localStore[key];
        saveLocalPartnerInvitesStore(localStore);
    }
    return true;
}

async function listPartnerInvites() {
    const localStore = loadLocalPartnerInvitesStore();
    const sortPartnerInviteRecords = (records = []) => [...records].sort((a, b) => {
        const aCreatedAt = String(a.createdAt || '');
        const bCreatedAt = String(b.createdAt || '');
        if (aCreatedAt && bCreatedAt && aCreatedAt !== bCreatedAt) {
            return bCreatedAt.localeCompare(aCreatedAt);
        }
        return a.login.localeCompare(b.login);
    });
    const buildPartnerInviteRecords = (store = {}) => sortPartnerInviteRecords(
        Object.entries(store || {})
            .map(([key, item]) => normalizePartnerInvite(item, '', key))
            .filter(Boolean)
    );
    const localInvites = buildPartnerInviteRecords(localStore);
    if (db) {
        try {
            const snapshot = await firebaseGetWithTimeout(PARTNER_INVITES_DB_PATH);
            if (snapshot.exists()) {
                const raw = snapshot.val();
                const invites = buildPartnerInviteRecords(raw || {});
                if (invites.length > 0) {
                    return invites;
                }
            }
            return localInvites;
        } catch (error) {
            console.error('Failed to load partner invites from Firebase:', error);
            return localInvites;
        }
    }

    return localInvites;
}

async function resolveAccessPolicy(login, userRecord = null) {
    const normalizedLogin = normalizeLogin(login);
    if (!isValidLogin(normalizedLogin)) {
        return buildAccessPolicyDeny(ACCESS_CONTROL_DECISION_REASON.NOT_FOUND, {
            nextAction: ACCESS_CONTROL_DECISION_ACTION.SHOW_HELP
        });
    }

    if (userRecord?.isBlocked) {
        return buildAccessPolicyDeny(ACCESS_CONTROL_DECISION_REASON.BLOCKED, {
            nextAction: ACCESS_CONTROL_DECISION_ACTION.CLOSE_SESSION,
            blockedReason: 'Пользователь заблокирован после превышения лимита попыток.'
        });
    }

    const accessRevocation = await getAccessRevocation(normalizedLogin);
    if (isAccessRevokedForLogin(accessRevocation, normalizedLogin)) {
        return buildAccessPolicyDeny(ACCESS_CONTROL_DECISION_REASON.REVOKED, {
            nextAction: ACCESS_CONTROL_DECISION_ACTION.CLOSE_SESSION,
            accessRevocation
        });
    }

    if (userRecord?.role === 'admin') {
        return buildAccessPolicyAllow(ACCESS_CONTROL_DECISION_REASON.ADMIN, {
            user: userRecord,
            invite: null,
            accessRevocation: null,
            role: 'admin'
        });
    }

    if (isCorporateEmail(normalizedLogin)) {
        return buildAccessPolicyAllow(ACCESS_CONTROL_DECISION_REASON.CORPORATE, {
            user: userRecord || null,
            invite: null,
            accessRevocation
        });
    }

    const invite = await getPartnerInviteByLogin(normalizedLogin);
    if (isPartnerInviteActive(invite)) {
        return buildAccessPolicyAllow(ACCESS_CONTROL_DECISION_REASON.INVITE, {
            user: userRecord || null,
            invite,
            accessRevocation
        });
    }

    return buildAccessPolicyDeny(ACCESS_CONTROL_DECISION_REASON.NOT_FOUND, {
        nextAction: ACCESS_CONTROL_DECISION_ACTION.SHOW_HELP,
        accessRevocation,
        user: userRecord || null,
        invite: null
    });
}

async function finalizeEmailLinkVerification(login, signInLink) {
    const detectedAction = getEmailActionFromCurrentLink(signInLink || window.location.href);
    const linkAction = detectedAction === 'invite' || detectedAction === 'verify' ? detectedAction : 'verify';
    const normalizedLogin = normalizeLogin(login);

    if (isEmailLinkProcessed(normalizedLogin, signInLink, linkAction)) {
        setAuthError('Ссылка уже подтверждена. Продолжайте вход.');
        return false;
    }

    await signInWithEmailLink(auth, normalizedLogin, signInLink);
    const nowIso = new Date().toISOString();

    const existingUser = await getUserRecordByLogin(normalizedLogin);
    if (existingUser) {
        const wasVerifiedBefore = !!existingUser.emailVerifiedAt;
        await patchUserRecord(login, {
            emailVerifiedAt: nowIso,
            // After first email verification, user can set a final password on next login.
            passwordNeedsSetup: !wasVerifiedBefore,
            failedLoginAttempts: 0,
            isBlocked: false,
            blockedAt: null,
            blockedReason: null,
            failedLoginBackoffUntil: null,
            sessionRevokedAt: null,
            lastSeenAt: nowIso
        });
    }

    const invite = await getPartnerInviteByLogin(login);
    if (invite) {
        await patchPartnerInvite(login, {
            emailVerifiedAt: nowIso
        });
    }

    markEmailLinkProcessed(normalizedLogin, signInLink, linkAction);
    saveEmailLinkAuthReady(login, linkAction);
    saveEmailLinkVerifiedHint({
        login,
        action: linkAction
    });
    clearPendingEmailSignInLink();
    clearEmailLinkHint();
    showCopyNotification('Email подтвержден. Теперь войдите с паролем.');
    setAuthError('Email подтвержден. Введите пароль для входа (можно задать новый).');
    if (modalLoginInput) {
        modalLoginInput.value = login;
    }
    void syncModalPasswordAutocompleteMode(login);
    return true;
}

async function consumePendingEmailSignInLinkForLogin(login) {
    if (!auth) return false;
    const normalizedLogin = normalizeLogin(login);
    if (!isValidLogin(normalizedLogin)) return false;
    const pendingLink = getPendingEmailSignInLink();
    if (!pendingLink) return false;

    try {
        const finalized = await finalizeEmailLinkVerification(normalizedLogin, pendingLink);
        if (!finalized) {
            clearPendingEmailSignInLink();
        }
        return !!finalized;
    } catch (error) {
        const code = String(error?.code || '').trim();
        if (code === 'auth/invalid-action-code' || code === 'auth/expired-action-code') {
            clearPendingEmailSignInLink();
            return false;
        }
        throw error;
    }
}

async function consumeEmailVerificationLinkIfPresent() {
    if (!auth) return;
    const detectedAction = getEmailActionFromCurrentLink(window.location.href);
    const detectedLogin = getEmailFromCurrentLink(window.location.href);
    if (detectedAction && isValidLogin(detectedLogin)) {
        saveEmailLinkHint({
            login: detectedLogin,
            action: detectedAction
        });
    }
    const signInLink = resolveEmailSignInLink(window.location.href);
    if (!signInLink) return;

    const login = getEmailFromCurrentLink(signInLink) || getEmailFromCurrentLink(window.location.href);
    if (!isValidLogin(login)) {
        savePendingEmailSignInLink(signInLink);
        setAuthError('Открыта ссылка подтверждения. Введите email и нажмите «Войти».');
        cleanupEmailLinkUrl();
        return;
    }
    const linkAction = getEmailActionFromCurrentLink(signInLink || window.location.href) === 'invite' ? 'invite' : 'verify';
    if (isEmailLinkProcessed(login, signInLink, linkAction)) {
        clearPendingEmailSignInLink();
        clearEmailLinkAuthReady();
        clearEmailLinkHint();
        cleanupEmailLinkUrl();
        return;
    }

    try {
        const finalized = await finalizeEmailLinkVerification(login, signInLink);
        clearEmailLinkHint();
        if (!finalized) {
            return;
        }
    } catch (error) {
        console.error('Email link verification error:', error);
        const code = String(error?.code || '').trim();
        if (code === 'auth/missing-email' || code === 'auth/invalid-email') {
            savePendingEmailSignInLink(signInLink);
            setAuthError('Введите email из приглашения и нажмите «Войти», чтобы завершить подтверждение.');
        } else if (code === 'auth/invalid-action-code' || code === 'auth/expired-action-code') {
            setAuthError('Ссылка уже использована или просрочена. Запросите новую.');
        } else {
            setAuthError(getReadableFirebaseAuthError(error, 'consume_link'));
        }
    } finally {
        clearEmailLinkContext();
        cleanupEmailLinkUrl();
        // Keep Firebase auth session after email-link sign-in.
        // This allows secured Realtime Database rules (auth != null)
        // without breaking cross-device data access.
    }
}

function createTextEncoder() {
    if (typeof TextEncoder === 'undefined') return null;
    try {
        return new TextEncoder();
    } catch (error) {
        return null;
    }
}

function bytesToBase64(bytesLike) {
    const bytes = new Uint8Array(bytesLike);
    let binary = '';
    bytes.forEach((b) => {
        binary += String.fromCharCode(b);
    });
    return btoa(binary);
}

function base64ToBytes(base64) {
    try {
        const binary = atob(base64 || '');
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    } catch (error) {
        return null;
    }
}

function hexToBytes(hex = '') {
    const normalized = String(hex || '').trim();
    if (!LEGACY_PASSWORD_HASH_HEX_RE.test(normalized)) return null;
    const bytes = new Uint8Array(normalized.length / 2);
    for (let i = 0; i < normalized.length; i += 2) {
        const parsed = Number.parseInt(normalized.slice(i, i + 2), 16);
        if (!Number.isFinite(parsed)) return null;
        bytes[i / 2] = parsed;
    }
    return bytes;
}

function parsePasswordHashWithState(rawHash = '') {
    const normalized = String(rawHash || '').trim();
    if (!normalized) return { format: 'legacy', raw: normalized };

    if (normalized.startsWith(`${PASSWORD_HASH_FORMAT_PREFIX}|`)) {
        const parts = normalized.split('|');
        if (parts.length === 4) {
            const iterations = Number(parts[1]);
            const salt = base64ToBytes(parts[2]);
            const derived = base64ToBytes(parts[3]);
            if (Number.isFinite(iterations) && iterations > 0 && salt && derived) {
                return {
                    format: 'pbkdf2',
                    prefix: PASSWORD_HASH_FORMAT_PREFIX,
                    iterations,
                    salt,
                    derived
                };
            }
        }
        return { format: 'legacy', raw: normalized };
    }

    const sha256PipeMatch = /^sha256(?:\:[^|]+)?\|(.+)$/i.exec(normalized);
    if (sha256PipeMatch) {
        const raw = sha256PipeMatch[1].trim();
        if (!raw) return { format: 'legacy', raw: normalized };
        return {
            format: 'sha256',
            prefix: PASSWORD_HASH_FALLBACK_PREFIX,
            raw
        };
    }

    const sha256NoPipeMatch = /^sha256:(.+)$/i.exec(normalized);
    if (sha256NoPipeMatch) {
        const raw = sha256NoPipeMatch[1].trim();
        if (!raw) return { format: 'legacy', raw: normalized };
        return {
            format: 'sha256',
            prefix: PASSWORD_HASH_FALLBACK_PREFIX,
            raw
        };
    }

    if (LEGACY_PASSWORD_HASH_HEX_RE.test(normalized)) {
        return {
            format: 'sha256-legacy',
            raw: normalized
        };
    }

    return { format: 'legacy', raw: normalized };
}

function isPasswordHashNeedsMigration(rawHash = '') {
    const parsed = parsePasswordHashWithState(rawHash);
    return parsed.format !== 'pbkdf2';
}

async function hashPasswordSha256Legacy(input) {
    const encoder = createTextEncoder();
    if (!encoder || !window.crypto?.subtle) {
        throw new Error('secure-crypto-unavailable');
    }
    const data = encoder.encode(String(input || ''));
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

function isLegacySha256Match(candidateHash, rawHash) {
    if (!candidateHash || !rawHash) return false;
    const normalizedRawCandidates = new Set([
        String(rawHash || '').trim(),
        String(rawHash || '').trim().toLowerCase(),
        String(rawHash || '').trim().toUpperCase()
    ]);
    const hashBytes = hexToBytes(candidateHash);
    if (hashBytes) {
        const base64 = bytesToBase64(hashBytes);
        const base64Variants = [
            base64,
            base64.replace(/=+$/, ''),
            base64.replace(/\+/g, '-').replace(/\//g, '_'),
            base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
        ];
        base64Variants.forEach((value) => {
            normalizedRawCandidates.add(value);
            normalizedRawCandidates.add(value.toLowerCase());
            normalizedRawCandidates.add(value.toUpperCase());
        });
    }

    const normalizedCandidateSet = new Set([
        candidateHash,
        String(candidateHash || '').toLowerCase(),
        String(candidateHash || '').toUpperCase()
    ]);
    for (const candidate of normalizedCandidateSet) {
        if (normalizedRawCandidates.has(candidate)) {
            return true;
        }
    }

    return false;
}

function normalizePasswordSecret(login, password) {
    return `${normalizeLogin(login)}::${String(password || '')}`;
}

async function hashPassword(login, password) {
    const normalizedLogin = normalizeLogin(login);
    const secret = normalizePasswordSecret(normalizedLogin, password);
    const encoder = createTextEncoder();
    if (!encoder || !window.crypto?.subtle) {
        throw new Error('Secure password hashing is unavailable in this browser');
    }
    const salt = window.crypto.getRandomValues(new Uint8Array(PASSWORD_HASH_SALT_BYTES));
    const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        'PBKDF2',
        false,
        ['deriveBits']
    );
    const derivedBits = await window.crypto.subtle.deriveBits({
        name: PASSWORD_HASH_ALGORITHM,
        salt,
        iterations: PASSWORD_HASH_ITERATIONS,
        hash: 'SHA-256'
    }, keyMaterial, PASSWORD_HASH_KEY_BYTES * 8);
    return `${PASSWORD_HASH_FORMAT_PREFIX}|${PASSWORD_HASH_ITERATIONS}|${bytesToBase64(salt)}|${bytesToBase64(new Uint8Array(derivedBits))}`;
}

async function verifyPasswordHash(login, password, rawHash) {
    const secret = normalizePasswordSecret(login, password);
    const passwordInput = String(password || '');
    const parsed = parsePasswordHashWithState(rawHash);

    if (parsed.format === 'pbkdf2') {
        try {
            if (!window.crypto?.subtle || !parsed.salt || !parsed.derived) {
                return false;
            }
            const encoder = createTextEncoder();
            if (!encoder) return false;
            const keyMaterial = await window.crypto.subtle.importKey(
                'raw',
                encoder.encode(secret),
                'PBKDF2',
                false,
                ['deriveBits']
            );
            const derivedBits = await window.crypto.subtle.deriveBits({
                name: PASSWORD_HASH_ALGORITHM,
                salt: parsed.salt,
                iterations: parsed.iterations,
                hash: 'SHA-256'
            }, keyMaterial, PASSWORD_HASH_KEY_BYTES * 8);
            return bytesToBase64(new Uint8Array(derivedBits)) === bytesToBase64(new Uint8Array(parsed.derived));
        } catch (error) {
            return false;
        }
    }

    if (parsed.format === 'sha256') {
        try {
            const rawHash = parsed.raw || '';
            const hashCandidates = new Set([
                secret,
                normalizePasswordSecret(String(login || '').trim(), passwordInput),
                normalizePasswordSecret(normalizeLogin(login), passwordInput),
                `${String(login || '').trim()}::${passwordInput}`,
                passwordInput
            ]);
            for (const candidate of hashCandidates) {
                const candidateHash = await hashPasswordSha256Legacy(candidate);
                if (isLegacySha256Match(candidateHash, rawHash)) return true;
            }
        } catch (error) {
            return false;
        }
    }

    if (parsed.format === 'sha256-legacy') {
        try {
            const passwordInput = String(password || '');
            const loginCandidates = new Set([
                normalizeLogin(login),
                String(login || '').trim()
            ]);
            const hashCandidates = new Set([passwordInput]);
            for (const loginCandidate of loginCandidates) {
                if (loginCandidate) {
                    hashCandidates.add(normalizePasswordSecret(loginCandidate, passwordInput));
                }
            }
            hashCandidates.add(`${String(login || '').trim()}::${passwordInput}`);

            for (const candidate of hashCandidates) {
                if (!candidate) continue;
                const candidateHash = await hashPasswordSha256Legacy(candidate);
                if (isLegacySha256Match(candidateHash, parsed.raw)) return true;
            }
        } catch (error) {
            return false;
        }
    }

    return false;
}

function normalizeUserRecord(raw, loginFallback = '', loginKey = '') {
    if (!raw || typeof raw !== 'object') return null;
    const login = resolveNormalizedLogin(raw, loginFallback, loginKey);
    if (!isValidLogin(login)) return null;
    const uid = String(raw.uid || '').trim();
    const failedLoginAttempts = Math.max(0, Number(raw.failedLoginAttempts) || 0);
    const isBlocked = !!raw.isBlocked;
    const failedLoginBackoffUntil = raw.failedLoginBackoffUntil || null;
    const blockedReason = String(raw.blockedReason || '').trim();
    const passwordHashScheme = String(raw.passwordHashScheme || '').trim();
    return {
        uid: uid || null,
        login,
        fio: normalizeFio(raw.fio || ''),
        role: normalizeRole(raw.role),
        passwordHash: String(raw.passwordHash || ''),
        passwordNeedsSetup: !!raw.passwordNeedsSetup,
        emailVerifiedAt: raw.emailVerifiedAt || null,
        emailVerificationSentAt: raw.emailVerificationSentAt || null,
        failedLoginAttempts,
        isBlocked,
        blockedReason: blockedReason || null,
        failedLoginBackoffUntil: failedLoginBackoffUntil,
        blockedAt: isBlocked ? (raw.blockedAt || new Date().toISOString()) : null,
        sessionRevokedAt: raw.sessionRevokedAt || null,
        passwordHashScheme: passwordHashScheme || null,
        createdAt: raw.createdAt || new Date().toISOString(),
        lastLoginAt: raw.lastLoginAt || null,
        lastSeenAt: raw.lastSeenAt || null,
        activeMs: Number.isFinite(raw.activeMs) ? Math.max(0, Number(raw.activeMs)) : 0
    };
}

function isPendingFirstPasswordSetup(user) {
    if (!user) return false;
    if (!user.emailVerifiedAt) return false;
    if (user.passwordNeedsSetup) return true;
    if (!user.emailVerificationSentAt) return false;
    if (!user.createdAt || !user.lastLoginAt) return false;
    return user.createdAt === user.lastLoginAt;
}

async function getUserRecordByLogin(login) {
    const normalizedLogin = normalizeLogin(login);
    if (!normalizedLogin) return null;
    const key = loginToStorageKey(normalizedLogin);
    const localStore = loadLocalUsersStore();
    return loadSingleFirebaseRecordWithVerifiedLocalFallback({
        dbPath: AUTH_USERS_DB_PATH,
        key,
        localStore,
        saveLocalStore: saveLocalUsersStore,
        normalizeRecord: normalizeUserRecord,
        normalizeArgs: [normalizedLogin, key],
        recordLabel: 'user'
    });
}

function getLocalUserRecordByLogin(login) {
    const normalizedLogin = normalizeLogin(login);
    if (!normalizedLogin) return null;
    const key = loginToStorageKey(normalizedLogin);
    const localStore = loadLocalUsersStore();
    return normalizeUserRecord(localStore[key], normalizedLogin);
}

async function saveUserRecord(record, options = {}) {
    const requireRemote = !!options.requireRemote;
    const normalized = normalizeUserRecord(record, record?.login);
    if (!normalized) throw new Error('Invalid user record');
    const key = loginToStorageKey(normalized.login);
    const resolvedUid = resolveAuthUidForLogin(normalized.login, normalized.uid);
    const payload = {
        uid: resolvedUid,
        login: normalized.login,
        fio: normalized.fio,
        role: normalized.role,
        passwordHash: normalized.passwordHash,
        passwordNeedsSetup: normalized.passwordNeedsSetup,
        emailVerifiedAt: normalized.emailVerifiedAt,
        emailVerificationSentAt: normalized.emailVerificationSentAt,
        failedLoginAttempts: normalized.failedLoginAttempts,
        isBlocked: normalized.isBlocked,
        blockedReason: normalized.blockedReason,
        failedLoginBackoffUntil: normalized.failedLoginBackoffUntil,
        blockedAt: normalized.blockedAt,
        sessionRevokedAt: normalized.sessionRevokedAt,
        passwordHashScheme: normalized.passwordHashScheme,
        createdAt: normalized.createdAt,
        lastLoginAt: normalized.lastLoginAt,
        lastSeenAt: normalized.lastSeenAt,
        activeMs: normalized.activeMs
    };

    if (requireRemote && !db) {
        throw new Error('Firebase RTDB недоступна для обязательной записи пользователя.');
    }

    if (db) {
        try {
            await firebaseWritePathWithFallback(
                `${AUTH_USERS_DB_PATH}/${key}`,
                () => set(ref(db, `${AUTH_USERS_DB_PATH}/${key}`), payload),
                payload,
                'PUT',
                FIREBASE_FRONTEND_WRITE_TIMEOUT_MS,
                `Firebase write for ${AUTH_USERS_DB_PATH}/${key}`
            );
        } catch (error) {
            console.error('Failed to save user to Firebase:', error);
            if (requireRemote) {
                throw error;
            }
        }
    }

    const localStore = loadLocalUsersStore();
    localStore[key] = toLocalUserCachePayload(payload);
    saveLocalUsersStore(localStore);
    return payload;
}

async function patchUserRecord(login, patch = {}, options = {}) {
    const requireRemote = !!options.requireRemote;
    const normalizedLogin = normalizeLogin(login);
    if (!normalizedLogin) return null;
    const key = loginToStorageKey(normalizedLogin);
    const sanitizedPatch = { ...patch };
    const requestedRoleChange = Object.prototype.hasOwnProperty.call(sanitizedPatch, 'role')
        ? normalizeRole(sanitizedPatch.role)
        : null;
    if (requestedRoleChange === 'admin' && !isAdmin()) {
        throw new Error('Недостаточно прав для назначения роли админа.');
    }
    if (Object.prototype.hasOwnProperty.call(sanitizedPatch, 'fio')) {
        sanitizedPatch.fio = normalizeFio(sanitizedPatch.fio);
    }
    if (Object.prototype.hasOwnProperty.call(sanitizedPatch, 'role')) {
        sanitizedPatch.role = requestedRoleChange;
    }
    if (Object.prototype.hasOwnProperty.call(sanitizedPatch, 'uid')) {
        const requestedUid = String(sanitizedPatch.uid || '').trim();
        const ownAuthUid = resolveAuthUidForLogin(normalizedLogin);
        sanitizedPatch.uid = ownAuthUid && requestedUid === ownAuthUid ? ownAuthUid : null;
    }
    if (Object.prototype.hasOwnProperty.call(sanitizedPatch, 'activeMs')) {
        sanitizedPatch.activeMs = Math.max(0, Number(sanitizedPatch.activeMs) || 0);
    }
    if (Object.prototype.hasOwnProperty.call(sanitizedPatch, 'emailVerifiedAt')) {
        sanitizedPatch.emailVerifiedAt = sanitizedPatch.emailVerifiedAt || null;
    }
    if (Object.prototype.hasOwnProperty.call(sanitizedPatch, 'emailVerificationSentAt')) {
        sanitizedPatch.emailVerificationSentAt = sanitizedPatch.emailVerificationSentAt || null;
    }
    if (Object.prototype.hasOwnProperty.call(sanitizedPatch, 'passwordNeedsSetup')) {
        sanitizedPatch.passwordNeedsSetup = !!sanitizedPatch.passwordNeedsSetup;
    }
    if (Object.prototype.hasOwnProperty.call(sanitizedPatch, 'passwordHashScheme')) {
        sanitizedPatch.passwordHashScheme = String(sanitizedPatch.passwordHashScheme || '').trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(sanitizedPatch, 'failedLoginAttempts')) {
        sanitizedPatch.failedLoginAttempts = Math.max(0, Number(sanitizedPatch.failedLoginAttempts) || 0);
    }
    if (Object.prototype.hasOwnProperty.call(sanitizedPatch, 'isBlocked')) {
        sanitizedPatch.isBlocked = !!sanitizedPatch.isBlocked;
    }
    if (Object.prototype.hasOwnProperty.call(sanitizedPatch, 'blockedReason')) {
        const reason = String(sanitizedPatch.blockedReason || '').trim();
        sanitizedPatch.blockedReason = reason || null;
    }
    if (Object.prototype.hasOwnProperty.call(sanitizedPatch, 'failedLoginBackoffUntil')) {
        const backoffUntil = String(sanitizedPatch.failedLoginBackoffUntil || '').trim();
        const parsed = parseIsoMs(backoffUntil);
        sanitizedPatch.failedLoginBackoffUntil = parsed ? new Date(parsed).toISOString() : null;
    }
    if (Object.prototype.hasOwnProperty.call(sanitizedPatch, 'blockedAt')) {
        sanitizedPatch.blockedAt = sanitizedPatch.blockedAt || null;
    }
    if (Object.prototype.hasOwnProperty.call(sanitizedPatch, 'sessionRevokedAt')) {
        sanitizedPatch.sessionRevokedAt = sanitizedPatch.sessionRevokedAt || null;
    }

    if (requireRemote && !db) {
        throw new Error('Firebase RTDB недоступна для обязательного обновления пользователя.');
    }

    if (db) {
        try {
            await firebaseWritePathWithFallback(
                `${AUTH_USERS_DB_PATH}/${key}`,
                () => update(ref(db, `${AUTH_USERS_DB_PATH}/${key}`), sanitizedPatch),
                sanitizedPatch,
                'PATCH',
                FIREBASE_FRONTEND_WRITE_TIMEOUT_MS,
                `Firebase patch for ${AUTH_USERS_DB_PATH}/${key}`
            );
        } catch (error) {
            console.error('Failed to patch user in Firebase:', error);
            if (requireRemote) {
                throw error;
            }
        }
    }

    const localStore = loadLocalUsersStore();
    const merged = {
        ...(toLocalUserCachePayload(localStore[key]) || { login: normalizedLogin, role: 'user', activeMs: 0 }),
        ...sanitizedPatch,
        login: normalizedLogin
    };
    if (!Object.prototype.hasOwnProperty.call(sanitizedPatch, 'passwordHash')) {
        const prevHash = String((toLocalUserCachePayload(localStore[key]) || {}).passwordHash || '').trim();
        if (prevHash) {
            merged.passwordHash = prevHash;
        }
    }
    localStore[key] = toLocalUserCachePayload(merged);
    saveLocalUsersStore(localStore);
    const normalizedRecord = normalizeUserRecord(merged, normalizedLogin);
    if (!normalizedRecord) return null;
    normalizedRecord.passwordHash = '';
    normalizedRecord.passwordHashScheme = null;
    return normalizedRecord;
}

async function deleteUserRecord(login) {
    const normalizedLogin = normalizeLogin(login);
    if (!normalizedLogin) return false;
    const key = loginToStorageKey(normalizedLogin);

    if (db) {
        try {
            await firebaseWriteWithTimeout(
                () => set(ref(db, `${AUTH_USERS_DB_PATH}/${key}`), null),
                FIREBASE_FRONTEND_WRITE_TIMEOUT_MS,
                `Firebase delete for ${AUTH_USERS_DB_PATH}/${key}`
            );
        } catch (error) {
            console.error('Failed to delete user in Firebase:', error);
        }
    }

    const localStore = loadLocalUsersStore();
    if (Object.prototype.hasOwnProperty.call(localStore, key)) {
        delete localStore[key];
        saveLocalUsersStore(localStore);
    }
    return true;
}

function sortUserRecords(records = []) {
    return [...records].sort((a, b) => a.login.localeCompare(b.login));
}

function buildNormalizedUserRecordsFromEntries(entries = [], mapEntry = null) {
    const normalizedRecords = [];
    entries.forEach((entry) => {
        const normalized = typeof mapEntry === 'function'
            ? mapEntry(entry)
            : normalizeUserRecord(entry?.[1], '', entry?.[0]);
        if (normalized) {
            normalizedRecords.push(normalized);
        }
    });
    return sortUserRecords(normalizedRecords);
}

async function listAllUserRecords() {
    const localStore = loadLocalUsersStore();
    const localRecords = buildNormalizedUserRecordsFromEntries(Object.entries(localStore || {}));

    const collectUsersFromByUidMirror = async () => {
        try {
            const mirrorSnapshot = await firebaseGetWithTimeout(AUTH_USERS_BY_UID_DB_PATH);
            if (!mirrorSnapshot.exists()) return [];
            const rawMirror = mirrorSnapshot.val();
            const recordsFromMirror = buildNormalizedUserRecordsFromEntries(
                Object.entries(rawMirror || {}),
                ([key, item]) => normalizeUserRecord({
                    ...item,
                    uid: String(item?.uid || key || '').trim(),
                    role: item?.role || 'user'
                }, item?.login)
            );

            if (recordsFromMirror.length > 0) {
                return recordsFromMirror;
            }
        } catch (error) {
            console.warn('Failed to load users from users_by_uid mirror:', error);
        }
        return [];
    };

    if (db) {
        try {
            const snapshot = await firebaseGetWithTimeout(AUTH_USERS_DB_PATH);
            if (snapshot.exists()) {
                const raw = snapshot.val();
                const records = buildNormalizedUserRecordsFromEntries(Object.entries(raw || {}));
                if (records.length > 0) {
                    return records;
                }
            }

            const mirrorRecords = await collectUsersFromByUidMirror();
            if (mirrorRecords.length > 0) {
                return mirrorRecords;
            }

            return localRecords;
        } catch (error) {
            console.error('Failed to load users list from Firebase:', error);
            const mirroredRecords = await collectUsersFromByUidMirror();
            if (mirroredRecords.length > 0) {
                return mirroredRecords;
            }

            return localRecords;
        }
    }

    return localRecords;
}

function applyAuthenticatedUser(user) {
    const normalized = normalizeUserRecord(user, user?.login);
    if (!normalized) return;
    const isDevBypassSession = isLocalhostDevBypassSession();

    currentUser = normalized;
    currentUser.passwordHash = '';
    currentUser.passwordHashScheme = null;
    lastSessionRevocationCheckAt = 0;
    lastActiveTimeRemoteFlushAt = parseIsoMs(normalized.lastSeenAt || '') || 0;
    syncSelectedRole(normalized.role);
    setCachedStorageValue(USER_NAME_KEY, normalized.fio);
    setCachedStorageValue(USER_LOGIN_KEY, normalized.login);
    managerNameInput.value = normalized.fio;
    if (settingsNameInput) {
        settingsNameInput.value = normalized.fio;
    }
    if (accountLoginValue) {
        accountLoginValue.textContent = normalized.login;
    }

    updateUserNameDisplay();
    if (isDevBypassSession) {
        stopCurrentUserRecordSubscription();
        stopCurrentUserPromptOverridesSubscription();
        stopCurrentUserPresenceSync();
    } else {
        void ensureCurrentUserAccessMirror(normalized);
        startCurrentUserRecordSubscription(normalized.login);
        startCurrentUserPromptOverridesSubscription(normalized.login);
        lastUserActivityAt = Date.now();
        startCurrentUserPresenceSync(normalized.login);
    }
    applyRoleRestrictions();
}

function resetCurrentSessionToAuth(message = '') {
    stopActiveTimeTrackingLoop();
    stopUserActivityTrackingListeners();
    stopSessionRevocationListeners();
    clearPromptHistoryRemoteSyncState();
    activeTimeFlushInFlight = false;
    pendingActiveMs = 0;
    lastActiveTimeRemoteFlushAt = 0;
    lastPresenceSyncTriggerAt = 0;
    lastActiveLoopEnsureAt = 0;
    lastForcedActivityWakeupAt = 0;
    lastForcedActivityWakeupSource = '';
    clearPendingBlurPause();
    sessionRevocationCheckInFlight = false;
    lastSessionRevocationCheckAt = 0;
    currentUserPageExitHandled = false;
    lastFirebaseData = null;
    lastPromptsFirebaseSnapshot = null;
    lastPromptsFirebaseSnapshotState = null;
    pendingPromptsFirebaseSnapshot = null;
    pendingPromptsFirebaseSnapshotState = null;
    stopProtectedRealtimeListeners();
    stopCurrentUserRecordSubscription();
    stopCurrentUserPromptOverridesSubscription();
    stopCurrentUserPresenceSync({ immediateOffline: true });
    currentUser = null;
    syncSelectedRole('user');
    clearAuthSession();
    clearAuthCacheIdentity();
    applyRoleRestrictions();
    showNameModal();
    if (message) {
        setAuthError(message);
    }
}

function setAuthError(message = '') {
    if (!authErrorText) return;
    if (!message) {
        authErrorText.textContent = '';
        authErrorText.style.display = 'none';
        return;
    }
    authErrorText.textContent = message;
    authErrorText.style.display = 'block';
}

function syncLocalhostDevAuthActions() {
    if (!localhostDevAuthActions || !localhostDevAuthBtn) return;
    const isVisible = isLocalhostAdminPreviewHost();
    localhostDevAuthActions.hidden = !isVisible;
    localhostDevAuthBtn.disabled = !isVisible;
}

async function handleLocalhostDevAuth() {
    if (!isLocalhostAdminPreviewHost()) return;
    setAuthMailHelpVisible(false);
    const fio = normalizeFio(modalNameInput?.value || '');
    const login = normalizeLogin(modalLoginInput?.value || '');
    const password = String(modalPasswordInput?.value || '');

    if (!isValidFio(fio)) {
        setAuthError('Введите полное ФИО (минимум 2 слова).');
        modalNameInput?.focus();
        return;
    }
    if (!isValidLogin(login)) {
        setAuthError('Введите корректный email.');
        modalLoginInput?.focus();
        return;
    }
    if (password && !isValidPassword(password)) {
        setAuthError('Для локального входа пароль либо пустой, либо минимум 6 символов.');
        modalPasswordInput?.focus();
        return;
    }

    setAuthError('');
    setAuthSubmitState(true, 'Входим локально...');

    try {
        const nowIso = new Date().toISOString();
        const existingLocalUser = getLocalUserRecordByLogin(login);
        let passwordHash = String(existingLocalUser?.passwordHash || '');
        if (password) {
            passwordHash = await hashPassword(login, password);
        }

        const localUserPayload = {
            ...(existingLocalUser || {}),
            login,
            fio,
            role: 'user',
            passwordHash,
            passwordNeedsSetup: false,
            emailVerifiedAt: existingLocalUser?.emailVerifiedAt || nowIso,
            emailVerificationSentAt: null,
            failedLoginAttempts: 0,
            isBlocked: false,
            blockedReason: null,
            failedLoginBackoffUntil: null,
            blockedAt: null,
            sessionRevokedAt: null,
            passwordHashScheme: passwordHash ? PASSWORD_HASH_FORMAT_PREFIX : (existingLocalUser?.passwordHashScheme || null),
            createdAt: existingLocalUser?.createdAt || nowIso,
            lastLoginAt: nowIso,
            lastSeenAt: nowIso,
            activeMs: Number(existingLocalUser?.activeMs) || 0
        };
        const localUser = saveLocalhostDevAuthUser(localUserPayload) || saveUserRecordToLocalCache(localUserPayload);
        saveUserRecordToLocalCache(localUser);

        setAuthSession(localUser.login, { devBypass: true });
        applyAuthenticatedUser(localUser);
        await replayActiveTimeCarryover();
        hideNameModal();
        startActiveTimeTracking();
        showCopyNotification('Локальный вход включен');
    } catch (error) {
        console.error('Localhost auth bypass error:', error);
        setAuthError('Не удалось включить локальный вход.');
    } finally {
        setAuthSubmitState(false);
    }
}

function setAuthMailHelpVisible(isVisible) {
    if (!authMailHelp) return;
    authMailHelp.hidden = !isVisible;
    if (isVisible) {
        authMailHelp.setAttribute('open', '');
    }
}

function markUserActivity(optionsOrEvent = null) {
    if (!currentUser) return;
    const force = !!optionsOrEvent?.force;
    const now = Date.now();
    lastUserActivityAt = now;
    if (force || (now - lastActiveLoopEnsureAt) >= USER_ACTIVITY_TRACKING_LOOP_THROTTLE_MS) {
        lastActiveLoopEnsureAt = now;
        ensureActiveTimeTrackingLoop();
    }
    if (force || (now - lastPresenceSyncTriggerAt) >= USER_ACTIVITY_PRESENCE_SYNC_THROTTLE_MS) {
        lastPresenceSyncTriggerAt = now;
        syncCurrentUserPresenceState(force);
    }
}

function triggerForcedUserActivityWakeup(source = '') {
    if (!currentUser) return false;
    const normalizedSource = source === 'visibility' ? 'visibility' : 'focus';
    const now = Date.now();
    if (
        lastForcedActivityWakeupSource
        && lastForcedActivityWakeupSource !== normalizedSource
        && (now - lastForcedActivityWakeupAt) <= USER_ACTIVITY_WAKEUP_DEDUPE_MS
    ) {
        return false;
    }
    lastForcedActivityWakeupAt = now;
    lastForcedActivityWakeupSource = normalizedSource;
    markUserActivity({ force: true });
    return true;
}

function clearPendingBlurPause() {
    if (pendingBlurPauseTimerId) {
        clearTimeout(pendingBlurPauseTimerId);
        pendingBlurPauseTimerId = null;
    }
}

function scheduleBlurPauseActiveTimeTracking() {
    clearPendingBlurPause();
    pendingBlurPauseTimerId = setTimeout(() => {
        pendingBlurPauseTimerId = null;
        if (!currentUser) return;
        if (document.visibilityState === 'hidden') return;
        pauseActiveTimeTracking({ ignoreVisibility: true, ignoreFocus: true });
    }, USER_ACTIVITY_BLUR_PAUSE_DELAY_MS);
}

function initUserActivityTrackingListeners() {
    if (hasActivityListeners) return;
    hasActivityListeners = true;

    activityTrackingHandlers = {
        onActivity: markUserActivity,
        onFocus: () => {
            clearPendingBlurPause();
            triggerForcedUserActivityWakeup('focus');
        },
        onBlur: () => {
            scheduleBlurPauseActiveTimeTracking();
        },
        onVisibilityChange: () => {
            if (document.visibilityState === 'visible') {
                clearPendingBlurPause();
                triggerForcedUserActivityWakeup('visibility');
                return;
            }
            clearPendingBlurPause();
            pauseActiveTimeTracking({ ignoreVisibility: true, ignoreFocus: true, flushCarryoverNow: true });
        },
        onPageExit: handleCurrentUserPageExit
    };

    USER_ACTIVITY_EVENTS.forEach((eventName) => {
        window.addEventListener(eventName, activityTrackingHandlers.onActivity, { passive: true });
    });
    window.addEventListener('focus', activityTrackingHandlers.onFocus);
    window.addEventListener('blur', activityTrackingHandlers.onBlur);
    document.addEventListener('visibilitychange', activityTrackingHandlers.onVisibilityChange);
    window.addEventListener('beforeunload', activityTrackingHandlers.onPageExit);
    window.addEventListener('pagehide', activityTrackingHandlers.onPageExit);
}

function stopUserActivityTrackingListeners() {
    if (!hasActivityListeners || !activityTrackingHandlers) {
        clearPendingBlurPause();
        hasActivityListeners = false;
        activityTrackingHandlers = null;
        return;
    }

    clearPendingBlurPause();
    USER_ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, activityTrackingHandlers.onActivity);
    });
    window.removeEventListener('focus', activityTrackingHandlers.onFocus);
    window.removeEventListener('blur', activityTrackingHandlers.onBlur);
    document.removeEventListener('visibilitychange', activityTrackingHandlers.onVisibilityChange);
    window.removeEventListener('beforeunload', activityTrackingHandlers.onPageExit);
    window.removeEventListener('pagehide', activityTrackingHandlers.onPageExit);
    hasActivityListeners = false;
    activityTrackingHandlers = null;
}

function initSessionRevocationListeners() {
    if (sessionRevocationListenersInitialized) return;
    sessionRevocationWakeupHandler = () => {
        if (shouldSkipVisibleSessionRevocationWakeup()) return;
        void enforceSessionRevocation(false);
    };

    window.addEventListener('focus', sessionRevocationWakeupHandler);
    document.addEventListener('visibilitychange', sessionRevocationWakeupHandler);
    sessionRevocationListenersInitialized = true;
}

function stopSessionRevocationListeners() {
    if (sessionRevocationWakeupHandler) {
        window.removeEventListener('focus', sessionRevocationWakeupHandler);
        document.removeEventListener('visibilitychange', sessionRevocationWakeupHandler);
    }
    sessionRevocationWakeupHandler = null;
    sessionRevocationListenersInitialized = false;
}

function isUserCurrentlyActive() {
    return canAccrueActiveTime(Date.now());
}

async function flushActiveTime(force = false) {
    if (!currentUser || activeTimeFlushInFlight) return false;
    if (!force && pendingActiveMs < ACTIVE_FLUSH_MS) return false;
    if (pendingActiveMs <= 0) return false;

    const now = Date.now();
    if (!force && lastActiveTimeRemoteFlushAt && (now - lastActiveTimeRemoteFlushAt) < ACTIVE_REMOTE_USER_FLUSH_MS) {
        return false;
    }

    const increment = Math.max(0, Math.round(pendingActiveMs));
    if (!increment) return false;

    pendingActiveMs = 0;
    activeTimeFlushInFlight = true;
    const flushedAtIso = new Date().toISOString();
    currentUser.activeMs = Math.max(0, Number(currentUser.activeMs) + increment);

    if (isAdmin() && adminPanelAccordion?.style.display !== 'none') {
        updateAdminUserTimeCell(currentUser.login, currentUser.activeMs);
    }

    markActiveTimeCarryoverInFlight(currentUser.login, increment, flushedAtIso, { flushNow: force });
    try {
        await patchUserRecord(currentUser.login, {
            activeMs: currentUser.activeMs,
            lastSeenAt: flushedAtIso
        });
        currentUser.lastSeenAt = flushedAtIso;
        lastActiveTimeRemoteFlushAt = parseIsoMs(flushedAtIso) || Date.now();
        acknowledgeActiveTimeCarryover(currentUser.login, increment, { flushNow: force });
        return true;
    } finally {
        activeTimeFlushInFlight = false;
    }
}

async function replayActiveTimeCarryover() {
    if (!currentUser) return 0;

    const normalizedLogin = normalizeLogin(currentUser.login);
    if (!normalizedLogin) return 0;

    let carryover = reconcileActiveTimeCarryover(normalizedLogin, currentUser.lastSeenAt || '');
    if (!carryover?.pendingMs || activeTimeFlushInFlight) return 0;

    const increment = Math.max(0, Math.round(Number(carryover.pendingMs) || 0));
    if (!increment) return 0;

    activeTimeFlushInFlight = true;
    const flushedAtIso = new Date().toISOString();
    currentUser.activeMs = Math.max(0, Number(currentUser.activeMs) + increment);
    currentUser.lastSeenAt = flushedAtIso;

    if (isAdmin() && adminPanelAccordion?.style.display !== 'none') {
        updateAdminUserTimeCell(currentUser.login, currentUser.activeMs);
    }

    markActiveTimeCarryoverInFlight(normalizedLogin, increment, flushedAtIso, { flushNow: true });
    try {
        await patchUserRecord(normalizedLogin, {
            activeMs: currentUser.activeMs,
            lastSeenAt: flushedAtIso
        });
        lastActiveTimeRemoteFlushAt = parseIsoMs(flushedAtIso) || Date.now();
        carryover = acknowledgeActiveTimeCarryover(normalizedLogin, increment, { flushNow: true });
        return increment;
    } finally {
        activeTimeFlushInFlight = false;
    }
}

async function enforceSessionRevocation(force = false) {
    if (!currentUser) return false;
    const session = getAuthSession();
    if (!session?.login) return false;
    if (normalizeLogin(session.login) !== currentUser.login) return false;
    if (isLocalhostDevBypassSession(session)) return false;
    if (isSessionRevokedForSignedAt(session.signedAt, currentUser.sessionRevokedAt)) {
        resetCurrentSessionToAuth('Сессия закрыта администратором. Войдите снова.');
        return true;
    }
    if (hasHealthyCurrentUserRecordSubscription()) return false;
    if (sessionRevocationCheckInFlight) return false;

    const now = Date.now();
    if (!force && (now - lastSessionRevocationCheckAt) < SESSION_REVOCATION_CHECK_MS) {
        return false;
    }
    lastSessionRevocationCheckAt = now;
    sessionRevocationCheckInFlight = true;
    try {
        const freshUser = await getUserRecordByLogin(currentUser.login);
        if (!freshUser) {
            resetCurrentSessionToAuth('Сессия завершена. Войдите снова.');
            return true;
        }
        if (isSessionRevokedForSignedAt(session.signedAt, freshUser.sessionRevokedAt)) {
            resetCurrentSessionToAuth('Сессия закрыта администратором. Войдите снова.');
            return true;
        }
        currentUser.sessionRevokedAt = freshUser.sessionRevokedAt || null;
    } finally {
        sessionRevocationCheckInFlight = false;
    }
    return false;
}

function shouldSkipVisibleSessionRevocationWakeup() {
    if (!currentUser) return true;
    if (document.visibilityState !== 'visible') return true;
    const session = getAuthSession();
    if (!session?.login) return true;
    if (isLocalhostDevBypassSession(session)) return true;
    return hasHealthyCurrentUserRecordSubscription();
}

function hasHealthyCurrentUserRecordSubscription() {
    return typeof currentUserRecordUnsubscribe === 'function' && currentUserRecordSubscriptionHealthy;
}

function stopCurrentUserRecordSubscription() {
    if (typeof currentUserRecordUnsubscribe === 'function') {
        currentUserRecordUnsubscribe();
    }
    currentUserRecordUnsubscribe = null;
    currentUserRecordSubscriptionHealthy = false;
    currentUserRecordListenerLogin = '';
}

function getCurrentUserPresencePath(login = currentUser?.login || '') {
    const normalizedLogin = normalizeLogin(login);
    if (!normalizedLogin) return '';
    return `${USER_PRESENCE_DB_PATH}/${loginToStorageKey(normalizedLogin)}`;
}

function resolveCurrentUserPresenceState(now = Date.now()) {
    if (!currentUser) return 'offline';
    if (document.visibilityState !== 'visible') return 'hidden';
    if (!document.hasFocus()) return 'away';
    if ((now - lastUserActivityAt) > ACTIVE_IDLE_TIMEOUT_MS) return 'idle';
    return 'online';
}

function buildCurrentUserPresencePayload(state = 'offline') {
    const normalizedLogin = normalizeLogin(currentUser?.login || '');
    const session = getAuthSession();
    const payload = {
        login: normalizedLogin,
        sessionId: String(session?.signedAt || baseSessionId || '').trim(),
        role: normalizeRole(currentUser?.role || 'user'),
        state,
        updatedAt: serverTimestamp()
    };
    if (state === 'online') {
        payload.lastActiveAt = serverTimestamp();
    }
    return payload;
}

function buildCurrentUserPresencePayloadKey(payload = null) {
    if (!payload || typeof payload !== 'object') return '';
    return [
        normalizeLogin(payload.login || ''),
        String(payload.sessionId || '').trim(),
        normalizeRole(payload.role || 'user'),
        String(payload.state || '').trim().toLowerCase()
    ].join('|');
}

function stopCurrentUserPresenceSync(options = {}) {
    const {
        immediateOffline = false
    } = options;
    const normalizedLogin = normalizeLogin(currentUser?.login || '');
    const presencePath = currentUserPresencePath || getCurrentUserPresencePath(normalizedLogin);
    clearCurrentUserPresenceRecovery();
    currentUserPresenceSubscriptionHealthy = false;

    if (typeof currentUserPresenceConnectedUnsubscribe === 'function') {
        currentUserPresenceConnectedUnsubscribe();
    }
    currentUserPresenceConnectedUnsubscribe = null;

    if (!immediateOffline && currentUserPresenceDisconnect && typeof currentUserPresenceDisconnect.cancel === 'function') {
        currentUserPresenceDisconnect.cancel().catch((error) => {
            console.error('Failed to cancel presence disconnect hook:', error);
        });
    }
    currentUserPresenceDisconnect = null;
    currentUserPresencePath = '';
    currentUserPresenceState = 'offline';
    currentUserPresenceLastPayloadKey = '';

    if (immediateOffline && db && presencePath && normalizedLogin) {
        void update(ref(db, presencePath), {
            ...buildCurrentUserPresencePayload('offline'),
            login: normalizedLogin
        }).catch((error) => {
            console.error('Failed to publish offline presence:', error);
        });
    }
}

function clearCurrentUserPresenceRecovery() {
    if (!currentUserPresenceRecoveryTimerId) return;
    clearTimeout(currentUserPresenceRecoveryTimerId);
    currentUserPresenceRecoveryTimerId = null;
}

function hasHealthyCurrentUserPresenceSync() {
    return typeof currentUserPresenceConnectedUnsubscribe === 'function' && currentUserPresenceSubscriptionHealthy;
}

function stopCurrentUserPresenceSyncTransport() {
    clearCurrentUserPresenceRecovery();
    currentUserPresenceSubscriptionHealthy = false;
    if (typeof currentUserPresenceConnectedUnsubscribe === 'function') {
        try {
            currentUserPresenceConnectedUnsubscribe();
        } catch (error) {
            console.warn('Failed to stop current user presence live listener:', error);
        }
    }
    currentUserPresenceConnectedUnsubscribe = null;
    currentUserPresenceDisconnect = null;
}

function scheduleCurrentUserPresenceRecovery(login = currentUser?.login || '', reason = '', delayMs = PROTECTED_REALTIME_RECOVERY_DELAY_MS) {
    const normalizedLogin = normalizeLogin(login);
    if (!normalizedLogin || currentUserPresenceRecoveryTimerId) {
        return false;
    }
    currentUserPresenceRecoveryTimerId = setTimeout(() => {
        currentUserPresenceRecoveryTimerId = null;
        if (!currentUser || normalizeLogin(currentUser.login) !== normalizedLogin) return;
        debugLog('Recovering current user presence live listener', { reason, login: normalizedLogin });
        startCurrentUserPresenceSync(normalizedLogin);
    }, Math.max(250, Number(delayMs) || PROTECTED_REALTIME_RECOVERY_DELAY_MS));
    return true;
}

function syncCurrentUserPresenceState(options = {}) {
    const force = typeof options === 'boolean'
        ? options
        : !!options?.force;
    if (!db || !currentUser) return false;
    const normalizedLogin = normalizeLogin(currentUser.login);
    if (!normalizedLogin) return false;

    const nextState = resolveCurrentUserPresenceState(Date.now());
    if (!force && nextState === currentUserPresenceState) return false;

    const presencePath = currentUserPresencePath || getCurrentUserPresencePath(normalizedLogin);
    if (!presencePath) return false;

    const payload = buildCurrentUserPresencePayload(nextState);
    const payloadKey = buildCurrentUserPresencePayloadKey(payload);
    if (payloadKey && payloadKey === currentUserPresenceLastPayloadKey) {
        return false;
    }

    currentUserPresenceState = nextState;
    currentUserPresencePath = presencePath;
    currentUserPresenceLastPayloadKey = payloadKey;
    lastPresenceSyncTriggerAt = Date.now();
    void update(ref(db, presencePath), payload).catch((error) => {
        console.error('Failed to sync current user presence:', error);
    });
    return true;
}

function startCurrentUserPresenceSync(login = currentUser?.login || '') {
    const normalizedLogin = normalizeLogin(login);
    if (!db || !normalizedLogin) {
        stopCurrentUserPresenceSync();
        return false;
    }

    const nextPath = getCurrentUserPresencePath(normalizedLogin);
    if (hasHealthyCurrentUserPresenceSync() && currentUserPresencePath === nextPath) {
        syncCurrentUserPresenceState(true);
        return true;
    }

    if (currentUserPresencePath && currentUserPresencePath !== nextPath) {
        stopCurrentUserPresenceSync();
    } else {
        stopCurrentUserPresenceSyncTransport();
    }
    currentUserPresencePath = nextPath;
    currentUserPresenceSubscriptionHealthy = false;
    currentUserPresenceConnectedUnsubscribe = onValue(
        ref(db, '.info/connected'),
        (snapshot) => {
            clearCurrentUserPresenceRecovery();
            currentUserPresenceSubscriptionHealthy = true;
            if (snapshot.val() !== true) {
                currentUserPresenceDisconnect = null;
                currentUserPresenceState = 'offline';
                currentUserPresenceLastPayloadKey = '';
                return;
            }

            if (!currentUser || normalizeLogin(currentUser.login) !== normalizedLogin) {
                return;
            }

            currentUserPresenceDisconnect = onDisconnect(ref(db, nextPath));
            currentUserPresenceDisconnect.update({
                state: 'offline',
                updatedAt: serverTimestamp()
            }).catch((error) => {
                console.error('Failed to register presence disconnect hook:', error);
            });
            syncCurrentUserPresenceState(true);
        },
        (error) => {
            currentUserPresenceSubscriptionHealthy = false;
            if (typeof currentUserPresenceConnectedUnsubscribe === 'function') {
                try {
                    currentUserPresenceConnectedUnsubscribe();
                } catch (unsubscribeError) {
                    console.warn('Failed to stop broken current user presence listener:', unsubscribeError);
                }
            }
            currentUserPresenceConnectedUnsubscribe = null;
            currentUserPresenceDisconnect = null;
            currentUserPresenceState = 'offline';
            currentUserPresenceLastPayloadKey = '';
            console.error('Current user presence live sync failed:', error);
            scheduleCurrentUserPresenceRecovery(normalizedLogin, 'current-user-presence-live-sync-failed');
        }
    );
    return true;
}

function syncCurrentUserSettingsState() {
    if (!isSettingsModalOpen()) return;

    if (settingsNameInput && document.activeElement !== settingsNameInput) {
        settingsNameInput.value = currentUser?.fio || '';
    }
    if (accountLoginValue) {
        accountLoginValue.textContent = currentUser?.login || '-';
    }
    ensureRoleChangeButtonVisible();

    if (!adminPanelAccordion) return;
    if (isAdmin()) {
        adminPanelAccordion.style.display = '';
        adminPanelAccordion.setAttribute('open', '');
        startAdminRealtimeSync();
    } else {
        adminPanelAccordion.style.display = 'none';
        adminPanelAccordion.removeAttribute('open');
        stopAdminRealtimeSync();
    }
}

function isCurrentUserRealtimeUiEchoOnly(previousUser, nextUser) {
    if (!previousUser || !nextUser) return false;
    return previousUser.uid === nextUser.uid
        && previousUser.login === nextUser.login
        && previousUser.fio === nextUser.fio
        && normalizeRole(previousUser.role) === normalizeRole(nextUser.role)
        && !!previousUser.passwordNeedsSetup === !!nextUser.passwordNeedsSetup
        && String(previousUser.emailVerifiedAt || '') === String(nextUser.emailVerifiedAt || '')
        && String(previousUser.emailVerificationSentAt || '') === String(nextUser.emailVerificationSentAt || '')
        && Number(previousUser.failedLoginAttempts || 0) === Number(nextUser.failedLoginAttempts || 0)
        && !!previousUser.isBlocked === !!nextUser.isBlocked
        && String(previousUser.blockedReason || '') === String(nextUser.blockedReason || '')
        && String(previousUser.failedLoginBackoffUntil || '') === String(nextUser.failedLoginBackoffUntil || '')
        && String(previousUser.blockedAt || '') === String(nextUser.blockedAt || '')
        && String(previousUser.sessionRevokedAt || '') === String(nextUser.sessionRevokedAt || '')
        && String(previousUser.createdAt || '') === String(nextUser.createdAt || '')
        && String(previousUser.lastLoginAt || '') === String(nextUser.lastLoginAt || '');
}

function applyCurrentUserRealtimeRecord(freshUser) {
    if (!freshUser || !currentUser) return;
    const normalizedLogin = normalizeLogin(freshUser.login || currentUser.login);
    if (!normalizedLogin || normalizeLogin(currentUser.login) !== normalizedLogin) return;

    const previousUser = currentUser;
    const previousName = currentUser.fio;
    const previousRole = normalizeRole(currentUser.role);
    const previousSelectedRole = normalizeRole(selectedRole || 'user');
    const previousActiveMs = Number(currentUser.activeMs) || 0;
    const merged = normalizeUserRecord({
        ...currentUser,
        ...freshUser
    }, normalizedLogin) || currentUser;

    merged.passwordHash = '';
    merged.passwordHashScheme = null;
    currentUser = merged;
    if (isCurrentUserRealtimeUiEchoOnly(previousUser, merged)) {
        if (hasAdminAccount() && adminPanelAccordion?.style.display !== 'none' && Number(currentUser.activeMs) !== previousActiveMs) {
            updateAdminUserTimeCell(currentUser.login, currentUser.activeMs);
        }
        return;
    }

    if (hasAdminAccount(merged)) {
        startCurrentUserPromptOverridesSubscription(normalizedLogin);
    } else {
        stopCurrentUserPromptOverridesSubscription();
    }

    const effectiveRole = syncSelectedRole(previousSelectedRole);
    const roleChanged = previousRole !== normalizeRole(currentUser.role);
    const selectedRoleChanged = effectiveRole !== previousSelectedRole;

    if (previousName !== currentUser.fio) {
        setCachedStorageValue(USER_NAME_KEY, currentUser.fio);
        managerNameInput.value = currentUser.fio;
    }

    updateUserNameDisplay();
    syncCurrentUserSettingsState();
    if (roleChanged) {
        syncCurrentUserPresenceState(true);
    }

    if (roleChanged || selectedRoleChanged) {
        applyRoleRestrictions();
        if (hasAdminAccount() && isSettingsModalOpen()) {
            void renderAdminUsersTable();
        }
    } else if (hasAdminAccount() && adminPanelAccordion?.style.display !== 'none' && Number(currentUser.activeMs) !== previousActiveMs) {
        updateAdminUserTimeCell(currentUser.login, currentUser.activeMs);
    }
}

function startCurrentUserRecordSubscription(login) {
    const normalizedLogin = normalizeLogin(login);
    if (!db || !normalizedLogin) {
        stopCurrentUserRecordSubscription();
        return false;
    }
    if (hasHealthyCurrentUserRecordSubscription() && currentUserRecordListenerLogin === normalizedLogin) {
        return true;
    }

    stopCurrentUserRecordSubscription();
    currentUserRecordListenerLogin = normalizedLogin;
    currentUserRecordSubscriptionHealthy = false;
    currentUserRecordUnsubscribe = onValue(
        ref(db, `${AUTH_USERS_DB_PATH}/${loginToStorageKey(normalizedLogin)}`),
        async (snapshot) => {
            if (!currentUser || normalizeLogin(currentUser.login) !== normalizedLogin) return;
            currentUserRecordSubscriptionHealthy = true;
            if (!snapshot.exists()) {
                if (isLocalhostAdminPreviewHost()) {
                    const fallbackUser = getLocalUserRecordByLogin(normalizedLogin);
                    if (fallbackUser) {
                        applyCurrentUserRealtimeRecord(fallbackUser);
                        return;
                    }
                }
                resetCurrentSessionToAuth('Сессия завершена. Войдите снова.');
                return;
            }

            const freshUser = normalizeUserRecord(snapshot.val(), normalizedLogin);
            if (!freshUser) return;

            const session = getAuthSession();
            if (!session?.login || normalizeLogin(session.login) !== normalizedLogin) return;
            if (isSessionRevokedForSignedAt(session.signedAt, freshUser.sessionRevokedAt)) {
                resetCurrentSessionToAuth('Сессия закрыта администратором. Войдите снова.');
                return;
            }

            applyCurrentUserRealtimeRecord(freshUser);
        },
        (error) => {
            currentUserRecordSubscriptionHealthy = false;
            console.error('Current user live sync failed:', error);
            void enforceSessionRevocation(true);
        }
    );
    return true;
}

function startActiveTimeTracking() {
    initUserActivityTrackingListeners();
    currentUserPageExitHandled = false;
    lastUserActivityAt = Date.now();
    lastActiveTickAt = Date.now();
    pendingActiveMs = 0;
    stopActiveTimeTrackingLoop();
    initSessionRevocationListeners();

    ensureActiveTimeTrackingLoop();
    syncCurrentUserPresenceState(true);
}

function canAccrueActiveTime(now = Date.now(), options = {}) {
    if (!currentUser) return false;
    const ignoreVisibility = !!options.ignoreVisibility;
    const ignoreFocus = !!options.ignoreFocus;
    if (!ignoreVisibility && document.visibilityState !== 'visible') return false;
    if (!ignoreFocus && !document.hasFocus()) return false;
    return now - lastUserActivityAt <= ACTIVE_IDLE_TIMEOUT_MS;
}

function stopActiveTimeTrackingLoop() {
    if (!activeTickTimerId) return;
    clearInterval(activeTickTimerId);
    activeTickTimerId = null;
}

function captureActiveTimeDelta(now = Date.now(), options = {}) {
    const delta = Math.max(0, now - lastActiveTickAt);
    lastActiveTickAt = now;
    if (!delta) return 0;
    if (!canAccrueActiveTime(now, options)) return 0;
    pendingActiveMs += delta;
    addActiveTimeCarryover(currentUser?.login || '', delta, { flushNow: !!options.flushCarryoverNow });
    return delta;
}

function handleCurrentUserPageExit() {
    if (currentUserPageExitHandled) return;
    currentUserPageExitHandled = true;
    clearPendingBlurPause();
    void flushPromptHistoryRemoteSync();
    pauseActiveTimeTracking({
        ignoreVisibility: true,
        ignoreFocus: true,
        flushCarryoverNow: true,
        skipPresenceSync: true
    });
    stopCurrentUserPresenceSync({ immediateOffline: true });
}

function pauseActiveTimeTracking(options = {}) {
    captureActiveTimeDelta(Date.now(), options);
    if (options.flushCarryoverNow) {
        flushLocalJsonStorageCacheNow();
    }
    stopActiveTimeTrackingLoop();
    void flushActiveTime(true);
    if (!options.skipPresenceSync) {
        syncCurrentUserPresenceState(true);
    }
}

function ensureActiveTimeTrackingLoop() {
    if (activeTickTimerId || !canAccrueActiveTime(Date.now())) return;
    lastActiveTickAt = Date.now();
    activeTickTimerId = setInterval(() => {
        if (!currentUser) {
            stopActiveTimeTrackingLoop();
            return;
        }

        const now = Date.now();
        if (!canAccrueActiveTime(now)) {
            stopActiveTimeTrackingLoop();
            void flushActiveTime(true);
            syncCurrentUserPresenceState(true);
            return;
        }

        captureActiveTimeDelta(now);
        void flushActiveTime(false);
    }, ACTIVE_TICK_MS);
}

function formatActiveTime(ms) {
    const totalSeconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}ч ${String(minutes).padStart(2, '0')}м`;
    if (minutes > 0) return `${minutes}м ${String(seconds).padStart(2, '0')}с`;
    return `${seconds}с`;
}

function formatPresenceRecency(iso) {
    const timestampMs = parseIsoMs(iso || '');
    if (!timestampMs) return 'нет сигнала';

    const deltaMs = Math.max(0, Date.now() - timestampMs);
    if (deltaMs < 90 * 1000) return 'только что';

    const minutes = Math.round(deltaMs / (60 * 1000));
    if (minutes < 60) return `${minutes} мин назад`;

    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} ч назад`;

    return new Date(timestampMs).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getAdminPresenceMeta(login, user, presence) {
    const normalizedLogin = normalizeLogin(login);
    const normalizedPresence = presence && normalizeLogin(presence.login) === normalizedLogin
        ? presence
        : null;
    const updatedAt = normalizedPresence?.updatedAt || user?.lastSeenAt || '';

    if (!normalizedPresence) {
        return {
            label: updatedAt ? `Был ${formatPresenceRecency(updatedAt)}` : 'Не в сети',
            className: 'is-offline'
        };
    }

    switch (normalizedPresence.state) {
        case 'online':
            return { label: 'Онлайн сейчас', className: 'is-online' };
        case 'idle':
            return { label: `Без активности, ${formatPresenceRecency(updatedAt)}`, className: 'is-idle' };
        case 'away':
            return { label: `Отошел, ${formatPresenceRecency(updatedAt)}`, className: 'is-away' };
        case 'hidden':
            return { label: `Скрыта вкладка, ${formatPresenceRecency(updatedAt)}`, className: 'is-hidden' };
        default:
            return { label: updatedAt ? `Был ${formatPresenceRecency(updatedAt)}` : 'Не в сети', className: 'is-offline' };
    }
}

function formatInviteExpiry(iso) {
    if (!iso) return 'Без срока';
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime())) return 'Без срока';
    return date.toLocaleDateString('ru-RU');
}

function getAccessSourceLabel(login, user, invite, accessRevocation = null) {
    if (isAccessRevokedForLogin(accessRevocation, login)) {
        const reason = String(accessRevocation?.reason || '').trim();
        if (reason && reason !== 'manual') {
            return `Снят доступ (${reason})`;
        }
        return 'Снят доступ администратором';
    }

    if (invite) {
        return invite.expiresAt ? `По ссылке до ${formatInviteExpiry(invite.expiresAt)}` : 'По ссылке';
    }

    if (isCorporateEmail(login)) return 'По корпоративному email';
    if (user?.role === 'admin') return 'Админ';
    return 'Без источника';
}

function getAccessState(login, user, invite, accessRevocation = null) {
    const blockedByUser = !!user?.isBlocked;
    const inviteExists = !!invite;
    const inviteActive = inviteExists ? isPartnerInviteActive(invite) : false;
    const isAdminUser = user?.role === 'admin';
    const isCorporate = isCorporateEmail(login);
    const isRevoked = isAccessRevokedForLogin(accessRevocation, login);

    const active = !isRevoked && !blockedByUser && (isAdminUser || isCorporate || inviteActive);
    let label = active ? 'Активен' : 'Закрыт';
    if (isRevoked) {
        label = 'Доступ закрыт';
    } else if (blockedByUser) {
        label = 'Заблокирован';
    }
    if (!active && !blockedByUser && !inviteExists && !isCorporate && !isAdminUser) {
        label = 'Нет доступа';
    }

    return {
        active,
        label,
        blockedByUser,
        inviteExists,
        inviteActive,
        isAdminUser,
        isCorporate,
        isRevoked
    };
}

function getFailedLoginBackoffState(user) {
    if (!user) {
        return null;
    }
    const blockedUntil = parseIsoMs(user.failedLoginBackoffUntil);
    if (!blockedUntil) return null;
    return blockedUntil > Date.now() ? blockedUntil : null;
}

function computeFailedLoginBackoffMs(failedAttempts) {
    const normalizedAttempts = Math.max(0, Number(failedAttempts) || 0);
    if (normalizedAttempts <= 1) return 0;
    const factor = normalizedAttempts - 1;
    const delay = FAILED_LOGIN_BACKOFF_BASE_MS * Math.pow(2, factor);
    return Math.min(FAILED_LOGIN_BACKOFF_MAX_MS, Math.max(FAILED_LOGIN_BACKOFF_BASE_MS, delay));
}

function clearAuthCachesForRevocation(login = '') {
    const normalizedLogin = normalizeLogin(login);
    if (!normalizedLogin) return;

    const activeSession = getAuthSession();
    if (normalizeLogin(activeSession?.login || '') === normalizedLogin) {
        clearAuthSession();
    }
    clearAuthCacheIdentityForLogin(normalizedLogin);
    if (currentUser && normalizeLogin(currentUser.login) === normalizedLogin) {
        clearAuthCacheIdentity();
    }
}

async function toggleAccessForLogin(login, nextActive, user, invite, accessRevocation = null) {
    const normalizedLogin = normalizeLogin(login);
    if (!normalizedLogin) throw new Error('Некорректный email.');
    const nowIso = new Date().toISOString();
    const isAdminUser = user?.role === 'admin';
    const isCorporate = isCorporateEmail(normalizedLogin);
    const currentlyRevoked = isAccessRevokedForLogin(accessRevocation, normalizedLogin);
    const shouldDeleteUser = Boolean(user) && !isAdminUser;

    if (!nextActive) {
        if (!user && !invite && !currentlyRevoked) {
            throw new Error('Для этого email нет данных для закрытия доступа.');
        }

        await setAccessRevocation(normalizedLogin, true, {
            reason: 'manual',
            updatedBy: normalizeLogin(currentUser?.login || '')
        });

        if (invite) {
            await deletePartnerInvite(normalizedLogin);
        }

        if (shouldDeleteUser) {
            await deleteUserRecord(normalizedLogin);
        } else if (user) {
            await patchUserRecord(normalizedLogin, {
                isBlocked: true,
                blockedAt: nowIso,
                blockedReason: 'revoked_by_admin',
                failedLoginAttempts: 0,
                failedLoginBackoffUntil: null,
                sessionRevokedAt: nowIso,
                lastSeenAt: nowIso
            });
        }

        clearAuthCachesForRevocation(normalizedLogin);
        if (currentUser && currentUser.login === normalizedLogin) {
            resetCurrentSessionToAuth('Доступ закрыт администратором. Войдите снова.');
        }
        return;
    }

    const canOpenByRole = isAdminUser || isCorporate || !!invite;
    if (nextActive && !canOpenByRole && !currentlyRevoked) {
        throw new Error('Для этого email сначала выдайте доступ по ссылке.');
    }

    await setAccessRevocation(normalizedLogin, false);

    if (user) {
        await patchUserRecord(normalizedLogin, {
            isBlocked: false,
            blockedReason: null,
            blockedAt: null,
            failedLoginAttempts: 0,
            failedLoginBackoffUntil: null,
            sessionRevokedAt: null,
            lastSeenAt: nowIso
        });
    }

    if (invite) {
        await patchPartnerInvite(normalizedLogin, {
            status: 'active'
        });
    }

    if (currentUser && currentUser.login === normalizedLogin) {
        const refreshedUser = await getUserRecordByLogin(normalizedLogin);
        if (refreshedUser) {
            currentUser = normalizeUserRecord({
                ...currentUser,
                ...refreshedUser
            }, normalizedLogin) || currentUser;
            currentUser.passwordHash = '';
            currentUser.passwordHashScheme = null;
            syncSelectedRole(selectedRole);
        }
    }
}

function hasAdminRealtimeTableData() {
    return Array.isArray(adminRealtimeUsers)
        && Array.isArray(adminRealtimeInvites)
        && Array.isArray(adminRealtimeRevocations)
        && Array.isArray(adminRealtimePresence);
}

function markAdminRealtimeTableDataReadyIfPossible() {
    if (!hasAdminRealtimeTableData() || !adminRealtimeTableDataReadyWaiters.length) return;
    const waiters = adminRealtimeTableDataReadyWaiters.slice();
    adminRealtimeTableDataReadyWaiters = [];
    waiters.forEach((resolveReady) => {
        try {
            resolveReady(true);
        } catch (error) {
            console.warn('Failed to resolve admin realtime data waiter:', error);
        }
    });
}

function waitForAdminRealtimeTableData(timeoutMs = 250) {
    if (hasAdminRealtimeTableData()) {
        return Promise.resolve(true);
    }
    return new Promise((resolve) => {
        let finished = false;
        let timerId = null;
        const finish = (ready) => {
            if (finished) return;
            finished = true;
            if (timerId) {
                clearTimeout(timerId);
                timerId = null;
            }
            adminRealtimeTableDataReadyWaiters = adminRealtimeTableDataReadyWaiters.filter((item) => item !== onReady);
            resolve(ready);
        };
        const onReady = (ready) => finish(ready);
        adminRealtimeTableDataReadyWaiters.push(onReady);
        timerId = setTimeout(() => {
            finish(hasAdminRealtimeTableData());
        }, Math.max(0, Number(timeoutMs) || 0));
    });
}

function getAdminUsersTableFallbackRows() {
    const normalizedLogin = normalizeLogin(currentUser?.login || '');
    if (!isAdmin() || !isValidLogin(normalizedLogin)) return [];

    const normalizedCurrentUser = normalizeUserRecord(currentUser, normalizedLogin);
    if (!normalizedCurrentUser) return [];

    return buildAdminUsersTableRows(
        [normalizedCurrentUser],
        [],
        [],
        []
    );
}

function resetAdminRealtimeTableData() {
    adminRealtimeUsers = null;
    adminRealtimeInvites = null;
    adminRealtimeRevocations = null;
    adminRealtimePresence = null;
    adminRealtimeUsersByLogin = null;
    adminRealtimeInvitesByLogin = null;
    adminRealtimeRevocationsByLogin = null;
    adminRealtimePresenceByLogin = null;
    adminRealtimeSortedLogins = null;
}

function resetAdminUsersTableDomState() {
    adminUserRowsByLogin.forEach((row) => row.remove());
    adminUserRowsByLogin.clear();
    adminUsersTableInitialized = false;
    if (adminUsersTableBody) {
        adminUsersTableBody.innerHTML = '';
    }
}

function applyAdminUsersTableRows(rowsData = []) {
    if (!adminUsersTableBody) return false;
    adminUsersTableBody.querySelectorAll('.admin-empty-row').forEach((row) => row.remove());
    const seenLogins = new Set();

    rowsData.forEach((rowData) => {
        let row = adminUserRowsByLogin.get(rowData.login);
        if (!row) {
            row = createAdminUsersTableRow(rowData.login);
        }
        updateAdminUsersTableRow(row, rowData);
        adminUsersTableBody.appendChild(row);
        seenLogins.add(rowData.login);
    });

    Array.from(adminUserRowsByLogin.entries()).forEach(([login, row]) => {
        if (seenLogins.has(login)) return;
        row.remove();
        adminUserRowsByLogin.delete(login);
    });

    adminUsersTableInitialized = true;
    return true;
}

function renderAdminUsersTableFromRealtimeState() {
    if (!isSettingsModalOpen() || !isAdmin() || !hasAdminRealtimeTableData()) return false;

    let rowsData = buildAdminUsersTableRowsFromMaps(
        adminRealtimeUsersByLogin || buildLoginIndexedMap(Array.isArray(adminRealtimeUsers) ? adminRealtimeUsers : []),
        adminRealtimeInvitesByLogin || buildLoginIndexedMap(Array.isArray(adminRealtimeInvites) ? adminRealtimeInvites : []),
        adminRealtimeRevocationsByLogin || buildLoginIndexedMap(Array.isArray(adminRealtimeRevocations) ? adminRealtimeRevocations : []),
        adminRealtimePresenceByLogin || buildLoginIndexedMap(Array.isArray(adminRealtimePresence) ? adminRealtimePresence : []),
        adminRealtimeSortedLogins
    );

    if (!rowsData.length) {
        rowsData = getAdminUsersTableFallbackRows();
    }

    if (!rowsData.length) {
        setAdminUsersTableEmptyState('Пользователи пока не добавлены.');
        adminUsersTableInitialized = true;
        return true;
    }

    return applyAdminUsersTableRows(rowsData);
}

function stopAdminRealtimeSync() {
    clearAdminRealtimeSyncRecovery();
    stopAdminRealtimeSyncTransport();
}

function clearAdminRealtimeSyncRecovery() {
    if (!adminRealtimeRecoveryTimerId) return;
    clearTimeout(adminRealtimeRecoveryTimerId);
    adminRealtimeRecoveryTimerId = null;
}

function stopAdminRealtimeSyncTransport(options = {}) {
    const preserveState = !!options.preserveState;
    if (adminStatusRefreshTimerId) {
        clearInterval(adminStatusRefreshTimerId);
        adminStatusRefreshTimerId = null;
    }
    if (Array.isArray(adminRealtimeUnsubscribes)) {
        adminRealtimeUnsubscribes.forEach((unsubscribe) => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
    }
    adminRealtimeUnsubscribes = [];
    adminRealtimeTableDataReadyWaiters = [];
    if (adminUsersTableRenderDebounceTimerId) {
        clearTimeout(adminUsersTableRenderDebounceTimerId);
        adminUsersTableRenderDebounceTimerId = null;
    }
    pendingAdminUsersTableRenderMode = '';
    if (preserveState) {
        return;
    }
    resetAdminRealtimeTableData();
    resetAdminUsersTableDomState();
}

function scheduleAdminRealtimeSyncRecovery(reason = '', delayMs = PROTECTED_REALTIME_RECOVERY_DELAY_MS) {
    if (adminRealtimeRecoveryTimerId) {
        return false;
    }
    adminRealtimeRecoveryTimerId = setTimeout(() => {
        adminRealtimeRecoveryTimerId = null;
        if (!db || !isSettingsModalOpen() || !isAdmin()) return;
        debugLog('Recovering admin realtime sync', { reason });
        startAdminRealtimeSync();
        void renderAdminUsersTable();
    }, Math.max(250, Number(delayMs) || PROTECTED_REALTIME_RECOVERY_DELAY_MS));
    return true;
}

function handleAdminRealtimeSyncFailure(scope, error) {
    console.error(`Admin ${scope} live sync failed:`, error);
    stopAdminRealtimeSyncTransport({ preserveState: true });
    scheduleAdminRealtimeSyncRecovery(`${scope}-live-sync-failed`);
}

function scheduleAdminUsersTableRender(mode = 'full') {
    if (!isSettingsModalOpen() || !isAdmin()) return;
    pendingAdminUsersTableRenderMode = mode === 'full' || pendingAdminUsersTableRenderMode === 'full'
        ? 'full'
        : 'incremental';
    if (adminUsersTableRenderDebounceTimerId) {
        clearTimeout(adminUsersTableRenderDebounceTimerId);
    }
    adminUsersTableRenderDebounceTimerId = setTimeout(() => {
        adminUsersTableRenderDebounceTimerId = null;
        const nextMode = pendingAdminUsersTableRenderMode;
        pendingAdminUsersTableRenderMode = '';
        if (nextMode === 'incremental' && adminUsersTableInitialized && renderAdminUsersTableFromRealtimeState()) {
            return;
        }
        void renderAdminUsersTable();
    }, ADMIN_USERS_TABLE_RENDER_DEBOUNCE_MS);
}

function refreshAdminUsersPresenceLabels() {
    if (!isSettingsModalOpen() || !isAdmin() || !adminUserRowsByLogin.size) return;
    adminUserRowsByLogin.forEach((row, login) => {
        if (!row) return;
        refreshAdminUserPresenceLabel(login);
    });
}

function buildAdminRealtimeUserRenderKey(user) {
    const normalizedUser = normalizeUserRecord(user, user?.login);
    if (!normalizedUser) return '';
    return JSON.stringify({
        login: normalizedUser.login,
        fio: normalizedUser.fio || '',
        role: normalizeRole(normalizedUser.role),
        uid: String(normalizedUser.uid || ''),
        isBlocked: !!normalizedUser.isBlocked,
        blockedReason: String(normalizedUser.blockedReason || ''),
        blockedAt: String(normalizedUser.blockedAt || ''),
        failedLoginBackoffUntil: String(normalizedUser.failedLoginBackoffUntil || ''),
        sessionRevokedAt: String(normalizedUser.sessionRevokedAt || ''),
        emailVerifiedAt: String(normalizedUser.emailVerifiedAt || ''),
        passwordNeedsSetup: !!normalizedUser.passwordNeedsSetup,
        lastLoginAt: String(normalizedUser.lastLoginAt || '')
    });
}

function buildAdminRealtimeInviteRenderKey(invite) {
    const normalizedInvite = normalizePartnerInvite(invite, invite?.login);
    if (!normalizedInvite) return '';
    return JSON.stringify({
        login: normalizedInvite.login,
        status: normalizedInvite.status,
        createdAt: String(normalizedInvite.createdAt || ''),
        createdBy: String(normalizedInvite.createdBy || ''),
        expiresAt: String(normalizedInvite.expiresAt || ''),
        emailVerifiedAt: String(normalizedInvite.emailVerifiedAt || ''),
        note: String(normalizedInvite.note || '')
    });
}

function buildAdminRealtimeRevocationRenderKey(accessRevocation) {
    const normalizedAccessRevocation = normalizeAccessRevocation(accessRevocation, accessRevocation?.login);
    if (!normalizedAccessRevocation) return '';
    return JSON.stringify({
        login: normalizedAccessRevocation.login,
        status: normalizedAccessRevocation.status,
        revokedAt: String(normalizedAccessRevocation.revokedAt || ''),
        updatedAt: String(normalizedAccessRevocation.updatedAt || ''),
        updatedBy: String(normalizedAccessRevocation.updatedBy || ''),
        reason: String(normalizedAccessRevocation.reason || '')
    });
}

function buildAdminRealtimePresenceRenderKey(presence) {
    const normalizedPresence = normalizeUserPresence(presence, presence?.login);
    if (!normalizedPresence) return '';
    return JSON.stringify({
        login: normalizedPresence.login,
        state: normalizedPresence.state,
        sessionId: String(normalizedPresence.sessionId || ''),
        updatedAt: String(normalizedPresence.updatedAt || ''),
        lastActiveAt: String(normalizedPresence.lastActiveAt || '')
    });
}

function refreshAdminUserPresenceLabel(login) {
    const normalizedLogin = normalizeLogin(login);
    if (!normalizedLogin) return;
    const row = adminUserRowsByLogin.get(normalizedLogin);
    const rowData = row?._adminData;
    const presenceText = row?._adminCells?.presenceText;
    if (!rowData || !presenceText) return;
    const presenceMeta = getAdminPresenceMeta(rowData.login, rowData.user, rowData.presence);
    presenceText.className = `admin-presence ${presenceMeta.className}`.trim();
    presenceText.textContent = presenceMeta.label;
}

function applyAdminRealtimeUsersSnapshot(raw) {
    const previousUsers = Array.isArray(adminRealtimeUsers) ? adminRealtimeUsers : [];
    const nextUsers = Object.entries(raw || {})
        .map(([key, item]) => normalizeUserRecord(item, '', key))
        .filter(Boolean);
    adminRealtimeUsers = nextUsers;
    adminRealtimeUsersByLogin = buildLoginIndexedMap(nextUsers);
    rebuildAdminRealtimeSortedLogins();
    markAdminRealtimeTableDataReadyIfPossible();

    if (!isSettingsModalOpen() || !isAdmin()) return;
    if (!adminUsersTableInitialized || !adminUserRowsByLogin.size || !previousUsers.length) {
        scheduleAdminUsersTableRender('incremental');
        return;
    }

    const previousByLogin = new Map();
    previousUsers.forEach((user) => {
        const login = normalizeLogin(user?.login || '');
        if (isValidLogin(login)) {
            previousByLogin.set(login, user);
        }
    });
    const nextByLogin = new Map();
    nextUsers.forEach((user) => {
        const login = normalizeLogin(user?.login || '');
        if (isValidLogin(login)) {
            nextByLogin.set(login, user);
        }
    });

    if (previousByLogin.size !== nextByLogin.size) {
        scheduleAdminUsersTableRender('incremental');
        return;
    }

    const changedLogins = [];
    const changedLoginSet = new Set();
    const activeMsChangedLogins = [];
    for (const [login, nextUser] of nextByLogin.entries()) {
        const previousUser = previousByLogin.get(login);
        const row = adminUserRowsByLogin.get(login);
        if (!previousUser || !row?._adminData) {
            scheduleAdminUsersTableRender('incremental');
            return;
        }
        if (buildAdminRealtimeUserRenderKey(previousUser) !== buildAdminRealtimeUserRenderKey(nextUser)) {
            changedLogins.push(login);
            changedLoginSet.add(login);
            continue;
        }
        if (Number(previousUser?.activeMs || 0) !== Number(nextUser?.activeMs || 0)) {
            activeMsChangedLogins.push(login);
        }
    }

    if (!changedLogins.length && !activeMsChangedLogins.length) return;

    changedLogins.forEach((login) => {
        const nextUser = nextByLogin.get(login);
        const row = adminUserRowsByLogin.get(login);
        if (!nextUser || !row?._adminData) return;
        row._adminData.user = nextUser;
        row._adminData.accessState = getAccessState(
            login,
            nextUser,
            row._adminData.invite,
            row._adminData.accessRevocation
        );
        updateAdminUsersTableRow(row, row._adminData);
    });

    activeMsChangedLogins.forEach((login) => {
        if (changedLoginSet.has(login)) return;
        const nextUser = nextByLogin.get(login);
        const row = adminUserRowsByLogin.get(login);
        if (!nextUser || !row?._adminData) return;
        row._adminData.user = nextUser;
        updateAdminUserTimeCell(login, nextUser.activeMs);
    });
}

function applyAdminRealtimeInvitesSnapshot(raw) {
    const previousInvites = Array.isArray(adminRealtimeInvites) ? adminRealtimeInvites : [];
    const nextInvites = Object.entries(raw || {})
        .map(([key, item]) => normalizePartnerInvite(item, '', key))
        .filter(Boolean);
    adminRealtimeInvites = nextInvites;
    adminRealtimeInvitesByLogin = buildLoginIndexedMap(nextInvites);
    rebuildAdminRealtimeSortedLogins();
    markAdminRealtimeTableDataReadyIfPossible();

    if (!isSettingsModalOpen() || !isAdmin()) return;
    if (!adminUsersTableInitialized || !adminUserRowsByLogin.size || !previousInvites.length) {
        scheduleAdminUsersTableRender('incremental');
        return;
    }

    const previousByLogin = new Map();
    previousInvites.forEach((invite) => {
        const login = normalizeLogin(invite?.login || '');
        if (isValidLogin(login)) {
            previousByLogin.set(login, invite);
        }
    });
    const nextByLogin = new Map();
    nextInvites.forEach((invite) => {
        const login = normalizeLogin(invite?.login || '');
        if (isValidLogin(login)) {
            nextByLogin.set(login, invite);
        }
    });

    if (previousByLogin.size !== nextByLogin.size) {
        scheduleAdminUsersTableRender('incremental');
        return;
    }

    let hasChanges = false;
    for (const [login, nextInvite] of nextByLogin.entries()) {
        const previousInvite = previousByLogin.get(login);
        const row = adminUserRowsByLogin.get(login);
        if (!previousInvite || !row?._adminData) {
            scheduleAdminUsersTableRender('incremental');
            return;
        }
        if (buildAdminRealtimeInviteRenderKey(previousInvite) !== buildAdminRealtimeInviteRenderKey(nextInvite)) {
            hasChanges = true;
        }
    }

    if (!hasChanges) return;

    nextByLogin.forEach((nextInvite, login) => {
        const row = adminUserRowsByLogin.get(login);
        if (!row?._adminData) return;
        row._adminData.invite = nextInvite;
        row._adminData.accessState = getAccessState(
            login,
            row._adminData.user,
            nextInvite,
            row._adminData.accessRevocation
        );
        updateAdminUsersTableRow(row, row._adminData);
    });
}

function applyAdminRealtimeRevocationsSnapshot(raw) {
    const previousRevocations = Array.isArray(adminRealtimeRevocations) ? adminRealtimeRevocations : [];
    const nextRevocations = Object.entries(raw || {})
        .map(([key, item]) => normalizeAccessRevocation(item, '', key))
        .filter(Boolean);
    adminRealtimeRevocations = nextRevocations;
    adminRealtimeRevocationsByLogin = buildLoginIndexedMap(nextRevocations);
    rebuildAdminRealtimeSortedLogins();
    markAdminRealtimeTableDataReadyIfPossible();

    if (!isSettingsModalOpen() || !isAdmin()) return;
    if (!adminUsersTableInitialized || !adminUserRowsByLogin.size || !previousRevocations.length) {
        scheduleAdminUsersTableRender('incremental');
        return;
    }

    const previousByLogin = new Map();
    previousRevocations.forEach((accessRevocation) => {
        const login = normalizeLogin(accessRevocation?.login || '');
        if (isValidLogin(login)) {
            previousByLogin.set(login, accessRevocation);
        }
    });
    const nextByLogin = new Map();
    nextRevocations.forEach((accessRevocation) => {
        const login = normalizeLogin(accessRevocation?.login || '');
        if (isValidLogin(login)) {
            nextByLogin.set(login, accessRevocation);
        }
    });

    if (previousByLogin.size !== nextByLogin.size) {
        scheduleAdminUsersTableRender('incremental');
        return;
    }

    let hasChanges = false;
    for (const [login, nextAccessRevocation] of nextByLogin.entries()) {
        const previousAccessRevocation = previousByLogin.get(login);
        const row = adminUserRowsByLogin.get(login);
        if (!previousAccessRevocation || !row?._adminData) {
            scheduleAdminUsersTableRender('incremental');
            return;
        }
        if (buildAdminRealtimeRevocationRenderKey(previousAccessRevocation) !== buildAdminRealtimeRevocationRenderKey(nextAccessRevocation)) {
            hasChanges = true;
        }
    }

    if (!hasChanges) return;

    nextByLogin.forEach((nextAccessRevocation, login) => {
        const row = adminUserRowsByLogin.get(login);
        if (!row?._adminData) return;
        row._adminData.accessRevocation = nextAccessRevocation;
        row._adminData.accessState = getAccessState(
            login,
            row._adminData.user,
            row._adminData.invite,
            nextAccessRevocation
        );
        updateAdminUsersTableRow(row, row._adminData);
    });
}

function applyAdminRealtimePresenceSnapshot(raw) {
    const previousPresence = Array.isArray(adminRealtimePresence) ? adminRealtimePresence : [];
    adminRealtimePresence = Object.values(raw || {})
        .map((item) => normalizeUserPresence(item))
        .filter(Boolean);
    adminRealtimePresenceByLogin = buildLoginIndexedMap(adminRealtimePresence);
    markAdminRealtimeTableDataReadyIfPossible();

    if (!isSettingsModalOpen() || !isAdmin()) return;
    if (!adminUsersTableInitialized || !adminUserRowsByLogin.size) {
        scheduleAdminUsersTableRender('incremental');
        return;
    }

    const previousByLogin = new Map();
    previousPresence.forEach((item) => {
        const login = normalizeLogin(item?.login || '');
        if (isValidLogin(login)) {
            previousByLogin.set(login, item);
        }
    });
    const presenceByLogin = new Map();
    adminRealtimePresence.forEach((item) => {
        const login = normalizeLogin(item?.login || '');
        if (isValidLogin(login)) {
            presenceByLogin.set(login, item);
        }
    });

    const changedLogins = new Set();
    adminUserRowsByLogin.forEach((row, login) => {
        if (!row?._adminData) return;
        const previousPresenceForLogin = previousByLogin.get(login) || null;
        const nextPresenceForLogin = presenceByLogin.get(login) || null;
        if (buildAdminRealtimePresenceRenderKey(previousPresenceForLogin) === buildAdminRealtimePresenceRenderKey(nextPresenceForLogin)) {
            return;
        }
        row._adminData.presence = nextPresenceForLogin;
        changedLogins.add(login);
    });

    if (!changedLogins.size) return;
    changedLogins.forEach((login) => {
        refreshAdminUserPresenceLabel(login);
    });
}

function refreshAdminUsersTableAfterMutation() {
    if (!isSettingsModalOpen() || !isAdmin()) return;
    if (db && adminRealtimeUnsubscribes.length > 0) {
        scheduleAdminUsersTableRender('incremental');
        return;
    }
    void renderAdminUsersTable();
}

function startAdminRealtimeSync() {
    if (!db || adminRealtimeUnsubscribes.length > 0 || !isSettingsModalOpen() || !isAdmin()) return false;
    clearAdminRealtimeSyncRecovery();

    adminRealtimeUnsubscribes = [
        onValue(
            ref(db, AUTH_USERS_DB_PATH),
            (snapshot) => {
                applyAdminRealtimeUsersSnapshot(snapshot.val());
            },
            (error) => {
                handleAdminRealtimeSyncFailure('users', error);
            }
        ),
        onValue(
            ref(db, PARTNER_INVITES_DB_PATH),
            (snapshot) => {
                applyAdminRealtimeInvitesSnapshot(snapshot.val());
            },
            (error) => {
                handleAdminRealtimeSyncFailure('invites', error);
            }
        ),
        onValue(
            ref(db, ACCESS_REVOKE_DB_PATH),
            (snapshot) => {
                applyAdminRealtimeRevocationsSnapshot(snapshot.val());
            },
            (error) => {
                handleAdminRealtimeSyncFailure('revocations', error);
            }
        ),
        onValue(
            ref(db, USER_PRESENCE_DB_PATH),
            (snapshot) => {
                applyAdminRealtimePresenceSnapshot(snapshot.val());
            },
            (error) => {
                handleAdminRealtimeSyncFailure('presence', error);
            }
        )
    ];
    adminStatusRefreshTimerId = setInterval(() => {
        if (!isSettingsModalOpen() || !isAdmin()) {
            stopAdminRealtimeSync();
            return;
        }
        refreshAdminUsersPresenceLabels();
    }, ADMIN_PRESENCE_RELATIVE_LABEL_REFRESH_MS);
    return true;
}

function buildLoginIndexedMap(items = []) {
    const indexed = new Map();
    items.forEach((item) => {
        const login = normalizeLogin(item?.login || '');
        if (isValidLogin(login)) {
            indexed.set(login, item);
        }
    });
    return indexed;
}

function buildAdminUsersSortedLogins(
    usersByLogin = new Map(),
    invitesByLogin = new Map(),
    revocationsByLogin = new Map()
) {
    return Array.from(new Set([
        ...usersByLogin.keys(),
        ...invitesByLogin.keys(),
        ...revocationsByLogin.keys()
    ])).filter((login) => {
        const user = usersByLogin.get(login) || null;
        const invite = invitesByLogin.get(login) || null;
        const accessRevocation = revocationsByLogin.get(login) || null;
        if (user || invite) return true;
        return !isAccessRevokedForLogin(accessRevocation, login);
    }).sort((a, b) => a.localeCompare(b));
}

function rebuildAdminRealtimeSortedLogins() {
    adminRealtimeSortedLogins = buildAdminUsersSortedLogins(
        adminRealtimeUsersByLogin || new Map(),
        adminRealtimeInvitesByLogin || new Map(),
        adminRealtimeRevocationsByLogin || new Map()
    );
}

function buildAdminUsersTableRows(users, invites, revocations, presenceEntries) {
    return buildAdminUsersTableRowsFromMaps(
        buildLoginIndexedMap(users),
        buildLoginIndexedMap(invites),
        buildLoginIndexedMap(revocations),
        buildLoginIndexedMap(presenceEntries)
    );
}

function buildAdminUsersTableRowsFromMaps(
    usersByLogin = new Map(),
    invitesByLogin = new Map(),
    revocationsByLogin = new Map(),
    presenceByLogin = new Map(),
    sortedLogins = null
) {
    const orderedLogins = Array.isArray(sortedLogins)
        ? sortedLogins
        : buildAdminUsersSortedLogins(usersByLogin, invitesByLogin, revocationsByLogin);
    return orderedLogins.map((login) => {
        const user = usersByLogin.get(login) || null;
        const invite = invitesByLogin.get(login) || null;
        const accessRevocation = revocationsByLogin.get(login) || null;
        const presence = presenceByLogin.get(login) || null;
        return {
            login,
            user,
            invite,
            accessRevocation,
            presence,
            accessState: getAccessState(login, user, invite, accessRevocation)
        };
    });
}

function setAdminUsersTableEmptyState(text) {
    resetAdminUsersTableDomState();
    if (!adminUsersTableBody) return;
    const row = document.createElement('tr');
    row.className = 'admin-empty-row';
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.className = 'admin-empty';
    cell.textContent = text;
    row.appendChild(cell);
    adminUsersTableBody.appendChild(row);
}

function createAdminUsersTableRow(login) {
    const row = document.createElement('tr');
    row.dataset.login = login;

    const loginCell = document.createElement('td');
    const roleCell = document.createElement('td');
    const sourceCell = document.createElement('td');
    sourceCell.className = 'admin-access-source';
    const timeCell = document.createElement('td');
    timeCell.className = 'admin-time';
    const statusCell = document.createElement('td');
    const statusMain = document.createElement('div');
    statusMain.className = 'admin-status-main';
    const presenceText = document.createElement('div');
    statusCell.appendChild(statusMain);
    statusCell.appendChild(presenceText);
    const actionCell = document.createElement('td');
    const actionBtn = document.createElement('button');
    actionBtn.addEventListener('click', async () => {
        const rowData = row._adminData;
        if (!rowData) return;
        const nextActive = !rowData.accessState.active;
        if (!nextActive) {
            const confirmed = confirm(`Закрыть доступ для ${rowData.login}?`);
            if (!confirmed) return;
        }
        actionBtn.disabled = true;
        try {
            await toggleAccessForLogin(
                rowData.login,
                nextActive,
                rowData.user,
                rowData.invite,
                rowData.accessRevocation
            );
            showCopyNotification(nextActive ? `Доступ открыт: ${rowData.login}` : `Доступ закрыт: ${rowData.login}`);
            refreshAdminUsersTableAfterMutation();
        } catch (error) {
            console.error('Failed to toggle access:', error);
            const fallback = error?.message ? String(error.message) : 'Не удалось изменить доступ';
            showCopyNotification(fallback);
        } finally {
            actionBtn.disabled = false;
        }
    });
    actionCell.appendChild(actionBtn);

    row._adminCells = {
        loginCell,
        roleCell,
        sourceCell,
        timeCell,
        statusCell,
        statusMain,
        presenceText,
        actionCell,
        actionBtn
    };

    row.appendChild(loginCell);
    row.appendChild(roleCell);
    row.appendChild(sourceCell);
    row.appendChild(timeCell);
    row.appendChild(statusCell);
    row.appendChild(actionCell);

    adminUserRowsByLogin.set(login, row);
    return row;
}

function updateAdminUsersTableRow(row, rowData) {
    row._adminData = rowData;
    row.dataset.login = rowData.login;
    const {
        loginCell,
        roleCell,
        sourceCell,
        timeCell,
        statusCell,
        statusMain,
        presenceText,
        actionBtn
    } = row._adminCells;

    loginCell.textContent = rowData.login;

    if (rowData.user) {
        if (!row._adminRoleSelect) {
            const roleSelect = document.createElement('select');
            roleSelect.className = 'admin-role-select';
            roleSelect.innerHTML = `
                <option value="user">Юзер</option>
                <option value="admin">Админ</option>
            `;
            roleSelect.addEventListener('change', async () => {
                const currentRowData = row._adminData;
                if (!currentRowData?.user) return;
                const nextRole = normalizeRole(roleSelect.value);
                roleSelect.disabled = true;
                try {
                    await patchUserRecord(currentRowData.user.login, {
                        role: nextRole,
                        lastSeenAt: new Date().toISOString()
                    });

                    if (currentUser && currentRowData.user.login === currentUser.login) {
                        const previousCurrentUserRole = normalizeRole(currentUser.role);
                        currentUser.role = nextRole;
                        syncSelectedRole(nextRole);
                        void ensureCurrentUserAccessMirror(currentUser);
                        if (previousCurrentUserRole !== nextRole) {
                            syncCurrentUserSettingsState();
                            syncCurrentUserPresenceState(true);
                        }
                        applyRoleRestrictions();
                    }
                    showCopyNotification(`Роль ${currentRowData.user.login} обновлена`);
                    refreshAdminUsersTableAfterMutation();
                } finally {
                    roleSelect.disabled = false;
                }
            });
            row._adminRoleSelect = roleSelect;
        }
        roleCell.className = '';
        row._adminRoleSelect.value = normalizeRole(rowData.user.role);
        roleCell.replaceChildren(row._adminRoleSelect);
    } else {
        roleCell.replaceChildren();
        roleCell.className = 'admin-muted';
        roleCell.textContent = '—';
    }

    sourceCell.textContent = getAccessSourceLabel(rowData.login, rowData.user, rowData.invite, rowData.accessRevocation);
    timeCell.textContent = rowData.user ? formatActiveTime(rowData.user.activeMs) : '—';

    statusCell.className = `admin-access-status ${rowData.accessState.active ? 'is-active' : 'is-blocked'}`;
    statusMain.textContent = rowData.accessState.label;
    const presenceMeta = getAdminPresenceMeta(rowData.login, rowData.user, rowData.presence);
    presenceText.className = `admin-presence ${presenceMeta.className}`.trim();
    presenceText.textContent = presenceMeta.label;

    actionBtn.className = `btn-change ${rowData.accessState.active ? 'btn-danger-subtle' : ''}`.trim();
    actionBtn.textContent = rowData.accessState.active ? 'Закрыть доступ' : 'Открыть доступ';
}

async function renderAdminUsersTable() {
    if (!adminPanel || !adminUsersTableBody) return;
    if (adminUsersTableRenderInProgress) return;

    if (!isSettingsModalOpen()) {
        stopAdminRealtimeSync();
        return;
    }

    if (!isAdmin()) {
        stopAdminRealtimeSync();
        setAdminUsersTableEmptyState('Нет прав администратора для просмотра списка пользователей.');
        adminUsersTableInitialized = true;
        if (adminPanelAccordion) {
            adminPanelAccordion.style.display = 'none';
            adminPanelAccordion.removeAttribute('open');
        }
        return;
    }

    if (adminPanelAccordion) {
        adminPanelAccordion.style.display = '';
    }
    if (!adminUsersTableInitialized) {
        setAdminUsersTableEmptyState('Загрузка...');
    }

    if (adminUsersTableRenderWatchdogTimer) {
        clearTimeout(adminUsersTableRenderWatchdogTimer);
        adminUsersTableRenderWatchdogTimer = null;
    }
    adminUsersTableRenderWatchdogTimer = setTimeout(() => {
        if (!adminUsersTableInitialized && adminUsersTableBody) {
            setAdminUsersTableEmptyState('Не удалось загрузить таблицу пользователей. Проверьте подключение к Firebase и обновите страницу.');
            adminUsersTableInitialized = true;
        }
    }, 15000);

    adminUsersTableRenderInProgress = true;
    try {
        const canReadUsers = await ensureCurrentUserAccessMirror();
        if (!canReadUsers && !db) {
            setAdminUsersTableEmptyState('Не удалось синхронизировать права доступа Firebase. Проверьте подключение к интернету или войдите повторно.');
            adminUsersTableInitialized = true;
            return;
        }

        startAdminRealtimeSync();

        let liveDataReady = hasAdminRealtimeTableData();
        if (!liveDataReady && db && adminRealtimeUnsubscribes.length > 0) {
            liveDataReady = await waitForAdminRealtimeTableData(ADMIN_REALTIME_INITIAL_DATA_WAIT_MS);
        }
        const [users, invites, revocations, presenceEntries] = liveDataReady
            ? [null, null, null, null]
            : await Promise.all([
                listAllUserRecords().catch((error) => {
                    console.warn('Failed to load users for admin table, using fallback:', error);
                    return [];
                }),
                listPartnerInvites().catch(() => []),
                listAccessRevocations().catch(() => []),
                Promise.resolve([])
            ]);

        let rowsData = liveDataReady
            ? buildAdminUsersTableRowsFromMaps(
                adminRealtimeUsersByLogin || buildLoginIndexedMap(Array.isArray(adminRealtimeUsers) ? adminRealtimeUsers : []),
                adminRealtimeInvitesByLogin || buildLoginIndexedMap(Array.isArray(adminRealtimeInvites) ? adminRealtimeInvites : []),
                adminRealtimeRevocationsByLogin || buildLoginIndexedMap(Array.isArray(adminRealtimeRevocations) ? adminRealtimeRevocations : []),
                adminRealtimePresenceByLogin || buildLoginIndexedMap(Array.isArray(adminRealtimePresence) ? adminRealtimePresence : []),
                adminRealtimeSortedLogins
            )
            : buildAdminUsersTableRows(users, invites, revocations, presenceEntries);
        if (!rowsData.length) {
            rowsData = getAdminUsersTableFallbackRows();
        }

        if (!rowsData.length) {
            const isEmailVerified = !!auth?.currentUser?.emailVerified;
            const hint = isEmailVerified
                ? 'Пользователи не найдены или нет доступа к таблице. Проверьте права админа или обновите Firebase Security Rules.'
                : 'Проверьте подтверждение email в Firebase Auth (email не подтверждён), затем обновите страницу.';
            setAdminUsersTableEmptyState(hint);
            adminUsersTableInitialized = true;
            return;
        }

        applyAdminUsersTableRows(rowsData);
    } catch (error) {
        console.error('Failed to render admin users table:', error);
        setAdminUsersTableEmptyState('Ошибка загрузки таблицы пользователей. Проверьте права доступа Firebase и актуальность сессии.');
        adminUsersTableInitialized = true;
    } finally {
        if (adminUsersTableRenderWatchdogTimer) {
            clearTimeout(adminUsersTableRenderWatchdogTimer);
            adminUsersTableRenderWatchdogTimer = null;
        }
        adminUsersTableRenderInProgress = false;
    }
}

function updateAdminUserTimeCell(login, activeMs) {
    const normalizedLogin = normalizeLogin(login);
    if (!normalizedLogin) return;
    const row = adminUserRowsByLogin.get(normalizedLogin);
    if (!row) return;
    const timeCell = row._adminCells?.timeCell;
    if (!timeCell) return;
    timeCell.textContent = formatActiveTime(activeMs);
}

async function handleCreatePartnerInvite() {
    if (!isAdmin()) return;
    const login = normalizeLogin(partnerInviteEmailInput?.value || '');
    const role = 'user';
    const days = Math.max(1, Math.min(365, Number(partnerInviteDaysInput?.value || 30) || 30));

    if (!isValidLogin(login)) {
        showCopyNotification('Укажите корректный email');
        partnerInviteEmailInput?.focus();
        return;
    }
    if (isCorporateEmail(login)) {
        showCopyNotification('Для корпоративной почты инвайт не нужен');
        return;
    }

    const expiresAtDate = new Date();
    expiresAtDate.setDate(expiresAtDate.getDate() + days);
    const expiresAt = expiresAtDate.toISOString();

    if (partnerInviteCreateInFlight) return;
    partnerInviteCreateInFlight = true;
    if (partnerInviteAddBtn) partnerInviteAddBtn.disabled = true;
    try {
        await sendMagicLinkToEmail(login, 'invite');

        await setAccessRevocation(login, false, {
            updatedBy: currentUser?.login || ''
        });

        const existingUser = await getUserRecordByLogin(login);
        if (existingUser && existingUser.role !== 'admin') {
            await patchUserRecord(login, {
                isBlocked: false,
                blockedReason: null,
                blockedAt: null,
                failedLoginAttempts: 0,
                failedLoginBackoffUntil: null,
                sessionRevokedAt: null,
                lastSeenAt: new Date().toISOString()
            });
        }

        await savePartnerInvite({
            login,
            role,
            status: 'active',
            expiresAt,
            emailVerifiedAt: null,
            createdAt: new Date().toISOString(),
            createdBy: currentUser?.login || ''
        });

        if (existingUser && existingUser.role !== 'admin') {
            await patchUserRecord(login, { role });
        }

        showCopyNotification(`Ссылка отправлена на ${login}`);
        if (partnerInviteEmailInput) partnerInviteEmailInput.value = '';
        refreshAdminUsersTableAfterMutation();
    } catch (error) {
        console.error('Failed to send partner invite link:', error);
        showCopyNotification(`Письмо не отправлено. ${getReadableFirebaseAuthError(error, 'invite')}`);
    } finally {
        partnerInviteCreateInFlight = false;
        if (partnerInviteAddBtn) partnerInviteAddBtn.disabled = false;
    }
}

async function handleAuthSubmit() {
    if (!modalNameSubmit) return;
    setAuthMailHelpVisible(false);
    const fio = normalizeFio(modalNameInput?.value || '');
    const login = normalizeLogin(modalLoginInput?.value || '');
    const password = String(modalPasswordInput?.value || '');

    if (!isValidFio(fio)) {
        setAuthError('Введите полное ФИО (минимум 2 слова).');
        modalNameInput?.focus();
        return;
    }
    if (!isValidLogin(login)) {
        setAuthError('Введите корректный email.');
        modalLoginInput?.focus();
        return;
    }
    if (!isValidPassword(password)) {
        setAuthError('Пароль должен содержать минимум 6 символов.');
        modalPasswordInput?.focus();
        return;
    }

    setAuthError('');
    setAuthSubmitState(true, 'Проверяем данные...');

    try {
        const didVerifyEmailLinkNow = await runAuthStep(
            'Проверяем ссылку...',
            () => consumePendingEmailSignInLinkForLogin(login),
            AUTH_FLOW_STEP_TIMEOUT_MS,
            'Не удалось проверить ссылку подтверждения. Попробуйте ещё раз.'
        );
        const authReady = getEmailLinkAuthReady(login);
        let existingUser = await runAuthStep(
            'Проверяем аккаунт...',
            () => getUserRecordByLogin(login),
            AUTH_FLOW_STEP_TIMEOUT_MS,
            'Не удалось проверить аккаунт. Попробуйте ещё раз.'
        );
        const accessPolicy = await runAuthStep(
            'Проверяем доступ...',
            () => resolveAccessPolicy(login, existingUser),
            AUTH_FLOW_STEP_TIMEOUT_MS,
            'Не удалось проверить доступ. Попробуйте ещё раз.'
        );
        if (!accessPolicy || accessPolicy.decision !== 'allow') {
            const deniedMessage = resolveAccessPolicyDecisionMessage(accessPolicy);
            applySessionPolicy(accessPolicy || { decision: 'deny', reason: ACCESS_CONTROL_DECISION_REASON.NOT_FOUND }, {
                userLogin: login,
                onDeny: () => setAuthError(deniedMessage || 'Доступ запрещён.')
            });
            throw new Error(deniedMessage || 'Доступ запрещён.');
        }

        const backoffUntil = getFailedLoginBackoffState(existingUser || null);
        if (backoffUntil) {
            const waitSeconds = Math.max(1, Math.ceil((backoffUntil - Date.now()) / 1000));
            throw new Error(`Слишком много попыток. Подождите ${waitSeconds} сек перед новой попыткой.`);
        }
        if (existingUser?.failedLoginBackoffUntil) {
            await patchUserRecord(login, {
                failedLoginBackoffUntil: null
            });
        }

        const nowIso = new Date().toISOString();
        const passwordValid = async () => {
            if (!existingUser || !existingUser.passwordHash) {
                return !existingUser;
            }
            return verifyPasswordHash(login, password, existingUser.passwordHash);
        };

        const emailLinkVerifiedHint = getEmailLinkVerifiedHint();
        const hasEmailLinkVerification = didVerifyEmailLinkNow || !!authReady || (!!emailLinkVerifiedHint &&
            emailLinkVerifiedHint.login === login &&
            (emailLinkVerifiedHint.action === 'invite' || emailLinkVerifiedHint.action === 'verify'));
        let shouldMarkInviteAsVerifiedFromHint = false;
        let targetUser = null;

        if (existingUser) {
            const existingIsVerified = !!existingUser.emailVerifiedAt;
            const passwordNeedsSetup = existingIsVerified && isPendingFirstPasswordSetup(existingUser);
            const canSetPasswordAfterLink = existingIsVerified && hasEmailLinkVerification;
            const shouldVerifyPassword = !passwordNeedsSetup && !canSetPasswordAfterLink;
            const isPasswordValid = shouldVerifyPassword ? await passwordValid() : true;
            const localhostLocalUser = isLocalhostAdminPreviewHost() ? getLocalUserRecordByLogin(login) : null;
            const canUseLocalhostPasswordFallback = shouldVerifyPassword &&
                !isPasswordValid &&
                !!localhostLocalUser?.passwordHash &&
                await verifyPasswordHash(login, password, localhostLocalUser.passwordHash);

            if (canUseLocalhostPasswordFallback) {
                existingUser = normalizeUserRecord({
                    ...existingUser,
                    ...localhostLocalUser,
                    login,
                    fio,
                    role: existingUser.role === 'admin'
                        ? 'admin'
                        : normalizeRole(accessPolicy.role || localhostLocalUser.role || existingUser.role),
                    emailVerifiedAt: existingUser.emailVerifiedAt || localhostLocalUser.emailVerifiedAt || null,
                    sessionRevokedAt: existingUser.sessionRevokedAt || localhostLocalUser.sessionRevokedAt || null
                }, login) || existingUser;
            }

            if (shouldVerifyPassword && !isPasswordValid && !canUseLocalhostPasswordFallback) {
                const failedAttempts = Math.max(0, Number(existingUser.failedLoginAttempts) || 0) + 1;
                const shouldBlock = failedAttempts >= MAX_FAILED_PASSWORD_ATTEMPTS;
                const backoffMs = shouldBlock ? null : computeFailedLoginBackoffMs(failedAttempts);
                const backoffUntilAt = backoffMs ? new Date(nowIso).getTime() + backoffMs : null;
                await runAuthStep(
                    'Сохраняем попытку...',
                    () => patchUserRecord(login, {
                        failedLoginAttempts: failedAttempts,
                        isBlocked: shouldBlock,
                        blockedAt: shouldBlock ? nowIso : null,
                        blockedReason: shouldBlock ? 'failed_attempts' : null,
                        failedLoginBackoffUntil: backoffUntilAt ? new Date(backoffUntilAt).toISOString() : null,
                        lastSeenAt: nowIso
                    }),
                    AUTH_FLOW_STEP_TIMEOUT_MS,
                    'Не удалось сохранить попытку входа. Попробуйте ещё раз.'
                );

                if (shouldBlock) {
                    throw new Error('Сайт заблокирован для этого аккаунта после 15 неверных попыток ввода пароля. Обратитесь к администратору.');
                }

                const attemptsLeft = Math.max(0, MAX_FAILED_PASSWORD_ATTEMPTS - failedAttempts);
                const nextWait = backoffMs ? Math.max(1, Math.ceil(backoffMs / 1000)) : 0;
                const waitHint = nextWait ? ` Подождите ${nextWait} сек.` : '';
                throw new Error(`Неверный логин или пароль. Осталось попыток до блокировки: ${attemptsLeft}.${waitHint}`);
            }

            let nextPasswordHash = existingUser.passwordHash;
            const needsPasswordMigration = isPasswordHashNeedsMigration(existingUser.passwordHash);
            if (needsPasswordMigration || passwordNeedsSetup || canSetPasswordAfterLink) {
                nextPasswordHash = await hashPassword(login, password);
            }

            const resolvedRole = existingUser.role === 'admin'
                ? 'admin'
                : normalizeRole(accessPolicy.role || existingUser.role);
            let verifiedAt = existingUser.emailVerifiedAt || accessPolicy?.invite?.emailVerifiedAt || null;
            if (!verifiedAt && hasEmailLinkVerification) {
                verifiedAt = nowIso;
                shouldMarkInviteAsVerifiedFromHint = true;
            }
            targetUser = {
                ...existingUser,
                role: resolvedRole,
                fio,
                passwordHash: nextPasswordHash,
                passwordNeedsSetup: false,
                emailVerifiedAt: verifiedAt,
                failedLoginAttempts: 0,
                isBlocked: false,
                blockedAt: null,
                blockedReason: null,
                failedLoginBackoffUntil: null,
                passwordHashScheme: needsPasswordMigration ? PASSWORD_HASH_FORMAT_PREFIX : existingUser.passwordHashScheme || PASSWORD_HASH_FORMAT_PREFIX,
                sessionRevokedAt: null,
                lastLoginAt: nowIso,
                lastSeenAt: nowIso
            };
        } else {
            const passwordHash = await hashPassword(login, password);
            const resolvedRole = normalizeRole(accessPolicy.role || 'user');
            let verifiedAt = accessPolicy?.invite?.emailVerifiedAt || null;
            if (!verifiedAt && hasEmailLinkVerification) {
                verifiedAt = nowIso;
                shouldMarkInviteAsVerifiedFromHint = true;
            }
            targetUser = {
                login,
                fio,
                role: resolvedRole,
                passwordHash,
                passwordNeedsSetup: false,
                emailVerifiedAt: verifiedAt,
                emailVerificationSentAt: null,
                failedLoginAttempts: 0,
                isBlocked: false,
                blockedReason: null,
                failedLoginBackoffUntil: null,
                blockedAt: null,
                passwordHashScheme: PASSWORD_HASH_FORMAT_PREFIX,
                sessionRevokedAt: null,
                activeMs: 0,
                createdAt: nowIso,
                lastLoginAt: nowIso,
                lastSeenAt: nowIso
            };
        }

        await runAuthStep(
            'Открываем Firebase-сессию...',
            () => ensureFirebaseAuthPasswordSession(login, password),
            AUTH_FLOW_STEP_TIMEOUT_MS,
            'Не удалось открыть Firebase-сессию. Проверьте Email/Password в Firebase Authentication и повторите вход.'
        );

        let savedUser = await runAuthStep(
            'Сохраняем аккаунт...',
            () => saveUserRecord(targetUser, { requireRemote: true }),
            AUTH_FLOW_STEP_TIMEOUT_MS,
            'Не удалось сохранить аккаунт в Firebase. Проверьте RTDB Rules и повторите вход.'
        );
        if (shouldMarkInviteAsVerifiedFromHint && accessPolicy?.invite) {
            await runAuthStep(
                'Обновляем приглашение...',
                () => patchPartnerInvite(login, {
                    emailVerifiedAt: nowIso
                }, { requireRemote: true }),
                AUTH_FLOW_STEP_TIMEOUT_MS,
                'Не удалось обновить приглашение. Попробуйте ещё раз.'
            );
        }

        const isVerified = !!savedUser.emailVerifiedAt;
        if (!isVerified) {
            await runAuthStep(
                'Отправляем письмо...',
                () => sendMagicLinkToEmail(login, 'verify'),
                AUTH_MAGIC_LINK_SEND_TIMEOUT_MS,
                'Не удалось отправить письмо подтверждения. Попробуйте ещё раз.'
            );
            savedUser = await runAuthStep(
                'Фиксируем письмо...',
                () => patchUserRecord(login, {
                    emailVerificationSentAt: nowIso
                }, { requireRemote: true }),
                AUTH_FLOW_STEP_TIMEOUT_MS,
                'Письмо отправлено, но не удалось сохранить статус отправки в Firebase. Проверьте RTDB Rules.'
            ) || savedUser;
            setAuthError('Мы отправили ссылку подтверждения на email. Откройте письмо и повторите вход.');
            setAuthMailHelpVisible(true);
            return;
        }

        setAuthSubmitState(true, 'Входим...');
        await runAuthStep(
            'Подключаем промпты...',
            () => refreshProtectedFirebaseDataAfterAuth(),
            AUTH_FLOW_STEP_TIMEOUT_MS,
            'Firebase-сессия открыта, но не удалось заново подключить промпты. Обновите страницу и повторите вход.'
        );
        setAuthSession(savedUser.login);
        applyAuthenticatedUser(savedUser);
        await runAuthStep(
            'Синхронизируем доступ...',
            () => ensureCurrentUserAccessMirror(savedUser, { requireRemote: true }),
            AUTH_FLOW_STEP_TIMEOUT_MS,
            'Firebase-сессия открыта, но не удалось записать access mirror. Проверьте RTDB Rules.'
        );
        await replayActiveTimeCarryover();
        clearEmailLinkAuthReady();
        clearEmailLinkHint();
        clearEmailLinkVerifiedHint();
        hideNameModal();
        startActiveTimeTracking();
    } catch (error) {
        console.error('Auth error:', error);
        setAuthError(getReadableFirebaseAuthError(error, 'login'));
    } finally {
        setAuthSubmitState(false);
    }
}

async function restoreAuthSession() {
    const restoreAttemptId = ++activeAuthRestoreAttemptId;
    const isStaleRestoreAttempt = () => restoreAttemptId !== activeAuthRestoreAttemptId;
    const session = getAuthSession();
    if (!session?.login) return false;
    if (isLocalhostDevBypassSession(session)) {
        const localUser = getLocalhostDevAuthUserByLogin(session.login) || getLocalUserRecordByLogin(session.login);
        if (!localUser) {
            clearAuthSession();
            clearAuthCacheIdentity();
            return false;
        }
        if (isStaleRestoreAttempt()) return false;
        applyAuthenticatedUser(localUser);
        hideNameModal();
        startActiveTimeTracking();
        return true;
    }

    await waitForFirebaseAuthReady();
    if (isStaleRestoreAttempt()) return false;
    if (!hasFirebaseAuthSessionForLogin(session.login)) {
        stopProtectedRealtimeListeners();
        clearAuthSession();
        clearAuthCacheIdentity();
        pendingAuthRestoreMessage = 'Сессия устарела после обновления. Войдите ещё раз, чтобы заново открыть доступ к промптам.';
        return false;
    }

    const user = await getUserRecordByLogin(session.login);
    if (isStaleRestoreAttempt()) return false;
    if (!user) {
        clearAuthSession();
        return false;
    }
    if (isSessionRevokedForSignedAt(session.signedAt, user.sessionRevokedAt)) {
        clearAuthSession();
        return false;
    }
    const accessDecision = await resolveAccessPolicy(user.login, user);
    if (!accessDecision || accessDecision.decision !== 'allow') {
        applySessionPolicy(accessDecision, {
            userLogin: user.login
        });
        return false;
    }
    if (user.passwordNeedsSetup) {
        clearAuthSession();
        clearAuthCacheIdentity();
        return false;
    }
    const verifiedAt = user.emailVerifiedAt || accessDecision?.invite?.emailVerifiedAt || null;
    if (!verifiedAt) {
        clearAuthSession();
        clearAuthCacheIdentity();
        return false;
    }
    if (user.role !== 'admin') {
        user.role = normalizeRole(accessDecision.role || user.role);
    }
    user.emailVerifiedAt = verifiedAt;
    if (isStaleRestoreAttempt()) return false;
    applyAuthenticatedUser(user);
    await replayActiveTimeCarryover();
    startActiveTimeTracking();
    return true;
}

// Check if current user is admin
function isAdmin() {
    return canUseAdminPreviewControls() && normalizeRole(selectedRole || 'user') === 'admin';
}

function getAdminPreviewModeLabel(role = selectedRole) {
    return normalizeRole(role) === 'admin' ? 'Вид: админ' : 'Вид: клиент';
}

function getAdminPreviewModeTitle(role = selectedRole) {
    return normalizeRole(role) === 'admin'
        ? 'Переключить на клиентский вид'
        : 'Вернуться в админский вид';
}

function syncAdminPreviewToggle(roleOverride = null) {
    if (!adminPreviewToggleBtn) return;
    if (!canUseAdminPreviewControls()) {
        adminPreviewToggleBtn.hidden = true;
        adminPreviewToggleBtn.setAttribute('aria-hidden', 'true');
        adminPreviewToggleBtn.disabled = true;
        adminPreviewToggleBtn.dataset.mode = 'hidden';
        return;
    }
    const resolvedRole = normalizeRole(
        roleOverride || selectedRole || getCachedStorageValue(USER_ROLE_KEY, 'admin') || currentUser?.role || 'admin'
    );
    adminPreviewToggleBtn.hidden = false;
    adminPreviewToggleBtn.setAttribute('aria-hidden', 'false');
    adminPreviewToggleBtn.disabled = false;
    adminPreviewToggleBtn.dataset.mode = resolvedRole;
    adminPreviewToggleBtn.textContent = getAdminPreviewModeLabel(resolvedRole);
    adminPreviewToggleBtn.title = getAdminPreviewModeTitle(resolvedRole);
}

function ensureRoleChangeButtonVisible(roleOverride = null) {
    if (!changeRoleBtn) return;
    if (!canUseAdminPreviewControls()) {
        changeRoleBtn.style.display = 'none';
        changeRoleBtn.style.visibility = 'hidden';
        changeRoleBtn.disabled = true;
        return;
    }
    const resolvedRole = normalizeRole(
        roleOverride || selectedRole || getCachedStorageValue(USER_ROLE_KEY, 'admin') || currentUser?.role || 'admin'
    );
    changeRoleBtn.style.display = 'inline-flex';
    changeRoleBtn.style.visibility = 'visible';
    changeRoleBtn.disabled = false;
    changeRoleBtn.textContent = resolvedRole === 'admin'
        ? 'Показать как клиент'
        : 'Вернуться в админский вид';
}

function ensureLocalhostDevPreviewSession() {
    if (!isLocalhostAdminPreviewHost() || !currentUser || hasAdminAccount(currentUser) || isLocalhostDevBypassSession()) {
        return false;
    }

    const nowIso = new Date().toISOString();
    const localUser = saveLocalhostDevAuthUser({
        ...currentUser,
        role: 'user',
        emailVerifiedAt: currentUser.emailVerifiedAt || nowIso,
        lastLoginAt: currentUser.lastLoginAt || nowIso,
        lastSeenAt: nowIso
    });
    saveUserRecordToLocalCache(localUser);
    setAuthSession(localUser.login, { devBypass: true });
    applyAuthenticatedUser(localUser);
    return true;
}

// Apply role-based restrictions
function applyRoleRestrictions() {
    const isAdminUser = isAdmin();
    const promptTextareas = document.querySelectorAll('.prompt-editor');
    const previewElements = document.querySelectorAll('.prompt-preview');
    const toolbarBtns = document.querySelectorAll('.toolbar-btn');
    const toolbarDividers = document.querySelectorAll('.toolbar-divider');

    document.body.classList.toggle('user-mode', !isAdminUser);
    ensureRoleChangeButtonVisible();
    
    if (!isAdminUser) {
        debugLog('User mode: Prompts are read-only');
        
        // Disable all prompt textareas
        promptTextareas.forEach(textarea => {
            textarea.setAttribute('readonly', 'true');
            textarea.style.cursor = 'default';
            textarea.style.backgroundColor = '#1a1a1a';
        });
        
        // Disable all WYSIWYG preview editing
        previewElements.forEach(preview => {
            preview.setAttribute('contenteditable', 'false');
            preview.style.cursor = 'default';
        });
        
        // Hide AI improvement button
        if (aiImproveBtn) {
            aiImproveBtn.style.display = 'none';
        }
        
        // Disable export current prompt button (or keep it enabled if you want users to export)
        // For now, let's keep it enabled
        
        // Hide format buttons and dividers in toolbar
        toolbarBtns.forEach(btn => {
            btn.style.display = 'none';
        });
        
        toolbarDividers.forEach(divider => {
            divider.style.display = 'none';
        });

        if (exportPromptSettings) {
            exportPromptSettings.style.display = 'none';
        }

        if (exitAttestationBtn) {
            exitAttestationBtn.style.display = '';
        }
        if (startAttestationBtn) {
            startAttestationBtn.style.display = isAttestationMode ? 'none' : '';
        }
        
    } else {
        debugLog('Admin mode: Full editing access');
        promptTextareas.forEach(textarea => {
            textarea.removeAttribute('readonly');
            textarea.style.cursor = '';
            textarea.style.backgroundColor = '';
        });
        previewElements.forEach(preview => {
            preview.setAttribute('contenteditable', 'true');
            preview.style.cursor = '';
        });
        toolbarBtns.forEach(btn => {
            btn.style.display = '';
        });
        toolbarDividers.forEach(divider => {
            divider.style.display = '';
        });
        if (aiImproveBtn) {
            aiImproveBtn.style.display = '';
        }
        if (exportPromptSettings) {
            exportPromptSettings.style.display = '';
        }
        if (exitAttestationBtn) {
            exitAttestationBtn.style.display = '';
        }
        if (startAttestationBtn) {
            startAttestationBtn.style.display = isAttestationMode ? 'none' : '';
        }
    }

    renderVariations();
    updateAllPreviews();
    updatePromptVisibilityButton();
    updatePromptHistoryButton();
    if (isAdminUser && isSettingsModalOpen()) {
        renderAdminUsersTable();
    } else if (adminPanelAccordion) {
        stopAdminRealtimeSync();
        adminPanelAccordion.style.display = 'none';
        adminPanelAccordion.removeAttribute('open');
    }
}

// Configure marked.js
if (typeof marked !== 'undefined') {
    marked.setOptions({
        breaks: true,
        gfm: true,
        highlight: function(code, lang) {
            if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
                try {
                    return hljs.highlight(code, { language: lang }).value;
                } catch (e) {}
            }
            return code;
        }
    });
}

// Configure Turndown
let turndownService = null;
if (typeof TurndownService !== 'undefined') {
    turndownService = new TurndownService({
        headingStyle: 'atx',
        hr: '---',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        emDelimiter: '*',
        strongDelimiter: '**'
    });
    // Disable escaping completely
    turndownService.escape = function(string) { return string; };
    
    // Better handling of bold text
    turndownService.addRule('strong', {
        filter: ['strong', 'b'],
        replacement: function(content) {
            if (!content.trim()) return '';
            return '**' + content + '**';
        }
    });
    
    turndownService.addRule('emphasis', {
        filter: ['em', 'i'],
        replacement: function(content) {
            if (!content.trim()) return '';
            return '*' + content + '*';
        }
    });
    
    turndownService.addRule('strikethrough', {
        filter: ['del', 's', 'strike'],
        replacement: function (content) { return '~~' + content + '~~'; }
    });
}

// Utility functions
function extractApiResponse(data) {
    if (typeof data === 'string') return data;
    const candidates = [
        data.response,
        data.message,
        data.output,
        data.text,
        data.rating
    ];
    const firstNonEmpty = candidates.find((value) => typeof value === 'string' && value.trim() !== '');
    if (firstNonEmpty) return firstNonEmpty;
    return '';
}

function normalizeConversationAction(rawAction) {
    if (!rawAction || typeof rawAction !== 'object' || Array.isArray(rawAction)) {
        return null;
    }
    const rawType = rawAction.type ?? rawAction.actionType ?? rawAction.action ?? '';
    const type = typeof rawType === 'string' ? rawType.trim().toLowerCase() : '';
    const normalizedType = type === LEGACY_WARN_EXIT_ACTION_TYPE
        ? CONVERSATION_ACTION_TYPE.GO_SILENT
        : type;
    if (normalizedType !== CONVERSATION_ACTION_TYPE.END && normalizedType !== CONVERSATION_ACTION_TYPE.GO_SILENT) {
        return null;
    }
    const rawReason = rawAction.reason ?? rawAction.code ?? '';
    const reason = typeof rawReason === 'string' ? rawReason.trim().toLowerCase() : '';
    const explicitShouldEvaluate = [rawAction.shouldEvaluate, rawAction.should_evaluate]
        .find((value) => typeof value === 'boolean');
    return {
        type: normalizedType,
        reason,
        shouldEvaluate: typeof explicitShouldEvaluate === 'boolean'
            ? explicitShouldEvaluate
            : normalizedType === CONVERSATION_ACTION_TYPE.END
    };
}

function buildClientConversationActionStateInstruction(actionState = null) {
    if (!actionState || typeof actionState !== 'object') return '';
    const normalizedType = String(actionState.type || '').trim().toLowerCase();
    if (normalizedType === CONVERSATION_ACTION_TYPE.GO_SILENT) {
        return `
ТЕКУЩЕЕ СОСТОЯНИЕ ДИАЛОГА
Клиент уже перестал отвечать, но его ещё можно вернуть.
Если новое сообщение менеджера снова не убеждает по цене, срокам, условиям или возражению, опять возвращай go_silent с пустым "message".
Если менеджер после этого уже явно сливает разговор, посылает, грубит, обесценивает запрос или прямо отказывает, переходи в end_conversation.
Если менеджер реально исправил ситуацию, можешь вернуться в обычный диалог.
        `.trim();
    }
    if (normalizedType === CONVERSATION_ACTION_TYPE.END) {
        return `
ТЕКУЩЕЕ СОСТОЯНИЕ ДИАЛОГА
Клиент уже завершил разговор. Не возвращайся в обычный диалог.
        `.trim();
    }
    return '';
}

function buildClientSystemPromptForWebhook(basePrompt, actionState = null) {
    const normalizedPrompt = String(basePrompt || '').trim();
    if (!normalizedPrompt) return '';
    const actionStateInstruction = buildClientConversationActionStateInstruction(actionState);
    const hiddenClientPrompt = getConfiguredClientConversationActionPrompt();
    return [
        normalizedPrompt,
        hiddenClientPrompt,
        actionStateInstruction
    ].filter(Boolean).join('\n\n');
}

function buildRatingPlatformContextInstruction() {
    const actionState = getConversationActionStatePayload();
    if (!actionState) {
        return '';
    }

    const lines = ['СЛУЖЕБНЫЙ КОНТЕКСТ ПЛАТФОРМЫ'];
    lines.push(`Платформа уже зафиксировала исход диалога: ${actionState.type}`);
    if (actionState.reason) {
        lines.push(`Причина исхода по данным платформы: ${actionState.reason}`);
    }
    if (actionState.recoverable) {
        lines.push('Этот исход recoverable: клиента ещё можно было вернуть.');
    }
    return lines.join('\n');
}

function buildRaterPromptForWebhook(basePrompt) {
    const normalizedPrompt = String(basePrompt || '').trim();
    if (!normalizedPrompt) return '';
    const platformContext = buildRatingPlatformContextInstruction();
    const hiddenRater = getConfiguredRaterHiddenPrompt();
    return [
        normalizedPrompt,
        hiddenRater,
        platformContext
    ].filter(Boolean).join('\n\n');
}

function extractConversationAction(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return null;
    }
    return normalizeConversationAction(
        data.conversationAction ||
        data.conversation_action ||
        data.clientAction ||
        data.client_action ||
        null
    );
}

function tryParseNestedConversationEnvelope(rawValue) {
    const trimmed = String(rawValue || '').trim();
    if (!trimmed || !(trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"'))) {
        return null;
    }

    let parsed = null;
    try {
        parsed = JSON.parse(trimmed);
    } catch (e) {
        return null;
    }

    if (typeof parsed === 'string' && parsed.trim() !== trimmed) {
        return tryParseNestedConversationEnvelope(parsed);
    }

    const conversationAction = extractConversationAction(parsed);
    const message = extractApiResponse(parsed);
    if (!conversationAction && !message) {
        return null;
    }

    return {
        message: message || '',
        conversationAction: conversationAction || null
    };
}

function formatStructuredDataForDisplay(value, depth = 0) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    const indent = '  '.repeat(depth);

    if (Array.isArray(value)) {
        const items = value
            .map(item => formatStructuredDataForDisplay(item, depth + 1))
            .filter(item => item && item.trim() !== '')
            .map(item => {
                const lines = item.split('\n');
                if (lines.length === 1) {
                    return `${indent}- ${lines[0]}`;
                }
                const [first, ...rest] = lines;
                const tail = rest.map(line => `${indent}  ${line}`).join('\n');
                return `${indent}- ${first}\n${tail}`;
            });
        return items.join('\n');
    }

    if (typeof value === 'object') {
        const lines = Object.entries(value)
            .map(([key, nested]) => {
                const nestedText = formatStructuredDataForDisplay(nested, depth + 1);
                if (!nestedText) return '';
                if (typeof nested === 'object' && nested !== null) {
                    const nestedLines = nestedText.split('\n').map(line => `${indent}  ${line}`).join('\n');
                    return `${indent}${key}:\n${nestedLines}`;
                }
                return `${indent}${key}: ${nestedText}`;
            })
            .filter(Boolean);
        return lines.join('\n');
    }

    return '';
}

function normalizeStructuredJsonText(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return '';
    if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) {
        return trimmed;
    }
    try {
        const parsed = JSON.parse(trimmed);
        return formatStructuredDataForDisplay(parsed) || trimmed;
    } catch (e) {
        return trimmed;
    }
}

function normalizeStructuredString(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return formatStructuredDataForDisplay(value).trim();
}

function normalizeStructuredStringList(value) {
    if (value === null || value === undefined) return [];
    if (Array.isArray(value)) {
        return value
            .flatMap(item => normalizeStructuredStringList(item))
            .filter(Boolean);
    }
    const text = normalizeStructuredString(value);
    if (!text) return [];
    return text
        .split('\n')
        .map(line => line.replace(/^[-*•]\s*/, '').trim())
        .filter(Boolean);
}

function getFirstPresentValue(source, keys = []) {
    if (!source || typeof source !== 'object') return null;
    for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
        const value = source[key];
        if (value === null || value === undefined) continue;
        if (typeof value === 'string' && value.trim() === '') continue;
        if (Array.isArray(value) && value.length === 0) continue;
        return value;
    }
    return null;
}

function normalizeRatingOutcome(value) {
    const normalized = normalizeStructuredString(value).toLowerCase();
    if (!normalized) return '';
    if (
        normalized === CONVERSATION_ACTION_TYPE.GO_SILENT ||
        normalized.includes('go_silent') ||
        normalized.includes('silent') ||
        normalized.includes('молча') ||
        normalized.includes('не ответ')
    ) {
        return CONVERSATION_ACTION_TYPE.GO_SILENT;
    }
    if (
        normalized === CONVERSATION_ACTION_TYPE.END ||
        normalized.includes('end_conversation') ||
        normalized.includes('заверш') ||
        normalized.includes('закрыт') ||
        normalized.includes('разрыв')
    ) {
        return CONVERSATION_ACTION_TYPE.END;
    }
    if (
        normalized === 'continue' ||
        normalized.includes('continue') ||
        normalized.includes('ongoing') ||
        normalized.includes('продолж')
    ) {
        return 'continue';
    }
    if (normalized === 'unknown') return 'unknown';
    return normalized;
}

function normalizeRatingStructuredPayload(source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
        return null;
    }

    const summary = normalizeStructuredString(getFirstPresentValue(source, [
        'summary',
        'verdict',
        'overallSummary',
        'overall_summary',
        'resultSummary',
        'result_summary'
    ]));
    const outcome = normalizeRatingOutcome(getFirstPresentValue(source, [
        'outcome',
        'outcomeType',
        'outcome_type',
        'conversationOutcome',
        'conversation_outcome'
    ]));
    const outcomeReason = normalizeStructuredString(getFirstPresentValue(source, [
        'outcomeReason',
        'outcome_reason',
        'reason',
        'clientOutcomeReason',
        'client_outcome_reason'
    ]));
    const whatKilledDialogue = normalizeStructuredString(getFirstPresentValue(source, [
        'whatKilledDialogue',
        'what_killed_dialogue',
        'dialogueFailure',
        'dialogue_failure',
        'failureReason',
        'failure_reason'
    ]));
    const whatWasSalvageable = normalizeStructuredString(getFirstPresentValue(source, [
        'whatWasSalvageable',
        'what_was_salvageable',
        'salvageable',
        'salvageableWindow',
        'salvageable_window'
    ]));
    const whyClientLeft = normalizeStructuredString(getFirstPresentValue(source, [
        'whyClientLeft',
        'why_client_left',
        'clientReason',
        'client_reason',
        'clientExitReason',
        'client_exit_reason'
    ]));
    const nextBestStep = normalizeStructuredString(getFirstPresentValue(source, [
        'nextBestStep',
        'next_best_step',
        'nextStep',
        'next_step'
    ]));
    const managerMistakes = normalizeStructuredStringList(getFirstPresentValue(source, [
        'managerMistakes',
        'manager_mistakes',
        'mistakes',
        'errors'
    ]));
    const managerWins = normalizeStructuredStringList(getFirstPresentValue(source, [
        'managerWins',
        'manager_wins',
        'wins',
        'strengths'
    ]));
    const crmActions = normalizeStructuredStringList(getFirstPresentValue(source, [
        'crmActions',
        'crm_actions',
        'actionsForCrm',
        'actions_for_crm',
        'recommendedActions',
        'recommended_actions'
    ]));

    const hasUsefulFields = Boolean(
        summary ||
        outcome ||
        outcomeReason ||
        whatKilledDialogue ||
        whatWasSalvageable ||
        whyClientLeft ||
        nextBestStep ||
        managerMistakes.length ||
        managerWins.length ||
        crmActions.length
    );
    if (!hasUsefulFields) return null;

    return {
        summary,
        outcome,
        outcomeReason,
        whatKilledDialogue,
        whatWasSalvageable,
        whyClientLeft,
        managerMistakes,
        managerWins,
        nextBestStep,
        crmActions
    };
}

function tryParseRatingStructuredPayload(value, depth = 0) {
    if (depth > 4 || value === null || value === undefined) return null;

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed || !(trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"'))) {
            return null;
        }
        try {
            return tryParseRatingStructuredPayload(JSON.parse(trimmed), depth + 1);
        } catch (error) {
            return null;
        }
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            const parsed = tryParseRatingStructuredPayload(item, depth + 1);
            if (parsed) return parsed;
        }
        return null;
    }

    if (typeof value !== 'object') return null;

    const direct = normalizeRatingStructuredPayload(value);
    if (direct) return direct;

    const nestedKeys = [
        'rating',
        'result',
        'data',
        'output',
        'response',
        'message',
        'content',
        'analysis'
    ];
    for (const key of nestedKeys) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
        const nested = tryParseRatingStructuredPayload(value[key], depth + 1);
        if (nested) return nested;
    }

    return null;
}

function getRatingOutcomeLabel(outcome) {
    if (outcome === CONVERSATION_ACTION_TYPE.GO_SILENT) {
        return 'Клиент ушёл молча';
    }
    if (outcome === CONVERSATION_ACTION_TYPE.END) {
        return 'Диалог завершен';
    }
    if (outcome === 'continue') {
        return 'Диалог можно было продолжать';
    }
    if (outcome === 'unknown') {
        return 'Исход не определён';
    }
    return '';
}

function getRatingOutcomeReasonLabel(reason) {
    const normalized = String(reason || '').trim().toLowerCase();
    if (!normalized) return '';
    const map = {
        lost_interest: 'пропал интерес',
        price_rejection: 'не устроила цена',
        manager_failed: 'менеджер не убедил',
        lost_trust: 'пропало доверие',
        resolved: 'вопрос закрыт',
        next_step_agreed: 'согласован следующий шаг',
        hard_refusal: 'жёсткий отказ',
        soft_refusal: 'мягкий отказ',
        timeout: 'клиент перестал отвечать'
    };
    return map[normalized] || normalized.replace(/[_-]+/g, ' ');
}

function buildRatingResultExportText(result) {
    if (!result || typeof result !== 'object') return '';

    const blocks = [];
    if (result.summary) {
        blocks.push(result.summary);
    }

    const outcomeParts = [];
    const outcomeLabel = getRatingOutcomeLabel(result.outcome);
    const outcomeReasonLabel = getRatingOutcomeReasonLabel(result.outcomeReason);
    if (outcomeLabel) outcomeParts.push(outcomeLabel);
    if (outcomeReasonLabel) outcomeParts.push(outcomeReasonLabel);
    if (outcomeParts.length) {
        blocks.push(`Исход: ${outcomeParts.join(' · ')}`);
    }

    if (result.whatKilledDialogue) {
        blocks.push(`Что убило диалог:\n${result.whatKilledDialogue}`);
    }
    if (result.whatWasSalvageable) {
        blocks.push(`Что ещё можно было спасти:\n${result.whatWasSalvageable}`);
    }
    if (result.whyClientLeft) {
        blocks.push(`Почему клиент ушёл:\n${result.whyClientLeft}`);
    }
    if (result.managerMistakes?.length) {
        blocks.push(`Ошибки менеджера:\n- ${result.managerMistakes.join('\n- ')}`);
    }
    if (result.managerWins?.length) {
        blocks.push(`Сильные моменты:\n- ${result.managerWins.join('\n- ')}`);
    }
    if (result.nextBestStep) {
        blocks.push(`Лучший следующий шаг:\n${result.nextBestStep}`);
    }
    if (result.crmActions?.length) {
        blocks.push(`Действия для CRM:\n- ${result.crmActions.join('\n- ')}`);
    }

    return blocks.filter(Boolean).join('\n\n').trim();
}

function normalizeRatingWebhookResult(rawText, fallbackOutcomeState = null) {
    const trimmed = String(rawText || '').trim();
    const structured = tryParseRatingStructuredPayload(trimmed);
    if (structured) {
        if (!structured.outcome && fallbackOutcomeState?.type) {
            structured.outcome = fallbackOutcomeState.type;
        }
        if (!structured.outcomeReason && fallbackOutcomeState?.reason) {
            structured.outcomeReason = fallbackOutcomeState.reason;
        }
        const exportText = buildRatingResultExportText(structured) || normalizeStructuredJsonText(trimmed) || trimmed;
        return {
            rawText: trimmed,
            exportText: exportText.trim(),
            displayText: exportText.trim(),
            structured
        };
    }

    const displayText = normalizeStructuredJsonText(trimmed) || trimmed;
    return {
        rawText: trimmed,
        exportText: displayText.trim(),
        displayText: displayText.trim(),
        structured: null
    };
}

async function readWebhookEnvelope(response, timeoutMs = WEBHOOK_DEFAULT_TIMEOUT_MS) {
    const contentType = response.headers.get('content-type') || '';
    const rawText = await readResponseTextWithTimeout(
        response,
        timeoutMs,
        `Таймаут чтения ответа webhook (${timeoutMs/1000}с). Проверьте n8n workflow.`
    );
    if (!rawText || rawText.trim() === '') {
        return {
            message: '',
            conversationAction: null
        };
    }
    const trimmed = rawText.trim();
    let parsed = null;
    try {
        parsed = JSON.parse(trimmed);
    } catch (e) {
        parsed = null;
    }
    if (parsed) {
        const conversationAction = extractConversationAction(parsed);
        const extracted = extractApiResponse(parsed);
        if (extracted) {
            const nestedEnvelope = tryParseNestedConversationEnvelope(extracted);
            if (nestedEnvelope) {
                return nestedEnvelope;
            }
            return {
                message: extracted,
                conversationAction
            };
        }
        if (conversationAction) {
            return {
                message: '',
                conversationAction
            };
        }
        return {
            message: trimmed,
            conversationAction: null
        };
    }
    if (contentType.includes('application/json')) {
        return {
            message: trimmed,
            conversationAction: null
        };
    }
    return {
        message: trimmed,
        conversationAction: null
    };
}

async function readWebhookResponse(response, timeoutMs = WEBHOOK_DEFAULT_TIMEOUT_MS) {
    const envelope = await readWebhookEnvelope(response, timeoutMs);
    return envelope.message;
}

function loadWebhookDebugEntries() {
    if (!ENABLE_LOCAL_WEBHOOK_DEBUG) return [];
    try {
        const raw = localStorage.getItem(WEBHOOK_DEBUG_LOG_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((entry) => entry && typeof entry === 'object' && typeof entry.id === 'string')
            .slice(0, WEBHOOK_DEBUG_LOG_MAX_ENTRIES);
    } catch (error) {
        console.warn('Failed to load webhook debug log:', error);
        return [];
    }
}

function saveWebhookDebugEntries() {
    if (!ENABLE_LOCAL_WEBHOOK_DEBUG) return;
    try {
        localStorage.setItem(
            WEBHOOK_DEBUG_LOG_STORAGE_KEY,
            JSON.stringify(webhookDebugEntries.slice(0, WEBHOOK_DEBUG_LOG_MAX_ENTRIES))
        );
    } catch (error) {
        console.warn('Failed to save webhook debug log:', error);
    }
}

function getWebhookDebugTypeLabel(type) {
    switch (String(type || '').trim()) {
    case 'chat':
        return 'Чат';
    case 'chat_start':
        return 'Старт';
    case 'rating':
        return 'Оценка';
    case 'manager_assist':
        return 'Подсказка';
    case 'improve':
        return 'Улучшение';
    case 'attestation':
        return 'Аттестация';
    default:
        return 'Webhook';
    }
}

function getWebhookDebugStatusLabel(status) {
    switch (String(status || '').trim()) {
    case 'ok':
        return 'OK';
    case 'error':
        return 'Ошибка';
    default:
        return 'В работе';
    }
}

function normalizeWebhookDebugEndpoint(endpoint) {
    const raw = String(endpoint || '').trim();
    if (!raw) return '-';
    try {
        const parsed = new URL(raw, window.location.origin);
        return `${parsed.hostname}${parsed.pathname}`;
    } catch (error) {
        return raw;
    }
}

function truncateWebhookDebugText(value, maxLength = 220) {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, maxLength - 1)}…`;
}

function formatWebhookDebugTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function formatWebhookDebugDuration(durationMs) {
    const normalized = Number(durationMs);
    if (!Number.isFinite(normalized) || normalized < 0) return '—';
    if (normalized < 1000) return `${Math.round(normalized)} мс`;
    if (normalized < 10000) return `${(normalized / 1000).toFixed(1)} с`;
    return `${Math.round(normalized / 1000)} с`;
}

function renderWebhookDebugPanel() {
    if (!adminWebhookDebugList || !adminWebhookDebugMeta) return;

    const total = webhookDebugEntries.length;
    const pendingCount = webhookDebugEntries.filter((entry) => entry.status === 'pending').length;
    const errorCount = webhookDebugEntries.filter((entry) => entry.status === 'error').length;
    adminWebhookDebugMeta.textContent = total
        ? `Показаны последние ${Math.min(total, WEBHOOK_DEBUG_LOG_MAX_ENTRIES)} запросов. В работе: ${pendingCount}. Ошибок: ${errorCount}.`
        : 'Показываются последние запросы этого браузера. Здесь удобно смотреть requestId, endpoint, время и текст ошибки.';

    if (!total) {
        adminWebhookDebugList.innerHTML = '<div class="admin-webhook-debug-empty">Лог пока пуст</div>';
        return;
    }

    adminWebhookDebugList.innerHTML = webhookDebugEntries.map((entry) => {
        const status = String(entry.status || 'pending');
        const startedAtText = formatWebhookDebugTime(entry.startedAt);
        const finishedAtText = entry.finishedAt ? formatWebhookDebugTime(entry.finishedAt) : '';
        const durationText = formatWebhookDebugDuration(entry.durationMs);
        const timingText = finishedAtText
            ? `${startedAtText} -> ${finishedAtText} • ${durationText}`
            : `${startedAtText} • ${durationText}`;
        const detailFields = [
            {
                label: 'Endpoint',
                value: `<code>${escapeHtml(entry.endpointLabel || '-')}</code>`
            },
            {
                label: 'Request ID',
                value: `<code>${escapeHtml(entry.requestId || '-')}</code>`
            },
            entry.attempt != null
                ? { label: 'Попытка', value: escapeHtml(`${entry.attempt}`) }
                : null,
            entry.httpStatus != null
                ? { label: 'HTTP', value: escapeHtml(`${entry.httpStatus}`) }
                : null,
            entry.timeoutMs != null
                ? { label: 'Таймаут', value: escapeHtml(formatWebhookDebugDuration(entry.timeoutMs)) }
                : null,
            entry.resultMessage
                ? { label: 'Результат', value: escapeHtml(entry.resultMessage) }
                : null,
            entry.errorMessage
                ? { label: 'Ошибка', value: escapeHtml(entry.errorMessage) }
                : null
        ].filter(Boolean);

        return `
            <div class="admin-webhook-debug-item is-${status}">
                <div class="admin-webhook-debug-head">
                    <div class="admin-webhook-debug-title">
                        <span>${escapeHtml(getWebhookDebugTypeLabel(entry.type))}</span>
                        <span class="admin-webhook-debug-status is-${status}">${escapeHtml(getWebhookDebugStatusLabel(status))}</span>
                    </div>
                    <div class="admin-webhook-debug-time">${escapeHtml(timingText)}</div>
                </div>
                <div class="admin-webhook-debug-grid">
                    ${detailFields.map((field) => `
                        <div class="admin-webhook-debug-field">
                            <div class="admin-webhook-debug-label">${escapeHtml(field.label)}</div>
                            <div class="admin-webhook-debug-value">${field.value}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function queueWebhookDebugRender() {
    if (webhookDebugRenderQueued) return;
    webhookDebugRenderQueued = true;
    queueMicrotask(() => {
        webhookDebugRenderQueued = false;
        renderWebhookDebugPanel();
    });
}

function updateWebhookDebugEntry(entryId, updater) {
    if (!entryId || typeof updater !== 'function') return;
    let updated = false;
    webhookDebugEntries = webhookDebugEntries.map((entry) => {
        if (entry.id !== entryId) return entry;
        updated = true;
        return updater(entry);
    });
    if (!updated) return;
    saveWebhookDebugEntries();
    queueWebhookDebugRender();
}

function startWebhookDebugRequest({ type, endpoint, requestId, attempt = null, timeoutMs = null, method = 'POST' } = {}) {
    if (!ENABLE_LOCAL_WEBHOOK_DEBUG) return '';
    const startedAtMs = Date.now();
    const entryId = buildRequestId('webhook_dbg');
    webhookDebugEntries = [
        {
            id: entryId,
            type: String(type || '').trim() || 'webhook',
            requestId: String(requestId || '').trim(),
            attempt: Number.isFinite(Number(attempt)) ? Number(attempt) : null,
            endpointLabel: normalizeWebhookDebugEndpoint(endpoint),
            method: String(method || 'POST').trim().toUpperCase(),
            timeoutMs: Number.isFinite(Number(timeoutMs)) ? Number(timeoutMs) : null,
            status: 'pending',
            startedAt: new Date(startedAtMs).toISOString(),
            startedAtMs,
            finishedAt: '',
            durationMs: null,
            httpStatus: null,
            resultMessage: '',
            errorMessage: ''
        },
        ...webhookDebugEntries
    ].slice(0, WEBHOOK_DEBUG_LOG_MAX_ENTRIES);
    saveWebhookDebugEntries();
    queueWebhookDebugRender();
    return entryId;
}

function finishWebhookDebugRequest(entryId, details = {}) {
    updateWebhookDebugEntry(entryId, (entry) => {
        const finishedAtMs = Date.now();
        return {
            ...entry,
            status: details.status === 'error' ? 'error' : 'ok',
            finishedAt: new Date(finishedAtMs).toISOString(),
            durationMs: Number.isFinite(entry.startedAtMs) ? finishedAtMs - entry.startedAtMs : null,
            httpStatus: Number.isFinite(Number(details.httpStatus)) ? Number(details.httpStatus) : entry.httpStatus,
            resultMessage: truncateWebhookDebugText(details.resultMessage || ''),
            errorMessage: truncateWebhookDebugText(details.errorMessage || '')
        };
    });
}

function failWebhookDebugRequest(entryId, error, fallbackStatus = null) {
    const message = truncateWebhookDebugText(error?.message || error || 'Неизвестная ошибка');
    const httpStatus = Number(error?.httpStatus || fallbackStatus || 0) || null;
    updateWebhookDebugEntry(entryId, (entry) => {
        const finishedAtMs = Date.now();
        return {
            ...entry,
            status: 'error',
            finishedAt: new Date(finishedAtMs).toISOString(),
            durationMs: Number.isFinite(entry.startedAtMs) ? finishedAtMs - entry.startedAtMs : null,
            httpStatus,
            errorMessage: message
        };
    });
}

function clearWebhookDebugEntries() {
    webhookDebugEntries = [];
    removeSafeLocalStorageValue(WEBHOOK_DEBUG_LOG_STORAGE_KEY);
    saveWebhookDebugEntries();
    renderWebhookDebugPanel();
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
            clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
        };
}

function normalizeScriptSrc(src) {
    return String(src || '').trim();
}

function getTrustedExternalScriptMetadata(src) {
    const normalizedSrc = normalizeScriptSrc(src);
    return TRUSTED_EXTERNAL_SCRIPT_METADATA.get(normalizedSrc) || null;
}

function applyTrustedExternalScriptPolicy(script, src) {
    const metadata = getTrustedExternalScriptMetadata(src);
    if (!metadata) {
        throw new Error(`Blocked untrusted external script source: ${normalizeScriptSrc(src)}`);
    }
    if (script.integrity && metadata.integrity && script.integrity !== metadata.integrity) {
        throw new Error(`Integrity mismatch for external script: ${normalizeScriptSrc(src)}`);
    }
    if (metadata.integrity) {
        script.integrity = metadata.integrity;
    }
    script.crossOrigin = 'anonymous';
    script.referrerPolicy = 'no-referrer';
    return metadata;
}

function ensureGlobalScriptReady({
    key,
    src,
    timeoutMs = EXTERNAL_SCRIPT_LOAD_TIMEOUT_MS,
    isReady = () => false
}) {
    const normalizedKey = String(key || normalizeScriptSrc(src));
    const normalizedSrc = normalizeScriptSrc(src);
    if (!normalizedKey) {
        return Promise.reject(new Error('Missing external script key'));
    }
    if (typeof isReady === 'function' && isReady()) {
        return Promise.resolve(true);
    }
    if (!normalizedSrc) {
        return Promise.reject(new Error('Missing external script source'));
    }
    if (!getTrustedExternalScriptMetadata(normalizedSrc)) {
        return Promise.reject(new Error(`Blocked untrusted external script source: ${normalizedSrc}`));
    }
    if (typeof document === 'undefined' || typeof window === 'undefined') {
        return Promise.reject(new Error('No DOM available'));
    }

    const cached = EXTERNAL_SCRIPT_LOAD_PROMISES.get(normalizedKey);
    if (cached) return cached;

    const loadPromise = (async () => {
        if (isReady()) return true;

        let script = Array.from(document.querySelectorAll('script')).find((node) => {
            return normalizeScriptSrc(node?.src || '') === normalizedSrc;
        }) || null;
        if (!script) {
            script = document.createElement('script');
            script.src = normalizedSrc;
            script.async = true;
            script.type = 'text/javascript';
            applyTrustedExternalScriptPolicy(script, normalizedSrc);
            document.head?.appendChild(script);
        } else {
            applyTrustedExternalScriptPolicy(script, normalizedSrc);
        }

        if (isReady()) return true;

        return new Promise((resolve) => {
            let settled = false;
            const finish = (result) => {
                if (settled) return;
                settled = true;
                script.removeEventListener('load', onLoad);
                script.removeEventListener('error', onError);
                clearTimeout(timeoutId);
                resolve(!!result && isReady());
            };
            const onLoad = () => finish(true);
            const onError = () => finish(false);
            const timeoutId = setTimeout(() => finish(false), Math.max(300, timeoutMs));
            script.addEventListener('load', onLoad);
            script.addEventListener('error', onError);
        });
    })().finally(() => {
        EXTERNAL_SCRIPT_LOAD_PROMISES.delete(normalizedKey);
    });

    EXTERNAL_SCRIPT_LOAD_PROMISES.set(normalizedKey, loadPromise);
    return loadPromise;
}

function ensureDocxLibrary() {
    return ensureGlobalScriptReady({
        key: 'docx',
        src: DOCX_LIBRARY_SRC,
        isReady: () => typeof window.docx !== 'undefined'
    }).then((ready) => {
        if (!ready) {
            throw new Error('Не удалось загрузить библиотеку docx');
        }
        return true;
    });
}

function ensureMammothLibrary() {
    return ensureGlobalScriptReady({
        key: 'mammoth',
        src: MAMMOTH_LIBRARY_SRC,
        isReady: () => typeof window.mammoth !== 'undefined'
    }).then((ready) => {
        if (!ready) {
            throw new Error('Не удалось загрузить библиотеку mammoth');
        }
        return true;
    });
}

function ensureFileSaverLibrary() {
    return ensureGlobalScriptReady({
        key: 'fileSaver',
        src: FILESAVER_LIBRARY_SRC,
        isReady: () => typeof window.saveAs === 'function'
    }).then((ready) => {
        if (!ready) {
            throw new Error('Не удалось загрузить библиотеку FileSaver');
        }
        return true;
    });
}

function setCustomTooltip(element, text) {
    if (!element) return;
    const tooltipText = String(text || '').trim();
    if (!tooltipText) return;
    element.classList.add('custom-tooltip-target');
    element.dataset.tooltipInit = '1';
    element.setAttribute('data-tooltip', tooltipText);
    element.setAttribute('aria-label', tooltipText);
    element.removeAttribute('title');
}

function prepareCustomTooltips(root = document) {
    root.querySelectorAll('[title]').forEach((element) => {
        const title = element.getAttribute('title');
        if (!title || !title.trim()) return;
        setCustomTooltip(element, title);
    });
}

const TOOLTIP_SHOW_DELAY_MS = 0;
const TOOLTIP_GAP_PX = 12;
const TOOLTIP_EDGE_OFFSET_PX = 12;
const SUPPORTS_POPOVER = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;
let tooltipLayer = null;
let tooltipActiveTarget = null;
let tooltipShowTimer = null;
let tooltipHideTimer = null;
let tooltipMutationObserver = null;

function getTooltipTarget(node) {
    if (!(node instanceof Element)) return null;
    const target = node.closest('.custom-tooltip-target[data-tooltip]');
    if (!target) return null;
    const text = (target.getAttribute('data-tooltip') || '').trim();
    if (!text) return null;
    return target;
}

function ensureTooltipLayer() {
    if (tooltipLayer) return tooltipLayer;
    tooltipLayer = document.createElement('div');
    tooltipLayer.className = 'custom-tooltip-layer';
    tooltipLayer.setAttribute('role', 'tooltip');
    if (SUPPORTS_POPOVER) {
        tooltipLayer.setAttribute('popover', 'manual');
    } else {
        tooltipLayer.hidden = true;
    }
    document.body.appendChild(tooltipLayer);
    return tooltipLayer;
}

function isTooltipPopoverOpen() {
    if (!tooltipLayer || !SUPPORTS_POPOVER) return false;
    return tooltipLayer.matches(':popover-open');
}

function positionTooltipLayer(target) {
    if (!tooltipLayer || !target) return;
    if (!document.contains(target)) {
        hideTooltip(true);
        return;
    }

    const rect = target.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    tooltipLayer.classList.remove('placement-bottom');
    const tooltipRect = tooltipLayer.getBoundingClientRect();

    const preferredLeft = rect.left + rect.width / 2 - tooltipRect.width / 2;
    const maxLeft = Math.max(TOOLTIP_EDGE_OFFSET_PX, viewportWidth - TOOLTIP_EDGE_OFFSET_PX - tooltipRect.width);
    const left = Math.min(maxLeft, Math.max(TOOLTIP_EDGE_OFFSET_PX, preferredLeft));

    const topPlacement = rect.top - TOOLTIP_GAP_PX - tooltipRect.height;
    const bottomPlacement = rect.bottom + TOOLTIP_GAP_PX;
    const hasSpaceAbove = topPlacement >= TOOLTIP_EDGE_OFFSET_PX;
    const hasSpaceBelow = bottomPlacement + tooltipRect.height <= viewportHeight - TOOLTIP_EDGE_OFFSET_PX;
    const placeBottom = !hasSpaceAbove && hasSpaceBelow;

    if (placeBottom) {
        tooltipLayer.classList.add('placement-bottom');
    }

    let top = placeBottom ? bottomPlacement : topPlacement;
    top = Math.max(TOOLTIP_EDGE_OFFSET_PX, Math.min(top, viewportHeight - TOOLTIP_EDGE_OFFSET_PX - tooltipRect.height));

    const anchorX = rect.left + rect.width / 2;
    const arrowLeft = Math.max(12, Math.min(anchorX - left, tooltipRect.width - 12));

    const finalLeft = Number.isFinite(left) ? Math.round(left) : TOOLTIP_EDGE_OFFSET_PX;
    const finalTop = Number.isFinite(top) ? Math.round(top) : TOOLTIP_EDGE_OFFSET_PX;
    tooltipLayer.style.setProperty('position', 'fixed', 'important');
    tooltipLayer.style.setProperty('inset', 'auto', 'important');
    tooltipLayer.style.setProperty('right', 'auto', 'important');
    tooltipLayer.style.setProperty('bottom', 'auto', 'important');
    tooltipLayer.style.setProperty('left', `${finalLeft}px`, 'important');
    tooltipLayer.style.setProperty('top', `${finalTop}px`, 'important');
    tooltipLayer.style.setProperty('--tooltip-arrow-left', `${Math.round(arrowLeft)}px`);
}

function clearTooltipTimers() {
    if (tooltipShowTimer) {
        clearTimeout(tooltipShowTimer);
        tooltipShowTimer = null;
    }
    if (tooltipHideTimer) {
        clearTimeout(tooltipHideTimer);
        tooltipHideTimer = null;
    }
}

function showTooltip(target) {
    if (!target) return;
    const tooltipText = (target.getAttribute('data-tooltip') || '').trim();
    if (!tooltipText) return;

    ensureTooltipLayer();
    clearTooltipTimers();

    tooltipActiveTarget = target;
    tooltipLayer.textContent = tooltipText;
    if (!SUPPORTS_POPOVER) {
        tooltipLayer.hidden = false;
    } else if (!isTooltipPopoverOpen()) {
        try {
            tooltipLayer.showPopover();
        } catch (e) {}
    }
    tooltipLayer.classList.remove('visible');
    tooltipLayer.classList.remove('placement-bottom');
    tooltipLayer.style.setProperty('position', 'fixed', 'important');
    tooltipLayer.style.setProperty('inset', 'auto', 'important');
    tooltipLayer.style.setProperty('right', 'auto', 'important');
    tooltipLayer.style.setProperty('bottom', 'auto', 'important');
    tooltipLayer.style.setProperty('left', '-9999px', 'important');
    tooltipLayer.style.setProperty('top', '-9999px', 'important');
    positionTooltipLayer(target);

    requestAnimationFrame(() => {
        if (!tooltipLayer || tooltipActiveTarget !== target) return;
        positionTooltipLayer(target);
        tooltipLayer.classList.add('visible');
        if (SUPPORTS_POPOVER) {
            requestAnimationFrame(() => {
                if (!tooltipLayer || tooltipActiveTarget !== target) return;
                positionTooltipLayer(target);
            });
        }
    });
}

function scheduleTooltip(target) {
    clearTooltipTimers();
    if (!target) return;

    if (tooltipActiveTarget === target && tooltipLayer) {
        return;
    }

    if (TOOLTIP_SHOW_DELAY_MS <= 0) {
        showTooltip(target);
        return;
    }

    tooltipShowTimer = setTimeout(() => {
        showTooltip(target);
    }, TOOLTIP_SHOW_DELAY_MS);
}

function hideTooltip(immediate = true) {
    if (!tooltipLayer) return;
    if (tooltipShowTimer) {
        clearTimeout(tooltipShowTimer);
        tooltipShowTimer = null;
    }

    tooltipLayer.classList.remove('visible');
    tooltipActiveTarget = null;

    if (immediate) {
        if (tooltipHideTimer) {
            clearTimeout(tooltipHideTimer);
            tooltipHideTimer = null;
        }
        if (SUPPORTS_POPOVER && isTooltipPopoverOpen()) {
            try {
                tooltipLayer.hidePopover();
            } catch (e) {}
        }
        if (!SUPPORTS_POPOVER) {
            tooltipLayer.hidden = true;
        }
        return;
    }

    if (SUPPORTS_POPOVER && isTooltipPopoverOpen()) {
        try {
            tooltipLayer.hidePopover();
        } catch (e) {}
    }
    if (!SUPPORTS_POPOVER) {
        tooltipLayer.hidden = true;
    }
}

function initCustomTooltipLayer() {
    ensureTooltipLayer();

    if (!tooltipMutationObserver) {
        tooltipMutationObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes') {
                    const target = mutation.target;
                    if (target instanceof Element && target.hasAttribute('title')) {
                        setCustomTooltip(target, target.getAttribute('title'));
                    }
                    return;
                }
                mutation.addedNodes.forEach((node) => {
                    if (!(node instanceof Element)) return;
                    if (node.hasAttribute('title')) {
                        setCustomTooltip(node, node.getAttribute('title'));
                    }
                    prepareCustomTooltips(node);
                });
            });
        });
        tooltipMutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['title']
        });
    }

    document.addEventListener('pointerover', (event) => {
        if (event.pointerType === 'touch') return;
        const target = getTooltipTarget(event.target);
        if (!target) return;
        scheduleTooltip(target);
    }, true);

    document.addEventListener('pointerout', (event) => {
        if (event.pointerType === 'touch') return;
        const currentTarget = getTooltipTarget(event.target);
        if (!currentTarget) return;
        const nextTarget = event.relatedTarget instanceof Element ? getTooltipTarget(event.relatedTarget) : null;
        if (currentTarget === nextTarget) return;
        requestAnimationFrame(() => {
            if (!tooltipLayer || tooltipActiveTarget !== currentTarget) return;
            if (currentTarget.matches(':hover') || currentTarget.matches(':focus-within')) return;
            hideTooltip();
        });
    }, true);

    document.addEventListener('pointermove', (event) => {
        if (event.pointerType === 'touch') return;
        if (!tooltipActiveTarget || !tooltipLayer) return;
        if (!document.contains(tooltipActiveTarget)) {
            hideTooltip(true);
            return;
        }
        const rect = tooltipActiveTarget.getBoundingClientRect();
        const insideTarget =
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom;
        if (!insideTarget && !tooltipActiveTarget.matches(':focus-within')) {
            hideTooltip(true);
        }
    }, true);

    document.addEventListener('pointerdown', () => {
        if (!tooltipActiveTarget) return;
        hideTooltip(true);
    }, true);

    document.addEventListener('click', () => {
        if (!tooltipActiveTarget) return;
        hideTooltip(true);
    }, true);

    document.addEventListener('focusin', (event) => {
        const target = getTooltipTarget(event.target);
        if (!target) return;
        if (typeof target.matches === 'function' && !target.matches(':focus-visible')) return;
        scheduleTooltip(target);
    }, true);

    document.addEventListener('focusout', (event) => {
        const target = getTooltipTarget(event.target);
        if (!target) return;
        hideTooltip();
    }, true);

    window.addEventListener('scroll', () => {
        if (!tooltipActiveTarget || !tooltipLayer || tooltipLayer.hidden) return;
        positionTooltipLayer(tooltipActiveTarget);
    }, true);

    window.addEventListener('resize', () => {
        if (!tooltipActiveTarget || !tooltipLayer || tooltipLayer.hidden) return;
        positionTooltipLayer(tooltipActiveTarget);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            hideTooltip(true);
        }
    });
}

function unescapeMarkdown(text) {
    if (!text) return text;
    return text
        .replace(/\\\*\\\*/g, '**')  // Handle escaped double asterisks first
        .replace(/\\#/g, '#')
        .replace(/\\\*/g, '*')
        .replace(/\\-/g, '-')
        .replace(/\\_/g, '_')
        .replace(/\\`/g, '`')
        .replace(/\\\[/g, '[')
        .replace(/\\\]/g, ']')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\>/g, '>')
        .replace(/\\!/g, '!')
        .replace(/\\~/g, '~');
}

function generateId() {
    return 'var_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function normalizePromptOwnerName(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
}

function buildLocalPromptsStorageKey(storageVersion, ownerKey) {
    return `localPrompts:${storageVersion}:${ownerKey}`;
}

function getStablePromptOwnerKey() {
    const normalizedLogin = normalizeLogin(currentUser?.login || auth?.currentUser?.email || '');
    const fallbackUid = String(currentUser?.uid || getCurrentAuthUid() || '').trim();
    const resolvedUid = resolveAuthUidForLogin(normalizedLogin, fallbackUid);
    if (resolvedUid) {
        return `uid:${resolvedUid}`;
    }
    if (normalizedLogin) {
        return `login:${loginToStorageKey(normalizedLogin)}`;
    }
    const fallbackName = normalizePromptOwnerName(
        currentUser?.fio || managerNameInput?.value || getCachedStorageValue(USER_NAME_KEY, '') || 'guest'
    );
    return `guest:${fallbackName || 'guest'}`;
}

function getCurrentLegacyPromptOwnerKeys() {
    const normalizedNames = Array.from(
        new Set(
            [
                currentUser?.fio || '',
                getCachedStorageValue(USER_NAME_KEY, ''),
                managerNameInput?.value || ''
            ]
                .map((value) => normalizePromptOwnerName(value))
                .filter(Boolean)
        )
    );

    if (!normalizedNames.length) {
        normalizedNames.push('guest');
    }

    return normalizedNames.flatMap((name) => [`admin:${name}`, `user:${name}`]);
}

function getLocalPromptsStorageKey() {
    return buildLocalPromptsStorageKey(LOCAL_PROMPTS_STORAGE_VERSION, getStablePromptOwnerKey());
}

function normalizePromptVariationEntry(rawVariation = {}, fallbackId = '') {
    if (!rawVariation || typeof rawVariation !== 'object') {
        return null;
    }

    const rawId = String(
        rawVariation.id || rawVariation.variationId || rawVariation.key || rawVariation.uid || ''
    ).trim();
    const fallback = String(fallbackId || '').trim();
    const variationId = rawId || fallback;
    if (!variationId) {
        return null;
    }

    return {
        id: variationId,
        name: String(rawVariation.name || 'Основной').trim() || 'Основной',
        content: String(rawVariation.content || rawVariation.prompt || rawVariation.text || ''),
        isLocal: false
    };
}

function normalizePromptSnapshotVariations(rawVariations = []) {
    const normalized = [];
    const seenIds = new Set();
    const rawList = Array.isArray(rawVariations)
        ? rawVariations
        : rawVariations && typeof rawVariations === 'object'
            ? Object.entries(rawVariations).map(([key, value]) => {
                if (!value || typeof value !== 'object') {
                    return null;
                }
                return { ...value, id: value?.id || key };
            })
            : [];

    rawList.forEach((rawVariation, index) => {
        const fallbackId = typeof index === 'number' ? `legacy-${index + 1}` : '';
        const normalizedVariation = normalizePromptVariationEntry(rawVariation, fallbackId);
        if (!normalizedVariation) {
            return;
        }

        let variationId = normalizedVariation.id;
        while (seenIds.has(variationId)) {
            variationId = generateId();
        }
        seenIds.add(variationId);
        normalizedVariation.id = variationId;
        normalized.push(normalizedVariation);
    });

    return normalized;
}

function normalizePromptSnapshotForCache(rawSnapshot = {}) {
    const source = rawSnapshot && typeof rawSnapshot === 'object' ? rawSnapshot : {};

    const normalized = {};
    PROMPT_ROLES.forEach((role) => {
        const legacyPrompt = String(source[role + '_prompt'] || '').trim();
        const variations = normalizePromptSnapshotVariations(source[role + '_variations']);

        if (legacyPrompt) {
            normalized[role + '_prompt'] = legacyPrompt;
        }
        if (variations.length) {
            normalized[role + '_variations'] = variations;
        }
        const activeId = typeof source[role + '_activeId'] === 'string'
            ? String(source[role + '_activeId']).trim()
            : '';
        if (activeId) {
            normalized[role + '_activeId'] = activeId;
        }
    });

    return normalized;
}

function buildNormalizedPromptSnapshotState(rawSnapshot = {}) {
    const normalized = normalizePromptSnapshotForCache(rawSnapshot);
    return {
        normalized,
        hash: JSON.stringify(normalized),
        hasMeaningfulContent: firebasePromptSnapshotHasMeaningfulContent(normalized)
    };
}

function getPublicPromptRoleSnapshotFromNormalizedData(source = {}, role = '') {
    if (!PROMPT_ROLES.includes(role)) {
        return { prompt: '', variations: [], activeId: null };
    }
    const safeSource = source && typeof source === 'object' ? source : {};
    const activeId = typeof safeSource[role + '_activeId'] === 'string'
        ? String(safeSource[role + '_activeId']).trim() || null
        : null;
    return {
        prompt: String(safeSource[role + '_prompt'] || ''),
        variations: Array.isArray(safeSource[role + '_variations']) ? safeSource[role + '_variations'] : [],
        activeId
    };
}

function getPromptSnapshotRoleHashes(snapshotState = null) {
    if (!snapshotState || typeof snapshotState !== 'object') {
        return {};
    }
    if (!snapshotState.roleHashes || typeof snapshotState.roleHashes !== 'object') {
        const normalizedSnapshot = snapshotState.normalized && typeof snapshotState.normalized === 'object'
            ? snapshotState.normalized
            : normalizePromptSnapshotForCache(snapshotState.rawSnapshot || {});
        snapshotState.normalized = normalizedSnapshot;
        snapshotState.roleHashes = Object.fromEntries(
            PROMPT_ROLES.map((role) => [role, JSON.stringify(getPublicPromptRoleSnapshotFromNormalizedData(normalizedSnapshot, role))])
        );
    }
    return snapshotState.roleHashes;
}

function getPromptSnapshotRoleHash(snapshotState = null, role = '') {
    if (!PROMPT_ROLES.includes(role)) {
        return JSON.stringify({ prompt: '', variations: [], activeId: null });
    }
    const roleHashes = getPromptSnapshotRoleHashes(snapshotState);
    return typeof roleHashes[role] === 'string'
        ? roleHashes[role]
        : JSON.stringify(getPublicPromptRoleSnapshotFromNormalizedData(snapshotState?.normalized || {}, role));
}

function persistPublicPromptsSnapshot(snapshot = {}, options = {}) {
    const snapshotState = options.state || buildNormalizedPromptSnapshotState(snapshot);
    const normalized = snapshotState.normalized;
    if (!snapshotState.hasMeaningfulContent) {
        lastPublicPromptsSnapshotHash = '';
        clearCachedLocalStorageJson(LOCAL_PROMPTS_PUBLIC_SNAPSHOT_STORAGE_KEY);
        return null;
    }
    if (snapshotState.hash === lastPublicPromptsSnapshotHash) {
        return normalized;
    }
    lastPublicPromptsSnapshotHash = snapshotState.hash;

    const payload = {
        v: 1,
        t: Date.now(),
        data: normalized
    };
    setCachedLocalStorageJson(LOCAL_PROMPTS_PUBLIC_SNAPSHOT_STORAGE_KEY, payload);
    return normalized;
}

function persistPublicPromptsEmergencySnapshot(snapshot = {}, options = {}) {
    const snapshotState = options.state || buildNormalizedPromptSnapshotState(snapshot);
    const normalized = snapshotState.normalized;
    if (!snapshotState.hasMeaningfulContent) {
        lastEmergencyPromptsSnapshotHash = '';
        return null;
    }
    if (snapshotState.hash === lastEmergencyPromptsSnapshotHash) {
        return normalized;
    }
    lastEmergencyPromptsSnapshotHash = snapshotState.hash;

    const payload = {
        v: 1,
        t: Date.now(),
        data: normalized
    };
    setCachedLocalStorageJson(LOCAL_PROMPTS_EMERGENCY_BACKUP_STORAGE_KEY, payload);
    return normalized;
}

function loadCachedPublicPromptsSnapshot() {
    const cached = getCachedLocalStorageJson(LOCAL_PROMPTS_PUBLIC_SNAPSHOT_STORAGE_KEY);
    const rawData = cached && typeof cached === 'object' && cached.data
        ? cached.data
        : cached;
    const snapshotState = buildNormalizedPromptSnapshotState(rawData || {});
    if (!snapshotState.hasMeaningfulContent) {
        return null;
    }
    lastPublicPromptsSnapshotHash = snapshotState.hash;
    return snapshotState.normalized;
}

function loadCachedPublicPromptsEmergencySnapshot() {
    const cached = getCachedLocalStorageJson(LOCAL_PROMPTS_EMERGENCY_BACKUP_STORAGE_KEY);
    const rawData = cached && typeof cached === 'object' && cached.data
        ? cached.data
        : cached;
    const snapshotState = buildNormalizedPromptSnapshotState(rawData || {});
    if (!snapshotState.hasMeaningfulContent) {
        return null;
    }
    lastEmergencyPromptsSnapshotHash = snapshotState.hash;
    return snapshotState.normalized;
}

function parseLegacyPromptStorageEntry(storageKey = '') {
    const legacyPrefix = buildLocalPromptsStorageKey(LEGACY_LOCAL_PROMPTS_STORAGE_VERSION, '');
    if (!storageKey.startsWith(legacyPrefix)) return null;
    const ownerKey = storageKey.slice(legacyPrefix.length);
    const separatorIndex = ownerKey.indexOf(':');
    return {
        ownerKey,
        ownerRole: separatorIndex > 0 ? ownerKey.slice(0, separatorIndex) : '',
        storageKey
    };
}

function getKnownLocalPromptStoreLogins() {
    const knownLogins = new Set();
    const currentLogin = normalizeLogin(
        currentUser?.login
        || auth?.currentUser?.email
        || getAuthSession()?.login
        || getCachedStorageValue(USER_LOGIN_KEY, '')
        || ''
    );
    if (currentLogin) {
        knownLogins.add(currentLogin);
    }

    Object.entries(loadLocalUsersStore() || {}).forEach(([key, item]) => {
        const normalized = normalizeUserRecord(item, '', key);
        if (normalized?.login) {
            knownLogins.add(normalized.login);
        }
    });

    return [...knownLogins];
}

function canAdoptAllLegacyPromptStores() {
    const knownLogins = getKnownLocalPromptStoreLogins();
    return knownLogins.length <= 1;
}

function getLegacyLocalPromptsStorageEntries() {
    const currentStorageKey = getLocalPromptsStorageKey();
    const currentNameEntries = getCurrentLegacyPromptOwnerKeys()
        .map((ownerKey) => {
            const separatorIndex = ownerKey.indexOf(':');
            return {
                ownerKey,
                ownerRole: separatorIndex > 0 ? ownerKey.slice(0, separatorIndex) : '',
                storageKey: buildLocalPromptsStorageKey(LEGACY_LOCAL_PROMPTS_STORAGE_VERSION, ownerKey)
            };
        })
        .filter((entry) => entry.storageKey && entry.storageKey !== currentStorageKey);

    const scannedEntries = canAdoptAllLegacyPromptStores()
        ? listSafeLocalStorageKeysByPrefix(buildLocalPromptsStorageKey(LEGACY_LOCAL_PROMPTS_STORAGE_VERSION, ''))
            .map((key) => parseLegacyPromptStorageEntry(key))
            .filter((entry) => entry && entry.storageKey !== currentStorageKey)
        : [];

    return [...currentNameEntries, ...scannedEntries]
        .filter((entry, index, list) => (
            entry?.storageKey
            && list.findIndex((candidate) => candidate.storageKey === entry.storageKey) === index
        ));
}

function readPromptOverridesStoreByKey(storageKey) {
    return normalizePromptOverridesStore(getCachedLocalStorageJson(storageKey));
}

function readPromptOverridesStoreStateByKey(storageKey) {
    return buildNormalizedPromptOverridesStoreState(getCachedLocalStorageJson(storageKey));
}

function getPromptOverridesRoleDataFromStore(store = {}, role) {
    const normalized = normalizePromptOverridesStore(store);
    return {
        variations: Array.isArray(normalized[role + '_variations']) ? normalized[role + '_variations'] : [],
        activeId: typeof normalized[role + '_activeId'] === 'string' ? normalized[role + '_activeId'] : null
    };
}

function promptOverridesRoleDataHasData(roleData = null) {
    return !!(
        roleData
        && (Array.isArray(roleData.variations) && roleData.variations.length > 0 || roleData.activeId)
    );
}

function buildPromptOverridesRoleDataMap(store = {}) {
    const normalizedStore = store && typeof store === 'object' ? store : {};
    return Object.fromEntries(
        PROMPT_ROLES.map((role) => [role, getPromptOverridesRoleSnapshotFromNormalizedStore(normalizedStore, role)])
    );
}

function mergeLegacyPromptOverridesStores(entries = []) {
    const merged = {};

    PROMPT_ROLES.forEach((role) => {
        const seenIds = new Set();
        const mergedVariations = [];
        let mergedActiveId = null;

        entries.forEach((entry) => {
            const roleData = entry?.roleDataMap?.[role] || { variations: [], activeId: null };
            if (!mergedActiveId && typeof roleData.activeId === 'string' && roleData.activeId.trim()) {
                mergedActiveId = roleData.activeId.trim();
            }
            (roleData.variations || []).forEach((variation) => {
                if (!variation || typeof variation.id !== 'string' || seenIds.has(variation.id)) return;
                seenIds.add(variation.id);
                mergedVariations.push(variation);
            });
        });

        merged[role + '_variations'] = mergedVariations;
        merged[role + '_activeId'] = mergedVariations.some((variation) => variation.id === mergedActiveId)
            ? mergedActiveId
            : null;
    });

    return normalizePromptOverridesStore(merged);
}

function clearLegacyLocalPromptsStorageKeys() {
    if (didClearLegacyLocalPromptsStorageKeys) return;
    didClearLegacyLocalPromptsStorageKeys = true;
    getLegacyLocalPromptsStorageEntries().forEach((entry) => {
        clearCachedLocalStorageJson(entry.storageKey);
    });
}

function loadLocalPromptsStoreState() {
    const stableStorageKey = getLocalPromptsStorageKey();
    const stableStoreState = readPromptOverridesStoreStateByKey(stableStorageKey);
    const legacyEntries = getLegacyLocalPromptsStorageEntries()
        .map((entry) => {
            const storeState = readPromptOverridesStoreStateByKey(entry.storageKey);
            return {
                ...entry,
                store: storeState.normalized,
                storeState,
                roleDataMap: buildPromptOverridesRoleDataMap(storeState.normalized)
            };
        })
        .filter((entry) => entry.storeState.hasData);

    if (!legacyEntries.length) {
        return stableStoreState;
    }

    const migratedStoreState = buildNormalizedPromptOverridesStoreState(mergeLegacyPromptOverridesStores([
        {
            ownerRole: '',
            storageKey: stableStorageKey,
            store: stableStoreState.normalized,
            storeState: stableStoreState,
            roleDataMap: buildPromptOverridesRoleDataMap(stableStoreState.normalized)
        },
        ...legacyEntries
    ]));
    if (stableStoreState.hash === migratedStoreState.hash) {
        return stableStoreState;
    }

    if (!migratedStoreState.hasData) {
        return stableStoreState;
    }

    setCachedLocalStorageJson(stableStorageKey, migratedStoreState.normalized);
    legacyEntries.forEach((entry) => {
        clearCachedLocalStorageJson(entry.storageKey);
    });
    return migratedStoreState;
}

function loadLocalPromptsStore() {
    return loadLocalPromptsStoreState().normalized;
}

function normalizePromptOverrideVariation(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id || '').trim();
    if (!id) return null;
    const baseVariationId = String(raw.baseVariationId || '').trim();
    return {
        id,
        name: String(raw.name || 'Локальный').trim() || 'Локальный',
        content: unescapeMarkdown(raw.content || ''),
        isLocal: true,
        baseVariationId: baseVariationId || null
    };
}

function normalizePromptOverridesStore(rawStore = {}) {
    const source = rawStore && typeof rawStore === 'object' ? rawStore : {};
    const normalized = {};

    PROMPT_ROLES.forEach((role) => {
        const rawVariations = Array.isArray(source[role + '_variations'])
            ? source[role + '_variations']
            : [];
        const seenIds = new Set();
        const variations = rawVariations
            .map((item) => normalizePromptOverrideVariation(item))
            .filter((item) => {
                if (!item || seenIds.has(item.id)) return false;
                seenIds.add(item.id);
                return true;
            });
        const requestedActiveId = typeof source[role + '_activeId'] === 'string'
            ? String(source[role + '_activeId']).trim()
            : '';

        normalized[role + '_variations'] = variations;
        normalized[role + '_activeId'] = variations.some((item) => item.id === requestedActiveId)
            ? requestedActiveId
            : null;
    });

    return normalized;
}

function promptOverridesStoreHasData(store = {}) {
    const normalized = normalizePromptOverridesStore(store);
    return PROMPT_ROLES.some((role) => {
        const variations = normalized[role + '_variations'] || [];
        const activeId = normalized[role + '_activeId'] || null;
        return variations.length > 0 || !!activeId;
    });
}

function getPromptOverridesStore() {
    return currentUserPromptOverridesStoreState?.normalized
        || (currentUserPromptOverridesStore !== null
            ? normalizePromptOverridesStore(currentUserPromptOverridesStore)
            : null)
        || loadLocalPromptsStoreState().normalized;
}

function persistPromptOverridesStoreLocally(store = {}, options = {}) {
    const storeState = options.state || buildNormalizedPromptOverridesStoreState(store);
    const normalized = storeState.normalized;
    if (storeState.hasData) {
        setCachedLocalStorageJson(getLocalPromptsStorageKey(), normalized);
    } else {
        clearCachedLocalStorageJson(getLocalPromptsStorageKey());
    }
    clearLegacyLocalPromptsStorageKeys();
    return normalized;
}

function getPromptOverridesDbPath(login = currentUser?.login || '') {
    const normalizedLogin = normalizeLogin(login);
    if (!normalizedLogin) return '';
    return `${PROMPT_OVERRIDES_DB_PATH}/${loginToStorageKey(normalizedLogin)}`;
}

function canSyncPromptOverrides(user = currentUser) {
    if (!db || !hasAdminAccount(user)) return false;
    return !!normalizeLogin(user?.login || '');
}

function buildPromptOverridesPayload() {
    const payload = {};

    PROMPT_ROLES.forEach((role) => {
        const roleState = promptsData[role] || { variations: [], activeId: null };
        const localVariations = (roleState.variations || [])
            .filter((variation) => variation && variation.isLocal)
            .map((variation) => ({
                id: variation.id,
                name: variation.name || 'Локальный',
                content: variation.content || '',
                isLocal: true,
                baseVariationId: typeof variation.baseVariationId === 'string' ? variation.baseVariationId : null
            }));
        const activeId = localVariations.some((variation) => variation.id === roleState.activeId)
            ? roleState.activeId
            : null;

        payload[role + '_variations'] = localVariations;
        payload[role + '_activeId'] = activeId;
    });

    return normalizePromptOverridesStore(payload);
}

function buildNormalizedPromptOverridesStoreState(rawStore = {}) {
    const normalized = normalizePromptOverridesStore(rawStore);
    return {
        normalized,
        hash: JSON.stringify(normalized),
        hasData: promptOverridesStoreHasData(normalized)
    };
}

function getPromptOverridesRoleSnapshotFromNormalizedStore(store = {}, role = '') {
    if (!PROMPT_ROLES.includes(role)) {
        return { variations: [], activeId: null };
    }
    const normalizedStore = store && typeof store === 'object' ? store : {};
    return {
        variations: Array.isArray(normalizedStore[role + '_variations']) ? normalizedStore[role + '_variations'] : [],
        activeId: normalizedStore[role + '_activeId'] || null
    };
}

function getPromptOverridesStoreRoleHashes(storeState = null) {
    if (!storeState || typeof storeState !== 'object') {
        return {};
    }
    if (!storeState.roleHashes || typeof storeState.roleHashes !== 'object') {
        const normalizedStore = storeState.normalized && typeof storeState.normalized === 'object'
            ? storeState.normalized
            : normalizePromptOverridesStore(storeState.rawStore || {});
        storeState.normalized = normalizedStore;
        storeState.roleHashes = Object.fromEntries(
            PROMPT_ROLES.map((role) => [role, JSON.stringify(getPromptOverridesRoleSnapshotFromNormalizedStore(normalizedStore, role))])
        );
    }
    return storeState.roleHashes;
}

function getPromptOverridesStoreRoleHash(storeState = null, role = '') {
    if (!PROMPT_ROLES.includes(role)) {
        return JSON.stringify({ variations: [], activeId: null });
    }
    const roleHashes = getPromptOverridesStoreRoleHashes(storeState);
    return typeof roleHashes[role] === 'string'
        ? roleHashes[role]
        : JSON.stringify(getPromptOverridesRoleSnapshotFromNormalizedStore(storeState?.normalized || {}, role));
}

function getPromptOverridesRoleSnapshot(store, role) {
    return getPromptOverridesRoleSnapshotFromNormalizedStore(normalizePromptOverridesStore(store || {}), role);
}

function recordDirtyPromptOverrideRoles(baseStore, nextStore) {
    const baseStoreState = buildNormalizedPromptOverridesStoreState(baseStore || {});
    const nextStoreState = buildNormalizedPromptOverridesStoreState(nextStore || {});

    PROMPT_ROLES.forEach((role) => {
        const before = getPromptOverridesStoreRoleHash(baseStoreState, role);
        const after = getPromptOverridesStoreRoleHash(nextStoreState, role);
        if (before !== after) {
            dirtyPromptOverrideRoles.add(role);
        }
    });
}

function getPublicPromptRoleSnapshotFromFirebaseData(source = {}, role = '') {
    if (!PROMPT_ROLES.includes(role)) {
        return { prompt: '', variations: [], activeId: null };
    }
    const safeSource = source && typeof source === 'object' ? source : {};
    const normalizedRoleSource = {
        [role + '_prompt']: String(safeSource[role + '_prompt'] || ''),
        [role + '_variations']: normalizePromptSnapshotVariations(safeSource[role + '_variations']),
        [role + '_activeId']: typeof safeSource[role + '_activeId'] === 'string'
            ? String(safeSource[role + '_activeId']).trim() || null
            : null
    };
    return getPublicPromptRoleSnapshotFromNormalizedData(normalizedRoleSource, role);
}

function getCurrentPublicPromptRoleSnapshot(role = '') {
    if (!PROMPT_ROLES.includes(role)) {
        return { prompt: '', variations: [], activeId: null };
    }
    const rolePayload = buildPromptsSyncPayload([role]);
    return getPublicPromptRoleSnapshotFromFirebaseData(rolePayload, role);
}

function getPublicPromptRoleSnapshotHash(source, role = '') {
    return JSON.stringify(getPublicPromptRoleSnapshotFromFirebaseData(source, role));
}

function rememberPromptEditBaseline(role = '') {
    if (!PROMPT_ROLES.includes(role)) return;
    if (dirtyPublicPromptRoles.has(role) && promptEditRemoteBaselineHashes[role]) return;
    promptEditRemoteBaselineHashes[role] = getPromptSnapshotRoleHash(lastPromptsFirebaseSnapshotState, role);
}

function clearPromptEditBaseline(role = '') {
    if (!PROMPT_ROLES.includes(role)) return;
    delete promptEditRemoteBaselineHashes[role];
}

function setPromptSyncConflictMessage(role = '', message = '') {
    if (!PROMPT_ROLES.includes(role)) return;
    const normalizedMessage = String(message || '').trim();
    if (normalizedMessage) {
        promptSyncConflictMessages[role] = normalizedMessage;
    } else {
        delete promptSyncConflictMessages[role];
    }
}

function renderPromptSyncConflictNotice(role = getActiveRole()) {
    if (!promptSyncConflictNotice) return;
    const message = PROMPT_ROLES.includes(role) ? String(promptSyncConflictMessages[role] || '').trim() : '';
    promptSyncConflictNotice.hidden = !message;
    promptSyncConflictNotice.textContent = message;
}

function preservePromptConflictAsLocalDraft(role = '') {
    if (!PROMPT_ROLES.includes(role)) return false;
    const roleState = promptsData[role];
    if (!roleState || !Array.isArray(roleState.variations)) return false;

    const activeVariation = roleState.variations.find((variation) => variation.id === roleState.activeId) || null;
    if (!activeVariation || activeVariation.isLocal) return false;

    let localOverride = findLocalOverrideForPublicVariation(role, activeVariation);
    if (!localOverride) {
        localOverride = {
            id: generateId(),
            baseVariationId: activeVariation.id,
            name: getPromptVariationDisplayName(activeVariation) || activeVariation.name || 'Промпт',
            content: activeVariation.content || '',
            isLocal: true
        };
        roleState.variations.push(localOverride);
    } else {
        localOverride.baseVariationId = activeVariation.id;
        localOverride.name = getPromptVariationDisplayName(activeVariation) || activeVariation.name || 'Промпт';
        localOverride.content = activeVariation.content || '';
    }

    roleState.activeId = localOverride.id;
    saveLocalPromptsData();
    dirtyPublicPromptRoles.delete(role);
    clearPromptEditBaseline(role);
    setPromptSyncConflictMessage(
        role,
        'Публичный промпт был изменён в другом окне или другим админом. Ваши правки сохранены как локальный скрытый draft; сравните и опубликуйте его вручную, если нужно.'
    );
    return true;
}

function resolvePromptSyncConflicts(remoteSnapshot = {}) {
    const remoteSnapshotState = pendingPromptsFirebaseSnapshotState
        && pendingPromptsFirebaseSnapshot === remoteSnapshot
        ? pendingPromptsFirebaseSnapshotState
        : buildNormalizedPromptSnapshotState(remoteSnapshot);
    const conflictRoles = [];
    dirtyPublicPromptRoles.forEach((role) => {
        if (!PROMPT_ROLES.includes(role)) return;
        const baselineHash = promptEditRemoteBaselineHashes[role];
        if (!baselineHash) return;
        const remoteHash = getPromptSnapshotRoleHash(remoteSnapshotState, role);
        if (remoteHash !== baselineHash) {
            conflictRoles.push(role);
        }
    });

    conflictRoles.forEach((role) => {
        preservePromptConflictAsLocalDraft(role);
    });

    return conflictRoles;
}

function buildMergedPromptsSnapshot(firebaseData = {}) {
    const mergedSnapshot = { ...(firebaseData || {}) };
    if (!dirtyPublicPromptRoles.size) {
        return mergedSnapshot;
    }

    dirtyPublicPromptRoles.forEach((role) => {
        if (!PROMPT_ROLES.includes(role)) return;
        const rolePayload = buildPromptsSyncPayload([role]);
        mergedSnapshot[role + '_prompt'] = rolePayload[role + '_prompt'];
        mergedSnapshot[role + '_variations'] = rolePayload[role + '_variations'];
        mergedSnapshot[role + '_activeId'] = rolePayload[role + '_activeId'];
    });

    return mergedSnapshot;
}

function buildMergedPromptOverridesStore(remoteStore = {}) {
    const mergedStore = normalizePromptOverridesStore(remoteStore || {});
    if (!dirtyPromptOverrideRoles.size) {
        return mergedStore;
    }

    const localStore = buildPromptOverridesPayload();
    dirtyPromptOverrideRoles.forEach((role) => {
        if (!PROMPT_ROLES.includes(role)) return;
        mergedStore[role + '_variations'] = localStore[role + '_variations'] || [];
        mergedStore[role + '_activeId'] = localStore[role + '_activeId'] || null;
    });

    return normalizePromptOverridesStore(mergedStore);
}

function applyDeferredPromptRemoteState() {
    if (isUserEditing) return false;

    let didApply = false;

    if (pendingPromptOverridesRemoteStore !== null) {
        const pendingPromptOverridesState = pendingPromptOverridesRemoteStoreState
            || buildNormalizedPromptOverridesStoreState(pendingPromptOverridesRemoteStore);
        const mergedPromptOverridesStore = buildMergedPromptOverridesStore(pendingPromptOverridesState.normalized);
        const mergedPromptOverridesStoreState = buildNormalizedPromptOverridesStoreState(mergedPromptOverridesStore);
        currentUserPromptOverridesStore = mergedPromptOverridesStoreState.normalized;
        currentUserPromptOverridesStoreState = mergedPromptOverridesStoreState;
        persistPromptOverridesStoreLocally(mergedPromptOverridesStoreState.normalized, { state: mergedPromptOverridesStoreState });
        lastPromptOverridesRemoteHash = pendingPromptOverridesRemoteHash;
        pendingPromptOverridesRemoteStore = null;
        pendingPromptOverridesRemoteStoreState = null;
        pendingPromptOverridesRemoteHash = '';
        didApply = true;
    }

    if (pendingPromptsFirebaseSnapshot !== null) {
        const remoteSnapshot = pendingPromptsFirebaseSnapshot;
        resolvePromptSyncConflicts(remoteSnapshot);
        const mergedSnapshot = buildMergedPromptsSnapshot(remoteSnapshot);
        pendingPromptsFirebaseSnapshot = null;
        pendingPromptsFirebaseSnapshotState = null;
        const didApplyPrompts = initPromptsData(mergedSnapshot);
        didApply = didApply || didApplyPrompts;
    }

    if (!didApply) {
        return false;
    }

    if (dirtyPublicPromptRoles.size) {
        savePromptsToFirebase();
    }
    if (dirtyPromptOverrideRoles.size || queuedPromptOverridesPayload) {
        queuePromptOverridesSave();
    }
    return true;
}

function beginPromptEditing(role = '') {
    isUserEditing = true;
    if (role) {
        currentEditingPromptRole = role;
        rememberPromptEditBaseline(role);
    }
}

function endPromptEditing(role = '') {
    const resolvedRole = role || currentEditingPromptRole || '';
    if (!role || currentEditingPromptRole === role) {
        currentEditingPromptRole = '';
    }
    isUserEditing = false;
    if (resolvedRole && !dirtyPublicPromptRoles.has(resolvedRole)) {
        clearPromptEditBaseline(resolvedRole);
    }
    applyDeferredPromptRemoteState();
}

function schedulePromptEditingEnd(role = '', delayMs = 2000) {
    clearTimeout(editingTimeout);
    editingTimeout = setTimeout(() => {
        endPromptEditing(role);
        debugLog('isUserEditing set to false (timeout)');
    }, delayMs);
}

function clearPromptOverridesSyncRetry() {
    if (!promptOverridesSyncRetryTimerId) return;
    clearTimeout(promptOverridesSyncRetryTimerId);
    promptOverridesSyncRetryTimerId = null;
}

function schedulePromptOverridesSyncRetry(payload = null) {
    const payloadState = payload
        ? buildNormalizedPromptOverridesStoreState(payload)
        : (queuedPromptOverridesPayloadState || buildNormalizedPromptOverridesStoreState(queuedPromptOverridesPayload || buildPromptOverridesPayload()));
    queuedPromptOverridesPayload = payloadState.normalized;
    queuedPromptOverridesPayloadState = payloadState;
    if (promptOverridesSyncRetryTimerId) {
        return false;
    }
    promptOverridesSyncRetryTimerId = window.setTimeout(() => {
        promptOverridesSyncRetryTimerId = null;
        void savePromptOverridesToFirebaseNow();
    }, PROMPT_REMOTE_SYNC_RETRY_DELAY_MS);
    return true;
}

function queuePromptOverridesSave(payload = null) {
    if (!canSyncPromptOverrides()) return false;
    const payloadState = buildNormalizedPromptOverridesStoreState(payload || buildPromptOverridesPayload());
    const normalizedPayload = payloadState.normalized;
    if (payloadState.hash === lastPromptOverridesRemoteHash) {
        queuedPromptOverridesPayload = null;
        queuedPromptOverridesPayloadState = null;
        if (currentUserPromptOverridesSaveTimer) {
            clearTimeout(currentUserPromptOverridesSaveTimer);
            currentUserPromptOverridesSaveTimer = null;
        }
        clearPromptOverridesSyncRetry();
        return false;
    }

    queuedPromptOverridesPayload = normalizedPayload;
    queuedPromptOverridesPayloadState = payloadState;
    if (currentUserPromptOverridesSaveTimer) {
        clearTimeout(currentUserPromptOverridesSaveTimer);
    }
    currentUserPromptOverridesSaveTimer = window.setTimeout(() => {
        void savePromptOverridesToFirebaseNow();
    }, 800);
    return true;
}

async function savePromptOverridesToFirebaseNow(payload = null, options = {}) {
    if (currentUserPromptOverridesSaveTimer) {
        clearTimeout(currentUserPromptOverridesSaveTimer);
        currentUserPromptOverridesSaveTimer = null;
    }

    const payloadState = payload
        ? buildNormalizedPromptOverridesStoreState(payload)
        : (queuedPromptOverridesPayloadState || buildNormalizedPromptOverridesStoreState(queuedPromptOverridesPayload || buildPromptOverridesPayload()));
    const normalizedPayload = payloadState.normalized;

    if (promptOverridesSyncInFlight) {
        schedulePromptOverridesSyncRetry(normalizedPayload);
        return false;
    }

    if (pendingPromptOverridesRemoteStore !== null) {
        queuedPromptOverridesPayload = normalizedPayload;
        queuedPromptOverridesPayloadState = payloadState;
        return false;
    }

    queuedPromptOverridesPayload = null;
    queuedPromptOverridesPayloadState = null;

    if (!canSyncPromptOverrides()) {
        return false;
    }

    const normalizedLogin = normalizeLogin(
        currentUserPromptOverridesListenerLogin || currentUser?.login || ''
    );
    if (!normalizedLogin) {
        return false;
    }

    if (!options.force && payloadState.hash === lastPromptOverridesRemoteHash) {
        return false;
    }

    const remotePath = getPromptOverridesDbPath(normalizedLogin);
    if (!remotePath) {
        return false;
    }

    try {
        promptOverridesSyncInFlight = true;
        await set(
            ref(db, remotePath),
            payloadState.hasData ? normalizedPayload : null
        );
        clearPromptOverridesSyncRetry();
        currentUserPromptOverridesStore = normalizedPayload;
        currentUserPromptOverridesStoreState = payloadState;
        lastPromptOverridesRemoteHash = payloadState.hash;
        dirtyPromptOverrideRoles.clear();
        return true;
    } catch (error) {
        console.error('Failed to sync prompt overrides:', error);
        schedulePromptOverridesSyncRetry(normalizedPayload);
        return false;
    } finally {
        promptOverridesSyncInFlight = false;
    }
}

function stopCurrentUserPromptOverridesSubscription() {
    clearCurrentUserPromptOverridesRecovery();
    clearPromptOverridesSyncRetry();
    promptOverridesSyncInFlight = false;
    currentUserPromptOverridesSubscriptionHealthy = false;
    if (typeof currentUserPromptOverridesUnsubscribe === 'function') {
        currentUserPromptOverridesUnsubscribe();
    }
    currentUserPromptOverridesUnsubscribe = null;
    currentUserPromptOverridesListenerLogin = '';
    currentUserPromptOverridesStore = null;
    currentUserPromptOverridesStoreState = null;
    queuedPromptOverridesPayload = null;
    queuedPromptOverridesPayloadState = null;
    lastPromptOverridesRemoteHash = '';
    pendingPromptOverridesRemoteStore = null;
    pendingPromptOverridesRemoteStoreState = null;
    pendingPromptOverridesRemoteHash = '';
    dirtyPromptOverrideRoles.clear();
    if (currentUserPromptOverridesSaveTimer) {
        clearTimeout(currentUserPromptOverridesSaveTimer);
        currentUserPromptOverridesSaveTimer = null;
    }
}

function clearCurrentUserPromptOverridesRecovery() {
    if (!currentUserPromptOverridesRecoveryTimerId) return;
    clearTimeout(currentUserPromptOverridesRecoveryTimerId);
    currentUserPromptOverridesRecoveryTimerId = null;
}

function hasHealthyCurrentUserPromptOverridesSubscription() {
    return typeof currentUserPromptOverridesUnsubscribe === 'function' && currentUserPromptOverridesSubscriptionHealthy;
}

function stopCurrentUserPromptOverridesListenerTransport() {
    clearCurrentUserPromptOverridesRecovery();
    currentUserPromptOverridesSubscriptionHealthy = false;
    if (typeof currentUserPromptOverridesUnsubscribe === 'function') {
        try {
            currentUserPromptOverridesUnsubscribe();
        } catch (error) {
            console.warn('Failed to stop prompt overrides live listener:', error);
        }
    }
    currentUserPromptOverridesUnsubscribe = null;
    currentUserPromptOverridesListenerLogin = '';
}

function scheduleCurrentUserPromptOverridesRecovery(login = currentUserPromptOverridesListenerLogin || currentUser?.login || '', reason = '', delayMs = PROTECTED_REALTIME_RECOVERY_DELAY_MS) {
    const normalizedLogin = normalizeLogin(login);
    if (!normalizedLogin || currentUserPromptOverridesRecoveryTimerId) {
        return false;
    }
    currentUserPromptOverridesRecoveryTimerId = setTimeout(() => {
        currentUserPromptOverridesRecoveryTimerId = null;
        if (!currentUser || normalizeLogin(currentUser.login) !== normalizedLogin) return;
        const syncCandidateUser = { ...currentUser, login: normalizedLogin };
        if (!canSyncPromptOverrides(syncCandidateUser)) return;
        debugLog('Recovering prompt overrides live listener', { reason, login: normalizedLogin });
        startCurrentUserPromptOverridesSubscription(normalizedLogin);
    }, Math.max(250, Number(delayMs) || PROTECTED_REALTIME_RECOVERY_DELAY_MS));
    return true;
}

function startCurrentUserPromptOverridesSubscription(login = currentUser?.login || '') {
    const normalizedLogin = normalizeLogin(login);
    const syncCandidateUser = currentUser
        ? { ...currentUser, login: normalizedLogin }
        : { login: normalizedLogin, role: 'user' };
    if (!canSyncPromptOverrides(syncCandidateUser)) {
        stopCurrentUserPromptOverridesSubscription();
        return false;
    }
    if (
        hasHealthyCurrentUserPromptOverridesSubscription()
        && currentUserPromptOverridesListenerLogin === normalizedLogin
    ) {
        return true;
    }

    if (
        currentUserPromptOverridesListenerLogin
        && currentUserPromptOverridesListenerLogin !== normalizedLogin
    ) {
        stopCurrentUserPromptOverridesSubscription();
    } else {
        stopCurrentUserPromptOverridesListenerTransport();
    }
    currentUserPromptOverridesListenerLogin = normalizedLogin;
    currentUserPromptOverridesSubscriptionHealthy = false;
    const remotePath = getPromptOverridesDbPath(normalizedLogin);
    if (!remotePath) {
        return false;
    }

    currentUserPromptOverridesUnsubscribe = onValue(
        ref(db, remotePath),
        (snapshot) => {
            if (!currentUser || normalizeLogin(currentUser.login) !== normalizedLogin) return;
            clearCurrentUserPromptOverridesRecovery();
            currentUserPromptOverridesSubscriptionHealthy = true;

            const remoteStoreState = buildNormalizedPromptOverridesStoreState(snapshot.exists() ? snapshot.val() : {});
            const localStoreState = loadLocalPromptsStoreState();
            const shouldBootstrapRemote = !remoteStoreState.hasData && localStoreState.hasData;
            const effectiveStoreState = shouldBootstrapRemote ? localStoreState : remoteStoreState;
            const effectiveStore = effectiveStoreState.normalized;

            if (shouldBootstrapRemote) {
                queuePromptOverridesSave(effectiveStore);
            }

            if (isUserEditing || lastPromptsFirebaseSnapshot === null) {
                pendingPromptOverridesRemoteStore = effectiveStore;
                pendingPromptOverridesRemoteStoreState = effectiveStoreState;
                pendingPromptOverridesRemoteHash = remoteStoreState.hash;
                return;
            }

            currentUserPromptOverridesStore = effectiveStore;
            currentUserPromptOverridesStoreState = effectiveStoreState;
            persistPromptOverridesStoreLocally(effectiveStore, { state: effectiveStoreState });
            lastPromptOverridesRemoteHash = remoteStoreState.hash;
            initPromptsData(lastPromptsFirebaseSnapshot || {});
        },
        (error) => {
            currentUserPromptOverridesSubscriptionHealthy = false;
            console.error('Prompt overrides live sync failed:', error);
            const localStoreState = loadLocalPromptsStoreState();
            currentUserPromptOverridesStore = localStoreState.normalized;
            currentUserPromptOverridesStoreState = localStoreState;
            pendingPromptOverridesRemoteStore = null;
            pendingPromptOverridesRemoteStoreState = null;
            pendingPromptOverridesRemoteHash = '';
            if (!isUserEditing && lastPromptsFirebaseSnapshot !== null) {
                initPromptsData(lastPromptsFirebaseSnapshot || {});
            }
            scheduleCurrentUserPromptOverridesRecovery(normalizedLogin, 'prompt-overrides-live-sync-failed');
        }
    );
    return true;
}

function getLocalPromptsRoleData(role) {
    const store = getPromptOverridesStore();
    const rawVariations = Array.isArray(store[role + '_variations']) ? store[role + '_variations'] : [];
    const variations = rawVariations
        .filter(v => v && typeof v === 'object' && typeof v.id === 'string')
        .map(v => ({
            id: v.id,
            name: v.name || 'Локальный',
            content: unescapeMarkdown(v.content || ''),
            isLocal: true,
            baseVariationId: typeof v.baseVariationId === 'string' ? v.baseVariationId : null
        }));
    return {
        variations,
        activeId: typeof store[role + '_activeId'] === 'string' ? store[role + '_activeId'] : null
    };
}

function saveLocalPromptsData(options = {}) {
    const payloadState = buildNormalizedPromptOverridesStoreState(buildPromptOverridesPayload());
    const normalizedPayload = payloadState.normalized;
    recordDirtyPromptOverrideRoles(currentUserPromptOverridesStoreState?.normalized || currentUserPromptOverridesStore, normalizedPayload);
    persistPromptOverridesStoreLocally(normalizedPayload, { state: payloadState });
    if (currentUserPromptOverridesStore !== null || canSyncPromptOverrides()) {
        currentUserPromptOverridesStore = normalizedPayload;
        currentUserPromptOverridesStoreState = payloadState;
    }
    if (options.syncRemote === false || !canSyncPromptOverrides()) {
        return normalizedPayload;
    }
    if (pendingPromptOverridesRemoteStore !== null) {
        queuedPromptOverridesPayload = normalizedPayload;
        queuedPromptOverridesPayloadState = payloadState;
        return normalizedPayload;
    }
    queuePromptOverridesSave(payloadState.normalized);
    return normalizedPayload;
}

function getActiveRole() {
    const activeTab = document.querySelector('.instruction-tab.active');
    return activeTab ? activeTab.dataset.instruction : 'client';
}

function getPublicActiveId(role) {
    const publicVariations = (promptsData[role]?.variations || []).filter(v => !v.isLocal);
    if (!publicVariations.length) {
        publicActiveIds[role] = null;
        return null;
    }
    if (publicVariations.some(v => v.id === publicActiveIds[role])) {
        return publicActiveIds[role];
    }
    publicActiveIds[role] = publicVariations[0].id;
    return publicActiveIds[role];
}

function getPublicVariations(role) {
    return (promptsData[role]?.variations || [])
        .filter(v => !v.isLocal)
        .map(v => ({
            id: v.id,
            name: v.name,
            content: v.content
        }));
}

function getPublicActiveContent(role) {
    const activeId = getPublicActiveId(role);
    if (!activeId) return '';
    const variation = (promptsData[role]?.variations || []).find(v => !v.isLocal && v.id === activeId);
    return variation ? (variation.content || '') : '';
}

function getVisibleVariations(role, isAdminUser = isAdmin()) {
    const variations = promptsData[role]?.variations || [];
    const shouldHideAttestation = !isAdminUser && !isAttestationMode;
    const hiddenBaseIds = new Set();
    if (isAdminUser) {
        variations.forEach((variation) => {
            if (!variation?.isLocal) return;
            const basePublicVariation = findBasePublicVariationForLocal(role, variation);
            if (isBrokenEmptyLocalOverride(role, variation, basePublicVariation)) return;
            if (basePublicVariation?.id) {
                hiddenBaseIds.add(basePublicVariation.id);
            }
        });
    }
    return variations.filter((variation) => {
        if (!isAdminUser && variation?.isLocal) return false;
        if (isAdminUser && !variation?.isLocal && hiddenBaseIds.has(variation.id)) return false;
        if (shouldHideAttestation && (variation?.name || '').trim().toLowerCase() === 'аттестация') return false;
        return true;
    });
}

function getActiveVariation(role = getActiveRole()) {
    const variations = promptsData[role]?.variations || [];
    const selected = variations.find(v => v.id === promptsData[role]?.activeId) || null;
    if (isAdmin()) {
        if (selected?.isLocal && isBrokenEmptyLocalOverride(role, selected)) {
            return findBasePublicVariationForLocal(role, selected) || selected;
        }
        if (selected && !selected.isLocal) {
            const localOverride = findLocalOverrideForPublicVariation(role, selected);
            if (localOverride) {
                if (!hasMeaningfulPromptContent(localOverride.content)
                    && hasMeaningfulPromptContent(selected.content)) {
                    return selected;
                }
                return localOverride;
            }
        }
        return selected;
    }
    const visibleVariations = getVisibleVariations(role, false);
    if (!visibleVariations.length) return null;
    if (selected && visibleVariations.some(v => v.id === selected.id)) {
        return selected;
    }
    const publicActiveId = getPublicActiveId(role);
    return visibleVariations.find(v => v.id === publicActiveId) || visibleVariations[0] || null;
}

function updatePromptVisibilityButton() {
    if (!promptVisibilityBtn) return;

    if (!isAdmin()) {
        promptVisibilityBtn.style.display = 'none';
        return;
    }

    const activeVariation = getActiveVariation();
    if (!activeVariation) {
        promptVisibilityBtn.style.display = 'none';
        return;
    }

    promptVisibilityBtn.style.display = '';
    const isLocal = !!activeVariation.isLocal;
    promptVisibilityBtn.innerHTML = isLocal ? EYE_OPEN_ICON : EYE_OFF_ICON;
    promptVisibilityBtn.classList.toggle('state-hidden', isLocal);
    const tooltipText = isLocal
        ? 'Показать промпт пользователям'
        : 'Скрыть промпт от пользователей';
    setCustomTooltip(promptVisibilityBtn, tooltipText);
}

function updatePromptHistoryButton() {
    if (!promptHistoryBtn) return;

    if (!isAdmin()) {
        promptHistoryBtn.style.display = 'none';
        return;
    }

    const activeVariation = getActiveVariation();
    promptHistoryBtn.style.display = activeVariation ? '' : 'none';
}

function getPromptCompareContext(role = getActiveRole()) {
    if (!PROMPT_ROLES.includes(role)) return null;
    const activeVariation = getActiveVariation(role);
    if (!activeVariation) return null;

    if (activeVariation.isLocal) {
        const publicVariation = findBasePublicVariationForLocal(role, activeVariation);
        if (!publicVariation) return null;
        return {
            role,
            publicVariation,
            draftVariation: activeVariation,
            activeVariation
        };
    }

    const draftVariation = findLocalOverrideForPublicVariation(role, activeVariation);
    if (!draftVariation) return null;

    return {
        role,
        publicVariation: activeVariation,
        draftVariation,
        activeVariation
    };
}

function getPromptHistoryVariation(role = getActiveRole(), activeVariation = getActiveVariation(role)) {
    if (!PROMPT_ROLES.includes(role) || !activeVariation) return null;
    if (activeVariation.isLocal) {
        return findBasePublicVariationForLocal(role, activeVariation);
    }
    return activeVariation;
}

function getPromptRollbackEntry(role = getActiveRole(), historyVariation = getPromptHistoryVariation(role)) {
    if (!historyVariation || historyVariation.isLocal) return null;
    const currentContent = String(historyVariation.content || '');
    return getPromptHistoryEntries(role, historyVariation.id)
        .find((entry) => String(entry.content || '') !== currentContent) || null;
}

function updatePromptWorkflowButtons(role = getActiveRole()) {
    const isAdminUser = isAdmin();
    const compareContext = isAdminUser ? getPromptCompareContext(role) : null;
    const historyVariation = isAdminUser ? getPromptHistoryVariation(role) : null;
    const rollbackEntry = isAdminUser ? getPromptRollbackEntry(role, historyVariation) : null;

    if (promptCompareBtn) {
        promptCompareBtn.style.display = compareContext ? '' : 'none';
        if (compareContext) {
            const compareLabel = compareContext.activeVariation?.isLocal
                ? 'Сравнить текущий draft с public'
                : 'Сравнить hidden draft с public';
            setCustomTooltip(promptCompareBtn, compareLabel);
        }
    }

}

function updatePromptLengthInfo(role = getActiveRole()) {
    if (!promptLengthInfo) return;
    if (role !== 'manager_call') {
        promptLengthInfo.style.display = 'none';
        promptLengthInfo.textContent = '';
        promptLengthInfo.classList.remove('is-over');
        return;
    }

    promptLengthInfo.style.display = '';
    const currentLength = String(getActiveContent(role) || '').length;
    promptLengthInfo.textContent = `${currentLength.toLocaleString('ru-RU')} символов из ${MANAGER_CALL_PROMPT_MAX_CHARS.toLocaleString('ru-RU')}`;
    promptLengthInfo.classList.toggle('is-over', currentLength > MANAGER_CALL_PROMPT_MAX_CHARS);
}

function getPromptVariationDisplayName(variation) {
    const rawName = String(variation?.name || '').trim();
    if (!variation?.isLocal) {
        return rawName;
    }
    return rawName.replace(/\s*\(локальный\)$/i, '').trim() || rawName;
}

function hasMeaningfulPromptContent(content = '') {
    return String(content || '').trim().length > 0;
}

function promptsStateHasMeaningfulContent(role = '') {
    const rolesToCheck = role && PROMPT_ROLES.includes(role) ? [role] : PROMPT_ROLES;
    return rolesToCheck.some((targetRole) => {
        const variations = promptsData[targetRole]?.variations || [];
        return variations.some((variation) => hasMeaningfulPromptContent(variation?.content || ''));
    });
}

function firebasePromptSnapshotHasMeaningfulContent(firebaseData = {}, role = '') {
    const rolesToCheck = role && PROMPT_ROLES.includes(role) ? [role] : PROMPT_ROLES;
    return rolesToCheck.some((targetRole) => {
        const legacyKey = `${targetRole}_prompt`;
        if (hasMeaningfulPromptContent(firebaseData?.[legacyKey] || '')) {
            return true;
        }
        const variations = normalizePromptSnapshotVariations(firebaseData?.[`${targetRole}_variations`]);
        return variations.some((variation) => hasMeaningfulPromptContent(variation?.content || ''));
    });
}

function shouldSkipEmptyPromptRoleUpdate(firebaseData = {}, role = '') {
    if (!PROMPT_ROLES.includes(role)) return false;
    if (!hasMeaningfulPromptPayloadForRole(firebaseData, role) && promptsStateHasMeaningfulContent(role)) {
        return true;
    }
    return false;
}

function hasMeaningfulPromptPayloadForRole(firebaseData = {}, role = '') {
    return firebasePromptSnapshotHasMeaningfulContent(firebaseData || {}, role);
}

function findLocalOverrideForPublicVariation(role, publicVariation) {
    if (!publicVariation || publicVariation.isLocal) return null;
    const publicId = String(publicVariation.id || '').trim();
    const publicDisplayName = getPromptVariationDisplayName(publicVariation).toLowerCase();
    return (promptsData[role]?.variations || []).find((variation) => {
        if (!variation?.isLocal) return false;
        const baseVariationId = String(variation.baseVariationId || '').trim();
        if (baseVariationId && publicId && baseVariationId === publicId) {
            return !isBrokenEmptyLocalOverride(role, variation, publicVariation);
        }
        return getPromptVariationDisplayName(variation).toLowerCase() === publicDisplayName
            && !isBrokenEmptyLocalOverride(role, variation, publicVariation);
    }) || null;
}

function findBasePublicVariationForLocal(role, localVariation) {
    if (!localVariation?.isLocal) return null;
    const baseVariationId = String(localVariation.baseVariationId || '').trim();
    if (baseVariationId) {
        const linkedPublicVariation = (promptsData[role]?.variations || []).find((variation) => {
            return !variation?.isLocal && String(variation.id || '').trim() === baseVariationId;
        });
        if (linkedPublicVariation) {
            return linkedPublicVariation;
        }
    }

    const localDisplayName = getPromptVariationDisplayName(localVariation).toLowerCase();
    return (promptsData[role]?.variations || []).find((variation) => {
        return !variation?.isLocal && getPromptVariationDisplayName(variation).toLowerCase() === localDisplayName;
    }) || null;
}

function isBrokenEmptyLocalOverride(role, localVariation, basePublicVariation = null) {
    if (!localVariation?.isLocal) return false;
    if (hasMeaningfulPromptContent(localVariation.content || '')) return false;
    const resolvedBaseVariation = basePublicVariation || findBasePublicVariationForLocal(role, localVariation);
    return hasMeaningfulPromptContent(resolvedBaseVariation?.content || '');
}

function repairRoleActiveVariationSelection(role) {
    const roleState = promptsData[role];
    if (!roleState?.activeId || !Array.isArray(roleState.variations)) return false;

    const activeVariation = roleState.variations.find((variation) => variation.id === roleState.activeId) || null;
    if (!activeVariation?.isLocal) return false;

    const basePublicVariation = findBasePublicVariationForLocal(role, activeVariation);
    if (!isBrokenEmptyLocalOverride(role, activeVariation, basePublicVariation)) {
        return false;
    }

    const fallbackPublicVariation =
        basePublicVariation
        || roleState.variations.find((variation) => !variation?.isLocal && hasMeaningfulPromptContent(variation.content || ''))
        || roleState.variations.find((variation) => !variation?.isLocal)
        || null;

    if (!fallbackPublicVariation?.id || fallbackPublicVariation.id === roleState.activeId) {
        return false;
    }

    roleState.activeId = fallbackPublicVariation.id;
    return true;
}

function getUniqueVariationName(role, baseName) {
    const normalizedBase = (baseName || 'Промпт').trim() || 'Промпт';
    const existing = new Set(
        (promptsData[role]?.variations || []).map(v => (v.name || '').trim().toLowerCase())
    );
    if (!existing.has(normalizedBase.toLowerCase())) {
        return normalizedBase;
    }
    let idx = 2;
    while (existing.has(`${normalizedBase} ${idx}`.toLowerCase())) {
        idx += 1;
    }
    return `${normalizedBase} ${idx}`;
}

function makeActivePromptLocal(role) {
    const activeVariation = getActiveVariation(role);
    if (!activeVariation || activeVariation.isLocal) return false;

    const existingLocalOverride = findLocalOverrideForPublicVariation(role, activeVariation);
    if (existingLocalOverride) {
        promptsData[role].activeId = existingLocalOverride.id;
        saveLocalPromptsData();
        return true;
    }

    const localCopy = {
        id: generateId(),
        baseVariationId: activeVariation.id,
        name: getPromptVariationDisplayName(activeVariation) || activeVariation.name || 'Промпт',
        content: activeVariation.content || '',
        isLocal: true
    };
    promptsData[role].variations.push(localCopy);
    promptsData[role].activeId = localCopy.id;
    saveLocalPromptsData();
    return true;
}

function publishActiveLocalPrompt(role) {
    const activeVariation = getActiveVariation(role);
    if (!activeVariation || !activeVariation.isLocal) return false;
    const draftDisplayName = getPromptVariationDisplayName(activeVariation) || activeVariation.name || 'Draft';

    const basePublicVariation = findBasePublicVariationForLocal(role, activeVariation);
    if (basePublicVariation) {
        ensurePromptHistoryBaseline(role, basePublicVariation);
        basePublicVariation.name = getPromptVariationDisplayName(activeVariation) || basePublicVariation.name || 'Промпт';
        basePublicVariation.content = activeVariation.content || '';
        promptsData[role].variations = promptsData[role].variations.filter((variation) => variation !== activeVariation);
        promptsData[role].activeId = basePublicVariation.id;
        publicActiveIds[role] = basePublicVariation.id;
        checkpointPromptHistory(role, basePublicVariation.id, {
            kind: 'publish',
            note: `Опубликован draft «${draftDisplayName}»`
        });
        saveLocalPromptsData();
        savePromptsToFirebaseNow({ roles: [role] });
        return true;
    }

    activeVariation.isLocal = false;
    activeVariation.baseVariationId = null;
    activeVariation.name = getPromptVariationDisplayName(activeVariation) || 'Промпт';
    publicActiveIds[role] = activeVariation.id;
    checkpointPromptHistory(role, activeVariation.id, {
        kind: 'publish',
        note: `Опубликован draft «${draftDisplayName}»`
    });
    saveLocalPromptsData();
    savePromptsToFirebaseNow({ roles: [role] });
    return true;
}

function toggleActivePromptVisibility() {
    if (!isAdmin()) return;
    syncCurrentEditorNow();
    const role = getActiveRole();
    const activeVariation = getActiveVariation(role);
    if (!activeVariation) return;
    const action = activeVariation.isLocal ? 'publish' : 'localize';

    if (role === 'client' && action === 'localize' && conversationHistory.length > 0) {
        showCopyNotification('Нельзя менять личность во время диалога');
        return;
    }

    const updated = action === 'publish'
        ? publishActiveLocalPrompt(role)
        : makeActivePromptLocal(role);

    if (!updated) return;

    renderVariations();
    updateEditorContent(role);
    updatePromptVisibilityButton();
    showCopyNotification(action === 'publish' ? 'Промпт снова виден пользователям' : 'Промпт скрыт от пользователей');
}

function updatePromptLock() {
    if (conversationHistory.length === 0) {
        lockedPromptRole = null;
        lockedPromptVariationId = null;
        return;
    }
    if (!lockedPromptRole) {
        lockedPromptRole = getActiveRole();
        if (lockedPromptRole === 'client') {
            lockedPromptVariationId = promptsData.client.activeId;
        }
    }
}

function isPromptSwitchLocked(targetRole) {
    return lockedPromptRole === 'client' && targetRole !== lockedPromptRole;
}

function isClientVariationLocked(targetId) {
    return lockedPromptRole === 'client' && targetId !== lockedPromptVariationId;
}

function getManagerName(fallback = 'менеджер') {
    const value = normalizeFio(
        currentUser?.fio
        || managerNameInput?.value
        || getCachedStorageValue(USER_NAME_KEY, '')
        || ''
    );
    return value || fallback;
}

function getVariationByName(role, name) {
    const variations = promptsData[role]?.variations || [];
    const target = name.trim().toLowerCase();
    return variations.find(v => (v.name || '').trim().toLowerCase() === target);
}

function ensureAttestationVariation(role) {
    let variation = getVariationByName(role, 'Аттестация');
    if (!variation) {
        if (!isAdmin()) {
            return null;
        }
        variation = {
            id: generateId(),
            name: 'Аттестация',
            content: getActiveContent(role)
        };
        promptsData[role].variations.push(variation);
        if (isAdmin()) {
            savePromptsToFirebaseNow({ roles: [role] });
        }
    }
    return variation;
}

function applyAttestationPrompts() {
    for (const role of ATTESTATION_PROMPT_ROLES) {
        const variation = ensureAttestationVariation(role);
        if (!variation) {
            showCopyNotification('Аттестационные промпты не настроены. Обратитесь к администратору.');
            return false;
        }
        promptsData[role].activeId = variation.id;
        updateEditorContent(role);
    }
    renderVariations();
    return true;
}

function setAttestationMode(enabled) {
    if (enabled) {
        attestationPrevState = {
            client: promptsData.client.activeId,
            manager: promptsData.manager.activeId,
            manager_call: promptsData.manager_call.activeId,
            rater: promptsData.rater.activeId
        };
        isAttestationMode = true;
        const applied = applyAttestationPrompts();
        if (!applied) {
            isAttestationMode = false;
            return;
        }
        document.body.classList.add('attestation-mode');
        if (startAttestationBtn) {
            startAttestationBtn.style.display = 'none';
        }
        showCopyNotification('Режим аттестации включен');
    } else {
        if (attestationPrevState) {
            promptsData.client.activeId = attestationPrevState.client;
            promptsData.manager.activeId = attestationPrevState.manager;
            promptsData.manager_call.activeId = attestationPrevState.manager_call;
            promptsData.rater.activeId = attestationPrevState.rater;
            PROMPT_ROLES.forEach(updateEditorContent);
            renderVariations();
        }
        document.body.classList.remove('attestation-mode');
        isAttestationMode = false;
        if (startAttestationBtn) {
            startAttestationBtn.style.display = '';
        }
        showCopyNotification('Режим аттестации выключен');
    }
}

// Chat input state
function toggleInputState(enabled) {
    userInput.disabled = !enabled;
    voiceBtn.disabled = !enabled;
    aiAssistBtn.disabled = !enabled;
    if (enabled) {
        userInput.classList.remove('disabled');
        updateSendBtnState(); // Обновляем состояние кнопки отправки на основе текста
    } else {
        userInput.classList.add('disabled');
        sendBtn.disabled = true;
        updateRateChatButtonState();
    }
}

function setStartButtonsEnabled(enabled) {
    const startBtnEl = document.getElementById('startBtn');
    const startAttestationBtnEl = document.getElementById('startAttestationBtn');
    [startBtnEl, startAttestationBtnEl].forEach((btn) => {
        if (!btn) return;
        btn.disabled = !enabled;
    });
}

function setChatLoadingState(isLoading) {
    if (isLoading) {
        toggleInputState(false);
        setStartButtonsEnabled(false);
        userInput.placeholder = 'Загрузка...';
        return;
    }
    toggleInputState(true);
    setStartButtonsEnabled(true);
    if (!isDialogRated) {
        userInput.placeholder = '';
    }
}

function updateChatReadyState() {
    const ready = isAppBootstrapped && isWindowLoaded;
    if (ready === isChatReady) return;
    isChatReady = ready;
    setChatLoadingState(!ready);
    if (ready && document.activeElement === document.body) {
        userInput.focus();
    }
}

function syncWindowReadyState() {
    const nextReady = document.readyState !== 'loading';
    if (nextReady === isWindowLoaded) return;
    isWindowLoaded = nextReady;
    updateChatReadyState();
}

function isTextDialogStarted() {
    return conversationHistory.length > 0;
}

function setPrimaryActionMode(mode) {
    if (!sendBtn) return;
    const nextMode = mode === 'voice' ? 'voice' : 'send';
    if (sendBtn.dataset.mode === nextMode) return;

    sendBtn.dataset.mode = nextMode;
    if (nextMode === 'voice') {
        sendBtn.classList.add('voice-mode');
        sendBtn.innerHTML = VOICE_MODE_BUTTON_ICON;
        setCustomTooltip(sendBtn, 'Использовать голосовой режим');
    } else {
        sendBtn.classList.remove('voice-mode');
        sendBtn.innerHTML = SEND_BUTTON_ICON;
        setCustomTooltip(sendBtn, 'Отправить (Enter)');
    }
}

function updateSendBtnState() {
    const hasText = !!userInput.value.trim();
    const showVoiceModeAction = !hasText && !isTextDialogStarted() && !isProcessing && !isDialogRated && !isConversationClosed();

    if (showVoiceModeAction) {
        setPrimaryActionMode('voice');
        sendBtn.disabled = userInput.disabled;
        updateRateChatButtonState();
        return;
    }

    setPrimaryActionMode('send');
    sendBtn.disabled = !hasText || isProcessing || isDialogRated || isConversationClosed();
    updateRateChatButtonState();
}

function updateRateChatButtonState() {
    if (!rateChatBtn) return;
    if (rateChatBtn.classList.contains('loading')) {
        rateChatBtn.disabled = true;
        return;
    }
    const hasDialog = conversationHistory.length > 0;
    rateChatBtn.disabled = !(isChatReady && hasDialog && !isProcessing);
}

function lockDialogInput() {
    const inputWrapper = userInput.closest('.input-wrapper');
    userInput.disabled = true;
    sendBtn.disabled = true;
    voiceBtn.disabled = true;
    aiAssistBtn.disabled = true;
    userInput.placeholder = 'Очистите чат для нового диалога';
    userInput.classList.add('disabled');
    userInput.classList.add('locked-dialog');
    inputWrapper?.classList.add('is-locked');
    userInput.scrollTop = 0;
    requestAnimationFrame(() => {
        userInput.scrollTop = 0;
    });
    updateRateChatButtonState();
}

function unlockDialogInput() {
    const inputWrapper = userInput.closest('.input-wrapper');
    userInput.disabled = false;
    voiceBtn.disabled = false;
    aiAssistBtn.disabled = false;
    userInput.placeholder = '';
    userInput.classList.remove('disabled');
    userInput.classList.remove('locked-dialog');
    inputWrapper?.classList.remove('is-locked');
    userInput.scrollTop = 0;
    updateSendBtnState();
}

// ============ PROMPT VARIATIONS LOGIC ============

function initPromptsData(firebaseData = {}, options = {}) {
    const normalizedData = normalizePromptSnapshotForCache(firebaseData || {});
    const allowEmptyOverwrite = !!options.forceApplyEmpty;
    const isIncomingMeaningful = firebasePromptSnapshotHasMeaningfulContent(normalizedData);
    let appliedRolesCount = 0;
    if (!allowEmptyOverwrite && !isIncomingMeaningful) {
        if (!promptsStateHasMeaningfulContent()) {
            debugLog('Skipping empty prompt init because state is empty and no meaningful incoming payload', {
                allowEmptyOverwrite
            });
            return false;
        }
        debugLog('Skipping prompt init from non-meaningful payload to protect existing content', { allowEmptyOverwrite });
        return false;
    }

    agentLog(
        'initPromptsData called',
        () => ({
            firebaseDataKeys: Object.keys(normalizedData),
            hasClientVars: !!normalizedData.client_variations,
            allowEmptyOverwrite
        }),
        { location: 'script.js:initPromptsData', hypothesisId: 'A' }
    );
    let didRestorePublicPrompt = false;
    let didRepairBrokenPromptSelection = false;

    PROMPT_ROLES.forEach(role => {
        if (!allowEmptyOverwrite && shouldSkipEmptyPromptRoleUpdate(normalizedData, role)) {
            debugLog('Skipping prompt role init from empty payload to preserve existing content', { role });
            return;
        }

        const legacyKey = role === 'client'
            ? 'systemPrompt'
            : role === 'manager_call'
                ? 'managerCallPrompt'
                : role + 'Prompt';
        const legacyContent = normalizedData[role + '_prompt'] || getCachedStorageValue(legacyKey) || '';
        const rawPublicVariations = normalizePromptSnapshotVariations(normalizedData[role + '_variations']);

        const publicVariations = rawPublicVariations
            .filter(v => v && typeof v === 'object' && typeof v.id === 'string')
            .map(v => ({
                id: v.id,
                name: v.name || 'Основной',
                content: unescapeMarkdown(v.content || ''),
                isLocal: false
            }));

        if (!publicVariations.length) {
            publicVariations.push({
                id: generateId(),
                name: 'Основной',
                content: unescapeMarkdown(legacyContent),
                isLocal: false
            });
        }

        const hasPublicContent = publicVariations.some(v => (v.content || '').trim().length > 0);
        if (!hasPublicContent && legacyContent.trim()) {
            const requestedPublicActiveId = normalizedData[role + '_activeId'];
            const activePublicVar =
                publicVariations.find(v => v.id === requestedPublicActiveId) || publicVariations[0];
            if (activePublicVar) {
                activePublicVar.content = unescapeMarkdown(legacyContent);
                didRestorePublicPrompt = true;
            }
        }

        const requestedPublicActiveId = normalizedData[role + '_activeId'];
        const activePublicVar =
            publicVariations.find(v => v.id === requestedPublicActiveId) || publicVariations[0] || null;
        publicActiveIds[role] = activePublicVar ? activePublicVar.id : null;
        appliedRolesCount += 1;

        const localRoleData = getLocalPromptsRoleData(role);
        const usedIds = new Set(publicVariations.map(v => v.id));
        const localVariations = localRoleData.variations.map(v => {
            let uniqueId = v.id;
            while (usedIds.has(uniqueId)) {
                uniqueId = generateId();
            }
            usedIds.add(uniqueId);
            return {
                ...v,
                id: uniqueId,
                isLocal: true
            };
        });

        promptsData[role].variations = [...publicVariations, ...localVariations];

        const hasLocalActive = localVariations.some(v => v.id === localRoleData.activeId);
        if (hasLocalActive) {
            promptsData[role].activeId = localRoleData.activeId;
        } else if (activePublicVar) {
            promptsData[role].activeId = activePublicVar.id;
        } else if (promptsData[role].variations[0]) {
            promptsData[role].activeId = promptsData[role].variations[0].id;
        } else {
            promptsData[role].activeId = null;
        }

        if (repairRoleActiveVariationSelection(role)) {
            didRepairBrokenPromptSelection = true;
        }

        if (!lastHistoryContent[role]) lastHistoryContent[role] = {};
        promptsData[role].variations.forEach(v => {
            lastHistoryContent[role][v.id] = v.content || '';
        });
    });

    if (!appliedRolesCount) {
        return false;
    }

    if (isAdmin()) {
        const appliedVersion = getCachedStorageValue(RATER_PROMPT_VERSION_STORAGE_KEY);
        if (appliedVersion !== RATER_PROMPT_VERSION) {
            const activePublicRaterId = getPublicActiveId('rater');
            const activePublicVar = promptsData.rater.variations.find(
                v => !v.isLocal && v.id === activePublicRaterId
            );
            if (activePublicVar) {
                activePublicVar.content = DEFAULT_RATER_PROMPT;
                didRestorePublicPrompt = true;
                setCachedStorageValue(RATER_PROMPT_VERSION_STORAGE_KEY, RATER_PROMPT_VERSION);
            }
        }
    }

    if (didRestorePublicPrompt && db && isAdmin()) {
        savePromptsToFirebaseNow();
    } else {
        saveLocalPromptsData();
    }

    if (didRepairBrokenPromptSelection) {
        debugLog('Recovered from broken empty local prompt selection');
    }

    renderVariations();
    updateAllPreviews();
    updatePromptVisibilityButton();
    updatePromptHistoryButton();

    return true;
}

function renderVariations() {
    const role = getActiveRole();
    if (!promptsData[role] || !promptVariationsContainer) return;
    
    const isAdminUser = isAdmin();
    const visibleVariations = getVisibleVariations(role, isAdminUser);
    const activeId = getActiveVariation(role)?.id || null;
    
    const fragment = document.createDocumentFragment();

    visibleVariations.forEach(v => {
        const chip = document.createElement('div');
        chip.className = `prompt-variation-chip ${v.id === activeId ? 'active' : ''}`;
        chip.classList.toggle('local', !!v.isLocal);

        if (v.isLocal) {
            const visibilityIcon = document.createElement('span');
            visibilityIcon.className = 'chip-visibility-indicator';
            visibilityIcon.innerHTML = EYE_OFF_ICON;
            setCustomTooltip(visibilityIcon, 'Скрыт от пользователей');
            chip.appendChild(visibilityIcon);
        }

        const chipName = document.createElement('span');
        chipName.className = 'chip-name';
        chipName.textContent = getPromptVariationDisplayName(v);
        chip.appendChild(chipName);

        let deleteBtn = null;
        if (visibleVariations.length > 1 && isAdminUser) {
            deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-variation';
            deleteBtn.type = 'button';
            deleteBtn.setAttribute('aria-label', `Удалить промпт ${getPromptVariationDisplayName(v) || ''}`.trim());
            deleteBtn.innerHTML = CHIP_DELETE_ICON;
            chip.appendChild(deleteBtn);
        }
        
        chip.addEventListener('click', (e) => {
            if (!e.target.closest('.delete-variation')) {
                setActiveVariation(role, v.id);
            }
        });
        
        // Only allow renaming for admins
        if (isAdminUser) {
            chipName.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                const newName = prompt('Название промпта:', v.name);
                if (newName && newName.trim()) {
                    v.name = newName.trim();
                    renderVariations();
                    if (v.isLocal) {
                        saveLocalPromptsData();
                    } else {
                        queuePublicPromptSave(role);
                    }
                }
            });
        }
        
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Удалить промпт "${v.name}"?`)) {
                    deleteVariation(role, v.id);
                }
            });
        }
        
        fragment.appendChild(chip);
    });
    
    // Add button - only for admins
    if (isAdminUser) {
        const addBtn = document.createElement('button');
        addBtn.className = 'add-variation-btn';
        addBtn.textContent = '+';
        setCustomTooltip(addBtn, 'Добавить вариант промпта');
        addBtn.addEventListener('click', () => addVariation(role));
        fragment.appendChild(addBtn);
    }

    promptVariationsContainer.replaceChildren(fragment);
    renderPromptSyncConflictNotice(role);
    updatePromptVisibilityButton();
    updatePromptHistoryButton();
    updatePromptWorkflowButtons(role);
    updatePromptLengthInfo(role);
    if (promptHistoryModal?.classList.contains('active')) {
        renderPromptHistory();
    }
    if (promptCompareModal?.classList.contains('active')) {
        renderPromptCompareModalContent(role);
    }
}

function formatHistoryTime(ts) {
    try {
        return new Date(ts).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) {
        return '';
    }
}

function getRoleLabel(role) {
    if (role === 'client') return 'Клиент';
    if (role === 'manager') return 'Менеджер';
    if (role === 'manager_call') return 'Клиент звонок';
    if (role === 'rater') return 'Оценщик';
    return role;
}

function getPromptHistoryKey(role, variationId) {
    return `${role}:${variationId}`;
}

function getPromptHistoryEntries(role, variationId) {
    if (!role || !variationId) return [];
    const key = getPromptHistoryKey(role, variationId);
    return promptHistory.filter(item => getPromptHistoryKey(item.role, item.variationId) === key);
}

function clonePromptHistoryEntry(entry = {}) {
    if (!entry || typeof entry !== 'object') return null;
    const id = String(entry.id || '').trim();
    if (!id) return null;
    return {
        id,
        ts: Number(entry.ts) || Date.now(),
        role: String(entry.role || ''),
        variationId: String(entry.variationId || ''),
        variationName: String(entry.variationName || ''),
        content: String(entry.content || ''),
        kind: String(entry.kind || 'edit'),
        note: String(entry.note || '')
    };
}

function normalizePromptHistoryEntries(rawHistory = []) {
    const entries = Array.isArray(rawHistory)
        ? rawHistory
        : (rawHistory && typeof rawHistory === 'object' ? Object.values(rawHistory) : []);

    const normalized = entries
        .map((entry) => clonePromptHistoryEntry(entry))
        .filter(Boolean)
        .sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));

    const perPromptCount = new Map();
    const trimmedHistory = [];
    normalized.forEach((entry) => {
        const key = getPromptHistoryKey(entry.role, entry.variationId);
        const used = perPromptCount.get(key) || 0;
        if (used >= HISTORY_LIMIT) return;
        perPromptCount.set(key, used + 1);
        trimmedHistory.push(entry);
    });

    return trimmedHistory;
}

function clearPromptHistoryRemoteSyncState() {
    if (promptHistoryRemoteSyncTimer) {
        clearTimeout(promptHistoryRemoteSyncTimer);
        promptHistoryRemoteSyncTimer = null;
    }
    promptHistoryRemoteSyncInFlight = false;
    queuedPromptHistoryRemoteEntries = new Map();
    syncedPromptHistoryEntryIds = new Set();
}

function queuePromptHistoryRemoteSync(entries = []) {
    if (!db || !isAdmin()) return false;
    const normalizedEntries = (Array.isArray(entries) ? entries : [entries])
        .map((entry) => clonePromptHistoryEntry(entry))
        .filter(Boolean);
    if (!normalizedEntries.length) return false;

    let didQueue = false;
    normalizedEntries.forEach((entry) => {
        if (syncedPromptHistoryEntryIds.has(entry.id) && !queuedPromptHistoryRemoteEntries.has(entry.id)) {
            return;
        }
        const previous = queuedPromptHistoryRemoteEntries.get(entry.id);
        if (previous && JSON.stringify(previous) === JSON.stringify(entry)) {
            return;
        }
        queuedPromptHistoryRemoteEntries.set(entry.id, entry);
        didQueue = true;
    });

    if (!didQueue) return false;

    if (promptHistoryRemoteSyncTimer) {
        clearTimeout(promptHistoryRemoteSyncTimer);
    }
    promptHistoryRemoteSyncTimer = setTimeout(() => {
        promptHistoryRemoteSyncTimer = null;
        void flushPromptHistoryRemoteSync();
    }, PROMPT_HISTORY_REMOTE_SYNC_DEBOUNCE_MS);
    return true;
}

async function flushPromptHistoryRemoteSync() {
    if (promptHistoryRemoteSyncTimer) {
        clearTimeout(promptHistoryRemoteSyncTimer);
        promptHistoryRemoteSyncTimer = null;
    }
    if (promptHistoryRemoteSyncInFlight || !db || !queuedPromptHistoryRemoteEntries.size || !isAdmin()) {
        return false;
    }

    const batch = Array.from(queuedPromptHistoryRemoteEntries.values())
        .map((entry) => clonePromptHistoryEntry(entry))
        .filter(Boolean);
    if (!batch.length) {
        queuedPromptHistoryRemoteEntries = new Map();
        return false;
    }

    queuedPromptHistoryRemoteEntries = new Map();
    promptHistoryRemoteSyncInFlight = true;
    try {
        const canSync = await ensureCurrentUserAccessMirror();
        if (!canSync) {
            throw new Error('Не удалось синхронизировать prompt history access mirror.');
        }

        const updatesPayload = {};
        batch.forEach((entry) => {
            updatesPayload[entry.id] = entry;
        });
        await update(ref(db, 'prompt_history'), updatesPayload);
        batch.forEach((entry) => {
            syncedPromptHistoryEntryIds.add(entry.id);
        });
        debugLog('Prompt history synced incrementally', { count: batch.length });
        return true;
    } catch (error) {
        console.error('Failed to sync history entries:', error);
        batch.forEach((entry) => {
            queuedPromptHistoryRemoteEntries.set(entry.id, entry);
        });
        if (!promptHistoryRemoteSyncTimer) {
            promptHistoryRemoteSyncTimer = setTimeout(() => {
                promptHistoryRemoteSyncTimer = null;
                void flushPromptHistoryRemoteSync();
            }, 2000);
        }
        return false;
    } finally {
        promptHistoryRemoteSyncInFlight = false;
        if (queuedPromptHistoryRemoteEntries.size && !promptHistoryRemoteSyncTimer) {
            promptHistoryRemoteSyncTimer = setTimeout(() => {
                promptHistoryRemoteSyncTimer = null;
                void flushPromptHistoryRemoteSync();
            }, PROMPT_HISTORY_REMOTE_SYNC_DEBOUNCE_MS);
        }
    }
}

function ensurePromptHistoryBaseline(role, variation) {
    if (!isAdmin() || !role || !variation || variation.isLocal) return false;
    if (getPromptHistoryEntries(role, variation.id).length) return false;

    const entry = {
        id: generateId(),
        ts: Date.now(),
        role,
        variationId: variation.id,
        variationName: variation.name,
        content: variation.content || '',
        kind: 'baseline',
        note: 'Базовая public-версия'
    };
    promptHistory.push(entry);
    savePromptHistory({ syncEntries: [entry] });
    if (promptHistoryModal?.classList.contains('active')) {
        renderPromptHistory();
    }
    return true;
}

function getPromptHistoryKindLabel(kind = 'edit') {
    switch (String(kind || 'edit')) {
    case 'baseline':
        return 'База';
    case 'publish':
        return 'Публикация';
    case 'restore':
        return 'Откат';
    default:
        return 'Изменение';
    }
}

function buildPromptHistoryEntryDiffHtml(previousContent = '', currentContent = '') {
    return buildPromptCompareDiffHtml(previousContent, currentContent);
}

function showPromptHistoryItem(entry = {}, previousContent = '', role = getActiveRole(), variationId) {
    if (!promptHistoryItemModal || !promptHistoryItemTitle || !promptHistoryItemMeta || !promptHistoryItemDiffView) return;

    const safeRole = entry.role || role;
    const safeVariationId = entry.variationId || variationId;
    const normalizedEntry = {
        ...entry,
        id: entry.id,
        role: safeRole,
        variationId: safeVariationId,
        kind: entry.kind || 'edit',
        ts: entry.ts || Date.now(),
        variationName: entry.variationName || 'Без названия',
        note: entry.note || ''
    };

    const title = `${getRoleLabel(normalizedEntry.role)} · ${normalizedEntry.variationName || 'Без названия'}`;
    const time = formatHistoryTime(normalizedEntry.ts);
    const kindLabel = getPromptHistoryKindLabel(normalizedEntry.kind);
    const noteLabel = normalizedEntry.note ? `<br><strong>Примечание:</strong> ${escapeHtml(normalizedEntry.note)}` : '';
    promptHistoryItemTitle.textContent = `Версия: ${title}`;
    promptHistoryItemMeta.innerHTML = `<strong>${kindLabel}</strong> · ${escapeHtml(time)}${noteLabel}`;
    promptHistoryItemDiffView.innerHTML = buildPromptHistoryEntryDiffHtml(previousContent, String(entry?.content || ''));

    promptHistoryItemModal.classList.add('active');
}

function hidePromptHistoryItemModal() {
    if (!promptHistoryItemModal) return;
    promptHistoryItemModal.classList.remove('active');
}

function renderPromptHistory() {
    if (!promptHistoryList || !promptHistoryTitle) return;
    if (!isAdmin()) {
        promptHistoryList.innerHTML = '';
        hidePromptHistoryItemModal();
        return;
    }

    const role = getActiveRole();
    const activeVariation = getActiveVariation(role);
    if (!activeVariation) {
        promptHistoryTitle.textContent = 'История промпта';
        promptHistoryList.innerHTML = '<div class="changes-empty">Выберите промпт.</div>';
        return;
    }

    const historyVariation = getPromptHistoryVariation(role, activeVariation);
    if (!historyVariation) {
        promptHistoryTitle.textContent = `История: ${getRoleLabel(role)} · ${activeVariation.name || 'Без названия'}`;
        promptHistoryList.innerHTML = '<div class="changes-empty">У этого draft пока нет public-истории.</div>';
        return;
    }

    const isDraftView = !!activeVariation.isLocal;
    promptHistoryTitle.textContent = isDraftView
        ? `Журнал public: ${getRoleLabel(role)} · ${historyVariation.name || 'Без названия'}`
        : `История: ${getRoleLabel(role)} · ${historyVariation.name || 'Без названия'}`;

    const items = getPromptHistoryEntries(role, historyVariation.id).slice(0, HISTORY_LIMIT);
    promptHistoryList.innerHTML = '';
    hidePromptHistoryItemModal();
    if (!items.length) {
        promptHistoryList.innerHTML = '<div class="changes-empty">Пока нет изменений у этого промпта.</div>';
        return;
    }

    items.forEach((entry, index) => {
        const item = document.createElement('div');
        item.className = 'change-item';
        item.dataset.entryId = entry.id;
        const title = `${getRoleLabel(entry.role)} · ${entry.variationName || 'Без названия'}`;
        const time = formatHistoryTime(entry.ts);
        const previousEntry = items[index + 1] || null;
        const previousContent = previousEntry ? String(previousEntry.content || '') : '';

        const changeMeta = document.createElement('div');
        changeMeta.className = 'change-meta';

        const changeTitle = document.createElement('div');
        changeTitle.className = 'change-title';
        changeTitle.textContent = title;
        changeTitle.title = title;

        const changeTime = document.createElement('div');
        changeTime.className = 'change-time';
        changeTime.textContent = `${getPromptHistoryKindLabel(entry.kind)} · ${time}`;

        const changeNote = document.createElement('div');
        changeNote.className = 'change-note';
        changeNote.textContent = entry.note || '';
        changeNote.hidden = !entry.note;

        const restoreButton = document.createElement('button');
        restoreButton.className = 'btn-restore';
        restoreButton.dataset.id = entry.id;
        restoreButton.textContent = 'Восстановить';

        changeMeta.append(changeTitle, changeTime, changeNote);
        item.append(changeMeta, restoreButton);
        restoreButton.addEventListener('click', (e) => {
            e.stopPropagation();
            restorePromptVersion(entry.id, role, historyVariation.id, {
                keepCurrentSelection: !!activeVariation.isLocal
            });
        });
        item.addEventListener('click', () => {
            showPromptHistoryItem(entry, previousContent, role, historyVariation.id);
        });
        promptHistoryList.appendChild(item);
    });
}

function savePromptHistory(options = {}) {
    if (!promptHistory) return;

    promptHistory = normalizePromptHistoryEntries(promptHistory);
    lastPromptHistorySnapshotHash = JSON.stringify(promptHistory);

    if (!promptHistory.length) {
        clearCachedLocalStorageJson(LOCAL_PROMPTS_HISTORY_STORAGE_KEY, []);
    } else {
        setCachedLocalStorageJson(LOCAL_PROMPTS_HISTORY_STORAGE_KEY, promptHistory);
    }

    queuePromptHistoryRemoteSync(options.syncEntries || []);
}

function checkpointPromptHistory(role, variationId = promptsData[role]?.activeId, options = {}) {
    if (!role || !variationId) return;
    const variation = (promptsData[role]?.variations || []).find(v => v.id === variationId);
    if (!variation || variation.isLocal) return;
    recordPromptHistory(role, variation, options);
}

function recordPromptHistory(role, variation, options = {}) {
    if (!isAdmin()) return;
    if (!variation) return;
    const content = variation.content || '';
    const lastContent = lastHistoryContent[role]?.[variation.id] ?? '';
    if (content === lastContent) return;

    const normalizedOptions = typeof options === 'string'
        ? { kind: options }
        : (options && typeof options === 'object' ? options : {});

    const entry = {
        id: generateId(),
        ts: Date.now(),
        role,
        variationId: variation.id,
        variationName: variation.name,
        content,
        kind: normalizedOptions.kind || 'edit',
        note: String(normalizedOptions.note || '')
    };

    promptHistory.unshift(entry);
    lastHistoryContent[role][variation.id] = content;
    savePromptHistory({ syncEntries: [entry] });
    if (promptHistoryModal?.classList.contains('active')) {
        renderPromptHistory();
    }
}

function restorePromptVersion(entryId, role = getActiveRole(), variationId = getActiveVariation(role)?.id, options = {}) {
    if (!isAdmin()) return;
    const entry = promptHistory.find(item =>
        item.id === entryId &&
        (!role || item.role === role) &&
        (!variationId || item.variationId === variationId)
    );
    if (!entry) return;

    role = entry.role;
    const variations = promptsData[role]?.variations || [];
    const previousActiveId = promptsData[role]?.activeId || null;
    let targetVar = variations.find(v => v.id === entry.variationId);
    if (!targetVar) {
        targetVar = {
            id: entry.variationId,
            name: entry.variationName || 'Восстановленный',
            content: entry.content
        };
        variations.push(targetVar);
    } else {
        targetVar.content = entry.content;
    }

    const keepCurrentSelection = !!options.keepCurrentSelection &&
        !!previousActiveId &&
        variations.some(v => v.id === previousActiveId);
    promptsData[role].activeId = keepCurrentSelection ? previousActiveId : targetVar.id;
    renderVariations();
    updateEditorContent(role);
    checkpointPromptHistory(role, targetVar.id, {
        kind: 'restore',
        note: `Из версии ${formatHistoryTime(entry.ts)}`
    });
    savePromptsToFirebaseNow({ roles: [role] });
    if (promptHistoryModal?.classList.contains('active')) {
        renderPromptHistory();
    }
    if (promptCompareModal?.classList.contains('active')) {
        renderPromptCompareModalContent(role);
    }
}

function addVariation(role) {
    // Save current changes first so we copy the latest version
    syncCurrentEditorNow();

    const count = promptsData[role].variations.length + 1;
    const newId = generateId();
    
    // Copy content from active variation
    const activeVar = promptsData[role].variations.find(v => v.id === promptsData[role].activeId);
    const initialContent = activeVar ? activeVar.content : '';
    const initialScopeLocal = !!activeVar?.isLocal;

    promptsData[role].variations.push({
        id: newId,
        name: `Вариант ${count}`,
        content: initialContent,
        isLocal: initialScopeLocal
    });
    setActiveVariation(role, newId);
    if (initialScopeLocal) {
        saveLocalPromptsData();
    } else {
        queuePublicPromptSave(role);
    }
}
                    
function deleteVariation(role, id) {
    agentLog(
        'deleteVariation called',
        { role, id },
        { location: 'script.js:deleteVariation', hypothesisId: 'E' }
    );
    const index = promptsData[role].variations.findIndex(v => v.id === id);
    if (index > -1) {
        const deletedVariation = promptsData[role].variations[index];
        promptsData[role].variations.splice(index, 1);
        if (promptsData[role].variations.length === 0) {
            promptsData[role].variations.push({
                id: generateId(),
                name: 'Основной',
                content: '',
                isLocal: !!deletedVariation?.isLocal
            });
        }
        if (promptsData[role].activeId === id) {
            promptsData[role].activeId = promptsData[role].variations[0].id;
        }
        if (publicActiveIds[role] === id) {
            publicActiveIds[role] = null;
            getPublicActiveId(role);
        }
        renderVariations();
        updateEditorContent(role);
        if (deletedVariation?.isLocal) {
            saveLocalPromptsData();
        } else {
            queuePublicPromptSave(role);
        }
    }
}

function setActiveVariation(role, id) {
    if (role === 'client' && isClientVariationLocked(id)) {
        showCopyNotification('Нельзя менять личность во время диалога');
        return;
    }
    // Save current editor content before switching
    syncCurrentEditorNow();
    
    promptsData[role].activeId = id;
    renderVariations();
    updateEditorContent(role);
}

function updateEditorContent(role) {
    const activeVar = getActiveVariation(role);
    const content = activeVar ? activeVar.content : '';

    const textarea = promptInputsByRole[role];
    const preview = promptPreviewByRole[role];
    
    if (textarea && preview) {
        const renderedHtml = renderMarkdown(content);
        const textareaNeedsUpdate = textarea.value !== content;
        const previewNeedsUpdate = preview.dataset.renderedMarkdown !== content;

        if (textareaNeedsUpdate) {
            textarea.value = content;
        }

        if (previewNeedsUpdate) {
            preview.innerHTML = renderedHtml;
            preview.dataset.renderedMarkdown = content;
            if (typeof hljs !== 'undefined') {
                const codeBlocks = preview.querySelectorAll('pre code');
                if (codeBlocks.length > 0) {
                    codeBlocks.forEach(block => hljs.highlightElement(block));
                }
            }
        }
    }

    if (role === getActiveRole()) {
        updatePromptLengthInfo(role);
    }
}

function syncContentToData(role, content) {
    agentLog(
        'syncContentToData called',
        { role, contentLength: content?.length },
        { location: 'script.js:syncContentToData', hypothesisId: 'D' }
    );
    const activeVar = promptsData[role].variations.find(v => v.id === promptsData[role].activeId);
    if (activeVar) {
        // Critical Fix: Don't allow empty content if previous content was significant
        // This prevents data loss from WYSIWYG/Turndown glitches
        if (content.trim() === '' && activeVar.content && activeVar.content.trim().length > 10) {
            console.warn(`Prevented accidental data loss for ${role}. New content was empty.`);
            return null;
        }
        if (activeVar.content === content) {
            if (role === getActiveRole()) {
                updatePromptLengthInfo(role);
            }
            return false;
        }
        if (!activeVar.isLocal) {
            ensurePromptHistoryBaseline(role, activeVar);
        }
        activeVar.content = content;
        if (activeVar.isLocal) {
            saveLocalPromptsData();
        } else {
            queuePublicPromptSave(role);
        }
        if (role === getActiveRole()) {
            updatePromptLengthInfo(role);
        }
        return true;
    }
    return null;
}

function getActiveContent(role) {
    const v = getActiveVariation(role);
    return v ? v.content : '';
}

function validatePromptBeforeWebhook(role, promptValue) {
    const trimmedPrompt = String(promptValue || '').trim();
    if (trimmedPrompt) return trimmedPrompt;

    const roleLabel = role === 'client'
        ? 'клиента'
        : role === 'manager'
            ? 'менеджера'
            : role === 'manager_call'
                ? 'клиента звонка'
                : 'оценщика';
    addMessage(`Ошибка: промпт ${roleLabel} пустой. Заполните инструкцию.`, 'error', false);
    return null;
}

// ============ FIREBASE SYNC ============

const dirtyPublicPromptRoles = new Set();

function getNormalizedPromptSyncRoles(roles = PROMPT_ROLES) {
    const requestedRoles = Array.isArray(roles) && roles.length ? roles : PROMPT_ROLES;
    return [...new Set(requestedRoles.filter(role => PROMPT_ROLES.includes(role)))];
}

function buildPromptsSyncPayload(roles = PROMPT_ROLES) {
    const payload = {};
    getNormalizedPromptSyncRoles(roles).forEach((role) => {
        payload[role + '_prompt'] = getPublicActiveContent(role);
        payload[role + '_variations'] = getPublicVariations(role);
        payload[role + '_activeId'] = getPublicActiveId(role);
    });
    return payload;
}

function canSyncPublicPromptsToCloud(user = currentUser) {
    return !!db && hasAdminAccount(user);
}

function queuePublicPromptSave(role) {
    if (!role) return;
    dirtyPublicPromptRoles.add(role);
    savePromptsToFirebase();
}

function clearPublicPromptSyncRetry() {
    if (!publicPromptSyncRetryTimerId) return;
    clearTimeout(publicPromptSyncRetryTimerId);
    publicPromptSyncRetryTimerId = null;
}

function schedulePublicPromptSyncRetry(options = {}) {
    if (options.fullReplace) {
        publicPromptSyncRetryFullReplace = true;
    }
    if (publicPromptSyncRetryTimerId) {
        return false;
    }
    publicPromptSyncRetryTimerId = window.setTimeout(() => {
        publicPromptSyncRetryTimerId = null;
        if (!dirtyPublicPromptRoles.size) {
            publicPromptSyncRetryFullReplace = false;
            return;
        }
        savePromptsToFirebaseNow({
            roles: [...dirtyPublicPromptRoles],
            fullReplace: publicPromptSyncRetryFullReplace
        });
    }, PROMPT_REMOTE_SYNC_RETRY_DELAY_MS);
    return true;
}

const savePromptsToFirebase = debounce(() => {
    const roles = [...dirtyPublicPromptRoles];
    if (!roles.length) return;
    savePromptsToFirebaseNow({ roles });
}, 1000);

function savePromptsToFirebaseNow(options = {}) {
    agentLog(
        'savePromptsToFirebaseNow called',
        () => ({
            promptsSummary: Object.keys(promptsData).map(r => ({
                role: r,
                vars: promptsData[r].variations.length,
                activeId: promptsData[r].activeId
            }))
        }),
        { location: 'script.js:savePromptsToFirebaseNow', hypothesisId: 'B' }
    );
    const effectiveFullReplace = !!options.fullReplace || publicPromptSyncRetryFullReplace;
    saveLocalPromptsData();
    if (!canSyncPublicPromptsToCloud()) {
        clearPublicPromptSyncRetry();
        publicPromptSyncRetryFullReplace = false;
        debugLog('Skipped cloud prompt sync: real admin access is required');
        return;
    }
    if (pendingPromptsFirebaseSnapshot !== null) {
        debugLog('Deferred cloud prompt sync: remote prompt snapshot is pending');
        return;
    }

    const roles = getNormalizedPromptSyncRoles(options.roles);
    const payload = buildPromptsSyncPayload(roles);
    const fullPayload = buildPromptsSyncPayload(PROMPT_ROLES);
    const fullPayloadSnapshotState = buildNormalizedPromptSnapshotState(fullPayload);
    persistPublicPromptsEmergencySnapshot(fullPayloadSnapshotState.normalized, { state: fullPayloadSnapshotState });

    // Critical Fix: Validation to prevent saving empty/corrupted data to cloud
    const hasEmptyEssential = roles.some(role => {
        const publicVariations = payload[role + '_variations'] || [];
        const activeContent = payload[role + '_prompt'] || '';
        return activeContent === '' && publicVariations.some(v => (v.content || '').trim() !== '');
    });

    if (hasEmptyEssential) {
        console.warn('Sync cancelled: attempt to save empty prompt detected');
        return;
    }
    if (publicPromptSyncInFlight) {
        schedulePublicPromptSyncRetry({ fullReplace: effectiveFullReplace });
        return;
    }

    publicPromptSyncInFlight = true;
    const syncPromise = ensureCurrentUserAccessMirror();
    syncPromise
        .then(() => (effectiveFullReplace ? set(ref(db, 'prompts'), payload) : update(ref(db, 'prompts'), payload)))
        .then(() => {
            clearPublicPromptSyncRetry();
            publicPromptSyncRetryFullReplace = false;
            persistPublicPromptsSnapshot(fullPayloadSnapshotState.normalized, { state: fullPayloadSnapshotState });
            roles.forEach((role) => {
                dirtyPublicPromptRoles.delete(role);
                clearPromptEditBaseline(role);
                setPromptSyncConflictMessage(role, '');
            });
            debugLog('Prompts synced to Firebase');
            renderPromptSyncConflictNotice();
        })
        .catch((error) => {
            console.error('Failed to sync:', error);
            schedulePublicPromptSyncRetry({ fullReplace: effectiveFullReplace });
        })
        .finally(() => {
            publicPromptSyncInFlight = false;
        });
}

function stopProtectedRealtimeListeners() {
    clearProtectedRealtimeListenersRecovery();
    clearPublicPromptSyncRetry();
    publicPromptSyncRetryFullReplace = false;
    publicPromptSyncInFlight = false;
    if (!Array.isArray(protectedRealtimeUnsubscribes) || !protectedRealtimeUnsubscribes.length) return;
    protectedRealtimeUnsubscribes.forEach((unsubscribe) => {
        try {
            if (typeof unsubscribe === 'function') unsubscribe();
        } catch (error) {
            console.warn('Failed to stop protected realtime listener:', error);
        }
    });
    protectedRealtimeUnsubscribes = [];
}

function clearProtectedRealtimeListenersRecovery() {
    if (!protectedRealtimeRecoveryTimerId) return;
    clearTimeout(protectedRealtimeRecoveryTimerId);
    protectedRealtimeRecoveryTimerId = null;
}

function scheduleProtectedRealtimeListenersRecovery(reason = '', delayMs = PROTECTED_REALTIME_RECOVERY_DELAY_MS) {
    if (protectedRealtimeRecoveryTimerId) {
        return false;
    }
    protectedRealtimeRecoveryTimerId = setTimeout(() => {
        protectedRealtimeRecoveryTimerId = null;
        if (!db || !auth?.currentUser) return;
        try {
            debugLog('Recovering protected realtime listeners', { reason });
            setupPromptsAndConfigListeners();
            void bootstrapPromptsViaRestFallback();
        } catch (error) {
            console.error('Protected realtime listeners recovery failed:', error);
            scheduleProtectedRealtimeListenersRecovery('retry-after-recovery-failure');
        }
    }, Math.max(250, Number(delayMs) || PROTECTED_REALTIME_RECOVERY_DELAY_MS));
    return true;
}

function setupPromptsAndConfigListeners() {
    if (!db) {
        setSharedGeminiTokenEndpoint('');
        setSharedClientConversationActionPrompt('');
        setSharedRaterHiddenPrompt('');
        return;
    }

    stopProtectedRealtimeListeners();

    try {
        const promptsRef = ref(db, 'prompts');
        const unsubscribePrompts = onValue(promptsRef, (snapshot) => {
            const promptSnapshotState = buildNormalizedPromptSnapshotState(snapshot.val() || {});
            const data = promptSnapshotState.normalized;
            if (promptSnapshotState.hasMeaningfulContent) {
                persistPublicPromptsSnapshot(data, { state: promptSnapshotState });
                persistPublicPromptsEmergencySnapshot(data, { state: promptSnapshotState });
            }
            lastPromptsFirebaseSnapshot = data;
            lastPromptsFirebaseSnapshotState = promptSnapshotState;
            agentLog(
                'Firebase onValue triggered',
                { hasData: !!data, isUserEditing },
                { location: 'script.js:loadPrompts.onValue', hypothesisId: 'C' }
            );
            debugLog('Firebase data received:', data);

            if (isUserEditing) {
                pendingPromptsFirebaseSnapshot = data;
                pendingPromptsFirebaseSnapshotState = promptSnapshotState;
                lastFirebaseData = promptSnapshotState.hash;
                debugLog('Deferring Firebase prompt update - user is editing');
                return;
            }

            if (lastFirebaseData === promptSnapshotState.hash) {
                debugLog('Skipping Firebase update - data unchanged');
                return;
            }
            const didApplyPrompts = initPromptsData(data);
            if (!didApplyPrompts) {
                debugLog('Skipping Firebase prompts sync because payload had no meaningful content and local data is already populated');
                return;
            }
            lastFirebaseData = promptSnapshotState.hash;
            pendingPromptsFirebaseSnapshot = null;
            pendingPromptsFirebaseSnapshotState = null;

            if (didApplyPrompts && Object.keys(data).length === 0 && promptsStateHasMeaningfulContent()) {
                if (canSyncPublicPromptsToCloud()) {
                    savePromptsToFirebaseNow({ fullReplace: true });
                } else {
                    debugLog('Skipped prompts bootstrap sync: real admin access is required');
                }
            }
        }, (error) => {
            console.error('Firebase read error:', error);
            lastPromptsFirebaseSnapshot = null;
            lastPromptsFirebaseSnapshotState = null;
            pendingPromptsFirebaseSnapshot = null;
            pendingPromptsFirebaseSnapshotState = null;
            lastFirebaseData = null;
            const fallbackSnapshot = loadCachedPublicPromptsSnapshot() || loadCachedPublicPromptsEmergencySnapshot();
            if (fallbackSnapshot) {
                const fallbackSnapshotState = buildNormalizedPromptSnapshotState(fallbackSnapshot);
                lastPromptsFirebaseSnapshot = fallbackSnapshotState.normalized;
                lastPromptsFirebaseSnapshotState = fallbackSnapshotState;
                lastFirebaseData = fallbackSnapshotState.hash;
                initPromptsData(fallbackSnapshotState.normalized);
            }
            if (auth?.currentUser && !promptsStateHasMeaningfulContent('client')) {
                void bootstrapPromptsViaRestFallback();
            }
            scheduleProtectedRealtimeListenersRecovery('prompts-read-error');
        });
        protectedRealtimeUnsubscribes.push(unsubscribePrompts);

        const appConfigRef = ref(db, APP_CONFIG_DB_PATH);
        const unsubscribeAppConfig = onValue(appConfigRef, (snapshot) => {
            const data = snapshot.val() || {};
            const sharedEndpoint = normalizeGeminiTokenEndpoint(data?.geminiTokenEndpoint || '');
            const sharedClientActionPrompt = normalizeClientConversationActionPrompt(data?.clientConversationActionPrompt || '');
            const sharedRaterHidden = normalizeRaterHiddenPrompt(data?.raterHiddenPrompt || '');
            setSharedGeminiTokenEndpoint(sharedEndpoint);
            setSharedClientConversationActionPrompt(sharedClientActionPrompt);
            setSharedRaterHiddenPrompt(sharedRaterHidden);
            if (geminiTokenEndpointInput && settingsModal?.classList?.contains('active')) {
                geminiTokenEndpointInput.value = getConfiguredGeminiTokenEndpoint();
            }
            if (adminHiddenClientPromptInput && settingsModal?.classList?.contains('active')) {
                adminHiddenClientPromptInput.value = getConfiguredClientConversationActionPrompt();
            }
            if (adminHiddenRaterPromptInput && settingsModal?.classList?.contains('active')) {
                adminHiddenRaterPromptInput.value = getConfiguredRaterHiddenPrompt();
            }
        }, (error) => {
            console.error('App config read error:', error);
            scheduleProtectedRealtimeListenersRecovery('app-config-read-error');
        });
        protectedRealtimeUnsubscribes.push(unsubscribeAppConfig);

        const historyRef = ref(db, 'prompt_history');
        const unsubscribeHistory = onValue(historyRef, (snapshot) => {
            const nextPromptHistory = normalizePromptHistoryEntries(snapshot.val());
            syncedPromptHistoryEntryIds = new Set(nextPromptHistory.map((entry) => entry.id).filter(Boolean));
            const historyHash = JSON.stringify(nextPromptHistory);
            if (historyHash === lastPromptHistorySnapshotHash) return;
            promptHistory = nextPromptHistory;
            lastPromptHistorySnapshotHash = historyHash;
            if (promptHistoryModal?.classList.contains('active')) {
                renderPromptHistory();
            }
        }, (error) => {
            console.error('Prompt history read error:', error);
            scheduleProtectedRealtimeListenersRecovery('prompt-history-read-error');
        });
        protectedRealtimeUnsubscribes.push(unsubscribeHistory);
    } catch (error) {
        console.error('Error setting up Firebase listener:', error);
        const fallbackSnapshot = loadCachedPublicPromptsSnapshot() || loadCachedPublicPromptsEmergencySnapshot();
        if (fallbackSnapshot) {
            const fallbackSnapshotState = buildNormalizedPromptSnapshotState(fallbackSnapshot);
            lastPromptsFirebaseSnapshot = fallbackSnapshotState.normalized;
            lastPromptsFirebaseSnapshotState = fallbackSnapshotState;
            lastFirebaseData = fallbackSnapshotState.hash;
            initPromptsData(fallbackSnapshotState.normalized);
        }
        scheduleProtectedRealtimeListenersRecovery('setup-protected-listeners-failed');
    }
}

async function refreshProtectedFirebaseDataAfterAuth() {
    if (!db) return false;
    await waitForFirebaseAuthReady();
    setupPromptsAndConfigListeners();
    const bootstrapped = await bootstrapPromptsViaRestFallback();
    return bootstrapped || promptsStateHasMeaningfulContent();
}

async function bootstrapPromptsViaRestFallback() {
    if (!db || promptsStateHasMeaningfulContent('client')) return false;
    try {
        const rawData = await fetchFirebaseJsonViaRest('prompts', PROMPTS_REST_FALLBACK_TIMEOUT_MS);
        const promptSnapshotState = buildNormalizedPromptSnapshotState(rawData || {});
        if (rawData && typeof rawData === 'object' && promptSnapshotState.hasMeaningfulContent) {
            const data = promptSnapshotState.normalized;
            debugLog('Bootstrapping prompts via Firebase REST fallback');
            lastPromptsFirebaseSnapshot = data;
            lastPromptsFirebaseSnapshotState = promptSnapshotState;
            lastFirebaseData = promptSnapshotState.hash;
            persistPublicPromptsSnapshot(data, { state: promptSnapshotState });
            persistPublicPromptsEmergencySnapshot(data, { state: promptSnapshotState });
            initPromptsData(data);
            return true;
        }
    } catch (error) {
        console.warn('Failed to bootstrap prompts via Firebase REST fallback:', error);
    }
    return false;
}

async function loadPrompts() {
    pendingAuthRestoreMessage = '';
    // Bootstrap prompt UI from local cache immediately, without waiting for the first
    // live Firebase snapshot. This prevents blank editors when RTDB is slow or stalls.
    const cachedPublicPromptsSnapshot = loadCachedPublicPromptsSnapshot();
    if (cachedPublicPromptsSnapshot) {
        const cachedPublicPromptSnapshotState = buildNormalizedPromptSnapshotState(cachedPublicPromptsSnapshot);
        initPromptsData(cachedPublicPromptsSnapshot);
        lastPromptsFirebaseSnapshot = cachedPublicPromptsSnapshot;
        lastPromptsFirebaseSnapshotState = cachedPublicPromptSnapshotState;
        lastFirebaseData = cachedPublicPromptSnapshotState.hash;
    } else {
        const emergencyBackupSnapshot = loadCachedPublicPromptsEmergencySnapshot();
        if (emergencyBackupSnapshot) {
            const emergencyPromptSnapshotState = buildNormalizedPromptSnapshotState(emergencyBackupSnapshot);
            initPromptsData(emergencyBackupSnapshot);
            lastPromptsFirebaseSnapshot = emergencyBackupSnapshot;
            lastPromptsFirebaseSnapshotState = emergencyPromptSnapshotState;
            lastFirebaseData = emergencyPromptSnapshotState.hash;
            debugLog('Loaded prompts from emergency backup snapshot');
        } else {
            debugLog('No local prompt snapshots available before Firebase bootstrap');
        }
    }
    promptHistory = normalizePromptHistoryEntries(getCachedLocalStorageJson(LOCAL_PROMPTS_HISTORY_STORAGE_KEY));
    lastPromptHistorySnapshotHash = JSON.stringify(promptHistory);
    clearPromptHistoryRemoteSyncState();
    renderPromptHistory();

    if (db) {
        await waitForFirebaseAuthReady();
        if (auth?.currentUser) {
            setupPromptsAndConfigListeners();
            await bootstrapPromptsViaRestFallback();
        } else {
            setSharedGeminiTokenEndpoint('');
            setSharedClientConversationActionPrompt('');
            setSharedRaterHiddenPrompt('');
            debugLog('Skipping protected Firebase listeners until Firebase Auth session is ready');
        }
    } else {
        setSharedGeminiTokenEndpoint('');
        setSharedClientConversationActionPrompt('');
        setSharedRaterHiddenPrompt('');
        if (!cachedPublicPromptsSnapshot) {
            debugLog('Firebase unavailable and no cached prompt snapshot');
        }
        promptHistory = normalizePromptHistoryEntries(getCachedLocalStorageJson(LOCAL_PROMPTS_HISTORY_STORAGE_KEY));
        lastPromptHistorySnapshotHash = JSON.stringify(promptHistory);
        clearPromptHistoryRemoteSyncState();
        renderPromptHistory();
    }

    isAppBootstrapped = true;
    updateChatReadyState();

    await consumeEmailVerificationLinkIfPresent();

    let restored = false;
    try {
        restored = await withPromiseTimeout(
            restoreAuthSession(),
            AUTH_SESSION_RESTORE_TIMEOUT_MS,
            `Таймаут восстановления сессии (${AUTH_SESSION_RESTORE_TIMEOUT_MS / 1000}с).`
        );
    } catch (error) {
        const message = String(error?.message || '').toLowerCase();
        const isTimeout = message.includes('таймаут') || message.includes('timeout');
        activeAuthRestoreAttemptId += 1;
        stopProtectedRealtimeListeners();
        clearAuthSession();
        clearAuthCacheIdentity();
        if (isTimeout) {
            console.warn('Auth session restore timed out:', error);
            pendingAuthRestoreMessage = 'Не удалось восстановить прошлую сессию вовремя. Войдите ещё раз, чтобы заново открыть доступ к промптам.';
        } else {
            console.warn('Auth session restore failed:', error);
            pendingAuthRestoreMessage = getReadableFirebaseAuthError(error, 'login');
        }
        restored = false;
    }

    if (!restored) {
        const lateSession = getAuthSession();
        if (lateSession?.login) {
            try {
                restored = await withPromiseTimeout(
                    restoreAuthSession(),
                    AUTH_SESSION_RESTORE_TIMEOUT_MS,
                    `Таймаут повторного восстановления сессии (${AUTH_SESSION_RESTORE_TIMEOUT_MS / 1000}с).`
                );
            } catch (error) {
                const message = String(error?.message || '').toLowerCase();
                const isTimeout = message.includes('таймаут') || message.includes('timeout');
                activeAuthRestoreAttemptId += 1;
                stopProtectedRealtimeListeners();
                clearAuthSession();
                clearAuthCacheIdentity();
                if (isTimeout) {
                    console.warn('Late auth session restore timed out:', error);
                    pendingAuthRestoreMessage = 'Не удалось восстановить прошлую сессию вовремя. Войдите ещё раз, чтобы заново открыть доступ к промптам.';
                } else {
                    console.warn('Late auth session restore failed:', error);
                    pendingAuthRestoreMessage = getReadableFirebaseAuthError(error, 'login');
                }
                restored = false;
            }
        }
    }

    if (!restored) {
        selectedRole = 'user';
        setCachedStorageValue(USER_ROLE_KEY, 'user');
        showNameModal();
        if (pendingAuthRestoreMessage) {
            setAuthError(pendingAuthRestoreMessage);
        }
    } else {
        hideNameModal();
        debugLog(`Welcome back, ${currentUser?.fio || 'user'} (${selectedRole})`);
    }

    if (auth?.currentUser && !promptsStateHasMeaningfulContent('client')) {
        await bootstrapPromptsViaRestFallback();
    }
}

// ============ NAME MODAL ============

function setPasswordVisibility(isVisible) {
    if (!modalPasswordInput) return;
    const visible = !!isVisible;
    modalPasswordInput.type = visible ? 'text' : 'password';
    if (!togglePasswordVisibilityBtn) return;
    togglePasswordVisibilityBtn.classList.toggle('is-visible', visible);
    const label = visible ? 'Скрыть пароль' : 'Показать пароль';
    togglePasswordVisibilityBtn.setAttribute('aria-label', label);
    togglePasswordVisibilityBtn.removeAttribute('title');
}

function sanitizeModalNameInput() {
    if (!modalNameInput) return;
    const sanitized = sanitizeAuthName(modalNameInput.value);
    if (modalNameInput.value !== sanitized) {
        modalNameInput.value = sanitized;
    }
}

function setModalPasswordAutocompleteMode(mode = 'current-password') {
    if (!modalPasswordInput) return;
    const normalizedMode = mode === 'new-password' ? 'new-password' : 'current-password';
    modalPasswordInput.setAttribute('autocomplete', normalizedMode);
    modalPasswordInput.setAttribute('name', normalizedMode === 'new-password' ? 'new-password' : 'password');
    modalPasswordInput.dataset.autocompleteMode = normalizedMode;
}

async function resolveModalPasswordAutocompleteMode(login = modalLoginInput?.value || '') {
    const normalizedLogin = normalizeLogin(login);
    if (!isValidLogin(normalizedLogin)) {
        return 'current-password';
    }

    if (getEmailLinkAuthReady(normalizedLogin)) {
        return 'new-password';
    }

    const existingUser = await getUserRecordByLogin(normalizedLogin);
    if (!existingUser) {
        return 'new-password';
    }

    if (!!existingUser.emailVerifiedAt && isPendingFirstPasswordSetup(existingUser)) {
        return 'new-password';
    }

    return 'current-password';
}

async function syncModalPasswordAutocompleteMode(login = modalLoginInput?.value || '') {
    const requestId = ++authPasswordAutocompleteRequestId;
    const nextMode = await resolveModalPasswordAutocompleteMode(login);
    if (requestId !== authPasswordAutocompleteRequestId) return;
    setModalPasswordAutocompleteMode(nextMode);
}

function repairModalAutofillCollision() {
    if (!modalNameInput || !modalLoginInput) return;
    const rawName = String(modalNameInput.value || '').trim();
    if (!rawName || !/@/.test(rawName)) return;

    const emailParts = rawName
        .split(/\s+/)
        .map((part) => normalizeLogin(part))
        .filter((part) => isValidLogin(part));
    const autofilledEmail = emailParts[0] || '';
    if (!autofilledEmail) return;

    const currentLogin = normalizeLogin(modalLoginInput.value || '');
    if (!currentLogin || currentLogin === autofilledEmail) {
        modalLoginInput.value = autofilledEmail;
    }

    const sanitizedName = sanitizeAuthName(rawName);
    if (sanitizedName !== modalNameInput.value) {
        modalNameInput.value = sanitizedName;
    }
}

function scheduleModalAutofillRepair() {
    window.setTimeout(() => {
        repairModalAutofillCollision();
        sanitizeModalNameInput();
        void syncModalPasswordAutocompleteMode();
    }, 80);
    window.setTimeout(() => {
        repairModalAutofillCollision();
        sanitizeModalNameInput();
        void syncModalPasswordAutocompleteMode();
    }, 320);
}

const debouncedSyncModalPasswordAutocompleteMode = debounce(() => {
    void syncModalPasswordAutocompleteMode();
}, 180);

function clearAuthModalInitialFocus() {
    if (!authModalInitialFocusTimerId) return;
    clearTimeout(authModalInitialFocusTimerId);
    authModalInitialFocusTimerId = null;
}

function markAuthModalInteraction() {
    didInteractWithAuthModalSinceOpen = true;
    clearAuthModalInitialFocus();
}

function scheduleAuthModalInitialFocus() {
    clearAuthModalInitialFocus();
    authModalInitialFocusTimerId = setTimeout(() => {
        authModalInitialFocusTimerId = null;
        if (!nameModal?.classList.contains('active')) return;
        if (didInteractWithAuthModalSinceOpen) return;
        const activeElement = document.activeElement;
        if (activeElement === modalNameInput || activeElement === modalLoginInput || activeElement === modalPasswordInput) {
            return;
        }
        modalNameInput?.focus();
    }, 100);
}

function showNameModal() {
    if (!nameModal) return;
    nameModal.classList.add('active');
    didInteractWithAuthModalSinceOpen = false;
    syncLocalhostDevAuthActions();
    const localhostDevUser = getLocalhostDevAuthUser();
    if (nameModalStep1) {
        nameModalStep1.style.display = 'block';
    }
    if (modalNameInput && !modalNameInput.value) {
        modalNameInput.value = sanitizeAuthName(getCachedStorageValue(USER_NAME_KEY) || localhostDevUser?.fio || '');
        sanitizeModalNameInput();
    }
    if (modalLoginInput && !modalLoginInput.value) {
        modalLoginInput.value = localhostDevUser?.login || getCachedStorageValue(USER_LOGIN_KEY) || '';
    }
    setModalPasswordAutocompleteMode('current-password');
    setPasswordVisibility(false);
    setAuthMailHelpVisible(false);
    setAuthError('');
    scheduleModalAutofillRepair();
    void syncModalPasswordAutocompleteMode();
    scheduleAuthModalInitialFocus();
}

function hideNameModal() {
    if (!nameModal) return;
    nameModal.classList.remove('active');
    didInteractWithAuthModalSinceOpen = false;
    clearAuthModalInitialFocus();
    if (modalPasswordInput) {
        modalPasswordInput.value = '';
    }
    setPasswordVisibility(false);
    setModalPasswordAutocompleteMode('current-password');
}

bindEvent(authForm, 'submit', (e) => {
    e.preventDefault();
    handleAuthSubmit();
});

bindEvent(localhostDevAuthBtn, 'click', handleLocalhostDevAuth);

if (!authForm && modalNameSubmit) {
    modalNameSubmit.addEventListener('click', () => {
        handleAuthSubmit();
    });
}

if (modalNameInput) {
    modalNameInput.addEventListener('input', () => {
        markAuthModalInteraction();
        repairModalAutofillCollision();
        sanitizeModalNameInput();
    });
    modalNameInput.addEventListener('focus', () => {
        markAuthModalInteraction();
        repairModalAutofillCollision();
        sanitizeModalNameInput();
    });
    modalNameInput.addEventListener('change', () => {
        markAuthModalInteraction();
        repairModalAutofillCollision();
        sanitizeModalNameInput();
    });
}

if (modalLoginInput) {
    modalLoginInput.addEventListener('change', () => {
        markAuthModalInteraction();
        repairModalAutofillCollision();
        void syncModalPasswordAutocompleteMode();
    });
    modalLoginInput.addEventListener('input', () => {
        markAuthModalInteraction();
        repairModalAutofillCollision();
        debouncedSyncModalPasswordAutocompleteMode();
    });
    modalLoginInput.addEventListener('blur', () => {
        repairModalAutofillCollision();
        void syncModalPasswordAutocompleteMode();
    });
    modalLoginInput.addEventListener('focus', () => {
        markAuthModalInteraction();
    });
}

if (modalPasswordInput) {
    modalPasswordInput.addEventListener('focus', () => {
        markAuthModalInteraction();
        void syncModalPasswordAutocompleteMode();
    });
    modalPasswordInput.addEventListener('input', () => {
        markAuthModalInteraction();
    });
}

if (togglePasswordVisibilityBtn) {
    togglePasswordVisibilityBtn.addEventListener('click', () => {
        const nextVisible = modalPasswordInput?.type === 'password';
        setPasswordVisibility(nextVisible);
        modalPasswordInput?.focus();
    });
}
if (authMailHelpImage) {
    authMailHelpImage.addEventListener('error', () => {
        authMailHelpImage.style.display = 'none';
    }, { once: true });
}

// ============ AI IMPROVE MODAL ============

function createAiImproveCancelledError() {
    const error = new Error('AI improve cancelled');
    error.name = 'AbortError';
    error.code = 'AI_IMPROVE_CANCELLED';
    return error;
}

function isAiImproveCancelledError(error) {
    return error?.code === 'AI_IMPROVE_CANCELLED' || error?.name === 'AbortError';
}

function beginAiImproveRequest() {
    if (aiImproveRequestController) {
        try {
            aiImproveRequestController.abort(createAiImproveCancelledError());
        } catch (_) {}
    }
    aiImproveRequestVersion += 1;
    aiImproveRequestController = typeof AbortController !== 'undefined'
        ? new AbortController()
        : null;
    return {
        version: aiImproveRequestVersion,
        signal: aiImproveRequestController?.signal || null
    };
}

function cancelAiImproveRequest() {
    if (aiImproveRequestController) {
        try {
            aiImproveRequestController.abort(createAiImproveCancelledError());
        } catch (_) {}
    }
    aiImproveRequestController = null;
    aiImproveRequestVersion += 1;
}

function finishAiImproveRequest(version = 0) {
    if (version === aiImproveRequestVersion) {
        aiImproveRequestController = null;
    }
}

function throwIfAiImproveRequestStale(version = 0, snapshot = null) {
    if (version !== aiImproveRequestVersion) {
        throw createAiImproveCancelledError();
    }
    if (aiImproveRequestController?.signal?.aborted) {
        throw createAiImproveCancelledError();
    }
    if (!aiImproveModal?.classList?.contains('active')) {
        throw createAiImproveCancelledError();
    }
    if (!snapshot || typeof snapshot !== 'object') return;

    if ((snapshot.mode || 'default') !== aiImproveMode) {
        throw createAiImproveCancelledError();
    }

    const currentRatingContextJson = JSON.stringify(pendingRatingImproveContext || null);
    if ((snapshot.ratingContextJson || 'null') !== currentRatingContextJson) {
        throw createAiImproveCancelledError();
    }

    const currentActiveId = promptsData[snapshot.role]?.activeId || null;
    if ((snapshot.activeVariationId || null) !== currentActiveId) {
        throw createAiImproveCancelledError();
    }

    const currentPrompt = String(getActiveContent(snapshot.role) || '');
    if (currentPrompt !== String(snapshot.prompt || '')) {
        throw createAiImproveCancelledError();
    }
}

function resetAiImproveSubmitUi() {
    if (!aiImproveSubmit) return;
    const btnText = aiImproveSubmit.querySelector('.btn-text');
    const btnLoader = aiImproveSubmit.querySelector('.btn-loader');
    if (btnText && !btnText.dataset.defaultText) {
        btnText.dataset.defaultText = btnText.textContent;
    }
    aiImproveSubmit.disabled = false;
    if (btnText) {
        btnText.textContent = btnText.dataset.defaultText || btnText.textContent;
        btnText.style.display = 'inline';
    }
    if (btnLoader) {
        btnLoader.style.display = 'none';
    }
}

function setAiImproveModalContent(mode = 'default') {
    if (!aiImproveModalTitle || !aiImproveModalDescription || !aiImproveInput) return;
    if (mode === 'rating') {
        aiImproveModalTitle.textContent = 'Улучшить инструкцию на основе представленного диалога и оценки';
        aiImproveModalDescription.textContent = 'Опишите, что конкретно нужно улучшить на основе диалога и оценки.';
        aiImproveInput.placeholder = 'Например: усиль контроль по этапу выявления потребности и добавь конкретные анти-паттерны.';
    } else {
        aiImproveModalTitle.textContent = 'Улучшить инструкцию с ИИ';
        aiImproveModalDescription.textContent = 'Опишите, как бы вы хотели улучшить инструкцию?';
        aiImproveInput.placeholder = 'Например: Сделай инструкцию более структурированной, добавь примеры диалогов...';
    }
}

function resetPendingImproveState() {
    pendingImprovedPrompt = null;
    pendingRole = null;
    pendingName = null;
    pendingVariationId = null;
}

function showAiImproveModal(options = {}) {
    hideTooltip(true);
    cancelAiImproveRequest();
    const { mode = 'default', context = null } = options;
    aiImproveMode = mode;
    pendingRatingImproveContext = mode === 'rating' ? context : null;
    setAiImproveModalContent(mode);

    aiImproveModal.classList.add('active');
    
    // Reset to step 1
    aiImproveStep1.style.display = 'block';
    aiImproveStep2.style.display = 'none';
    resetPendingImproveState();
    resetAiImproveSubmitUi();
    aiImproveInput.value = '';
    
    setTimeout(() => aiImproveInput.focus(), 100);
}

function hideAiImproveModal() {
    cancelAiImproveRequest();
    aiImproveModal.classList.remove('active');
    pendingRatingImproveContext = null;
    aiImproveMode = 'default';
    setAiImproveModalContent('default');
    resetPendingImproveState();
    resetAiImproveSubmitUi();
}

function setVoiceModeStatus(text, state = 'idle') {
    if (!voiceModeStatus) return;
    voiceModeStatus.textContent = text;
    voiceModeStatus.dataset.state = state;
}

function clearVoiceModeWidgetHideTimer() {
    if (!voiceModeWidgetHideTimerId) return;
    clearTimeout(voiceModeWidgetHideTimerId);
    voiceModeWidgetHideTimerId = 0;
}

function isElevenLabsWidgetDefined() {
    if (typeof customElements === 'undefined') return false;
    if (typeof customElements.get !== 'function') return false;
    return !!customElements.get(ELEVENLABS_WIDGET_ELEMENT_NAME);
}

function getElevenLabsWidgetScriptCandidates() {
    const candidates = [...ELEVENLABS_WIDGET_SOURCES];
    if (typeof document === 'undefined') return candidates;
    document.querySelectorAll('script[src*="@elevenlabs/convai-widget-embed"]').forEach((node) => {
        const src = normalizeScriptSrc(node?.src || '');
        if (!src) return;
        if (!getTrustedExternalScriptMetadata(src)) return;
        if (candidates.includes(src)) return;
        candidates.unshift(src);
    });
    return candidates;
}

function waitForElevenLabsWidgetDefinition(timeoutMs = ELEVENLABS_WIDGET_LOAD_TIMEOUT_MS) {
    if (isElevenLabsWidgetDefined()) return Promise.resolve(true);
    if (typeof customElements === 'undefined' || typeof customElements.whenDefined !== 'function') {
        return Promise.resolve(false);
    }

    return new Promise((resolve) => {
        let settled = false;
        const finish = (result) => {
            if (settled) return;
            settled = true;
            resolve(!!result);
        };
        const timeoutId = setTimeout(() => finish(isElevenLabsWidgetDefined()), Math.max(300, timeoutMs));
        customElements.whenDefined(ELEVENLABS_WIDGET_ELEMENT_NAME)
            .then(() => {
                clearTimeout(timeoutId);
                finish(true);
            })
            .catch(() => {
                clearTimeout(timeoutId);
                finish(false);
            });
    });
}

function loadElevenLabsWidgetScriptSource(src, timeoutMs = ELEVENLABS_WIDGET_LOAD_TIMEOUT_MS) {
    if (typeof document === 'undefined') return Promise.resolve(false);
    const normalizedSrc = normalizeScriptSrc(src);
    if (!normalizedSrc) return Promise.resolve(false);
    if (!getTrustedExternalScriptMetadata(normalizedSrc)) {
        return Promise.resolve(false);
    }

    return new Promise((resolve) => {
        let script = Array.from(document.querySelectorAll('script')).find((node) => {
            return normalizeScriptSrc(node?.src || '') === normalizedSrc;
        }) || null;

        if (!script) {
            script = document.createElement('script');
            script.src = normalizedSrc;
            script.async = true;
            script.type = 'text/javascript';
            applyTrustedExternalScriptPolicy(script, normalizedSrc);
            document.head?.appendChild(script);
        } else {
            try {
                applyTrustedExternalScriptPolicy(script, normalizedSrc);
            } catch (error) {
                resolve(false);
                return;
            }
        }

        if (isElevenLabsWidgetDefined()) {
            resolve(true);
            return;
        }

        let settled = false;
        const finish = (result) => {
            if (settled) return;
            settled = true;
            script.removeEventListener('load', onLoad);
            script.removeEventListener('error', onError);
            clearTimeout(timeoutId);
            resolve(!!result);
        };
        const onLoad = () => finish(true);
        const onError = () => finish(false);
        const timeoutId = setTimeout(() => finish(false), Math.max(500, timeoutMs));

        script.addEventListener('load', onLoad);
        script.addEventListener('error', onError);
    });
}

async function ensureElevenLabsWidgetReady() {
    if (isElevenLabsWidgetDefined()) return true;
    if (elevenLabsWidgetLoadPromise) return elevenLabsWidgetLoadPromise;

    elevenLabsWidgetLoadPromise = (async () => {
        const candidates = getElevenLabsWidgetScriptCandidates();
        for (const src of candidates) {
            await loadElevenLabsWidgetScriptSource(src);
            const isDefined = await waitForElevenLabsWidgetDefinition();
            if (isDefined) return true;
        }
        return isElevenLabsWidgetDefined();
    })();

    const isReady = await elevenLabsWidgetLoadPromise;
    elevenLabsWidgetLoadPromise = null;
    return isReady;
}

async function canReachElevenLabsNetwork(timeoutMs = 3200) {
    if (typeof fetch !== 'function') return true;
    const targets = [
        'https://api.elevenlabs.io',
        'https://elevenlabs.io'
    ];

    for (const target of targets) {
        let timeoutId = null;
        let controller = null;
        try {
            if (typeof AbortController !== 'undefined') {
                controller = new AbortController();
                timeoutId = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));
            }
            await fetch(target, {
                method: 'GET',
                mode: 'no-cors',
                cache: 'no-store',
                signal: controller ? controller.signal : undefined
            });
            if (timeoutId) clearTimeout(timeoutId);
            return true;
        } catch (error) {
            if (timeoutId) clearTimeout(timeoutId);
        }
    }

    return false;
}

function updateVoiceModeControls() {
    if (voiceModeStartBtn) {
        if (isGeminiVoiceConnecting) {
            voiceModeStartBtn.textContent = 'Подключение...';
            voiceModeStartBtn.disabled = true;
        } else if (isGeminiVoiceActive) {
            voiceModeStartBtn.textContent = 'Подключено';
            voiceModeStartBtn.disabled = true;
        } else {
            voiceModeStartBtn.textContent = 'Начать';
            voiceModeStartBtn.disabled = false;
        }
    }
    if (voiceModeStopBtn) {
        const shouldShowStop = isGeminiVoiceConnecting || isGeminiVoiceActive;
        voiceModeStopBtn.hidden = !shouldShowStop;
        voiceModeStopBtn.style.display = shouldShowStop ? '' : 'none';
        voiceModeStopBtn.disabled = !shouldShowStop;
    }
}

function normalizeGeminiTokenEndpoint(value) {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    return normalized
        .replace(/\/api\/openai-realtime-session\/?$/i, '/api/gemini-live-token')
        .replace(/\/api\/gemini-live-token\/?$/i, '/api/gemini-live-token');
}

function isLoopbackHostname(hostname = '') {
    const normalized = String(hostname || '').trim().toLowerCase();
    return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '[::1]' || normalized === '::1';
}

function getTrustedVoiceTokenEndpointOrigins() {
    const origins = new Set(TRUSTED_VOICE_TOKEN_ENDPOINT_ORIGINS);
    const currentOrigin = String(window?.location?.origin || '').trim();
    if (/^https?:\/\//i.test(currentOrigin)) {
        origins.add(currentOrigin);
    }

    const configuredOrigins = typeof window !== 'undefined'
        ? (window.ALLOWED_VOICE_TOKEN_ENDPOINT_ORIGINS || window.OPENAI_REALTIME_ALLOWED_ORIGINS || [])
        : [];
    const rawItems = Array.isArray(configuredOrigins)
        ? configuredOrigins
        : String(configuredOrigins || '').split(',');

    rawItems.forEach((item) => {
        const raw = String(item || '').trim();
        if (!raw) return;
        try {
            const parsed = new URL(raw);
            if (/^https?:$/i.test(parsed.protocol)) {
                origins.add(parsed.origin);
            }
        } catch (error) {}
    });

    return origins;
}

function sanitizeGeminiTokenEndpointOrThrow(value, options = {}) {
    const {
        source = 'Token endpoint'
    } = options;
    const raw = String(value || '').trim();
    if (!raw) return '';

    const hasExplicitScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(raw);
    const isProtocolRelative = raw.startsWith('//');
    const normalizedRaw = normalizeGeminiTokenEndpoint(raw);

    let parsed = null;
    try {
        parsed = new URL(normalizedRaw, window.location.origin);
    } catch (error) {
        throw new Error(`${source}: укажите корректный URL.`);
    }

    if (!/^https?:$/i.test(parsed.protocol)) {
        throw new Error(`${source}: разрешён только http/https URL.`);
    }
    if (parsed.username || parsed.password) {
        throw new Error(`${source}: URL не должен содержать логин или пароль.`);
    }
    if (parsed.search || parsed.hash) {
        throw new Error(`${source}: URL не должен содержать query или hash.`);
    }

    const normalizedPath = normalizeGeminiTokenEndpoint(parsed.pathname || '').replace(/\/+$/, '') || '/';
    if (normalizedPath !== GEMINI_LIVE_ALLOWED_TOKEN_ENDPOINT_PATH) {
        throw new Error(`${source}: разрешён только путь ${GEMINI_LIVE_ALLOWED_TOKEN_ENDPOINT_PATH}.`);
    }

    const isLoopback = isLoopbackHostname(parsed.hostname);
    const allowedOrigins = getTrustedVoiceTokenEndpointOrigins();
    if (!(parsed.origin === window.location.origin || allowedOrigins.has(parsed.origin) || isLoopback)) {
        throw new Error(`${source}: домен не входит в доверенный allowlist.`);
    }
    if (parsed.protocol === 'http:' && !isLoopback) {
        throw new Error(`${source}: HTTP разрешён только для localhost.`);
    }

    if ((!hasExplicitScheme && !isProtocolRelative) || parsed.origin === window.location.origin) {
        return normalizedPath;
    }
    return `${parsed.origin}${normalizedPath}`;
}

function getTrustedGeminiTokenEndpointOrEmpty(value, options = {}) {
    const {
        source = 'Token endpoint',
        clearStorageKey = ''
    } = options;
    try {
        return sanitizeGeminiTokenEndpointOrThrow(value, { source });
    } catch (error) {
        if (clearStorageKey) {
            removeCachedStorageValue(clearStorageKey);
        }
        if (String(value || '').trim()) {
            console.warn(`Ignoring unsafe voice token endpoint from ${source}:`, error);
        }
        return '';
    }
}

function getSharedGeminiTokenEndpoint() {
    return getTrustedGeminiTokenEndpointOrEmpty(sharedAppConfig?.geminiTokenEndpoint || '', {
        source: 'shared voice token endpoint'
    });
}

function setSharedGeminiTokenEndpoint(value) {
    sharedAppConfig.geminiTokenEndpoint = getTrustedGeminiTokenEndpointOrEmpty(value, {
        source: 'shared voice token endpoint'
    });
}

function normalizeClientConversationActionPrompt(value) {
    return String(value || '').replace(/\r\n/g, '\n').trim();
}

function getSharedClientConversationActionPrompt() {
    return normalizeClientConversationActionPrompt(sharedAppConfig?.clientConversationActionPrompt || '');
}

function setSharedClientConversationActionPrompt(value, options = {}) {
    const { clearCache = false } = options;
    const normalized = normalizeClientConversationActionPrompt(value);
    sharedAppConfig.clientConversationActionPrompt = normalized;
    if (normalized) {
        setCachedStorageValue(CLIENT_CONVERSATION_ACTION_PROMPT_STORAGE_KEY, normalized);
    } else if (clearCache) {
        removeCachedStorageValue(CLIENT_CONVERSATION_ACTION_PROMPT_STORAGE_KEY);
    }
}

function getConfiguredClientConversationActionPrompt() {
    const sharedPrompt = getSharedClientConversationActionPrompt();
    if (sharedPrompt) return sharedPrompt;
    const cachedPrompt = normalizeClientConversationActionPrompt(
        getCachedStorageValue(CLIENT_CONVERSATION_ACTION_PROMPT_STORAGE_KEY) || ''
    );
    return cachedPrompt || DEFAULT_CLIENT_CONVERSATION_ACTION_PROMPT_SUFFIX;
}

function normalizeRaterHiddenPrompt(value) {
    return normalizeClientConversationActionPrompt(value);
}

function getSharedRaterHiddenPrompt() {
    return normalizeRaterHiddenPrompt(sharedAppConfig?.raterHiddenPrompt || '');
}

function setSharedRaterHiddenPrompt(value, options = {}) {
    const { clearCache = false } = options;
    const normalized = normalizeRaterHiddenPrompt(value);
    sharedAppConfig.raterHiddenPrompt = normalized;
    if (normalized) {
        setCachedStorageValue(RATER_HIDDEN_PROMPT_STORAGE_KEY, normalized);
    } else if (clearCache) {
        removeCachedStorageValue(RATER_HIDDEN_PROMPT_STORAGE_KEY);
    }
}

function getConfiguredRaterHiddenPrompt() {
    const shared = getSharedRaterHiddenPrompt();
    if (shared) return shared;
    return normalizeRaterHiddenPrompt(getCachedStorageValue(RATER_HIDDEN_PROMPT_STORAGE_KEY) || '');
}

function getDefaultGeminiTokenEndpoint() {
    const explicitEndpoint = String(
        (
            typeof window !== 'undefined' &&
            (window.GEMINI_LIVE_TOKEN_ENDPOINT || window.GEMINI_TOKEN_ENDPOINT || window.OPENAI_REALTIME_TOKEN_ENDPOINT || window.OPENAI_TOKEN_ENDPOINT)
        ) ||
        ''
    ).trim();
    if (explicitEndpoint) return explicitEndpoint;

    if (typeof window !== 'undefined' && isLoopbackHostname(window.location.hostname || '')) {
        const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
        return `${protocol}//${window.location.hostname}:8787${GEMINI_LIVE_ALLOWED_TOKEN_ENDPOINT_PATH}`;
    }

    return String(GEMINI_LIVE_REMOTE_TOKEN_ENDPOINT || GEMINI_LIVE_DEFAULT_TOKEN_ENDPOINT || '').trim();
}

function getConfiguredGeminiTokenEndpoint() {
    const localOverride = getTrustedGeminiTokenEndpointOrEmpty(
        getCachedStorageValue(GEMINI_LIVE_TOKEN_ENDPOINT_STORAGE_KEY),
        {
            source: 'local voice token endpoint',
            clearStorageKey: GEMINI_LIVE_TOKEN_ENDPOINT_STORAGE_KEY
        }
    );
    if (localOverride) return localOverride;

    const sharedEndpoint = getSharedGeminiTokenEndpoint();
    if (sharedEndpoint) return sharedEndpoint;

    return getTrustedGeminiTokenEndpointOrEmpty(getDefaultGeminiTokenEndpoint(), {
        source: 'default voice token endpoint'
    }) || GEMINI_LIVE_ALLOWED_TOKEN_ENDPOINT_PATH;
}

function getConfiguredGeminiVoiceName() {
    const value = String(
        (typeof window !== 'undefined' && window.GEMINI_LIVE_VOICE_NAME) ||
        getCachedStorageValue(GEMINI_LIVE_VOICE_NAME_STORAGE_KEY) ||
        GEMINI_LIVE_DEFAULT_VOICE
    ).trim();
    return value || GEMINI_LIVE_DEFAULT_VOICE;
}

function populateVoiceConfigFields() {
    if (geminiApiKeyInput) {
        removeCachedStorageValue(LEGACY_GEMINI_LIVE_API_KEY_STORAGE_KEY);
        geminiApiKeyInput.value = '';
    }
    if (geminiTokenEndpointInput) {
        geminiTokenEndpointInput.value = getConfiguredGeminiTokenEndpoint();
    }
    if (geminiVoiceNameInput) {
        geminiVoiceNameInput.value = getConfiguredGeminiVoiceName();
    }
}

function populateHiddenClientPromptField() {
    if (!adminHiddenClientPromptInput) return;
    adminHiddenClientPromptInput.value = getConfiguredClientConversationActionPrompt();
}

function populateHiddenRaterPromptField() {
    if (!adminHiddenRaterPromptInput) return;
    adminHiddenRaterPromptInput.value = getConfiguredRaterHiddenPrompt();
}

async function saveSharedGeminiTokenEndpointConfig(value) {
    if (!(db && selectedRole === 'admin')) return false;
    await ensureCurrentUserAccessMirror();
    const normalized = sanitizeGeminiTokenEndpointOrThrow(value, {
        source: 'Глобальный voice token endpoint'
    });
    await set(ref(db, `${APP_CONFIG_DB_PATH}/geminiTokenEndpoint`), normalized || null);
    setSharedGeminiTokenEndpoint(normalized);
    return true;
}

async function saveSharedClientConversationActionPromptConfig(value) {
    if (!(db && selectedRole === 'admin')) return false;
    await ensureCurrentUserAccessMirror();
    const normalized = normalizeClientConversationActionPrompt(value);
    await set(ref(db, `${APP_CONFIG_DB_PATH}/clientConversationActionPrompt`), normalized || null);
    setSharedClientConversationActionPrompt(normalized);
    return true;
}

async function saveSharedRaterHiddenPromptConfig(value) {
    if (!(db && selectedRole === 'admin')) return false;
    await ensureCurrentUserAccessMirror();
    const normalized = normalizeRaterHiddenPrompt(value);
    await set(ref(db, `${APP_CONFIG_DB_PATH}/raterHiddenPrompt`), normalized || null);
    setSharedRaterHiddenPrompt(normalized);
    return true;
}

async function saveHiddenClientPromptFromInput() {
    const normalized = normalizeClientConversationActionPrompt(adminHiddenClientPromptInput?.value || '');
    setSharedClientConversationActionPrompt(normalized, { clearCache: !normalized });
    let sharedSaved = false;
    try {
        sharedSaved = await saveSharedClientConversationActionPromptConfig(normalized);
    } catch (error) {
        console.warn('Failed to save shared hidden client prompt:', error);
    }
    populateHiddenClientPromptField();
    showCopyNotification(sharedSaved ? 'Скрытый prompt клиента сохранён' : 'Скрытый prompt клиента сохранён локально');
}

async function resetHiddenClientPromptToDefault() {
    setSharedClientConversationActionPrompt('', { clearCache: true });
    if (db && selectedRole === 'admin') {
        try {
            await ensureCurrentUserAccessMirror();
            await set(ref(db, `${APP_CONFIG_DB_PATH}/clientConversationActionPrompt`), null);
        } catch (error) {
            console.warn('Failed to reset shared hidden client prompt:', error);
        }
    }
    populateHiddenClientPromptField();
    showCopyNotification('Скрытый prompt клиента сброшен к умолчанию');
}

async function saveHiddenRaterPromptFromInput() {
    const normalized = normalizeRaterHiddenPrompt(adminHiddenRaterPromptInput?.value || '');
    setSharedRaterHiddenPrompt(normalized, { clearCache: !normalized });
    let sharedSaved = false;
    try {
        sharedSaved = await saveSharedRaterHiddenPromptConfig(normalized);
    } catch (error) {
        console.warn('Failed to save shared hidden rater prompt:', error);
    }
    populateHiddenRaterPromptField();
    showCopyNotification(sharedSaved ? 'Скрытый prompt оценщика сохранён' : 'Скрытый prompt оценщика сохранён локально');
}

async function resetHiddenRaterPromptToDefault() {
    setSharedRaterHiddenPrompt('', { clearCache: true });
    if (db && selectedRole === 'admin') {
        try {
            await ensureCurrentUserAccessMirror();
            await set(ref(db, `${APP_CONFIG_DB_PATH}/raterHiddenPrompt`), null);
        } catch (error) {
            console.warn('Failed to reset shared hidden rater prompt:', error);
        }
    }
    populateHiddenRaterPromptField();
    showCopyNotification('Скрытый prompt оценщика сброшен');
}

async function saveVoiceModeConfigFromInputs() {
    const apiKey = String(geminiApiKeyInput?.value || '').trim();
    const tokenEndpoint = sanitizeGeminiTokenEndpointOrThrow(geminiTokenEndpointInput?.value || '', {
        source: 'Voice token endpoint'
    });
    const voiceNameRaw = String(geminiVoiceNameInput?.value || '').trim();
    const voiceName = voiceNameRaw || GEMINI_LIVE_DEFAULT_VOICE;

    removeCachedStorageValue(LEGACY_GEMINI_LIVE_API_KEY_STORAGE_KEY);

    if (tokenEndpoint) {
        setCachedStorageValue(GEMINI_LIVE_TOKEN_ENDPOINT_STORAGE_KEY, tokenEndpoint);
    } else {
        removeCachedStorageValue(GEMINI_LIVE_TOKEN_ENDPOINT_STORAGE_KEY);
    }

    if (voiceName) {
        setCachedStorageValue(GEMINI_LIVE_VOICE_NAME_STORAGE_KEY, voiceName);
    } else {
        removeCachedStorageValue(GEMINI_LIVE_VOICE_NAME_STORAGE_KEY);
    }

    let sharedSaved = false;
    try {
        sharedSaved = await saveSharedGeminiTokenEndpointConfig(tokenEndpoint);
    } catch (error) {
        console.warn('Failed to save shared Gemini token endpoint:', error);
    }

    if (tokenEndpoint || voiceName) {
        showCopyNotification(sharedSaved ? 'Настройки Gemini Live сохранены для всех пользователей' : 'Настройки Gemini Live сохранены');
    } else if (apiKey) {
        showCopyNotification('API key в браузере больше не используется. Настройте token endpoint.');
    } else {
        showCopyNotification('Настройки голосового режима очищены');
    }
}

function getVoiceConfigErrorMessage(error) {
    return String(error?.message || 'Ошибка сохранения настроек Gemini Live');
}

async function clearVoiceModeConfig() {
    removeCachedStorageValue(LEGACY_GEMINI_LIVE_API_KEY_STORAGE_KEY);
    removeCachedStorageValue(GEMINI_LIVE_TOKEN_ENDPOINT_STORAGE_KEY);
    removeCachedStorageValue(GEMINI_LIVE_VOICE_NAME_STORAGE_KEY);

    if (db && selectedRole === 'admin') {
        try {
            await ensureCurrentUserAccessMirror();
            await set(ref(db, `${APP_CONFIG_DB_PATH}/geminiTokenEndpoint`), null);
            setSharedGeminiTokenEndpoint('');
        } catch (error) {
            console.warn('Failed to clear shared Gemini token endpoint:', error);
        }
    }

    if (geminiApiKeyInput) geminiApiKeyInput.value = '';
    if (geminiTokenEndpointInput) geminiTokenEndpointInput.value = getConfiguredGeminiTokenEndpoint();
    if (geminiVoiceNameInput) geminiVoiceNameInput.value = GEMINI_LIVE_DEFAULT_VOICE;
    showCopyNotification('Данные голосового режима удалены на этом устройстве');
}

async function getFirebaseAuthIdToken() {
    if (!auth?.currentUser || typeof auth.currentUser.getIdToken !== 'function') return '';
    try {
        return String(await auth.currentUser.getIdToken()).trim();
    } catch (error) {
        console.warn('Failed to get Firebase ID token for voice endpoint:', error);
        return '';
    }
}

function createGeminiVoiceStartCancelledError() {
    const error = new Error('Voice start cancelled');
    error.code = 'VOICE_START_CANCELLED';
    return error;
}

function isGeminiVoiceStartCancelledError(error) {
    return error?.code === 'VOICE_START_CANCELLED' || error?.name === 'AbortError';
}

function canUseLocalhostDevVoiceTokenFallback(tokenEndpoint = '') {
    if (!isLocalhostDevBypassSession()) return false;
    try {
        const parsed = new URL(tokenEndpoint, window.location.origin);
        return isLoopbackHostname(parsed.hostname);
    } catch (error) {
        return false;
    }
}

function beginGeminiVoiceStartAttempt() {
    if (geminiVoiceStartAbortController) {
        try {
            geminiVoiceStartAbortController.abort();
        } catch (error) {}
    }
    geminiVoiceStartAttemptId += 1;
    geminiVoiceStartAbortController = typeof AbortController !== 'undefined'
        ? new AbortController()
        : null;
    return {
        id: geminiVoiceStartAttemptId,
        signal: geminiVoiceStartAbortController?.signal || null
    };
}

function cancelGeminiVoiceStartAttempt() {
    if (geminiVoiceStartAbortController) {
        try {
            geminiVoiceStartAbortController.abort();
        } catch (error) {}
    }
    geminiVoiceStartAbortController = null;
    geminiVoiceStartAttemptId += 1;
}

function finishGeminiVoiceStartAttempt(attemptId = 0) {
    if (attemptId === geminiVoiceStartAttemptId) {
        geminiVoiceStartAbortController = null;
    }
}

function throwIfGeminiVoiceStartAttemptStale(attemptId = 0) {
    if (attemptId !== geminiVoiceStartAttemptId) {
        throw createGeminiVoiceStartCancelledError();
    }
    if (geminiVoiceStartAbortController?.signal?.aborted) {
        throw createGeminiVoiceStartCancelledError();
    }
}

async function loadGeminiSdkModule() {
    if (!geminiSdkModulePromise) {
        geminiSdkModulePromise = import(GEMINI_SDK_CDN_URL).catch((error) => {
            geminiSdkModulePromise = null;
            throw error;
        });
    }
    return geminiSdkModulePromise;
}

async function resolveGeminiLiveApiKey(sessionConfig = {}, options = {}) {
    const tokenEndpoint = sanitizeGeminiTokenEndpointOrThrow(getConfiguredGeminiTokenEndpoint(), {
        source: 'Voice token endpoint'
    });
    if (!tokenEndpoint) {
        throw new Error('Голосовой режим не настроен: нужен token endpoint сервера.');
    }

    const idToken = await getFirebaseAuthIdToken();
    const canUseLocalFallback = !idToken && canUseLocalhostDevVoiceTokenFallback(tokenEndpoint);
    if (!idToken && !canUseLocalFallback) {
        throw new Error('Для голосового режима нужен подтвержденный вход через email.');
    }
    const headers = { 'Content-Type': 'application/json' };
    if (idToken) {
        headers.Authorization = `Bearer ${idToken}`;
    }

    const tokenResponse = await fetchWithTimeout(tokenEndpoint, {
        method: 'POST',
        headers,
        credentials: 'omit',
        body: JSON.stringify({
            source: 'client-simulator-web',
            login: normalizeLogin(
                currentUser?.login
                || auth?.currentUser?.email
                || getAuthSession()?.login
                || getCachedStorageValue(USER_LOGIN_KEY)
                || ''
            ),
            model: sessionConfig?.model || GEMINI_LIVE_MODEL,
            voice: sessionConfig?.voice || getConfiguredGeminiVoiceName(),
            instructions: String(sessionConfig?.instructions || '').trim()
        }),
        signal: options?.signal
    }, 20000);
    if (!tokenResponse.ok) {
        const tokenErrorPayload = await readResponseJsonWithTimeout(
            tokenResponse,
            10000,
            'Таймаут чтения ошибки token endpoint.',
            {}
        );
        const tokenErrorText = String(tokenErrorPayload?.error || '').trim();
        if (tokenResponse.status === 401 || tokenResponse.status === 403) {
            throw new Error(tokenErrorText || 'Нет доступа к голосовому режиму');
        }
        throw new Error(tokenErrorText || `Не удалось получить ключ сессии (HTTP ${tokenResponse.status})`);
    }
    const tokenPayload = await readResponseJsonWithTimeout(
        tokenResponse,
        20000,
        'Таймаут чтения ответа token endpoint.'
    );
    const token = String(
        tokenPayload?.client_secret?.value ||
        tokenPayload?.name ||
        tokenPayload?.token ||
        tokenPayload?.accessToken ||
        tokenPayload?.apiKey ||
        ''
    ).trim();
    if (token) return token;
    throw new Error('Эндпоинт ключа сессии вернул пустой ответ');
}

function uint8ToBase64(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
}

function base64ToUint8(base64) {
    const normalized = String(base64 || '').trim();
    if (!normalized) return new Uint8Array(0);
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function float32ToInt16Pcm(floatBuffer) {
    const pcm = new Uint8Array(floatBuffer.length * 2);
    const view = new DataView(pcm.buffer);
    for (let i = 0; i < floatBuffer.length; i += 1) {
        const sample = Math.max(-1, Math.min(1, floatBuffer[i]));
        view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }
    return pcm;
}

function downsampleAudioBuffer(buffer, inputRate, outputRate = 16000) {
    if (!buffer || !buffer.length) return new Float32Array(0);
    if (outputRate >= inputRate) return new Float32Array(buffer);

    const ratio = inputRate / outputRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;

    while (offsetResult < newLength) {
        const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
        let accum = 0;
        let count = 0;
        for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i += 1) {
            accum += buffer[i];
            count += 1;
        }
        result[offsetResult] = count > 0 ? accum / count : 0;
        offsetResult += 1;
        offsetBuffer = nextOffsetBuffer;
    }

    return result;
}

function calculateRms(buffer) {
    if (!buffer || !buffer.length) return 0;
    let sum = 0;
    for (let i = 0; i < buffer.length; i += 1) {
        const v = buffer[i];
        sum += v * v;
    }
    return Math.sqrt(sum / buffer.length);
}

function getMimeRate(mimeType, fallback = 24000) {
    const match = /rate=(\d+)/i.exec(String(mimeType || ''));
    if (!match) return fallback;
    const value = Number(match[1]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function enqueueGeminiAudioPlayback(base64Data, mimeType = 'audio/pcm;rate=24000') {
    if (!base64Data) return;
    if (!geminiVoiceAudioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        geminiVoiceAudioContext = new AudioCtx();
    }
    if (geminiVoiceAudioContext.state === 'suspended') {
        await geminiVoiceAudioContext.resume();
    }

    const bytes = base64ToUint8(base64Data);
    if (!bytes.length || bytes.length % 2 !== 0) return;

    const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
    const sampleRate = getMimeRate(mimeType, 24000);
    const audioBuffer = geminiVoiceAudioContext.createBuffer(1, int16.length, sampleRate);
    const channel = audioBuffer.getChannelData(0);
    for (let i = 0; i < int16.length; i += 1) {
        channel[i] = int16[i] / 32768;
    }

    const source = geminiVoiceAudioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(geminiVoiceAudioContext.destination);
    const now = geminiVoiceAudioContext.currentTime;
    const startAt = Math.max(now + 0.01, geminiVoicePlaybackCursor || 0);
    source.start(startAt);
    geminiVoicePlaybackCursor = startAt + audioBuffer.duration;
}

function resetGeminiPlaybackCursor() {
    if (!geminiVoiceAudioContext) {
        geminiVoicePlaybackCursor = 0;
        return;
    }
    geminiVoicePlaybackCursor = geminiVoiceAudioContext.currentTime;
}

function getShortStatusText(prefix, text, maxLength = 140) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return prefix;
    if (clean.length <= maxLength) return `${prefix} ${clean}`;
    return `${prefix} ${clean.slice(0, maxLength)}...`;
}

function getGeminiCloseReasonText(event) {
    const code = Number(event?.code);
    const reason = String(event?.reason || event?.message || '').trim();
    const details = [];
    if (Number.isFinite(code) && code > 0 && code !== 1000) {
        details.push(`код ${code}`);
    }
    if (reason) {
        details.push(reason);
    }
    if (!details.length) return '';
    return ` (${details.join(', ')})`;
}

function normalizeVoiceDialogText(text) {
    return String(text || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+([,.;:!?])/g, '$1')
        .trim();
}

function normalizeVoiceDialogForCompare(text) {
    return normalizeVoiceDialogText(text).toLowerCase();
}

function normalizeVoiceDialogCompact(text) {
    return normalizeVoiceDialogForCompare(text).replace(/[^a-zа-яё0-9]+/gi, '');
}

function pickReadableVoiceVariant(a, b) {
    const first = normalizeVoiceDialogText(a);
    const second = normalizeVoiceDialogText(b);
    if (!first) return second;
    if (!second) return first;

    const score = (value) => {
        const spaces = (value.match(/\s/g) || []).length;
        const punctuation = (value.match(/[.,;:!?-]/g) || []).length;
        return spaces * 2 + punctuation + value.length * 0.01;
    };

    return score(second) >= score(first) ? second : first;
}

function hasCompactBoundaryOverlap(a, b, minOverlap = 8) {
    const first = normalizeVoiceDialogCompact(a);
    const second = normalizeVoiceDialogCompact(b);
    if (!first || !second) return false;
    if (first.includes(second) || second.includes(first)) return true;

    const maxOverlap = Math.min(first.length, second.length);
    for (let overlap = maxOverlap; overlap >= minOverlap; overlap -= 1) {
        if (first.slice(-overlap) === second.slice(0, overlap)) return true;
        if (second.slice(-overlap) === first.slice(0, overlap)) return true;
    }
    return false;
}

function getRecentAssistantTranscriptForEchoGuard() {
    const preview = normalizeVoiceDialogText(geminiVoiceAssistantPreview);
    if (preview) return preview;

    const draft = normalizeVoiceDialogText(geminiVoiceAssistantDraft);
    if (draft) return draft;

    for (let i = geminiVoiceDialogLines.length - 1; i >= 0; i -= 1) {
        const line = geminiVoiceDialogLines[i];
        if (line?.role !== 'assistant') continue;
        const text = normalizeVoiceDialogText(line?.text);
        if (text) return text;
    }

    for (let i = conversationHistory.length - 1; i >= 0; i -= 1) {
        const line = conversationHistory[i];
        if (line?.role !== 'assistant') continue;
        const text = normalizeVoiceDialogText(line?.content);
        if (text) return text;
    }
    return '';
}

function sanitizeUserCompletedTranscript(rawText) {
    const source = normalizeVoiceDialogText(rawText);
    if (!source) return '';

    const assistantText = getRecentAssistantTranscriptForEchoGuard();
    if (!assistantText) return source;

    const sourceCompact = normalizeVoiceDialogCompact(source);
    const assistantCompact = normalizeVoiceDialogCompact(assistantText);
    if (!sourceCompact || !assistantCompact || assistantCompact.length < 20) return source;

    if (sourceCompact === assistantCompact || assistantCompact.includes(sourceCompact)) {
        return '';
    }

    const sourceNorm = normalizeVoiceDialogForCompare(source);
    const assistantNorm = normalizeVoiceDialogForCompare(assistantText);
    const idx = sourceNorm.indexOf(assistantNorm);
    if (idx === -1) return source;

    const before = normalizeVoiceDialogText(source.slice(0, idx));
    return before;
}

function getRecentUserTranscriptForEchoGuard() {
    const pendingTurn = normalizeVoiceDialogText(openAiPendingUserTurn);
    if (pendingTurn) return pendingTurn;

    const preview = normalizeVoiceDialogText(geminiVoiceUserPreview);
    if (preview) return preview;

    const draft = normalizeVoiceDialogText(geminiVoiceUserDraft);
    if (draft) return draft;

    for (let i = geminiVoiceDialogLines.length - 1; i >= 0; i -= 1) {
        const line = geminiVoiceDialogLines[i];
        if (line?.role !== 'user') continue;
        const text = normalizeVoiceDialogText(line?.text);
        if (text) return text;
    }

    for (let i = conversationHistory.length - 1; i >= 0; i -= 1) {
        const line = conversationHistory[i];
        if (line?.role !== 'user') continue;
        const text = normalizeVoiceDialogText(line?.content);
        if (text) return text;
    }
    return '';
}

function sanitizeAssistantCompletedTranscript(rawText) {
    const source = normalizeVoiceDialogText(rawText);
    if (!source) return '';

    const userText = getRecentUserTranscriptForEchoGuard();
    if (!userText) return source;

    const sourceCompact = normalizeVoiceDialogCompact(source);
    const userCompact = normalizeVoiceDialogCompact(userText);
    if (!sourceCompact || !userCompact || userCompact.length < 20) return source;

    if (sourceCompact === userCompact || userCompact.includes(sourceCompact)) {
        return '';
    }

    const sourceNorm = normalizeVoiceDialogForCompare(source);
    const userNorm = normalizeVoiceDialogForCompare(userText);
    if (!sourceNorm || !userNorm) return source;

    if (sourceNorm.startsWith(userNorm)) {
        const tail = normalizeVoiceDialogText(source.slice(userText.length));
        return tail || source;
    }

    const userIdx = sourceNorm.indexOf(userNorm);
    if (userIdx === -1) return source;
    if (userIdx > Math.floor(sourceNorm.length * 0.4)) return source;

    const before = normalizeVoiceDialogText(source.slice(0, userIdx));
    const after = normalizeVoiceDialogText(source.slice(userIdx + userText.length));
    if (!before && after) return after;
    return source;
}

function clearGeminiFirstReplyHintTimer() {
    if (!geminiVoiceFirstReplyHintTimer) return;
    clearTimeout(geminiVoiceFirstReplyHintTimer);
    geminiVoiceFirstReplyHintTimer = null;
}

function scheduleGeminiFirstReplyHint() {
    clearGeminiFirstReplyHintTimer();
    geminiVoiceFirstReplyHintTimer = setTimeout(() => {
        geminiVoiceFirstReplyHintTimer = null;
        if (!isGeminiVoiceActive || geminiVoiceHasAssistantReply) return;
        setVoiceModeStatus('ИИ-клиент формирует первый ответ…', 'waiting');
    }, GEMINI_FIRST_REPLY_HINT_DELAY_MS);
}

function mergeVoiceStreamingText(prevText, nextText) {
    const prev = String(prevText || '');
    const next = String(nextText || '');
    if (!next.trim()) return prev;
    if (!prev.trim()) return next.trimStart();

    const prevNorm = normalizeVoiceDialogForCompare(prev);
    const nextNorm = normalizeVoiceDialogForCompare(next);
    const prevCompact = normalizeVoiceDialogCompact(prev);
    const nextCompact = normalizeVoiceDialogCompact(next);
    if (!nextNorm) return prev;
    if (!prevNorm) return next.trimStart();
    if (nextCompact && prevCompact && nextCompact === prevCompact) {
        return pickReadableVoiceVariant(prev, next);
    }
    if (nextNorm === prevNorm) return next.length > prev.length ? next : prev;
    if (nextCompact && prevCompact && nextCompact.startsWith(prevCompact)) return next;
    if (nextCompact && prevCompact && prevCompact.startsWith(nextCompact)) return prev;
    if (nextNorm.startsWith(prevNorm)) return next;
    if (prevNorm.startsWith(nextNorm)) return prev;

    const prevLower = prev.toLowerCase();
    const nextLower = next.toLowerCase();
    if (nextLower.startsWith(prevLower)) return next;
    if (prevLower.startsWith(nextLower)) return prev;

    const maxOverlap = Math.min(prevLower.length, nextLower.length);
    for (let overlap = maxOverlap; overlap >= 3; overlap -= 1) {
        if (prevLower.slice(-overlap) === nextLower.slice(0, overlap)) {
            return prev + next.slice(overlap);
        }
    }

    return prev + next;
}

function pushGeminiVoiceDialogLine(role, text) {
    const safeRole = role === 'assistant' ? 'assistant' : 'user';
    const normalizedText = normalizeVoiceDialogText(text);
    if (!normalizedText) return;

    const lastLine = geminiVoiceDialogLines[geminiVoiceDialogLines.length - 1];
    if (lastLine && lastLine.role === safeRole) {
        const previousText = normalizeVoiceDialogText(lastLine.text || '');
        const previousCompact = normalizeVoiceDialogCompact(previousText);
        const currentCompact = normalizeVoiceDialogCompact(normalizedText);

        if (previousCompact && currentCompact) {
            if (
                previousCompact === currentCompact ||
                previousCompact.includes(currentCompact) ||
                currentCompact.includes(previousCompact)
            ) {
                lastLine.text = pickReadableVoiceVariant(previousText, normalizedText);
                return;
            }
        }

        const merged = normalizeVoiceDialogText(mergeVoiceStreamingText(previousText, normalizedText));
        if (merged && merged !== previousText && hasCompactBoundaryOverlap(previousText, normalizedText)) {
            lastLine.text = merged;
            return;
        }

        // Different phrases from the same role should remain separate bubbles.
        geminiVoiceDialogLines.push({
            role: safeRole,
            text: normalizedText
        });
        return;
    }

    geminiVoiceDialogLines.push({
        role: safeRole,
        text: normalizedText
    });
}

function flushGeminiVoiceDraftLine(role) {
    if (role === 'assistant') {
        if (!geminiVoiceAssistantDraft.trim()) return;
        pushGeminiVoiceDialogLine('assistant', geminiVoiceAssistantDraft);
        geminiVoiceAssistantDraft = '';
        return;
    }
    if (!geminiVoiceUserDraft.trim()) return;
    pushGeminiVoiceDialogLine('user', geminiVoiceUserDraft);
    geminiVoiceUserDraft = '';
}

function resetGeminiVoiceDialogBuffer() {
    clearGeminiFirstReplyHintTimer();
    geminiVoiceDialogLines = [];
    geminiVoiceUserDraft = '';
    geminiVoiceAssistantDraft = '';
    geminiVoiceUserPreview = '';
    geminiVoiceAssistantPreview = '';
    geminiVoiceHasAssistantReply = false;
    openAiPendingUserTurn = '';
    openAiResponsePending = false;
    openAiResponseQueued = false;
    openAiHasUnansweredUserTurn = false;
    openAiLastUserTurnCompact = '';
    openAiLastUserTurnAt = 0;
    openAiUserTranscriptByItemId = new Map();
}

function appendGeminiVoiceDialogToChat() {
    flushGeminiVoiceDraftLine('user');
    flushGeminiVoiceDraftLine('assistant');

    if (!Array.isArray(geminiVoiceDialogLines) || !geminiVoiceDialogLines.length) {
        return 0;
    }

    const startDiv = document.getElementById('startConversation');
    if (startDiv) startDiv.style.display = 'none';

    let appendedCount = 0;
    for (const line of geminiVoiceDialogLines) {
        const text = normalizeVoiceDialogText(line.text);
        const role = line.role;
        if (!text) continue;

        const lastHistoryItem = conversationHistory[conversationHistory.length - 1];
        if (
            lastHistoryItem &&
            lastHistoryItem.role === role &&
            normalizeVoiceDialogCompact(lastHistoryItem.content || '') === normalizeVoiceDialogCompact(text)
        ) {
            continue;
        }

        addMessage(text, role, false);
        appendConversationHistoryEntry({ role, content: text });
        appendedCount += 1;
    }

    if (appendedCount > 0) {
        updatePromptLock();
        updateSendBtnState();
    }

    return appendedCount;
}

function buildGeminiVoiceSystemInstruction(baseInstructions = '') {
    const cleanInstructions = normalizeVoiceDialogText(baseInstructions);
    const defaultInstruction = 'Ты вежливый клиент, веди естественный разговор голосом на русском языке.';
    const effectiveInstructions = cleanInstructions || defaultInstruction;
    return `${effectiveInstructions}\n\n${VOICE_FAST_PACE_INSTRUCTIONS}`;
}

function buildGeminiVoiceSessionConfig(sdk) {
    const activeVoiceClientPrompt = String(getActiveContent('manager_call') || '').trim();
    const activeClientPrompt = String(getActiveContent('client') || '').trim();
    const effectivePrompt = activeVoiceClientPrompt || activeClientPrompt || 'Ты вежливый клиент, веди естественный разговор голосом на русском языке.';
    const resolvedVoiceName = getConfiguredGeminiVoiceName();
    return {
        model: GEMINI_LIVE_MODEL,
        voice: resolvedVoiceName,
        instructions: effectivePrompt,
        systemInstruction: buildGeminiVoiceSystemInstruction(effectivePrompt),
        connectConfig: {
            responseModalities: [sdk.Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: {
                        voiceName: resolvedVoiceName
                    }
                }
            },
            mediaResolution: sdk.MediaResolution?.MEDIA_RESOLUTION_LOW || GEMINI_LIVE_MEDIA_RESOLUTION,
            thinkingConfig: {
                thinkingBudget: GEMINI_LIVE_THINKING_BUDGET
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: buildGeminiVoiceSystemInstruction(effectivePrompt)
        }
    };
}

function buildVoiceFirstTurnInstructions(sessionInstructions) {
    const base = normalizeVoiceDialogText(sessionInstructions);
    const opener = 'Начни разговор первым: коротко поздоровайся и задай один уточняющий вопрос менеджеру. Говори максимально быстрым темпом, но разборчиво.';
    if (!base) return opener;
    return `${base}\n\n${opener}`;
}

function sendOpenAiRealtimeEvent(payload) {
    if (!openAiVoiceDataChannel || openAiVoiceDataChannel.readyState !== 'open') return false;
    try {
        openAiVoiceDataChannel.send(JSON.stringify(payload));
        return true;
    } catch (error) {
        debugLog('Failed to send OpenAI realtime event', error);
        return false;
    }
}

async function waitForOpenAiDataChannelReady(timeoutMs = 8000) {
    if (openAiVoiceDataChannel?.readyState === 'open') return true;
    return new Promise((resolve) => {
        let settled = false;
        const channel = openAiVoiceDataChannel;
        if (!channel) {
            resolve(false);
            return;
        }
        const finish = (value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            channel.removeEventListener('open', handleOpen);
            channel.removeEventListener('close', handleClose);
            channel.removeEventListener('error', handleError);
            resolve(value);
        };
        const handleOpen = () => finish(true);
        const handleClose = () => finish(false);
        const handleError = () => finish(false);
        const timeoutId = setTimeout(() => finish(false), timeoutMs);
        channel.addEventListener('open', handleOpen, { once: true });
        channel.addEventListener('close', handleClose, { once: true });
        channel.addEventListener('error', handleError, { once: true });
    });
}

function handleGeminiVoiceTransportFailure(message = 'Соединение голосового канала прервано. Попробуйте начать звонок заново.') {
    if (geminiVoiceCloseExpected || (!isGeminiVoiceActive && !isGeminiVoiceConnecting)) {
        return false;
    }
    geminiVoiceCloseExpected = true;
    const preserveDialogForRating = hasBufferedVoiceDialog();
    stopGeminiVoiceMode({
        silent: true,
        expectedClose: true,
        preserveDialogForRating
    }).catch(() => {}).finally(() => {
        geminiVoiceCloseExpected = false;
        if (preserveDialogForRating && hasBufferedVoiceDialog()) {
            geminiVoiceConversationFinished = true;
            updateVoiceModeRateButtonState();
            setVoiceModeStatus('Соединение прервано, но диалог сохранён. Можно оценить звонок.', 'ready');
            return;
        }
        setVoiceModeStatus(message, 'error');
    });
    return true;
}

function requestOpenAiAssistantResponse(instructions = '') {
    const payload = {
        modalities: ['audio', 'text']
    };

    const cleanInstructions = normalizeVoiceDialogText(instructions);
    payload.instructions = cleanInstructions
        ? `${cleanInstructions}\n\n${OPENAI_FAST_PACE_INSTRUCTIONS}`
        : OPENAI_FAST_PACE_INSTRUCTIONS;

    if (openAiResponsePending) {
        openAiResponseQueued = true;
        return true;
    }

    const sent = sendOpenAiRealtimeEvent({
        type: 'response.create',
        response: payload
    });

    if (sent) {
        openAiResponsePending = true;
        openAiResponseQueued = false;
        openAiHasUnansweredUserTurn = false;
        geminiVoiceAssistantPreview = '';
        geminiVoiceAssistantDraft = '';
        setVoiceModeStatus('ИИ-клиент готовит ответ…', 'waiting');
    }
    return sent;
}

function appendVoiceUserTranscriptLine(text, options = {}) {
    const { markUnanswered = true } = options;
    const normalized = normalizeVoiceDialogText(text);
    if (!normalized) return false;

    const currentCompact = normalizeVoiceDialogCompact(normalized);
    const now = Date.now();
    if (
        currentCompact &&
        openAiLastUserTurnCompact &&
        currentCompact === openAiLastUserTurnCompact &&
        now - openAiLastUserTurnAt < 12000
    ) {
        return false;
    }

    openAiLastUserTurnCompact = currentCompact;
    openAiLastUserTurnAt = now;

    geminiVoiceUserDraft = normalized;
    flushGeminiVoiceDraftLine('user');
    if (markUnanswered) {
        openAiHasUnansweredUserTurn = true;
    }
    return true;
}

function flushOpenAiPendingUserTurn(options = {}) {
    const { requestResponse = true } = options;
    const userText = normalizeVoiceDialogText(openAiPendingUserTurn);
    openAiPendingUserTurn = '';

    if (!userText) return false;
    const appended = appendVoiceUserTranscriptLine(userText, { markUnanswered: true });
    if (!appended) return false;

    if (!requestResponse) return true;
    return requestOpenAiAssistantResponse();
}

function queueOpenAiPendingUserTurn(text) {
    const normalized = normalizeVoiceDialogText(text);
    if (!normalized) return '';
    openAiPendingUserTurn = normalizeVoiceDialogText(
        mergeVoiceStreamingText(openAiPendingUserTurn, normalized)
    );
    return openAiPendingUserTurn;
}

function extractOpenAiConversationItemTranscript(item) {
    if (!item || typeof item !== 'object') return '';
    const directTranscript = normalizeVoiceDialogText(item.transcript || item.text || '');
    if (directTranscript) return directTranscript;

    const chunks = [];
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
        if (typeof part === 'string') {
            const value = normalizeVoiceDialogText(part);
            if (value) chunks.push(value);
            continue;
        }
        if (!part || typeof part !== 'object') continue;
        const value = normalizeVoiceDialogText(part.transcript || part.text || part.input_text || '');
        if (value) chunks.push(value);
    }
    return normalizeVoiceDialogText(chunks.join(' '));
}

function consumeOpenAiUserTranscript(rawText, itemId = '') {
    const text = normalizeVoiceDialogText(rawText);
    if (!text) return false;

    const safeItemId = String(itemId || '').trim();
    if (safeItemId) {
        const known = normalizeVoiceDialogText(openAiUserTranscriptByItemId.get(safeItemId) || '');
        if (known && normalizeVoiceDialogCompact(known) === normalizeVoiceDialogCompact(text)) {
            return false;
        }
        openAiUserTranscriptByItemId.set(safeItemId, text);
    }

    queueOpenAiPendingUserTurn(text);
    geminiVoiceUserPreview = '';
    const appended = flushOpenAiPendingUserTurn({ requestResponse: false });
    if (!appended) return false;

    if (openAiResponsePending) {
        openAiResponseQueued = true;
    } else if (openAiHasUnansweredUserTurn) {
        const requested = requestOpenAiAssistantResponse();
        if (!requested) {
            setVoiceModeStatus('Не удалось запросить ответ ИИ-клиента.', 'error');
        }
    }
    return true;
}

async function handleGeminiLiveMessage(message) {
    if (!message || typeof message !== 'object') return;

    if (message.setupComplete) {
        geminiVoiceSetupComplete = true;
        if (!geminiVoiceHasAssistantReply) {
            setVoiceModeStatus('Соединение установлено. ИИ-клиент начинает разговор…', 'waiting');
        }
    }

    const serverContent = message?.serverContent;
    if (!serverContent || typeof serverContent !== 'object') return;

    const inputText = normalizeVoiceDialogText(serverContent?.inputTranscription?.text || '');
    const inputFinished = !!serverContent?.inputTranscription?.finished;
    if (inputText) {
        geminiVoiceUserPreview = mergeVoiceStreamingText(geminiVoiceUserPreview, inputText);
        setVoiceModeStatus(getShortStatusText('Вы:', geminiVoiceUserPreview), 'listening');
        if (inputFinished) {
            const completedUserText = sanitizeUserCompletedTranscript(geminiVoiceUserPreview || inputText);
            geminiVoiceUserPreview = '';
            if (completedUserText) {
                geminiVoiceUserDraft = normalizeVoiceDialogText(
                    mergeVoiceStreamingText(geminiVoiceUserDraft, completedUserText)
                );
                flushGeminiVoiceDraftLine('user');
                geminiVoiceConversationFinished = false;
            }
        }
    }

    const outputText = normalizeVoiceDialogText(serverContent?.outputTranscription?.text || '');
    const outputFinished = !!serverContent?.outputTranscription?.finished;
    if (outputText) {
        if (!geminiVoiceHasAssistantReply) {
            geminiVoiceHasAssistantReply = true;
            clearGeminiFirstReplyHintTimer();
        }
        geminiVoiceAssistantPreview = mergeVoiceStreamingText(geminiVoiceAssistantPreview, outputText);
        setVoiceModeStatus(getShortStatusText('ИИ-клиент:', geminiVoiceAssistantPreview), 'ready');
        if (outputFinished) {
            const completedAssistantText = sanitizeAssistantCompletedTranscript(geminiVoiceAssistantPreview || outputText);
            geminiVoiceAssistantPreview = '';
            if (completedAssistantText) {
                geminiVoiceAssistantDraft = normalizeVoiceDialogText(
                    mergeVoiceStreamingText(geminiVoiceAssistantDraft, completedAssistantText)
                );
            }
        }
    }

    const parts = Array.isArray(serverContent?.modelTurn?.parts) ? serverContent.modelTurn.parts : [];
    for (const part of parts) {
        const inlineData = part?.inlineData;
        const mimeType = String(inlineData?.mimeType || inlineData?.mime_type || '').trim();
        const audioBase64 = String(inlineData?.data || '').trim();
        if (audioBase64 && /^audio\//i.test(mimeType)) {
            await enqueueGeminiAudioPlayback(audioBase64, mimeType).catch((error) => {
                console.warn('Failed to play Gemini Live audio chunk:', error);
            });
            continue;
        }
        const partText = normalizeVoiceDialogText(part?.text || '');
        if (partText && !outputText) {
            if (!geminiVoiceHasAssistantReply) {
                geminiVoiceHasAssistantReply = true;
                clearGeminiFirstReplyHintTimer();
            }
            geminiVoiceAssistantPreview = mergeVoiceStreamingText(geminiVoiceAssistantPreview, partText);
            setVoiceModeStatus(getShortStatusText('ИИ-клиент:', geminiVoiceAssistantPreview), 'ready');
        }
    }

    if (serverContent?.interrupted) {
        resetGeminiPlaybackCursor();
    }

    if (serverContent?.turnComplete || serverContent?.generationComplete) {
        if (!geminiVoiceAssistantDraft.trim() && geminiVoiceAssistantPreview.trim()) {
            geminiVoiceAssistantDraft = normalizeVoiceDialogText(
                mergeVoiceStreamingText(geminiVoiceAssistantDraft, geminiVoiceAssistantPreview)
            );
        }
        geminiVoiceAssistantPreview = '';
        if (geminiVoiceAssistantDraft.trim()) {
            flushGeminiVoiceDraftLine('assistant');
        }
        if (isGeminiVoiceActive) {
            setVoiceModeStatus('Слушаю вас… Говорите.', 'listening');
        }
        return;
    }

    if (serverContent?.waitingForInput && isGeminiVoiceActive) {
        setVoiceModeStatus('Слушаю вас… Говорите.', 'listening');
    }
}

async function initGeminiVoiceCapture() {
    if (!geminiLiveSession || typeof geminiLiveSession.sendRealtimeInput !== 'function') {
        throw new Error('Gemini Live session is not ready');
    }
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.getUserMedia) {
        throw new Error('Браузер не поддерживает доступ к микрофону');
    }

    geminiVoiceInputStream = await mediaDevices.getUserMedia({
        audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        }
    });

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (typeof AudioCtx !== 'function') {
        throw new Error('Браузер не поддерживает Web Audio API');
    }

    geminiVoiceAudioContext = geminiVoiceAudioContext || new AudioCtx();
    if (geminiVoiceAudioContext.state === 'suspended') {
        await geminiVoiceAudioContext.resume();
    }

    geminiVoiceSourceNode = geminiVoiceAudioContext.createMediaStreamSource(geminiVoiceInputStream);
    geminiVoiceProcessorNode = geminiVoiceAudioContext.createScriptProcessor(4096, 1, 1);
    geminiVoiceSilenceGain = geminiVoiceAudioContext.createGain();
    geminiVoiceSilenceGain.gain.value = 0;

    geminiVoiceProcessorNode.onaudioprocess = (event) => {
        if (!isGeminiVoiceActive || !geminiLiveSession || typeof geminiLiveSession.sendRealtimeInput !== 'function') {
            return;
        }
        try {
            const inputChannel = event.inputBuffer?.getChannelData?.(0);
            if (!inputChannel?.length) return;
            const downsampled = downsampleAudioBuffer(inputChannel, event.inputBuffer.sampleRate, 16000);
            if (!downsampled.length) return;
            const pcm = float32ToInt16Pcm(downsampled);
            const pcmBytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
            geminiLiveSession.sendRealtimeInput({
                audio: {
                    data: uint8ToBase64(pcmBytes),
                    mimeType: 'audio/pcm;rate=16000'
                }
            });
        } catch (error) {
            console.warn('Failed to stream Gemini microphone chunk:', error);
        }
    };

    geminiVoiceSourceNode.connect(geminiVoiceProcessorNode);
    geminiVoiceProcessorNode.connect(geminiVoiceSilenceGain);
    geminiVoiceSilenceGain.connect(geminiVoiceAudioContext.destination);
}

function teardownGeminiVoiceCapture() {
    if (geminiVoiceProcessorNode) {
        try {
            geminiVoiceProcessorNode.onaudioprocess = null;
            geminiVoiceProcessorNode.disconnect();
        } catch (e) {}
        geminiVoiceProcessorNode = null;
    }

    if (geminiVoiceSourceNode) {
        try { geminiVoiceSourceNode.disconnect(); } catch (e) {}
        geminiVoiceSourceNode = null;
    }

    if (geminiVoiceSilenceGain) {
        try { geminiVoiceSilenceGain.disconnect(); } catch (e) {}
        geminiVoiceSilenceGain = null;
    }

    if (geminiVoiceInputStream) {
        geminiVoiceInputStream.getTracks().forEach((track) => {
            try { track.stop(); } catch (e) {}
        });
        geminiVoiceInputStream = null;
    }

    if (openAiVoiceRemoteAudio) {
        try {
            openAiVoiceRemoteAudio.pause();
            openAiVoiceRemoteAudio.srcObject = null;
        } catch (e) {}
        openAiVoiceRemoteAudio = null;
    }

    if (geminiLiveSession && typeof geminiLiveSession.close === 'function') {
        try { geminiLiveSession.close(); } catch (e) {}
    }
    geminiLiveSession = null;
    geminiLiveApiClient = null;
    geminiVoiceSetupComplete = false;
    geminiVoiceFirstTurnRequested = false;
    resetGeminiPlaybackCursor();
}

async function stopGeminiVoiceMode(options = {}) {
    const {
        silent = false,
        expectedClose = true,
        preserveDialogForRating = false
    } = options;
    cancelGeminiVoiceStartAttempt();
    geminiVoiceCloseExpected = !!expectedClose;
    const shouldPreserveDialog = !!preserveDialogForRating && hasBufferedVoiceDialog();
    const shouldRenderDialog = !silent && !shouldPreserveDialog;

    if (!isGeminiVoiceActive && !isGeminiVoiceConnecting && !geminiLiveSession) {
        if (!shouldPreserveDialog) {
            resetGeminiVoiceDialogBuffer();
            geminiVoiceConversationFinished = false;
        }
        return;
    }

    isGeminiVoiceConnecting = false;
    isGeminiVoiceActive = false;
    updateVoiceModeControls();

    teardownGeminiVoiceCapture();
    updateVoiceModeControls();

    if (shouldRenderDialog) {
        appendGeminiVoiceDialogToChat();
    }

    if (shouldPreserveDialog) {
        flushGeminiVoiceDraftLine('user');
        flushGeminiVoiceDraftLine('assistant');
        geminiVoiceConversationFinished = hasBufferedVoiceDialog();
        updateVoiceModeRateButtonState();
        if (!silent) {
            setVoiceModeStatus(
                geminiVoiceConversationFinished
                    ? 'Диалог остановлен. Можно оценить звонок.'
                    : 'Диалог остановлен. Реплики не найдены.',
                geminiVoiceConversationFinished ? 'ready' : 'error'
            );
        }
        return;
    }

    resetGeminiVoiceDialogBuffer();
    geminiVoiceConversationFinished = false;

    if (!silent) {
        setVoiceModeStatus('Голосовой режим остановлен.', 'idle');
    }
}

async function startGeminiVoiceMode() {
    if (isGeminiVoiceConnecting || isGeminiVoiceActive) return;
    if (isProcessing || isDialogRated) {
        setVoiceModeStatus('Сначала завершите текущую операцию в чате.', 'error');
        return;
    }

    geminiVoiceCloseExpected = false;
    geminiVoiceStartTimestamp = Date.now();
    resetGeminiVoiceDialogBuffer();
    geminiVoiceConversationFinished = false;
    geminiVoiceSetupComplete = false;
    geminiVoiceFirstTurnRequested = false;
    isGeminiVoiceConnecting = true;
    updateVoiceModeControls();
    setVoiceModeStatus('Подключаюсь к Gemini Live…', 'idle');
    const startAttempt = beginGeminiVoiceStartAttempt();

    try {
        const sdk = await loadGeminiSdkModule();
        throwIfGeminiVoiceStartAttemptStale(startAttempt.id);
        const sessionConfig = buildGeminiVoiceSessionConfig(sdk);
        const clientSecret = await resolveGeminiLiveApiKey(sessionConfig, {
            signal: startAttempt.signal
        });
        throwIfGeminiVoiceStartAttemptStale(startAttempt.id);

        geminiLiveApiClient = new sdk.GoogleGenAI({
            apiKey: clientSecret,
            httpOptions: {
                apiVersion: 'v1alpha'
            }
        });
        geminiLiveSession = await geminiLiveApiClient.live.connect({
            model: sessionConfig.model,
            config: sessionConfig.connectConfig,
            callbacks: {
                onopen: () => {
                    if (startAttempt.id !== geminiVoiceStartAttemptId) return;
                    setVoiceModeStatus('Соединение с Gemini Live открыто…', 'waiting');
                },
                onmessage: (message) => {
                    handleGeminiLiveMessage(message).catch((error) => {
                        console.error('Gemini Live message handling error:', error);
                    });
                },
                onerror: (event) => {
                    console.error('Gemini Live error:', event);
                    handleGeminiVoiceTransportFailure('Ошибка Gemini Live. Попробуйте запустить звонок заново.');
                },
                onclose: (event) => {
                    const closeReason = getGeminiCloseReasonText(event);
                    handleGeminiVoiceTransportFailure(
                        closeReason
                            ? `Соединение Gemini Live закрыто${closeReason}.`
                            : 'Соединение Gemini Live закрыто.'
                    );
                }
            }
        });
        throwIfGeminiVoiceStartAttemptStale(startAttempt.id);
        await initGeminiVoiceCapture();
        throwIfGeminiVoiceStartAttemptStale(startAttempt.id);

        isGeminiVoiceConnecting = false;
        isGeminiVoiceActive = true;
        updateVoiceModeControls();
        setVoiceModeStatus('Запрашиваю первое сообщение от ИИ-клиента…', 'waiting');
        scheduleGeminiFirstReplyHint();
        geminiVoiceFirstTurnRequested = true;
        geminiLiveSession.sendRealtimeInput({
            text: buildVoiceFirstTurnInstructions(sessionConfig.instructions)
        });
    } catch (error) {
        console.error('Failed to start voice mode:', error);
        isGeminiVoiceConnecting = false;
        isGeminiVoiceActive = false;
        await stopGeminiVoiceMode({ silent: true, expectedClose: true });
        geminiVoiceCloseExpected = false;
        if (!isGeminiVoiceStartCancelledError(error)) {
            setVoiceModeStatus(
                `Не удалось запустить голосовой режим: ${error?.message || 'неизвестная ошибка'}`,
                'error'
            );
        }
    } finally {
        finishGeminiVoiceStartAttempt(startAttempt.id);
        updateVoiceModeControls();
    }
}

function setVoiceModeRateButtonVisible(show) {
    if (!voiceModeRateBtn) return;
    const isVisible = !!show;
    voiceModeRateBtn.hidden = !isVisible;
    voiceModeRateBtn.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
}

function hasBufferedVoiceDialog() {
    return Array.isArray(geminiVoiceDialogLines) && geminiVoiceDialogLines.some((line) => {
        const normalized = normalizeVoiceDialogText(line?.text || '');
        return !!normalized;
    });
}

function buildVoiceDialogTextFromBufferedLines() {
    if (!hasBufferedVoiceDialog()) return '';
    let dialogText = '';
    geminiVoiceDialogLines.forEach((line) => {
        const role = line?.role === 'user' ? 'Менеджер' : 'Клиент';
        const text = normalizeVoiceDialogText(line?.text || '');
        if (!text) return;
        dialogText += `${role}: ${text}\n\n`;
    });
    return dialogText.trim();
}

function updateVoiceModeRateButtonState() {
    const isVoiceScreenActive = !!voiceModeScreen && !voiceModeScreen.hidden;
    const canShowRate = isVoiceScreenActive &&
        geminiVoiceConversationFinished &&
        hasBufferedVoiceDialog() &&
        !isProcessing &&
        !isDialogRated;
    setVoiceModeRateButtonVisible(canShowRate);
    if (!isVoiceScreenActive) return;
    if (isProcessing) {
        setVoiceModeStatus('Оцениваю диалог…', 'waiting');
        return;
    }
    if (canShowRate) {
        setVoiceModeStatus('Звонок завершён. Нажмите «Оценить диалог».', 'ready');
        return;
    }
    if (isGeminiVoiceConnecting) {
        setVoiceModeStatus('Подключаюсь к Gemini Live…', 'waiting');
        return;
    }
    if (isGeminiVoiceActive) {
        setVoiceModeStatus('Идёт диалог…', 'listening');
        return;
    }
    setVoiceModeStatus('Голосовой режим готов к запуску.', 'idle');
}

function resetVoiceModeSessionState() {
    geminiVoiceConversationFinished = false;
    geminiVoiceSetupComplete = false;
    geminiVoiceFirstTurnRequested = false;
    resetGeminiVoiceDialogBuffer();
    setVoiceModeRateButtonVisible(false);
    setVoiceModeStatus('Открываю голосовой режим…', 'idle');
}

function parseElevenLabsSocketProtocols(protocols) {
    if (Array.isArray(protocols)) {
        return protocols.map(value => String(value || '').toLowerCase()).filter(Boolean);
    }
    if (typeof protocols === 'string') {
        return [protocols.toLowerCase()];
    }
    return [];
}

function shouldTrackElevenLabsSocket(url, protocols) {
    const socketUrl = String(url || '').toLowerCase();
    const protocolList = parseElevenLabsSocketProtocols(protocols);
    if (protocolList.some(value => value.includes('convai'))) return true;
    if (!socketUrl) return false;
    if (socketUrl.includes('/v1/convai/conversation')) return true;
    return socketUrl.includes('elevenlabs') && socketUrl.includes('convai');
}

function processElevenLabsRealtimeMessage(message) {
    if (!message || typeof message !== 'object') return;
    const eventType = String(message.type || '').trim();
    if (!eventType) return;

    if (eventType === 'conversation_initiation_metadata') {
        elevenLabsConversationFinished = false;
        resetGeminiVoiceDialogBuffer();
        setVoiceModeStatus('Соединение установлено. Идёт диалог…', 'listening');
        updateVoiceModeRateButtonState();
        return;
    }

    if (eventType === 'user_transcript') {
        const userTextRaw = String(message?.user_transcription_event?.user_transcript || '');
        const userText = sanitizeUserCompletedTranscript(userTextRaw);
        if (userText) {
            elevenLabsConversationFinished = false;
            pushGeminiVoiceDialogLine('user', userText);
        }
        setVoiceModeStatus('Идёт диалог…', 'listening');
        updateVoiceModeRateButtonState();
        return;
    }

    if (eventType === 'agent_response' || eventType === 'agent_response_correction') {
        const assistantTextRaw = String(
            message?.agent_response_event?.agent_response ||
            message?.agent_response_correction_event?.agent_response ||
            ''
        );
        let assistantText = sanitizeAssistantCompletedTranscript(assistantTextRaw);
        if (!assistantText) {
            assistantText = normalizeVoiceDialogText(assistantTextRaw);
        }
        if (assistantText) {
            elevenLabsConversationFinished = false;
            pushGeminiVoiceDialogLine('assistant', assistantText);
        }
        setVoiceModeStatus('Идёт диалог…', 'listening');
        updateVoiceModeRateButtonState();
    }
}

function registerElevenLabsConversationSocket(socket) {
    if (!socket || typeof socket.addEventListener !== 'function') return;
    if (elevenLabsSocketOpenState.has(socket)) return;
    elevenLabsSocketOpenState.set(socket, false);

    socket.addEventListener('open', () => {
        const wasOpen = !!elevenLabsSocketOpenState.get(socket);
        if (!wasOpen) {
            elevenLabsActiveSocketCount += 1;
        }
        elevenLabsSocketOpenState.set(socket, true);
        elevenLabsConversationFinished = false;
        setVoiceModeRateButtonVisible(false);
        setVoiceModeStatus('Звонок начат. Говорите с ИИ-клиентом…', 'listening');
    });

    socket.addEventListener('message', (event) => {
        if (typeof event?.data !== 'string') return;
        try {
            const parsed = JSON.parse(event.data);
            processElevenLabsRealtimeMessage(parsed);
        } catch (error) {
            // Ignore non-JSON chunks.
        }
    });

    socket.addEventListener('close', () => {
        const wasOpen = !!elevenLabsSocketOpenState.get(socket);
        if (wasOpen) {
            elevenLabsActiveSocketCount = Math.max(0, elevenLabsActiveSocketCount - 1);
        }
        elevenLabsSocketOpenState.set(socket, false);
        if (elevenLabsActiveSocketCount === 0) {
            elevenLabsConversationFinished = hasBufferedVoiceDialog();
            if (elevenLabsConversationFinished) {
                setVoiceModeStatus('Звонок завершён. Можно оценить диалог.', 'ready');
            } else {
                setVoiceModeStatus('Звонок завершён, но реплики не найдены.', 'error');
            }
            updateVoiceModeRateButtonState();
        }
    });
}

function ensureElevenLabsSocketBridge() {
    if (elevenLabsSocketBridgeInstalled) return;
    if (typeof window === 'undefined' || typeof window.WebSocket !== 'function') return;

    const NativeWebSocket = window.WebSocket;

    const PatchedWebSocket = function patchedElevenLabsWebSocket(url, protocols) {
        const socket = protocols === undefined
            ? new NativeWebSocket(url)
            : new NativeWebSocket(url, protocols);
        if (shouldTrackElevenLabsSocket(url, protocols)) {
            registerElevenLabsConversationSocket(socket);
        }
        return socket;
    };

    PatchedWebSocket.prototype = NativeWebSocket.prototype;
    Object.defineProperty(PatchedWebSocket, 'name', { value: 'WebSocket' });
    Object.getOwnPropertyNames(NativeWebSocket).forEach((key) => {
        if (key in PatchedWebSocket) return;
        try {
            const descriptor = Object.getOwnPropertyDescriptor(NativeWebSocket, key);
            if (descriptor) {
                Object.defineProperty(PatchedWebSocket, key, descriptor);
            }
        } catch (error) {}
    });

    window.WebSocket = PatchedWebSocket;
    elevenLabsSocketBridgeInstalled = true;
}

async function handleVoiceModeRateClick() {
    if (isProcessing) return;

    const dialogText = buildVoiceDialogTextFromBufferedLines();
    if (!dialogText) {
        setVoiceModeStatus('Нет текста диалога для оценки. Повторите звонок.', 'error');
        showCopyNotification('Диалог не найден. Завершите звонок и попробуйте снова.');
        return;
    }

    setVoiceModeStatus('Оцениваю диалог…', 'waiting');
    appendGeminiVoiceDialogToChat();
    resetGeminiVoiceDialogBuffer();
    geminiVoiceConversationFinished = false;
    setVoiceModeRateButtonVisible(false);
    hideVoiceModeModal();

    await rateChat({
        force: true,
        dialogTextOverride: dialogText
    });
}

async function handleVoiceModeStopClick() {
    if (!isGeminiVoiceConnecting && !isGeminiVoiceActive) return;
    await stopGeminiVoiceMode({
        silent: false,
        expectedClose: true,
        preserveDialogForRating: true
    });
}

function dispatchElevenLabsExpandEvent(action = 'expand') {
    const payload = { detail: { action }, bubbles: true };
    if (elevenlabsConvaiWidget) {
        elevenlabsConvaiWidget.dispatchEvent(
            new CustomEvent('elevenlabs-agent:expand', payload)
        );
    }
    document.dispatchEvent(
        new CustomEvent('elevenlabs-agent:expand', payload)
    );
}

function setElevenLabsWidgetHidden(hidden) {
    if (!elevenlabsConvaiWidget) return;
    const hiddenFlag = hidden ? 'true' : 'false';
    elevenlabsConvaiWidget.setAttribute('data-voice-hidden', hiddenFlag);
    elevenlabsConvaiWidget.style.setProperty('position', 'fixed', 'important');
    elevenlabsConvaiWidget.style.setProperty('inset', '0', 'important');
    elevenlabsConvaiWidget.style.setProperty('width', '100vw', 'important');
    elevenlabsConvaiWidget.style.setProperty('height', '100dvh', 'important');
    elevenlabsConvaiWidget.style.setProperty('display', 'block', 'important');
    elevenlabsConvaiWidget.style.setProperty('z-index', hidden ? '999999' : '1000001', 'important');
    if (hidden) {
        elevenlabsConvaiWidget.setAttribute('aria-hidden', 'true');
    } else {
        elevenlabsConvaiWidget.removeAttribute('aria-hidden');
    }
}

function setVoiceModeScreenActive(active) {
    document.body?.classList.toggle('voice-mode-active', !!active);
    if (voiceModeScreen) {
        if (active) {
            voiceModeScreen.hidden = false;
            voiceModeScreen.setAttribute('aria-hidden', 'false');
        } else {
            voiceModeScreen.hidden = true;
            voiceModeScreen.setAttribute('aria-hidden', 'true');
        }
    }
    if (voiceModeActions) {
        voiceModeActions.hidden = !active;
        voiceModeActions.setAttribute('aria-hidden', active ? 'false' : 'true');
    }
    if (!active) {
        setVoiceModeRateButtonVisible(false);
    } else {
        updateVoiceModeRateButtonState();
    }
}

async function showVoiceModeModal() {
    hideTooltip(true);
    const openRequestId = ++voiceModeOpenRequestId;
    activeVoiceModeProvider = 'gemini';
    try {
        resetVoiceModeSessionState();
        setVoiceModeStatus('Открываю голосовой режим…', 'idle');
        setVoiceModeScreenActive(true);
        await startGeminiVoiceMode();
        if (openRequestId !== voiceModeOpenRequestId || !voiceModeScreen || voiceModeScreen.hidden) {
            await stopGeminiVoiceMode({ silent: true, expectedClose: true });
            return;
        }
        if (!isGeminiVoiceActive && !isGeminiVoiceConnecting) {
            setVoiceModeStatus('Не удалось запустить Gemini Live. Проверьте настройки и попробуйте позже.', 'error');
        }
    } catch (error) {
        console.error('Failed to open voice mode:', error);
        if (openRequestId !== voiceModeOpenRequestId) return;
        setVoiceModeStatus('Не удалось открыть голосовой режим. Попробуйте позже.', 'error');
    }
}

function hideVoiceModeModal() {
    voiceModeOpenRequestId += 1;
    const shouldStopRealtimeVoice = isGeminiVoiceConnecting ||
        isGeminiVoiceActive ||
        !!geminiLiveSession;
    if (shouldStopRealtimeVoice) {
        stopGeminiVoiceMode({ silent: true, expectedClose: true }).catch(() => {});
    }
    setVoiceModeScreenActive(false);
    geminiVoiceConversationFinished = false;
    activeVoiceModeProvider = 'gemini';
}

function buildPromptCompareDiffHtml(publicContent = '', draftContent = '') {
    const safePublicContent = String(publicContent || '');
    const safeDraftContent = String(draftContent || '');
    const diffApi = globalThis.Diff;
    if (!diffApi?.diffWordsWithSpace) {
        const fallbackHtml = escapeHtml(safeDraftContent).replace(/\n/g, '<br>');
        return `<div class="prompt-compare-richdiff">${fallbackHtml}</div>`;
    }

    const parts = diffApi.diffWordsWithSpace(safePublicContent, safeDraftContent);
    const html = parts.map((part) => {
        const safeValue = escapeHtml(part.value || '').replace(/\n/g, '<br>');
        if (!safeValue) return '';
        if (part.added) {
            return `<span class="diff-added-inline">${safeValue}</span>`;
        }
        if (part.removed) {
            return `<span class="diff-removed-inline">${safeValue}</span>`;
        }
        return safeValue;
    }).join('');

    return `<div class="prompt-compare-richdiff">${html || '<span class="changes-empty">Без различий.</span>'}</div>`;
}

function renderPromptCompareModalContent(role = getActiveRole()) {
    if (!promptCompareTitle || !promptCompareSummary || !promptCompareDiffView) return;
    const context = getPromptCompareContext(role);
    activePromptCompareContext = context;
    if (!context) {
        if (promptCompareModal?.classList.contains('active')) {
            hidePromptCompareModal();
        }
        return;
    }

    const { publicVariation, draftVariation } = context;
    const rollbackEntry = getPromptRollbackEntry(role, publicVariation);
    promptCompareTitle.textContent = `Сравнение: ${getRoleLabel(role)} · ${getPromptVariationDisplayName(publicVariation) || 'Без названия'}`;
    promptCompareSummary.innerHTML = `
        <strong>Public:</strong> ${escapeHtml(getPromptVariationDisplayName(publicVariation) || 'Без названия')}
        <br>
        <strong>Draft:</strong> ${escapeHtml(getPromptVariationDisplayName(draftVariation) || 'Без названия')}
    `;
    promptCompareDiffView.innerHTML = buildPromptCompareDiffHtml(publicVariation.content || '', draftVariation.content || '');
}

function showPromptHistoryModal() {
    hideTooltip(true);
    if (!promptHistoryModal) return;
    renderPromptHistory();
    hidePromptHistoryItemModal();
    promptHistoryModal.classList.add('active');
}

function hidePromptHistoryModal() {
    if (!promptHistoryModal) return;
    promptHistoryModal.classList.remove('active');
}

function showPromptCompareModal() {
    hideTooltip(true);
    if (!promptCompareModal) return;
    syncCurrentEditorNow();
    if (!getPromptCompareContext()) {
        showCopyNotification('У этого промпта пока нет draft для сравнения.');
        return;
    }
    renderPromptCompareModalContent();
    promptCompareModal.classList.add('active');
}

function hidePromptCompareModal() {
    if (!promptCompareModal) return;
    promptCompareModal.classList.remove('active');
    activePromptCompareContext = null;
}

function publishComparedDraft() {
    hideTooltip(true);
    const context = getPromptCompareContext();
    if (!context) {
        showCopyNotification('Draft для публикации не найден.');
        hidePromptCompareModal();
        return;
    }

    syncCurrentEditorNow();
    promptsData[context.role].activeId = context.draftVariation.id;
    if (!publishActiveLocalPrompt(context.role)) {
        showCopyNotification('Не удалось опубликовать draft.');
        return;
    }

    renderVariations();
    updateEditorContent(context.role);
    hidePromptCompareModal();
    showCopyNotification('Draft опубликован в public.');
}

function rollbackPublicPrompt(role = getActiveRole()) {
    hideTooltip(true);
    const historyVariation = getPromptHistoryVariation(role);
    const rollbackEntry = getPromptRollbackEntry(role, historyVariation);
    if (!historyVariation || !rollbackEntry) {
        showCopyNotification('Нет предыдущей public-версии для отката.');
        return false;
    }

    syncCurrentEditorNow();
    restorePromptVersion(rollbackEntry.id, role, historyVariation.id, {
        keepCurrentSelection: !!getActiveVariation(role)?.isLocal
    });
    showCopyNotification('Public-версия откатена к прошлой ревизии.');
    return true;
}

// ============ SETTINGS MODAL FUNCTIONS ============

function showSettingsModal() {
    hideTooltip(true);
    const savedName = currentUser?.fio || getCachedStorageValue(USER_NAME_KEY) || '';
    const userRole = syncSelectedRole(selectedRole || getCachedStorageValue(USER_ROLE_KEY, currentUser?.role || 'user'));
    const loginValue = currentUser?.login || getCachedStorageValue(USER_LOGIN_KEY) || '-';

    settingsNameInput.value = savedName;
    if (accountLoginValue) {
        accountLoginValue.textContent = loginValue || '-';
    }
    autoResizeNameInput();
    ensureRoleChangeButtonVisible(userRole);
    
    // Hide password section
    roleChangePassword.style.display = 'none';
    roleChangePasswordInput.value = '';
    roleChangeError.style.display = 'none';
    populateVoiceConfigFields();
    populateHiddenClientPromptField();
    populateHiddenRaterPromptField();
    settingsModal.classList.add('active');
    [adminHiddenClientPromptAccordion, adminHiddenRaterPromptAccordion, adminUsersAccessAccordion]
        .forEach((accordion) => {
            accordion?.removeAttribute('open');
        });

    if (userRole === 'admin') {
        if (adminPanelAccordion) {
            adminPanelAccordion.style.display = '';
            adminPanelAccordion.setAttribute('open', '');
        }
        startAdminRealtimeSync();
        renderAdminUsersTable();
    } else if (adminPanelAccordion) {
        adminPanelAccordion.style.display = 'none';
        adminPanelAccordion.removeAttribute('open');
        stopAdminRealtimeSync();
    }
}

const nameInputMeasureCanvas = document.createElement('canvas');
const nameInputMeasureCtx = nameInputMeasureCanvas.getContext('2d');

function autoResizeNameInput() {
    if (!settingsNameInput) return;
    settingsNameInput.style.width = '100%';
}

function hideSettingsModal() {
    stopAdminRealtimeSync();
    settingsModal.classList.remove('active');
}

function isSettingsModalOpen() {
    return !!settingsModal?.classList?.contains('active');
}

function toggleSettingsModal() {
    if (isSettingsModalOpen()) {
        hideSettingsModal();
        return;
    }
    showSettingsModal();
}

function updateUserNameDisplay() {
    const name = currentUser?.fio || getCachedStorageValue(USER_NAME_KEY) || 'Гость';
    const role = canUseAdminPreviewControls()
        ? normalizeRole(selectedRole || getCachedStorageValue(USER_ROLE_KEY, 'user') || 'user')
        : 'user';
    const roleIcon = getRoleIcon(role);
    currentUserName.textContent = `${roleIcon} ${name}`;
}

const FUNNY_LOADING_MESSAGES = [
    "Листаю учебник по продажам...",
    "Читаю обучающие материалы...",
    "Изучаю лучшие скрипты...",
    "Анализирую успешные сделки...",
    "Вспоминаю тренинги...",
    "Смотрю вебинар по возражениям...",
    "Ищу идеальную формулировку...",
    "Проверяю чек-лист качества...",
    "Учусь на ошибках новичков...",
    "Думаю, как закрыть сделку...",
    "Перечитываю «Книгу продаж»...",
    "Вникаю в боли клиента...",
    "Формирую уникальное предложение...",
    "Подбираю аргументы...",
    "Отрабатываю возражения...",
    "Затачиваю скрипт..."
];

async function improvePromptWithAI() {
    const improvementRequest = aiImproveInput.value.trim();
    if (!improvementRequest) {
        aiImproveInput.focus();
        aiImproveInput.style.borderColor = '#ff5555';
        setTimeout(() => { aiImproveInput.style.borderColor = ''; }, 1000);
        return;
    }

    let role = getActiveRole();
    if (aiImproveMode === 'rating' && pendingRatingImproveContext?.role) {
        role = pendingRatingImproveContext.role;
    }

    const currentPrompt = getActiveContent(role);
    const activeVar = promptsData[role].variations.find(v => v.id === promptsData[role].activeId);
    const currentName = activeVar ? activeVar.name : 'Промпт';
    
    if (!currentPrompt) {
        alert('Сначала добавьте текст в инструкцию');
        return;
    }
    const requestState = beginAiImproveRequest();
    const contextSnapshot = {
        mode: aiImproveMode,
        role,
        activeVariationId: activeVar?.id || null,
        prompt: String(currentPrompt || ''),
        ratingContextJson: JSON.stringify(pendingRatingImproveContext || null)
    };

    let userMessage = `Изначальный промпт:\n\n${currentPrompt}\n\n---\n\nЗапрос на улучшение: ${improvementRequest}\n\n---\n\nВАЖНО: Верни ПОЛНЫЙ текст улучшенного промпта. Подсвети изменения так:\n1. Удаленный/измененный текст оберни в ~~ (например: ~~старый текст~~)\n2. Новый/добавленный текст оберни в ++ (например: ++новый текст++)\n3. Остальной текст оставь без изменений.\nНе используй markdown код-блоки.`;

    if (aiImproveMode === 'rating' && pendingRatingImproveContext) {
        const { dialogText = '', ratingText = '' } = pendingRatingImproveContext;
        const roleLabel = role === 'client'
            ? 'клиента'
            : role === 'manager'
                ? 'менеджера'
                : role === 'manager_call'
                    ? 'клиента звонка'
                    : 'оценщика';
        userMessage = `Текущая инструкция ИИ-${roleLabel}:\n\n${currentPrompt}\n\n---\n\nДиалог менеджера с клиентом:\n\n${dialogText}\n\n---\n\nОценка диалога:\n\n${ratingText}\n\n---\n\nЗапрос на улучшение от пользователя:\n${improvementRequest}\n\n---\n\nНа основе этого диалога и его оценки улучши инструкцию ${roleLabel}. Учти ошибки, которые были допущены, и добавь рекомендации, чтобы избежать их в будущем.\n\nВАЖНО: Верни ПОЛНЫЙ текст улучшенного промпта. Подсвети изменения так:\n1. Удаленный/измененный текст оберни в ~~ (например: ~~старый текст~~)\n2. Новый/добавленный текст оберни в ++ (например: ++новый текст++)\n3. Остальной текст оставь без изменений.\nНе используй markdown код-блоки.`;
    }
    
    // Show loading state
    const submitBtn = aiImproveSubmit;
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    
    submitBtn.disabled = true;
    // btnText.style.display = 'none'; // Keep text visible for funny messages
    btnLoader.style.display = 'inline-flex';
    
    // Start funny messages cycle
    let msgIndex = 0;
    const originalText = btnText.textContent;
    if (!btnText.dataset.defaultText) {
        btnText.dataset.defaultText = originalText;
    }
    btnText.textContent = FUNNY_LOADING_MESSAGES[Math.floor(Math.random() * FUNNY_LOADING_MESSAGES.length)];
    
    const messageInterval = setInterval(() => {
        msgIndex = (msgIndex + 1) % FUNNY_LOADING_MESSAGES.length;
        // Pick random message to avoid repetition order
        const randomMsg = FUNNY_LOADING_MESSAGES[Math.floor(Math.random() * FUNNY_LOADING_MESSAGES.length)];
        btnText.textContent = randomMsg;
    }, 2500);
    
    let debugEntryId = null;
    let response = null;
    try {
        const requestId = buildRequestId('improve');
        debugEntryId = startWebhookDebugRequest({
            type: 'improve',
            endpoint: AI_IMPROVE_WEBHOOK_URL,
            requestId,
            timeoutMs: AI_HELPER_WEBHOOK_TIMEOUT_MS
        });
        const improveResponse = await requestAiImproveResponseText(
            requestId,
            userMessage,
            AI_HELPER_WEBHOOK_TIMEOUT_MS,
            { signal: requestState.signal }
        );
        response = improveResponse.response;
        const responseText = improveResponse.responseText;
        throwIfAiImproveRequestStale(requestState.version, contextSnapshot);

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            // If response is not JSON, assume it's the raw text of the prompt
            debugLog('Response is not JSON, treating as raw text');
            data = { output: responseText };
        }

        const rawResponse = extractApiResponse(data);
        throwIfAiImproveRequestStale(requestState.version, contextSnapshot);
        
        if (!rawResponse) throw new Error('Не удалось получить текст из ответа');
        finishWebhookDebugRequest(debugEntryId, {
            httpStatus: response.status,
            resultMessage: `Ответ ${rawResponse.trim().length} симв.`
        });
        
        // Clean the text for saving (remove ~~deleted~~ and unwrap ++added++)
        const cleanPrompt = rawResponse
            .replace(/~~[^~]+~~/g, '') // Remove deleted text
            .replace(/\+\+([^+]+)\+\+/g, '$1') // Unwrap added text
            .replace(/\n{3,}/g, '\n\n') // Fix excess newlines
            .trim();

        // Store pending data
        throwIfAiImproveRequestStale(requestState.version, contextSnapshot);
        pendingImprovedPrompt = cleanPrompt;
        pendingRole = role;
        pendingName = currentName;
        pendingVariationId = activeVar ? activeVar.id : null;
        
        // Render diff (using the raw response with markers)
        showSemanticDiff(rawResponse);
        
    } catch (error) {
        failWebhookDebugRequest(debugEntryId, error, response?.status);
        if (isAiImproveCancelledError(error)) {
            return;
        }
        console.error('AI improve error:', error);
        alert('Ошибка улучшения: ' + error.message);
    } finally {
        const shouldRestoreUi = requestState.version === aiImproveRequestVersion
            && !requestState.signal?.aborted;
        finishAiImproveRequest(requestState.version);
        clearInterval(messageInterval);
        if (shouldRestoreUi) {
            resetAiImproveSubmitUi();
        }
    }
}

function showSemanticDiff(textWithMarkers) {
    // Replace markers with HTML tags BEFORE renderMarkdown.
    // If the content is multiline or looks like a block element (header, list), use <div> wrapper with newlines
    // so marked.js can parse block elements inside.
    // Otherwise use <span> for inline highlighting.
    
    let processedText = textWithMarkers
        .replace(/~~([\s\S]+?)~~/g, (m, c) => {
            // Check for newlines or block markdown indicators
            if (c.includes('\n') || /^\s*#/m.test(c) || /^\s*[-*]\s/m.test(c) || /^\s*\d+\.\s/m.test(c)) {
                return `\n\n<div class="diff-removed">\n\n${c}\n\n</div>\n\n`;
            }
            return `<span class="diff-removed">${c}</span>`;
        })
        .replace(/\+\+([\s\S]+?)\+\+/g, (m, c) => {
            if (c.includes('\n') || /^\s*#/m.test(c) || /^\s*[-*]\s/m.test(c) || /^\s*\d+\.\s/m.test(c)) {
                return `\n\n<div class="diff-added">\n\n${c}\n\n</div>\n\n`;
            }
            return `<span class="diff-added">${c}</span>`;
        });
        
    let html = renderMarkdown(processedText);
    
    aiDiffView.innerHTML = html;
    
    // Switch view
    aiImproveStep1.style.display = 'none';
    aiImproveStep2.style.display = 'block';
}

function activateInstructionEditor(role) {
    instructionTabs.forEach(tab => {
        if (tab.dataset.instruction === role) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    instructionEditors.forEach(editor => {
        if (editor.dataset.instruction === role) {
            editor.classList.add('active');
        } else {
            editor.classList.remove('active');
        }
    });

    if (instructionSelectEl) {
        instructionSelectEl.value = role;
    }
    if (selectedInstructionText) {
        selectedInstructionText.innerText = getRoleLabel(role);
    }
    instructionOptions.forEach(opt => {
        opt.classList.toggle('active', opt.dataset.value === role);
    });
}

function applyImprovedPrompt(targetMode = 'new') {
    if (!pendingImprovedPrompt || !pendingRole) return;

    // Сохраняем правки текущего открытого редактора до переключений.
    syncCurrentEditorNow();

    const roleData = promptsData[pendingRole];
    if (!roleData || !Array.isArray(roleData.variations)) return;

    const sourceVariation = roleData.variations.find(v => v.id === pendingVariationId)
        || roleData.variations.find(v => v.id === roleData.activeId)
        || null;

    let targetVariation = null;
    let createdNew = false;
    if (targetMode === 'current' && sourceVariation) {
        if (!sourceVariation.isLocal) {
            ensurePromptHistoryBaseline(pendingRole, sourceVariation);
        }
        sourceVariation.content = pendingImprovedPrompt;
        targetVariation = sourceVariation;
    } else {
        const baseName = (pendingName || 'Промпт').trim() || 'Промпт';
        const newName = getUniqueVariationName(pendingRole, `${baseName} AI`);
        targetVariation = {
            id: generateId(),
            name: newName,
            content: pendingImprovedPrompt,
            isLocal: !!sourceVariation?.isLocal
        };
        roleData.variations.push(targetVariation);
        createdNew = true;
    }

    const canSwitchToTarget = !(pendingRole === 'client' && isClientVariationLocked(targetVariation.id));
    if (canSwitchToTarget) {
        activateInstructionEditor(pendingRole);
        roleData.activeId = targetVariation.id;
        renderVariations();
        updateEditorContent(pendingRole);
    } else {
        renderVariations();
    }

    if (targetVariation.isLocal) {
        saveLocalPromptsData();
    } else {
        checkpointPromptHistory(pendingRole, targetVariation.id);
        savePromptsToFirebaseNow({ roles: [pendingRole] });
    }

    hideAiImproveModal();
    aiImproveInput.value = '';
    let notificationText =
        createdNew
            ? 'Улучшенная инструкция сохранена как новый промпт'
            : 'Текущий промпт обновлен';
    if (!canSwitchToTarget) {
        notificationText += '. Переключение на новый вариант сейчас недоступно';
    }
    showCopyNotification(notificationText);
}

bindEvent(aiImproveBtn, 'click', showAiImproveModal);
bindEvent(promptHistoryBtn, 'click', showPromptHistoryModal);
bindEvent(promptCompareBtn, 'click', showPromptCompareModal);
bindEvent(promptVisibilityBtn, 'click', toggleActivePromptVisibility);
bindEvent(aiImproveModalClose, 'click', hideAiImproveModal);
bindEvent(aiImproveCancel, 'click', hideAiImproveModal);
bindEvent(aiImproveSubmit, 'click', improvePromptWithAI);
bindEvent(promptHistoryModalClose, 'click', hidePromptHistoryModal);
bindEvent(promptCompareModalClose, 'click', hidePromptCompareModal);
bindEvent(promptCompareCancel, 'click', hidePromptCompareModal);
bindEvent(promptComparePublish, 'click', publishComparedDraft);
bindEvent(promptHistoryItemModalClose, 'click', hidePromptHistoryItemModal);
bindEvent(promptHistoryItemCloseBtn, 'click', hidePromptHistoryItemModal);

bindEvent(aiImproveBack, 'click', () => {
    if (aiImproveStep1) aiImproveStep1.style.display = 'block';
    if (aiImproveStep2) aiImproveStep2.style.display = 'none';
});

bindEvent(aiImproveApplyNew, 'click', () => applyImprovedPrompt('new'));
bindEvent(aiImproveApplyCurrent, 'click', () => applyImprovedPrompt('current'));

bindEvent(aiImproveInput, 'keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        improvePromptWithAI();
    }
});

// ============ SETTINGS MODAL EVENT LISTENERS ============

bindEvent(settingsBtn, 'click', (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    toggleSettingsModal();
});

// Close settings modal on overlay click
bindEvent(settingsModal, 'click', (e) => {
    if (e.target === settingsModal) {
        hideSettingsModal();
    }
});

// Автосохранение имени при вводе
bindEvent(settingsNameInput, 'input', () => {
    autoResizeNameInput();
    const newName = normalizeFio(settingsNameInput.value);
    if (!newName || !currentUser) return;
    managerNameInput.value = newName;
    currentUser.fio = newName;
    setCachedStorageValue(USER_NAME_KEY, newName);
    updateUserNameDisplay();

    if (fioSaveTimeout) clearTimeout(fioSaveTimeout);
    fioSaveTimeout = setTimeout(() => {
        patchUserRecord(currentUser.login, {
            fio: newName,
            lastSeenAt: new Date().toISOString()
        });
    }, 450);
});

bindEvent(saveVoiceConfigBtn, 'click', () => {
    saveVoiceModeConfigFromInputs().catch((error) => {
        console.error('Failed to save voice config:', error);
        showCopyNotification(getVoiceConfigErrorMessage(error));
    });
});

bindEvent(clearVoiceConfigBtn, 'click', () => {
    clearVoiceModeConfig().catch((error) => {
        console.error('Failed to clear voice config:', error);
        showCopyNotification('Ошибка очистки настроек OpenAI Voice');
    });
});

bindEvent(adminHiddenClientPromptSaveBtn, 'click', () => {
    saveHiddenClientPromptFromInput().catch((error) => {
        console.error('Failed to save hidden client prompt:', error);
        showCopyNotification('Ошибка сохранения скрытого prompt клиента');
    });
});

bindEvent(adminHiddenClientPromptResetBtn, 'click', () => {
    resetHiddenClientPromptToDefault().catch((error) => {
        console.error('Failed to reset hidden client prompt:', error);
        showCopyNotification('Ошибка сброса скрытого prompt клиента');
    });
});

bindEvent(adminHiddenClientPromptInput, 'keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.key !== 'Enter') return;
    e.preventDefault();
    saveHiddenClientPromptFromInput().catch((error) => {
        console.error('Failed to save hidden client prompt:', error);
        showCopyNotification('Ошибка сохранения скрытого prompt клиента');
    });
});

bindEvent(adminHiddenRaterPromptSaveBtn, 'click', () => {
    saveHiddenRaterPromptFromInput().catch((error) => {
        console.error('Failed to save hidden rater prompt:', error);
        showCopyNotification('Ошибка сохранения скрытого prompt оценщика');
    });
});

bindEvent(adminHiddenRaterPromptResetBtn, 'click', () => {
    resetHiddenRaterPromptToDefault().catch((error) => {
        console.error('Failed to reset hidden rater prompt:', error);
        showCopyNotification('Ошибка сброса скрытого prompt оценщика');
    });
});

bindEvent(adminHiddenRaterPromptInput, 'keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.key !== 'Enter') return;
    e.preventDefault();
    saveHiddenRaterPromptFromInput().catch((error) => {
        console.error('Failed to save hidden rater prompt:', error);
        showCopyNotification('Ошибка сохранения скрытого prompt оценщика');
    });
});

bindEvent(adminWebhookDebugClearBtn, 'click', () => {
    clearWebhookDebugEntries();
    showCopyNotification('Лог webhook очищен');
});

[geminiApiKeyInput, geminiTokenEndpointInput, geminiVoiceNameInput].forEach((input) => {
    bindEvent(input, 'keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        saveVoiceModeConfigFromInputs().catch((error) => {
            console.error('Failed to save voice config:', error);
            showCopyNotification(getVoiceConfigErrorMessage(error));
        });
    });
});

// Theme toggle
bindEvent(themeToggle, 'change', () => {
    const isLight = themeToggle.checked;
    document.body.classList.toggle('light-theme', isLight);
    setCachedStorageValue(THEME_STORAGE_KEY, isLight ? 'light' : 'dark');
});

// Accent color picker
function setAccentColor(color) {
    // Вычисляем hover цвет (темнее на 15%)
    const hoverColor = adjustBrightness(color, -15);
    document.documentElement.style.setProperty('--color-accent', color);
    document.documentElement.style.setProperty('--color-accent-hover', hoverColor);
}

function adjustBrightness(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, Math.min(255, (num >> 16) + amt));
    const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
    const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

// Color presets
const colorPresets = document.querySelectorAll('.color-preset');

function updateColorPresetActive(color) {
    let isPreset = false;
    colorPresets.forEach(preset => {
        if (preset.dataset.color.toLowerCase() === color.toLowerCase()) {
            preset.classList.add('active');
            isPreset = true;
        } else {
            preset.classList.remove('active');
        }
    });

}

colorPresets.forEach(preset => {
    preset.addEventListener('click', () => {
        const color = preset.dataset.color;
        setAccentColor(color);
        setCachedStorageValue(ACCENT_COLOR_STORAGE_KEY, color);
        updateColorPresetActive(color);
    });
});

// More colors button and popup
const moreColorsBtn = document.getElementById('moreColorsBtn');
const moreColorsPopup = document.getElementById('moreColorsPopup');
const colorOptions = document.querySelectorAll('.color-option');

if (moreColorsBtn && moreColorsPopup) {
    moreColorsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        moreColorsPopup.classList.toggle('active');
    });

    // Close popup on click outside
    document.addEventListener('click', (e) => {
        if (!moreColorsPopup.contains(e.target) && e.target !== moreColorsBtn) {
            moreColorsPopup.classList.remove('active');
        }
    });

    // Color option selection
    colorOptions.forEach(option => {
        option.addEventListener('click', () => {
            const color = option.dataset.color;
            setAccentColor(color);
            setCachedStorageValue(ACCENT_COLOR_STORAGE_KEY, color);
            updateColorPresetActive(color);
            moreColorsPopup.classList.remove('active');
        });
    });
}

// Load saved accent color
const savedAccentColor = getCachedStorageValue(ACCENT_COLOR_STORAGE_KEY, '#7F96FF');
setAccentColor(savedAccentColor);
updateColorPresetActive(savedAccentColor);

// Load saved theme
const savedTheme = getCachedStorageValue(THEME_STORAGE_KEY);
if (savedTheme === 'light') {
    themeToggle.checked = true;
    document.body.classList.add('light-theme');
}

// Change role button
changeRoleBtn.addEventListener('click', () => {
    toggleAdminPreviewMode();
});

bindEvent(adminPreviewToggleBtn, 'click', toggleAdminPreviewMode);

function switchRole(newRole) {
    if (!canUseAdminPreviewControls()) {
        throw new Error('Режим администратора доступен только админ-аккаунтам или localhost-preview.');
    }
    const role = normalizeRole(newRole) === 'admin' ? 'admin' : 'user';
    if (role === 'admin') {
        ensureLocalhostDevPreviewSession();
    }
    const effectiveRole = syncSelectedRole(role);
    applyRoleRestrictions();
    updateUserNameDisplay();
    showCopyNotification(`Включен ${getRoleLabelUi(effectiveRole).toLowerCase()} режим`);
}

function toggleAdminPreviewMode() {
    if (!canUseAdminPreviewControls()) return;
    const currentRole = normalizeRole(selectedRole || getCachedStorageValue(USER_ROLE_KEY, 'admin') || currentUser?.role || 'admin');
    switchRole(currentRole === 'admin' ? 'user' : 'admin');
}

// Cancel role change
roleChangeCancelBtn.addEventListener('click', () => {
    roleChangePassword.style.display = 'none';
    roleChangePasswordInput.value = '';
    roleChangeError.style.display = 'none';
});

roleChangeConfirmBtn.addEventListener('click', async () => {
    if (!canUseAdminPreviewControls()) {
        roleChangePassword.style.display = 'none';
        return;
    }

    try {
        switchRole('admin');
        roleChangePassword.style.display = 'none';
        roleChangePasswordInput.value = '';
        roleChangeError.style.display = 'none';
    } catch (error) {
        roleChangeError.style.display = 'block';
        roleChangeError.textContent = 'Не удалось включить режим администратора.';
        setTimeout(() => {
            roleChangeError.style.display = 'none';
        }, 2000);
    }
});

if (adminRefreshBtn) {
    adminRefreshBtn.addEventListener('click', () => {
        renderAdminUsersTable();
    });
}

if (partnerInviteAddBtn) {
    partnerInviteAddBtn.addEventListener('click', () => {
        handleCreatePartnerInvite();
    });
}

if (partnerInviteEmailInput) {
    partnerInviteEmailInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleCreatePartnerInvite();
        }
    });
}

// Export buttons in settings
exportChatSettings.addEventListener('click', (e) => {
    e.stopPropagation();
    exportChatSettingsMenu?.classList.toggle('show');
    exportPromptSettingsMenu?.classList.remove('show');
});

exportPromptSettings.addEventListener('click', (e) => {
    e.stopPropagation();
    exportPromptSettingsMenu?.classList.toggle('show');
    exportChatSettingsMenu?.classList.remove('show');
});

// Handle settings export menu items
document.querySelectorAll('.dropdown-item[data-settings-chat-format]').forEach(item => {
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        const format = e.target.dataset.settingsChatFormat;
        if (format) {
            exportChat(format);
            exportChatSettingsMenu?.classList.remove('show');
        }
    });
});

document.querySelectorAll('.dropdown-item[data-settings-prompt-format]').forEach(item => {
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        const format = e.target.dataset.settingsPromptFormat;
        if (format) {
            if (format === 'prompt-backup-json') {
                exportPromptEmergencyBackup();
            } else {
                exportCurrentPrompt(format);
            }
            exportPromptSettingsMenu?.classList.remove('show');
        }
    });
});

document.querySelectorAll('.dropdown-item[data-settings-prompt-action]').forEach(item => {
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = e.target.dataset.settingsPromptAction;
        if (action === 'restore-prompt-backup') {
            restorePromptsFromEmergencyBackup();
            exportPromptSettingsMenu?.classList.remove('show');
        }
    });
});

// Close modal on overlay click
aiImproveModal.addEventListener('click', (e) => {
    if (e.target === aiImproveModal) {
        hideAiImproveModal();
    }
});
if (promptHistoryModal) {
    promptHistoryModal.addEventListener('click', (e) => {
        if (e.target === promptHistoryModal) {
            hidePromptHistoryModal();
        }
    });
}
if (promptCompareModal) {
    promptCompareModal.addEventListener('click', (e) => {
        if (e.target === promptCompareModal) {
            hidePromptCompareModal();
        }
    });
}
if (promptHistoryItemModal) {
    promptHistoryItemModal.addEventListener('click', (e) => {
        if (e.target === promptHistoryItemModal) {
            hidePromptHistoryItemModal();
        }
    });
}

// ============ CHAT FUNCTIONS ============

function autoResizeTextarea(textarea) {
    if (!textarea.value.trim()) {
        textarea.style.height = '44px';
        return;
    }
    textarea.style.height = '44px';
    const newHeight = Math.max(44, Math.min(textarea.scrollHeight, 300));
    textarea.style.height = newHeight + 'px';
}

function addMessage(content, role, isMarkdown = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (role === 'loading') {
        contentDiv.innerHTML = `<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
    } else if (isMarkdown) {
        contentDiv.innerHTML = renderMarkdown(content);
    } else {
        contentDiv.textContent = content;
    }
    
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageDiv;
}

function appendRatingTextSection(container, title, text, options = {}) {
    const normalizedText = String(text || '').trim();
    if (!normalizedText) return;

    const { fullWidth = false } = options;
    const section = document.createElement('section');
    section.className = `rating-section${fullWidth ? ' is-full' : ''}`;

    const titleEl = document.createElement('h4');
    titleEl.className = 'rating-section-title';
    titleEl.textContent = title;

    const bodyEl = document.createElement('div');
    bodyEl.className = 'rating-section-body';
    bodyEl.textContent = normalizedText;

    section.appendChild(titleEl);
    section.appendChild(bodyEl);
    container.appendChild(section);
}

function appendRatingListSection(container, title, items, options = {}) {
    const normalizedItems = Array.isArray(items)
        ? items.map(item => String(item || '').trim()).filter(Boolean)
        : [];
    if (!normalizedItems.length) return;

    const { fullWidth = false } = options;
    const section = document.createElement('section');
    section.className = `rating-section${fullWidth ? ' is-full' : ''}`;

    const titleEl = document.createElement('h4');
    titleEl.className = 'rating-section-title';
    titleEl.textContent = title;

    const listEl = document.createElement('ul');
    listEl.className = 'rating-section-list';
    normalizedItems.forEach((item) => {
        const listItem = document.createElement('li');
        listItem.textContent = item;
        listEl.appendChild(listItem);
    });

    section.appendChild(titleEl);
    section.appendChild(listEl);
    container.appendChild(section);
}

function addRatingMessage(ratingResult) {
    if (!ratingResult?.structured) {
        return addMessage(ratingResult?.displayText || '', 'rating', true);
    }

    const structured = ratingResult.structured;
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message rating structured-rating';
    if (structured.outcome) {
        messageDiv.dataset.ratingOutcome = structured.outcome;
    }

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    const card = document.createElement('div');
    card.className = 'rating-card';

    const header = document.createElement('div');
    header.className = 'rating-card-header';

    const headingCopy = document.createElement('div');
    headingCopy.className = 'rating-card-heading';

    const eyebrow = document.createElement('div');
    eyebrow.className = 'rating-card-eyebrow';
    eyebrow.textContent = 'Оценка диалога';
    headingCopy.appendChild(eyebrow);

    if (structured.summary) {
        const summary = document.createElement('div');
        summary.className = 'rating-card-summary';
        summary.textContent = structured.summary;
        headingCopy.appendChild(summary);
    }

    const headerMeta = document.createElement('div');
    headerMeta.className = 'rating-card-meta';

    const outcomeLabel = getRatingOutcomeLabel(structured.outcome);
    if (outcomeLabel) {
        const outcomeBadge = document.createElement('div');
        outcomeBadge.className = `rating-outcome-badge${structured.outcome ? ` is-${structured.outcome}` : ''}`;
        outcomeBadge.textContent = outcomeLabel;
        headerMeta.appendChild(outcomeBadge);
    }

    const outcomeReason = getRatingOutcomeReasonLabel(structured.outcomeReason);
    if (outcomeReason) {
        const outcomeReasonEl = document.createElement('div');
        outcomeReasonEl.className = 'rating-outcome-reason';
        outcomeReasonEl.textContent = `Причина: ${outcomeReason}`;
        headerMeta.appendChild(outcomeReasonEl);
    }

    header.appendChild(headingCopy);
    if (headerMeta.childElementCount) {
        header.appendChild(headerMeta);
    }
    card.appendChild(header);

    const sections = document.createElement('div');
    sections.className = 'rating-sections';
    appendRatingTextSection(sections, 'Что убило диалог', structured.whatKilledDialogue);
    appendRatingTextSection(sections, 'Что ещё можно было спасти', structured.whatWasSalvageable);
    appendRatingTextSection(sections, 'Почему клиент ушёл', structured.whyClientLeft, { fullWidth: true });
    appendRatingListSection(sections, 'Ошибки менеджера', structured.managerMistakes);
    appendRatingListSection(sections, 'Сильные моменты', structured.managerWins);
    appendRatingTextSection(sections, 'Лучший следующий шаг', structured.nextBestStep, { fullWidth: true });
    appendRatingListSection(sections, 'Действия для CRM', structured.crmActions, { fullWidth: true });

    if (sections.childElementCount) {
        card.appendChild(sections);
    }

    contentDiv.appendChild(card);
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageDiv;
}

function buildConversationHistoryLine(role, content) {
    const speaker = role === 'user' ? 'Менеджер' : 'Клиент';
    return `${speaker}: ${content}`;
}

function appendConversationHistoryEntry(entry) {
    if (!entry || typeof entry !== 'object') return;
    const role = entry.role === 'user' ? 'user' : 'assistant';
    const content = String(entry.content || '');
    conversationHistory.push({ role, content });
    const nextLine = buildConversationHistoryLine(role, content);
    conversationHistoryText = conversationHistoryText ? `${conversationHistoryText}\n\n${nextLine}` : nextLine;
    conversationHistoryRevision += 1;
}

function resetConversationHistory() {
    conversationHistory = [];
    conversationHistoryText = '';
    conversationHistoryRevision += 1;
}

function restoreStartConversationBlock() {
    const startDiv = document.getElementById('startConversation');
    if (!startDiv) return;
    startDiv.style.display = '';
}

function clearChat() {
    invalidateActiveChatUiRequests();
    isProcessing = false;
    resetConversationHistory();
    lastRating = null;
    isDialogRated = false;
    clearConversationTerminalState();
    removeReratePrompt();
    updatePromptLock();
    unlockDialogInput();
    rateChatBtn.classList.remove('rated');
    rateChatBtn.classList.remove('loading');
    aiAssistBtn.classList.remove('loading');
    updateRateChatButtonState();
    
    refreshSessionIds(generateSessionId());
    
    chatMessages.innerHTML = `
        <div id="startConversation" class="start-conversation">
            <button id="startBtn" class="btn-start">Начать диалог</button>
            <button id="startAttestationBtn" class="btn-start btn-start-attestation">Начать аттестацию</button>
        </div>
    `;
    const startBtnEl = document.getElementById('startBtn');
    if (startBtnEl) startBtnEl.addEventListener('click', startConversationHandler);
    const startAttestationBtnEl = document.getElementById('startAttestationBtn');
    if (startAttestationBtnEl) {
        startAttestationBtnEl.style.display = isAttestationMode ? 'none' : '';
        startAttestationBtnEl.addEventListener('click', () => {
            if (!isChatReady) return;
            setAttestationMode(true);
        });
    }
    setStartButtonsEnabled(isChatReady);
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\//g, '&#x2F;');
}

function buildSafeExportPdfWindow({ title, css, body }) {
    const safeTitle = escapeHtml(title || 'Экспорт');
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Браузер блокировал всплывающее окно. Разрешите всплывающие окна и повторите экспорт.');
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${safeTitle}</title>
            ${css || ''}
        </head>
        <body>
            ${body || ''}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => {
        printWindow.print();
    };
}

function normalizeSanitizedAnchorTargets(root) {
    root.querySelectorAll('a').forEach((anchor) => {
        const href = String(anchor.getAttribute('href') || '').trim();
        if (!href) {
            anchor.removeAttribute('href');
        }
        const target = String(anchor.getAttribute('target') || '').trim().toLowerCase();
        if (!target) return;
        if (target === '_blank') {
            anchor.setAttribute('rel', 'noopener noreferrer');
            return;
        }
        anchor.removeAttribute('target');
    });
}

function sanitizeRenderedHtmlLegacy(html) {
    const sourceHtml = String(html || '');
    if (!sourceHtml) return '';

    const template = document.createElement('template');
    template.innerHTML = sourceHtml;

    const allowedTags = new Set([
        'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
        'UL', 'OL', 'LI',
        'B', 'STRONG', 'I', 'EM', 'DEL',
        'PRE', 'CODE',
        'BLOCKQUOTE', 'A', 'SPAN',
        'DIV', 'HR', 'BR'
    ]);

    const allowedAttributesByTag = {
        A: new Set(['href', 'title', 'target', 'rel']),
        DIV: new Set(['class']),
        SPAN: new Set(['class']),
        PRE: new Set(['class']),
        CODE: new Set(['class']),
        LI: new Set(['class']),
        P: new Set(['class'])
    };

    template.content.querySelectorAll('*').forEach((element) => {
        const tagName = element.tagName.toUpperCase();
        if (!allowedTags.has(tagName)) {
            while (element.firstChild) {
                element.parentNode?.insertBefore(element.firstChild, element);
            }
            element.remove();
            return;
        }

        const allowedAttrs = allowedAttributesByTag[tagName] || new Set(['class']);
        Array.from(element.attributes).forEach((attribute) => {
            const attrName = attribute.name.toLowerCase();
            const attrValue = String(attribute.value || '');

            if (!allowedAttrs.has(attrName)) {
                element.removeAttribute(attribute.name);
                return;
            }

            if (attrName.startsWith('on')) {
                element.removeAttribute(attribute.name);
                return;
            }

            if ((attrName === 'href' || attrName === 'src') && /^\s*javascript:/i.test(attrValue)) {
                element.removeAttribute(attribute.name);
                return;
            }

            if (attrName === 'target' && element.tagName.toUpperCase() === 'A') {
                if (attrValue === '_blank') {
                    element.setAttribute('rel', 'noopener noreferrer');
                } else {
                    element.removeAttribute('target');
                }
            }

            if (attrName === 'href' && element.tagName.toUpperCase() === 'A') {
                const safeHref = attrValue.trim();
                if (!safeHref) {
                    element.removeAttribute('href');
                }
            }

            if (!/^(?:href|class|target|rel|title)$/.test(attrName)) {
                element.removeAttribute(attribute.name);
            }
        });

        if (element.tagName.toUpperCase() === 'A' && !element.getAttribute('rel') && element.getAttribute('target') === '_blank') {
            element.setAttribute('rel', 'noopener noreferrer');
        }
    });

    return template.innerHTML;
}

function sanitizeRenderedHtml(html) {
    const sourceHtml = String(html || '');
    if (!sourceHtml) return '';

    if (typeof DOMPurify !== 'undefined' && typeof DOMPurify.sanitize === 'function') {
        const sanitized = DOMPurify.sanitize(sourceHtml, {
            ALLOWED_TAGS: SANITIZED_HTML_TAGS,
            ALLOWED_ATTR: SANITIZED_HTML_ATTRIBUTES,
            ALLOW_DATA_ATTR: false,
            KEEP_CONTENT: true
        });
        const template = document.createElement('template');
        template.innerHTML = sanitized;
        normalizeSanitizedAnchorTargets(template.content);
        return template.innerHTML;
    }

    return sanitizeRenderedHtmlLegacy(sourceHtml);
}

async function sendMessage() {
    if (!isChatReady) return;
    const userMessage = userInput.value.trim();
    if (!userMessage || isProcessing || isDialogRated || isConversationClosed()) return;
    const requestGuard = beginChatUiRequestGuard();

    const baseSystemPrompt = validatePromptBeforeWebhook('client', systemPromptInput.value);
    if (!baseSystemPrompt) {
        finishChatUiRequestGuard(requestGuard);
        return;
    }
    const conversationActionState = getConversationActionStatePayload();
    const systemPrompt = buildClientSystemPromptForWebhook(baseSystemPrompt, conversationActionState);
    
    isProcessing = true;
    toggleInputState(false);
    removeConversationActionNotice();
    
    const startDiv = document.getElementById('startConversation');
    if (startDiv) startDiv.style.display = 'none';
    
    addMessage(userMessage, 'user', false);
    const dialogHistory = conversationHistoryText.trim();
    appendConversationHistoryEntry({ role: 'user', content: userMessage });
    updatePromptLock();
    updateSendBtnState();
    
    userInput.value = '';
    userInput.style.height = '44px';
    
    const loadingMsg = addMessage('', 'loading');
    let debugEntryId = null;
    let response = null;
    
    try {
        const requestId = buildRequestId('chat');
        debugEntryId = startWebhookDebugRequest({
            type: 'chat',
            endpoint: WEBHOOK_URL,
            requestId,
            timeoutMs: CHAT_WEBHOOK_TIMEOUT_MS
        });

        response = await fetchWithTimeout(WEBHOOK_URL, {
            method: 'POST',
            headers: buildJsonRequestHeaders(requestId, 'chat', 'chat'),
            signal: requestGuard.signal,
            body: JSON.stringify(buildUnifiedSimulatorWebhookPayload('chat', {
                userMessage,
                systemPrompt,
                dialogHistory,
                conversationActionState,
                sessionId: clientSessionId,
                requestId
            }))
        }, CHAT_WEBHOOK_TIMEOUT_MS);
        
        if (!response.ok) {
            const httpError = new Error(`HTTP ${response.status}`);
            httpError.httpStatus = response.status;
            throw httpError;
        }
        
        const { message: assistantMessage, conversationAction } = await readWebhookEnvelope(response, CHAT_WEBHOOK_TIMEOUT_MS);
        ensureChatUiRequestGuardCurrent(requestGuard);
        if (!assistantMessage && !conversationAction) {
            failWebhookDebugRequest(debugEntryId, new Error('Пустой ответ webhook'), response.status);
            console.warn('Empty webhook response for user message.');
            loadingMsg.remove();
            addMessage('Ошибка: что-то сломалось. Обратитесь к администратору сайта.', 'error', false);
            return;
        }
        finishWebhookDebugRequest(debugEntryId, {
            httpStatus: response.status,
            resultMessage: conversationAction
                ? `Инструмент: ${conversationAction.type}`
                : `Ответ ${String(assistantMessage || '').trim().length} симв.`
        });
        
        loadingMsg.remove();
        if (assistantMessage) {
            addMessage(assistantMessage, 'assistant', true);
            appendConversationHistoryEntry({ role: 'assistant', content: assistantMessage });
        }
        updatePromptLock();
        updateSendBtnState();
        handleConversationAction(conversationAction);
        
    } catch (error) {
        failWebhookDebugRequest(debugEntryId, error, response?.status);
        if (isChatUiRequestCancelledError(error)) {
            loadingMsg.remove();
            return;
        }
        console.error('Error:', error);
        loadingMsg.remove();
        addMessage(`Ошибка: ${error.message}`, 'error', false);
        if (isConversationSilent() && conversationRecoverableAction) {
            showConversationActionNotice(conversationRecoverableAction);
        }
    } finally {
        const shouldRestoreUi = requestGuard.version === chatUiSessionVersion
            && requestGuard.sessionId === baseSessionId
            && !requestGuard.signal.aborted;
        finishChatUiRequestGuard(requestGuard);
        if (shouldRestoreUi) {
            isProcessing = false;
        }
        if (!lastRating && shouldRestoreUi) {
            if (isConversationClosed()) {
                lockDialogInput();
            } else {
                toggleInputState(true);
                userInput.focus();
            }
        }
    }
}

async function startConversationHandler() {
    if (!isChatReady) return;
    if (isProcessing) return;
    const baseSystemPrompt = validatePromptBeforeWebhook('client', systemPromptInput.value);
    if (!baseSystemPrompt) return;
    clearConversationTerminalState();
    const conversationActionState = getConversationActionStatePayload();
    const systemPrompt = buildClientSystemPromptForWebhook(baseSystemPrompt, conversationActionState);

    invalidateActiveChatUiRequests();
    isProcessing = false;
    refreshSessionIds(generateSessionId());
    resetConversationHistory();
    lastRating = null;
    isDialogRated = false;
    removeReratePrompt();
    rateChatBtn.classList.remove('rated');
    updatePromptLock();
    isProcessing = true;
    toggleInputState(false);
    setStartButtonsEnabled(false);
    const requestGuard = beginChatUiRequestGuard();
    
    const startDiv = document.getElementById('startConversation');
    if (startDiv) startDiv.style.display = 'none';
    
    const loadingMsg = addMessage('', 'loading');
    let debugEntryId = null;
    let response = null;
    
    try {
        const requestId = buildRequestId('chat_start');
        debugEntryId = startWebhookDebugRequest({
            type: 'chat_start',
            endpoint: WEBHOOK_URL,
            requestId,
            timeoutMs: CHAT_WEBHOOK_TIMEOUT_MS
        });
        response = await fetchWithTimeout(WEBHOOK_URL, {
            method: 'POST',
            headers: buildJsonRequestHeaders(requestId, 'chat_start', 'chat_start'),
            signal: requestGuard.signal,
            body: JSON.stringify(buildUnifiedSimulatorWebhookPayload('chat_start', {
                userMessage: '/start',
                systemPrompt,
                dialogHistory: '',
                conversationActionState,
                sessionId: clientSessionId,
                requestId
            }))
        }, CHAT_WEBHOOK_TIMEOUT_MS);
        
        if (!response.ok) {
            const httpError = new Error(`HTTP ${response.status}`);
            httpError.httpStatus = response.status;
            throw httpError;
        }
        
        const { message: assistantMessage, conversationAction } = await readWebhookEnvelope(response, CHAT_WEBHOOK_TIMEOUT_MS);
        ensureChatUiRequestGuardCurrent(requestGuard);
        if (!assistantMessage && !conversationAction) {
            failWebhookDebugRequest(debugEntryId, new Error('Пустой ответ webhook'), response.status);
            console.warn('Empty webhook response for /start.');
            loadingMsg.remove();
            restoreStartConversationBlock();
            addMessage('Ошибка: что-то сломалось. Обратитесь к администратору сайта.', 'error', false);
            return;
        }
        finishWebhookDebugRequest(debugEntryId, {
            httpStatus: response.status,
            resultMessage: conversationAction
                ? `Инструмент: ${conversationAction.type}`
                : `Ответ ${String(assistantMessage || '').trim().length} симв.`
        });
        
        loadingMsg.remove();
        if (assistantMessage) {
            addMessage(assistantMessage, 'assistant', true);
            appendConversationHistoryEntry({ role: 'assistant', content: assistantMessage });
        }
        updatePromptLock();
        updateSendBtnState();
        handleConversationAction(conversationAction);
        if (isConversationClosed()) {
            lockDialogInput();
        }
        
    } catch (error) {
        failWebhookDebugRequest(debugEntryId, error, response?.status);
        if (isChatUiRequestCancelledError(error)) {
            loadingMsg.remove();
            return;
        }
        console.error('Error:', error);
        loadingMsg.remove();
        restoreStartConversationBlock();
        addMessage(`Ошибка: ${error.message}`, 'error', false);
    } finally {
        const shouldRestoreUi = requestGuard.version === chatUiSessionVersion
            && requestGuard.sessionId === baseSessionId
            && !requestGuard.signal.aborted;
        finishChatUiRequestGuard(requestGuard);
        if (shouldRestoreUi) {
            isProcessing = false;
            setStartButtonsEnabled(isChatReady);
            if (!lastRating) {
                if (isConversationClosed()) {
                    lockDialogInput();
                } else {
                    toggleInputState(true);
                    userInput.focus();
                }
            }
        }
    }
}

function removeReratePrompt() {
    if (reratePromptElement) {
        reratePromptElement.remove();
        reratePromptElement = null;
    }
}

function removeConversationActionNotice() {
    if (conversationActionNoticeElement) {
        conversationActionNoticeElement.remove();
        conversationActionNoticeElement = null;
    }
}

function clearConversationTerminalState() {
    conversationTerminalAction = null;
    conversationRecoverableAction = null;
    removeConversationActionNotice();
}

function isConversationClosed() {
    return !!conversationTerminalAction && conversationTerminalAction.type === CONVERSATION_ACTION_TYPE.END;
}

function isConversationSilent() {
    return !!conversationRecoverableAction && conversationRecoverableAction.type === CONVERSATION_ACTION_TYPE.GO_SILENT;
}

function buildConversationActionNoticeText(action) {
    if (action?.type === CONVERSATION_ACTION_TYPE.GO_SILENT) {
        return 'Клиент не ответил, но его ещё можно вернуть';
    }
    return 'Диалог завершен';
}

function getConversationActionStatePayload() {
    const action = conversationTerminalAction || conversationRecoverableAction;
    if (!action) return null;
    return {
        type: action.type,
        reason: typeof action.reason === 'string' ? action.reason : '',
        shouldEvaluate: !!action.shouldEvaluate,
        recoverable: action.type === CONVERSATION_ACTION_TYPE.GO_SILENT
    };
}

function showConversationActionNotice(action) {
    if (!action) return;
    const isTerminal = action.type === CONVERSATION_ACTION_TYPE.END;
    const shouldShowRateButton = isTerminal && action.shouldEvaluate !== false && !lastRating;
    const wrapper = conversationActionNoticeElement || document.createElement('div');
    wrapper.className = `message system-action conversation-action-note ${action.type === CONVERSATION_ACTION_TYPE.GO_SILENT ? 'is-silent' : 'is-terminal'}`;
    wrapper.dataset.actionType = action.type;
    wrapper.innerHTML = `
        <div class="conversation-action-note-box">
            <div class="conversation-action-note-text">${escapeHtml(buildConversationActionNoticeText(action))}</div>
            ${shouldShowRateButton ? '<button class="btn-conversation-rate">Оценить</button>' : ''}
        </div>
    `;
    const rateBtn = wrapper.querySelector('.btn-conversation-rate');
    rateBtn?.addEventListener('click', async () => {
        rateBtn.disabled = true;
        rateBtn.textContent = 'Оцениваю...';
        try {
            await rateChat();
        } finally {
            if (conversationTerminalAction) {
                showConversationActionNotice(conversationTerminalAction);
            }
        }
    });
    if (!wrapper.isConnected) {
        chatMessages.appendChild(wrapper);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    conversationActionNoticeElement = wrapper;
}

function handleConversationAction(action) {
    if (!action) {
        conversationRecoverableAction = null;
        removeConversationActionNotice();
        return false;
    }
    showConversationActionNotice(action);
    if (action.type === CONVERSATION_ACTION_TYPE.GO_SILENT) {
        conversationTerminalAction = null;
        conversationRecoverableAction = action;
        return false;
    }
    if (action.type !== CONVERSATION_ACTION_TYPE.END) {
        return false;
    }
    conversationRecoverableAction = null;
    conversationTerminalAction = action;
    lockDialogInput();
    return false;
}

function showReratePrompt() {
    removeReratePrompt();
    const wrapper = document.createElement('div');
    wrapper.className = 'message system-action rerate-confirm';
    wrapper.innerHTML = `
        <div class="rerate-confirm-box">
            <div class="rerate-confirm-text">Оценка уже получена, оценить заново?</div>
            <button class="btn-rerate-confirm">Оценить</button>
        </div>
    `;
    const confirmBtn = wrapper.querySelector('.btn-rerate-confirm');
    confirmBtn?.addEventListener('click', () => {
        removeReratePrompt();
        rateChat({ force: true });
    });
    chatMessages.appendChild(wrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    reratePromptElement = wrapper;
}

function resetRatingUiForRerun() {
    chatMessages.querySelectorAll('.message.rating, .message.improve-message, .message.rerate-confirm').forEach(el => el.remove());
    lastRating = null;
    isDialogRated = false;
    rateChatBtn.classList.remove('rated');
    if (isConversationClosed()) {
        lockDialogInput();
    } else {
        unlockDialogInput();
    }
    removeReratePrompt();
}

function buildDialogText() {
    return conversationHistoryText.trim();
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function delayWithSignal(ms, signal) {
    if (!signal) {
        return delay(ms);
    }
    if (signal.aborted) {
        return Promise.reject(createChatUiSessionResetError());
    }
    return new Promise((resolve, reject) => {
        const abortHandler = () => {
            clearTimeout(timeoutId);
            signal.removeEventListener('abort', abortHandler);
            reject(createChatUiSessionResetError());
        };
        const timeoutId = setTimeout(() => {
            signal.removeEventListener('abort', abortHandler);
            resolve();
        }, ms);
        signal.addEventListener('abort', abortHandler, { once: true });
    });
}

function buildAttestationRequestId() {
    return buildRequestId('attestation');
}

function normalizeAttestationQueueItem(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const dialog = String(raw.dialog || '').trim();
    const rating = String(raw.rating || '').trim();
    if (!dialog || !rating) return null;
    return {
        id: typeof raw.id === 'string' && raw.id ? raw.id : buildAttestationRequestId(),
        requestId: typeof raw.requestId === 'string' && raw.requestId ? raw.requestId : (typeof raw.id === 'string' && raw.id ? raw.id : buildAttestationRequestId()),
        createdAt: typeof raw.createdAt === 'string' && raw.createdAt ? raw.createdAt : new Date().toISOString(),
        managerName: typeof raw.managerName === 'string' ? raw.managerName : '',
        dialog,
        rating,
        clientPrompt: typeof raw.clientPrompt === 'string' ? raw.clientPrompt : '',
        managerPrompt: typeof raw.managerPrompt === 'string' ? raw.managerPrompt : '',
        raterPrompt: typeof raw.raterPrompt === 'string' ? raw.raterPrompt : '',
        sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : '',
        failures: Number.isFinite(raw.failures) ? Math.max(0, raw.failures) : 0,
        lastError: typeof raw.lastError === 'string' ? raw.lastError : '',
        lastTriedAt: typeof raw.lastTriedAt === 'string' ? raw.lastTriedAt : null
    };
}

function saveAttestationQueue() {
    if (!attestationQueue.length) {
        clearCachedLocalStorageJson(ATTESTATION_QUEUE_STORAGE_KEY, []);
        return;
    }
    setCachedLocalStorageJson(ATTESTATION_QUEUE_STORAGE_KEY, attestationQueue);
}

function loadAttestationQueue() {
    try {
        const raw = getCachedLocalStorageJson(ATTESTATION_QUEUE_STORAGE_KEY);
        const normalized = Array.isArray(raw)
            ? raw.map(normalizeAttestationQueueItem).filter(Boolean)
            : [];
        attestationQueue = normalized;
        if (normalized.length !== (Array.isArray(raw) ? raw.length : 0)) {
            saveAttestationQueue();
        }
    } catch (error) {
        console.error('Failed to load attestation queue:', error);
        attestationQueue = [];
    }
}

function enqueueAttestationJob(payload) {
    const normalized = normalizeAttestationQueueItem(payload);
    if (!normalized) return null;
    attestationQueue.push(normalized);
    saveAttestationQueue();
    return normalized;
}

function scheduleAttestationQueueRetry(delayMs = ATTESTATION_QUEUE_RETRY_DELAY_MS) {
    if (attestationQueueRetryTimer) return;
    attestationQueueRetryTimer = setTimeout(() => {
        attestationQueueRetryTimer = null;
        flushAttestationQueue();
    }, Math.max(0, delayMs));
}

function clearAttestationQueueRetryTimer() {
    if (!attestationQueueRetryTimer) return;
    clearTimeout(attestationQueueRetryTimer);
    attestationQueueRetryTimer = null;
}

function isRetryableAttestationError(error) {
    const status = Number(error?.httpStatus || 0);
    if (status === 408 || status === 425 || status === 429 || status >= 500) return true;
    const message = String(error?.message || '').toLowerCase();
    return (
        message.includes('failed to fetch') ||
        message.includes('networkerror') ||
        message.includes('timeout') ||
        message.includes('таймаут') ||
        message.includes('network request failed')
    );
}

async function sendAttestationJobWithRetry(job, maxAttempts = ATTESTATION_SEND_ATTEMPTS) {
    const { fileName, fileBase64, fileMime } = await buildAttestationDocxPayload(job.dialog, job.rating, {
        managerName: job.managerName,
        timestamp: job.createdAt
    });
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        let debugEntryId = null;
        let response = null;
        try {
            debugEntryId = startWebhookDebugRequest({
                type: 'attestation',
                endpoint: ATTESTATION_WEBHOOK_URL,
                requestId: job.requestId,
                attempt,
                timeoutMs: ATTESTATION_WEBHOOK_TIMEOUT_MS
            });
            response = await fetchWithTimeout(ATTESTATION_WEBHOOK_URL, {
                method: 'POST',
                headers: buildJsonRequestHeaders(job.requestId, 'attestation'),
                body: JSON.stringify({
                    dialog: job.dialog,
                    rating: job.rating,
                    clientPrompt: job.clientPrompt,
                    managerPrompt: job.managerPrompt,
                    raterPrompt: job.raterPrompt,
                    sessionId: job.sessionId,
                    mode: 'attestation',
                    requestId: job.requestId,
                    attempt,
                    sentAt: new Date().toISOString(),
                    queuedAt: job.createdAt,
                    fileName,
                    fileBase64,
                    fileMime
                })
            }, ATTESTATION_WEBHOOK_TIMEOUT_MS);

            if (!response.ok) {
                const err = new Error(`HTTP ${response.status}`);
                err.httpStatus = response.status;
                throw err;
            }
            finishWebhookDebugRequest(debugEntryId, {
                httpStatus: response.status,
                resultMessage: 'Отправлено'
            });
            return true;
        } catch (error) {
            failWebhookDebugRequest(debugEntryId, error, response?.status);
            lastError = error;
            if (attempt >= maxAttempts || !isRetryableAttestationError(error)) {
                throw lastError;
            }
            console.warn(`Attestation webhook attempt ${attempt}/${maxAttempts} failed, retrying...`, error);
            await delay(ATTESTATION_SEND_RETRY_BASE_MS * attempt);
        }
    }

    throw lastError || new Error('Не удалось отправить отчет аттестации');
}

async function flushAttestationQueue(options = {}) {
    const { notifySuccess = false } = options;
    if (!ATTESTATION_WEBHOOK_URL) return;
    if (isAttestationQueueFlushInProgress) return;
    if (!attestationQueue.length) return;
    if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) {
        scheduleAttestationQueueRetry();
        return;
    }

    isAttestationQueueFlushInProgress = true;
    clearAttestationQueueRetryTimer();
    let deliveredCount = 0;
    let shouldRetryLater = false;
    let retryDelayMs = ATTESTATION_QUEUE_RETRY_DELAY_MS;

    try {
        while (attestationQueue.length > 0) {
            const job = attestationQueue[0];
            try {
                await sendAttestationJobWithRetry(job, ATTESTATION_SEND_ATTEMPTS);
                attestationQueue.shift();
                saveAttestationQueue();
                deliveredCount += 1;
            } catch (error) {
                const retryable = isRetryableAttestationError(error);
                job.failures = (Number(job.failures) || 0) + 1;
                job.lastError = String(error?.message || error || 'Unknown error');
                job.lastTriedAt = new Date().toISOString();
                saveAttestationQueue();
                if (!retryable) {
                    console.warn('Attestation send returned non-retryable error, will retry later:', error);
                }
                if (job.failures >= ATTESTATION_QUEUE_MAX_FAILURES) {
                    retryDelayMs = Math.max(retryDelayMs, 30000);
                }
                shouldRetryLater = true;
                break;
            }
        }
    } finally {
        isAttestationQueueFlushInProgress = false;
    }

    if (deliveredCount > 0 && notifySuccess) {
        showCopyNotification(deliveredCount === 1 ? 'Отчет отправлен в Telegram' : 'Отчеты отправлены в Telegram');
    }
    if (shouldRetryLater && attestationQueue.length > 0) {
        scheduleAttestationQueueRetry(retryDelayMs);
    }
}

function isRetryableRatingError(error) {
    const status = Number(error?.httpStatus || 0);
    if (status === 408 || status === 425 || status === 429 || status >= 500) return true;
    const message = String(error?.message || '').toLowerCase();
    return (
        message.includes('failed to fetch') ||
        message.includes('networkerror') ||
        message.includes('timeout') ||
        message.includes('таймаут') ||
        message.includes('пустой ответ')
    );
}

async function requestRatingWithRetry(dialogText, raterPrompt, maxAttempts = RATING_SEND_ATTEMPTS, options = {}) {
    const signal = options?.signal;
    const requestId = buildRequestId('rating');
    let lastError = null;
    const runtimeRatingConfig = getRuntimeRatingRequestConfig();
    const conversationOutcomeState = getConversationActionStatePayload();
    const effectiveRaterPrompt = buildRaterPromptForWebhook(raterPrompt);
    const effectiveMaxAttempts = Math.min(
        normalizeDebugPositiveInt(maxAttempts, runtimeRatingConfig.attempts, 1, RATING_SEND_ATTEMPTS),
        runtimeRatingConfig.attempts
    );

    for (let attempt = 1; attempt <= effectiveMaxAttempts; attempt += 1) {
        let debugEntryId = null;
        let response = null;
        try {
            if (signal?.aborted) {
                throw createChatUiSessionResetError();
            }
            debugEntryId = startWebhookDebugRequest({
                type: 'rating',
                endpoint: RATE_WEBHOOK_URL,
                requestId,
                attempt,
                timeoutMs: runtimeRatingConfig.timeoutMs
            });
            response = await fetchWithTimeout(RATE_WEBHOOK_URL, {
                method: 'POST',
                headers: buildJsonRequestHeaders(requestId, 'rating', 'rating'),
                signal,
                body: JSON.stringify(buildUnifiedSimulatorWebhookPayload('rating', {
                    dialog: dialogText,
                    systemPrompt: effectiveRaterPrompt,
                    sessionId: raterSessionId,
                    requestId,
                    attempt,
                    sentAt: new Date().toISOString(),
                    conversationOutcome: conversationOutcomeState?.type || '',
                    conversationOutcomeReason: conversationOutcomeState?.reason || '',
                    conversationOutcomeRecoverable: !!conversationOutcomeState?.recoverable,
                    activeScenarioPresetId: '',
                    activeScenarioPresetName: ''
                }))
            }, runtimeRatingConfig.timeoutMs);

            if (!response.ok) {
                const err = new Error(`HTTP ${response.status}`);
                err.httpStatus = response.status;
                throw err;
            }

            const rawRatingMessage = await readWebhookResponse(response, runtimeRatingConfig.timeoutMs);
            if (signal?.aborted) {
                throw createChatUiSessionResetError();
            }
            const ratingResult = normalizeRatingWebhookResult(rawRatingMessage, conversationOutcomeState);
            if (/^\s*<!doctype|^\s*<html/i.test(ratingResult.displayText || '')) {
                const err = new Error('Некорректный ответ сервера оценки');
                err.httpStatus = 502;
                throw err;
            }
            if (!ratingResult.displayText || ratingResult.displayText.trim() === '') {
                const err = new Error('Пустой ответ');
                err.httpStatus = 204;
                throw err;
            }
            finishWebhookDebugRequest(debugEntryId, {
                httpStatus: response.status,
                resultMessage: ratingResult.structured?.summary
                    ? `Оценка: ${ratingResult.structured.summary}`
                    : `Ответ ${ratingResult.displayText.trim().length} симв.`
            });
            return ratingResult;
        } catch (error) {
            failWebhookDebugRequest(debugEntryId, error, response?.status);
            lastError = error;
            if (attempt >= effectiveMaxAttempts || !isRetryableRatingError(error) || isChatUiRequestCancelledError(error)) {
                throw lastError;
            }
            console.warn(`Rating webhook attempt ${attempt}/${effectiveMaxAttempts} failed, retrying...`, error);
            const baseDelay = Math.min(
                runtimeRatingConfig.retryMaxMs,
                runtimeRatingConfig.retryBaseMs * Math.pow(2, attempt - 1)
            );
            const jitter = Math.floor(Math.random() * 250);
            await delayWithSignal(baseDelay + jitter, signal);
        }
    }

    throw lastError || new Error('Не удалось получить оценку');
}

async function rateChat(options = {}) {
    const { force = false, dialogTextOverride = '' } = options;
    const hasDialogOverride = typeof dialogTextOverride === 'string' && dialogTextOverride.trim() !== '';

    if (!hasDialogOverride && conversationHistory.length === 0) {
        alert('Нет диалога для оценки');
        return;
    }
    if (isProcessing) return;
    
    // If already rated, cancel the rating
    if (isDialogRated && !force) {
        showReratePrompt();
        return;
    }
    if (force) {
        resetRatingUiForRerun();
    }
    const requestGuard = beginChatUiRequestGuard();

    const raterPrompt = validatePromptBeforeWebhook('rater', raterPromptInput.value);
    if (!raterPrompt) {
        finishChatUiRequestGuard(requestGuard);
        return;
    }
    
    rateChatBtn.disabled = true;
    rateChatBtn.classList.add('loading');
    aiAssistBtn.disabled = true;
    toggleInputState(false);
    
    const loadingMsg = addMessage('', 'loading');
    
    try {
        const dialogText = hasDialogOverride ? dialogTextOverride.trim() : buildDialogText();
        if (!dialogText) {
            throw new Error('Нет диалога для оценки');
        }
        const ratingResult = await requestRatingWithRetry(dialogText, raterPrompt, RATING_SEND_ATTEMPTS, {
            signal: requestGuard.signal
        });
        ensureChatUiRequestGuardCurrent(requestGuard);
        
        loadingMsg.remove();
        lastRating = ratingResult.exportText;
        addRatingMessage(ratingResult);
        
        // Add button to improve manager prompt based on rating
        addImproveFromRatingButton(dialogText, ratingResult.exportText);
        
        isDialogRated = true;
        lockDialogInput();
        rateChatBtn.classList.add('rated');
        if (isAttestationMode) {
            sendAttestationResult(dialogText, ratingResult.exportText);
        }
        if (isConversationClosed() && conversationTerminalAction) {
            showConversationActionNotice(conversationTerminalAction);
        }
        
    } catch (error) {
        if (isChatUiRequestCancelledError(error)) {
            loadingMsg.remove();
            return;
        }
        console.error('Rating error details:', error);
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
        loadingMsg.remove();
        addMessage(`Ошибка оценки: ${error.message}. Проверьте консоль (F12) для деталей.`, 'error', false);
    } finally {
        const shouldRestoreUi = requestGuard.version === chatUiSessionVersion
            && requestGuard.sessionId === baseSessionId
            && !requestGuard.signal.aborted;
        finishChatUiRequestGuard(requestGuard);
        if (shouldRestoreUi) {
            rateChatBtn.classList.remove('loading');
            if (!lastRating) {
                if (isConversationClosed()) {
                    lockDialogInput();
                } else {
                    toggleInputState(true);
                    userInput.focus();
                }
            } else {
                updateRateChatButtonState();
            }
        }
    }
}

function addImproveFromRatingButton(dialogText, ratingText) {
    // Only show for admins
    if (!isAdmin()) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system-action improve-message';
    messageDiv.style.alignSelf = 'center';
    messageDiv.style.maxWidth = '95%';
    messageDiv.style.background = 'transparent';
    messageDiv.style.padding = '0';
    messageDiv.style.boxShadow = 'none';
    
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'improve-from-rating-container';
    buttonContainer.style.margin = '0';
    buttonContainer.style.border = 'none';
    
    buttonContainer.innerHTML = `
        <div class="improve-from-rating-title">Улучшить инструкцию:</div>
        <div class="improve-from-rating-buttons">
            <button
                class="btn-improve-from-rating"
                data-role="manager"
                title="Улучшение ИИ-менеджера (автоответ клиенту) использовать только в полностью сгенерированных диалогах"
            >Менеджер</button>
            <button class="btn-improve-from-rating" data-role="manager_call">Клиент звонок</button>
            <button class="btn-improve-from-rating" data-role="client">Клиент</button>
            <button class="btn-improve-from-rating" data-role="rater">Оценщик</button>
        </div>
    `;
    prepareCustomTooltips(buttonContainer);
    
    const roleButtons = buttonContainer.querySelectorAll('.btn-improve-from-rating');
    roleButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const role = btn.dataset.role;
            if (!role) return;
            showAiImproveModal({
                mode: 'rating',
                context: { role, dialogText, ratingText }
            });
        });
    });

    messageDiv.appendChild(buttonContainer);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendAttestationResult(dialogText, ratingText) {
    if (!ATTESTATION_WEBHOOK_URL) {
        console.warn('ATTESTATION_WEBHOOK_URL is not set');
        return;
    }
    const dialog = String(dialogText || '').trim();
    const rating = String(ratingText || '').trim();
    if (!dialog || !rating) {
        console.warn('Attestation payload is empty, skipping send');
        return;
    }

    const requestId = buildAttestationRequestId();
    const job = enqueueAttestationJob({
        id: requestId,
        requestId,
        createdAt: new Date().toISOString(),
        managerName: getManagerName(''),
        dialog,
        rating,
        clientPrompt: getActiveContent('client'),
        managerPrompt: getActiveContent('manager'),
        raterPrompt: getActiveContent('rater'),
        sessionId: raterSessionId
    });

    if (!job) {
        showCopyNotification('Ошибка отправки отчета');
        return;
    }

    showCopyNotification('Отправляю отчет в Telegram...');
    await flushAttestationQueue({ notifySuccess: true });

    const stillPending = attestationQueue.some(item => item.id === job.id);
    if (stillPending) {
        showCopyNotification('Отчет в очереди. Повторю отправку автоматически.');
        scheduleAttestationQueueRetry();
    }
}

function textToDocxParagraphs(text) {
    const { Paragraph, TextRun } = docx;
    if (!text) {
        return [new Paragraph({ children: [new TextRun('')] })];
    }
    return text.replace(/\r\n/g, '\n').split('\n').map(line => new Paragraph({
        children: [new TextRun(line)]
    }));
}

function sanitizeFileNamePart(value) {
    return String(value || '')
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '_')
        .replace(/\s+/g, ' ')
        .replace(/[.]+$/g, '')
        .trim();
}

async function buildAttestationDocxPayload(dialogText, ratingText, options = {}) {
    await ensureDocxLibrary();
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docx;
    const title = new Paragraph({
        text: 'Отчет аттестации',
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 300 }
    });
    const ratingHeader = new Paragraph({
        children: [new TextRun({ text: 'Оценка', bold: true })],
        spacing: { after: 120 }
    });
    const dialogHeader = new Paragraph({
        children: [new TextRun({ text: 'Диалог', bold: true })],
        spacing: { before: 240, after: 120 }
    });
    const children = [
        title,
        ratingHeader,
        ...textToDocxParagraphs(ratingText),
        new Paragraph({ children: [new TextRun('')] }),
        dialogHeader,
        ...textToDocxParagraphs(dialogText)
    ];
    const doc = new Document({ sections: [{ properties: {}, children }] });
    const blob = await Packer.toBlob(doc);
    const fileBase64 = await blobToBase64(blob);
    const timestampSource = options.timestamp || new Date().toISOString();
    const timestamp = timestampSource.replace(/[:.]/g, '-');
    const rawName = options.managerName || getManagerName('') || '';
    const safeName = sanitizeFileNamePart(rawName) || 'user';
    return {
        fileName: `attestation_${safeName}_${timestamp}.docx`,
        fileBase64,
        fileMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = String(reader.result || '');
            const base64 = result.includes(',') ? result.split(',')[1] : result;
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function generateAIResponse() {
    if (isDialogRated || conversationHistory.length === 0 || isProcessing) return;
    const requestGuard = beginChatUiRequestGuard();
    const conversationRevisionAtStart = conversationHistoryRevision;
    const sessionIdAtStart = managerSessionId;
    const inputValueAtStart = userInput.value;

    const basePrompt = validatePromptBeforeWebhook('manager', managerPromptInput.value);
    if (!basePrompt) {
        finishChatUiRequestGuard(requestGuard);
        return;
    }
    
    aiAssistBtn.disabled = true;
    rateChatBtn.disabled = true;
    aiAssistBtn.classList.add('loading');
    
    let debugEntryId = null;
    let response = null;
    try {
        const dialogHistory = conversationHistoryText.trim();
        const lastMessage = conversationHistory[conversationHistory.length - 1].content;
        const managerName = getManagerName();
        const fullPrompt = `Тебя зовут ${managerName}.\n\n${basePrompt}`;
        const requestId = buildRequestId('manager_assist');
        
        debugEntryId = startWebhookDebugRequest({
            type: 'manager_assist',
            endpoint: MANAGER_ASSISTANT_WEBHOOK_URL,
            requestId,
            timeoutMs: AI_HELPER_WEBHOOK_TIMEOUT_MS
        });
        response = await fetchWithTimeout(MANAGER_ASSISTANT_WEBHOOK_URL, {
            method: 'POST',
            headers: buildJsonRequestHeaders(requestId, 'manager_assist', 'manager_assist'),
            signal: requestGuard.signal,
            body: JSON.stringify(buildUnifiedSimulatorWebhookPayload('manager_assist', {
                systemPrompt: fullPrompt,
                userMessage: lastMessage,
                dialogHistory,
                sessionId: managerSessionId,
                requestId
            }))
        }, AI_HELPER_WEBHOOK_TIMEOUT_MS);
        
        if (!response.ok) {
            const httpError = new Error(`HTTP ${response.status}`);
            httpError.httpStatus = response.status;
            throw httpError;
        }
        
        const aiMessage = await readWebhookResponse(response, AI_HELPER_WEBHOOK_TIMEOUT_MS);
        ensureChatUiRequestGuardCurrent(requestGuard);
        if (conversationHistoryRevision !== conversationRevisionAtStart || managerSessionId !== sessionIdAtStart) {
            throw createChatUiRequestStaleError();
        }
        if (!aiMessage) throw new Error('Пустой ответ');
        finishWebhookDebugRequest(debugEntryId, {
            httpStatus: response.status,
            resultMessage: `Ответ ${aiMessage.trim().length} симв.`
        });
        
        const cleanedMessage = aiMessage.trim().replace(/^["']|["']$/g, '').replace(/^(Менеджер|Manager):\s*/i, '');
        if (userInput.value !== inputValueAtStart) {
            throw createChatUiRequestStaleError();
        }
        
        userInput.value = cleanedMessage;
        autoResizeTextarea(userInput);
        updateSendBtnState(); // Активируем кнопку отправки
        userInput.focus();
        
    } catch (error) {
        failWebhookDebugRequest(debugEntryId, error, response?.status);
        if (isChatUiRequestCancelledError(error)) {
            return;
        }
        console.error('AI generation error:', error);
        alert('Ошибка: ' + error.message);
    } finally {
        const shouldRestoreUi = requestGuard.version === chatUiSessionVersion
            && requestGuard.sessionId === baseSessionId
            && !requestGuard.signal.aborted;
        finishChatUiRequestGuard(requestGuard);
        if (shouldRestoreUi) {
            if (!isProcessing) {
                aiAssistBtn.disabled = false;
            }
            updateRateChatButtonState();
        }
        aiAssistBtn.classList.remove('loading');
    }
}

// Initialize button state
updateSendBtnState();

// ============ EXPORT FUNCTIONS ============

function downloadWithFileSaver(blob, fileName) {
    return ensureFileSaverLibrary()
        .then(() => {
            saveAs(blob, fileName);
        })
        .catch((error) => {
            alert(error?.message || 'Не удалось инициализировать FileSaver');
        });
}

function ensureDocxAndSaveAs() {
    return Promise.all([ensureDocxLibrary(), ensureFileSaverLibrary()]);
}

function exportChat(format = 'txt') {
    if (conversationHistory.length === 0) {
        alert('Нет сообщений для экспорта');
        return;
    }

    const messages = conversationHistory.map(msg => ({
        role: msg.role === 'user' ? 'Менеджер' : 'Клиент',
        content: msg.content
    }));
    
    if (lastRating) {
        messages.push({ role: 'ОЦЕНКА ДИАЛОГА', content: lastRating });
    }

    const filename = `диалог ${new Date().toLocaleString().replace(/[:.]/g, '-')}`;

    if (format === 'clipboard') copyMessagesToClipboard(messages);
    else if (format === 'txt') exportToTxt(messages, filename);
    else if (format === 'docx') exportToDocx(messages, filename);
    else if (format === 'rtf') exportToRtf(messages, filename);
    else if (format === 'pdf') exportToPdf(messages, filename);
}

async function copyMessagesToClipboard(messages) {
    let chatText = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n\n');
    try {
        await navigator.clipboard.writeText(chatText);
        showCopyNotification('Скопировано в буфер');
    } catch (err) {
        alert('Ошибка копирования');
    }
}

function showCopyNotification(text) {
    const existing = document.querySelector('.copy-notification');
    if (existing) existing.remove();
    const notification = document.createElement('div');
    notification.className = 'copy-notification';
    notification.textContent = text;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

function exportToTxt(messages, filename) {
    const chatText = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n\n');
    const blob = new Blob([chatText], { type: 'text/plain;charset=utf-8' });
    void downloadWithFileSaver(blob, filename + '.txt');
}

function exportToDocx(messages, filename) {
    ensureDocxAndSaveAs()
        .then(() => {
            const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = docx;
            const children = [new Paragraph({
                text: "История диалога",
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 }
            })];

            messages.forEach(msg => {
                const isRating = msg.role === 'ОЦЕНКА ДИАЛОГА';
                children.push(new Paragraph({
                    children: [new TextRun({
                        text: `${msg.role}:`,
                        bold: true,
                        size: 24,
                        color: isRating ? "FF9900" : "2E74B5"
                    })],
                    spacing: { before: 200, after: 100 }
                }));
                children.push(new Paragraph({
                    children: [new TextRun({ text: msg.content, size: 24 })],
                    spacing: { after: 200 }
                }));
            });

            const doc = new Document({ sections: [{ properties: {}, children }] });
            return Packer.toBlob(doc);
        })
        .then((blob) => {
            if (blob) {
                void downloadWithFileSaver(blob, filename + ".docx");
            }
        })
        .catch((error) => {
            alert(error.message || 'Ошибка экспорта в DOCX');
        });
}

function exportToRtf(messages, filename) {
    function escapeRtf(str) {
        if (!str) return '';
        return str.replace(/\\/g, '\\\\').replace(/{/g, '\\{').replace(/}/g, '\\}').replace(/\n/g, '\\par ').replace(/[^\x00-\x7F]/g, c => `\\u${c.charCodeAt(0)}?`);
    }
    let rtf = "{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Calibri;}{\\f1 Segoe UI;}}{\\colortbl ;\\red46\\green116\\blue181;\\red255\\green153\\blue0;}\\viewkind4\\uc1\\pard\\qc\\b\\f1\\fs32 История диалога\\par\\pard\\par\n";
    messages.forEach(msg => {
        const colorIndex = msg.role === 'ОЦЕНКА ДИАЛОГА' ? 2 : 1;
        rtf += `\\pard\\cf${colorIndex}\\b\\fs24 ${escapeRtf(msg.role)}:\\cf0\\b0\\par ${escapeRtf(msg.content)}\\par\\par\n`;
    });
    rtf += "}";
    const blob = new Blob([rtf], { type: "application/rtf" });
    void downloadWithFileSaver(blob, filename + ".rtf");
}

function exportToPdf(messages, filename) {
    const content = messages.map((msg) => {
        const roleColor = msg.role === 'ОЦЕНКА ДИАЛОГА' ? '#ff9900' : '#2e74b5';
        const safeRole = escapeHtml(msg?.role || 'Системное сообщение');
        const safeContent = escapeHtml(msg?.content || '').replace(/\n/g, '<br>');
        return `<div style="margin-bottom: 16px;"><strong style="color: ${roleColor};">${safeRole}:</strong><br>${safeContent}</div>`;
    }).join('');
    buildSafeExportPdfWindow({
        title: filename,
        css: '<style>body { font-family: \'Segoe UI\', Arial, sans-serif; padding: 40px; line-height: 1.6; } h1 { text-align: center; margin-bottom: 30px; }</style>',
        body: `
            <h1>История диалога</h1>
            ${content}
        `
    });
}

function exportPromptToPdf(text, filename) {
    const content = renderMarkdown(text);
    buildSafeExportPdfWindow({
        title: filename,
        css: '<style>body { font-family: \'Segoe UI\', Arial, sans-serif; padding: 40px; line-height: 1.6; } h1, h2, h3 { margin-top: 24px; margin-bottom: 12px; } ul, ol { margin: 12px 0; padding-left: 24px; } li { margin-bottom: 6px; } code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; } pre { background: #f5f5f5; padding: 16px; border-radius: 6px; overflow-x: auto; } blockquote { border-left: 3px solid #667eea; padding-left: 16px; margin: 16px 0; color: #555; }</style>',
        body: content
    });
}

function exportCurrentPrompt(format = 'txt') {
    const role = getActiveRole();
    const promptText = getActiveContent(role);
    if (!promptText) { alert('Инструкция пуста'); return; }
    
    let fileName = role === 'client'
        ? 'промпт-клиента'
        : role === 'manager'
            ? 'промпт-менеджера'
            : role === 'manager_call'
                ? 'промпт-клиента-звонка'
                : 'промпт-оценщика';
    const activeVar = promptsData[role].variations.find(v => v.id === promptsData[role].activeId);
    if (activeVar) fileName += `-${activeVar.name.replace(/\s+/g, '_')}`;
    
    const timestamp = new Date().toLocaleString().replace(/[:.]/g, '-');
    const fullFileName = `${fileName} ${timestamp}`;
    
    if (format === 'clipboard') {
        copyPromptToClipboard(promptText, fileName);
    } else if (format === 'txt') {
        const blob = new Blob([promptText], { type: 'text/plain;charset=utf-8' });
        void downloadWithFileSaver(blob, fullFileName + '.txt');
    }
    else if (format === 'docx') exportPromptToDocx(promptText, fullFileName);
    else if (format === 'rtf') exportPromptToRtf(promptText, fullFileName);
    else if (format === 'pdf') exportPromptToPdf(promptText, fullFileName);
}

function buildPromptEmergencyBackupPayload() {
    const emergencySnapshot = loadCachedPublicPromptsEmergencySnapshot();
    const source = emergencySnapshot || buildPromptsSyncPayload(PROMPT_ROLES);
    const normalized = normalizePromptSnapshotForCache(source);
    if (!firebasePromptSnapshotHasMeaningfulContent(normalized)) {
        return null;
    }

    const cached = getCachedLocalStorageJson(LOCAL_PROMPTS_EMERGENCY_BACKUP_STORAGE_KEY);
    const savedTimestamp = Number(cached && cached.t);
    const timestamp = Number.isFinite(savedTimestamp) ? savedTimestamp : Date.now();
    const hasLiveSnapshot = firebasePromptSnapshotHasMeaningfulContent(
        normalizePromptSnapshotForCache(buildPromptsSyncPayload(PROMPT_ROLES))
    );

    return {
        v: 1,
        kind: 'promptEmergencyBackup',
        source: hasLiveSnapshot ? 'live' : 'cache',
        exportedAt: new Date().toISOString(),
        sourceTimestamp: timestamp,
        data: normalized
    };
}

function exportPromptEmergencyBackup() {
    const backupPayload = buildPromptEmergencyBackupPayload();
    if (!backupPayload) {
        alert('Нет данных для экспорта резервной копии.');
        return;
    }

    const filename = `prompt-emergency-backup-${new Date().toLocaleString().replace(/[:.]/g, '-')}`;
    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
        type: 'application/json;charset=utf-8'
    });
    void downloadWithFileSaver(blob, `${filename}.json`);
}

function restorePromptsFromEmergencyBackup() {
    if (!isAdmin()) {
        alert('Восстановить публичные промпты можно только из режима администратора.');
        return;
    }

    const cached = getCachedLocalStorageJson(LOCAL_PROMPTS_EMERGENCY_BACKUP_STORAGE_KEY);
    const rawData = cached && typeof cached === 'object' && cached.data
        ? cached.data
        : cached;
    const normalized = normalizePromptSnapshotForCache(rawData || {});
    const backupTimestamp = Number(cached && cached.t);

    if (!firebasePromptSnapshotHasMeaningfulContent(normalized)) {
        alert('Экстренная копия не найдена в localStorage.');
        return;
    }

    const backupDateText = Number.isFinite(backupTimestamp)
        ? new Date(backupTimestamp).toLocaleString()
        : 'неизвестно';
    const ok = window.confirm(`Восстановить public-промпты из копии от ${backupDateText}?`);
    if (!ok) {
        return;
    }

    const didApply = initPromptsData(normalized, { forceApplyEmpty: true });
    if (!didApply) {
        alert('Не удалось применить резервную копию.');
        return;
    }

    persistPublicPromptsEmergencySnapshot(normalized);
    persistPublicPromptsSnapshot(normalized);
    saveLocalPromptsData();
    if (isAdmin()) {
        savePromptsToFirebaseNow({ fullReplace: true });
    }
    showCopyNotification('Экстренная копия применена.');
}

function parseStyledText(text, TextRun) {
    const runs = [];
    let remaining = text;
    
    // Простой парсер: ищем **bold** и *italic* поочерёдно
    while (remaining.length > 0) {
        // Ищем ближайший маркер форматирования
        const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
        const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/);
        
        let nextMatch = null;
        let matchType = null;
        
        // Определяем какой маркер ближе
        if (boldMatch && italicMatch) {
            if (remaining.indexOf(boldMatch[0]) <= remaining.indexOf(italicMatch[0])) {
                nextMatch = boldMatch;
                matchType = 'bold';
            } else {
                nextMatch = italicMatch;
                matchType = 'italic';
            }
        } else if (boldMatch) {
            nextMatch = boldMatch;
            matchType = 'bold';
        } else if (italicMatch) {
            nextMatch = italicMatch;
            matchType = 'italic';
        }
        
        if (nextMatch) {
            const matchIndex = remaining.indexOf(nextMatch[0]);
            
            // Добавляем текст до маркера
            if (matchIndex > 0) {
                runs.push(new TextRun({ text: remaining.slice(0, matchIndex), size: 24 }));
            }
            
            // Добавляем форматированный текст
            if (matchType === 'bold') {
                runs.push(new TextRun({ text: nextMatch[1], bold: true, size: 24 }));
            } else {
                runs.push(new TextRun({ text: nextMatch[1], italics: true, size: 24 }));
            }
            
            remaining = remaining.slice(matchIndex + nextMatch[0].length);
        } else {
            // Нет больше маркеров - добавляем остаток
            runs.push(new TextRun({ text: remaining, size: 24 }));
            break;
        }
    }
    
    if (runs.length === 0) {
        runs.push(new TextRun({ text: text, size: 24 }));
    }
    return runs;
}

function exportPromptToDocx(text, filename) {
    ensureDocxAndSaveAs()
        .then(() => {
            const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docx;
            const children = [];
            const lines = text.split('\n');

            lines.forEach(line => {
                const trimmed = line.trim();

                if (trimmed === '') {
                    children.push(new Paragraph({ text: '', spacing: { after: 100 } }));
                    return;
                }

                let paraOpts = {
                    spacing: { after: 120 },
                    children: []
                };

                if (line.startsWith('# ')) {
                    paraOpts.children = [new TextRun({ text: line.slice(2), bold: true, size: 32 })];
                    paraOpts.spacing = { before: 280, after: 140 };
                } else if (line.startsWith('## ')) {
                    paraOpts.children = [new TextRun({ text: line.slice(3), bold: true, size: 28 })];
                    paraOpts.spacing = { before: 240, after: 120 };
                } else if (line.startsWith('### ')) {
                    paraOpts.children = [new TextRun({ text: line.slice(4), bold: true, size: 26 })];
                    paraOpts.spacing = { before: 200, after: 100 };
                } else if (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length > 4) {
                    const headerText = trimmed.slice(2, -2);
                    if (!headerText.includes('**')) {
                        paraOpts.children = [new TextRun({ text: headerText, bold: true, size: 28 })];
                        paraOpts.spacing = { before: 240, after: 120 };
                    } else {
                        paraOpts.children = parseStyledText(line, TextRun);
                    }
                } else if (line.startsWith('- ') || line.startsWith('* ')) {
                    const listContent = line.slice(2);
                    paraOpts.indent = { left: 360 };
                    paraOpts.children = [new TextRun({ text: '• ', size: 24 }), ...parseStyledText(listContent, TextRun)];
                } else if (/^\d+\.\s/.test(line)) {
                    const match = line.match(/^(\d+\.)\s(.*)$/);
                    if (match) {
                        paraOpts.indent = { left: 360 };
                        paraOpts.children = [new TextRun({ text: `${match[1]} `, size: 24 }), ...parseStyledText(match[2], TextRun)];
                    }
                } else {
                    paraOpts.children = parseStyledText(line, TextRun);
                }

                children.push(new Paragraph(paraOpts));
            });

            const doc = new Document({ sections: [{ properties: {}, children }] });
            return Packer.toBlob(doc);
        })
        .then((blob) => {
            if (blob) {
                void downloadWithFileSaver(blob, filename + ".docx");
            }
        })
        .catch((error) => {
            alert(error.message || 'Ошибка экспорта в DOCX');
        });
}

function exportPromptToRtf(text, filename) {
    function escapeRtf(str) {
        if (!str) return '';
        return str.replace(/\\/g, '\\\\').replace(/{/g, '\\{').replace(/}/g, '\\}').replace(/\n/g, '\\par ').replace(/[^\x00-\x7F]/g, c => `\\u${c.charCodeAt(0)}?`);
    }
    
    let rtf = "{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Calibri;}}{\\colortbl ;\\red0\\green0\\blue0;}\\viewkind4\\uc1\\pard\\f0\\fs24\n";
    
    const lines = text.split('\n');
    lines.forEach(line => {
        if (line.startsWith('# ')) {
            rtf += `\\pard\\b\\fs36 ${escapeRtf(line.slice(2))}\\b0\\fs24\\par\\par\n`;
        } else if (line.startsWith('## ')) {
            rtf += `\\pard\\b\\fs32 ${escapeRtf(line.slice(3))}\\b0\\fs24\\par\\par\n`;
        } else if (line.startsWith('### ')) {
            rtf += `\\pard\\b\\fs28 ${escapeRtf(line.slice(4))}\\b0\\fs24\\par\\par\n`;
        } else {
            rtf += `\\pard ${escapeRtf(line)}\\par\n`;
        }
    });
    
    rtf += "}";
    const blob = new Blob([rtf], { type: "application/rtf" });
    void downloadWithFileSaver(blob, filename + ".rtf");
}

async function copyPromptToClipboard(text, label) {
    try {
        await navigator.clipboard.writeText(text);
        showCopyNotification(`${label} скопирован`);
    } catch (err) {
        alert('Ошибка копирования');
    }
    }
    
// ============ MARKDOWN RENDERING ============

const markdownRenderCache = new Map();

function getCachedMarkdown(key) {
    if (!markdownRenderCache.has(key)) return null;
    const cached = markdownRenderCache.get(key);
    // LRU bump
    markdownRenderCache.delete(key);
    markdownRenderCache.set(key, cached);
    return cached;
}

function setCachedMarkdown(key, html) {
    markdownRenderCache.set(key, html);
    if (markdownRenderCache.size <= MARKDOWN_CACHE_MAX_SIZE) return;
    const oldestKey = markdownRenderCache.keys().next().value;
    if (oldestKey !== undefined) {
        markdownRenderCache.delete(oldestKey);
    }
}

function renderMarkdown(text) {
    if (!text) return '<p style="color: #666; font-style: italic;">Промпт пустой...</p>';
    
    // Unescape any escaped markdown characters first
    let cleanText = unescapeMarkdown(text);

    const canCache = cleanText.length <= MARKDOWN_CACHE_TEXT_LIMIT;
    if (canCache) {
        const cached = getCachedMarkdown(cleanText);
        if (cached !== null) return cached;
    }

    let html;
    if (typeof marked !== 'undefined') {
        html = marked.parse(cleanText);
    } else {
        // Simple fallback
        html = '<p>' + cleanText
        .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
        .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
        .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\n\n+/g, '</p><p>')
        .replace(/\n/g, '<br>') + '</p>';
    }

    const safeHtml = sanitizeRenderedHtml(html);
    if (canCache) {
        setCachedMarkdown(cleanText, safeHtml);
    }
    return safeHtml;
}

function updatePreview() {
    const role = getActiveRole();
    updateEditorContent(role);
}

function updateAllPreviews() {
    PROMPT_ROLES.forEach(updateEditorContent);
}

// ============ WYSIWYG SETUP ============

let editingTimeout = null;

const syncWYSIWYGDebounced = debounce(function(previewElement, textarea, callback) {
    if (turndownService && previewElement) {
        const markdown = turndownService.turndown(previewElement.innerHTML);
        textarea.value = markdown;
        if (callback) callback(markdown);
        }

    const wrapper = previewElement?.closest('.prompt-wrapper');
    const role = wrapper?.dataset?.instruction || '';
    schedulePromptEditingEnd(role, 5000); // Increased to 5s to prevent race conditions with Firebase echo
}, 300);
        
// Force immediate sync of current editor content
function syncCurrentEditorNow(role = getActiveRole()) {
    const preview = promptPreviewByRole[role];
    const textarea = promptInputsByRole[role];
    
    if (turndownService && preview && textarea) {
        const markdown = turndownService.turndown(preview.innerHTML);
        
        // Critical Fix: Don't sync if Turndown failed but content exists
        if (markdown.trim() === '' && (preview.innerText || '').trim() !== '') {
            console.warn('Sync cancelled: Turndown returned empty for non-empty preview');
            return;
        }

        textarea.value = markdown;
        const syncResult = syncContentToData(role, markdown);
        if (syncResult !== null) {
            checkpointPromptHistory(role);
        }
    }
}

function setupWYSIWYG(role, previewElement, textarea, callback) {
    previewElement.setAttribute('contenteditable', 'true');
    
    previewElement.addEventListener('input', () => {
        beginPromptEditing(role);
        syncWYSIWYGDebounced(previewElement, textarea, callback);
});

    previewElement.addEventListener('focus', () => {
        beginPromptEditing(role);
});

    previewElement.addEventListener('blur', () => {
        // Delay resetting the flag to allow sync to complete
        setTimeout(() => {
            syncCurrentEditorNow(role);
            endPromptEditing(role);
        }, 500);
    });
    
    previewElement.addEventListener('paste', (e) => {
        e.preventDefault();
        
        const html = e.clipboardData.getData('text/html');
        const text = e.clipboardData.getData('text/plain');
        
        const selection = window.getSelection();
        if (selection.rangeCount) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            
            if (html) {
                // Handle HTML paste to preserve formatting
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = sanitizeRenderedHtml(html);
                const fragment = document.createDocumentFragment();
                while (tempDiv.firstChild) fragment.appendChild(tempDiv.firstChild);
                range.insertNode(fragment);
            } else {
                const hasMarkdown = /^#|^\*\*|\*\*$|^-\s|^\d+\.\s|^```|^>/.test(text);
                if (hasMarkdown) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = renderMarkdown(text);
                    const fragment = document.createDocumentFragment();
                    while (tempDiv.firstChild) fragment.appendChild(tempDiv.firstChild);
                    range.insertNode(fragment);
                } else {
                    range.insertNode(document.createTextNode(text));
                }
            }
            selection.collapseToEnd();
        }
        syncWYSIWYGDebounced(previewElement, textarea, callback);
    });
}

function initWYSIWYGMode() {
    document.querySelectorAll('.prompt-wrapper').forEach(wrapper => {
        wrapper.classList.add('preview-mode');
    });

    setupWYSIWYG('client', promptPreviewByRole.client, systemPromptInput, (c) => syncContentToData('client', c));
    setupWYSIWYG('manager', promptPreviewByRole.manager, managerPromptInput, (c) => syncContentToData('manager', c));
    setupWYSIWYG('manager_call', promptPreviewByRole.manager_call, managerCallPromptInput, (c) => syncContentToData('manager_call', c));
    setupWYSIWYG('rater', promptPreviewByRole.rater, raterPromptInput, (c) => syncContentToData('rater', c));

    // Rehydrate visible editors after WYSIWYG init. In some browser/profile states
    // textareas are already populated, but previews stay blank until we repaint them.
    updateAllPreviews();
    updateEditorContent(getActiveRole());
}

// ============ DRAG & DROP ============

function handleFileDrop(file, textarea, previewElement) {
            const fileName = file.name.toLowerCase();
            
            if (fileName.endsWith('.docx')) {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                await ensureMammothLibrary();
                const result = await mammoth.convertToMarkdown({ arrayBuffer: event.target.result });
                const content = result.value;
                textarea.value = content;
                if (previewElement) {
                    previewElement.innerHTML = renderMarkdown(content);
                }
                textarea.dispatchEvent(new Event('input'));
                
                // Also sync to data
                const role = getActiveRole();
                syncContentToData(role, content);
                } catch (err) { alert('Ошибка чтения .docx'); }
                };
                reader.readAsArrayBuffer(file);
    } else if (fileName.endsWith('.rtf')) {
        const reader = new FileReader();
        reader.onload = (event) => {
            // Simple RTF to text conversion (strips RTF formatting)
            let content = event.target.result;
            content = content.replace(/\{\\rtf1[^}]*\}/g, '')
                .replace(/\\par\s*/g, '\n')
                .replace(/\\\w+\s?/g, '')
                .replace(/[{}]/g, '')
                .trim();
            textarea.value = content;
            if (previewElement) {
                previewElement.innerHTML = renderMarkdown(content);
            }
            textarea.dispatchEvent(new Event('input'));
            
            const role = getActiveRole();
            syncContentToData(role, content);
        };
        reader.readAsText(file, 'UTF-8');
    } else if (file.type.startsWith('text/') || TEXT_EXTENSIONS.some(ext => fileName.endsWith(ext))) {
                const reader = new FileReader();
                reader.onload = (event) => {
            const content = event.target.result;
            textarea.value = content;
            if (previewElement) {
                previewElement.innerHTML = renderMarkdown(content);
            }
            textarea.dispatchEvent(new Event('input'));
            
            const role = getActiveRole();
            syncContentToData(role, content);
                };
                reader.readAsText(file, 'UTF-8');
            } else {
        alert('Поддерживаемые форматы: .txt, .md, .docx, .rtf');
            }
        }

function setupDragAndDrop(textarea) {
    textarea.addEventListener('dragover', (e) => { 
        if (!isAdmin()) return;
        e.preventDefault(); 
        textarea.classList.add('drag-over'); 
    });
    textarea.addEventListener('dragleave', (e) => { 
        if (!isAdmin()) return;
        e.preventDefault(); 
        textarea.classList.remove('drag-over'); 
    });
    textarea.addEventListener('drop', (e) => {
        if (!isAdmin()) return;
        e.preventDefault();
        textarea.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileDrop(files[0], textarea, null);
        }
    });
}

function setupDragAndDropForPreview(previewElement, textarea) {
    previewElement.addEventListener('dragover', (e) => {
        if (!isAdmin()) return;
        e.preventDefault();
        previewElement.classList.add('drag-over');
    });
    previewElement.addEventListener('dragleave', (e) => {
        if (!isAdmin()) return;
        e.preventDefault();
        previewElement.classList.remove('drag-over');
    });
    previewElement.addEventListener('drop', (e) => {
        if (!isAdmin()) return;
        e.preventDefault();
        previewElement.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileDrop(files[0], textarea, previewElement);
        }
    });
}

// ============ EVENT LISTENERS ============

function handlePrimaryActionClick() {
    if (userInput.disabled || isProcessing || isDialogRated || isConversationClosed()) {
        return;
    }

    const hasText = !!userInput.value.trim();
    if (!hasText) {
        showVoiceModeModal();
        return;
    }

    sendMessage();
}

setVoiceModeScreenActive(false);
bindEvent(voiceModeExitBtn, 'click', hideVoiceModeModal);
bindEvent(voiceModeStopBtn, 'click', handleVoiceModeStopClick);
bindEvent(voiceModeRateBtn, 'click', handleVoiceModeRateClick);
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!voiceModeScreen || voiceModeScreen.hidden) return;
    hideVoiceModeModal();
});

bindEvent(sendBtn, 'click', handlePrimaryActionClick);
bindEvent(userInput, 'keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
bindEvent(userInput, 'input', () => {
    autoResizeTextarea(userInput);
    updateSendBtnState();
    });
bindEvent(clearChatBtn, 'click', () => { if (confirm('Очистить чат?')) clearChat(); });
bindEvent(startBtn, 'click', startConversationHandler);
bindEvent(rateChatBtn, 'click', rateChat);
bindEvent(aiAssistBtn, 'click', generateAIResponse);
if (exitAttestationBtn) {
    exitAttestationBtn.addEventListener('click', () => {
        setAttestationMode(false);
    });
}
if (startAttestationBtn) {
    startAttestationBtn.addEventListener('click', () => {
        if (!isChatReady) return;
        setAttestationMode(true);
    });
}

bindEvent(exportChatBtn, 'click', (e) => {
    e.stopPropagation();
    exportMenu?.classList.toggle('show');
    });

bindEvent(exportCurrentPromptBtn, 'click', (e) => {
    e.stopPropagation();
    exportPromptMenu?.classList.toggle('show');
});

document.addEventListener('click', () => {
    exportMenu?.classList.remove('show');
    exportPromptMenu?.classList.remove('show');
    exportChatSettingsMenu?.classList.remove('show');
    exportPromptSettingsMenu?.classList.remove('show');
});

document.querySelectorAll('.dropdown-item[data-format]').forEach(item => {
    item.addEventListener('click', (e) => {
        const format = e.target.closest('.dropdown-item')?.dataset.format;
        if (format) exportChat(format);
            });
});

document.querySelectorAll('.dropdown-item[data-prompt-format]').forEach(item => {
    item.addEventListener('click', (e) => {
        const format = e.target.closest('.dropdown-item')?.dataset.promptFormat;
        if (format) exportCurrentPrompt(format);
    });
});

// Instruction tabs
instructionTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const instructionType = tab.dataset.instruction;
        // Save current editor content before switching
        syncCurrentEditorNow();
        
        instructionTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        instructionEditors.forEach(editor => {
            editor.classList.remove('active');
            if (editor.dataset.instruction === instructionType) {
                editor.classList.add('active');
            }
        });
        
        // Sync select and custom dropdown with tabs
        if (instructionSelectEl) {
            instructionSelectEl.value = instructionType;
        }
        
        if (selectedInstructionText) {
            const tabText = tab.innerText;
            selectedInstructionText.innerText = tabText;
        }
        
        instructionOptions.forEach(opt => {
            opt.classList.toggle('active', opt.dataset.value === instructionType);
        });
        
        renderVariations();
        updatePreview();
    });
});

// Instruction dropdown for compact mode (custom implementation)
if (instructionDropdown) {
    // Toggle dropdown
    instructionDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
        instructionDropdown.classList.toggle('active');
    });

    // Option selection
    instructionOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            syncCurrentEditorNow();
            
            const instructionType = option.dataset.value;
            const instructionName = option.innerText;
            
            // Update UI
            selectedInstructionText.innerText = instructionName;
            instructionOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            instructionDropdown.classList.remove('active');
            
            // Sync with tabs
            instructionTabs.forEach(t => t.classList.remove('active'));
            const activeTab = document.querySelector(`.instruction-tab[data-instruction="${instructionType}"]`);
            if (activeTab) activeTab.classList.add('active');
            
            // Sync with hidden select
            if (instructionSelectEl) instructionSelectEl.value = instructionType;
            
            // Switch content
            instructionEditors.forEach(editor => {
                editor.classList.remove('active');
                if (editor.dataset.instruction === instructionType) {
                    editor.classList.add('active');
                }
            });
            
            renderVariations();
            updatePreview();
        });
    });

    // Close dropdown on click outside
    document.addEventListener('click', () => {
        instructionDropdown.classList.remove('active');
    });
}

// Check if tabs need compact mode
let compactTabsState = null;
let compactToolbarState = null;
function checkTabsCompactMode() {
    if (!instructionsPanelElement) return;
    
    const panelWidth = instructionsPanelElement.getBoundingClientRect().width;
    const shouldCompactTabs = panelWidth < 420;
    const shouldCompactToolbar = panelWidth < 560;
    
    // При ширине панели меньше 420px - включаем компактный режим
    if (compactTabsState !== shouldCompactTabs) {
        instructionsPanelElement.classList.toggle('compact-tabs', shouldCompactTabs);
        compactTabsState = shouldCompactTabs;
    }
    // Для узкой правой панели адаптируем и toolbar форматирования
    if (compactToolbarState !== shouldCompactToolbar) {
        instructionsPanelElement.classList.toggle('compact-toolbar', shouldCompactToolbar);
        compactToolbarState = shouldCompactToolbar;
    }
}

// Also check on panel resize via ResizeObserver
if (typeof ResizeObserver !== 'undefined' && instructionsPanelElement) {
    const resizeObserver = new ResizeObserver(() => {
        checkTabsCompactMode();
    });
    resizeObserver.observe(instructionsPanelElement);
}

// Run on load and resize
checkTabsCompactMode();
window.addEventListener('resize', debounce(checkTabsCompactMode, 100));

// Textarea input listeners for sync
[systemPromptInput, managerPromptInput, managerCallPromptInput, raterPromptInput].forEach(input => {
    if (!input) return;
    input.addEventListener('input', () => {
        const wrapper = input.closest('.prompt-wrapper');
        const role = wrapper?.dataset.instruction || '';
        beginPromptEditing(role);
        if (wrapper) {
            syncContentToData(role, input.value);
        }
        schedulePromptEditingEnd(role, 2000);
    });
    
    input.addEventListener('focus', () => {
        const role = input.closest('.prompt-wrapper')?.dataset.instruction || '';
        beginPromptEditing(role);
    });
    
    input.addEventListener('blur', () => {
        setTimeout(() => {
            const wrapper = input.closest('.prompt-wrapper');
            const role = wrapper?.dataset.instruction;
            if (role) {
                checkpointPromptHistory(role);
            }
            endPromptEditing(role);
        }, 500);
    });
});

// Resize panels
const resizeHandle1 = document.getElementById('resizeHandle1');
const chatPanel = document.getElementById('chatPanel');
const instructionsPanel = instructionsPanelElement;
let isResizing = false;
let resizeContainerLeft = 0;
let resizeContainerWidth = 0;
let resizeClientX = 0;
let resizeFrameId = 0;

function applyPanelResize() {
    resizeFrameId = 0;
    if (!isResizing || !chatPanel || !instructionsPanel || !resizeContainerWidth) return;

    const relativeX = resizeClientX - resizeContainerLeft;
    const safeX = Math.max(0, Math.min(relativeX, resizeContainerWidth));
    const chatWidth = (safeX / resizeContainerWidth) * 100;
    const instructionsWidth = resizeContainerWidth - safeX;

    // Минимальная ширина панели инструкций 320px
    if (chatWidth >= 25 && chatWidth <= 75 && instructionsWidth >= 320) {
        chatPanel.style.flex = `0 0 ${chatWidth}%`;
        instructionsPanel.style.flex = `0 0 ${100 - chatWidth - 1}%`;
        checkTabsCompactMode();
    }
}

resizeHandle1.addEventListener('mousedown', (e) => {
    if (!panelsContainer) return;
    isResizing = true;
    const rect = panelsContainer.getBoundingClientRect();
    resizeContainerLeft = rect.left;
    resizeContainerWidth = rect.width;
    resizeClientX = e.clientX;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    resizeClientX = e.clientX;
    if (!resizeFrameId) {
        resizeFrameId = requestAnimationFrame(applyPanelResize);
    }
});

document.addEventListener('mouseup', () => {
    if (isResizing) {
        isResizing = false;
        if (resizeFrameId) {
            cancelAnimationFrame(resizeFrameId);
            resizeFrameId = 0;
        }
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }
});

// Speech Recognition
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        isSpeechRecognitionAvailable = false;
        voiceBtn.style.display = 'none';
        updateSendBtnState();
        return;
    }
    isSpeechRecognitionAvailable = true;
    
    recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onstart = () => { isRecording = true; voiceBtn.classList.add('recording'); };
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        userInput.value += (userInput.value ? ' ' : '') + transcript;
        autoResizeTextarea(userInput);
        updateSendBtnState();
    };
    recognition.onerror = () => stopRecording();
    recognition.onend = () => stopRecording();
    updateSendBtnState();
}

function stopRecording() {
    if (recognition && isRecording) recognition.stop();
    isRecording = false;
    voiceBtn.classList.remove('recording');
    updateSendBtnState();
}

voiceBtn.addEventListener('click', () => {
    if (isRecording) stopRecording();
    else if (recognition) recognition.start();
});

// Mobile tabs
const mobileTabs = document.querySelectorAll('.mobile-tab');
const panels = document.querySelectorAll('.panel');

mobileTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const panelName = tab.dataset.panel;
        mobileTabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.querySelector(`.panel[data-panel="${panelName}"]`)?.classList.add('active');
    });
});

if (window.innerWidth <= 1024) {
    panels.forEach(p => p.classList.remove('active'));
    document.querySelector('.panel[data-panel="chat"]')?.classList.add('active');
}

function isSelectionInsideTag(preview, tagName) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    let node = selection.anchorNode;
    if (!node) return false;
    if (node.nodeType === Node.TEXT_NODE) {
        node = node.parentElement;
    }
    if (!node || !(node instanceof Element)) return false;
    const match = node.closest(tagName);
    return !!match && preview.contains(match);
}

function ensureSelectionInPreview(preview) {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
        if (element instanceof Element && preview.contains(element)) {
            return true;
        }
    }
    preview.focus();
    const range = document.createRange();
    range.selectNodeContents(preview);
    range.collapse(false);
    const nextSelection = window.getSelection();
    if (!nextSelection) return false;
    nextSelection.removeAllRanges();
    nextSelection.addRange(range);
    return true;
}

function execFormatBlock(tagName) {
    const normalized = String(tagName || '').toUpperCase();
    const candidates = [`<${normalized}>`, normalized, normalized.toLowerCase()];
    for (const candidate of candidates) {
        try {
            if (document.execCommand('formatBlock', false, candidate)) {
                return true;
            }
        } catch (error) {
            // noop
        }
    }
    return false;
}

function toggleHeadingFormat(preview, level) {
    const tagName = `h${level}`;
    ensureSelectionInPreview(preview);
    if (isSelectionInsideTag(preview, tagName)) {
        execFormatBlock('p');
        return;
    }
    execFormatBlock(tagName);
}

// Toolbar
document.querySelectorAll('.toolbar-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const action = btn.dataset.action;
        const preview = document.querySelector('.instruction-editor.active .prompt-preview');
    if (!preview) return;
    preview.focus();
    
        if (action === 'bold') document.execCommand('bold', false, null);
        else if (action === 'italic') document.execCommand('italic', false, null);
        else if (action === 'strike') document.execCommand('strikeThrough', false, null);
        else if (action === 'ul') document.execCommand('insertUnorderedList', false, null);
        else if (action === 'ol') document.execCommand('insertOrderedList', false, null);
        else if (action === 'h1') toggleHeadingFormat(preview, 1);
        else if (action === 'h2') toggleHeadingFormat(preview, 2);
        else if (action === 'h3') toggleHeadingFormat(preview, 3);
        else if (action === 'quote') {
            if (isSelectionInsideTag(preview, 'blockquote')) {
                const removed = document.execCommand('outdent', false, null);
                if (!removed) {
                    execFormatBlock('p');
                }
            } else {
                execFormatBlock('blockquote');
            }
        }
        else if (action === 'hr') document.execCommand('insertHorizontalRule', false, null);
    });
});
                
// Cloud save button - REMOVED
// Autosave is handled by debounce logic

function installLocalhostTestHooks() {
    if (!isLocalhostAdminPreviewHost()) return;

    window.__CLIENT_SIMULATOR_TEST_HOOKS__ = {
        getPublicPromptsSnapshot() {
            return JSON.parse(JSON.stringify(buildPromptsSyncPayload(PROMPT_ROLES)));
        },
        simulateRemotePromptsSnapshot(nextSnapshot = {}) {
            const promptSnapshotState = buildNormalizedPromptSnapshotState(nextSnapshot && typeof nextSnapshot === 'object' ? nextSnapshot : {});
            const data = promptSnapshotState.normalized;
            lastPromptsFirebaseSnapshot = data;
            lastPromptsFirebaseSnapshotState = promptSnapshotState;

            if (isUserEditing) {
                pendingPromptsFirebaseSnapshot = data;
                pendingPromptsFirebaseSnapshotState = promptSnapshotState;
                lastFirebaseData = promptSnapshotState.hash;
                return { deferred: true };
            }

            if (lastFirebaseData === promptSnapshotState.hash) {
                return { deferred: false, skipped: 'unchanged' };
            }

            lastFirebaseData = promptSnapshotState.hash;
            pendingPromptsFirebaseSnapshot = null;
            pendingPromptsFirebaseSnapshotState = null;
            const didApply = initPromptsData(data, { forceApplyEmpty: true });
            return { deferred: false, didApply };
        },
        forceEndPromptEditing(role = '') {
            syncCurrentEditorNow(role || getActiveRole());
            endPromptEditing(role || getActiveRole());
            return true;
        },
        forceBeginPromptEditing(role = '') {
            beginPromptEditing(role || getActiveRole());
            return true;
        },
        getPromptUiState(role = getActiveRole()) {
            const activeVariation = getActiveVariation(role);
            const visibleVariations = getVisibleVariations(role, isAdmin()).map((variation) => ({
                id: variation.id,
                name: getPromptVariationDisplayName(variation),
                isLocal: !!variation.isLocal
            }));
            return {
                role,
                selectedRole,
                isAdminView: isAdmin(),
                activeId: activeVariation?.id || null,
                activeName: activeVariation ? getPromptVariationDisplayName(activeVariation) : '',
                activeIsLocal: !!activeVariation?.isLocal,
                activeContent: getActiveContent(role),
                visibleVariations,
                conflictMessage: String(promptSyncConflictMessages[role] || ''),
                hiddenClientPrompt: getConfiguredClientConversationActionPrompt()
            };
        }
    };
}

// ============ INITIALIZATION ============

setChatLoadingState(true);
installLocalhostTestHooks();
loadAttestationQueue();
loadPrompts()
    .catch((error) => {
        console.error('Initialization auth/prompts error:', error);
        showNameModal();
    })
    .finally(() => {
        isAppBootstrapped = true;
        updateChatReadyState();
    });
initSpeechRecognition();
autoResizeTextarea(userInput);
prepareCustomTooltips();
initCustomTooltipLayer();
document.addEventListener('readystatechange', syncWindowReadyState);
window.addEventListener('load', () => {
    isWindowLoaded = true;
    updateChatReadyState();
});
window.addEventListener('pageshow', () => {
    currentUserPageExitHandled = false;
    isWindowLoaded = true;
    updateChatReadyState();
});
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (pendingPromptsFirebaseSnapshot === null && pendingPromptOverridesRemoteStore === null) return;
    try {
        syncCurrentEditorNow(getActiveRole());
        endPromptEditing(getActiveRole());
    } catch (e) {
        console.warn('Deferred prompt state flush on visibility failed:', e);
    }
});
queueMicrotask(syncWindowReadyState);
setTimeout(syncWindowReadyState, 0);

if (attestationQueue.length > 0) {
    scheduleAttestationQueueRetry(600);
}

window.addEventListener('online', () => {
    if (!attestationQueue.length) return;
    showCopyNotification('Связь восстановлена. Повторяю отправку отчетов...');
    flushAttestationQueue();
});

setupDragAndDrop(systemPromptInput);
setupDragAndDrop(managerPromptInput);
setupDragAndDrop(managerCallPromptInput);
setupDragAndDrop(raterPromptInput);

// Setup drag and drop for preview elements (WYSIWYG mode)
setupDragAndDropForPreview(promptPreviewByRole.client, systemPromptInput);
setupDragAndDropForPreview(promptPreviewByRole.manager, managerPromptInput);
setupDragAndDropForPreview(promptPreviewByRole.manager_call, managerCallPromptInput);
setupDragAndDropForPreview(promptPreviewByRole.rater, raterPromptInput);

        setTimeout(() => {
    initWYSIWYGMode();
    renderVariations();
    updateAllPreviews();
    updateEditorContent(getActiveRole());
}, 200);
