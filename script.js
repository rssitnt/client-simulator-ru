// n8n Webhook Configuration
const WEBHOOK_URL = 'https://n8n-api.tradicia-k.ru/webhook/1f0629dc-22be-496b-bf2b-2d7090578a3c';
const RATE_WEBHOOK_URL = 'https://n8n-api.tradicia-k.ru/webhook/client-simulator-rate';

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
const rateChatBtn = document.getElementById('rateChat');

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
    
    // Footer with time and actions
    if (role !== 'loading') {
        const footerDiv = document.createElement('div');
        footerDiv.className = 'message-footer';
        
        const time = new Date().toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        footerDiv.innerHTML = `
            <span class="message-time">${time}</span>
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
let saveTimeout;
systemPromptInput.addEventListener('input', () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        localStorage.setItem('systemPrompt', systemPromptInput.value);
    }, 1000);
});

// Auto-save rater prompt on change (with debounce)
let saveRaterTimeout;
raterPromptInput.addEventListener('input', () => {
    clearTimeout(saveRaterTimeout);
    saveRaterTimeout = setTimeout(() => {
        localStorage.setItem('raterPrompt', raterPromptInput.value);
    }, 1000);
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
        userInput.placeholder = 'Говорите...';
        userInput.style.paddingRight = '40px';
    };
    
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const currentText = userInput.value;
        userInput.value = currentText + (currentText ? ' ' : '') + transcript;
        autoResizeTextarea(userInput);
    };
    
    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'no-speech') {
            userInput.placeholder = 'Введите сообщение...';
        } else if (event.error === 'not-allowed') {
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
    userInput.placeholder = 'Введите сообщение...';
    userInput.style.paddingRight = '';
}

// Voice button event
voiceBtn.addEventListener('click', () => {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
});

// Initialize
loadSavedData();
initSpeechRecognition();
userInput.focus();
autoResizeTextarea(userInput); // Установить начальную высоту

