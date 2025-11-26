// n8n Webhook Configuration
const WEBHOOK_URL = 'https://n8n-api.tradicia-k.ru/webhook/client-simulator';
const RATE_WEBHOOK_URL = 'https://n8n-api.tradicia-k.ru/webhook/rate-manager';
const MANAGER_ASSISTANT_WEBHOOK_URL = 'https://n8n-api.tradicia-k.ru/webhook/manager-simulator';
const SETTINGS_WEBHOOK_URL = ''; // ВСТАВЬТЕ СЮДА URL ВАШЕГО НОВОГО ВЕБХУКА ДЛЯ НАСТРОЕК

// Generate unique session ID for n8n memory (different for each agent type)
let baseSessionId = localStorage.getItem('sessionId');
if (!baseSessionId) {
    baseSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('sessionId', baseSessionId);
}
// Separate session IDs for different agents to avoid memory mixing
let clientSessionId = baseSessionId + '_client';
let managerSessionId = baseSessionId + '_manager';
let raterSessionId = baseSessionId + '_rater';

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
const voiceBtn = document.getElementById('voiceBtn');
const aiAssistBtn = document.getElementById('aiAssistBtn');
const rateChatBtn = document.getElementById('rateChat');
const startBtn = document.getElementById('startBtn');
const startConversation = document.getElementById('startConversation');
const managerNameInput = document.getElementById('managerName');
const nameModal = document.getElementById('nameModal');
const modalNameInput = document.getElementById('modalNameInput');
const modalNameSubmit = document.getElementById('modalNameSubmit');

// Default Manager Prompt Template
const DEFAULT_MANAGER_PROMPT = `Ты — профессиональный менеджер по продажам навесного оборудования (гидромолоты, гидробуры, ковши, ножницы, сваерезки, вибропогружатели) компании "Традиция-К".

ТВОЯ ЦЕЛЬ: Вести диалог так, чтобы получить максимальный балл (100/100) от строгого оценщика по всем критериям.

=== КРИТЕРИИ ОЦЕНКИ (ОБЯЗАТЕЛЬНО СОБЛЮДАЙ) ===

1. КОНТАКТ И ЭМПАТИЯ (10% веса):
   - Подключайся к запросу клиента, будь уважителен.
   - Не "ломайся" под жёстким тоном клиента — оставайся спокойным и профессиональным.
   - Проявляй человеческое отношение, не будь роботом.
   - Подстраивайся под стиль клиента: если он "на чиле" и прямолинеен, будь таким же.

2. ВЫЯВЛЕНИЕ ПОТРЕБНОСТИ (30% веса — САМЫЙ ВАЖНЫЙ!):
   - Задавай УМЕСТНЫЕ открытые вопросы, логичные уточнения.
   - Собирай ключевые техмаркеры по продукту (см. карту ниже).
   - НЕ "расстреливай" клиента длинным списком вопросов подряд.
   - Если клиент говорит "подберите сами, да пофиг" — вытягивай информацию мягко, но настойчиво.
   - Задавай 1-2 вопроса за сообщение, не больше.

3. РАБОТА С ВОЗРАЖЕНИЯМИ (20% веса):
   - Присоединяйся к возражению: "Понимаю", "Логично, что смотрите по цене", "Да, сроки важны".
   - Выясняй причину/истинность возражения: "А с чем сравниваете?", "Что именно смущает?"
   - "Расшатывай" возражение: показывай риски/альтернативы.
   - Используй аргументы по сути, не общие фразы.
   - Резюмируй и проверяй скрытые возражения.
   - На жёсткий тон реагируй корректно — без споров и обидчивости.

4. ПРЕЗЕНТАЦИЯ ЦЕННОСТИ (20% веса):
   - Связка "характеристика → отличие → выгода".
   - Привязывай к РЕАЛЬНЫМ рискам клиента: простой техники, сервис, ресурс, срок службы, риски поломок.
   - НЕ просто "у нас качественно/надёжно" — давай конкретику и понятные выгоды.
   - Объясняй "зачем", а не просто "что".

5. СЛЕДУЮЩИЙ ШАГ (10% веса):
   - Чётко завершай диалог: что делать, когда и кто.
   - Примеры: "Отправляю КП сегодня до 18:00 на почту...", "Созваниваемся завтра в 11:00...", "Высылаю счёт после согласования комплектации...".

6. КОММУНИКАЦИОННАЯ ГИГИЕНА (10% веса):
   - Ясность и структура речи.
   - Уверенный, спокойный тон.
   - Без манипулятивных клише и пустых обещаний.
   - Выдержка под давлением/наездами клиента.

=== КАРТА ВОПРОСОВ ДЛЯ ВЫЯВЛЕНИЯ ПОТРЕБНОСТИ ===

ГИДРОМОЛОТ:
- Базовая машина (марка/модель)
- Носитель/масса
- Однопоточная линия
- Поток (л/мин) / давление (бар)
- Что ломать (бетон, гранит, надгабарит)
- Режим работы (эпизодически/тяжёлый)
- БСМ (быстросъём)
- Монтажный комплект
- Резьба концов линии

ГИДРОБУР:
- Поток / давление / реверс
- Диаметр / глубина
- Тип грунта (суглинок, глина, песок, скала, валуны)
- БСМ
- Монтажный комплект (БРС, кронштейн, удлинители)
- Тип шнеков (под поточное или рейсовое бурение)

КОВШ:
- Объём
- Условия работ (карьер, стройка, погрузка в самосвалы)
- Материал (грунт, щебень, скала, лом)
- БСМ
- Монтажный комплект (кронштейн, пальцы, втулки)

НОЖНИЦЫ:
- Тип работ (первичное/вторичное разрушение, резка металлоконструкций)
- Разводки (одна/две линии, давление/поток)
- Удлинённое рабочее оборудование на машине
- БСМ
- Монтажный комплект

СВАЕРЕЗКА:
- Базовая машина (марка/модель)
- Давление / расход по гидролинии
- Сечение / форма свай
- Расстояние между сваями
- Требуемый вылет
- Длина РВД

ВИБРОПОГРУЖАТЕЛЬ:
- Профиль / размер (шпунт, труба, балка)
- Глубина погружения
- Геология / регион (промерзание, сложный грунт)
- Доступная техника (кран, экскаватор, генератор, свободный крюк)
- Параметры гидролиний
- Техограничения (предбурение, пропаривание, ограничения по вибрации)
- Замки/соединения шпунта или профиля

=== ПРАВИЛА ПОВЕДЕНИЯ КЛИЕНТА (УЧИТЫВАЙ) ===

- Клиент — типичный мужчина 40+, "на чиле": спокойный, прагматичный, иногда ироничный.
- Прямота и краткость. Говорит просто, без лишней теории.
- Может использовать разговорный стиль и крепкое словцо.
- Отвечает коротко: обычно 1-2 предложения, максимум 3.
- Не сливает всё сразу — даёт детали только по запросу.
- Может задавать встречные вопросы: про сроки, простой техники, сервис, гарантию, риски.
- Встраивает 1-3 возражения: "дорого", "видел дешевле", "надо вчера", "не уверен, подойдёт ли".
- Может быть жёстким, если менеджер игнорирует вопросы или обещает "с потолка".
- Может начинать с нехватки информации: "Да пофиг, подберите, там разберёмся".

=== ФОРМАТ ОТВЕТА ===

- Всегда от первого лица: "я", "мы".
- Ответы короткие и прямые: максимум 2-3 предложения.
- Без лишней теории и лекций.
- Можно использовать лёгкий сленг, но по делу.
- Структура: вопрос/уточнение → краткий ответ/выгода → следующий шаг.

=== ТВОЯ ЗАДАЧА ===

Прочитай историю диалога выше. Проанализируй:
- Что уже выяснено о потребности клиента?
- Какие техмаркеры ещё не собраны?
- Есть ли возражения, которые нужно обработать?
- Какой следующий шаг логичен?

Сгенерируй ЛУЧШИЙ следующий ответ от лица менеджера, который:
- Продвигает диалог к закрытию сделки
- Собирает недостающие техмаркеры (если нужно)
- Работает с возражениями (если есть)
- Предлагает чёткий следующий шаг

Ответ должен быть готовым к отправке (чистый текст сообщения). БЕЗ кавычек, БЕЗ префиксов типа "Менеджер:", БЕЗ лишних слов. Просто текст ответа менеджера.`;

