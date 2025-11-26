import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

// Initialize Firebase
let db = null;
try {
    // Check if config is real or placeholder
    if (firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("EXAMPLE")) {
        const app = initializeApp(firebaseConfig);
        db = getDatabase(app);
        console.log("Firebase initialized");
    } else {
        console.warn("Firebase config is using placeholders. Update firebase-config.js to enable real-time sync.");
    }
} catch (e) {
    console.error("Firebase initialization failed:", e);
}

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

// Supported text file extensions for drag & drop
const TEXT_EXTENSIONS = ['.txt', '.md', '.json', '.xml', '.csv', '.html', '.htm', '.rtf', '.log'];

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

// State
let conversationHistory = [];
let isProcessing = false;
let lastRating = null; // Хранит последнюю оценку диалога
let isDialogRated = false; // Диалог уже оценён - блокировка ввода

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
    
    // IMPORTANT: Disable escaping of markdown characters
    turndownService.escape = function(string) {
        return string; // Don't escape anything
    };
    
    // Custom rules for better markdown output
    turndownService.addRule('strikethrough', {
        filter: ['del', 's', 'strike'],
        replacement: function (content) {
            return '~~' + content + '~~';
        }
    });
}

// Extract response from various API formats
function extractApiResponse(data) {
    if (typeof data === 'string') return data;
    return data.response || data.message || data.output || data.text || data.rating || JSON.stringify(data, null, 2);
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

// Toggle chat input state
function toggleInputState(enabled) {
    userInput.disabled = !enabled;
    sendBtn.disabled = !enabled;
    voiceBtn.disabled = !enabled;
    aiAssistBtn.disabled = !enabled;
    
    if (enabled) {
        userInput.classList.remove('disabled');
        // Restore placeholder if needed, or keep as is
    } else {
        userInput.classList.add('disabled');
    }
}

// Lock dialog input after rating
function lockDialogInput() {
    userInput.disabled = true;
    sendBtn.disabled = true;
    voiceBtn.disabled = true;
    aiAssistBtn.disabled = true;
    rateChatBtn.disabled = true;
    userInput.placeholder = 'Очистите чат для нового диалога';
    userInput.classList.add('disabled');
}

// Unlock dialog input
function unlockDialogInput() {
    userInput.disabled = false;
    sendBtn.disabled = false;
    voiceBtn.disabled = false;
    aiAssistBtn.disabled = false;
    rateChatBtn.disabled = false;
    userInput.placeholder = '';
    userInput.classList.remove('disabled');
}

// Load prompts from Firebase (real-time) or localStorage
function loadPrompts() {
    // Always load from localStorage first for instant render
    loadSavedData();

    // If Firebase is initialized, listen for real-time updates
    if (db) {
        try {
            const promptsRef = ref(db, 'prompts');
            onValue(promptsRef, (snapshot) => {
                const data = snapshot.val();
                console.log('Firebase data received:', data);
                
                if (data) {
                    console.log('Loading prompts from Firebase...');
                    // Update fields only if they are not focused (to avoid overwriting user input while typing)
                    if (document.activeElement !== systemPromptInput && data.client_prompt) {
                        systemPromptInput.value = data.client_prompt;
                        localStorage.setItem('systemPrompt', data.client_prompt);
                    }
                    
                    if (document.activeElement !== raterPromptInput && data.rater_prompt) {
                        raterPromptInput.value = data.rater_prompt;
                        localStorage.setItem('raterPrompt', data.rater_prompt);
                    }
                    
                    if (document.activeElement !== managerPromptInput && data.manager_prompt) {
                        managerPromptInput.value = data.manager_prompt;
                        localStorage.setItem('managerPrompt', data.manager_prompt);
                    }
                    
                    // Update previews after loading
                    if (typeof updateAllPreviews === 'function') {
                        updateAllPreviews();
                    }
                    console.log('Prompts loaded from Firebase');
                } else {
                    // Firebase is empty - upload local data if exists
                    const hasLocalData = systemPromptInput.value || raterPromptInput.value || managerPromptInput.value;
                    console.log('Firebase is empty. Local data exists:', hasLocalData);
                    if (hasLocalData) {
                        console.log('Uploading local data to Firebase...');
                        savePromptsToFirebaseNow();
                    }
                }
            });
            console.log('Firebase connected, listening for updates...');
        } catch (e) {
            console.error('Error setting up Firebase listener:', e);
        }
    }
}

// Save prompts to Firebase immediately (no debounce)
function savePromptsToFirebaseNow() {
    if (!db) return;

    const payload = {
        client_prompt: systemPromptInput.value,
        rater_prompt: raterPromptInput.value,
        manager_prompt: managerPromptInput.value
    };

    set(ref(db, 'prompts'), payload)
        .then(() => console.log('Prompts synced to Firebase'))
        .catch(e => console.error('Failed to sync to Firebase:', e));
}

// Save prompts to Firebase (debounced)
const savePromptsToFirebase = debounce(() => {
    savePromptsToFirebaseNow();
}, 1000); // Save after 1 second of no typing

// Load saved data from localStorage
// Remove Turndown escape characters from markdown
function unescapeMarkdown(text) {
    if (!text) return text;
    return text
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
        .replace(/\\!/g, '!');
}

function loadSavedData() {
    const savedPrompt = localStorage.getItem('systemPrompt');
    const savedRaterPrompt = localStorage.getItem('raterPrompt');
    const savedManagerPrompt = localStorage.getItem('managerPrompt');
    const savedManagerName = localStorage.getItem('managerName');
    
    if (savedPrompt) {
        // Clean up any escaped markdown from previous Turndown usage
        const cleanedPrompt = unescapeMarkdown(savedPrompt);
        systemPromptInput.value = cleanedPrompt;
        // Save cleaned version back
        if (cleanedPrompt !== savedPrompt) {
            localStorage.setItem('systemPrompt', cleanedPrompt);
        }
    }
    
    if (savedRaterPrompt) {
        const cleanedRaterPrompt = unescapeMarkdown(savedRaterPrompt);
        raterPromptInput.value = cleanedRaterPrompt;
        if (cleanedRaterPrompt !== savedRaterPrompt) {
            localStorage.setItem('raterPrompt', cleanedRaterPrompt);
        }
    }
    
    // Load manager prompt
    if (savedManagerPrompt) {
        const cleanedManagerPrompt = unescapeMarkdown(savedManagerPrompt);
        managerPromptInput.value = cleanedManagerPrompt;
        if (cleanedManagerPrompt !== savedManagerPrompt) {
            localStorage.setItem('managerPrompt', cleanedManagerPrompt);
        }
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
    // Если пустой - минимальная высота
    if (!textarea.value.trim()) {
        textarea.style.height = '44px';
        return;
    }
    textarea.style.height = '44px'; // Сначала сбросим до минимума
    const newHeight = Math.max(44, Math.min(textarea.scrollHeight, 300)); // Минимум 44px, максимум 300px
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
        contentDiv.innerHTML = renderMarkdown(content);
    } else {
        contentDiv.textContent = content;
    }
    
    messageDiv.appendChild(contentDiv);
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageDiv;
}

// Clear chat
function clearChat() {
    conversationHistory = [];
    lastRating = null;
    isDialogRated = false; // Сбрасываем флаг оценки
    unlockDialogInput(); // Разблокируем ввод при очистке
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
    
    if (!userMessage || isProcessing || isDialogRated) {
        return;
    }
    
    // Disable input while processing
    isProcessing = true;
    toggleInputState(false);
    
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
    userInput.style.height = '44px'; // Сброс высоты
    
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
        const assistantMessage = extractApiResponse(data);
        
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
        // Только если чат не заблокирован оценкой
        if (!lastRating) {
            toggleInputState(true);
            userInput.focus();
        }
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

exportChatBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = document.getElementById('exportMenu');
    if (menu) menu.classList.toggle('show');
});

