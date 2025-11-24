// n8n Webhook Configuration
const WEBHOOK_URL = 'https://n8n-api.tradicia-k.ru/webhook/client-simulator';
const RATE_WEBHOOK_URL = 'https://n8n-api.tradicia-k.ru/webhook/client-simulator-rate';
const MANAGER_ASSISTANT_WEBHOOK_URL = 'https://n8n-api.tradicia-k.ru/webhook-test/manager-simulator';
const SETTINGS_WEBHOOK_URL = ''; // ВСТАВЬТЕ СЮДА URL ВАШЕГО НОВОГО ВЕБХУКА ДЛЯ НАСТРОЕК

// DOM Elements
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const clearChatBtn = document.getElementById('clearChat');
const systemPromptInput = document.getElementById('systemPrompt');
const raterPromptInput = document.getElementById('raterPrompt');
const exportChatBtn = document.getElementById('exportChat');
const exportPromptBtn = document.getElementById('exportPrompt');
const exportRaterPromptBtn = document.getElementById('exportRaterPrompt');
const voiceBtn = document.getElementById('voiceBtn');
const aiAssistBtn = document.getElementById('aiAssistBtn');
const rateChatBtn = document.getElementById('rateChat');

// Manager Prompt Template (based on attached files)
const MANAGER_PROMPT_TEMPLATE = `Ты — профессиональный менеджер по продажам навесного оборудования (гидромолоты, гидробуры, ковши, ножницы, сваерезки, вибропогружатели) компании "Традиция-К".

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
    
    if (savedPrompt) {
        systemPromptInput.value = savedPrompt;
    }
    
    if (savedRaterPrompt) {
        raterPromptInput.value = savedRaterPrompt;
    }
    
}

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
    } else if (isMarkdown && typeof marked !== 'undefined') {
        contentDiv.innerHTML = marked.parse(content);
        // Apply syntax highlighting
        if (typeof hljs !== 'undefined') {
            contentDiv.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        }
    } else {
        contentDiv.textContent = content;
    }
    
    messageDiv.appendChild(contentDiv);
    
    // Footer with actions (no time)
    if (role !== 'loading') {
        const footerDiv = document.createElement('div');
        footerDiv.className = 'message-footer';
        
        footerDiv.innerHTML = `
            <div class="message-actions">
                <button class="btn-copy" data-content="${escapeHtml(content)}">Копировать</button>
            </div>
        `;
        
        messageDiv.appendChild(footerDiv);
        
        // Add copy functionality
        const copyBtn = footerDiv.querySelector('.btn-copy');
        copyBtn.addEventListener('click', () => copyToClipboard(content, copyBtn));
    }
    
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
    chatMessages.innerHTML = '';
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
    
    // Add user message to chat
    addMessage(userMessage, 'user', false);
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
        
        const requestBody = {
            chatInput: userMessage,  // Основное поле для n8n Chat Trigger
            systemPrompt: systemPrompt || 'Вы — полезный ассистент.',
            history: conversationHistory.slice(0, -1) // История без последнего сообщения
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

exportPromptBtn.addEventListener('click', exportPrompt);

exportRaterPromptBtn.addEventListener('click', exportRaterPrompt);

rateChatBtn.addEventListener('click', rateChat);

// Export chat
function exportChat() {
    if (conversationHistory.length === 0) {
        alert('Нет сообщений для экспорта');
        return;
    }
    
    // Формируем текст диалога
    let chatText = '';
    
    conversationHistory.forEach((msg, index) => {
        const role = msg.role === 'user' ? 'Клиент' : 'Менеджер';
        chatText += `${role}: ${msg.content}`;
        
        // Добавляем пустую строку между сообщениями, но не после последнего
        if (index < conversationHistory.length - 1) {
            chatText += '\n\n';
        }
    });
    
    const dataBlob = new Blob([chatText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chat-export-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Export prompt
function exportPrompt() {
    const promptText = systemPromptInput.value.trim();
    
    if (!promptText) {
        alert('Инструкция клиента пуста');
        return;
    }
    
    const dataBlob = new Blob([promptText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `client-prompt-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Export rater prompt
