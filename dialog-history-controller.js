export function createDialogHistoryControllerHelpers(deps = {}) {
    const normalizeLogin = typeof deps.normalizeLogin === 'function'
        ? deps.normalizeLogin
        : ((value = '') => String(value || '').trim().toLowerCase());
    const normalizeDialogHistoryIndexRecord = typeof deps.normalizeDialogHistoryIndexRecord === 'function'
        ? deps.normalizeDialogHistoryIndexRecord
        : ((raw, dialogId = '', loginFallback = '') => ({ ...raw, id: dialogId, login: loginFallback }));
    const sortDialogHistoryRecords = typeof deps.sortDialogHistoryRecords === 'function'
        ? deps.sortDialogHistoryRecords
        : ((records = []) => Array.isArray(records) ? [...records] : []);

    function isDialogHistoryScopeOwned(scopeLogin = '', currentUserLogin = '') {
        const normalizedScopeLogin = normalizeLogin(scopeLogin);
        const normalizedCurrentLogin = normalizeLogin(currentUserLogin);
        return !!normalizedScopeLogin && normalizedScopeLogin === normalizedCurrentLogin;
    }

    function canRenameDialogHistoryRecord(record = null, currentUserLogin = '') {
        if (!record) return false;
        return isDialogHistoryScopeOwned(record.login, currentUserLogin);
    }

    function canDeleteDialogHistoryRecord(record = null, currentUserLogin = '', admin = false) {
        if (!record) return false;
        if (isDialogHistoryScopeOwned(record.login, currentUserLogin)) return true;
        return !!admin;
    }

    function createEmptyDialogHistorySelectionState() {
        return {
            selectedId: '',
            selectedPayload: null,
            selectedRecord: null,
            viewerLoading: false
        };
    }

    function upsertDialogHistoryScopeRecord(state = {}, record = null) {
        const normalized = normalizeDialogHistoryIndexRecord(record, record?.id, record?.login);
        if (!normalized) {
            return {
                currentDialogPinnedAt: state.currentDialogPinnedAt || null,
                records: Array.isArray(state.records) ? state.records : [],
                selectedRecord: state.selectedRecord || null,
                updated: false
            };
        }

        const scopeLogin = normalizeLogin(state.scopeLogin || '');
        if (scopeLogin !== normalizeLogin(normalized.login || '')) {
            return {
                currentDialogPinnedAt: state.currentDialogPinnedAt || null,
                records: Array.isArray(state.records) ? state.records : [],
                selectedRecord: state.selectedRecord || null,
                updated: false
            };
        }

        const nextMap = new Map((Array.isArray(state.records) ? state.records : []).map((item) => [item.id, item]));
        nextMap.set(normalized.id, normalized);
        return {
            currentDialogPinnedAt: (
                normalized.id === state.currentDialogId
                && isDialogHistoryScopeOwned(normalized.login, state.currentUserLogin)
            )
                ? (normalized.pinnedAt || null)
                : (state.currentDialogPinnedAt || null),
            records: sortDialogHistoryRecords(Array.from(nextMap.values())),
            selectedRecord: state.selectedId === normalized.id
                ? normalized
                : (state.selectedRecord || null),
            updated: true
        };
    }

    function removeDialogHistoryScopeRecord(state = {}, dialogId = '') {
        const normalizedId = String(dialogId || '').trim();
        if (!normalizedId) {
            return {
                records: Array.isArray(state.records) ? state.records : [],
                selectedId: state.selectedId || '',
                selectedPayload: state.selectedPayload || null,
                selectedRecord: state.selectedRecord || null,
                updated: false
            };
        }

        const records = (Array.isArray(state.records) ? state.records : []).filter((record) => record.id !== normalizedId);
        if (state.selectedId !== normalizedId) {
            return {
                records,
                selectedId: state.selectedId || '',
                selectedPayload: state.selectedPayload || null,
                selectedRecord: state.selectedRecord || null,
                updated: true
            };
        }

        return {
            records,
            selectedId: '',
            selectedPayload: null,
            selectedRecord: null,
            updated: true
        };
    }

    function resolveDialogHistoryScopeSelection(options = {}) {
        const records = Array.isArray(options.records) ? options.records : [];
        const preferredDialogId = String(options.preferredDialogId || '').trim();
        const currentLiveDialogId = String(options.currentLiveDialogId || '').trim();
        const selectedId = String(options.selectedId || '').trim();
        const selectCurrentDialog = options.selectCurrentDialog !== false;
        const shouldAutoSelectFirst = options.autoSelectFirst === true;

        if (preferredDialogId && records.some((record) => record.id === preferredDialogId)) {
            return preferredDialogId;
        }
        if (
            selectCurrentDialog
            && currentLiveDialogId
            && records.some((record) => record.id === currentLiveDialogId)
        ) {
            return currentLiveDialogId;
        }
        if (selectedId && records.some((record) => record.id === selectedId)) {
            return selectedId;
        }
        if (shouldAutoSelectFirst && records.length > 0) {
            return records[0].id;
        }
        return '';
    }

    return {
        canDeleteDialogHistoryRecord,
        canRenameDialogHistoryRecord,
        createEmptyDialogHistorySelectionState,
        isDialogHistoryScopeOwned,
        removeDialogHistoryScopeRecord,
        resolveDialogHistoryScopeSelection,
        upsertDialogHistoryScopeRecord
    };
}
