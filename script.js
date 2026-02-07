import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

// Initialize Firebase
let db = null;
try {
    if (firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("EXAMPLE")) {
        const app = initializeApp(firebaseConfig);
        db = getDatabase(app);
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

// Generate unique session ID
let baseSessionId = localStorage.getItem('sessionId');
if (!baseSessionId) {
    baseSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('sessionId', baseSessionId);
}
let clientSessionId = baseSessionId + '_client';
let managerSessionId = baseSessionId + '_manager';
let raterSessionId = baseSessionId + '_rater';

const TEXT_EXTENSIONS = ['.txt', '.md', '.json', '.xml', '.csv', '.html', '.htm', '.rtf', '.log'];
const ENABLE_AGENT_LOGS = false;
const AGENT_LOG_WEBHOOK_URL = 'http://127.0.0.1:7243/ingest/987d1d6f-727d-4fc5-a54f-c42484f79884';

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
    console.log(`[Fetch] Starting request to: ${url.substring(0, 50)}... with timeout: ${timeoutMs/1000}s`);
    const startTime = Date.now();
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[Fetch] Request completed in ${duration}s`);
        return response;
        
    } catch (error) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.error(`[Fetch] Request failed after ${duration}s:`, error);
        
        if (error.name === 'AbortError') {
            throw new Error(`Таймаут запроса (${timeoutMs/1000}с). Проверьте n8n workflow.`);
        }
        throw error;
    }
}

// DOM Elements
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const clearChatBtn = document.getElementById('clearChat');
const systemPromptInput = document.getElementById('systemPrompt');
const raterPromptInput = document.getElementById('raterPrompt');
const managerPromptInput = document.getElementById('managerPrompt');
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
const modalNameSubmit = document.getElementById('modalNameSubmit');
const nameModalStep1 = document.getElementById('nameModalStep1');
const nameModalStep2 = document.getElementById('nameModalStep2');
const roleUserBtn = document.getElementById('roleUserBtn');
const roleAdminBtn = document.getElementById('roleAdminBtn');
const modalPasswordInput = document.getElementById('modalPasswordInput');
const modalPasswordSubmit = document.getElementById('modalPasswordSubmit');
const modalPasswordBack = document.getElementById('modalPasswordBack');
const passwordError = document.getElementById('passwordError');
const promptVariationsContainer = document.getElementById('promptVariations');

// AI Improve Modal Elements
const aiImproveBtn = document.getElementById('aiImproveBtn');
const aiImproveModal = document.getElementById('aiImproveModal');
const aiImproveModalClose = document.getElementById('aiImproveModalClose');
const aiImproveModalTitle = document.getElementById('aiImproveModalTitle');
const aiImproveModalDescription = document.getElementById('aiImproveModalDescription');

const aiImproveStep1 = document.getElementById('aiImproveStep1');
const aiImproveInput = document.getElementById('aiImproveInput');
const aiImproveSubmit = document.getElementById('aiImproveSubmit');
const aiImproveCancel = document.getElementById('aiImproveCancel');

const aiImproveStep2 = document.getElementById('aiImproveStep2');
const aiDiffView = document.getElementById('aiDiffView');
const aiImproveBack = document.getElementById('aiImproveBack');
const aiImproveApply = document.getElementById('aiImproveApply');

// Settings Modal Elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const currentUserName = document.getElementById('currentUserName');
const settingsNameInput = document.getElementById('settingsNameInput');
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
const promptChangesList = document.getElementById('promptChangesList');
const changesSection = document.querySelector('.changes-section');
const exportMenu = document.getElementById('exportMenu');
const exportPromptMenu = document.getElementById('exportPromptMenu');
const exportChatSettingsMenu = document.getElementById('exportChatSettingsMenu');
const exportPromptSettingsMenu = document.getElementById('exportPromptSettingsMenu');
const instructionSelectEl = document.getElementById('instructionSelect');
const panelsContainer = document.querySelector('.panels-container');
const instructionsPanelElement = document.getElementById('instructionsPanel');

const promptInputsByRole = {
    client: systemPromptInput,
    manager: managerPromptInput,
    rater: raterPromptInput
};

const promptPreviewByRole = {
    client: document.getElementById('systemPromptPreview'),
    manager: document.getElementById('managerPromptPreview'),
    rater: document.getElementById('raterPromptPreview')
};

let pendingImprovedPrompt = null;
let pendingRole = null;
let pendingName = null;
let pendingRatingImproveContext = null;
let aiImproveMode = 'default';
const LOCAL_PROMPTS_STORAGE_VERSION = 'v2';
const HISTORY_LIMIT = 50;
let promptHistory = [];
let lastHistoryContent = {
    client: {},
    manager: {},
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
let selectedRole = null; // 'user' or 'admin'
const ADMIN_PASSWORD = '1357246';
let lockedPromptRole = null;
let lockedPromptVariationId = null;
let publicActiveIds = {
    client: null,
    manager: null,
    rater: null
};
const PROMPT_ROLES = ['client', 'manager', 'rater'];

// Prompt Variations Data
let promptsData = {
    client: { variations: [], activeId: null },
    manager: { variations: [], activeId: null },
    rater: { variations: [], activeId: null }
};

// Check if current user is admin
function isAdmin() {
    return selectedRole === 'admin' || localStorage.getItem('userRole') === 'admin';
}

// Apply role-based restrictions
function applyRoleRestrictions() {
    const isAdminUser = isAdmin();

    document.body.classList.toggle('user-mode', !isAdminUser);
    
    if (!isAdminUser) {
        console.log('User mode: Prompts are read-only');
        
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

        if (changesSection) {
            changesSection.style.display = 'none';
        }

        if (exitAttestationBtn) {
            exitAttestationBtn.style.display = '';
        }
        if (startAttestationBtn) {
            startAttestationBtn.style.display = isAttestationMode ? 'none' : '';
        }
        
    } else {
        console.log('Admin mode: Full editing access');
        if (exportPromptSettings) {
            exportPromptSettings.style.display = '';
        }
        if (changesSection) {
            changesSection.style.display = 'block';
        }
        if (exitAttestationBtn) {
            exitAttestationBtn.style.display = '';
        }
        if (startAttestationBtn) {
            startAttestationBtn.style.display = isAttestationMode ? 'none' : '';
        }
    }

    updatePromptVisibilityButton();
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

const TOOLTIP_SHOW_DELAY_MS = 320;
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

    tooltipLayer.style.left = `${Math.round(left)}px`;
    tooltipLayer.style.top = `${Math.round(top)}px`;
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
    tooltipLayer.style.left = '-9999px';
    tooltipLayer.style.top = '-9999px';
    positionTooltipLayer(target);

    requestAnimationFrame(() => {
        if (!tooltipLayer || tooltipActiveTarget !== target) return;
        tooltipLayer.classList.add('visible');
    });
}

function scheduleTooltip(target) {
    clearTooltipTimers();
    if (!target) return;

    if (tooltipActiveTarget === target && tooltipLayer && !tooltipLayer.hidden) {
        positionTooltipLayer(target);
        return;
    }

    tooltipShowTimer = setTimeout(() => {
        showTooltip(target);
    }, TOOLTIP_SHOW_DELAY_MS);
}

function hideTooltip(immediate = false) {
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

    if (tooltipHideTimer) {
        clearTimeout(tooltipHideTimer);
    }
    tooltipHideTimer = setTimeout(() => {
        if (!tooltipLayer.classList.contains('visible')) {
            if (SUPPORTS_POPOVER && isTooltipPopoverOpen()) {
                try {
                    tooltipLayer.hidePopover();
                } catch (e) {}
            }
            if (!SUPPORTS_POPOVER) {
                tooltipLayer.hidden = true;
            }
        }
    }, 180);
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
        hideTooltip();
    }, true);

    document.addEventListener('focusin', (event) => {
        const target = getTooltipTarget(event.target);
        if (!target) return;
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
    return 'var_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
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
    promptVisibilityBtn.textContent = isLocal ? '🙈' : '👁';
    promptVisibilityBtn.classList.toggle('state-hidden', isLocal);
    const tooltipText = isLocal
        ? 'Показать промпт пользователям'
        : 'Скрыть промпт от пользователей';
    setCustomTooltip(promptVisibilityBtn, tooltipText);
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
    for (const role of PROMPT_ROLES) {
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

function updateSendBtnState() {
    sendBtn.disabled = !userInput.value.trim() || isProcessing || isDialogRated;
}

function lockDialogInput() {
    userInput.disabled = true;
    sendBtn.disabled = true;
    voiceBtn.disabled = true;
    aiAssistBtn.disabled = true;
    // rateChatBtn stays enabled so user can cancel the rating
    rateChatBtn.disabled = false;
    userInput.placeholder = 'Очистите чат для нового диалога';
    userInput.classList.add('disabled');
}

function unlockDialogInput() {
    userInput.disabled = false;
    voiceBtn.disabled = false;
    aiAssistBtn.disabled = false;
    rateChatBtn.disabled = false;
    userInput.placeholder = '';
    userInput.classList.remove('disabled');
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
        const legacyKey = role === 'client' ? 'systemPrompt' : role + 'Prompt';
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
    if (role === 'rater') return 'Оценщик';
    return role;
}

function renderPromptHistory() {
    if (!promptChangesList) return;
    const isAdminUser = isAdmin();
    if (changesSection) {
        changesSection.style.display = isAdminUser ? 'block' : 'none';
    }
    if (!isAdminUser) return;

    if (!promptHistory.length) {
        promptChangesList.innerHTML = '<div class="changes-empty">Пока нет изменений.</div>';
        return;
    }

    const items = promptHistory.slice(0, HISTORY_LIMIT);
    promptChangesList.innerHTML = '';
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
            restorePromptVersion(entry.id);
        });
        prepareCustomTooltips(item);
        promptChangesList.appendChild(item);
    });
}

function savePromptHistory() {
    if (!promptHistory) return;
    if (promptHistory.length > HISTORY_LIMIT) {
        promptHistory = promptHistory.slice(0, HISTORY_LIMIT);
    }
    if (db) {
        set(ref(db, 'prompt_history'), promptHistory)
            .then(() => console.log('Prompt history synced'))
            .catch(e => console.error('Failed to sync history:', e));
                } else {
        localStorage.setItem('promptHistory', JSON.stringify(promptHistory));
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
    renderPromptHistory();
}

function restorePromptVersion(entryId) {
    if (!isAdmin()) return;
    const entry = promptHistory.find(item => item.id === entryId);
    if (!entry) return;

    const role = entry.role;
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
    }
}

function getActiveContent(role) {
    const v = promptsData[role].variations.find(v => v.id === promptsData[role].activeId);
    return v ? v.content : '';
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
        rater_prompt: getPublicActiveContent('rater'),

        client_variations: getPublicVariations('client'),
        client_activeId: getPublicActiveId('client'),
        manager_variations: getPublicVariations('manager'),
        manager_activeId: getPublicActiveId('manager'),
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
        .then(() => console.log('Prompts synced to Firebase'))
        .catch(e => console.error('Failed to sync:', e));
}

function loadPrompts() {
    // Load manager name
    const savedManagerName = localStorage.getItem('managerName');
    const savedRole = localStorage.getItem('userRole');
    
    if (savedManagerName && savedRole) {
        managerNameInput.value = savedManagerName;
        selectedRole = savedRole;
        console.log(`Welcome back, ${savedManagerName} (${savedRole})`);
        
        // Update user name display
        updateUserNameDisplay();
        
        // Apply role-based restrictions
        applyRoleRestrictions();
    } else {
        showNameModal();
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
                console.log('Firebase data received:', data);
                
                // Skip update if user is currently editing
                if (isUserEditing) {
                    console.log('Skipping Firebase update - user is editing');
                    return;
                }
                
                // Skip if data hasn't changed
                const dataStr = JSON.stringify(data);
                if (lastFirebaseData === dataStr) {
                    console.log('Skipping Firebase update - data unchanged');
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

function showNameModal() {
    nameModal.classList.add('active');
    setTimeout(() => modalNameInput.focus(), 100);
}

function hideNameModal() {
    nameModal.classList.remove('active');
}

// Role selection
roleUserBtn.addEventListener('click', () => {
    selectedRole = 'user';
    roleUserBtn.classList.add('selected');
    roleAdminBtn.classList.remove('selected');
    modalNameSubmit.disabled = false;
});

roleAdminBtn.addEventListener('click', () => {
    selectedRole = 'admin';
    roleAdminBtn.classList.add('selected');
    roleUserBtn.classList.remove('selected');
    modalNameSubmit.disabled = false;
});

// Step 1: Name and role selection
modalNameSubmit.addEventListener('click', () => {
    const name = modalNameInput.value.trim();
    
    if (!name) {
        modalNameInput.focus();
        modalNameInput.style.borderColor = '#ff5555';
        setTimeout(() => { modalNameInput.style.borderColor = ''; }, 1000);
        return;
    }
    
    if (!selectedRole) {
        alert('Выберите роль');
        return;
    }
    
    // Save name
    localStorage.setItem('managerName', name);
    managerNameInput.value = name;
    
    if (selectedRole === 'user') {
        // User - go straight to platform
        localStorage.setItem('userRole', 'user');
        hideNameModal();
        updateUserNameDisplay();
        applyRoleRestrictions();
    } else {
        // Admin - ask for password
        nameModalStep1.style.display = 'none';
        nameModalStep2.style.display = 'block';
        setTimeout(() => modalPasswordInput.focus(), 100);
    }
});

modalNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') modalNameSubmit.click();
});

// Step 2: Admin password verification
modalPasswordSubmit.addEventListener('click', () => {
    const password = modalPasswordInput.value.trim();
    
    if (password === ADMIN_PASSWORD) {
        // Correct password
        localStorage.setItem('userRole', 'admin');
        selectedRole = 'admin';
        hideNameModal();
        updateUserNameDisplay();
        applyRoleRestrictions();
        // Reset modal for next time
        nameModalStep1.style.display = 'block';
        nameModalStep2.style.display = 'none';
        modalPasswordInput.value = '';
        passwordError.style.display = 'none';
    } else {
        // Wrong password
        passwordError.style.display = 'block';
        modalPasswordInput.value = '';
        modalPasswordInput.focus();
        modalPasswordInput.style.borderColor = '#ff5555';
        setTimeout(() => { 
            modalPasswordInput.style.borderColor = '';
            passwordError.style.display = 'none';
        }, 2000);
    }
});

modalPasswordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') modalPasswordSubmit.click();
});

// Back button in password step
modalPasswordBack.addEventListener('click', () => {
    nameModalStep1.style.display = 'block';
    nameModalStep2.style.display = 'none';
    modalPasswordInput.value = '';
    passwordError.style.display = 'none';
});

managerNameInput.addEventListener('input', () => {
    const name = managerNameInput.value.trim();
    if (name) localStorage.setItem('managerName', name);
});

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

function showAiImproveModal(options = {}) {
    const { mode = 'default', context = null } = options;
    aiImproveMode = mode;
    pendingRatingImproveContext = mode === 'rating' ? context : null;
    setAiImproveModalContent(mode);

    aiImproveModal.classList.add('active');
    
    // Reset to step 1
    aiImproveStep1.style.display = 'block';
    aiImproveStep2.style.display = 'none';
    pendingImprovedPrompt = null;
    aiImproveInput.value = '';
    
    setTimeout(() => aiImproveInput.focus(), 100);
}

function hideAiImproveModal() {
    aiImproveModal.classList.remove('active');
    pendingRatingImproveContext = null;
    aiImproveMode = 'default';
    setAiImproveModalContent('default');
}

// ============ SETTINGS MODAL FUNCTIONS ============

function showSettingsModal() {
    const savedName = localStorage.getItem('managerName') || '';
    const userRole = localStorage.getItem('userRole') || 'user';
    
    settingsNameInput.value = savedName;
    autoResizeNameInput();
    currentRoleDisplay.textContent = userRole === 'admin' ? 'Админ' : 'Юзер';
    
    // Hide password section
    roleChangePassword.style.display = 'none';
    roleChangePasswordInput.value = '';
    roleChangeError.style.display = 'none';
    
    settingsModal.classList.add('active');
    renderPromptHistory();
}

const nameInputMeasureCanvas = document.createElement('canvas');
const nameInputMeasureCtx = nameInputMeasureCanvas.getContext('2d');

function autoResizeNameInput() {
    const input = settingsNameInput;
    const text = input.value || input.placeholder;
    if (!nameInputMeasureCtx) return;
    nameInputMeasureCtx.font = getComputedStyle(input).font;
    const width = nameInputMeasureCtx.measureText(text).width;
    input.style.width = Math.max(60, width + 24) + 'px';
}

function hideSettingsModal() {
    settingsModal.classList.remove('active');
    }

function updateUserNameDisplay() {
    const name = localStorage.getItem('managerName') || 'Гость';
    const role = localStorage.getItem('userRole') || 'user';
    const roleIcon = role === 'admin' ? '🔑' : '👤';
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
        const roleLabel = role === 'client' ? 'клиента' : role === 'manager' ? 'менеджера' : 'оценщика';
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
        const response = await fetchWithTimeout(AI_IMPROVE_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userMessage
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
            console.log('Response is not JSON, treating as raw text');
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

function applyImprovedPrompt() {
    if (!pendingImprovedPrompt || !pendingRole) return;
    
    const newId = generateId();
    const newName = `${pendingName} AI`;
    const baseVariation = promptsData[pendingRole].variations.find(v => v.id === promptsData[pendingRole].activeId);
    const shouldBeLocal = !!baseVariation?.isLocal;
    
    promptsData[pendingRole].variations.push({
        id: newId,
        name: newName,
        content: pendingImprovedPrompt,
        isLocal: shouldBeLocal
    });
    
    // Switch to the correct instruction tab (client/manager/rater)
    const instructionTabs = document.querySelectorAll('.instruction-tab');
    const instructionEditors = document.querySelectorAll('.instruction-editor');
    
    instructionTabs.forEach(tab => {
        if (tab.dataset.instruction === pendingRole) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    instructionEditors.forEach(editor => {
        if (editor.dataset.instruction === pendingRole) {
            editor.classList.add('active');
        } else {
            editor.classList.remove('active');
        }
    });
    
    // Switch to new variation and render
    setActiveVariation(pendingRole, newId);
    renderVariations();
    if (shouldBeLocal) {
        saveLocalPromptsData();
    } else {
        savePromptsToFirebase();
    }
    
    hideAiImproveModal();
    aiImproveInput.value = ''; // Clear input after successful apply
    showCopyNotification('Инструкция улучшена!');
    
    // Reset pending
    pendingImprovedPrompt = null;
    pendingRole = null;
    pendingName = null;
}

aiImproveBtn.addEventListener('click', showAiImproveModal);
if (promptVisibilityBtn) {
    promptVisibilityBtn.addEventListener('click', toggleActivePromptVisibility);
}
aiImproveModalClose.addEventListener('click', hideAiImproveModal);
aiImproveCancel.addEventListener('click', hideAiImproveModal);
aiImproveSubmit.addEventListener('click', improvePromptWithAI);

aiImproveBack.addEventListener('click', () => {
    aiImproveStep1.style.display = 'block';
    aiImproveStep2.style.display = 'none';
});

aiImproveApply.addEventListener('click', applyImprovedPrompt);

aiImproveInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        improvePromptWithAI();
    }
});

// ============ SETTINGS MODAL EVENT LISTENERS ============

settingsBtn.addEventListener('click', showSettingsModal);

// Close settings modal on overlay click
settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        hideSettingsModal();
    }
});

// Автосохранение имени при вводе
settingsNameInput.addEventListener('input', () => {
    autoResizeNameInput();
    const newName = settingsNameInput.value.trim();
    if (newName) {
        localStorage.setItem('managerName', newName);
        managerNameInput.value = newName;
        updateUserNameDisplay();
    }
});

// Theme toggle
themeToggle.addEventListener('change', () => {
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
    const currentRole = localStorage.getItem('userRole') || 'user';
    
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
function switchRole(newRole) {
    localStorage.setItem('userRole', newRole);
    
    // Перезагрузка страницы для применения новой роли
    location.reload();
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
    updatePromptLock();
    unlockDialogInput();
    rateChatBtn.classList.remove('rated');
    
    baseSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('sessionId', baseSessionId);
    clientSessionId = baseSessionId + '_client';
    managerSessionId = baseSessionId + '_manager';
    raterSessionId = baseSessionId + '_rater';
    
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
    
    isProcessing = true;
    toggleInputState(false);
    
    const startDiv = document.getElementById('startConversation');
    if (startDiv) startDiv.style.display = 'none';
    
    addMessage(userMessage, 'user', true);
    conversationHistory.push({ role: 'user', content: userMessage });
    updatePromptLock();
    
    userInput.value = '';
    userInput.style.height = '44px';
    
    const loadingMsg = addMessage('', 'loading');
    
    try {
        const systemPrompt = systemPromptInput.value.trim();
        let dialogHistory = '';
        conversationHistory.slice(0, -1).forEach((msg) => {
            const role = msg.role === 'user' ? 'Менеджер' : 'Клиент';
            dialogHistory += `${role}: ${msg.content}\n\n`;
        });
        
        const response = await fetchWithTimeout(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatInput: userMessage,
                systemPrompt: systemPrompt || 'Вы — клиент.',
            dialogHistory: dialogHistory.trim(),
            sessionId: clientSessionId
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
    baseSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('sessionId', baseSessionId);
    clientSessionId = baseSessionId + '_client';
    managerSessionId = baseSessionId + '_manager';
    raterSessionId = baseSessionId + '_rater';
    conversationHistory = [];
    lastRating = null;
    updatePromptLock();
    toggleInputState(true);
    
    const startDiv = document.getElementById('startConversation');
    if (startDiv) startDiv.style.display = 'none';
    
    const loadingMsg = addMessage('', 'loading');
    
    try {
        const systemPrompt = systemPromptInput.value.trim();
        const response = await fetchWithTimeout(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatInput: '/start',
                systemPrompt: systemPrompt || 'Вы — клиент.',
                dialogHistory: '',
                sessionId: clientSessionId
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
        
    } catch (error) {
        console.error('Error:', error);
        loadingMsg.remove();
        addMessage(`Ошибка: ${error.message}`, 'error', false);
    }
}

async function rateChat() {
    if (conversationHistory.length === 0) {
        alert('Нет диалога для оценки');
        return;
    }
    if (isProcessing) return;
    
    // If already rated, cancel the rating
    if (isDialogRated) {
        showCopyNotification('Оценка уже получена');
        return;
    }
    
    rateChatBtn.disabled = true;
    rateChatBtn.classList.add('loading');
    aiAssistBtn.disabled = true;
    toggleInputState(false);
    
    const loadingMsg = addMessage('', 'loading');
    
    try {
        let dialogText = '';
        conversationHistory.forEach((msg) => {
            const role = msg.role === 'user' ? 'Менеджер' : 'Клиент';
            dialogText += `${role}: ${msg.content}\n\n`;
        });
        
        const raterPrompt = raterPromptInput.value.trim() || 'Оцените качество диалога.';
        
        const response = await fetchWithTimeout(RATE_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dialog: dialogText.trim(),
                raterPrompt: raterPrompt,
                sessionId: raterSessionId
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        let ratingMessage = await readWebhookResponse(response);
        ratingMessage = normalizeStructuredJsonText(ratingMessage);
        
        if (!ratingMessage || ratingMessage.trim() === '') {
            throw new Error('Пустой ответ');
        }
        ratingMessage = ratingMessage.trim();
        
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
    try {
        const { fileName, fileBase64, fileMime } = await buildAttestationDocxPayload(dialogText, ratingText);
        const payload = {
            dialog: dialogText.trim(),
            rating: ratingText,
            clientPrompt: getActiveContent('client'),
            managerPrompt: getActiveContent('manager'),
            raterPrompt: getActiveContent('rater'),
            sessionId: raterSessionId,
            mode: 'attestation',
            fileName,
            fileBase64,
            fileMime
        };
        showCopyNotification('Отправляю отчет в Telegram...');
        try {
            await fetchWithTimeout(ATTESTATION_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            showCopyNotification('Отчет отправлен в Telegram');
            return;
        } catch (primaryError) {
            console.warn('Attestation primary send failed, trying fallback:', primaryError);
        }
        await fetch(ATTESTATION_WEBHOOK_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        showCopyNotification('Отчет отправлен (без подтверждения)');
    } catch (error) {
        console.error('Attestation webhook error:', error);
        showCopyNotification('Ошибка отправки отчета');
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

async function buildAttestationDocxPayload(dialogText, ratingText) {
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
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rawName = localStorage.getItem('managerName') || '';
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
        const basePrompt = managerPromptInput.value.trim();
        const fullPrompt = `Тебя зовут ${managerName}.\n\n${basePrompt}`;
        
        const response = await fetchWithTimeout(MANAGER_ASSISTANT_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemPrompt: fullPrompt,
                userMessage: lastMessage,
                dialogHistory: dialogHistory.trim(),
                sessionId: managerSessionId
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
    
    let fileName = role === 'client' ? 'промпт-клиента' : role === 'manager' ? 'промпт-менеджера' : 'промпт-оценщика';
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

function renderMarkdown(text) {
    if (!text) return '<p style="color: #666; font-style: italic;">Промпт пустой...</p>';
    
    // Unescape any escaped markdown characters first
    let cleanText = unescapeMarkdown(text);
    
    if (typeof marked !== 'undefined') return marked.parse(cleanText);
    
    // Simple fallback
    return '<p>' + cleanText
        .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
        .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
        .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\n\n+/g, '</p><p>')
        .replace(/\n/g, '<br>') + '</p>';
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
        console.log('isUserEditing set to false (timeout)');
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

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
userInput.addEventListener('input', () => {
    autoResizeTextarea(userInput);
    updateSendBtnState();
    });
clearChatBtn.addEventListener('click', () => { if (confirm('Очистить чат?')) clearChat(); });
startBtn.addEventListener('click', startConversationHandler);
rateChatBtn.addEventListener('click', rateChat);
aiAssistBtn.addEventListener('click', generateAIResponse);
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

exportChatBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportMenu?.classList.toggle('show');
    });

exportCurrentPromptBtn.addEventListener('click', (e) => {
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
const instructionTabs = document.querySelectorAll('.instruction-tab');
const instructionEditors = document.querySelectorAll('.instruction-editor');

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
        
        const selectedText = document.getElementById('selectedInstructionText');
        if (selectedText) {
            const tabText = tab.innerText;
            selectedText.innerText = tabText;
        }
        
        const dropdownOptions = document.querySelectorAll('.dropdown-option');
        dropdownOptions.forEach(opt => {
            opt.classList.toggle('active', opt.dataset.value === instructionType);
        });
        
        renderVariations();
        updatePreview();
    });
});

// Instruction dropdown for compact mode (custom implementation)
const instructionDropdown = document.getElementById('instructionDropdown');
const selectedInstructionText = document.getElementById('selectedInstructionText');
const instructionOptions = document.querySelectorAll('.dropdown-option');

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
function checkTabsCompactMode() {
    if (!instructionsPanelElement) return;
    
    const panelWidth = instructionsPanelElement.getBoundingClientRect().width;
    
    // При ширине панели меньше 420px - включаем компактный режим
    instructionsPanelElement.classList.toggle('compact-tabs', panelWidth < 420);
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
[systemPromptInput, managerPromptInput, raterPromptInput].forEach(input => {
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
let recognition = null;
let isRecording = false;

function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { voiceBtn.style.display = 'none'; return; }
    
    recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onstart = () => { isRecording = true; voiceBtn.classList.add('recording'); };
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        userInput.value += (userInput.value ? ' ' : '') + transcript;
        autoResizeTextarea(userInput);
    };
    recognition.onerror = () => stopRecording();
    recognition.onend = () => stopRecording();
}

function stopRecording() {
    if (recognition && isRecording) recognition.stop();
    isRecording = false;
    voiceBtn.classList.remove('recording');
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

loadPrompts();
initSpeechRecognition();
userInput.focus();
autoResizeTextarea(userInput);
prepareCustomTooltips();
initCustomTooltipLayer();

setupDragAndDrop(systemPromptInput);
setupDragAndDrop(managerPromptInput);
setupDragAndDrop(raterPromptInput);

// Setup drag and drop for preview elements (WYSIWYG mode)
setupDragAndDropForPreview(promptPreviewByRole.client, systemPromptInput);
setupDragAndDropForPreview(promptPreviewByRole.manager, managerPromptInput);
setupDragAndDropForPreview(promptPreviewByRole.rater, raterPromptInput);

        setTimeout(() => {
    initWYSIWYGMode();
    renderVariations();
}, 200);
