export function createDialogHistoryLoaderHelpers(deps = {}) {
    const normalizeLogin = typeof deps.normalizeLogin === 'function'
        ? deps.normalizeLogin
        : ((value = '') => String(value || '').trim().toLowerCase());
    const fetchDialogHistoryPayload = typeof deps.fetchDialogHistoryPayload === 'function'
        ? deps.fetchDialogHistoryPayload
        : (async () => null);
    const fetchDialogHistoryScopeRecords = typeof deps.fetchDialogHistoryScopeRecords === 'function'
        ? deps.fetchDialogHistoryScopeRecords
        : (async () => []);
    const buildCurrentDialogHistorySnapshot = typeof deps.buildCurrentDialogHistorySnapshot === 'function'
        ? deps.buildCurrentDialogHistorySnapshot
        : (() => null);
    const clearDialogHistorySelectionState = typeof deps.clearDialogHistorySelectionState === 'function'
        ? deps.clearDialogHistorySelectionState
        : (() => {});
    const isDialogHistoryScopeOwned = typeof deps.isDialogHistoryScopeOwned === 'function'
        ? deps.isDialogHistoryScopeOwned
        : (() => false);
    const isAdmin = typeof deps.isAdmin === 'function'
        ? deps.isAdmin
        : (() => false);
    const isSettingsModalOpen = typeof deps.isSettingsModalOpen === 'function'
        ? deps.isSettingsModalOpen
        : (() => false);
    const renderDialogHistoryList = typeof deps.renderDialogHistoryList === 'function'
        ? deps.renderDialogHistoryList
        : (() => {});
    const renderDialogHistoryScopeMeta = typeof deps.renderDialogHistoryScopeMeta === 'function'
        ? deps.renderDialogHistoryScopeMeta
        : (() => {});
    const renderDialogHistoryViewer = typeof deps.renderDialogHistoryViewer === 'function'
        ? deps.renderDialogHistoryViewer
        : (() => {});
    const resolveDialogHistoryScopeSelection = typeof deps.resolveDialogHistoryScopeSelection === 'function'
        ? deps.resolveDialogHistoryScopeSelection
        : (() => '');
    const revealDialogHistoryAccordion = typeof deps.revealDialogHistoryAccordion === 'function'
        ? deps.revealDialogHistoryAccordion
        : (() => {});
    const setState = typeof deps.setState === 'function'
        ? deps.setState
        : (() => {});
    const getState = typeof deps.getState === 'function'
        ? deps.getState
        : (() => ({}));
    const showSettingsModal = typeof deps.showSettingsModal === 'function'
        ? deps.showSettingsModal
        : (() => {});
    const sortDialogHistoryRecords = typeof deps.sortDialogHistoryRecords === 'function'
        ? deps.sortDialogHistoryRecords
        : ((records = []) => Array.isArray(records) ? [...records] : []);
    const upsertDialogHistoryScopeRecord = typeof deps.upsertDialogHistoryScopeRecord === 'function'
        ? deps.upsertDialogHistoryScopeRecord
        : (() => {});
    const defaultPageSize = Math.max(1, Number(deps.defaultPageSize || 20) || 20);

    async function loadDialogHistorySelection(dialogId = '') {
        const normalizedDialogId = String(dialogId || '').trim();
        setState({
            dialogHistoryMenuOpenId: ''
        });
        if (!normalizedDialogId) {
            clearDialogHistorySelectionState();
            renderDialogHistoryList();
            renderDialogHistoryViewer();
            return;
        }

        const initialState = getState();
        setState({
            dialogHistorySelectedId: normalizedDialogId,
            dialogHistorySelectedPayload: null,
            dialogHistorySelectedRecord: (Array.isArray(initialState.dialogHistoryScopeRecords) ? initialState.dialogHistoryScopeRecords : [])
                .find((record) => record.id === normalizedDialogId) || null,
            dialogHistoryViewerLoading: true
        });
        renderDialogHistoryList();
        renderDialogHistoryViewer();

        try {
            const stateBeforeFetch = getState();
            const normalizedScopeLogin = normalizeLogin(stateBeforeFetch.dialogHistoryScopeLogin || '');
            let payload = null;
            if (isDialogHistoryScopeOwned(normalizedScopeLogin) && normalizedDialogId === stateBeforeFetch.currentDialogHistoryId) {
                const liveSnapshot = buildCurrentDialogHistorySnapshot();
                if (liveSnapshot?.messagesPayload) {
                    payload = liveSnapshot.messagesPayload;
                    setState({
                        dialogHistorySelectedRecord: liveSnapshot.indexRecord
                    });
                    upsertDialogHistoryScopeRecord(liveSnapshot.indexRecord);
                }
            }
            if (!payload) {
                payload = await fetchDialogHistoryPayload(normalizedScopeLogin, normalizedDialogId);
            }
            const stateAfterFetch = getState();
            if (stateAfterFetch.dialogHistorySelectedId !== normalizedDialogId) return;
            const nextSelectedRecord = (Array.isArray(stateAfterFetch.dialogHistoryScopeRecords) ? stateAfterFetch.dialogHistoryScopeRecords : [])
                .find((record) => record.id === normalizedDialogId) || stateAfterFetch.dialogHistorySelectedRecord || null;
            const nextPatch = {
                dialogHistorySelectedPayload: payload,
                dialogHistorySelectedRecord: nextSelectedRecord
            };
            if (normalizedDialogId === stateAfterFetch.currentDialogHistoryId && isDialogHistoryScopeOwned(normalizedScopeLogin)) {
                nextPatch.currentDialogHistoryPinnedAt = nextSelectedRecord?.pinnedAt || null;
            }
            setState(nextPatch);
        } finally {
            const finalState = getState();
            if (finalState.dialogHistorySelectedId === normalizedDialogId) {
                setState({
                    dialogHistoryViewerLoading: false
                });
                renderDialogHistoryViewer();
                renderDialogHistoryList();
            }
        }
    }

    async function loadDialogHistoryScope(login = '', options = {}) {
        const state = getState();
        const normalizedLogin = normalizeLogin(login || state.currentUserLogin || '');
        if (!normalizedLogin) {
            setState({
                dialogHistoryScopeLogin: '',
                dialogHistoryScopeRecords: []
            });
            clearDialogHistorySelectionState();
            renderDialogHistoryScopeMeta();
            renderDialogHistoryList();
            renderDialogHistoryViewer();
            return;
        }

        const nextPatch = {
            dialogHistoryScopeLogin: normalizedLogin
        };
        if (options.resetVisibleCount !== false) {
            nextPatch.dialogHistoryVisibleCount = defaultPageSize;
        }
        setState(nextPatch);

        const records = await fetchDialogHistoryScopeRecords(normalizedLogin);
        setState({
            dialogHistoryScopeRecords: sortDialogHistoryRecords(records)
        });

        if (isDialogHistoryScopeOwned(normalizedLogin)) {
            const liveSnapshot = buildCurrentDialogHistorySnapshot();
            if (liveSnapshot?.indexRecord) {
                upsertDialogHistoryScopeRecord(liveSnapshot.indexRecord);
            }
        }

        renderDialogHistoryScopeMeta();
        renderDialogHistoryList();

        const nextState = getState();
        const nextSelectedId = resolveDialogHistoryScopeSelection({
            autoSelectFirst: options.autoSelectFirst === true,
            currentLiveDialogId: isDialogHistoryScopeOwned(normalizedLogin) ? nextState.currentDialogHistoryId : '',
            preferredDialogId: options.preferredDialogId || '',
            records: nextState.dialogHistoryScopeRecords,
            selectCurrentDialog: options.selectCurrentDialog !== false,
            selectedId: nextState.dialogHistorySelectedId
        });

        if (!nextSelectedId) {
            clearDialogHistorySelectionState();
            renderDialogHistoryViewer();
            return;
        }

        await loadDialogHistorySelection(nextSelectedId);
    }

    async function openDialogHistoryScope(login = '', options = {}) {
        const state = getState();
        const normalizedLogin = normalizeLogin(login || state.currentUserLogin || '');
        if (!normalizedLogin) {
            throw new Error('Не удалось определить пользователя для истории');
        }
        if (!isDialogHistoryScopeOwned(normalizedLogin) && !isAdmin()) {
            throw new Error('Недостаточно прав для просмотра чужой истории');
        }
        if (options.openSettingsModal && !isSettingsModalOpen()) {
            showSettingsModal({
                historyLogin: normalizedLogin,
                historyOpenAccordion: options.openAccordion,
                historySelectCurrentDialog: options.selectCurrentDialog !== false,
                historyAutoSelectFirst: options.autoSelectFirst !== false,
                historyPreferredDialogId: options.preferredDialogId || '',
                historyResetVisibleCount: options.resetVisibleCount !== false
            });
            return;
        }
        if (options.openAccordion) {
            revealDialogHistoryAccordion({
                behavior: options.scrollBehavior || 'smooth'
            });
        }
        await loadDialogHistoryScope(normalizedLogin, {
            autoSelectFirst: options.autoSelectFirst !== false,
            preferredDialogId: options.preferredDialogId || '',
            resetVisibleCount: options.resetVisibleCount !== false,
            selectCurrentDialog: options.selectCurrentDialog !== false
        });
    }

    return {
        loadDialogHistoryScope,
        loadDialogHistorySelection,
        openDialogHistoryScope
    };
}