// Close dropdowns when clicking outside
document.addEventListener('click', () => {
    const exportMenu = document.getElementById('exportMenu');
    const promptMenu = document.getElementById('exportPromptMenu');
    if (exportMenu) exportMenu.classList.remove('show');
    if (promptMenu) promptMenu.classList.remove('show');
});

// Handle export format selection (only for chat export menu)
document.querySelectorAll('.dropdown-item[data-format]').forEach(item => {
    item.addEventListener('click', (e) => {
        const btn = e.target.closest('.dropdown-item');
        const format = btn ? btn.dataset.format : e.target.dataset.format;
        exportChat(format);
    });
});

exportCurrentPromptBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = document.getElementById('exportPromptMenu');
    if (menu) menu.classList.toggle('show');
});

// Handle prompt export format selection
document.querySelectorAll('.dropdown-item[data-prompt-format]').forEach(item => {
    item.addEventListener('click', (e) => {
        const btn = e.target.closest('.dropdown-item');
        const format = btn ? btn.dataset.promptFormat : e.target.dataset.promptFormat;
        exportCurrentPrompt(format);
    });
});

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
    toggleInputState(true); // Разблокируем ввод для нового диалога
    
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
        const assistantMessage = extractApiResponse(data);
        
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
        messages.push({
            role: 'ОЦЕНКА ДИАЛОГА',
            content: lastRating
        });
    }

    const filename = `диалог ${new Date().toLocaleString().replace(/[:.]/g, '-')}`;

    if (format === 'clipboard') {
        copyMessagesToClipboard(messages);
    } else if (format === 'txt') {
        exportToTxt(messages, filename);
    } else if (format === 'docx') {
        exportToDocx(messages, filename);
    } else if (format === 'rtf') {
        exportToRtf(messages, filename);
    }
}

