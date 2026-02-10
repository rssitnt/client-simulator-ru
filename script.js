import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set, get, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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
const WEBHOOK_URL = 'https://n8n-api.tradicia-k.ru/webhook/client-simulator';
const RATE_WEBHOOK_URL = 'https://n8n-api.tradicia-k.ru/webhook/rate-manager';
const ATTESTATION_WEBHOOK_URL = 'https://n8n-api.tradicia-k.ru/webhook/certification';
const MANAGER_ASSISTANT_WEBHOOK_URL = 'https://n8n-api.tradicia-k.ru/webhook/manager-simulator';
const AI_IMPROVE_WEBHOOK_URL = 'https://n8n-api.tradicia-k.ru/webhook/prompt-enchancement';
const GEMINI_LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
const GEMINI_LIVE_API_KEY_STORAGE_KEY = 'geminiLiveApiKey';
const GEMINI_LIVE_TOKEN_ENDPOINT_STORAGE_KEY = 'geminiLiveTokenEndpoint';
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
const PARTNER_INVITES_DB_PATH = 'partner_invites';
const AUTH_LOCAL_STORAGE_KEY = 'authUsers:v1';
const PARTNER_INVITES_STORAGE_KEY = 'partnerInvites:v1';
const AUTH_SESSION_STORAGE_KEY = 'authSession:v1';
const EMAIL_LINK_CONTEXT_STORAGE_KEY = 'emailLinkContext:v1';
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
const MAX_FAILED_PASSWORD_ATTEMPTS = 15;
const ACTIVE_IDLE_TIMEOUT_MS = 60000;
const ACTIVE_TICK_MS = 5000;
const ACTIVE_FLUSH_MS = 15000;

const RATER_PROMPT_VERSION = '2025-01-30';
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

function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
}

// Generate unique session ID
let baseSessionId = localStorage.getItem('sessionId') || generateSessionId();
let clientSessionId = '';
let managerSessionId = '';
let raterSessionId = '';