// State
let conversationHistory = [];
let isProcessing = false;
let lastRating = null; // Хранит последнюю оценку диалога

// Configure marked.js
if (typeof marked !== 'undefined') {
    marked.setOptions({
        breaks: true,
        gfm: true,
        highlight: function(code, lang) {
            if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
                try {
                    return hljs.highlight(code, { language: lang }).value;
                } catch (e) {
                    console.error('Highlight error:', e);
                }
            }
            return code;
        }
    });
}

// Configure Turndown (HTML to Markdown converter) for WYSIWYG editing
let turndownService = null;
if (typeof TurndownService !== 'undefined') {
    turndownService = new TurndownService({
        headingStyle: 'atx',
        hr: '---',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        emDelimiter: '*'
    });
    
    // Custom rules for better markdown output
    turndownService.addRule('strikethrough', {
        filter: ['del', 's', 'strike'],
        replacement: function (content) {
            return '~~' + content + '~~';
        }
    });
}

// Debounce function to limit API calls
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Load prompts from Server (or localStorage as fallback)
async function loadPrompts() {
    if (SETTINGS_WEBHOOK_URL) {
        try {
            const response = await fetch(SETTINGS_WEBHOOK_URL, { method: 'GET' });
            if (response.ok) {
                const data = await response.json();
                
                // Expecting { "client_prompt": "...", "rater_prompt": "..." }
                if (data.client_prompt) {
                    systemPromptInput.value = data.client_prompt;
                    localStorage.setItem('systemPrompt', data.client_prompt);
                }
                if (data.rater_prompt) {
                    raterPromptInput.value = data.rater_prompt;
                    localStorage.setItem('raterPrompt', data.rater_prompt);
                }
                console.log('Prompts loaded from server');
                return;
            }
        } catch (e) {
            console.warn('Failed to load from server, using localStorage:', e);
        }
    }
    
    // Fallback to localStorage
    loadSavedData();
}

