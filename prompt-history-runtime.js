export function createPromptHistoryRuntimeHelpers(deps = {}) {
    const buildPromptHistoryEntryHash = typeof deps.buildPromptHistoryEntryHash === 'function'
        ? deps.buildPromptHistoryEntryHash
        : (() => '');
    const buildPromptHistorySnapshotHash = typeof deps.buildPromptHistorySnapshotHash === 'function'
        ? deps.buildPromptHistorySnapshotHash
        : (() => '');
    const clonePromptHistoryEntry = typeof deps.clonePromptHistoryEntry === 'function'
        ? deps.clonePromptHistoryEntry
        : ((entry = null) => entry);
    const clearCachedLocalStorageJson = typeof deps.clearCachedLocalStorageJson === 'function'
        ? deps.clearCachedLocalStorageJson
        : (() => {});
    const clearTimeoutFn = typeof deps.clearTimeoutFn === 'function'
        ? deps.clearTimeoutFn
        : ((id) => clearTimeout(id));
    const debugLog = typeof deps.debugLog === 'function'
        ? deps.debugLog
        : (() => {});
    const debounceMs = Number.isFinite(deps.debounceMs)
        ? Number(deps.debounceMs)
        : 500;
    const ensureCurrentUserAccessMirror = typeof deps.ensureCurrentUserAccessMirror === 'function'
        ? deps.ensureCurrentUserAccessMirror
        : (async () => true);
    const generateId = typeof deps.generateId === 'function'
        ? deps.generateId
        : (() => `id_${Math.random().toString(36).slice(2, 10)}`);
    const getPromptHistoryEntries = typeof deps.getPromptHistoryEntries === 'function'
        ? deps.getPromptHistoryEntries
        : (() => []);
    const getState = typeof deps.getState === 'function'
        ? deps.getState
        : (() => ({}));
    const isAdmin = typeof deps.isAdmin === 'function'
        ? deps.isAdmin
        : (() => false);
    const isPromptHistoryModalActive = typeof deps.isPromptHistoryModalActive === 'function'
        ? deps.isPromptHistoryModalActive
        : (() => false);
    const localStorageKey = typeof deps.localStorageKey === 'string' && deps.localStorageKey.trim()
        ? deps.localStorageKey.trim()
        : 'promptHistory';
    const normalizePromptHistoryEntries = typeof deps.normalizePromptHistoryEntries === 'function'
        ? deps.normalizePromptHistoryEntries
        : ((history = []) => Array.isArray(history) ? history : []);
    const onSyncError = typeof deps.onSyncError === 'function'
        ? deps.onSyncError
        : ((error) => console.error('Failed to sync history entries:', error));
    const renderPromptHistory = typeof deps.renderPromptHistory === 'function'
        ? deps.renderPromptHistory
        : (() => {});
    const retryDelayMs = Number.isFinite(deps.retryDelayMs)
        ? Number(deps.retryDelayMs)
        : 2000;
    const setCachedLocalStorageJson = typeof deps.setCachedLocalStorageJson === 'function'
        ? deps.setCachedLocalStorageJson
        : (() => {});
    const setState = typeof deps.setState === 'function'
        ? deps.setState
        : (() => {});
    const setTimeoutFn = typeof deps.setTimeoutFn === 'function'
        ? deps.setTimeoutFn
        : ((handler, delay) => setTimeout(handler, delay));
    const writePromptHistoryBatch = typeof deps.writePromptHistoryBatch === 'function'
        ? deps.writePromptHistoryBatch
        : (async () => true);

    function clearPromptHistoryRemoteSyncState() {
        const state = getState();
        if (state.promptHistoryRemoteSyncTimer) {
            clearTimeoutFn(state.promptHistoryRemoteSyncTimer);
        }
        setState({
            promptHistoryRemoteSyncInFlight: false,
            promptHistoryRemoteSyncTimer: null,
            queuedPromptHistoryRemoteEntries: new Map(),
            syncedPromptHistoryEntryIds: new Set()
        });
        return true;
    }

    function schedulePromptHistoryRemoteFlush(delayMs = debounceMs) {
        const state = getState();
        if (state.promptHistoryRemoteSyncTimer) {
            clearTimeoutFn(state.promptHistoryRemoteSyncTimer);
        }
        const timerId = setTimeoutFn(() => {
            setState({
                promptHistoryRemoteSyncTimer: null
            });
            void flushPromptHistoryRemoteSync();
        }, delayMs);
        setState({
            promptHistoryRemoteSyncTimer: timerId
        });
        return timerId;
    }

    function queuePromptHistoryRemoteSync(entries = []) {
        const state = getState();
        if (!state.db || !isAdmin()) return false;
        const normalizedEntries = (Array.isArray(entries) ? entries : [entries])
            .map((entry) => clonePromptHistoryEntry(entry))
            .filter(Boolean);
        if (!normalizedEntries.length) return false;

        const queuedEntries = state.queuedPromptHistoryRemoteEntries instanceof Map
            ? new Map(state.queuedPromptHistoryRemoteEntries)
            : new Map();
        const syncedEntryIds = state.syncedPromptHistoryEntryIds instanceof Set
            ? state.syncedPromptHistoryEntryIds
            : new Set();

        let didQueue = false;
        normalizedEntries.forEach((entry) => {
            if (syncedEntryIds.has(entry.id) && !queuedEntries.has(entry.id)) {
                return;
            }
            const previous = queuedEntries.get(entry.id);
            if (previous && buildPromptHistoryEntryHash(previous) === buildPromptHistoryEntryHash(entry)) {
                return;
            }
            queuedEntries.set(entry.id, entry);
            didQueue = true;
        });

        if (!didQueue) return false;

        setState({
            queuedPromptHistoryRemoteEntries: queuedEntries
        });
        schedulePromptHistoryRemoteFlush(debounceMs);
        return true;
    }

    async function flushPromptHistoryRemoteSync() {
        const startState = getState();
        if (startState.promptHistoryRemoteSyncTimer) {
            clearTimeoutFn(startState.promptHistoryRemoteSyncTimer);
            setState({
                promptHistoryRemoteSyncTimer: null
            });
        }

        const state = getState();
        const queuedEntries = state.queuedPromptHistoryRemoteEntries instanceof Map
            ? state.queuedPromptHistoryRemoteEntries
            : new Map();
        if (state.promptHistoryRemoteSyncInFlight || !state.db || !queuedEntries.size || !isAdmin()) {
            return false;
        }

        const batch = Array.from(queuedEntries.values())
            .map((entry) => clonePromptHistoryEntry(entry))
            .filter(Boolean);
        if (!batch.length) {
            setState({
                queuedPromptHistoryRemoteEntries: new Map()
            });
            return false;
        }

        setState({
            promptHistoryRemoteSyncInFlight: true,
            queuedPromptHistoryRemoteEntries: new Map()
        });

        try {
            const canSync = await ensureCurrentUserAccessMirror();
            if (!canSync) {
                throw new Error('Не удалось синхронизировать prompt history access mirror.');
            }

            const updatesPayload = {};
            batch.forEach((entry) => {
                updatesPayload[entry.id] = entry;
            });
            await writePromptHistoryBatch(updatesPayload);

            const nextSyncedEntryIds = state.syncedPromptHistoryEntryIds instanceof Set
                ? new Set(state.syncedPromptHistoryEntryIds)
                : new Set();
            batch.forEach((entry) => {
                nextSyncedEntryIds.add(entry.id);
            });
            setState({
                syncedPromptHistoryEntryIds: nextSyncedEntryIds
            });
            debugLog('Prompt history synced incrementally', { count: batch.length });
            return true;
        } catch (error) {
            onSyncError(error);
            const restoredQueue = new Map();
            batch.forEach((entry) => {
                restoredQueue.set(entry.id, entry);
            });
            const currentQueue = getState().queuedPromptHistoryRemoteEntries instanceof Map
                ? getState().queuedPromptHistoryRemoteEntries
                : new Map();
            currentQueue.forEach((entry, id) => {
                restoredQueue.set(id, entry);
            });
            setState({
                queuedPromptHistoryRemoteEntries: restoredQueue
            });
            if (!getState().promptHistoryRemoteSyncTimer) {
                schedulePromptHistoryRemoteFlush(retryDelayMs);
            }
            return false;
        } finally {
            setState({
                promptHistoryRemoteSyncInFlight: false
            });
            const finalState = getState();
            const finalQueue = finalState.queuedPromptHistoryRemoteEntries instanceof Map
                ? finalState.queuedPromptHistoryRemoteEntries
                : new Map();
            if (finalQueue.size && !finalState.promptHistoryRemoteSyncTimer) {
                schedulePromptHistoryRemoteFlush(debounceMs);
            }
        }
    }

    function savePromptHistory(options = {}) {
        const state = getState();
        if (!state.promptHistory) return false;

        const normalizedHistory = normalizePromptHistoryEntries(state.promptHistory);
        const snapshotHash = buildPromptHistorySnapshotHash(normalizedHistory);

        if (!normalizedHistory.length) {
            clearCachedLocalStorageJson(localStorageKey, []);
        } else {
            setCachedLocalStorageJson(localStorageKey, normalizedHistory);
        }

        setState({
            lastPromptHistorySnapshotHash: snapshotHash,
            promptHistory: normalizedHistory
        });
        queuePromptHistoryRemoteSync(options.syncEntries || []);
        return true;
    }

    function ensurePromptHistoryBaseline(role = '', variation = null) {
        const state = getState();
        if (!isAdmin() || !role || !variation || variation.isLocal) return false;
        if (getPromptHistoryEntries(state.promptHistory, role, variation.id).length) return false;

        const entry = {
            id: generateId(),
            ts: Date.now(),
            role,
            variationId: variation.id,
            variationName: variation.name,
            content: variation.content || '',
            kind: 'baseline',
            note: 'Базовая public-версия'
        };
        const nextPromptHistory = Array.isArray(state.promptHistory)
            ? [...state.promptHistory, entry]
            : [entry];
        setState({
            promptHistory: nextPromptHistory
        });
        savePromptHistory({ syncEntries: [entry] });
        if (isPromptHistoryModalActive()) {
            renderPromptHistory();
        }
        return true;
    }

    function recordPromptHistory(role = '', variation = null, options = {}) {
        const state = getState();
        if (!isAdmin() || !variation) return false;
        const content = variation.content || '';
        const roleHistoryContent = state.lastHistoryContent?.[role] || {};
        const lastContent = roleHistoryContent[variation.id] ?? '';
        if (content === lastContent) return false;

        const normalizedOptions = typeof options === 'string'
            ? { kind: options }
            : (options && typeof options === 'object' ? options : {});
        const entry = {
            id: generateId(),
            ts: Date.now(),
            role,
            variationId: variation.id,
            variationName: variation.name,
            content,
            kind: normalizedOptions.kind || 'edit',
            note: String(normalizedOptions.note || '')
        };

        const nextPromptHistory = Array.isArray(state.promptHistory)
            ? [entry, ...state.promptHistory]
            : [entry];
        const nextLastHistoryContent = {
            ...(state.lastHistoryContent || {}),
            [role]: {
                ...(state.lastHistoryContent?.[role] || {}),
                [variation.id]: content
            }
        };
        setState({
            lastHistoryContent: nextLastHistoryContent,
            promptHistory: nextPromptHistory
        });
        savePromptHistory({ syncEntries: [entry] });
        if (isPromptHistoryModalActive()) {
            renderPromptHistory();
        }
        return true;
    }

    function checkpointPromptHistory(role = '', variationId = '', options = {}) {
        const state = getState();
        if (!role || !variationId) return false;
        const variation = (state.promptsData?.[role]?.variations || []).find((item) => item.id === variationId);
        if (!variation || variation.isLocal) return false;
        return recordPromptHistory(role, variation, options);
    }

    return {
        checkpointPromptHistory,
        clearPromptHistoryRemoteSyncState,
        ensurePromptHistoryBaseline,
        flushPromptHistoryRemoteSync,
        queuePromptHistoryRemoteSync,
        recordPromptHistory,
        savePromptHistory
    };
}