function refreshSessionIds(sessionId = baseSessionId) {
    baseSessionId = String(sessionId || generateSessionId());
    localStorage.setItem('sessionId', baseSessionId);
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
async function fetchWithTimeout(url, options = {}, timeoutMs = 300000) {
    const requestUrl = typeof url === 'string' ? url : String(url?.url || url || '');
    debugLog(`[Fetch] Starting request to: ${requestUrl.slice(0, 50)}... with timeout: ${timeoutMs/1000}s`);
    const startTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
            throw new Error(`Таймаут запроса (${timeoutMs/1000}с). Проверьте n8n workflow.`);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

function buildRequestId(prefix = 'req') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildJsonRequestHeaders(requestId, scope = 'request') {
    const headers = { 'Content-Type': 'application/json' };
    if (requestId) {
        headers['X-Request-Id'] = requestId;
        headers['X-Idempotency-Key'] = `${scope}:${requestId}`;
    }
    return headers;
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
const modalNameInput = document.getElementById('modalNameInput');
const modalLoginInput = document.getElementById('modalLoginInput');
const modalNameSubmit = document.getElementById('modalNameSubmit');
const nameModalStep1 = document.getElementById('nameModalStep1');
const modalPasswordInput = document.getElementById('modalPasswordInput');
const togglePasswordVisibilityBtn = document.getElementById('togglePasswordVisibility');
const authErrorText = document.getElementById('passwordError');
const promptVariationsContainer = document.getElementById('promptVariations');
const promptLengthInfo = document.getElementById('promptLengthInfo');

// AI Improve Modal Elements
const aiImproveBtn = document.getElementById('aiImproveBtn');
const promptHistoryBtn = document.getElementById('promptHistoryBtn');
const aiImproveModal = document.getElementById('aiImproveModal');
const aiImproveModalClose = document.getElementById('aiImproveModalClose');
const aiImproveModalTitle = document.getElementById('aiImproveModalTitle');
const aiImproveModalDescription = document.getElementById('aiImproveModalDescription');
const promptHistoryModal = document.getElementById('promptHistoryModal');
const promptHistoryModalClose = document.getElementById('promptHistoryModalClose');
const promptHistoryTitle = document.getElementById('promptHistoryTitle');
const promptHistoryList = document.getElementById('promptHistoryList');
const voiceModeModal = document.getElementById('voiceModeModal');
const voiceModeModalClose = document.getElementById('voiceModeModalClose');
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
const saveVoiceConfigBtn = document.getElementById('saveVoiceConfigBtn');
const clearVoiceConfigBtn = document.getElementById('clearVoiceConfigBtn');
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

let pendingImprovedPrompt = null;
let pendingRole = null;
let pendingName = null;
let pendingVariationId = null;
let pendingRatingImproveContext = null;
let aiImproveMode = 'default';
const LOCAL_PROMPTS_STORAGE_VERSION = 'v2';
const HISTORY_LIMIT = 50;
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
let isProcessing = false;
let lastRating = null;
let isDialogRated = false;
let isUserEditing = false;
let lastFirebaseData = null;
let selectedRole = 'user';
let currentUser = null;
const ADMIN_PASSWORD = '1357246';
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
let reratePromptElement = null;
let attestationQueue = [];
let isAttestationQueueFlushInProgress = false;
let attestationQueueRetryTimer = null;
let activeTickTimerId = null;
let pendingActiveMs = 0;
let lastActiveTickAt = Date.now();
let lastUserActivityAt = Date.now();
let hasActivityListeners = false;
let fioSaveTimeout = null;
let publicActiveIds = {
    client: null,
    manager: null,
    manager_call: null,
    rater: null
};
const PROMPT_ROLES = ['client', 'manager', 'manager_call', 'rater'];
const ATTESTATION_PROMPT_ROLES = ['client', 'manager', 'rater'];
const GEMINI_TEXT_MAX_TOKENS = 1000000;
const APPROX_CHARS_PER_TOKEN = 4;
const GEMINI_TEXT_MAX_CHARS_ESTIMATE = GEMINI_TEXT_MAX_TOKENS * APPROX_CHARS_PER_TOKEN;
const PROMPT_MAX_CHARS_BY_ROLE = {
    client: GEMINI_TEXT_MAX_CHARS_ESTIMATE,
    manager: GEMINI_TEXT_MAX_CHARS_ESTIMATE,
    manager_call: GEMINI_TEXT_MAX_CHARS_ESTIMATE,
    rater: GEMINI_TEXT_MAX_CHARS_ESTIMATE
};

// Prompt Variations Data
let promptsData = {
    client: { variations: [], activeId: null },
    manager: { variations: [], activeId: null },
    manager_call: { variations: [], activeId: null },
    rater: { variations: [], activeId: null }
};

function normalizeFio(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
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
    return value === 'admin' ? 'admin' : 'user';
}

function getRoleLabelUi(role) {
    if (role === 'admin') return 'Админ';
    return 'Юзер';
}

function getRoleIcon(role) {
    if (role === 'admin') return '🔑';
    return '👤';
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

function setAuthSession(login) {
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify({
        login: normalizeLogin(login),
        signedAt: new Date().toISOString()
    }));
}

function getAuthSession() {
    try {
        const raw = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed.login === 'string' ? parsed : null;
    } catch (error) {
        return null;
    }
}

function clearAuthSession() {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
}

function loadLocalUsersStore() {
    try {
        const raw = localStorage.getItem(AUTH_LOCAL_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        return {};
    }
}

function saveLocalUsersStore(store) {
    try {
        localStorage.setItem(AUTH_LOCAL_STORAGE_KEY, JSON.stringify(store || {}));
    } catch (error) {
        console.error('Failed to persist local auth store:', error);
    }
}

function loadLocalPartnerInvitesStore() {
    try {
        const raw = localStorage.getItem(PARTNER_INVITES_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        return {};
    }
}

function saveLocalPartnerInvitesStore(store) {
    try {
        localStorage.setItem(PARTNER_INVITES_STORAGE_KEY, JSON.stringify(store || {}));
    } catch (error) {
        console.error('Failed to persist local partner invites store:', error);
    }
}

function saveEmailLinkContext(context) {
    try {
        localStorage.setItem(EMAIL_LINK_CONTEXT_STORAGE_KEY, JSON.stringify(context || {}));
    } catch (error) {}
}

function getEmailLinkContext() {
    try {
        const raw = localStorage.getItem(EMAIL_LINK_CONTEXT_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
        return null;
    }
}

function clearEmailLinkContext() {
    localStorage.removeItem(EMAIL_LINK_CONTEXT_STORAGE_KEY);
}

function getAppBaseUrl() {
    return `${window.location.origin}${window.location.pathname}`;
}

function getEmailFromCurrentLink(rawUrl = window.location.href) {
    const readFromUrl = (urlValue) => {
        try {
            const parsedUrl = new URL(urlValue);
            const candidates = [
                parsedUrl.searchParams.get('email'),
                parsedUrl.searchParams.get('invited_email'),
                parsedUrl.searchParams.get('login')
            ];
            const email = candidates.map(normalizeLogin).find(isValidLogin);
            if (email) return email;
            const continueUrl = parsedUrl.searchParams.get('continueUrl');
            if (!continueUrl) return null;
            const decodedContinue = decodeURIComponent(continueUrl);
            const continueParsed = new URL(decodedContinue);
            const nestedCandidates = [
                continueParsed.searchParams.get('email'),
                continueParsed.searchParams.get('invited_email'),
                continueParsed.searchParams.get('login')
            ];
            return nestedCandidates.map(normalizeLogin).find(isValidLogin) || null;
        } catch (error) {
            return null;
        }
    };

    const fromUrl = readFromUrl(rawUrl);
    if (fromUrl) return fromUrl;
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
    if (code === 'auth/unauthorized-domain') {
        return 'Домен сайта не разрешен в Firebase Auth. Добавьте текущий домен в Authorized domains.';
    }
    if (code === 'auth/invalid-email') {
        return 'Укажите корректный email.';
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

    await sendSignInLinkToEmail(auth, normalizedEmail, actionCodeSettings);
    saveEmailLinkContext({
        email: normalizedEmail,
        purpose,
        sentAt: new Date().toISOString()
    });
}

function normalizePartnerInvite(raw, loginFallback = '') {
    if (!raw || typeof raw !== 'object') return null;
    const login = normalizeLogin(raw.login || raw.email || loginFallback);
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

    if (db) {
        try {
            const snapshot = await get(ref(db, `${PARTNER_INVITES_DB_PATH}/${key}`));
            if (snapshot.exists()) {
                return normalizePartnerInvite(snapshot.val(), normalizedLogin);
            }
        } catch (error) {
            console.error('Failed to load partner invite from Firebase:', error);
        }
    }

    const localStore = loadLocalPartnerInvitesStore();
    return normalizePartnerInvite(localStore[key], normalizedLogin);
}

async function savePartnerInvite(invite) {
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

    if (db) {
        try {
            await set(ref(db, `${PARTNER_INVITES_DB_PATH}/${key}`), payload);
        } catch (error) {
            console.error('Failed to save partner invite to Firebase:', error);
        }
    }

    const localStore = loadLocalPartnerInvitesStore();
    localStore[key] = payload;
    saveLocalPartnerInvitesStore(localStore);
    return payload;
}

async function patchPartnerInvite(login, patch = {}) {
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

    if (db) {
        try {
            await update(ref(db, `${PARTNER_INVITES_DB_PATH}/${key}`), sanitizedPatch);
        } catch (error) {
            console.error('Failed to patch partner invite in Firebase:', error);
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

async function listPartnerInvites() {
    if (db) {
        try {
            const snapshot = await get(ref(db, PARTNER_INVITES_DB_PATH));
            if (snapshot.exists()) {
                const raw = snapshot.val();
                const invites = Object.values(raw || {})
                    .map((item) => normalizePartnerInvite(item))
                    .filter(Boolean)
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
                if (invites.length > 0) {
                    return invites;
                }
            }
        } catch (error) {
            console.error('Failed to load partner invites from Firebase:', error);
        }
    }

    const localStore = loadLocalPartnerInvitesStore();
    return Object.values(localStore || {})
        .map((item) => normalizePartnerInvite(item))
        .filter(Boolean)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function resolveAccessPolicy(login, userRecord = null) {
    const normalizedLogin = normalizeLogin(login);
    if (!isValidLogin(normalizedLogin)) return null;

    if (userRecord?.role === 'admin') {
        return { type: 'admin', role: 'admin', invite: null };
    }

    if (isCorporateEmail(normalizedLogin)) {
        return { type: 'corporate', role: 'user', invite: null };
    }

    const invite = await getPartnerInviteByLogin(normalizedLogin);
    if (isPartnerInviteActive(invite)) {
        return {
            type: 'partner',
            role: 'user',
            invite
        };
    }

    return null;
}

async function consumeEmailVerificationLinkIfPresent() {
    if (!auth) return;
    if (!isSignInWithEmailLink(auth, window.location.href)) return;

    const login = getEmailFromCurrentLink(window.location.href);
    if (!isValidLogin(login)) {
        setAuthError('Не удалось определить email из ссылки подтверждения.');
        cleanupEmailLinkUrl();
        clearEmailLinkContext();
        return;
    }

    try {
        await signInWithEmailLink(auth, login, window.location.href);
        const nowIso = new Date().toISOString();

        const existingUser = await getUserRecordByLogin(login);
        if (existingUser) {
            await patchUserRecord(login, {
                emailVerifiedAt: nowIso,
                lastSeenAt: nowIso
            });
        }

        const invite = await getPartnerInviteByLogin(login);
        if (invite) {
            await patchPartnerInvite(login, {
                emailVerifiedAt: nowIso
            });
        }

        showCopyNotification('Email подтвержден. Теперь войдите с паролем.');
        setAuthError('Email подтвержден. Введите пароль для входа.');
        if (modalLoginInput) {
            modalLoginInput.value = login;
        }
    } catch (error) {
        console.error('Email link verification error:', error);
        setAuthError(getReadableFirebaseAuthError(error, 'consume_link'));
    } finally {
        clearEmailLinkContext();
        cleanupEmailLinkUrl();
        if (auth) {
            signOut(auth).catch(() => {});
        }
    }
}

async function hashPassword(login, password) {
    const normalizedLogin = normalizeLogin(login);
    const value = `${normalizedLogin}::${String(password || '')}`;
    try {
        if (window.crypto?.subtle && typeof TextEncoder !== 'undefined') {
            const data = new TextEncoder().encode(value);
            const digest = await window.crypto.subtle.digest('SHA-256', data);
            return Array.from(new Uint8Array(digest))
                .map((b) => b.toString(16).padStart(2, '0'))
                .join('');
        }
    } catch (error) {
        console.warn('crypto.subtle hash failed, fallback used', error);
    }
    return btoa(unescape(encodeURIComponent(value)));
}

function normalizeUserRecord(raw, loginFallback = '') {
    if (!raw || typeof raw !== 'object') return null;
    const login = normalizeLogin(raw.login || loginFallback);
    if (!isValidLogin(login)) return null;
    const failedLoginAttempts = Math.max(0, Number(raw.failedLoginAttempts) || 0);
    const isBlocked = !!raw.isBlocked;
    return {
        login,
        fio: normalizeFio(raw.fio || ''),
        role: normalizeRole(raw.role),
        passwordHash: String(raw.passwordHash || ''),
        emailVerifiedAt: raw.emailVerifiedAt || null,
        emailVerificationSentAt: raw.emailVerificationSentAt || null,
        failedLoginAttempts,
        isBlocked,
        blockedAt: isBlocked ? (raw.blockedAt || new Date().toISOString()) : null,
        createdAt: raw.createdAt || new Date().toISOString(),
        lastLoginAt: raw.lastLoginAt || null,
        lastSeenAt: raw.lastSeenAt || null,
        activeMs: Number.isFinite(raw.activeMs) ? Math.max(0, Number(raw.activeMs)) : 0
    };
}

async function getUserRecordByLogin(login) {
    const normalizedLogin = normalizeLogin(login);
    if (!normalizedLogin) return null;
    const key = loginToStorageKey(normalizedLogin);

    if (db) {
        try {
            const snapshot = await get(ref(db, `${AUTH_USERS_DB_PATH}/${key}`));
            if (snapshot.exists()) {
                const record = normalizeUserRecord(snapshot.val(), normalizedLogin);
                if (record) return record;
            }
        } catch (error) {
            console.error('Failed to load user from Firebase:', error);
        }
    }

    const localStore = loadLocalUsersStore();
    return normalizeUserRecord(localStore[key], normalizedLogin);
}

async function saveUserRecord(record) {
    const normalized = normalizeUserRecord(record, record?.login);
    if (!normalized) throw new Error('Invalid user record');
    const key = loginToStorageKey(normalized.login);
    const payload = {
        login: normalized.login,
        fio: normalized.fio,
        role: normalized.role,
        passwordHash: normalized.passwordHash,
        emailVerifiedAt: normalized.emailVerifiedAt,
        emailVerificationSentAt: normalized.emailVerificationSentAt,
        failedLoginAttempts: normalized.failedLoginAttempts,
        isBlocked: normalized.isBlocked,
        blockedAt: normalized.blockedAt,
        createdAt: normalized.createdAt,
        lastLoginAt: normalized.lastLoginAt,
        lastSeenAt: normalized.lastSeenAt,
        activeMs: normalized.activeMs
    };

    if (db) {
        try {
            await set(ref(db, `${AUTH_USERS_DB_PATH}/${key}`), payload);
        } catch (error) {
            console.error('Failed to save user to Firebase:', error);
        }
    }

    const localStore = loadLocalUsersStore();
    localStore[key] = payload;
    saveLocalUsersStore(localStore);
    return payload;
}

async function patchUserRecord(login, patch = {}) {
    const normalizedLogin = normalizeLogin(login);
    if (!normalizedLogin) return null;
    const key = loginToStorageKey(normalizedLogin);
    const sanitizedPatch = { ...patch };
    if (Object.prototype.hasOwnProperty.call(sanitizedPatch, 'fio')) {
        sanitizedPatch.fio = normalizeFio(sanitizedPatch.fio);
    }
    if (Object.prototype.hasOwnProperty.call(sanitizedPatch, 'role')) {
        sanitizedPatch.role = normalizeRole(sanitizedPatch.role);
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
    if (Object.prototype.hasOwnProperty.call(sanitizedPatch, 'failedLoginAttempts')) {
        sanitizedPatch.failedLoginAttempts = Math.max(0, Number(sanitizedPatch.failedLoginAttempts) || 0);
    }
    if (Object.prototype.hasOwnProperty.call(sanitizedPatch, 'isBlocked')) {
        sanitizedPatch.isBlocked = !!sanitizedPatch.isBlocked;
    }
    if (Object.prototype.hasOwnProperty.call(sanitizedPatch, 'blockedAt')) {
        sanitizedPatch.blockedAt = sanitizedPatch.blockedAt || null;
    }

    if (db) {
        try {
            await update(ref(db, `${AUTH_USERS_DB_PATH}/${key}`), sanitizedPatch);
        } catch (error) {
            console.error('Failed to patch user in Firebase:', error);
        }
    }

    const localStore = loadLocalUsersStore();
    const merged = {
        ...(localStore[key] || { login: normalizedLogin, role: 'user', activeMs: 0 }),
        ...sanitizedPatch,
        login: normalizedLogin
    };
    localStore[key] = merged;
    saveLocalUsersStore(localStore);
    return normalizeUserRecord(merged, normalizedLogin);
}

async function listAllUserRecords() {
    if (db) {
        try {
            const snapshot = await get(ref(db, AUTH_USERS_DB_PATH));
            if (snapshot.exists()) {
                const raw = snapshot.val();
                const records = Object.values(raw || {})
                    .map((item) => normalizeUserRecord(item))
                    .filter(Boolean);
                if (records.length > 0) {
                    return records.sort((a, b) => a.login.localeCompare(b.login));
                }
            }
        } catch (error) {
            console.error('Failed to load users list from Firebase:', error);
        }
    }

    const localStore = loadLocalUsersStore();
    return Object.values(localStore || {})
        .map((item) => normalizeUserRecord(item))
        .filter(Boolean)
        .sort((a, b) => a.login.localeCompare(b.login));
}

function applyAuthenticatedUser(user) {
    const normalized = normalizeUserRecord(user, user?.login);
    if (!normalized) return;

    currentUser = normalized;
    selectedRole = normalized.role;
    localStorage.setItem(USER_ROLE_KEY, normalized.role);
    localStorage.setItem(USER_NAME_KEY, normalized.fio);
    localStorage.setItem(USER_LOGIN_KEY, normalized.login);
    managerNameInput.value = normalized.fio;

    if (currentRoleDisplay) {
        currentRoleDisplay.textContent = getRoleLabelUi(normalized.role);
    }
    if (settingsNameInput) {
        settingsNameInput.value = normalized.fio;
    }
    if (accountLoginValue) {
        accountLoginValue.textContent = normalized.login;
    }

    updateUserNameDisplay();
    applyRoleRestrictions();
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

function markUserActivity() {
    lastUserActivityAt = Date.now();
}

function initUserActivityTrackingListeners() {
    if (hasActivityListeners) return;
    hasActivityListeners = true;

    const activityEvents = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart', 'wheel'];
    activityEvents.forEach((eventName) => {
        window.addEventListener(eventName, markUserActivity, { passive: true });
    });
    window.addEventListener('focus', markUserActivity);
    document.addEventListener('visibilitychange', () => {
        markUserActivity();
        if (document.visibilityState !== 'visible') {
            flushActiveTime(true);
        }
    });
    window.addEventListener('beforeunload', () => {
        flushActiveTime(true);
    });
    window.addEventListener('pagehide', () => {
        flushActiveTime(true);
    });
}

function isUserCurrentlyActive() {
    if (!currentUser) return false;
    if (document.visibilityState !== 'visible') return false;
    if (!document.hasFocus()) return false;
    return Date.now() - lastUserActivityAt <= ACTIVE_IDLE_TIMEOUT_MS;
}

async function flushActiveTime(force = false) {
    if (!currentUser) return;
    if (!force && pendingActiveMs < ACTIVE_FLUSH_MS) return;
    if (pendingActiveMs <= 0) return;

    const increment = Math.max(0, Math.round(pendingActiveMs));
    pendingActiveMs = 0;
    currentUser.activeMs = Math.max(0, Number(currentUser.activeMs) + increment);

    if (isAdmin() && adminPanelAccordion?.style.display !== 'none') {
        renderAdminUsersTable();
    }
    await patchUserRecord(currentUser.login, {
        activeMs: currentUser.activeMs,
        lastSeenAt: new Date().toISOString()
    });
}

function startActiveTimeTracking() {
    initUserActivityTrackingListeners();
    lastUserActivityAt = Date.now();
    lastActiveTickAt = Date.now();
    pendingActiveMs = 0;

    if (activeTickTimerId) {
        clearInterval(activeTickTimerId);
        activeTickTimerId = null;
    }

    activeTickTimerId = setInterval(() => {
        const now = Date.now();
        const delta = now - lastActiveTickAt;
        lastActiveTickAt = now;
        if (!isUserCurrentlyActive()) return;
        pendingActiveMs += delta;
        flushActiveTime(false);
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

function formatInviteExpiry(iso) {
    if (!iso) return 'Без срока';
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime())) return 'Без срока';
    return date.toLocaleDateString('ru-RU');
}

function getAccessSourceLabel(login, user, invite) {
    if (invite) {
        return invite.expiresAt ? `По ссылке до ${formatInviteExpiry(invite.expiresAt)}` : 'По ссылке';
    }
    return 'по корп.почте';
}

function getAccessState(login, user, invite) {
    const blockedByUser = !!user?.isBlocked;
    const inviteExists = !!invite;
    const inviteActive = inviteExists ? isPartnerInviteActive(invite) : false;
    const isAdminUser = user?.role === 'admin';
    const isCorporate = isCorporateEmail(login);

    const active = !blockedByUser && (isAdminUser || isCorporate || inviteActive);
    let label = active ? 'Активен' : 'Закрыт';
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
        isCorporate
    };
}

async function toggleAccessForLogin(login, nextActive, user, invite) {
    const nowIso = new Date().toISOString();
    const isAdminUser = user?.role === 'admin';
    const isCorporate = isCorporateEmail(login);

    if (nextActive && !isCorporate && !isAdminUser && !invite) {
        throw new Error('Для этого email сначала выдайте доступ по ссылке.');
    }

    if (user) {
        await patchUserRecord(login, {
            isBlocked: !nextActive,
            blockedAt: nextActive ? null : nowIso,
            failedLoginAttempts: nextActive ? 0 : user.failedLoginAttempts,
            lastSeenAt: nowIso
        });
    }

    if (invite) {
        await patchPartnerInvite(login, {
            status: nextActive ? 'active' : 'revoked'
        });
    }

    if (currentUser && currentUser.login === login) {
        const refreshedUser = await getUserRecordByLogin(login);
        if (refreshedUser) {
            currentUser = normalizeUserRecord({
                ...currentUser,
                ...refreshedUser
            }, login) || currentUser;
            selectedRole = currentUser.role;
            localStorage.setItem(USER_ROLE_KEY, currentUser.role);
            if (currentRoleDisplay) {
                currentRoleDisplay.textContent = getRoleLabelUi(currentUser.role);
            }
        }
    }
}

async function renderAdminUsersTable() {
    if (!adminPanel || !adminUsersTableBody) return;

    if (!isAdmin()) {
        if (adminPanelAccordion) {
            adminPanelAccordion.style.display = 'none';
            adminPanelAccordion.removeAttribute('open');
        }
        return;
    }

    if (adminPanelAccordion) {
        adminPanelAccordion.style.display = '';
    }
    adminUsersTableBody.innerHTML = '<tr><td colspan="6" class="admin-empty">Загрузка...</td></tr>';

    const [users, invites] = await Promise.all([
        listAllUserRecords(),
        listPartnerInvites()
    ]);
    const usersByLogin = new Map(users.map((user) => [user.login, user]));
    const invitesByLogin = new Map(invites.map((invite) => [invite.login, invite]));
    const allLogins = Array.from(new Set([
        ...usersByLogin.keys(),
        ...invitesByLogin.keys()
    ])).sort((a, b) => a.localeCompare(b));

    if (!allLogins.length) {
        adminUsersTableBody.innerHTML = '<tr><td colspan="6" class="admin-empty">Пользователи не найдены</td></tr>';
        return;
    }

    adminUsersTableBody.innerHTML = '';
    allLogins.forEach((login) => {
        const user = usersByLogin.get(login) || null;
        const invite = invitesByLogin.get(login) || null;
        const accessState = getAccessState(login, user, invite);
        const row = document.createElement('tr');

        const loginCell = document.createElement('td');
        loginCell.textContent = login;

        const roleCell = document.createElement('td');
        if (user) {
            const roleSelect = document.createElement('select');
            roleSelect.className = 'admin-role-select';
            roleSelect.innerHTML = `
                <option value="user">Юзер</option>
                <option value="admin">Админ</option>
            `;
            roleSelect.value = normalizeRole(user.role);
            roleSelect.addEventListener('change', async () => {
                const nextRole = normalizeRole(roleSelect.value);
                roleSelect.disabled = true;
                await patchUserRecord(user.login, {
                    role: nextRole,
                    lastSeenAt: new Date().toISOString()
                });
                roleSelect.disabled = false;

                if (currentUser && user.login === currentUser.login) {
                    currentUser.role = nextRole;
                    selectedRole = nextRole;
                    localStorage.setItem(USER_ROLE_KEY, nextRole);
                    if (currentRoleDisplay) {
                        currentRoleDisplay.textContent = getRoleLabelUi(nextRole);
                    }
                    applyRoleRestrictions();
                }
                showCopyNotification(`Роль ${user.login} обновлена`);
                renderAdminUsersTable();
            });
            roleCell.appendChild(roleSelect);
        } else {
            roleCell.className = 'admin-muted';
            roleCell.textContent = '—';
        }

        const sourceCell = document.createElement('td');
        sourceCell.className = 'admin-access-source';
        sourceCell.textContent = getAccessSourceLabel(login, user, invite);

        const timeCell = document.createElement('td');
        timeCell.className = 'admin-time';
        timeCell.textContent = user ? formatActiveTime(user.activeMs) : '—';

        const statusCell = document.createElement('td');
        statusCell.className = `admin-access-status ${accessState.active ? 'is-active' : 'is-blocked'}`;
        statusCell.textContent = accessState.label;

        const actionCell = document.createElement('td');
        const actionBtn = document.createElement('button');
        actionBtn.className = `btn-change ${accessState.active ? 'btn-danger-subtle' : ''}`.trim();
        actionBtn.textContent = accessState.active ? 'Закрыть доступ' : 'Открыть доступ';
        actionBtn.addEventListener('click', async () => {
            const nextActive = !accessState.active;
            if (!nextActive) {
                const confirmed = confirm(`Закрыть доступ для ${login}?`);
                if (!confirmed) return;
            }
            actionBtn.disabled = true;
            try {
                await toggleAccessForLogin(login, nextActive, user, invite);
                showCopyNotification(nextActive ? `Доступ открыт: ${login}` : `Доступ закрыт: ${login}`);
                await renderAdminUsersTable();
            } catch (error) {
                console.error('Failed to toggle access:', error);
                const fallback = error?.message ? String(error.message) : 'Не удалось изменить доступ';
                showCopyNotification(fallback);
            } finally {
                actionBtn.disabled = false;
            }
        });
        actionCell.appendChild(actionBtn);

        row.appendChild(loginCell);
        row.appendChild(roleCell);
        row.appendChild(sourceCell);
        row.appendChild(timeCell);
        row.appendChild(statusCell);
        row.appendChild(actionCell);
        adminUsersTableBody.appendChild(row);
    });
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

    if (partnerInviteAddBtn) partnerInviteAddBtn.disabled = true;
    try {
        await sendMagicLinkToEmail(login, 'invite');

        await savePartnerInvite({
            login,
            role,
            status: 'active',
            expiresAt,
            emailVerifiedAt: null,
            createdAt: new Date().toISOString(),
            createdBy: currentUser?.login || ''
        });

        const existingUser = await getUserRecordByLogin(login);
        if (existingUser && existingUser.role !== 'admin') {
            await patchUserRecord(login, { role });
        }

        showCopyNotification(`Ссылка отправлена на ${login}`);
        if (partnerInviteEmailInput) partnerInviteEmailInput.value = '';
        await renderAdminUsersTable();
    } catch (error) {
        console.error('Failed to send partner invite link:', error);
        showCopyNotification(`Письмо не отправлено. ${getReadableFirebaseAuthError(error, 'invite')}`);
    } finally {
        if (partnerInviteAddBtn) partnerInviteAddBtn.disabled = false;
    }
}

async function handleAuthSubmit() {
    if (!modalNameSubmit) return;
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
    modalNameSubmit.disabled = true;

    try {
        let existingUser = await getUserRecordByLogin(login);
        const accessPolicy = await resolveAccessPolicy(login, existingUser);
        if (!accessPolicy) {
            throw new Error('Доступ разрешен только для корпоративной почты компании или партнеров по инвайту.');
        }

        const passwordHash = await hashPassword(login, password);
        const nowIso = new Date().toISOString();
        let targetUser = null;

        if (existingUser) {
            if (existingUser.isBlocked) {
                throw new Error('Сайт заблокирован для этого аккаунта после 15 неверных попыток ввода пароля. Обратитесь к администратору.');
            }
            const existingIsVerified = !!existingUser.emailVerifiedAt;
            if (existingIsVerified && existingUser.passwordHash !== passwordHash) {
                const failedAttempts = Math.max(0, Number(existingUser.failedLoginAttempts) || 0) + 1;
                const shouldBlock = failedAttempts >= MAX_FAILED_PASSWORD_ATTEMPTS;
                await patchUserRecord(login, {
                    failedLoginAttempts: failedAttempts,
                    isBlocked: shouldBlock,
                    blockedAt: shouldBlock ? nowIso : null,
                    lastSeenAt: nowIso
                });

                if (shouldBlock) {
                    throw new Error('Сайт заблокирован для этого аккаунта после 15 неверных попыток ввода пароля. Обратитесь к администратору.');
                }

                const attemptsLeft = Math.max(0, MAX_FAILED_PASSWORD_ATTEMPTS - failedAttempts);
                throw new Error(`Неверный логин или пароль. Осталось попыток до блокировки: ${attemptsLeft}.`);
            }
            const resolvedRole = existingUser.role === 'admin'
                ? 'admin'
                : normalizeRole(accessPolicy.role || existingUser.role);
            const verifiedAt = existingUser.emailVerifiedAt || accessPolicy?.invite?.emailVerifiedAt || null;
            targetUser = {
                ...existingUser,
                role: resolvedRole,
                fio,
                passwordHash: existingIsVerified ? existingUser.passwordHash : passwordHash,
                emailVerifiedAt: verifiedAt,
                failedLoginAttempts: 0,
                isBlocked: false,
                blockedAt: null,
                lastLoginAt: nowIso,
                lastSeenAt: nowIso
            };
        } else {
            const resolvedRole = normalizeRole(accessPolicy.role || 'user');
            const verifiedAt = accessPolicy?.invite?.emailVerifiedAt || null;
            targetUser = {
                login,
                fio,
                role: resolvedRole,
                passwordHash,
                emailVerifiedAt: verifiedAt,
                emailVerificationSentAt: null,
                failedLoginAttempts: 0,
                isBlocked: false,
                blockedAt: null,
                activeMs: 0,
                createdAt: nowIso,
                lastLoginAt: nowIso,
                lastSeenAt: nowIso
            };
        }

        let savedUser = await saveUserRecord(targetUser);

        const isVerified = !!savedUser.emailVerifiedAt;
        if (!isVerified) {
            await sendMagicLinkToEmail(login, 'verify');
            savedUser = await patchUserRecord(login, {
                emailVerificationSentAt: nowIso
            }) || savedUser;
            setAuthError('Мы отправили ссылку подтверждения на email. Откройте письмо и повторите вход.');
            return;
        }

        setAuthSession(savedUser.login);
        applyAuthenticatedUser(savedUser);
        hideNameModal();
        startActiveTimeTracking();
    } catch (error) {
        console.error('Auth error:', error);
        setAuthError(getReadableFirebaseAuthError(error, 'login'));
    } finally {
        modalNameSubmit.disabled = false;
    }
}

async function restoreAuthSession() {
    const session = getAuthSession();
    if (!session?.login) return false;
    const user = await getUserRecordByLogin(session.login);
    if (!user) {
        clearAuthSession();
        return false;
    }
    if (user.isBlocked) {
        clearAuthSession();
        return false;
    }
    const accessPolicy = await resolveAccessPolicy(user.login, user);
    if (!accessPolicy) {
        clearAuthSession();
        return false;
    }
    const verifiedAt = user.emailVerifiedAt || accessPolicy?.invite?.emailVerifiedAt || null;
    if (!verifiedAt) {
        clearAuthSession();
        return false;
    }
    if (user.role !== 'admin') {
        user.role = normalizeRole(accessPolicy.role || user.role);
    }
    user.emailVerifiedAt = verifiedAt;
    applyAuthenticatedUser(user);
    startActiveTimeTracking();
    return true;
}

// Check if current user is admin
function isAdmin() {
    const resolvedRole = normalizeRole(
        currentUser?.role || localStorage.getItem(USER_ROLE_KEY) || selectedRole || 'user'
    );
    return resolvedRole === 'admin';
}

// Apply role-based restrictions
function applyRoleRestrictions() {
    const isAdminUser = isAdmin();

    document.body.classList.toggle('user-mode', !isAdminUser);
    
    if (!isAdminUser) {
        debugLog('User mode: Prompts are read-only');
        
        // Disable all prompt textareas
        const promptTextareas = document.querySelectorAll('.prompt-editor');
        promptTextareas.forEach(textarea => {
            textarea.setAttribute('readonly', 'true');
            textarea.style.cursor = 'default';
            textarea.style.backgroundColor = '#1a1a1a';
        });
        
        // Disable all WYSIWYG preview editing
        const previewElements = document.querySelectorAll('.prompt-preview');
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
        const toolbarBtns = document.querySelectorAll('.toolbar-btn');
        toolbarBtns.forEach(btn => {
            btn.style.display = 'none';
        });
        
        const toolbarDividers = document.querySelectorAll('.toolbar-divider');
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

    updatePromptVisibilityButton();
    updatePromptHistoryButton();
    if (isAdminUser) {
        renderAdminUsersTable();
    } else if (adminPanelAccordion) {
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

async function readWebhookResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();
    if (!rawText || rawText.trim() === '') {
        return '';
    }
    const trimmed = rawText.trim();
    let parsed = null;
    try {
        parsed = JSON.parse(trimmed);
    } catch (e) {
        parsed = null;
    }
    if (parsed) {
        const extracted = extractApiResponse(parsed);
        return extracted || trimmed;
    }
    if (contentType.includes('application/json')) {
        return trimmed;
    }
    return trimmed;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
            clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
        };
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

function getPromptOwnerKey() {
    const storedName = (localStorage.getItem('managerName') || managerNameInput?.value || 'guest')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
    const role = localStorage.getItem('userRole') || selectedRole || 'user';
    return `${role}:${storedName || 'guest'}`;
}

function getLocalPromptsStorageKey() {
    return `localPrompts:${LOCAL_PROMPTS_STORAGE_VERSION}:${getPromptOwnerKey()}`;
}

function loadLocalPromptsStore() {
    try {
        const raw = localStorage.getItem(getLocalPromptsStorageKey());
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
        return {};
    }
}

function getLocalPromptsRoleData(role) {
    const store = loadLocalPromptsStore();
    const rawVariations = Array.isArray(store[role + '_variations']) ? store[role + '_variations'] : [];
    const variations = rawVariations
        .filter(v => v && typeof v === 'object' && typeof v.id === 'string')
        .map(v => ({
            id: v.id,
            name: v.name || 'Локальный',
            content: unescapeMarkdown(v.content || ''),
            isLocal: true
        }));
    return {
        variations,
        activeId: typeof store[role + '_activeId'] === 'string' ? store[role + '_activeId'] : null
    };
}

function saveLocalPromptsData() {
    const payload = {};
    let hasLocalData = false;

    PROMPT_ROLES.forEach(role => {
        const localVariations = (promptsData[role]?.variations || [])
            .filter(v => v && v.isLocal)
            .map(v => ({
                id: v.id,
                name: v.name || 'Локальный',
                content: v.content || '',
                isLocal: true
            }));
        const activeId = localVariations.some(v => v.id === promptsData[role].activeId)
            ? promptsData[role].activeId
            : null;

        payload[role + '_variations'] = localVariations;
        payload[role + '_activeId'] = activeId;
        if (localVariations.length > 0 || activeId) {
            hasLocalData = true;
        }
    });

    if (hasLocalData) {
        localStorage.setItem(getLocalPromptsStorageKey(), JSON.stringify(payload));
    } else {
        localStorage.removeItem(getLocalPromptsStorageKey());
    }
}

function getActiveRole() {
    const activeTab = document.querySelector('.instruction-tab.active');
    return activeTab ? activeTab.dataset.instruction : 'client';
}

function getActiveVariation(role = getActiveRole()) {
    return (promptsData[role]?.variations || []).find(v => v.id === promptsData[role].activeId) || null;
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

function getPromptMaxChars(role) {
    return PROMPT_MAX_CHARS_BY_ROLE[role] || 60000;
}

function updatePromptLengthInfo(role = getActiveRole()) {
    if (!promptLengthInfo) return;
    const currentLength = String(getActiveContent(role) || '').length;
    const maxChars = getPromptMaxChars(role);
    const percent = maxChars > 0 ? (currentLength / maxChars) * 100 : 0;
    const normalizedPercent = Number.isFinite(percent) ? percent : 0;
    const roundedPercent = normalizedPercent > 999 ? '999+' : normalizedPercent.toFixed(1);
    promptLengthInfo.textContent = `${currentLength.toLocaleString('ru-RU')} символов (${roundedPercent}%) из ~${maxChars.toLocaleString('ru-RU')}`;
    promptLengthInfo.classList.toggle('is-over', currentLength > maxChars);
}

function buildLocalPromptName(name) {
    const baseName = (name || 'Локальный').trim();
    if (/\(локальный\)$/i.test(baseName)) return baseName;
    return `${baseName} (локальный)`;
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

    const localCopy = {
        id: generateId(),
        name: getUniqueVariationName(role, buildLocalPromptName(activeVariation.name)),
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

    activeVariation.isLocal = false;
    activeVariation.name = getUniqueVariationName(
        role,
        (activeVariation.name || '').replace(/\s*\(локальный\)$/i, '').trim() || 'Промпт'
    );
    publicActiveIds[role] = activeVariation.id;
    saveLocalPromptsData();
    savePromptsToFirebaseNow();
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

function getManagerName() {
    return managerNameInput.value.trim() || 'менеджер';
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
            savePromptsToFirebaseNow();
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
    }
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
    const showVoiceModeAction = !hasText && !isTextDialogStarted() && !isProcessing && !isDialogRated;

    if (showVoiceModeAction) {
        setPrimaryActionMode('voice');
        sendBtn.disabled = userInput.disabled;
        return;
    }

    setPrimaryActionMode('send');
    sendBtn.disabled = !hasText || isProcessing || isDialogRated;
}

function lockDialogInput() {
    const inputWrapper = userInput.closest('.input-wrapper');
    userInput.disabled = true;
    sendBtn.disabled = true;
    voiceBtn.disabled = true;
    aiAssistBtn.disabled = true;
    // rateChatBtn stays enabled so user can cancel the rating
    rateChatBtn.disabled = false;
    userInput.placeholder = 'Очистите чат для нового диалога';
    userInput.classList.add('disabled');
    userInput.classList.add('locked-dialog');
    inputWrapper?.classList.add('is-locked');
    userInput.scrollTop = 0;
    requestAnimationFrame(() => {
        userInput.scrollTop = 0;
    });
}

function unlockDialogInput() {
    const inputWrapper = userInput.closest('.input-wrapper');
    userInput.disabled = false;
    voiceBtn.disabled = false;
    aiAssistBtn.disabled = false;
    rateChatBtn.disabled = false;
    userInput.placeholder = '';
    userInput.classList.remove('disabled');
    userInput.classList.remove('locked-dialog');
    inputWrapper?.classList.remove('is-locked');
    userInput.scrollTop = 0;
    updateSendBtnState();
}

// ============ PROMPT VARIATIONS LOGIC ============

function initPromptsData(firebaseData = {}) {
    agentLog(
        'initPromptsData called',
        () => ({
            firebaseDataKeys: Object.keys(firebaseData),
            hasClientVars: !!firebaseData.client_variations
        }),
        { location: 'script.js:initPromptsData', hypothesisId: 'A' }
    );
    let didRestorePublicPrompt = false;

    PROMPT_ROLES.forEach(role => {
        const legacyKey = role === 'client'
            ? 'systemPrompt'
            : role === 'manager_call'
                ? 'managerCallPrompt'
                : role + 'Prompt';
        const legacyContent = firebaseData[role + '_prompt'] || localStorage.getItem(legacyKey) || '';
        const rawPublicVariations = Array.isArray(firebaseData[role + '_variations'])
            ? firebaseData[role + '_variations']
            : [];

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
            const requestedPublicActiveId = firebaseData[role + '_activeId'];
            const activePublicVar =
                publicVariations.find(v => v.id === requestedPublicActiveId) || publicVariations[0];
            if (activePublicVar) {
                activePublicVar.content = unescapeMarkdown(legacyContent);
                didRestorePublicPrompt = true;
            }
        }

        const requestedPublicActiveId = firebaseData[role + '_activeId'];
        const activePublicVar =
            publicVariations.find(v => v.id === requestedPublicActiveId) || publicVariations[0] || null;
        publicActiveIds[role] = activePublicVar ? activePublicVar.id : null;

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

        if (!lastHistoryContent[role]) lastHistoryContent[role] = {};
        promptsData[role].variations.forEach(v => {
            lastHistoryContent[role][v.id] = v.content || '';
        });
    });

    if (isAdmin()) {
        const appliedVersion = localStorage.getItem('raterPromptVersion');
        if (appliedVersion !== RATER_PROMPT_VERSION) {
            const activePublicRaterId = getPublicActiveId('rater');
            const activePublicVar = promptsData.rater.variations.find(
                v => !v.isLocal && v.id === activePublicRaterId
            );
            if (activePublicVar) {
                activePublicVar.content = DEFAULT_RATER_PROMPT;
                didRestorePublicPrompt = true;
                localStorage.setItem('raterPromptVersion', RATER_PROMPT_VERSION);
            }
        }
    }

    if (didRestorePublicPrompt && db && isAdmin()) {
        savePromptsToFirebaseNow();
    } else {
        saveLocalPromptsData();
    }

    renderVariations();
    updateAllPreviews();
    updatePromptVisibilityButton();
    updatePromptHistoryButton();
}

function renderVariations() {
    const role = getActiveRole();
    if (!promptsData[role] || !promptVariationsContainer) return;
    
    const variations = promptsData[role].variations;
    let activeId = promptsData[role].activeId;
    const isAdminUser = isAdmin();
    const shouldHideAttestation = !isAdminUser && !isAttestationMode;
    const visibleVariations = shouldHideAttestation
        ? variations.filter(v => (v.name || '').trim().toLowerCase() !== 'аттестация')
        : variations;
    const activeVisible = visibleVariations.find(v => v.id === activeId);
    if (!activeVisible && visibleVariations.length > 0) {
        activeId = visibleVariations[0].id;
        promptsData[role].activeId = activeId;
        updateEditorContent(role);
    }
    
    const fragment = document.createDocumentFragment();

    visibleVariations.forEach(v => {
        const chip = document.createElement('div');
        chip.className = `prompt-variation-chip ${v.id === activeId ? 'active' : ''}`;
        chip.classList.toggle('local', !!v.isLocal);

        const chipName = document.createElement('span');
        chipName.className = 'chip-name';
        chipName.textContent = v.name || '';
        chip.appendChild(chipName);

        let deleteBtn = null;
        if (visibleVariations.length > 1 && isAdminUser) {
            deleteBtn = document.createElement('span');
            deleteBtn.className = 'delete-variation';
            deleteBtn.textContent = '×';
            chip.appendChild(deleteBtn);
        }
        
        chip.addEventListener('click', (e) => {
            if (!e.target.classList.contains('delete-variation')) {
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
                        savePromptsToFirebase();
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
    updatePromptVisibilityButton();
    updatePromptHistoryButton();
    updatePromptLengthInfo(role);
    if (promptHistoryModal?.classList.contains('active')) {
        renderPromptHistory();
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
    if (role === 'manager_call') return 'Менеджер звонок';
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

function renderPromptHistory() {
    if (!promptHistoryList || !promptHistoryTitle) return;
    if (!isAdmin()) {
        promptHistoryList.innerHTML = '';
        return;
    }

    const role = getActiveRole();
    const activeVariation = getActiveVariation(role);
    if (!activeVariation) {
        promptHistoryTitle.textContent = 'История промпта';
        promptHistoryList.innerHTML = '<div class="changes-empty">Выберите промпт.</div>';
        return;
    }

    promptHistoryTitle.textContent = `История: ${getRoleLabel(role)} · ${activeVariation.name || 'Без названия'}`;

    const items = getPromptHistoryEntries(role, activeVariation.id).slice(0, HISTORY_LIMIT);
    promptHistoryList.innerHTML = '';
    if (!items.length) {
        promptHistoryList.innerHTML = '<div class="changes-empty">Пока нет изменений у этого промпта.</div>';
        return;
    }

    items.forEach(entry => {
        const item = document.createElement('div');
        item.className = 'change-item';
        const title = `${getRoleLabel(entry.role)} · ${entry.variationName || 'Без названия'}`;
        const time = formatHistoryTime(entry.ts);
        item.innerHTML = `
            <div class="change-meta">
                <div class="change-title" title="${title}">${title}</div>
                <div class="change-time">${time}</div>
            </div>
            <button class="btn-restore" data-id="${entry.id}">Восстановить</button>
        `;
        item.querySelector('.btn-restore').addEventListener('click', (e) => {
            e.stopPropagation();
            restorePromptVersion(entry.id, role, activeVariation.id);
        });
        prepareCustomTooltips(item);
        promptHistoryList.appendChild(item);
    });
}

function savePromptHistory() {
    if (!promptHistory) return;

    // Лимитируем историю отдельно для каждого промпта, а не глобально.
    const perPromptCount = new Map();
    const trimmedHistory = [];
    promptHistory.forEach(entry => {
        const key = getPromptHistoryKey(entry.role, entry.variationId);
        const used = perPromptCount.get(key) || 0;
        if (used >= HISTORY_LIMIT) return;
        perPromptCount.set(key, used + 1);
        trimmedHistory.push(entry);
    });
    promptHistory = trimmedHistory;

    localStorage.setItem('promptHistory', JSON.stringify(promptHistory));
    if (db) {
        set(ref(db, 'prompt_history'), promptHistory)
            .then(() => debugLog('Prompt history synced'))
            .catch(e => console.error('Failed to sync history:', e));
    }
}

function recordPromptHistory(role, variation) {
    if (!isAdmin()) return;
    if (!variation) return;
    const content = variation.content || '';
    const lastContent = lastHistoryContent[role]?.[variation.id] ?? '';
    if (content === lastContent) return;

    const entry = {
        id: generateId(),
        ts: Date.now(),
        role,
        variationId: variation.id,
        variationName: variation.name,
        content
    };

    promptHistory.unshift(entry);
    lastHistoryContent[role][variation.id] = content;
    savePromptHistory();
    if (promptHistoryModal?.classList.contains('active')) {
        renderPromptHistory();
    }
}

function restorePromptVersion(entryId, role = getActiveRole(), variationId = getActiveVariation(role)?.id) {
    if (!isAdmin()) return;
    const entry = promptHistory.find(item =>
        item.id === entryId &&
        (!role || item.role === role) &&
        (!variationId || item.variationId === variationId)
    );
    if (!entry) return;

    role = entry.role;
    const variations = promptsData[role]?.variations || [];
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

    promptsData[role].activeId = targetVar.id;
    renderVariations();
    updateEditorContent(role);
    savePromptsToFirebaseNow();
    if (promptHistoryModal?.classList.contains('active')) {
        renderPromptHistory();
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
        savePromptsToFirebase();
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
            savePromptsToFirebase();
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
    const activeVar = promptsData[role].variations.find(v => v.id === promptsData[role].activeId);
    const content = activeVar ? activeVar.content : '';

    const textarea = promptInputsByRole[role];
    const preview = promptPreviewByRole[role];
    
    if (textarea && preview) {
        // Only update if content has actually changed to prevent cursor jumping
        if (textarea.value !== content) {
            textarea.value = content;
            preview.innerHTML = renderMarkdown(content);
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
            return;
        }
        activeVar.content = content;
        if (activeVar.isLocal) {
            saveLocalPromptsData();
        } else {
            savePromptsToFirebase();
        }
        if (role === getActiveRole()) {
            updatePromptLengthInfo(role);
        }
    }
}

function getActiveContent(role) {
    const v = promptsData[role].variations.find(v => v.id === promptsData[role].activeId);
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
                ? 'менеджера звонка'
                : 'оценщика';
    addMessage(`Ошибка: промпт ${roleLabel} пустой. Заполните инструкцию.`, 'error', false);
    return null;
}

// ============ FIREBASE SYNC ============

const savePromptsToFirebase = debounce(() => {
    savePromptsToFirebaseNow();
}, 1000);

function savePromptsToFirebaseNow() {
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
    saveLocalPromptsData();

    const activeRole = getActiveRole();
    const activeVar = promptsData[activeRole]?.variations.find(v => v.id === promptsData[activeRole]?.activeId);
    if (activeVar && !activeVar.isLocal) {
        recordPromptHistory(activeRole, activeVar);
    }
    if (!db) return;

    const payload = {
        client_prompt: getPublicActiveContent('client'),
        manager_prompt: getPublicActiveContent('manager'),
        manager_call_prompt: getPublicActiveContent('manager_call'),
        rater_prompt: getPublicActiveContent('rater'),

        client_variations: getPublicVariations('client'),
        client_activeId: getPublicActiveId('client'),
        manager_variations: getPublicVariations('manager'),
        manager_activeId: getPublicActiveId('manager'),
        manager_call_variations: getPublicVariations('manager_call'),
        manager_call_activeId: getPublicActiveId('manager_call'),
        rater_variations: getPublicVariations('rater'),
        rater_activeId: getPublicActiveId('rater')
    };

    // Critical Fix: Validation to prevent saving empty/corrupted data to cloud
    const hasEmptyEssential = PROMPT_ROLES.some(role => {
        const publicVariations = payload[role + '_variations'] || [];
        const activeContent = payload[role + '_prompt'] || '';
        return activeContent === '' && publicVariations.some(v => (v.content || '').trim() !== '');
    });

    if (hasEmptyEssential) {
        console.warn('Sync cancelled: attempt to save empty prompt detected');
        return;
    }

    set(ref(db, 'prompts'), payload)
        .then(() => debugLog('Prompts synced to Firebase'))
        .catch(e => console.error('Failed to sync:', e));
}

async function loadPrompts() {
    await consumeEmailVerificationLinkIfPresent();

    const restored = await restoreAuthSession();
    if (!restored) {
        selectedRole = 'user';
        localStorage.setItem(USER_ROLE_KEY, 'user');
        showNameModal();
    } else {
        hideNameModal();
        debugLog(`Welcome back, ${currentUser?.fio || 'user'} (${selectedRole})`);
    }

    if (db) {
        try {
            const promptsRef = ref(db, 'prompts');
            onValue(promptsRef, (snapshot) => {
                const data = snapshot.val();
                agentLog(
                    'Firebase onValue triggered',
                    { hasData: !!data, isUserEditing },
                    { location: 'script.js:loadPrompts.onValue', hypothesisId: 'C' }
                );
                debugLog('Firebase data received:', data);
                
                // Skip update if user is currently editing
                if (isUserEditing) {
                    debugLog('Skipping Firebase update - user is editing');
                    return;
                }
                
                // Skip if data hasn't changed
                const dataStr = JSON.stringify(data);
                if (lastFirebaseData === dataStr) {
                    debugLog('Skipping Firebase update - data unchanged');
                    return;
                }
                lastFirebaseData = dataStr;
                
                if (data) {
                    initPromptsData(data);
                } else {
                    initPromptsData({});
                    savePromptsToFirebaseNow();
        }
            }, (error) => {
                console.error('Firebase read error:', error);
                initPromptsData({});
            });

            const historyRef = ref(db, 'prompt_history');
            onValue(historyRef, (snapshot) => {
                const historyData = snapshot.val();
                if (Array.isArray(historyData)) {
                    promptHistory = historyData;
                } else if (historyData && typeof historyData === 'object') {
                    promptHistory = Object.values(historyData);
                } else {
                    promptHistory = [];
                }
                renderPromptHistory();
            });
        } catch (e) {
            console.error('Error setting up Firebase listener:', e);
            initPromptsData({});
        }
    } else {
        initPromptsData({});
        const localHistory = localStorage.getItem('promptHistory');
        if (localHistory) {
            try {
                promptHistory = JSON.parse(localHistory) || [];
            } catch (e) {
                promptHistory = [];
            }
        }
        renderPromptHistory();
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

function showNameModal() {
    if (!nameModal) return;
    nameModal.classList.add('active');
    if (nameModalStep1) {
        nameModalStep1.style.display = 'block';
    }
    if (modalNameInput && !modalNameInput.value) {
        modalNameInput.value = localStorage.getItem(USER_NAME_KEY) || '';
    }
    if (modalLoginInput && !modalLoginInput.value) {
        modalLoginInput.value = localStorage.getItem(USER_LOGIN_KEY) || '';
    }
    if (modalPasswordInput) {
        modalPasswordInput.value = '';
    }
    setPasswordVisibility(false);
    setAuthError('');
    setTimeout(() => modalNameInput?.focus(), 100);
}

function hideNameModal() {
    if (!nameModal) return;
    nameModal.classList.remove('active');
}

if (modalNameSubmit) {
    modalNameSubmit.addEventListener('click', () => {
        handleAuthSubmit();
    });
}

[modalNameInput, modalLoginInput, modalPasswordInput].forEach((input) => {
    input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAuthSubmit();
        }
    });
});

if (togglePasswordVisibilityBtn) {
    togglePasswordVisibilityBtn.addEventListener('click', () => {
        const nextVisible = modalPasswordInput?.type === 'password';
        setPasswordVisibility(nextVisible);
        modalPasswordInput?.focus();
    });
}

// ============ AI IMPROVE MODAL ============

function setAiImproveModalContent(mode = 'default') {
    if (!aiImproveModalTitle || !aiImproveModalDescription || !aiImproveInput) return;
    if (mode === 'rating') {
        aiImproveModalTitle.textContent = 'Улучшить инструкцию на основе представленного диалога и оценки';
        aiImproveModalDescription.textContent = 'Опишите, что конкретно нужно улучшить на основе диалога и оценки.';
        aiImproveInput.placeholder = 'Например: усилий контроль по этапу выявления потребности и добавь конкретные анти-паттерны.';
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
    const { mode = 'default', context = null } = options;
    aiImproveMode = mode;
    pendingRatingImproveContext = mode === 'rating' ? context : null;
    setAiImproveModalContent(mode);

    aiImproveModal.classList.add('active');
    
    // Reset to step 1
    aiImproveStep1.style.display = 'block';
    aiImproveStep2.style.display = 'none';
    resetPendingImproveState();
    aiImproveInput.value = '';
    
    setTimeout(() => aiImproveInput.focus(), 100);
}

function hideAiImproveModal() {
    aiImproveModal.classList.remove('active');
    pendingRatingImproveContext = null;
    aiImproveMode = 'default';
    setAiImproveModalContent('default');
    resetPendingImproveState();
}

function setVoiceModeStatus(text, state = 'idle') {
    if (!voiceModeStatus) return;
    voiceModeStatus.textContent = text;
    voiceModeStatus.dataset.state = state;
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
        voiceModeStopBtn.style.display = (isGeminiVoiceConnecting || isGeminiVoiceActive) ? '' : 'none';
        voiceModeStopBtn.disabled = !isGeminiVoiceConnecting && !isGeminiVoiceActive;
    }
}

function getConfiguredGeminiApiKey() {
    return String(
        (typeof window !== 'undefined' && (window.GEMINI_LIVE_API_KEY || window.GEMINI_API_KEY)) ||
        localStorage.getItem(GEMINI_LIVE_API_KEY_STORAGE_KEY) ||
        ''
    ).trim();
}

function getConfiguredGeminiTokenEndpoint() {
    return String(
        (typeof window !== 'undefined' && (window.GEMINI_LIVE_TOKEN_ENDPOINT || window.GEMINI_TOKEN_ENDPOINT)) ||
        localStorage.getItem(GEMINI_LIVE_TOKEN_ENDPOINT_STORAGE_KEY) ||
        ''
    ).trim();
}

function populateVoiceConfigFields() {
    if (geminiApiKeyInput) {
        geminiApiKeyInput.value = localStorage.getItem(GEMINI_LIVE_API_KEY_STORAGE_KEY) || '';
    }
    if (geminiTokenEndpointInput) {
        geminiTokenEndpointInput.value = localStorage.getItem(GEMINI_LIVE_TOKEN_ENDPOINT_STORAGE_KEY) || '';
    }
}

function saveVoiceModeConfigFromInputs() {
    const apiKey = String(geminiApiKeyInput?.value || '').trim();
    const tokenEndpoint = String(geminiTokenEndpointInput?.value || '').trim();

    if (apiKey) {
        localStorage.setItem(GEMINI_LIVE_API_KEY_STORAGE_KEY, apiKey);
    } else {
        localStorage.removeItem(GEMINI_LIVE_API_KEY_STORAGE_KEY);
    }

    if (tokenEndpoint) {
        localStorage.setItem(GEMINI_LIVE_TOKEN_ENDPOINT_STORAGE_KEY, tokenEndpoint);
    } else {
        localStorage.removeItem(GEMINI_LIVE_TOKEN_ENDPOINT_STORAGE_KEY);
    }

    if (tokenEndpoint) {
        showCopyNotification('Token endpoint сохранен');
    } else if (apiKey) {
        showCopyNotification('Gemini API key сохранен локально');
    } else {
        showCopyNotification('Настройки голосового режима очищены');
    }
}

function clearVoiceModeConfig() {
    localStorage.removeItem(GEMINI_LIVE_API_KEY_STORAGE_KEY);
    localStorage.removeItem(GEMINI_LIVE_TOKEN_ENDPOINT_STORAGE_KEY);
    if (geminiApiKeyInput) geminiApiKeyInput.value = '';
    if (geminiTokenEndpointInput) geminiTokenEndpointInput.value = '';
    showCopyNotification('Данные Gemini удалены на этом устройстве');
}

async function resolveGeminiLiveApiKey() {
    const tokenEndpoint = getConfiguredGeminiTokenEndpoint();
    if (tokenEndpoint) {
        const tokenResponse = await fetchWithTimeout(tokenEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        }, 20000);
        if (!tokenResponse.ok) {
            throw new Error(`Не удалось получить токен Gemini (HTTP ${tokenResponse.status})`);
        }
        const tokenPayload = await tokenResponse.json();
        const token = String(
            tokenPayload?.name ||
            tokenPayload?.token ||
            tokenPayload?.accessToken ||
            tokenPayload?.apiKey ||
            ''
        ).trim();
        if (token) return token;
        throw new Error('Эндпоинт токена Gemini вернул пустой ответ');
    }

    const directApiKey = getConfiguredGeminiApiKey();
    if (directApiKey) return directApiKey;

    throw new Error(
        'Голосовой режим не настроен: укажите window.GEMINI_LIVE_TOKEN_ENDPOINT или window.GEMINI_LIVE_API_KEY'
    );
}

async function loadGeminiSdkModule() {
    if (geminiSdkModulePromise) return geminiSdkModulePromise;
    geminiSdkModulePromise = import('https://cdn.jsdelivr.net/npm/@google/genai/+esm');
    return geminiSdkModulePromise;
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

async function handleGeminiLiveMessage(message) {
    const serverContent = message?.serverContent;
    if (!serverContent) return;

    if (serverContent.interrupted) {
        resetGeminiPlaybackCursor();
    }

    const inputText = serverContent.inputTranscription?.text;
    if (inputText) {
        setVoiceModeStatus(getShortStatusText('Вы:', inputText), 'listening');
    }

    const outputText = serverContent.outputTranscription?.text || message?.text;
    if (outputText) {
        setVoiceModeStatus(getShortStatusText('ИИ-клиент:', outputText), 'ready');
    }

    const parts = Array.isArray(serverContent.modelTurn?.parts) ? serverContent.modelTurn.parts : [];
    let playedFromParts = false;
    for (const part of parts) {
        const inlineData = part?.inlineData;
        if (inlineData?.data) {
            playedFromParts = true;
            await enqueueGeminiAudioPlayback(inlineData.data, inlineData.mimeType || 'audio/pcm;rate=24000');
        }
    }

    if (!playedFromParts && message?.data) {
        await enqueueGeminiAudioPlayback(message.data, 'audio/pcm;rate=24000');
    }

    if (serverContent.turnComplete || serverContent.waitingForInput) {
        setVoiceModeStatus('Слушаю вас… Говорите.', 'listening');
    }
}

async function initGeminiVoiceCapture() {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.getUserMedia) {
        throw new Error('Браузер не поддерживает доступ к микрофону');
    }

    if (!geminiVoiceAudioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) throw new Error('Web Audio API не поддерживается в этом браузере');
        geminiVoiceAudioContext = new AudioCtx();
    }
    if (geminiVoiceAudioContext.state === 'suspended') {
        await geminiVoiceAudioContext.resume();
    }

    geminiVoiceInputStream = await mediaDevices.getUserMedia({
        audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        }
    });

    geminiVoiceSourceNode = geminiVoiceAudioContext.createMediaStreamSource(geminiVoiceInputStream);
    geminiVoiceProcessorNode = geminiVoiceAudioContext.createScriptProcessor(4096, 1, 1);
    geminiVoiceSilenceGain = geminiVoiceAudioContext.createGain();
    geminiVoiceSilenceGain.gain.value = 0;

    const inputSampleRate = geminiVoiceAudioContext.sampleRate || 48000;

    geminiVoiceProcessorNode.onaudioprocess = (event) => {
        if (!isGeminiVoiceActive || !geminiLiveSession) return;
        const inputData = event.inputBuffer.getChannelData(0);
        if (!inputData || !inputData.length) return;

        const rms = calculateRms(inputData);
        if (rms < 0.0055) return;

        const downsampled = downsampleAudioBuffer(inputData, inputSampleRate, 16000);
        if (!downsampled.length) return;

        const pcm = float32ToInt16Pcm(downsampled);
        try {
            geminiLiveSession.sendRealtimeInput({
                audio: {
                    data: uint8ToBase64(pcm),
                    mimeType: 'audio/pcm;rate=16000'
                }
            });
        } catch (error) {
            debugLog('Failed to send realtime audio chunk', error);
        }
    };

    geminiVoiceSourceNode.connect(geminiVoiceProcessorNode);
    geminiVoiceProcessorNode.connect(geminiVoiceSilenceGain);
    geminiVoiceSilenceGain.connect(geminiVoiceAudioContext.destination);
}

function teardownGeminiVoiceCapture() {
    if (geminiVoiceProcessorNode) {
        try { geminiVoiceProcessorNode.disconnect(); } catch (e) {}
        geminiVoiceProcessorNode.onaudioprocess = null;
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
        geminiVoiceInputStream.getTracks().forEach(track => {
            try { track.stop(); } catch (e) {}
        });
        geminiVoiceInputStream = null;
    }
    resetGeminiPlaybackCursor();
}

async function stopGeminiVoiceMode(options = {}) {
    const { silent = false, expectedClose = true } = options;
    geminiVoiceCloseExpected = !!expectedClose;

    if (!isGeminiVoiceActive && !isGeminiVoiceConnecting && !geminiLiveSession) {
        return;
    }

    isGeminiVoiceConnecting = false;
    isGeminiVoiceActive = false;
    updateVoiceModeControls();

    try {
        if (geminiLiveSession) {
            try {
                geminiLiveSession.sendRealtimeInput({ audioStreamEnd: true });
            } catch (e) {}
            geminiLiveSession.close();
        }
    } catch (error) {
        debugLog('Error while closing Gemini voice session', error);
    } finally {
        geminiLiveSession = null;
        teardownGeminiVoiceCapture();
        updateVoiceModeControls();
    }

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
    isGeminiVoiceConnecting = true;
    updateVoiceModeControls();
    setVoiceModeStatus('Подключаюсь к Gemini Live…', 'idle');

    try {
        const { GoogleGenAI, Modality } = await loadGeminiSdkModule();
        const apiKey = await resolveGeminiLiveApiKey();
        const apiVersion = apiKey.startsWith('auth_tokens/') ? 'v1alpha' : 'v1beta';
        geminiLiveApiClient = new GoogleGenAI({
            apiKey,
            httpOptions: { apiVersion }
        });

        const activeClientPrompt = String(getActiveContent('client') || '').trim();
        const systemInstruction = activeClientPrompt || 'Ты вежливый клиент, веди естественный разговор голосом на русском языке.';

        geminiLiveSession = await geminiLiveApiClient.live.connect({
            model: GEMINI_LIVE_MODEL,
            config: {
                responseModalities: [Modality.AUDIO],
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                systemInstruction
            },
            callbacks: {
                onopen: () => {
                    setVoiceModeStatus('Соединение установлено. Говорите.', 'listening');
                },
                onmessage: (message) => {
                    handleGeminiLiveMessage(message).catch((error) => {
                        console.error('Gemini live message handling error:', error);
                    });
                },
                onerror: (event) => {
                    console.error('Gemini live error:', event);
                    setVoiceModeStatus('Ошибка голосового канала. Нажмите «Остановить» и попробуйте снова.', 'error');
                },
                onclose: (event) => {
                    const closeReasonText = getGeminiCloseReasonText(event);
                    const expectedClose = geminiVoiceCloseExpected;
                    if (isGeminiVoiceActive || isGeminiVoiceConnecting || geminiLiveSession) {
                        stopGeminiVoiceMode({ silent: true, expectedClose }).catch(() => {}).finally(() => {
                            if (!expectedClose) {
                                const livedMs = geminiVoiceStartTimestamp ? Date.now() - geminiVoiceStartTimestamp : 0;
                                const prefix = livedMs > 0 && livedMs < 2500
                                    ? 'Соединение оборвалось сразу после запуска'
                                    : 'Соединение прервано';
                                setVoiceModeStatus(`${prefix}${closeReasonText}. Проверьте ключ Gemini и попробуйте снова.`, 'error');
                            }
                            geminiVoiceCloseExpected = false;
                        });
                        return;
                    }
                    if (!expectedClose) {
                        setVoiceModeStatus(`Голосовой канал закрылся${closeReasonText}. Нажмите «Начать» снова.`, 'error');
                    }
                    geminiVoiceCloseExpected = false;
                }
            }
        });

        await initGeminiVoiceCapture();
        isGeminiVoiceConnecting = false;
        isGeminiVoiceActive = true;
        updateVoiceModeControls();
        setVoiceModeStatus('Слушаю вас… Говорите.', 'listening');

        try {
            geminiLiveSession.sendClientContent({
                turns: [{
                    role: 'user',
                    parts: [{ text: 'Начни разговор первым: коротко поздоровайся и задай один уточняющий вопрос менеджеру.' }]
                }],
                turnComplete: true
            });
        } catch (error) {
            debugLog('Initial live prompt failed', error);
        }
    } catch (error) {
        console.error('Failed to start Gemini voice mode:', error);
        isGeminiVoiceConnecting = false;
        isGeminiVoiceActive = false;
        await stopGeminiVoiceMode({ silent: true, expectedClose: true });
        geminiVoiceCloseExpected = false;
        setVoiceModeStatus(
            `Не удалось запустить голосовой режим: ${error?.message || 'неизвестная ошибка'}`,
            'error'
        );
    } finally {
        updateVoiceModeControls();
    }
}

function showVoiceModeModal() {
    hideTooltip(true);
    if (!voiceModeModal) return;
    updateVoiceModeControls();
    if (!isGeminiVoiceActive && !isGeminiVoiceConnecting) {
        setVoiceModeStatus('', 'idle');
    }
    voiceModeModal.classList.add('active');
}

function hideVoiceModeModal() {
    if (!voiceModeModal) return;
    voiceModeModal.classList.remove('active');
    if (isGeminiVoiceActive || isGeminiVoiceConnecting) {
        stopGeminiVoiceMode({ silent: true }).catch(() => {});
    }
}

function showPromptHistoryModal() {
    hideTooltip(true);
    if (!promptHistoryModal) return;
    renderPromptHistory();
    promptHistoryModal.classList.add('active');
}

function hidePromptHistoryModal() {
    if (!promptHistoryModal) return;
    promptHistoryModal.classList.remove('active');
}

// ============ SETTINGS MODAL FUNCTIONS ============

function showSettingsModal() {
    hideTooltip(true);
    const savedName = currentUser?.fio || localStorage.getItem(USER_NAME_KEY) || '';
    const userRole = normalizeRole(currentUser?.role || localStorage.getItem(USER_ROLE_KEY) || 'user');
    const loginValue = currentUser?.login || localStorage.getItem(USER_LOGIN_KEY) || '-';

    settingsNameInput.value = savedName;
    if (accountLoginValue) {
        accountLoginValue.textContent = loginValue || '-';
    }
    autoResizeNameInput();
    selectedRole = userRole;
    localStorage.setItem(USER_ROLE_KEY, userRole);
    currentRoleDisplay.textContent = getRoleLabelUi(userRole);
    
    // Hide password section
    roleChangePassword.style.display = 'none';
    roleChangePasswordInput.value = '';
    roleChangeError.style.display = 'none';
    populateVoiceConfigFields();

    if (adminPanelAccordion) {
        adminPanelAccordion.removeAttribute('open');
    }

    if (userRole === 'admin') {
        renderAdminUsersTable();
    } else if (adminPanelAccordion) {
        adminPanelAccordion.style.display = 'none';
    }

    settingsModal.classList.add('active');
}

const nameInputMeasureCanvas = document.createElement('canvas');
const nameInputMeasureCtx = nameInputMeasureCanvas.getContext('2d');

function autoResizeNameInput() {
    if (!settingsNameInput) return;
    settingsNameInput.style.width = '100%';
}

function hideSettingsModal() {
    settingsModal.classList.remove('active');
    }

function updateUserNameDisplay() {
    const name = currentUser?.fio || localStorage.getItem(USER_NAME_KEY) || 'Гость';
    const role = normalizeRole(currentUser?.role || localStorage.getItem(USER_ROLE_KEY) || 'user');
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

    let userMessage = `Изначальный промпт:\n\n${currentPrompt}\n\n---\n\nЗапрос на улучшение: ${improvementRequest}\n\n---\n\nВАЖНО: Верни ПОЛНЫЙ текст улучшенного промпта. Подсвети изменения так:\n1. Удаленный/измененный текст оберни в ~~ (например: ~~старый текст~~)\n2. Новый/добавленный текст оберни в ++ (например: ++новый текст++)\n3. Остальной текст оставь без изменений.\nНе используй markdown код-блоки.`;

    if (aiImproveMode === 'rating' && pendingRatingImproveContext) {
        const { dialogText = '', ratingText = '' } = pendingRatingImproveContext;
        const roleLabel = role === 'client'
            ? 'клиента'
            : role === 'manager'
                ? 'менеджера'
                : role === 'manager_call'
                    ? 'менеджера звонка'
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
    btnText.textContent = FUNNY_LOADING_MESSAGES[Math.floor(Math.random() * FUNNY_LOADING_MESSAGES.length)];
    
    const messageInterval = setInterval(() => {
        msgIndex = (msgIndex + 1) % FUNNY_LOADING_MESSAGES.length;
        // Pick random message to avoid repetition order
        const randomMsg = FUNNY_LOADING_MESSAGES[Math.floor(Math.random() * FUNNY_LOADING_MESSAGES.length)];
        btnText.textContent = randomMsg;
    }, 2500);
    
    try {
        const requestId = buildRequestId('improve');
        const response = await fetchWithTimeout(AI_IMPROVE_WEBHOOK_URL, {
            method: 'POST',
            headers: buildJsonRequestHeaders(requestId, 'improve'),
            body: JSON.stringify({
                userMessage,
                requestId
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const responseText = await response.text();
        if (!responseText) throw new Error('Пустой ответ от сервера');

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            // If response is not JSON, assume it's the raw text of the prompt
            debugLog('Response is not JSON, treating as raw text');
            data = { output: responseText };
        }

        const rawResponse = extractApiResponse(data);
        
        if (!rawResponse) throw new Error('Не удалось получить текст из ответа');
        
        // Clean the text for saving (remove ~~deleted~~ and unwrap ++added++)
        const cleanPrompt = rawResponse
            .replace(/~~[^~]+~~/g, '') // Remove deleted text
            .replace(/\+\+([^+]+)\+\+/g, '$1') // Unwrap added text
            .replace(/\n{3,}/g, '\n\n') // Fix excess newlines
            .trim();

        // Store pending data
        pendingImprovedPrompt = cleanPrompt;
        pendingRole = role;
        pendingName = currentName;
        pendingVariationId = activeVar ? activeVar.id : null;
        
        // Render diff (using the raw response with markers)
        showSemanticDiff(rawResponse);
        
    } catch (error) {
        console.error('AI improve error:', error);
        alert('Ошибка улучшения: ' + error.message);
    } finally {
        clearInterval(messageInterval);
        submitBtn.disabled = false;
        btnText.textContent = originalText; // Restore original text
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
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
        savePromptsToFirebase();
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
bindEvent(promptVisibilityBtn, 'click', toggleActivePromptVisibility);
bindEvent(aiImproveModalClose, 'click', hideAiImproveModal);
bindEvent(aiImproveCancel, 'click', hideAiImproveModal);
bindEvent(aiImproveSubmit, 'click', improvePromptWithAI);
bindEvent(voiceModeModalClose, 'click', hideVoiceModeModal);
bindEvent(promptHistoryModalClose, 'click', hidePromptHistoryModal);
bindEvent(voiceModeStartBtn, 'click', () => {
    startGeminiVoiceMode().catch((error) => {
        console.error('Voice mode start error:', error);
    });
});
bindEvent(voiceModeStopBtn, 'click', () => {
    stopGeminiVoiceMode().catch((error) => {
        console.error('Voice mode stop error:', error);
    });
});

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

bindEvent(settingsBtn, 'click', showSettingsModal);

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
    localStorage.setItem(USER_NAME_KEY, newName);
    currentUser.fio = newName;
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
    saveVoiceModeConfigFromInputs();
});

bindEvent(clearVoiceConfigBtn, 'click', () => {
    clearVoiceModeConfig();
});

[geminiApiKeyInput, geminiTokenEndpointInput].forEach((input) => {
    bindEvent(input, 'keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        saveVoiceModeConfigFromInputs();
    });
});

// Theme toggle
bindEvent(themeToggle, 'change', () => {
    const isLight = themeToggle.checked;
    document.body.classList.toggle('light-theme', isLight);
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
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
        localStorage.setItem('accentColor', color);
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
            localStorage.setItem('accentColor', color);
            updateColorPresetActive(color);
            moreColorsPopup.classList.remove('active');
        });
    });
}

// Load saved accent color
const savedAccentColor = localStorage.getItem('accentColor') || '#7F96FF';
setAccentColor(savedAccentColor);
updateColorPresetActive(savedAccentColor);

// Load saved theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') {
    themeToggle.checked = true;
    document.body.classList.add('light-theme');
}

// Change role button
changeRoleBtn.addEventListener('click', () => {
    const currentRole = currentUser?.role || localStorage.getItem(USER_ROLE_KEY) || 'user';
    
    if (currentRole === 'admin') {
        // Admin -> User (no password needed)
        if (confirm('Вы уверены, что хотите переключиться на роль Пользователя?')) {
            switchRole('user');
        }
    } else {
        // User -> Admin (require password)
        roleChangePassword.style.display = 'block';
        roleChangePasswordInput.focus();
    }
});

// Helper function to switch role
async function switchRole(newRole) {
    if (!currentUser) return;
    const role = normalizeRole(newRole);
    const patched = await patchUserRecord(currentUser.login, {
        role,
        lastSeenAt: new Date().toISOString()
    });
    currentUser = normalizeUserRecord({
        ...currentUser,
        ...(patched || {}),
        role
    }, currentUser.login);
    selectedRole = role;
    localStorage.setItem(USER_ROLE_KEY, role);
    currentRoleDisplay.textContent = getRoleLabelUi(role);
    applyRoleRestrictions();
    showCopyNotification(`Роль изменена на ${getRoleLabelUi(role)}`);
}

// Cancel role change
roleChangeCancelBtn.addEventListener('click', () => {
    roleChangePassword.style.display = 'none';
    roleChangePasswordInput.value = '';
    roleChangeError.style.display = 'none';
});

// Confirm role change (for User -> Admin)
roleChangeConfirmBtn.addEventListener('click', () => {
    const password = roleChangePasswordInput.value.trim();
    
    if (password === ADMIN_PASSWORD) {
        switchRole('admin');
        roleChangePassword.style.display = 'none';
        roleChangePasswordInput.value = '';
        roleChangeError.style.display = 'none';
    } else {
        roleChangeError.style.display = 'block';
        roleChangePasswordInput.value = '';
        roleChangePasswordInput.style.borderColor = '#ff5555';
        setTimeout(() => {
            roleChangePasswordInput.style.borderColor = '';
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
            exportCurrentPrompt(format);
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
if (voiceModeModal) {
    voiceModeModal.addEventListener('click', (e) => {
        if (e.target === voiceModeModal) {
            hideVoiceModeModal();
        }
    });
}
if (promptHistoryModal) {
    promptHistoryModal.addEventListener('click', (e) => {
        if (e.target === promptHistoryModal) {
            hidePromptHistoryModal();
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

function clearChat() {
    conversationHistory = [];
    lastRating = null;
    isDialogRated = false;
    removeReratePrompt();
    updatePromptLock();
    unlockDialogInput();
    rateChatBtn.classList.remove('rated');
    
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
        startAttestationBtnEl.addEventListener('click', () => setAttestationMode(true));
    }
}

async function sendMessage() {
    const userMessage = userInput.value.trim();
    if (!userMessage || isProcessing || isDialogRated) return;

    const systemPrompt = validatePromptBeforeWebhook('client', systemPromptInput.value);
    if (!systemPrompt) return;
    
    isProcessing = true;
    toggleInputState(false);
    
    const startDiv = document.getElementById('startConversation');
    if (startDiv) startDiv.style.display = 'none';
    
    addMessage(userMessage, 'user', true);
    conversationHistory.push({ role: 'user', content: userMessage });
    updatePromptLock();
    updateSendBtnState();
    
    userInput.value = '';
    userInput.style.height = '44px';
    
    const loadingMsg = addMessage('', 'loading');
    
    try {
        let dialogHistory = '';
        conversationHistory.slice(0, -1).forEach((msg) => {
            const role = msg.role === 'user' ? 'Менеджер' : 'Клиент';
            dialogHistory += `${role}: ${msg.content}\n\n`;
        });
        const requestId = buildRequestId('chat');
        
        const response = await fetchWithTimeout(WEBHOOK_URL, {
            method: 'POST',
            headers: buildJsonRequestHeaders(requestId, 'chat'),
            body: JSON.stringify({
                chatInput: userMessage,
                systemPrompt,
                dialogHistory: dialogHistory.trim(),
                sessionId: clientSessionId,
                requestId
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const assistantMessage = await readWebhookResponse(response);
        if (!assistantMessage) {
            console.warn('Empty webhook response for user message.');
            loadingMsg.remove();
            addMessage('Ошибка: что-то сломалось. Обратитесь к администратору сайта.', 'error', false);
            return;
        }
        
        loadingMsg.remove();
        addMessage(assistantMessage, 'assistant', true);
        conversationHistory.push({ role: 'assistant', content: assistantMessage });
        updatePromptLock();
        updateSendBtnState();
        
    } catch (error) {
        console.error('Error:', error);
        loadingMsg.remove();
        addMessage(`Ошибка: ${error.message}`, 'error', false);
    } finally {
        isProcessing = false;
        if (!lastRating) {
            toggleInputState(true);
            userInput.focus();
        }
    }
}

async function startConversationHandler() {
    const systemPrompt = validatePromptBeforeWebhook('client', systemPromptInput.value);
    if (!systemPrompt) return;

    refreshSessionIds(generateSessionId());
    conversationHistory = [];
    lastRating = null;
    updatePromptLock();
    toggleInputState(true);
    
    const startDiv = document.getElementById('startConversation');
    if (startDiv) startDiv.style.display = 'none';
    
    const loadingMsg = addMessage('', 'loading');
    
    try {
        const requestId = buildRequestId('chat_start');
        const response = await fetchWithTimeout(WEBHOOK_URL, {
            method: 'POST',
            headers: buildJsonRequestHeaders(requestId, 'chat_start'),
            body: JSON.stringify({
                chatInput: '/start',
                systemPrompt,
                dialogHistory: '',
                sessionId: clientSessionId,
                requestId
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const assistantMessage = await readWebhookResponse(response);
        if (!assistantMessage) {
            console.warn('Empty webhook response for /start.');
            loadingMsg.remove();
            addMessage('Ошибка: что-то сломалось. Обратитесь к администратору сайта.', 'error', false);
            return;
        }
        
        loadingMsg.remove();
        addMessage(assistantMessage, 'assistant', true);
        conversationHistory.push({ role: 'assistant', content: assistantMessage });
        updatePromptLock();
        updateSendBtnState();
        
    } catch (error) {
        console.error('Error:', error);
        loadingMsg.remove();
        addMessage(`Ошибка: ${error.message}`, 'error', false);
    }
}

function removeReratePrompt() {
    if (reratePromptElement) {
        reratePromptElement.remove();
        reratePromptElement = null;
    }
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
    unlockDialogInput();
    removeReratePrompt();
}

function buildDialogText() {
    let dialogText = '';
    conversationHistory.forEach((msg) => {
        const role = msg.role === 'user' ? 'Менеджер' : 'Клиент';
        dialogText += `${role}: ${msg.content}\n\n`;
    });
    return dialogText.trim();
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
    try {
        if (!attestationQueue.length) {
            localStorage.removeItem(ATTESTATION_QUEUE_STORAGE_KEY);
            return;
        }
        localStorage.setItem(ATTESTATION_QUEUE_STORAGE_KEY, JSON.stringify(attestationQueue));
    } catch (error) {
        console.error('Failed to persist attestation queue:', error);
    }
}

function loadAttestationQueue() {
    try {
        const raw = localStorage.getItem(ATTESTATION_QUEUE_STORAGE_KEY);
        if (!raw) {
            attestationQueue = [];
            return;
        }
        const parsed = JSON.parse(raw);
        const normalized = Array.isArray(parsed)
            ? parsed.map(normalizeAttestationQueueItem).filter(Boolean)
            : [];
        attestationQueue = normalized;
        if (normalized.length !== (Array.isArray(parsed) ? parsed.length : 0)) {
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
        try {
            const response = await fetchWithTimeout(ATTESTATION_WEBHOOK_URL, {
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
            });

            if (!response.ok) {
                const err = new Error(`HTTP ${response.status}`);
                err.httpStatus = response.status;
                throw err;
            }
            return true;
        } catch (error) {
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

async function requestRatingWithRetry(dialogText, raterPrompt, maxAttempts = RATING_SEND_ATTEMPTS) {
    const requestId = buildRequestId('rating');
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            const response = await fetchWithTimeout(RATE_WEBHOOK_URL, {
                method: 'POST',
                headers: buildJsonRequestHeaders(requestId, 'rating'),
                body: JSON.stringify({
                    dialog: dialogText,
                    raterPrompt,
                    sessionId: raterSessionId,
                    requestId,
                    attempt,
                    sentAt: new Date().toISOString()
                })
            });

            if (!response.ok) {
                const err = new Error(`HTTP ${response.status}`);
                err.httpStatus = response.status;
                throw err;
            }

            let ratingMessage = await readWebhookResponse(response);
            ratingMessage = normalizeStructuredJsonText(ratingMessage);
            if (/^\s*<!doctype|^\s*<html/i.test(ratingMessage || '')) {
                const err = new Error('Некорректный ответ сервера оценки');
                err.httpStatus = 502;
                throw err;
            }
            if (!ratingMessage || ratingMessage.trim() === '') {
                const err = new Error('Пустой ответ');
                err.httpStatus = 204;
                throw err;
            }
            return ratingMessage.trim();
        } catch (error) {
            lastError = error;
            if (attempt >= maxAttempts || !isRetryableRatingError(error)) {
                throw lastError;
            }
            console.warn(`Rating webhook attempt ${attempt}/${maxAttempts} failed, retrying...`, error);
            const baseDelay = Math.min(
                RATING_SEND_RETRY_MAX_MS,
                RATING_SEND_RETRY_BASE_MS * Math.pow(2, attempt - 1)
            );
            const jitter = Math.floor(Math.random() * 250);
            await delay(baseDelay + jitter);
        }
    }

    throw lastError || new Error('Не удалось получить оценку');
}

async function rateChat(options = {}) {
    const { force = false } = options;
    if (conversationHistory.length === 0) {
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

    const raterPrompt = validatePromptBeforeWebhook('rater', raterPromptInput.value);
    if (!raterPrompt) return;
    
    rateChatBtn.disabled = true;
    rateChatBtn.classList.add('loading');
    aiAssistBtn.disabled = true;
    toggleInputState(false);
    
    const loadingMsg = addMessage('', 'loading');
    
    try {
        const dialogText = buildDialogText();
        const ratingMessage = await requestRatingWithRetry(dialogText, raterPrompt, RATING_SEND_ATTEMPTS);
        
        loadingMsg.remove();
        lastRating = ratingMessage;
        const ratingMsgElement = addMessage(ratingMessage, 'rating', true);
        
        // Add button to improve manager prompt based on rating
        addImproveFromRatingButton(dialogText, ratingMessage);
        
        isDialogRated = true;
        lockDialogInput();
        rateChatBtn.classList.add('rated');
        if (isAttestationMode) {
            sendAttestationResult(dialogText, ratingMessage);
        }
        
    } catch (error) {
        console.error('Rating error details:', error);
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
        loadingMsg.remove();
        addMessage(`Ошибка оценки: ${error.message}. Проверьте консоль (F12) для деталей.`, 'error', false);
    } finally {
        rateChatBtn.disabled = false;
        rateChatBtn.classList.remove('loading');
        aiAssistBtn.disabled = false;
        if (!lastRating) {
            toggleInputState(true);
            userInput.focus();
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
        <div style="font-size: 13px; color: #cfcfcf; text-align: center; margin-bottom: 8px;">
            Улучшение ИИ-менеджера (автоответ клиенту) использовать только в полностью сгенерированных диалогах
        </div>
        <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
            <button class="btn-improve-from-rating" data-role="manager">Менеджер</button>
            <button class="btn-improve-from-rating" data-role="manager_call">Менеджер звонок</button>
            <button class="btn-improve-from-rating" data-role="client">Клиент</button>
            <button class="btn-improve-from-rating" data-role="rater">Оценщик</button>
        </div>
    `;
    
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
        managerName: localStorage.getItem('managerName') || '',
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
    if (typeof docx === 'undefined') {
        throw new Error('docx library not loaded');
    }
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
    const rawName = options.managerName || localStorage.getItem('managerName') || '';
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

    const basePrompt = validatePromptBeforeWebhook('manager', managerPromptInput.value);
    if (!basePrompt) return;
    
    aiAssistBtn.disabled = true;
    rateChatBtn.disabled = true;
    aiAssistBtn.classList.add('loading');
    
    try {
        let dialogHistory = '';
        conversationHistory.forEach((msg) => {
            const role = msg.role === 'user' ? 'Менеджер' : 'Клиент';
            dialogHistory += `${role}: ${msg.content}\n\n`;
        });
        
        const lastMessage = conversationHistory[conversationHistory.length - 1].content;
        const managerName = getManagerName();
        const fullPrompt = `Тебя зовут ${managerName}.\n\n${basePrompt}`;
        const requestId = buildRequestId('manager_assist');
        
        const response = await fetchWithTimeout(MANAGER_ASSISTANT_WEBHOOK_URL, {
            method: 'POST',
            headers: buildJsonRequestHeaders(requestId, 'manager_assist'),
            body: JSON.stringify({
                systemPrompt: fullPrompt,
                userMessage: lastMessage,
                dialogHistory: dialogHistory.trim(),
                sessionId: managerSessionId,
                requestId
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const aiMessage = await readWebhookResponse(response);
        if (!aiMessage) throw new Error('Пустой ответ');
        
        const cleanedMessage = aiMessage.trim().replace(/^["']|["']$/g, '').replace(/^(Менеджер|Manager):\s*/i, '');
        
        userInput.value = cleanedMessage;
        autoResizeTextarea(userInput);
        updateSendBtnState(); // Активируем кнопку отправки
        userInput.focus();
        
    } catch (error) {
        console.error('AI generation error:', error);
        alert('Ошибка: ' + error.message);
    } finally {
        aiAssistBtn.disabled = false;
        rateChatBtn.disabled = false;
        aiAssistBtn.classList.remove('loading');
    }
}

// Initialize button state
updateSendBtnState();

// ============ EXPORT FUNCTIONS ============

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
    saveAs(blob, filename + '.txt');
}

function exportToDocx(messages, filename) {
    if (typeof docx === 'undefined') { alert('docx library not loaded'); return; }
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = docx;
    
    const children = [new Paragraph({ text: "История диалога", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { after: 400 } })];
    
    messages.forEach(msg => {
        const isRating = msg.role === 'ОЦЕНКА ДИАЛОГА';
        children.push(new Paragraph({ children: [new TextRun({ text: msg.role + ":", bold: true, size: 24, color: isRating ? "FF9900" : "2E74B5" })], spacing: { before: 200, after: 100 } }));
        children.push(new Paragraph({ children: [new TextRun({ text: msg.content, size: 24 })], spacing: { after: 200 } }));
    });

    const doc = new Document({ sections: [{ properties: {}, children: children }] });
    Packer.toBlob(doc).then(blob => saveAs(blob, filename + ".docx"));
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
    saveAs(blob, filename + ".rtf");
}

function exportToPdf(messages, filename) {
    const content = messages.map(msg => {
        const roleColor = msg.role === 'ОЦЕНКА ДИАЛОГА' ? '#ff9900' : '#2e74b5';
        return `<div style="margin-bottom: 16px;"><strong style="color: ${roleColor};">${msg.role}:</strong><br>${msg.content.replace(/\n/g, '<br>')}</div>`;
    }).join('');
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${filename}</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; line-height: 1.6; }
                h1 { text-align: center; margin-bottom: 30px; }
            </style>
        </head>
        <body>
            <h1>История диалога</h1>
            ${content}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => {
        printWindow.print();
    };
}

function exportPromptToPdf(text, filename) {
    const content = renderMarkdown(text);
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${filename}</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; line-height: 1.6; }
                h1, h2, h3 { margin-top: 24px; margin-bottom: 12px; }
                ul, ol { margin: 12px 0; padding-left: 24px; }
                li { margin-bottom: 6px; }
                code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }
                pre { background: #f5f5f5; padding: 16px; border-radius: 6px; overflow-x: auto; }
                blockquote { border-left: 3px solid #667eea; padding-left: 16px; margin: 16px 0; color: #555; }
            </style>
        </head>
        <body>
            ${content}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => {
        printWindow.print();
    };
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
                ? 'промпт-менеджера-звонка'
                : 'промпт-оценщика';
    const activeVar = promptsData[role].variations.find(v => v.id === promptsData[role].activeId);
    if (activeVar) fileName += `-${activeVar.name.replace(/\s+/g, '_')}`;
    
    const timestamp = new Date().toLocaleString().replace(/[:.]/g, '-');
    const fullFileName = `${fileName} ${timestamp}`;
    
    if (format === 'clipboard') copyPromptToClipboard(promptText, fileName);
    else if (format === 'txt') { const blob = new Blob([promptText], { type: 'text/plain;charset=utf-8' }); saveAs(blob, fullFileName + '.txt'); }
    else if (format === 'docx') exportPromptToDocx(promptText, fullFileName);
    else if (format === 'rtf') exportPromptToRtf(promptText, fullFileName);
    else if (format === 'pdf') exportPromptToPdf(promptText, fullFileName);
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
    if (typeof docx === 'undefined') { alert('docx library not loaded'); return; }
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docx;
    
    const children = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
        const trimmed = line.trim();
        
        // Handle empty lines with minimal spacing
        if (trimmed === '') {
            children.push(new Paragraph({ text: '', spacing: { after: 100 } }));
            return;
        }
        
        // Base paragraph options
        let paraOpts = {
            spacing: { after: 120 },
            children: []
        };

        // Markdown headings
        if (line.startsWith('# ')) {
            paraOpts.children = [new TextRun({ text: line.slice(2), bold: true, size: 32 })];
            paraOpts.spacing = { before: 280, after: 140 };
        } else if (line.startsWith('## ')) {
            paraOpts.children = [new TextRun({ text: line.slice(3), bold: true, size: 28 })];
            paraOpts.spacing = { before: 240, after: 120 };
        } else if (line.startsWith('### ')) {
            paraOpts.children = [new TextRun({ text: line.slice(4), bold: true, size: 26 })];
            paraOpts.spacing = { before: 200, after: 100 };
        }
        // **ЗАГОЛОВОК** на отдельной строке (может содержать скобки и другие символы)
        else if (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length > 4) {
            const headerText = trimmed.slice(2, -2);
            if (!headerText.includes('**')) {
                paraOpts.children = [new TextRun({ text: headerText, bold: true, size: 28 })];
                paraOpts.spacing = { before: 240, after: 120 };
        } else {
                paraOpts.children = parseStyledText(line, TextRun);
            }
        }
        // Маркированный список
        else if (line.startsWith('- ') || line.startsWith('* ')) {
            const listContent = line.slice(2);
            paraOpts.indent = { left: 360 };
            paraOpts.children = [new TextRun({ text: '• ', size: 24 }), ...parseStyledText(listContent, TextRun)];
        }
        // Нумерованный список
        else if (/^\d+\.\s/.test(line)) {
            const match = line.match(/^(\d+\.)\s(.*)$/);
            if (match) {
                paraOpts.indent = { left: 360 };
                paraOpts.children = [new TextRun({ text: match[1] + ' ', size: 24 }), ...parseStyledText(match[2], TextRun)];
            }
        }
        // Обычный текст с markdown
        else {
            paraOpts.children = parseStyledText(line, TextRun);
        }
        
        children.push(new Paragraph(paraOpts));
    });

    const doc = new Document({ sections: [{ properties: {}, children: children }] });
    Packer.toBlob(doc).then(blob => saveAs(blob, filename + ".docx"));
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
    saveAs(blob, filename + ".rtf");
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

    if (canCache) {
        setCachedMarkdown(cleanText, html);
    }
    return html;
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
        
    // Reset editing flag after sync is complete
    clearTimeout(editingTimeout);
    editingTimeout = setTimeout(() => {
        isUserEditing = false;
        debugLog('isUserEditing set to false (timeout)');
    }, 5000); // Increased to 5s to prevent race conditions with Firebase echo
}, 300);
        
// Force immediate sync of current editor content
function syncCurrentEditorNow() {
    const role = getActiveRole();
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
        syncContentToData(role, markdown);
    }
}

function setupWYSIWYG(previewElement, textarea, callback) {
    previewElement.setAttribute('contenteditable', 'true');
    
    previewElement.addEventListener('input', () => {
        isUserEditing = true;
        syncWYSIWYGDebounced(previewElement, textarea, callback);
});

    previewElement.addEventListener('focus', () => {
        isUserEditing = true;
});

    previewElement.addEventListener('blur', () => {
        // Delay resetting the flag to allow sync to complete
        setTimeout(() => {
            isUserEditing = false;
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
                tempDiv.innerHTML = html;
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

    setupWYSIWYG(promptPreviewByRole.client, systemPromptInput, (c) => syncContentToData('client', c));
    setupWYSIWYG(promptPreviewByRole.manager, managerPromptInput, (c) => syncContentToData('manager', c));
    setupWYSIWYG(promptPreviewByRole.manager_call, managerCallPromptInput, (c) => syncContentToData('manager_call', c));
    setupWYSIWYG(promptPreviewByRole.rater, raterPromptInput, (c) => syncContentToData('rater', c));
}

// ============ DRAG & DROP ============

function handleFileDrop(file, textarea, previewElement) {
            const fileName = file.name.toLowerCase();
            
            if (fileName.endsWith('.docx')) {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
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
    if (sendBtn.dataset.mode === 'voice') {
        showVoiceModeModal();
        return;
    }
    sendMessage();
}

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
        isUserEditing = true;
        const wrapper = input.closest('.prompt-wrapper');
        if (wrapper) {
            const role = wrapper.dataset.instruction;
            syncContentToData(role, input.value);
        }
        // Reset editing flag after a delay
        clearTimeout(editingTimeout);
        editingTimeout = setTimeout(() => {
            isUserEditing = false;
        }, 2000);
    });
    
    input.addEventListener('focus', () => {
        isUserEditing = true;
    });
    
    input.addEventListener('blur', () => {
        setTimeout(() => {
            isUserEditing = false;
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
        else if (action === 'h1') document.execCommand('formatBlock', false, 'h1');
        else if (action === 'h2') document.execCommand('formatBlock', false, 'h2');
        else if (action === 'h3') document.execCommand('formatBlock', false, 'h3');
        else if (action === 'quote') {
            if (isSelectionInsideTag(preview, 'blockquote')) {
                const removed = document.execCommand('outdent', false, null);
                if (!removed) {
                    document.execCommand('formatBlock', false, 'p');
                }
            } else {
                document.execCommand('formatBlock', false, 'blockquote');
            }
        }
        else if (action === 'hr') document.execCommand('insertHorizontalRule', false, null);
    });
});
                
// Cloud save button - REMOVED
// Autosave is handled by debounce logic

// ============ INITIALIZATION ============

loadAttestationQueue();
loadPrompts().catch((error) => {
    console.error('Initialization auth/prompts error:', error);
    showNameModal();
});
initSpeechRecognition();
userInput.focus();
autoResizeTextarea(userInput);
prepareCustomTooltips();
initCustomTooltipLayer();
updateVoiceModeControls();
setVoiceModeStatus('', 'idle');

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
}, 200);