// Save prompts to Server
const savePromptsToServer = debounce(async () => {
    if (!SETTINGS_WEBHOOK_URL) return;

    const payload = {
        client_prompt: systemPromptInput.value,
        rater_prompt: raterPromptInput.value
    };

    try {
        await fetch(SETTINGS_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log('Prompts saved to server');
    } catch (e) {
        console.error('Failed to save prompts to server:', e);
    }
}, 2000); // Save after 2 seconds of no typing

// Load saved data from localStorage
function loadSavedData() {
    const savedPrompt = localStorage.getItem('systemPrompt');
    const savedRaterPrompt = localStorage.getItem('raterPrompt');
    const savedManagerPrompt = localStorage.getItem('managerPrompt');
    const savedManagerName = localStorage.getItem('managerName');
    
    if (savedPrompt) {
        systemPromptInput.value = savedPrompt;
    }
    
    if (savedRaterPrompt) {
        raterPromptInput.value = savedRaterPrompt;
    }
    
    // Load manager prompt or use default
    if (savedManagerPrompt) {
        managerPromptInput.value = savedManagerPrompt;
    } else {
        managerPromptInput.value = DEFAULT_MANAGER_PROMPT;
    }
    
    // Load manager name or show modal
    if (savedManagerName) {
        managerNameInput.value = savedManagerName;
    } else {
        // Show modal to ask for name
        showNameModal();
    }
}

// Show name modal
function showNameModal() {
    nameModal.classList.add('active');
    setTimeout(() => {
        modalNameInput.focus();
    }, 100);
}

// Hide name modal
function hideNameModal() {
    nameModal.classList.remove('active');
}

// Get manager name
function getManagerName() {
    return managerNameInput.value.trim() || 'менеджер';
}

// Save manager name
function saveManagerName(name) {
    localStorage.setItem('managerName', name);
    managerNameInput.value = name;
}

// Modal submit handler
modalNameSubmit.addEventListener('click', () => {
    const name = modalNameInput.value.trim();
    if (name) {
        saveManagerName(name);
        hideNameModal();
    } else {
        modalNameInput.focus();
        modalNameInput.style.borderColor = '#ff5555';
        setTimeout(() => {
            modalNameInput.style.borderColor = '';
        }, 1000);
    }
});

// Modal input enter key handler
modalNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        modalNameSubmit.click();
    }
});

// Manager name input change handler
managerNameInput.addEventListener('input', () => {
    const name = managerNameInput.value.trim();
    if (name) {
        localStorage.setItem('managerName', name);
    }
});

// Auto-resize textarea
function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 300); // Максимум 300px
    textarea.style.height = newHeight + 'px';
}

// Prompt is auto-saved via input event listener below

