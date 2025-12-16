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
const MANAGER_ASSISTANT_WEBHOOK_URL = 'https://n8n-api.tradicia-k.ru/webhook/manager-simulator';
const AI_IMPROVE_WEBHOOK_URL = 'https://n8n-api.tradicia-k.ru/webhook/prompt-enchancement';

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
const promptVariationsContainer = document.getElementById('promptVariations');

// AI Improve Modal Elements
const aiImproveBtn = document.getElementById('aiImproveBtn');
const aiImproveModal = document.getElementById('aiImproveModal');
const aiImproveModalClose = document.getElementById('aiImproveModalClose');

const aiImproveStep1 = document.getElementById('aiImproveStep1');
const aiImproveInput = document.getElementById('aiImproveInput');
const aiImproveSubmit = document.getElementById('aiImproveSubmit');
const aiImproveCancel = document.getElementById('aiImproveCancel');

const aiImproveStep2 = document.getElementById('aiImproveStep2');
const aiDiffView = document.getElementById('aiDiffView');
const aiImproveBack = document.getElementById('aiImproveBack');
const aiImproveApply = document.getElementById('aiImproveApply');

let pendingImprovedPrompt = null;
let pendingRole = null;
let pendingName = null;

// State
let conversationHistory = [];
let isProcessing = false;
let lastRating = null;
let isDialogRated = false;
let isUserEditing = false;
let lastFirebaseData = null;

// Prompt Variations Data
let promptsData = {
    client: { variations: [], activeId: null },
    manager: { variations: [], activeId: null },
    rater: { variations: [], activeId: null }
};

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
    return data.response || data.message || data.output || data.text || data.rating || JSON.stringify(data, null, 2);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
            clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
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

function getActiveRole() {
    const activeTab = document.querySelector('.instruction-tab.active');
    return activeTab ? activeTab.dataset.instruction : 'client';
}

function getManagerName() {
    return managerNameInput.value.trim() || 'менеджер';
}

// Chat input state
function toggleInputState(enabled) {
    userInput.disabled = !enabled;
    sendBtn.disabled = !enabled;
    voiceBtn.disabled = !enabled;
    aiAssistBtn.disabled = !enabled;
    if (enabled) {
        userInput.classList.remove('disabled');
    } else {
        userInput.classList.add('disabled');
    }
}

function lockDialogInput() {
    userInput.disabled = true;
    sendBtn.disabled = true;
    voiceBtn.disabled = true;
    aiAssistBtn.disabled = true;
    rateChatBtn.disabled = true;
    userInput.placeholder = 'Очистите чат для нового диалога';
    userInput.classList.add('disabled');
}

function unlockDialogInput() {
    userInput.disabled = false;
    sendBtn.disabled = false;
    voiceBtn.disabled = false;
    aiAssistBtn.disabled = false;
    rateChatBtn.disabled = false;
    userInput.placeholder = '';
    userInput.classList.remove('disabled');
}

// ============ PROMPT VARIATIONS LOGIC ============

function initPromptsData(firebaseData = {}) {
    const roles = ['client', 'manager', 'rater'];
    
    roles.forEach(role => {
        if (firebaseData[role + '_variations'] && Array.isArray(firebaseData[role + '_variations'])) {
            // Unescape content in all variations
            promptsData[role].variations = firebaseData[role + '_variations'].map(v => ({
                ...v,
                content: unescapeMarkdown(v.content || '')
            }));
            promptsData[role].activeId = firebaseData[role + '_activeId'] || 
                (promptsData[role].variations[0] ? promptsData[role].variations[0].id : null);
        } else {
            // Migration: use legacy single prompt
            let legacyKey = role === 'client' ? 'systemPrompt' : role + 'Prompt';
            let legacyContent = firebaseData[role + '_prompt'] || localStorage.getItem(legacyKey) || '';
            
            if (promptsData[role].variations.length === 0) {
                const defaultId = generateId();
                promptsData[role].variations.push({
                    id: defaultId,
                    name: 'Основной',
                    content: unescapeMarkdown(legacyContent)
                });
                promptsData[role].activeId = defaultId;
            }
        }
    });
    
    renderVariations();
    updateAllPreviews();
}