// Copy messages to clipboard (plain text without markdown)
async function copyMessagesToClipboard(messages) {
    let chatText = '';
    messages.forEach((msg, index) => {
        chatText += `${msg.role}: ${msg.content}`;
        if (index < messages.length - 1) chatText += '\n\n';
    });
    
    try {
        await navigator.clipboard.writeText(chatText);
        showCopyNotification('Диалог скопирован в буфер обмена');
    } catch (err) {
        console.error('Failed to copy:', err);
        alert('Ошибка копирования в буфер обмена');
    }
}

// Show temporary notification
function showCopyNotification(text) {
    // Remove existing notification
    const existing = document.querySelector('.copy-notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = 'copy-notification';
    notification.textContent = text;
    document.body.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Remove after 2 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

function exportToTxt(messages, filename) {
    let chatText = '';
    messages.forEach((msg, index) => {
        chatText += `${msg.role}: ${msg.content}`;
        if (index < messages.length - 1) chatText += '\n\n';
    });
    
    const blob = new Blob([chatText], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, filename + '.txt');
}

function exportToDocx(messages, filename) {
    if (typeof docx === 'undefined') {
        alert('Библиотека docx не загружена');
        return;
    }
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = docx;
    
    const children = [];
    
    // Title
    children.push(new Paragraph({
        text: "История диалога",
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
    }));
    
    messages.forEach(msg => {
        const isRating = msg.role === 'ОЦЕНКА ДИАЛОГА';
        
        // Role
        children.push(new Paragraph({
            children: [
                new TextRun({
                    text: msg.role + ":",
                    bold: true,
                    size: 24, // 12pt
                    color: isRating ? "FF9900" : "2E74B5"
                })
            ],
            spacing: { before: 200, after: 100 }
        }));
        
        // Content
        children.push(new Paragraph({
            children: [
                new TextRun({
                    text: msg.content,
                    size: 24 // 12pt
                })
            ],
            spacing: { after: 200 }
        }));
    });

    const doc = new Document({
        sections: [{
            properties: {},
            children: children
        }]
    });

    Packer.toBlob(doc).then(blob => {
        saveAs(blob, filename + ".docx");
    });
}

function exportToRtf(messages, filename) {
    function escapeRtf(str) {
        if (!str) return '';
        return str.replace(/\\/g, '\\\\')
                  .replace(/{/g, '\\{')
                  .replace(/}/g, '\\}')
                  .replace(/\n/g, '\\par ')
                  .replace(/[^\x00-\x7F]/g, c => `\\u${c.charCodeAt(0)}?`);
    }

    // Header
    let rtf = "{\\rtf1\\ansi\\deff0\\nouicompat{\\fonttbl{\\f0\\fnil\\fcharset0 Calibri;}{\\f1\\fnil\\fcharset204 Segoe UI;}}\n";
    rtf += "{\\colortbl ;\\red46\\green116\\blue181;\\red255\\green153\\blue0;}\n";
    rtf += "\\viewkind4\\uc1\n\\pard\\sa200\\sl276\\slmult1\\qc\\b\\f1\\fs32 История диалога\\par\n\\pard\\sa200\\sl276\\slmult1\\par\n";
    
    messages.forEach(msg => {
        const isRating = msg.role === 'ОЦЕНКА ДИАЛОГА';
        const colorIndex = isRating ? 2 : 1; 
        
        rtf += `\\pard\\sa200\\sl276\\slmult1\\cf${colorIndex}\\b\\fs24 ${escapeRtf(msg.role)}:\\cf0\\b0\\par\n`;
        rtf += `\\pard\\sa200\\sl276\\slmult1 ${escapeRtf(msg.content)}\\par\n`;
        rtf += "\\par\n";
    });
    
    rtf += "}";
    
    const blob = new Blob([rtf], { type: "application/rtf" });
    saveAs(blob, filename + ".rtf");
}

// Export current active prompt
function exportCurrentPrompt(format = 'txt') {
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
    
    const timestamp = new Date().toLocaleString().replace(/[:.]/g, '-');
    const fullFileName = `${fileName} ${timestamp}`;
    
    if (format === 'clipboard') {
        copyPromptToClipboard(promptText, fileName);
    } else if (format === 'txt') {
        exportPromptToTxt(promptText, fullFileName);
    } else if (format === 'docx') {
        exportPromptToDocx(promptText, fullFileName, fileName);
    } else if (format === 'rtf') {
        exportPromptToRtf(promptText, fullFileName, fileName);
    }
}

// Copy prompt to clipboard (plain text)
async function copyPromptToClipboard(text, label) {
    try {
        await navigator.clipboard.writeText(text);
        showCopyNotification(`${label} скопирован в буфер обмена`);
    } catch (err) {
        console.error('Failed to copy:', err);
        alert('Ошибка копирования в буфер обмена');
    }
}

function exportPromptToTxt(text, filename) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, filename + '.txt');
}