// Add message to chat
function addMessage(content, role, isMarkdown = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    // Content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (role === 'loading') {
        contentDiv.innerHTML = `
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
    } else if (isMarkdown) {
        // Simple markdown conversion (works reliably)
        let html = content
            // Headers: #### h4, ### h3, ## h2, # h1 (order matters - longest first)
            .replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
            .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
            .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
            .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
            // Horizontal rule: ---
            .replace(/^---+$/gm, '<hr>')
            // Bullet lists FIRST: * item or - item (at start of line, with space after)
            .replace(/^\*\s+(.+)$/gm, '• $1')
            .replace(/^-\s+(.+)$/gm, '• $1')
            // Numbered lists: 1. item
            .replace(/^(\d+)\.\s+(.+)$/gm, '$1. $2')
            // Bold: **text** (multiline support with [\s\S])
            .replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>')
            // Italic: *text* (only when surrounded by non-space)
            .replace(/(?<!\s)\*([^\*\n]+)\*(?!\s)/g, '<em>$1</em>')
            // Paragraphs
            .replace(/\n\n+/g, '</p><p>')
            // Line breaks
            .replace(/\n/g, '<br>');
        contentDiv.innerHTML = '<p>' + html + '</p>';
    } else {
        contentDiv.textContent = content;
    }
    
    messageDiv.appendChild(contentDiv);
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageDiv;
}

// Escape HTML for attributes
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Copy to clipboard
async function copyToClipboard(text, button) {
    try {
        await navigator.clipboard.writeText(text);
        const originalText = button.textContent;
        button.textContent = '✓ Скопировано';
        setTimeout(() => {
            button.textContent = originalText;
        }, 1500);
    } catch (err) {
        console.error('Failed to copy:', err);
        button.textContent = '✗ Ошибка';
        setTimeout(() => {
            button.textContent = 'Копировать';
        }, 1500);
    }
}

// Clear chat
function clearChat() {
    conversationHistory = [];
    lastRating = null;
    // Generate new session ID for fresh conversation
    baseSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('sessionId', baseSessionId);
    clientSessionId = baseSessionId + '_client';
    managerSessionId = baseSessionId + '_manager';
    raterSessionId = baseSessionId + '_rater';
    
    chatMessages.innerHTML = `
        <div id="startConversation" class="start-conversation">
            <button id="startBtn" class="btn-start">Начать диалог</button>
        </div>
    `;
    // Re-attach event listener to new button
    const newStartBtn = document.getElementById('startBtn');
    newStartBtn.addEventListener('click', startConversationHandler);
}

// Send message to n8n webhook
async function sendMessage() {
    const userMessage = userInput.value.trim();
    
    if (!userMessage || isProcessing) {
        return;
    }
    
    // Disable input while processing
    isProcessing = true;
    sendBtn.disabled = true;
    userInput.disabled = true;
    
    // Hide start button if visible
    if (startConversation) {
        startConversation.style.display = 'none';
    }
    
    // Add user message to chat (with markdown support)
    addMessage(userMessage, 'user', true);
    conversationHistory.push({
        role: 'user',
        content: userMessage
    });
    
    // Clear input
    userInput.value = '';
    userInput.style.height = 'auto'; // Сброс высоты
    
    // Show loading indicator
    const loadingMsg = addMessage('', 'loading');
    
    try {
        // Prepare request body
        const systemPrompt = systemPromptInput.value.trim();
        
        // Format dialog history for context (exclude current message)
        let dialogHistory = '';
        conversationHistory.slice(0, -1).forEach((msg) => {
            const role = msg.role === 'user' ? 'Менеджер' : 'Клиент';
            dialogHistory += `${role}: ${msg.content}\n\n`;
        });
        
        const requestBody = {
            chatInput: userMessage,  // Основное поле для n8n Chat Trigger
            systemPrompt: systemPrompt || 'Вы — полезный ассистент.',
            dialogHistory: dialogHistory.trim(),
            sessionId: clientSessionId
        };
        
        // Make webhook request
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Extract assistant response
        let assistantMessage = '';
        
        // Пробуем разные варианты структуры ответа от n8n
        if (typeof data === 'string') {
            assistantMessage = data;
        } else if (data.response) {
            assistantMessage = data.response;
        } else if (data.message) {
            assistantMessage = data.message;
        } else if (data.output) {
            assistantMessage = data.output;
        } else if (data.text) {
            assistantMessage = data.text;
        } else {
            // Если структура неизвестна, показываем весь JSON
            assistantMessage = JSON.stringify(data, null, 2);
        }
        
        if (!assistantMessage) {
            throw new Error('Пустой ответ от сервера');
        }
        
        // Remove loading message
        loadingMsg.remove();
        
        // Add assistant message to chat (with markdown support)
        addMessage(assistantMessage, 'assistant', true);
        conversationHistory.push({
            role: 'assistant',
            content: assistantMessage
        });
        
    } catch (error) {
        console.error('Error:', error);
        loadingMsg.remove();
        
        let errorMessage = 'Произошла ошибка при обработке запроса';
        
        if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Ошибка соединения. Проверьте подключение к интернету и доступность webhook.';
        } else if (error.message.includes('HTTP 4')) {
            errorMessage = `Ошибка запроса (${error.message}). Проверьте корректность URL webhook.`;
        } else if (error.message.includes('HTTP 5')) {
            errorMessage = `Ошибка сервера (${error.message}). Попробуйте позже.`;
        } else {
            errorMessage = `Ошибка: ${error.message}`;
        }
        
        addMessage(errorMessage, 'error', false);
    } finally {
        // Re-enable input
        isProcessing = false;
        sendBtn.disabled = false;
        userInput.disabled = false;
        userInput.focus();
    }
}

// Event Listeners
sendBtn.addEventListener('click', sendMessage);

userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Auto-resize on input
userInput.addEventListener('input', () => {
    autoResizeTextarea(userInput);
});

clearChatBtn.addEventListener('click', () => {
    if (confirm('Очистить весь чат?')) {
        clearChat();
    }
});

exportChatBtn.addEventListener('click', exportChat);

exportCurrentPromptBtn.addEventListener('click', exportCurrentPrompt);

rateChatBtn.addEventListener('click', rateChat);

// Start conversation button
// Start conversation handler
async function startConversationHandler() {
    // Generate new session IDs for fresh conversation
    baseSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('sessionId', baseSessionId);
    clientSessionId = baseSessionId + '_client';
    managerSessionId = baseSessionId + '_manager';
    raterSessionId = baseSessionId + '_rater';
    conversationHistory = [];
    lastRating = null;
    
    // Hide start button
    const startDiv = document.getElementById('startConversation');
    if (startDiv) startDiv.style.display = 'none';
    
    // Send /start to webhook (not shown in chat)
    const loadingMsg = addMessage('', 'loading');
    
    try {
        const systemPrompt = systemPromptInput.value.trim();
        
        const requestBody = {
            chatInput: '/start',  // Hidden command to start conversation
            systemPrompt: systemPrompt || 'Вы — клиент.',
            dialogHistory: '',  // Empty for first message
            sessionId: clientSessionId
        };
        
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        let assistantMessage = '';
        if (typeof data === 'string') {
            assistantMessage = data;
        } else if (data.response) {
            assistantMessage = data.response;
        } else if (data.message) {
            assistantMessage = data.message;
        } else if (data.output) {
            assistantMessage = data.output;
        } else if (data.text) {
            assistantMessage = data.text;
        } else {
            assistantMessage = JSON.stringify(data, null, 2);
        }
        
        if (!assistantMessage) {
            throw new Error('Пустой ответ от сервера');
        }
        
        loadingMsg.remove();
        
        addMessage(assistantMessage, 'assistant', true);
        conversationHistory.push({
            role: 'assistant',
            content: assistantMessage
        });
        
    } catch (error) {
        console.error('Error:', error);
        loadingMsg.remove();
        addMessage(`Ошибка: ${error.message}`, 'error', false);
    }
}

startBtn.addEventListener('click', startConversationHandler);

// Export chat
function exportChat() {
    if (conversationHistory.length === 0) {
        alert('Нет сообщений для экспорта');
        return;
    }
    
    // Формируем текст диалога
    let chatText = '';
    
    conversationHistory.forEach((msg, index) => {
        const role = msg.role === 'user' ? 'Менеджер' : 'Клиент';
        chatText += `${role}: ${msg.content}`;
        
        // Добавляем пустую строку между сообщениями, но не после последнего
        if (index < conversationHistory.length - 1) {
            chatText += '\n\n';
        }
    });
    
    // Добавляем оценку диалога, если она есть
    if (lastRating) {
        chatText += '\n\n\n========================================\nОЦЕНКА ДИАЛОГА:\n========================================\n\n';
        chatText += lastRating;
    }
    
    const dataBlob = new Blob([chatText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `диалог ${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Export current active prompt
function exportCurrentPrompt() {
    const activeTab = document.querySelector('.instruction-tab.active');
    const instructionType = activeTab ? activeTab.dataset.instruction : 'client';
    
    let promptText = '';
    let fileName = '';
    
    switch (instructionType) {
        case 'client':
            promptText = systemPromptInput.value.trim();
            fileName = 'промпт-клиента';
            break;
        case 'manager':
            promptText = managerPromptInput.value.trim();
            fileName = 'промпт-менеджера';
            break;
        case 'rater':
            promptText = raterPromptInput.value.trim();
            fileName = 'промпт-оценщика';
            break;
    }
    
    if (!promptText) {
        alert('Инструкция пуста');
        return;
    }
    
    const dataBlob = new Blob([promptText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Rate chat dialog
async function rateChat() {
    if (conversationHistory.length === 0) {
        alert('Нет диалога для оценки');
        return;
    }
    
    // Disable button while processing
    rateChatBtn.disabled = true;
    rateChatBtn.classList.add('loading');
    
    // Show loading indicator
    const loadingMsg = addMessage('', 'loading');
    
    try {
        // Format dialog as text
        let dialogText = '';
        conversationHistory.forEach((msg) => {
            const role = msg.role === 'user' ? 'Менеджер' : 'Клиент';
            dialogText += `${role}: ${msg.content}\n\n`;
        });
        
        const raterPrompt = raterPromptInput.value.trim() || 'Оцените качество диалога.';
        
        const requestBody = {
            dialog: dialogText.trim(),
            raterPrompt: raterPrompt,
            sessionId: raterSessionId
        };
        
        // Make webhook request
        const response = await fetch(RATE_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Extract rating response
        let ratingMessage = '';
        
        if (typeof data === 'string') {
            ratingMessage = data;
        } else if (data.response) {
            ratingMessage = data.response;
        } else if (data.message) {
            ratingMessage = data.message;
        } else if (data.rating) {
            ratingMessage = data.rating;
        } else if (data.output) {
            ratingMessage = data.output;
        } else if (data.text) {
            ratingMessage = data.text;
        } else {
            ratingMessage = JSON.stringify(data, null, 2);
        }
        
        if (!ratingMessage) {
            throw new Error('Пустой ответ от сервера оценки');
        }
        
        // Remove loading message
        loadingMsg.remove();
        
        // Save rating for export
        lastRating = ratingMessage;
        
        // Add rating as special rating message (centered, orange)
        addMessage(ratingMessage, 'rating', true);
        
    } catch (error) {
        console.error('Rating error:', error);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        loadingMsg.remove();
        
        let errorMessage = 'Ошибка при оценке диалога';
        
        if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Ошибка соединения с сервисом оценки. Проверьте CORS настройки в n8n.';
        } else if (error.message.includes('Too Many Requests') || error.message.includes('429')) {
            errorMessage = 'Слишком много запросов. Подождите 30 секунд и попробуйте снова.';
        } else {
            errorMessage = `Ошибка оценки: ${error.message}`;
        }
        
        addMessage(errorMessage, 'error', false);
    } finally {
        rateChatBtn.disabled = false;
        rateChatBtn.classList.remove('loading');
    }
}

// Auto-save prompt on change (with debounce)
systemPromptInput.addEventListener('input', () => {
    // Local save (immediate)
        localStorage.setItem('systemPrompt', systemPromptInput.value);
    // Server save (debounced)
    savePromptsToServer();
});

// Auto-save rater prompt on change (with debounce)
raterPromptInput.addEventListener('input', () => {
    // Local save (immediate)
    localStorage.setItem('raterPrompt', raterPromptInput.value);
    // Server save (debounced)
    savePromptsToServer();
});

// Auto-save manager prompt on change
managerPromptInput.addEventListener('input', () => {
    localStorage.setItem('managerPrompt', managerPromptInput.value);
});

// Set textarea value with undo support
function setTextWithUndo(textarea, text) {
    textarea.focus();
    textarea.select();
    // execCommand supports undo history
    document.execCommand('insertText', false, text);
}

// Drag and drop files into prompt fields
function setupDragAndDrop(textarea, storageKey) {
    // Supported text file extensions
    const textExtensions = ['.txt', '.md', '.json', '.xml', '.csv', '.html', '.htm', '.rtf', '.log'];
    
    textarea.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        textarea.classList.add('drag-over');
    });
    
    textarea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        textarea.classList.remove('drag-over');
    });
    
    textarea.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        textarea.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            const fileName = file.name.toLowerCase();
            
            // Check for .docx (Word)
            if (fileName.endsWith('.docx')) {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const arrayBuffer = event.target.result;
                        const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                        setTextWithUndo(textarea, result.value);
                        localStorage.setItem(storageKey, textarea.value);
                    } catch (err) {
                        console.error('Error reading .docx:', err);
                        alert('Ошибка чтения .docx файла');
                    }
                };
                reader.readAsArrayBuffer(file);
            }
            // Check for text-based files
            else if (file.type.startsWith('text/') || textExtensions.some(ext => fileName.endsWith(ext))) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    setTextWithUndo(textarea, event.target.result);
                    localStorage.setItem(storageKey, textarea.value);
                };
                reader.readAsText(file, 'UTF-8');
            } else {
                alert('Поддерживаемые форматы: .txt, .md, .docx, .json, .xml, .csv, .html, .rtf');
            }
        }
    });
}