function renderVariations() {
    const role = getActiveRole();
    if (!promptsData[role] || !promptVariationsContainer) return;
    
    const variations = promptsData[role].variations;
    const activeId = promptsData[role].activeId;
    
    promptVariationsContainer.innerHTML = '';
    
    variations.forEach(v => {
        const chip = document.createElement('div');
        chip.className = `prompt-variation-chip ${v.id === activeId ? 'active' : ''}`;
        chip.innerHTML = `
            <span class="chip-name">${v.name}</span>
            ${variations.length > 1 ? '<span class="delete-variation">×</span>' : ''}
        `;
        
        chip.addEventListener('click', (e) => {
            if (!e.target.classList.contains('delete-variation')) {
                setActiveVariation(role, v.id);
            }
        });
        
        chip.querySelector('.chip-name').addEventListener('dblclick', (e) => {
            e.stopPropagation();
            const newName = prompt('Название промпта:', v.name);
            if (newName && newName.trim()) {
                v.name = newName.trim();
                renderVariations();
                savePromptsToFirebase();
            }
        });
        
        const deleteBtn = chip.querySelector('.delete-variation');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Удалить промпт "${v.name}"?`)) {
                    deleteVariation(role, v.id);
                }
            });
        }
        
        promptVariationsContainer.appendChild(chip);
    });
    
    // Add button
    const addBtn = document.createElement('button');
    addBtn.className = 'add-variation-btn';
    addBtn.innerHTML = '+';
    addBtn.title = 'Добавить вариант промпта';
    addBtn.addEventListener('click', () => addVariation(role));
    promptVariationsContainer.appendChild(addBtn);
}

function addVariation(role) {
    const count = promptsData[role].variations.length + 1;
    const newId = generateId();
    promptsData[role].variations.push({
        id: newId,
        name: `Вариант ${count}`,
        content: ''
    });
    setActiveVariation(role, newId);
    savePromptsToFirebase();
}

function deleteVariation(role, id) {
    const index = promptsData[role].variations.findIndex(v => v.id === id);
    if (index > -1) {
        promptsData[role].variations.splice(index, 1);
        if (promptsData[role].activeId === id) {
            promptsData[role].activeId = promptsData[role].variations[0].id;
        }
        renderVariations();
        updateEditorContent(role);
        savePromptsToFirebase();
    }
}

function setActiveVariation(role, id) {
    // Save current editor content before switching
    syncCurrentEditorNow();
    
    promptsData[role].activeId = id;
    renderVariations();
    updateEditorContent(role);
}

function updateEditorContent(role) {
    const activeVar = promptsData[role].variations.find(v => v.id === promptsData[role].activeId);
    const content = activeVar ? activeVar.content : '';
    
    let textarea, preview;
    if (role === 'client') {
        textarea = systemPromptInput;
        preview = document.getElementById('systemPromptPreview');
    } else if (role === 'manager') {
        textarea = managerPromptInput;
        preview = document.getElementById('managerPromptPreview');
    } else if (role === 'rater') {
        textarea = raterPromptInput;
        preview = document.getElementById('raterPromptPreview');
    }
    
    if (textarea && preview) {
        // Only update if content has actually changed to prevent cursor jumping
        if (textarea.value !== content) {
            textarea.value = content;
            preview.innerHTML = renderMarkdown(content);
            if (typeof hljs !== 'undefined') {
                preview.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
            }
        }
    }
}

function syncContentToData(role, content) {
    const activeVar = promptsData[role].variations.find(v => v.id === promptsData[role].activeId);
    if (activeVar) {
        activeVar.content = content;
        savePromptsToFirebase();
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
    if (!db) return;

    const payload = {
        client_prompt: getActiveContent('client'),
        manager_prompt: getActiveContent('manager'),
        rater_prompt: getActiveContent('rater'),
        
        client_variations: promptsData.client.variations,
        client_activeId: promptsData.client.activeId,
        manager_variations: promptsData.manager.variations,
        manager_activeId: promptsData.manager.activeId,
        rater_variations: promptsData.rater.variations,
        rater_activeId: promptsData.rater.activeId
    };

    set(ref(db, 'prompts'), payload)
        .then(() => console.log('Prompts synced to Firebase'))
        .catch(e => console.error('Failed to sync:', e));
}

function loadPrompts() {
    // Load manager name
    const savedManagerName = localStorage.getItem('managerName');
    if (savedManagerName) {
        managerNameInput.value = savedManagerName;
    } else {
        showNameModal();
    }

    if (db) {
        try {
            const promptsRef = ref(db, 'prompts');
            onValue(promptsRef, (snapshot) => {
                const data = snapshot.val();
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
        } catch (e) {
            console.error('Error setting up Firebase listener:', e);
            initPromptsData({});
        }
    } else {
        initPromptsData({});
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

modalNameSubmit.addEventListener('click', () => {
    const name = modalNameInput.value.trim();
    if (name) {
        localStorage.setItem('managerName', name);
        managerNameInput.value = name;
        hideNameModal();
    } else {
        modalNameInput.focus();
        modalNameInput.style.borderColor = '#ff5555';
        setTimeout(() => { modalNameInput.style.borderColor = ''; }, 1000);
    }
});

modalNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') modalNameSubmit.click();
});

managerNameInput.addEventListener('input', () => {
    const name = managerNameInput.value.trim();
    if (name) localStorage.setItem('managerName', name);
});

// ============ AI IMPROVE MODAL ============

function showAiImproveModal() {
    aiImproveModal.classList.add('active');
    
    // Reset to step 1
    aiImproveStep1.style.display = 'block';
    aiImproveStep2.style.display = 'none';
    pendingImprovedPrompt = null;
    
    setTimeout(() => aiImproveInput.focus(), 100);
}

function hideAiImproveModal() {
    aiImproveModal.classList.remove('active');
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
    
    const role = getActiveRole();
    const currentPrompt = getActiveContent(role);
    const activeVar = promptsData[role].variations.find(v => v.id === promptsData[role].activeId);
    const currentName = activeVar ? activeVar.name : 'Промпт';
    
    if (!currentPrompt) {
        alert('Сначала добавьте текст в инструкцию');
        return;
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
        const response = await fetch(AI_IMPROVE_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userMessage: `Изначальный промпт:\n\n${currentPrompt}\n\n---\n\nЗапрос на улучшение: ${improvementRequest}\n\n---\n\nВАЖНО: Верни ПОЛНЫЙ текст улучшенного промпта. Подсвети изменения так:\n1. Удаленный/измененный текст оберни в ~~ (например: ~~старый текст~~)\n2. Новый/добавленный текст оберни в ++ (например: ++новый текст++)\n3. Остальной текст оставь без изменений.\nНе используй markdown код-блоки.`
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
    // 1. Replace markers with unique tokens that won't mess up markdown parsing
    // We use a specific sequence that is unlikely to be in the text
    let processedText = textWithMarkers
        .replace(/~~([\s\S]+?)~~/g, ':::DEL-START:::$1:::DEL-END:::')
        .replace(/\+\+([\s\S]+?)\+\+/g, ':::INS-START:::$1:::INS-END:::');
        
    // 2. Render markdown (handles **bold**, *italic*, headers etc.)
    let html = renderMarkdown(processedText);
    
    // 3. Replace tokens with actual HTML highlight tags
    html = html
        .replace(/:::DEL-START:::/g, '<span class="diff-removed">')
        .replace(/:::DEL-END:::/g, '</span>')
        .replace(/:::INS-START:::/g, '<span class="diff-added">')
        .replace(/:::INS-END:::/g, '</span>');

    aiDiffView.innerHTML = html;
    
    // Switch view
    aiImproveStep1.style.display = 'none';
    aiImproveStep2.style.display = 'block';
}

function applyImprovedPrompt() {
    if (!pendingImprovedPrompt || !pendingRole) return;
    
    const newId = generateId();
    const newName = `${pendingName} AI`;
    
    promptsData[pendingRole].variations.push({
        id: newId,
        name: newName,
        content: pendingImprovedPrompt
    });
    
    // Switch to new variation
    setActiveVariation(pendingRole, newId);
    savePromptsToFirebase();
    
    hideAiImproveModal();
    aiImproveInput.value = ''; // Clear input after successful apply
    showCopyNotification('Инструкция улучшена!');
    
    // Reset pending
    pendingImprovedPrompt = null;
    pendingRole = null;
    pendingName = null;
}

aiImproveBtn.addEventListener('click', showAiImproveModal);
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
    unlockDialogInput();
    
    baseSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('sessionId', baseSessionId);
    clientSessionId = baseSessionId + '_client';
    managerSessionId = baseSessionId + '_manager';
    raterSessionId = baseSessionId + '_rater';
    
    chatMessages.innerHTML = `<div id="startConversation" class="start-conversation"><button id="startBtn" class="btn-start">Начать диалог</button></div>`;
    document.getElementById('startBtn').addEventListener('click', startConversationHandler);
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
        
        const response = await fetch(WEBHOOK_URL, {
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
        
        const data = await response.json();
        const assistantMessage = extractApiResponse(data);
        if (!assistantMessage) throw new Error('Пустой ответ');
        
        loadingMsg.remove();
        addMessage(assistantMessage, 'assistant', true);
        conversationHistory.push({ role: 'assistant', content: assistantMessage });
        
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
    toggleInputState(true);
    
    const startDiv = document.getElementById('startConversation');
    if (startDiv) startDiv.style.display = 'none';
    
    const loadingMsg = addMessage('', 'loading');
    
    try {
        const systemPrompt = systemPromptInput.value.trim();
        const response = await fetch(WEBHOOK_URL, {
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
        
        const data = await response.json();
        const assistantMessage = extractApiResponse(data);
        if (!assistantMessage) throw new Error('Пустой ответ');
        
        loadingMsg.remove();
        addMessage(assistantMessage, 'assistant', true);
        conversationHistory.push({ role: 'assistant', content: assistantMessage });
        
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
    
    rateChatBtn.disabled = true;
    rateChatBtn.classList.add('loading');
    toggleInputState(false);
    
    const loadingMsg = addMessage('', 'loading');
    
    try {
        let dialogText = '';
        conversationHistory.forEach((msg) => {
            const role = msg.role === 'user' ? 'Менеджер' : 'Клиент';
            dialogText += `${role}: ${msg.content}\n\n`;
        });
        
        const raterPrompt = raterPromptInput.value.trim() || 'Оцените качество диалога.';
        
        const response = await fetch(RATE_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dialog: dialogText.trim(),
                raterPrompt: raterPrompt,
                sessionId: raterSessionId
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        const ratingMessage = extractApiResponse(data);
        if (!ratingMessage) throw new Error('Пустой ответ');
        
        loadingMsg.remove();
        lastRating = ratingMessage;
        addMessage(ratingMessage, 'rating', true);
        isDialogRated = true;
        lockDialogInput();
        
    } catch (error) {
        loadingMsg.remove();
        addMessage(`Ошибка оценки: ${error.message}`, 'error', false);
    } finally {
        rateChatBtn.disabled = false;
        rateChatBtn.classList.remove('loading');
        if (!lastRating) {
            toggleInputState(true);
            userInput.focus();
        }
    }
}

async function generateAIResponse() {
    if (isDialogRated || conversationHistory.length === 0 || isProcessing) return;
    
    aiAssistBtn.disabled = true;
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
        
        const response = await fetch(MANAGER_ASSISTANT_WEBHOOK_URL, {
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
        
        const data = await response.json();
        let aiMessage = extractApiResponse(data);
        if (!aiMessage) throw new Error('Пустой ответ');
        
        aiMessage = aiMessage.trim().replace(/^["']|["']$/g, '').replace(/^(Менеджер|Manager):\s*/i, '');
        
        userInput.value = aiMessage;
        autoResizeTextarea(userInput);
        userInput.focus();
        
    } catch (error) {
        console.error('AI generation error:', error);
        alert('Ошибка: ' + error.message);
    } finally {
        aiAssistBtn.disabled = false;
        aiAssistBtn.classList.remove('loading');
    }
}

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
}

function parseStyledText(text, TextRun) {
    const runs = [];
    let lastIndex = 0;
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|__(.+?)__|_(.+?)_)/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            runs.push(new TextRun({ text: text.slice(lastIndex, match.index), size: 24 }));
        }
        if (match[2]) { // **bold**
            runs.push(new TextRun({ text: match[2], bold: true, size: 24 }));
        } else if (match[3]) { // *italic*
            runs.push(new TextRun({ text: match[3], italics: true, size: 24 }));
        } else if (match[4]) { // __bold__
            runs.push(new TextRun({ text: match[4], bold: true, size: 24 }));
        } else if (match[5]) { // _italic_
            runs.push(new TextRun({ text: match[5], italics: true, size: 24 }));
        }
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
        runs.push(new TextRun({ text: text.slice(lastIndex), size: 24 }));
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
        
        // Handle empty lines with minimal spacing to avoid huge gaps
        if (trimmed === '') {
            children.push(new Paragraph({ text: '', spacing: { after: 0 } }));
            return;
        }
        
        // Base paragraph options
        let paraOpts = {
            spacing: { after: 120 }, // 6pt spacing after paragraphs
            children: []
        };

        if (line.startsWith('# ')) {
            paraOpts.text = line.slice(2);
            paraOpts.heading = HeadingLevel.HEADING_1;
            paraOpts.spacing = { before: 240, after: 120 };
        } else if (line.startsWith('## ')) {
            paraOpts.text = line.slice(3);
            paraOpts.heading = HeadingLevel.HEADING_2;
            paraOpts.spacing = { before: 240, after: 120 };
        } else if (line.startsWith('### ')) {
            paraOpts.text = line.slice(4);
            paraOpts.heading = HeadingLevel.HEADING_3;
            paraOpts.spacing = { before: 240, after: 120 };
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
            paraOpts.indent = { left: 720, hanging: 360 };
            paraOpts.children.push(new TextRun({ text: '•\t' + line.slice(2), size: 24 }));
        } else if (/^\d+\.\s/.test(line)) {
            paraOpts.indent = { left: 720, hanging: 360 };
            const firstSpace = line.indexOf(' ');
            paraOpts.children.push(new TextRun({ text: line.slice(0, firstSpace) + '\t' + line.slice(firstSpace + 1), size: 24 }));
        } else if (/^[IVXLCDM]+\.?\s/.test(line)) {
            // Roman numerals (I. or I)
            paraOpts.indent = { left: 720, hanging: 360 };
            const firstSpace = line.indexOf(' ');
            paraOpts.children.push(new TextRun({ text: line.slice(0, firstSpace) + '\t' + line.slice(firstSpace + 1), size: 24 }));
        } else {
            // Regular text with potential markdown
            paraOpts.children = parseStyledText(line, TextRun);
        }

        // Use children for headers if we want to strip markdown symbols from them? 
        // Current implementation for headers uses 'text' property which is simple string. 
        // If headers contain **bold**, it won't be parsed. 
        // But let's stick to simple headers for now as per previous implementation logic.
        
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
    ['client', 'manager', 'rater'].forEach(updateEditorContent);
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
    }, 2000);
}, 300);

// Force immediate sync of current editor content
function syncCurrentEditorNow() {
    const role = getActiveRole();
    let preview, textarea;
    
    if (role === 'client') {
        preview = document.getElementById('systemPromptPreview');
        textarea = systemPromptInput;
    } else if (role === 'manager') {
        preview = document.getElementById('managerPromptPreview');
        textarea = managerPromptInput;
    } else if (role === 'rater') {
        preview = document.getElementById('raterPromptPreview');
        textarea = raterPromptInput;
    }
    
    if (turndownService && preview && textarea) {
        const markdown = turndownService.turndown(preview.innerHTML);
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
    
    const togglePreviewBtn = document.getElementById('togglePreviewBtn');
    if (togglePreviewBtn) togglePreviewBtn.style.display = 'none';
    
    const systemPromptPreview = document.getElementById('systemPromptPreview');
    const managerPromptPreview = document.getElementById('managerPromptPreview');
    const raterPromptPreview = document.getElementById('raterPromptPreview');
    
    setupWYSIWYG(systemPromptPreview, systemPromptInput, (c) => syncContentToData('client', c));
    setupWYSIWYG(managerPromptPreview, managerPromptInput, (c) => syncContentToData('manager', c));
    setupWYSIWYG(raterPromptPreview, raterPromptInput, (c) => syncContentToData('rater', c));
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
    textarea.addEventListener('dragover', (e) => { e.preventDefault(); textarea.classList.add('drag-over'); });
    textarea.addEventListener('dragleave', (e) => { e.preventDefault(); textarea.classList.remove('drag-over'); });
    textarea.addEventListener('drop', (e) => {
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
        e.preventDefault();
        previewElement.classList.add('drag-over');
    });
    previewElement.addEventListener('dragleave', (e) => {
        e.preventDefault();
        previewElement.classList.remove('drag-over');
    });
    previewElement.addEventListener('drop', (e) => {
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
userInput.addEventListener('input', () => autoResizeTextarea(userInput));
clearChatBtn.addEventListener('click', () => { if (confirm('Очистить чат?')) clearChat(); });
startBtn.addEventListener('click', startConversationHandler);
rateChatBtn.addEventListener('click', rateChat);
aiAssistBtn.addEventListener('click', generateAIResponse);

exportChatBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('exportMenu').classList.toggle('show');
});

exportCurrentPromptBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('exportPromptMenu').classList.toggle('show');
});

document.addEventListener('click', () => {
    document.getElementById('exportMenu')?.classList.remove('show');
    document.getElementById('exportPromptMenu')?.classList.remove('show');
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
        // Save current editor content before switching
        syncCurrentEditorNow();
        
        const instructionType = tab.dataset.instruction;
        
        instructionTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
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
const instructionsPanel = document.getElementById('instructionsPanel');
let isResizing = false;

resizeHandle1.addEventListener('mousedown', () => {
    isResizing = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const container = document.querySelector('.panels-container');
    const chatWidth = (e.clientX / container.offsetWidth) * 100;
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
        else if (action === 'quote') document.execCommand('formatBlock', false, 'blockquote');
        else if (action === 'hr') document.execCommand('insertHorizontalRule', false, null);
    });
});

// Cloud save button
const saveToCloudBtn = document.getElementById('saveToCloudBtn');
if (saveToCloudBtn) {
    saveToCloudBtn.addEventListener('click', () => {
        savePromptsToFirebaseNow();
        saveToCloudBtn.classList.add('saving');
        setTimeout(() => {
            saveToCloudBtn.classList.remove('saving');
            saveToCloudBtn.classList.add('saved');
            setTimeout(() => saveToCloudBtn.classList.remove('saved'), 1500);
        }, 500);
    });
}

// ============ INITIALIZATION ============

loadPrompts();
initSpeechRecognition();
userInput.focus();
autoResizeTextarea(userInput);

setupDragAndDrop(systemPromptInput);
setupDragAndDrop(managerPromptInput);
setupDragAndDrop(raterPromptInput);

// Setup drag and drop for preview elements (WYSIWYG mode)
const systemPromptPreviewEl = document.getElementById('systemPromptPreview');
const managerPromptPreviewEl = document.getElementById('managerPromptPreview');
const raterPromptPreviewEl = document.getElementById('raterPromptPreview');

setupDragAndDropForPreview(systemPromptPreviewEl, systemPromptInput);
setupDragAndDropForPreview(managerPromptPreviewEl, managerPromptInput);
setupDragAndDropForPreview(raterPromptPreviewEl, raterPromptInput);

setTimeout(() => {
    initWYSIWYGMode();
    renderVariations();
}, 200);