// Parse markdown inline formatting and return array of TextRuns
function parseMarkdownInline(text, baseSize = 24) {
    const runs = [];
    // Regex to match **bold**, *italic*, or plain text
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|([^*]+))/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
        if (match[2]) {
            // Bold text **...**
            runs.push(new docx.TextRun({
                text: match[2],
                bold: true,
                size: baseSize
            }));
        } else if (match[3]) {
            // Italic text *...*
            runs.push(new docx.TextRun({
                text: match[3],
                italics: true,
                size: baseSize
            }));
        } else if (match[4]) {
            // Plain text
            runs.push(new docx.TextRun({
                text: match[4],
                size: baseSize
            }));
        }
    }
    
    return runs.length > 0 ? runs : [new docx.TextRun({ text: text, size: baseSize })];
}

function exportPromptToDocx(text, filename, title) {
    if (typeof docx === 'undefined') {
        alert('Библиотека docx не загружена');
        return;
    }
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = docx;
    
    const children = [];
    
    // Title
    children.push(new Paragraph({
        text: title,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
    }));
    
    // Split text by lines
    const lines = text.split('\n');
    
    lines.forEach(line => {
        const trimmedLine = line.trim();
        
        // Skip empty lines but add spacing
        if (!trimmedLine) {
            children.push(new Paragraph({ spacing: { after: 100 } }));
            return;
        }
        
        // Check for headers (## or **HEADER**)
        const h2Match = trimmedLine.match(/^##\s+(.+)$/);
        const h3Match = trimmedLine.match(/^###\s+(.+)$/);
        const boldHeaderMatch = trimmedLine.match(/^\*\*([A-ZА-ЯЁ][A-ZА-ЯЁ\s\(\)«»\-:,0-9]+)\*\*$/);
        
        if (h2Match) {
            children.push(new Paragraph({
                text: h2Match[1],
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 150 }
            }));
        } else if (h3Match) {
            children.push(new Paragraph({
                text: h3Match[1],
                heading: HeadingLevel.HEADING_3,
                spacing: { before: 200, after: 100 }
            }));
        } else if (boldHeaderMatch) {
            // Bold uppercase text as header
            children.push(new Paragraph({
                children: [new TextRun({ text: boldHeaderMatch[1], bold: true, size: 26 })],
                spacing: { before: 300, after: 150 }
            }));
        } else {
            // Check for list items
            const bulletMatch = trimmedLine.match(/^[-•]\s+(.+)$/);
            const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
            
            if (bulletMatch) {
                children.push(new Paragraph({
                    children: parseMarkdownInline(bulletMatch[1]),
                    bullet: { level: 0 },
                    spacing: { after: 80 }
                }));
            } else if (numberedMatch) {
                children.push(new Paragraph({
                    children: [
                        new TextRun({ text: numberedMatch[1] + '. ', size: 24 }),
                        ...parseMarkdownInline(numberedMatch[2])
                    ],
                    spacing: { after: 80 }
                }));
            } else {
                // Regular paragraph with inline formatting
                children.push(new Paragraph({
                    children: parseMarkdownInline(trimmedLine),
                    spacing: { after: 120 }
                }));
            }
        }
    });

    const doc = new Document({
        sections: [{
            properties: {},
            children: children
        }]
    });

    Packer.toBlob(doc).then(blob => {
        saveAs(blob, filename + ".docx");
    });
}

function exportPromptToRtf(text, filename, title) {
    function escapeRtfChar(str) {
        if (!str) return '';
        return str.replace(/\\/g, '\\\\')
                  .replace(/{/g, '\\{')
                  .replace(/}/g, '\\}')
                  .replace(/[^\x00-\x7F]/g, c => `\\u${c.charCodeAt(0)}?`);
    }
    
    // Parse markdown inline and return RTF formatted string
    function parseMarkdownToRtf(line) {
        let result = '';
        const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|([^*]+))/g;
        let match;
        
        while ((match = regex.exec(line)) !== null) {
            if (match[2]) {
                // Bold
                result += '\\b ' + escapeRtfChar(match[2]) + '\\b0 ';
            } else if (match[3]) {
                // Italic
                result += '\\i ' + escapeRtfChar(match[3]) + '\\i0 ';
            } else if (match[4]) {
                result += escapeRtfChar(match[4]);
            }
        }
        
        return result || escapeRtfChar(line);
    }

    // Header
    let rtf = "{\\rtf1\\ansi\\deff0\\nouicompat{\\fonttbl{\\f0\\fnil\\fcharset0 Calibri;}{\\f1\\fnil\\fcharset204 Segoe UI;}}\n";
    rtf += "{\\colortbl ;\\red46\\green116\\blue181;}\n";
    rtf += "\\viewkind4\\uc1\n\\pard\\sa200\\sl276\\slmult1\\qc\\cf1\\b\\f1\\fs32 " + escapeRtfChar(title) + "\\cf0\\b0\\par\n\\pard\\sa200\\sl276\\slmult1\\par\n";
    
    // Process each line
    const lines = text.split('\n');
    lines.forEach(line => {
        const trimmedLine = line.trim();
        
        if (!trimmedLine) {
            rtf += "\\par\n";
            return;
        }
        
        // Check for headers
        const boldHeaderMatch = trimmedLine.match(/^\*\*([A-ZА-ЯЁ][A-ZА-ЯЁ\s\(\)«»\-:,0-9]+)\*\*$/);
        const bulletMatch = trimmedLine.match(/^[-•]\s+(.+)$/);
        const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
        
        if (boldHeaderMatch) {
            rtf += "\\pard\\sa100\\sb200\\b\\fs26 " + escapeRtfChar(boldHeaderMatch[1]) + "\\b0\\fs24\\par\n";
        } else if (bulletMatch) {
            rtf += "\\pard\\fi-360\\li720\\sa50 \\bullet\\tab " + parseMarkdownToRtf(bulletMatch[1]) + "\\par\n";
        } else if (numberedMatch) {
            rtf += "\\pard\\fi-360\\li720\\sa50 " + numberedMatch[1] + ".\\tab " + parseMarkdownToRtf(numberedMatch[2]) + "\\par\n";
        } else {
            rtf += "\\pard\\sa100\\fs24 " + parseMarkdownToRtf(trimmedLine) + "\\par\n";
        }
    });
    
    rtf += "}";
    
    const blob = new Blob([rtf], { type: "application/rtf" });
    saveAs(blob, filename + ".rtf");
}

