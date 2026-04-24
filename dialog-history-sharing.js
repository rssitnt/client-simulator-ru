export function createDialogHistorySharingHelpers(deps = {}) {
    const MAX_SHARED_DIALOG_MESSAGES = 120;
    const MAX_SHARED_DIALOG_MESSAGE_LENGTH = 3000;
    const MAX_SHARED_DIALOG_RATING_LENGTH = 12000;
    const normalizeLogin = typeof deps.normalizeLogin === 'function'
        ? deps.normalizeLogin
        : ((value = '') => String(value || '').trim().toLowerCase());
    const loginToStorageKey = typeof deps.loginToStorageKey === 'function'
        ? deps.loginToStorageKey
        : ((value = '') => String(value || '').trim().toLowerCase());
    const normalizeDialogHistoryText = typeof deps.normalizeDialogHistoryText === 'function'
        ? deps.normalizeDialogHistoryText
        : ((value = '') => String(value || '').trim());
    const clampDialogHistoryTitle = typeof deps.clampDialogHistoryTitle === 'function'
        ? deps.clampDialogHistoryTitle
        : ((value = '', fallback = '') => String(value || fallback || '').trim().slice(0, 140));
    const getDialogHistoryRecordEffectiveTitle = typeof deps.getDialogHistoryRecordEffectiveTitle === 'function'
        ? deps.getDialogHistoryRecordEffectiveTitle
        : ((record = null) => String(record?.title || '').trim());
    const indexDbPath = String(deps.dialogHistoryIndexDbPath || 'dialog_history_index').trim();
    const messagesDbPath = String(deps.dialogHistoryMessagesDbPath || 'dialog_history_messages').trim();
    const sharedDialogsDbPath = String(deps.sharedDialogsDbPath || 'shared_dialogs').trim();

    function getDialogHistoryOwnerLogin(login = '') {
        return normalizeLogin(login);
    }

    function getDialogHistoryOwnerKey(login = '') {
        const normalizedLogin = getDialogHistoryOwnerLogin(login);
        return normalizedLogin ? loginToStorageKey(normalizedLogin) : '';
    }

    function getDialogHistoryIndexPath(login = '', dialogId = '') {
        const ownerKey = getDialogHistoryOwnerKey(login);
        if (!ownerKey) return '';
        return dialogId
            ? `${indexDbPath}/${ownerKey}/${dialogId}`
            : `${indexDbPath}/${ownerKey}`;
    }

    function getDialogHistoryMessagesPath(login = '', dialogId = '') {
        const ownerKey = getDialogHistoryOwnerKey(login);
        if (!ownerKey) return '';
        return dialogId
            ? `${messagesDbPath}/${ownerKey}/${dialogId}`
            : `${messagesDbPath}/${ownerKey}`;
    }

    function normalizeSharedDialogId(value = '') {
        const normalized = String(value || '').trim();
        if (!normalized) return '';
        return normalized.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
    }

    function getSharedDialogPath(shareId = '') {
        const normalized = normalizeSharedDialogId(shareId);
        if (!normalized) return '';
        return `${sharedDialogsDbPath}/${normalized}`;
    }

    function buildSharedDialogUrl(shareId = '', href = '') {
        const normalized = normalizeSharedDialogId(shareId);
        const baseHref = String(href || '').trim();
        if (!normalized || !baseHref) return '';
        const url = new URL(baseHref);
        url.searchParams.set('share', normalized);
        url.hash = '';
        return url.toString();
    }

    function buildSharedDialogPayload(record = null, payload = null, shareId = '') {
        const normalizedShareId = normalizeSharedDialogId(shareId);
        if (!record || !payload || !normalizedShareId) return null;
        const messages = Array.isArray(payload.messages) ? payload.messages : [];
        const normalizedMessages = messages.map((message, index) => {
            const content = normalizeDialogHistoryText(message?.content || '').slice(0, MAX_SHARED_DIALOG_MESSAGE_LENGTH);
            if (!content) return null;
            return {
                id: String(message?.id || `m_${String(index + 1).padStart(4, '0')}`).trim().slice(0, 80),
                seq: Math.max(0, Number(message?.seq) || index + 1),
                role: message?.role === 'assistant' ? 'assistant' : 'user',
                content
            };
        }).filter(Boolean).slice(-MAX_SHARED_DIALOG_MESSAGES);
        if (!normalizedMessages.length) return null;
        const ratingText = normalizeDialogHistoryText(payload?.rating?.text || '').slice(0, MAX_SHARED_DIALOG_RATING_LENGTH);
        return {
            id: normalizedShareId,
            title: clampDialogHistoryTitle(getDialogHistoryRecordEffectiveTitle(record)),
            mode: payload?.mode === 'voice' ? 'voice' : 'text',
            createdAt: new Date().toISOString(),
            source: {
                login: normalizeLogin(record.login || ''),
                dialogId: String(record.id || '').trim()
            },
            messages: normalizedMessages,
            rating: ratingText
                ? { text: ratingText }
                : null
        };
    }

    function normalizeSharedDialogPayload(raw, shareId = '') {
        if (!raw || typeof raw !== 'object') return null;
        const normalizedShareId = normalizeSharedDialogId(raw.id || shareId);
        if (!normalizedShareId) return null;
        const messages = Array.isArray(raw.messages) ? raw.messages : [];
        const normalizedMessages = messages.map((message, index) => {
            const content = normalizeDialogHistoryText(message?.content || '').slice(0, MAX_SHARED_DIALOG_MESSAGE_LENGTH);
            if (!content) return null;
            return {
                id: String(message?.id || `m_${String(index + 1).padStart(4, '0')}`).trim().slice(0, 80),
                seq: Math.max(0, Number(message?.seq) || index + 1),
                role: message?.role === 'assistant' ? 'assistant' : 'user',
                content
            };
        }).filter(Boolean);
        const limitedMessages = normalizedMessages
            .sort((left, right) => {
                if (left.seq !== right.seq) return left.seq - right.seq;
                return left.id.localeCompare(right.id);
            })
            .slice(-MAX_SHARED_DIALOG_MESSAGES);
        if (!limitedMessages.length) return null;
        const ratingText = normalizeDialogHistoryText(raw?.rating?.text || raw?.ratingText || '').slice(0, MAX_SHARED_DIALOG_RATING_LENGTH);
        return {
            id: normalizedShareId,
            title: clampDialogHistoryTitle(raw.title || ''),
            mode: raw.mode === 'voice' ? 'voice' : 'text',
            createdAt: String(raw.createdAt || '').trim() || new Date().toISOString(),
            messages: limitedMessages,
            rating: ratingText ? { text: ratingText } : null
        };
    }

    return {
        buildSharedDialogPayload,
        buildSharedDialogUrl,
        getDialogHistoryIndexPath,
        getDialogHistoryMessagesPath,
        getDialogHistoryOwnerKey,
        getDialogHistoryOwnerLogin,
        getSharedDialogPath,
        normalizeSharedDialogId,
        normalizeSharedDialogPayload
    };
}
