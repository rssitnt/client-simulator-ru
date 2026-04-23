export function createDialogHistoryMutationHelpers(deps = {}) {
    const buildCurrentDialogHistorySnapshot = typeof deps.buildCurrentDialogHistorySnapshot === 'function'
        ? deps.buildCurrentDialogHistorySnapshot
        : (() => null);
    const buildSharedDialogPayload = typeof deps.buildSharedDialogPayload === 'function'
        ? deps.buildSharedDialogPayload
        : (() => null);
    const buildSharedDialogUrl = typeof deps.buildSharedDialogUrl === 'function'
        ? deps.buildSharedDialogUrl
        : (() => '');
    const canDeleteDialogHistoryRecord = typeof deps.canDeleteDialogHistoryRecord === 'function'
        ? deps.canDeleteDialogHistoryRecord
        : (() => false);
    const canDeleteSelectedDialogHistory = typeof deps.canDeleteSelectedDialogHistory === 'function'
        ? deps.canDeleteSelectedDialogHistory
        : (() => false);
    const canRenameDialogHistoryRecord = typeof deps.canRenameDialogHistoryRecord === 'function'
        ? deps.canRenameDialogHistoryRecord
        : (() => false);
    const clampDialogHistoryTitle = typeof deps.clampDialogHistoryTitle === 'function'
        ? deps.clampDialogHistoryTitle
        : ((value = '', fallback = '') => String(value || fallback || '').trim().slice(0, 140));
    const closeDialogHistoryItemMenu = typeof deps.closeDialogHistoryItemMenu === 'function'
        ? deps.closeDialogHistoryItemMenu
        : (() => {});
    const confirmDelete = typeof deps.confirmDelete === 'function'
        ? deps.confirmDelete
        : (() => true);
    const fetchDialogHistoryPayload = typeof deps.fetchDialogHistoryPayload === 'function'
        ? deps.fetchDialogHistoryPayload
        : (async () => null);
    const formatDialogHistoryFallbackTitle = typeof deps.formatDialogHistoryFallbackTitle === 'function'
        ? deps.formatDialogHistoryFallbackTitle
        : (() => '');
    const getDialogHistoryIndexPath = typeof deps.getDialogHistoryIndexPath === 'function'
        ? deps.getDialogHistoryIndexPath
        : (() => '');
    const getDialogHistoryMessagesPath = typeof deps.getDialogHistoryMessagesPath === 'function'
        ? deps.getDialogHistoryMessagesPath
        : (() => '');
    const getDialogHistoryRecordEffectiveTitle = typeof deps.getDialogHistoryRecordEffectiveTitle === 'function'
        ? deps.getDialogHistoryRecordEffectiveTitle
        : ((record = null) => String(record?.title || '').trim());
    const getState = typeof deps.getState === 'function'
        ? deps.getState
        : (() => ({}));
    const isDialogHistoryScopeOwned = typeof deps.isDialogHistoryScopeOwned === 'function'
        ? deps.isDialogHistoryScopeOwned
        : (() => false);
    const loadDialogHistorySelection = typeof deps.loadDialogHistorySelection === 'function'
        ? deps.loadDialogHistorySelection
        : (async () => {});
    const normalizeDialogHistoryIndexRecord = typeof deps.normalizeDialogHistoryIndexRecord === 'function'
        ? deps.normalizeDialogHistoryIndexRecord
        : ((raw) => raw);
    const normalizeLogin = typeof deps.normalizeLogin === 'function'
        ? deps.normalizeLogin
        : ((value = '') => String(value || '').trim().toLowerCase());
    const normalizeSharedDialogId = typeof deps.normalizeSharedDialogId === 'function'
        ? deps.normalizeSharedDialogId
        : ((value = '') => String(value || '').trim());
    const removeDialogHistoryScopeRecord = typeof deps.removeDialogHistoryScopeRecord === 'function'
        ? deps.removeDialogHistoryScopeRecord
        : (() => {});
    const renderDialogHistoryList = typeof deps.renderDialogHistoryList === 'function'
        ? deps.renderDialogHistoryList
        : (() => {});
    const renderDialogHistoryViewer = typeof deps.renderDialogHistoryViewer === 'function'
        ? deps.renderDialogHistoryViewer
        : (() => {});
    const resetCurrentDialogHistoryState = typeof deps.resetCurrentDialogHistoryState === 'function'
        ? deps.resetCurrentDialogHistoryState
        : (() => {});
    const saveCurrentDialogHistoryNow = typeof deps.saveCurrentDialogHistoryNow === 'function'
        ? deps.saveCurrentDialogHistoryNow
        : (async () => null);
    const saveSharedDialogPayload = typeof deps.saveSharedDialogPayload === 'function'
        ? deps.saveSharedDialogPayload
        : (async () => false);
    const setState = typeof deps.setState === 'function'
        ? deps.setState
        : (() => {});
    const showCopyNotification = typeof deps.showCopyNotification === 'function'
        ? deps.showCopyNotification
        : (() => {});
    const upsertDialogHistoryScopeRecord = typeof deps.upsertDialogHistoryScopeRecord === 'function'
        ? deps.upsertDialogHistoryScopeRecord
        : (() => {});
    const writeClipboard = typeof deps.writeClipboard === 'function'
        ? deps.writeClipboard
        : (async () => {});
    const writePath = typeof deps.writePath === 'function'
        ? deps.writePath
        : (async () => false);
    const shareNavigator = typeof deps.shareNavigator === 'function'
        ? deps.shareNavigator
        : (async () => false);

    async function getDialogHistoryPayloadForRecord(record = null) {
        if (!record) throw new Error('Диалог не найден');
        const state = getState();
        const normalizedLogin = normalizeLogin(record.login || state.dialogHistoryScopeLogin || '');
        if (!normalizedLogin) {
            throw new Error('Не удалось определить владельца диалога');
        }
        if (record.id === state.currentDialogHistoryId && isDialogHistoryScopeOwned(normalizedLogin)) {
            const liveSnapshot = buildCurrentDialogHistorySnapshot();
            if (liveSnapshot?.messagesPayload) {
                return liveSnapshot.messagesPayload;
            }
        }
        return fetchDialogHistoryPayload(normalizedLogin, record.id);
    }

    async function shareDialogHistoryRecord(record = null) {
        if (!record) return false;
        const payload = await getDialogHistoryPayloadForRecord(record);
        const shareId = normalizeSharedDialogId(`sh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`);
        const sharedPayload = buildSharedDialogPayload(record, payload, shareId);
        if (!sharedPayload) {
            throw new Error('В диалоге пока нет текста для отправки');
        }
        await saveSharedDialogPayload(shareId, sharedPayload);
        const shareUrl = buildSharedDialogUrl(shareId);
        if (!shareUrl) {
            throw new Error('Не удалось подготовить ссылку для отправки');
        }

        const shared = await shareNavigator({
            title: getDialogHistoryRecordEffectiveTitle(record),
            url: shareUrl
        });
        if (shared === true) {
            return true;
        }
        if (shared === false) {
            return false;
        }

        await writeClipboard(shareUrl);
        showCopyNotification('Ссылка на диалог скопирована');
        return true;
    }

    async function saveDialogHistoryRecordTitle(record = null, nextTitleRaw = '') {
        if (!record || !canRenameDialogHistoryRecord(record)) return false;
        const fallbackTitle = clampDialogHistoryTitle(record.autoTitle, formatDialogHistoryFallbackTitle(record.createdAt));
        const nextTitleValue = clampDialogHistoryTitle(nextTitleRaw);
        const shouldResetToAuto = !nextTitleValue;
        const nextTitle = shouldResetToAuto ? fallbackTitle : nextTitleValue;
        const nextTitleEdited = !shouldResetToAuto;

        const state = getState();
        if (nextTitle === record.title && !!nextTitleEdited === !!record.titleEdited) {
            if (state.dialogHistorySelectedId === record.id) {
                setState({
                    dialogHistoryTitleInputValue: record.title || fallbackTitle
                });
            }
            return true;
        }

        const nowIso = new Date().toISOString();
        if (record.id === state.currentDialogHistoryId && isDialogHistoryScopeOwned(record.login)) {
            const liveRecord = normalizeDialogHistoryIndexRecord({
                ...record,
                title: nextTitle,
                autoTitle: fallbackTitle,
                titleEdited: nextTitleEdited,
                updatedAt: nowIso
            }, record.id, record.login);
            if (!liveRecord) return false;
            setState({
                currentDialogHistoryAutoTitle: fallbackTitle,
                currentDialogHistoryTitle: nextTitle,
                currentDialogHistoryTitleEdited: nextTitleEdited,
                dialogHistorySelectedRecord: state.dialogHistorySelectedId === record.id ? liveRecord : state.dialogHistorySelectedRecord,
                dialogHistoryTitleInputValue: liveRecord.title
            });
            upsertDialogHistoryScopeRecord(liveRecord);
            await saveCurrentDialogHistoryNow({ nowIso });
            renderDialogHistoryViewer();
            return true;
        }

        const updatedRecord = normalizeDialogHistoryIndexRecord({
            ...record,
            title: nextTitle,
            autoTitle: fallbackTitle,
            titleEdited: nextTitleEdited,
            updatedAt: nowIso
        }, record.id, record.login);
        if (!updatedRecord) return false;
        const dbPath = getDialogHistoryIndexPath(record.login, record.id);
        if (!dbPath) return false;
        await writePath(dbPath, updatedRecord, 'PUT');
        if (state.dialogHistorySelectedId === record.id) {
            setState({
                dialogHistorySelectedRecord: updatedRecord,
                dialogHistoryTitleInputValue: updatedRecord.title
            });
        }
        upsertDialogHistoryScopeRecord(updatedRecord);
        renderDialogHistoryViewer();
        return true;
    }

    async function deleteDialogHistoryRecord(record = null) {
        if (!record || !canDeleteDialogHistoryRecord(record)) return false;
        const title = getDialogHistoryRecordEffectiveTitle(record);
        if (!confirmDelete(title, record)) {
            return false;
        }
        const indexPath = getDialogHistoryIndexPath(record.login, record.id);
        const messagesPath = getDialogHistoryMessagesPath(record.login, record.id);
        if (!indexPath || !messagesPath) {
            throw new Error('Не удалось определить путь удаления');
        }

        await Promise.all([
            writePath(indexPath, null, 'DELETE'),
            writePath(messagesPath, null, 'DELETE')
        ]);

        const state = getState();
        if (record.id === state.currentDialogHistoryId && isDialogHistoryScopeOwned(record.login)) {
            resetCurrentDialogHistoryState();
        }

        const removedSelectedRecord = state.dialogHistorySelectedId === record.id;
        removeDialogHistoryScopeRecord(record.id);
        closeDialogHistoryItemMenu({ render: false });
        const nextState = getState();
        if (removedSelectedRecord && !nextState.dialogHistorySelectedId && Array.isArray(nextState.dialogHistoryScopeRecords) && nextState.dialogHistoryScopeRecords.length > 0) {
            await loadDialogHistorySelection(nextState.dialogHistoryScopeRecords[0].id);
        }
        showCopyNotification('Диалог удалён');
        return true;
    }

    async function toggleSelectedDialogHistoryPinned() {
        const state = getState();
        const record = state.dialogHistorySelectedRecord;
        if (!record || !canDeleteSelectedDialogHistory()) return false;
        const nextPinnedAt = record.pinnedAt ? null : new Date().toISOString();

        if (record.id === state.currentDialogHistoryId && isDialogHistoryScopeOwned(record.login)) {
            setState({
                currentDialogHistoryPinnedAt: nextPinnedAt,
                dialogHistorySelectedRecord: {
                    ...record,
                    pinnedAt: nextPinnedAt
                }
            });
            await saveCurrentDialogHistoryNow({ nowIso: new Date().toISOString() });
            renderDialogHistoryViewer();
            renderDialogHistoryList();
            return true;
        }

        const updatedRecord = normalizeDialogHistoryIndexRecord({
            ...record,
            pinnedAt: nextPinnedAt
        }, record.id, record.login);
        if (!updatedRecord) return false;
        const dbPath = getDialogHistoryIndexPath(record.login, record.id);
        if (!dbPath) return false;
        await writePath(dbPath, updatedRecord, 'PUT');
        setState({
            dialogHistorySelectedRecord: updatedRecord
        });
        upsertDialogHistoryScopeRecord(updatedRecord);
        renderDialogHistoryViewer();
        return true;
    }

    return {
        deleteDialogHistoryRecord,
        getDialogHistoryPayloadForRecord,
        saveDialogHistoryRecordTitle,
        shareDialogHistoryRecord,
        toggleSelectedDialogHistoryPinned
    };
}