// Rate chat dialog
async function rateChat() {
    if (conversationHistory.length === 0) {
        alert('Нет диалога для оценки');
        return;
    }
    
    if (isProcessing) {
        return;
    }
    
    // Disable button while processing
    rateChatBtn.disabled = true;
    rateChatBtn.classList.add('loading');
    
    // Disable inputs
    toggleInputState(false);
    
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
        const ratingMessage = extractApiResponse(data);
        
        if (!ratingMessage) {
            throw new Error('Пустой ответ от сервера оценки');
        }
        
        // Remove loading message
        loadingMsg.remove();
        
        // Save rating for export
        lastRating = ratingMessage;
        
        // Add rating as special rating message (centered, orange)
        addMessage(ratingMessage, 'rating', true);
        
        // Lock the dialog - no more input allowed
        isDialogRated = true;
        lockDialogInput();
        
    } catch (error) {
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
        
        // Если оценка не была получена (ошибка), разблокируем ввод
        // Если оценка получена успешно (lastRating установлен), оставляем ввод заблокированным
        if (!lastRating) {
            toggleInputState(true);
            userInput.focus();
        }
    }
}

// Auto-save prompt on change (with debounce)
systemPromptInput.addEventListener('input', () => {
    // Local save (immediate)
    localStorage.setItem('systemPrompt', systemPromptInput.value);
    // Firebase save (debounced)
    savePromptsToFirebase();
});