// Setup drag and drop for all prompt fields (textareas)
setupDragAndDrop(systemPromptInput, 'systemPrompt');
setupDragAndDrop(raterPromptInput, 'raterPrompt');
setupDragAndDrop(managerPromptInput, 'managerPrompt');

// Setup drag and drop for preview elements (when in preview mode)
function setupDragAndDropForPreview(previewElement, textarea, storageKey) {
    const textExtensions = ['.txt', '.md', '.json', '.xml', '.csv', '.html', '.htm', '.rtf', '.log'];
    
    previewElement.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        previewElement.classList.add('drag-over');
    });
    
    previewElement.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        previewElement.classList.remove('drag-over');
    });
    
    previewElement.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        previewElement.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            const fileName = file.name.toLowerCase();
            
            // Check for .docx (Word)
            if (fileName.endsWith('.docx')) {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const arrayBuffer = event.target.result;
                        const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                        textarea.value = result.value;
                        localStorage.setItem(storageKey, textarea.value);
                        // Update preview
                        previewElement.innerHTML = renderMarkdown(textarea.value);
                    } catch (err) {
                        console.error('Error reading .docx:', err);
                        alert('Ошибка чтения .docx файла');
                    }
                };
                reader.readAsArrayBuffer(file);
            }
            // Check for text-based files
            else if (file.type.startsWith('text/') || textExtensions.some(ext => fileName.endsWith(ext))) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    textarea.value = event.target.result;
                    localStorage.setItem(storageKey, textarea.value);
                    // Update preview
                    previewElement.innerHTML = renderMarkdown(textarea.value);
                };
                reader.readAsText(file, 'UTF-8');
            } else {
                alert('Поддерживаемые форматы: .txt, .md, .docx, .json, .xml, .csv, .html, .rtf');
            }
        }
    });
}

