export function createDialogHistoryStoreHelpers(deps = {}) {
    const normalizeLogin = typeof deps.normalizeLogin === 'function'
        ? deps.normalizeLogin
        : ((value = '') => String(value || '').trim().toLowerCase());
    const getDialogHistoryIndexPath = typeof deps.getDialogHistoryIndexPath === 'function'
        ? deps.getDialogHistoryIndexPath
        : (() => '');
    const getDialogHistoryMessagesPath = typeof deps.getDialogHistoryMessagesPath === 'function'
        ? deps.getDialogHistoryMessagesPath
        : (() => '');
    const getSharedDialogPath = typeof deps.getSharedDialogPath === 'function'
        ? deps.getSharedDialogPath
        : (() => '');
    const readPath = typeof deps.readPath === 'function'
        ? deps.readPath
        : (async () => null);
    const writePath = typeof deps.writePath === 'function'
        ? deps.writePath
        : (async () => false);
    const refreshProtectedRead = typeof deps.refreshProtectedRead === 'function'
        ? deps.refreshProtectedRead
        : (async () => false);
    const isPermissionDeniedError = typeof deps.isPermissionDeniedError === 'function'
        ? deps.isPermissionDeniedError
        : (() => false);
    const buildPermissionError = typeof deps.buildPermissionError === 'function'
        ? deps.buildPermissionError
        : (() => new Error('Permission denied'));
    const normalizeDialogHistoryIndexRecord = typeof deps.normalizeDialogHistoryIndexRecord === 'function'
        ? deps.normalizeDialogHistoryIndexRecord
        : ((raw, dialogId = '', loginFallback = '') => ({ ...raw, id: dialogId, login: loginFallback }));
    const normalizeDialogHistoryMessagesPayload = typeof deps.normalizeDialogHistoryMessagesPayload === 'function'
        ? deps.normalizeDialogHistoryMessagesPayload
        : ((raw, loginFallback = '', dialogId = '') => ({ ...raw, id: dialogId, login: loginFallback }));
    const normalizeSharedDialogPayload = typeof deps.normalizeSharedDialogPayload === 'function'
        ? deps.normalizeSharedDialogPayload
        : ((raw) => raw);
    const sortDialogHistoryRecords = typeof deps.sortDialogHistoryRecords === 'function'
        ? deps.sortDialogHistoryRecords
        : ((records = []) => Array.isArray(records) ? [...records] : []);

    async function readProtectedValue(path = '') {
        if (!path) return null;
        try {
            return await readPath(path);
        } catch (error) {
            if (!isPermissionDeniedError(error)) throw error;
            const refreshed = await refreshProtectedRead();
            if (!refreshed) {
                throw buildPermissionError();
            }
            try {
                return await readPath(path);
            } catch (retryError) {
                if (isPermissionDeniedError(retryError)) {
                    throw buildPermissionError();
                }
                throw retryError;
            }
        }
    }

    async function persistDialogHistorySnapshot(snapshot) {
        if (!snapshot?.indexRecord || !snapshot?.messagesPayload) return false;
        const ownerLogin = normalizeLogin(snapshot.login || snapshot.indexRecord.login || snapshot.messagesPayload.login || '');
        const dialogId = String(snapshot.id || snapshot.indexRecord.id || snapshot.messagesPayload.id || '').trim();
        if (!ownerLogin || !dialogId) return false;
        const indexPath = getDialogHistoryIndexPath(ownerLogin, dialogId);
        const messagesPath = getDialogHistoryMessagesPath(ownerLogin, dialogId);
        if (!indexPath || !messagesPath) return false;

        await Promise.all([
            writePath(indexPath, snapshot.indexRecord, 'PUT'),
            writePath(messagesPath, snapshot.messagesPayload, 'PUT')
        ]);
        return true;
    }

    async function fetchDialogHistoryScopeRecords(login = '') {
        const normalizedLogin = normalizeLogin(login);
        if (!normalizedLogin) return [];
        const dbPath = getDialogHistoryIndexPath(normalizedLogin);
        if (!dbPath) return [];
        const snapshot = await readProtectedValue(dbPath);
        if (!snapshot?.exists?.()) return [];
        const raw = snapshot.val();
        const records = Object.entries(raw || {})
            .map(([dialogId, item]) => normalizeDialogHistoryIndexRecord(item, dialogId, normalizedLogin))
            .filter(Boolean);
        return sortDialogHistoryRecords(records);
    }

    async function fetchDialogHistoryPayload(login = '', dialogId = '') {
        const normalizedLogin = normalizeLogin(login);
        const normalizedDialogId = String(dialogId || '').trim();
        if (!normalizedLogin || !normalizedDialogId) return null;
        const dbPath = getDialogHistoryMessagesPath(normalizedLogin, normalizedDialogId);
        if (!dbPath) return null;
        const snapshot = await readProtectedValue(dbPath);
        if (!snapshot?.exists?.()) return null;
        return normalizeDialogHistoryMessagesPayload(snapshot.val(), normalizedLogin, normalizedDialogId);
    }

    async function saveSharedDialogPayload(shareId = '', payload = null) {
        const dbPath = getSharedDialogPath(shareId);
        if (!dbPath || !payload) return false;
        await writePath(dbPath, payload, 'PUT');
        return true;
    }

    async function fetchSharedDialogPayload(shareId = '') {
        const dbPath = getSharedDialogPath(shareId);
        if (!dbPath) return null;
        const snapshot = await readPath(dbPath);
        if (!snapshot?.exists?.()) return null;
        return normalizeSharedDialogPayload(snapshot.val(), shareId);
    }

    return {
        fetchDialogHistoryPayload,
        fetchDialogHistoryScopeRecords,
        fetchSharedDialogPayload,
        persistDialogHistorySnapshot,
        saveSharedDialogPayload
    };
}
