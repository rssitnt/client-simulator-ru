// Gemini API Configuration
const API_KEY = 'AIzaSyApWhyf3mik_iQvQ08yZ_ErCKmCODHyd6g';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent';

// DOM Elements
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const clearChatBtn = document.getElementById('clearChat');
const systemPromptInput = document.getElementById('systemPrompt');
const savePromptBtn = document.getElementById('savePrompt');

// State
let conversationHistory = [];
let isProcessing = false;

// Load saved data from localStorage
function loadSavedData() {
    const savedPrompt = localStorage.getItem('systemPrompt');
    
    if (savedPrompt) {
        systemPromptInput.value = savedPrompt;
    }
}

// Save prompt to localStorage
function savePrompt() {
    localStorage.setItem('systemPrompt', systemPromptInput.value);
    
    // Visual feedback
    const originalText = savePromptBtn.textContent;
    savePromptBtn.textContent = '✓ Сохранено';
    savePromptBtn.style.background = '#2a5a3a';
    
    setTimeout(() => {
        savePromptBtn.textContent = originalText;
        savePromptBtn.style.background = '';
    }, 1500);
}

// Add message to chat
function addMessage(content, role) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    messageDiv.textContent = content;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageDiv;
}

// Clear chat
function clearChat() {
    conversationHistory = [];
    chatMessages.innerHTML = '';
}

// Send message to Gemini API
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
    addMessage(userMessage, 'user');
    conversationHistory.push({
        role: 'user',
        parts: [{ text: userMessage }]
    });
    
    // Clear input
    userInput.value = '';
    
    // Show loading indicator
    const loadingMsg = addMessage('Генерация ответа...', 'loading');
    
    try {
        // Prepare request body
        const systemPrompt = systemPromptInput.value.trim();
        const temperature = 1.0; // Default temperature
        const maxTokens = 2000; // Default max tokens
        
        const contents = [];
        
        // Add system prompt as first user message if exists and conversation is starting
        if (systemPrompt && conversationHistory.length === 1) {
            contents.push({
                role: 'user',
                parts: [{ text: `Системные инструкции: ${systemPrompt}\n\nТеперь ответь на следующее сообщение пользователя.` }]
            });
            contents.push({
                role: 'model',
                parts: [{ text: 'Понял. Я готов помочь согласно заданным инструкциям.' }]
            });
        }
        
        // Add conversation history
        contents.push(...conversationHistory);
        
        const requestBody = {
            contents: contents,
            generationConfig: {
                temperature: temperature,
                maxOutputTokens: maxTokens,
                topP: 0.95,
                topK: 40
            }
        };
        
        // Make API request
        const response = await fetch(`${API_URL}?key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'API request failed');
        }
        
        const data = await response.json();
        
        // Extract assistant response
        const assistantMessage = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!assistantMessage) {
            throw new Error('No response from API');
        }
        
        // Remove loading message
        loadingMsg.remove();
        
        // Add assistant message to chat
        addMessage(assistantMessage, 'assistant');
        conversationHistory.push({
            role: 'model',
            parts: [{ text: assistantMessage }]
        });
        
    } catch (error) {
        console.error('Error:', error);
        loadingMsg.remove();
        addMessage(`Ошибка: ${error.message}`, 'error');
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

clearChatBtn.addEventListener('click', () => {
    if (confirm('Очистить весь чат?')) {
        clearChat();
    }
});

savePromptBtn.addEventListener('click', savePrompt);

// Auto-save prompt on change (with debounce)
let saveTimeout;
systemPromptInput.addEventListener('input', () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        localStorage.setItem('systemPrompt', systemPromptInput.value);
    }, 1000);
});

// Initialize
loadSavedData();
userInput.focus();

// Welcome message
setTimeout(() => {
    if (conversationHistory.length === 0) {
        addMessage('Добро пожаловать в AI Agent Studio! Настройте системный промпт справа и начните тестирование вашего агента.', 'assistant');
    }
}, 500);