// Instruction tabs functionality
const instructionTabs = document.querySelectorAll('.instruction-tab');
const instructionEditors = document.querySelectorAll('.instruction-editor');
const togglePreviewBtn = document.getElementById('togglePreviewBtn');
let isPreviewMode = true; // Preview mode включён по умолчанию

// Preview elements
const systemPromptPreview = document.getElementById('systemPromptPreview');
const managerPromptPreview = document.getElementById('managerPromptPreview');
const raterPromptPreview = document.getElementById('raterPromptPreview');

// Render markdown to HTML
function renderMarkdown(text) {
    if (!text) return '<p style="color: #666; font-style: italic;">Промпт пустой...</p>';
    
    // Use marked.js if available
    if (typeof marked !== 'undefined') {
        return marked.parse(text);
    }
    
    // Fallback: simple markdown conversion
    let html = text
        // Headers
        .replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
        .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
        .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
        .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
        // Horizontal rule
        .replace(/^---+$/gm, '<hr>')
        .replace(/^===+$/gm, '<hr>')
        // Bullet lists
        .replace(/^\*\s+(.+)$/gm, '<li>$1</li>')
        .replace(/^-\s+(.+)$/gm, '<li>$1</li>')
        // Numbered lists
        .replace(/^(\d+)\.\s+(.+)$/gm, '<li>$2</li>')
        // Bold
        .replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/(?<!\*)\*([^\*\n]+)\*(?!\*)/g, '<em>$1</em>')
        // Code blocks
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Blockquotes
        .replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>')
        // Paragraphs
        .replace(/\n\n+/g, '</p><p>')
        // Line breaks
        .replace(/\n/g, '<br>');
    
    return '<p>' + html + '</p>';
}

// Update preview content for current active prompt
function updatePreview() {
    const activeWrapper = document.querySelector('.prompt-wrapper.instruction-editor.active');
    if (!activeWrapper) return;
    
    const instructionType = activeWrapper.dataset.instruction;
    let text = '';
    let previewElement = null;
    
    switch (instructionType) {
        case 'client':
            text = systemPromptInput.value;
            previewElement = systemPromptPreview;
            break;
        case 'manager':
            text = managerPromptInput.value;
            previewElement = managerPromptPreview;
            break;
        case 'rater':
            text = raterPromptInput.value;
            previewElement = raterPromptPreview;
            break;
    }
    
    if (previewElement) {
        previewElement.innerHTML = renderMarkdown(text);
        
        // Apply syntax highlighting if available
        if (typeof hljs !== 'undefined') {
            previewElement.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        }
    }
}

// Toggle preview mode (WYSIWYG: edit directly in formatted view)
function togglePreviewMode() {
    const iconPreview = togglePreviewBtn.querySelector('.icon-preview');
    const iconEdit = togglePreviewBtn.querySelector('.icon-edit');
    
    if (isPreviewMode) {
        // Switching FROM preview mode TO edit mode
        // First, sync any changes from WYSIWYG back to textarea
        syncAllPreviewsToTextareas();
    }
    
    isPreviewMode = !isPreviewMode;
    
    if (isPreviewMode) {
        // Enable WYSIWYG mode - show preview (contenteditable)
        document.querySelectorAll('.prompt-wrapper').forEach(wrapper => {
            wrapper.classList.add('preview-mode');
        });
        togglePreviewBtn.classList.add('active');
        togglePreviewBtn.title = 'Режим редактирования (код)';
        iconPreview.style.display = 'none';
        iconEdit.style.display = 'block';
        
        // Render markdown and make previews editable
        updateAllPreviews();
        enableWYSIWYG();
    } else {
        // Enable code edit mode - show textarea
        document.querySelectorAll('.prompt-wrapper').forEach(wrapper => {
            wrapper.classList.remove('preview-mode');
        });
        togglePreviewBtn.classList.remove('active');
        togglePreviewBtn.title = 'Режим Markdown (WYSIWYG)';
        iconPreview.style.display = 'block';
        iconEdit.style.display = 'none';
        
        // Disable WYSIWYG editing
        disableWYSIWYG();
    }
}