// Auto-save rater prompt on change (with debounce)
raterPromptInput.addEventListener('input', () => {
    // Local save (immediate)
    localStorage.setItem('raterPrompt', raterPromptInput.value);
    // Firebase save (debounced)
    savePromptsToFirebase();
});

// Auto-save manager prompt on change
managerPromptInput.addEventListener('input', () => {
    localStorage.setItem('managerPrompt', managerPromptInput.value);
    savePromptsToFirebase();
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
                        // Use convertToMarkdown to preserve formatting (headers, bold, lists, etc.)
                        const result = await mammoth.convertToMarkdown({ arrayBuffer: arrayBuffer });
                        setTextWithUndo(textarea, result.value);
                        localStorage.setItem(storageKey, textarea.value);
                    } catch (err) {
                        alert('Ошибка чтения .docx файла');
                    }
                };
                reader.readAsArrayBuffer(file);
            }
            // Check for text-based files
            else if (file.type.startsWith('text/') || TEXT_EXTENSIONS.some(ext => fileName.endsWith(ext))) {
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
                        // Use convertToMarkdown to preserve formatting (headers, bold, lists, etc.)
                        const result = await mammoth.convertToMarkdown({ arrayBuffer: arrayBuffer });
                        textarea.value = result.value;
                        localStorage.setItem(storageKey, textarea.value);
                        // Update preview
                        previewElement.innerHTML = renderMarkdown(textarea.value);
                    } catch (err) {
                        alert('Ошибка чтения .docx файла');
                    }
                };
                reader.readAsArrayBuffer(file);
            }
            // Check for text-based files
            else if (file.type.startsWith('text/') || TEXT_EXTENSIONS.some(ext => fileName.endsWith(ext))) {
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

// Preview elements (WYSIWYG - always editable)
const systemPromptPreview = document.getElementById('systemPromptPreview');
const managerPromptPreview = document.getElementById('managerPromptPreview');
const raterPromptPreview = document.getElementById('raterPromptPreview');

// Debounced sync from WYSIWYG to textarea
const syncWYSIWYGDebounced = debounce(function(previewElement, textarea, storageKey) {
    if (turndownService && previewElement) {
        const markdown = turndownService.turndown(previewElement.innerHTML);
        textarea.value = markdown;
        localStorage.setItem(storageKey, markdown);
    }
}, 300);

// Setup WYSIWYG editing for a preview element
function setupWYSIWYG(previewElement, textarea, storageKey) {
    // Make preview editable
    previewElement.setAttribute('contenteditable', 'true');
    
    // Sync changes back to textarea
    previewElement.addEventListener('input', () => {
        syncWYSIWYGDebounced(previewElement, textarea, storageKey);
    });
    
    // Handle paste - insert as plain text, then re-render
    previewElement.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        
        // Insert at cursor position
        const selection = window.getSelection();
        if (selection.rangeCount) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            
            // Check if pasted text looks like markdown
            const hasMarkdown = /^#|^\*\*|\*\*$|^-\s|^\d+\.\s|^```|^>/.test(text);
            
            if (hasMarkdown) {
                // Render markdown and insert
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = renderMarkdown(text);
                const fragment = document.createDocumentFragment();
                while (tempDiv.firstChild) {
                    fragment.appendChild(tempDiv.firstChild);
                }
                range.insertNode(fragment);
            } else {
                // Insert as plain text
                const textNode = document.createTextNode(text);
                range.insertNode(textNode);
            }
            
            // Move cursor to end
            selection.collapseToEnd();
        }
        
        // Sync to textarea
        syncWYSIWYGDebounced(previewElement, textarea, storageKey);
    });
}

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

