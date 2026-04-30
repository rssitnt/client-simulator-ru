const DEFAULT_MAX_MESSAGE_LENGTH = 2000;

function normalizeString(value = '') {
    return String(value || '').replace(/\r\n/g, '\n').trim();
}

function stableSerialize(value) {
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
    }
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

function hashString(value = '') {
    let hash = 2166136261;
    const source = String(value || '');
    for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildPromptFirstReplyFingerprint({
    role = 'client',
    systemPrompt = '',
    conversationActionState = null
} = {}) {
    const payload = {
        role: normalizeString(role || 'client'),
        systemPrompt: normalizeString(systemPrompt),
        conversationActionState: conversationActionState && typeof conversationActionState === 'object'
            ? conversationActionState
            : null
    };
    return hashString(stableSerialize(payload));
}

export function normalizePromptFirstReplyCache(rawCache = null) {
    if (!rawCache || typeof rawCache !== 'object') return null;
    const fingerprint = normalizeString(rawCache.fingerprint || rawCache.promptHash || '');
    const message = normalizeString(rawCache.message || rawCache.text || '');
    if (!fingerprint || !message) return null;
    return {
        fingerprint,
        message: message.slice(0, DEFAULT_MAX_MESSAGE_LENGTH),
        generatedAt: normalizeString(rawCache.generatedAt || ''),
        sourceVariationId: normalizeString(rawCache.sourceVariationId || ''),
        role: normalizeString(rawCache.role || 'client') || 'client'
    };
}

export function buildPromptFirstReplyCacheRecord({
    fingerprint = '',
    message = '',
    generatedAt = '',
    role = 'client',
    sourceVariationId = ''
} = {}) {
    return normalizePromptFirstReplyCache({
        fingerprint,
        message,
        generatedAt,
        role,
        sourceVariationId
    });
}

export function getUsablePromptFirstReply(cache = null, fingerprint = '') {
    const normalizedCache = normalizePromptFirstReplyCache(cache);
    const normalizedFingerprint = normalizeString(fingerprint);
    if (!normalizedCache || !normalizedFingerprint) return '';
    if (normalizedCache.fingerprint !== normalizedFingerprint) return '';
    return normalizedCache.message;
}