// Enable WYSIWYG editing on preview elements
function enableWYSIWYG() {
    [systemPromptPreview, managerPromptPreview, raterPromptPreview].forEach(preview => {
        preview.contentEditable = 'true';
        preview.spellcheck = true;
    });
}

// Disable WYSIWYG editing on preview elements
function disableWYSIWYG() {
    [systemPromptPreview, managerPromptPreview, raterPromptPreview].forEach(preview => {
        preview.contentEditable = 'false';
    });
}

// Convert HTML from preview back to Markdown and sync to textarea
function syncPreviewToTextarea(previewElement, textareaElement, storageKey) {
    if (!turndownService) {
        console.warn('TurndownService not available');
        return;
    }
    
    const html = previewElement.innerHTML;
    if (!html || html.includes('Промпт пустой...')) {
        textareaElement.value = '';
    } else {
        const markdown = turndownService.turndown(html);
        textareaElement.value = markdown;
    }
    
    // Save to localStorage
    localStorage.setItem(storageKey, textareaElement.value);
    
    // Trigger server save if needed
    savePromptsToServer();
}

// Sync all previews to their respective textareas
function syncAllPreviewsToTextareas() {
    syncPreviewToTextarea(systemPromptPreview, systemPromptInput, 'systemPrompt');
    syncPreviewToTextarea(managerPromptPreview, managerPromptInput, 'managerPrompt');
    syncPreviewToTextarea(raterPromptPreview, raterPromptInput, 'raterPrompt');
}

// Update all preview contents
function updateAllPreviews() {
    systemPromptPreview.innerHTML = renderMarkdown(systemPromptInput.value);
    managerPromptPreview.innerHTML = renderMarkdown(managerPromptInput.value);
    raterPromptPreview.innerHTML = renderMarkdown(raterPromptInput.value);
    
    // Apply syntax highlighting if available
    if (typeof hljs !== 'undefined') {
        document.querySelectorAll('.prompt-preview pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
    }
}

// Debounced sync for WYSIWYG changes
const debouncedSyncClient = debounce(() => {
    syncPreviewToTextarea(systemPromptPreview, systemPromptInput, 'systemPrompt');
}, 500);

const debouncedSyncManager = debounce(() => {
    syncPreviewToTextarea(managerPromptPreview, managerPromptInput, 'managerPrompt');
}, 500);

const debouncedSyncRater = debounce(() => {
    syncPreviewToTextarea(raterPromptPreview, raterPromptInput, 'raterPrompt');
}, 500);

// Toggle preview button event
togglePreviewBtn.addEventListener('click', togglePreviewMode);

// WYSIWYG input handlers - sync changes back to textarea
systemPromptPreview.addEventListener('input', () => {
    if (isPreviewMode) {
        debouncedSyncClient();
    }
});

managerPromptPreview.addEventListener('input', () => {
    if (isPreviewMode) {
        debouncedSyncManager();
    }
});

raterPromptPreview.addEventListener('input', () => {
    if (isPreviewMode) {
        debouncedSyncRater();
    }
});

// Handle paste in WYSIWYG - clean up HTML
function handleWYSIWYGPaste(e) {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
}

systemPromptPreview.addEventListener('paste', handleWYSIWYGPaste);
managerPromptPreview.addEventListener('paste', handleWYSIWYGPaste);
raterPromptPreview.addEventListener('paste', handleWYSIWYGPaste);

instructionTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const instructionType = tab.dataset.instruction;
        
        // Update active tab
        instructionTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update active editor
        instructionEditors.forEach(editor => {
            editor.classList.remove('active');
            if (editor.dataset.instruction === instructionType) {
                editor.classList.add('active');
            }
        });
        
        // Update preview if in preview mode
        if (isPreviewMode) {
            updatePreview();
        }
    });
});

// Resize panels functionality
const resizeHandle1 = document.getElementById('resizeHandle1');
const chatPanel = document.getElementById('chatPanel');
const instructionsPanel = document.getElementById('instructionsPanel');
let isResizing = false;

resizeHandle1.addEventListener('mousedown', (e) => {
    isResizing = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const container = document.querySelector('.panels-container');
    const containerWidth = container.offsetWidth;
    const mouseX = e.clientX;
    
    // Resizing between chat and instructions
    const chatWidth = (mouseX / containerWidth) * 100;
    
    if (chatWidth >= 30 && chatWidth <= 70) {
        chatPanel.style.flex = `0 0 ${chatWidth}%`;
        instructionsPanel.style.flex = `0 0 ${100 - chatWidth - 1}%`;
    }
});

document.addEventListener('mouseup', () => {
    if (isResizing) {
        isResizing = false;
        currentHandle = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }
});

// Speech Recognition
let recognition = null;
let isRecording = false;

// Initialize Speech Recognition
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        voiceBtn.style.display = 'none';
        return;
    }
    
    recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onstart = () => {
        isRecording = true;
        voiceBtn.classList.add('recording');
    };
    
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const currentText = userInput.value;
        userInput.value = currentText + (currentText ? ' ' : '') + transcript;
        autoResizeTextarea(userInput);
    };
    
    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
            alert('Доступ к микрофону запрещён. Разрешите доступ в настройках браузера.');
        }
        stopRecording();
    };
    
    recognition.onend = () => {
        stopRecording();
    };
}