function exportRaterPrompt() {
    const promptText = raterPromptInput.value.trim();
    
    if (!promptText) {
        alert('Инструкция оценщика пуста');
        return;
    }
    
    const dataBlob = new Blob([promptText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rater-prompt-${Date.now()}.txt`;
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
    const originalText = rateChatBtn.textContent;
    rateChatBtn.textContent = 'Оценка...';
    
    // Show loading indicator
    const loadingMsg = addMessage('', 'loading');
    
    try {
        // Format dialog as text
        let dialogText = '';
        conversationHistory.forEach((msg) => {
            const role = msg.role === 'user' ? 'Клиент' : 'Менеджер';
            dialogText += `${role}: ${msg.content}\n\n`;
        });
        
        const raterPrompt = raterPromptInput.value.trim() || 'Оцените качество диалога.';
        
        const requestBody = {
            dialog: dialogText.trim(),
            raterPrompt: raterPrompt
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
        
        // Add rating as special rating message (centered, orange)
        addMessage(ratingMessage, 'rating', true);
        
    } catch (error) {
        console.error('Rating error:', error);
        loadingMsg.remove();
        
        let errorMessage = 'Ошибка при оценке диалога';
        
        if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Ошибка соединения с сервисом оценки.';
        } else {
            errorMessage = `Ошибка оценки: ${error.message}`;
        }
        
        addMessage(errorMessage, 'error', false);
    } finally {
        rateChatBtn.disabled = false;
        rateChatBtn.textContent = originalText;
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

// Resize panels functionality
const resizeHandle1 = document.getElementById('resizeHandle1');
const resizeHandle2 = document.getElementById('resizeHandle2');
const chatPanel = document.getElementById('chatPanel');
const clientPromptPanel = document.getElementById('clientPromptPanel');
const raterPromptPanel = document.getElementById('raterPromptPanel');
let isResizing = false;
let currentHandle = null;

function startResize(handle) {
    isResizing = true;
    currentHandle = handle;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
}

resizeHandle1.addEventListener('mousedown', (e) => {
    startResize(1);
});

resizeHandle2.addEventListener('mousedown', (e) => {
    startResize(2);
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const container = document.querySelector('.container');
    const containerWidth = container.offsetWidth;
    const mouseX = e.clientX;
    
    if (currentHandle === 1) {
        // Resizing between chat and client prompt
        const chatWidth = (mouseX / containerWidth) * 100;
        
        if (chatWidth >= 20 && chatWidth <= 60) {
            chatPanel.style.flex = `0 0 ${chatWidth}%`;
        }
    } else if (currentHandle === 2) {
        // Resizing between client prompt and rater prompt
        const chatWidth = parseFloat(chatPanel.style.flex?.split(' ')[2]) || 33.33;
        const clientPromptStart = (chatWidth / 100) * containerWidth + 8; // +8 для разделителя
        const clientPromptWidth = ((mouseX - clientPromptStart) / containerWidth) * 100;
        
        if (clientPromptWidth >= 20 && clientPromptWidth <= 60) {
            clientPromptPanel.style.flex = `0 0 ${clientPromptWidth}%`;
        }
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
        // Format conversation history for the prompt
        let dialogText = '';
        conversationHistory.forEach((msg) => {
            const role = msg.role === 'user' ? 'Клиент' : 'Менеджер';
            dialogText += `${role}: ${msg.content}\n\n`;
        });
        
        // Prepare request body
        const requestBody = {
            systemPrompt: MANAGER_PROMPT_TEMPLATE,
            userMessage: `История диалога:\n\n${dialogText}\n\nСгенерируй следующий ответ менеджера:`
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