// Initialize WYSIWYG mode (always on - no toggle needed)
function initWYSIWYGMode() {
    // Always show preview mode
    document.querySelectorAll('.prompt-wrapper').forEach(wrapper => {
        wrapper.classList.add('preview-mode');
    });
    
    // Hide toggle button - not needed anymore
    if (togglePreviewBtn) {
        togglePreviewBtn.style.display = 'none';
    }
    
    // Setup WYSIWYG for all preview elements
    setupWYSIWYG(systemPromptPreview, systemPromptInput, 'systemPrompt');
    setupWYSIWYG(managerPromptPreview, managerPromptInput, 'managerPrompt');
    setupWYSIWYG(raterPromptPreview, raterPromptInput, 'raterPrompt');
    
    // Render initial content
    updateAllPreviews();
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

// Toggle preview button event - disabled, WYSIWYG always on
// togglePreviewBtn.addEventListener('click', togglePreviewMode);

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
        
        // Update preview (WYSIWYG always on)
        updatePreview();
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
    if (isDialogRated) {
        return;
    }
    
    if (conversationHistory.length === 0) {
        alert('Нет истории диалога для генерации ответа. Сначала отправьте хотя бы одно сообщение.');
        return;
    }
    
    if (isProcessing) {
        return;
    }
    
    // Disable button while processing
    aiAssistBtn.disabled = true;
    aiAssistBtn.classList.add('loading');
    
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
        const basePrompt = managerPromptInput.value.trim();
        const fullPrompt = `Тебя зовут ${managerName}.\n\n${basePrompt}`;
        
        const requestBody = {
            systemPrompt: fullPrompt,
            userMessage: lastMessage,
            dialogHistory: dialogHistory.trim(),
            sessionId: managerSessionId
        };
        
        // Make webhook request
        const response = await fetch(MANAGER_ASSISTANT_WEBHOOK_URL, {
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
        let aiMessage = extractApiResponse(data);
        
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

// Initialize WYSIWYG mode (always on)
setTimeout(() => {
    initWYSIWYGMode();
}, 100);

// Setup drag and drop for preview elements
setupDragAndDropForPreview(systemPromptPreview, systemPromptInput, 'systemPrompt');
setupDragAndDropForPreview(managerPromptPreview, managerPromptInput, 'managerPrompt');
setupDragAndDropForPreview(raterPromptPreview, raterPromptInput, 'raterPrompt');

// WYSIWYG Toolbar functionality (Google Docs style)
function getActivePreview() {
    const activeEditor = document.querySelector('.instruction-editor.active');
    if (!activeEditor) return null;
    return activeEditor.querySelector('.prompt-preview');
}

function getActiveTextarea() {
    const activeEditor = document.querySelector('.instruction-editor.active');
    if (!activeEditor) return null;
    return activeEditor.querySelector('.prompt-editor');
}

// Apply formatting using execCommand (WYSIWYG)
// Check if selection is inside a specific tag
function isInsideTag(tagName) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return false;
    
    let node = selection.anchorNode;
    while (node && node !== document.body) {
        if (node.nodeName && node.nodeName.toLowerCase() === tagName.toLowerCase()) {
            return node;
        }
        node = node.parentNode;
    }
    return null;
}

// Unwrap element - move its contents outside and remove the tag
function unwrapElement(element) {
    const parent = element.parentNode;
    while (element.firstChild) {
        parent.insertBefore(element.firstChild, element);
    }
    parent.removeChild(element);
}

function applyFormat(action) {
    const preview = getActivePreview();
    if (!preview) return;
    
    // Focus preview to ensure execCommand works
    preview.focus();
    
    switch (action) {
        case 'h1':
            // Toggle: if already h1, convert back to paragraph
            if (isInsideTag('h1')) {
                document.execCommand('formatBlock', false, 'p');
            } else {
                document.execCommand('formatBlock', false, 'h1');
            }
            break;
        case 'h2':
            if (isInsideTag('h2')) {
                document.execCommand('formatBlock', false, 'p');
            } else {
                document.execCommand('formatBlock', false, 'h2');
            }
            break;
        case 'h3':
            if (isInsideTag('h3')) {
                document.execCommand('formatBlock', false, 'p');
            } else {
                document.execCommand('formatBlock', false, 'h3');
            }
            break;
        case 'bold':
            document.execCommand('bold', false, null);
            break;
        case 'italic':
            document.execCommand('italic', false, null);
            break;
        case 'strike':
            document.execCommand('strikeThrough', false, null);
            break;
        case 'ul':
            document.execCommand('insertUnorderedList', false, null);
            break;
        case 'ol':
            document.execCommand('insertOrderedList', false, null);
            break;
        case 'quote':
            // Toggle: if already in blockquote, convert back to paragraph
            if (isInsideTag('blockquote')) {
                document.execCommand('formatBlock', false, 'p');
            } else {
                document.execCommand('formatBlock', false, 'blockquote');
            }
            break;
        case 'code':
            // Toggle: if inside code, unwrap it
            const codeElement = isInsideTag('code');
            if (codeElement) {
                // Save selection
                const selection = window.getSelection();
                const range = selection.getRangeAt(0);
                
                // Unwrap the code element
                unwrapElement(codeElement);
                
                // Restore selection
                selection.removeAllRanges();
                selection.addRange(range);
            } else {
                // Wrap selection in <code> tag only if there's selected text
                const selection = window.getSelection();
                const selectedText = selection.toString().trim();
                
                // Don't create empty code tags
                if (!selectedText) {
                    break;
                }
                
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const code = document.createElement('code');
                    code.appendChild(range.extractContents());
                    range.insertNode(code);
                    selection.removeAllRanges();
                    const newRange = document.createRange();
                    newRange.selectNodeContents(code);
                    selection.addRange(newRange);
                }
            }
            break;
        case 'hr':
            document.execCommand('insertHorizontalRule', false, null);
            break;
    }
    
    // Sync changes back to textarea
    syncPreviewToTextarea();
}

// Sync preview HTML back to textarea as markdown
function syncPreviewToTextarea() {
    const preview = getActivePreview();
    const textarea = getActiveTextarea();
    if (!preview || !textarea) return;
    
    // Use TurndownService to convert HTML to Markdown
    if (turndownService) {
        const markdown = turndownService.turndown(preview.innerHTML);
        textarea.value = markdown;
        localStorage.setItem(textarea.id, markdown);
    }
}

// Toolbar button click handlers
document.querySelectorAll('.toolbar-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const action = btn.dataset.action;
        applyFormat(action);
    });
});

// Keyboard shortcuts for formatting in preview
document.querySelectorAll('.prompt-preview').forEach(preview => {
    preview.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'b':
                    e.preventDefault();
                    applyFormat('bold');
                    break;
                case 'i':
                    e.preventDefault();
                    applyFormat('italic');
                    break;
            }
        }
    });
});