function startRecording() {
    if (!recognition) {
        alert('Распознавание речи не поддерживается в вашем браузере');
        return;
    }
    
    try {
        recognition.start();
    } catch (error) {
        console.error('Error starting recognition:', error);
        stopRecording();
    }
}

function stopRecording() {
    if (recognition && isRecording) {
        recognition.stop();
    }
    isRecording = false;
    voiceBtn.classList.remove('recording');
    userInput.style.paddingRight = '';
}

// Generate AI response for manager
async function generateAIResponse() {
    console.log('generateAIResponse called');
    console.log('conversationHistory:', conversationHistory);
    
    if (conversationHistory.length === 0) {
        alert('Нет истории диалога для генерации ответа. Сначала отправьте хотя бы одно сообщение.');
        return;
    }
    
    if (isProcessing) {
        console.log('isProcessing is true, returning');
        return;
    }
    
    // Disable button while processing
    aiAssistBtn.disabled = true;
    aiAssistBtn.classList.add('loading');
    console.log('Starting AI generation...');
    
    try {
        // Format full dialog history for context
        let dialogHistory = '';
        conversationHistory.forEach((msg) => {
            const role = msg.role === 'user' ? 'Менеджер' : 'Клиент';
            dialogHistory += `${role}: ${msg.content}\n\n`;
        });
        
        // Get last message from conversation (client's message)
        const lastMessage = conversationHistory.length > 0 
            ? conversationHistory[conversationHistory.length - 1].content 
            : '';
        
        // Prepare request body with full dialog history
        const managerName = getManagerName();
        const basePrompt = managerPromptInput.value.trim() || DEFAULT_MANAGER_PROMPT;
        const fullPrompt = `Тебя зовут ${managerName}.\n\n${basePrompt}`;
        
        const requestBody = {
            systemPrompt: fullPrompt,
            userMessage: lastMessage,
            dialogHistory: dialogHistory.trim(),
            sessionId: managerSessionId
        };
        
        console.log('Sending request to:', MANAGER_ASSISTANT_WEBHOOK_URL);
        console.log('Request body:', requestBody);
        
        // Make webhook request
        const response = await fetch(MANAGER_ASSISTANT_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Response data:', data);
        
        // Extract AI response
        let aiMessage = '';
        
        if (typeof data === 'string') {
            aiMessage = data;
        } else if (data.response) {
            aiMessage = data.response;
        } else if (data.message) {
            aiMessage = data.message;
        } else if (data.output) {
            aiMessage = data.output;
        } else if (data.text) {
            aiMessage = data.text;
        } else {
            aiMessage = JSON.stringify(data, null, 2);
        }
        
        console.log('Extracted aiMessage:', aiMessage);
        
        if (!aiMessage) {
            throw new Error('Пустой ответ от AI');
        }
        
        // Clean up the message (remove quotes, prefixes, etc.)
        aiMessage = aiMessage.trim();
        aiMessage = aiMessage.replace(/^["']|["']$/g, ''); // Remove surrounding quotes
        aiMessage = aiMessage.replace(/^(Менеджер|Manager):\s*/i, ''); // Remove role prefix
        
        // Insert into input field
        userInput.value = aiMessage;
        autoResizeTextarea(userInput);
        userInput.focus();
        console.log('AI response inserted into input field');
        
    } catch (error) {
        console.error('AI generation error:', error);
        alert('Ошибка при генерации ответа: ' + error.message);
    } finally {
        aiAssistBtn.disabled = false;
        aiAssistBtn.classList.remove('loading');
    }
}

// AI Assistant button event
aiAssistBtn.addEventListener('click', generateAIResponse);

// Voice button event
voiceBtn.addEventListener('click', () => {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
});

// Mobile tabs functionality
const mobileTabs = document.querySelectorAll('.mobile-tab');
const panels = document.querySelectorAll('.panel');

mobileTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const panelName = tab.dataset.panel;
        
        // Remove active class from all tabs and panels
        mobileTabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        
        // Add active class to clicked tab and corresponding panel
        tab.classList.add('active');
        const activePanel = document.querySelector(`.panel[data-panel="${panelName}"]`);
        if (activePanel) {
            activePanel.classList.add('active');
        }
    });
});

// Set initial active panel
if (window.innerWidth <= 1024) {
    panels.forEach(p => p.classList.remove('active'));
    document.querySelector('.panel[data-panel="chat"]').classList.add('active');
}

// Initialize
loadPrompts();
initSpeechRecognition();
userInput.focus();
autoResizeTextarea(userInput); // Установить начальную высоту

// Initialize WYSIWYG preview mode (default)
setTimeout(() => {
    updateAllPreviews();
    enableWYSIWYG(); // Enable editing in preview mode
}, 100);

// Sync WYSIWYG changes before page unload
window.addEventListener('beforeunload', () => {
    if (isPreviewMode) {
        syncAllPreviewsToTextareas();
    }
});

// Setup drag and drop for preview elements (when in preview mode)
setupDragAndDropForPreview(systemPromptPreview, systemPromptInput, 'systemPrompt');
setupDragAndDropForPreview(managerPromptPreview, managerPromptInput, 'managerPrompt');
setupDragAndDropForPreview(raterPromptPreview, raterPromptInput, 'raterPrompt');

