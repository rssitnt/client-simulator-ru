export function createPromptCompareWorkflowHelpers(deps = {}) {
    const buildPromptCompareDiffHtml = typeof deps.buildPromptCompareDiffHtml === 'function'
        ? deps.buildPromptCompareDiffHtml
        : (() => '');
    const elements = deps.elements && typeof deps.elements === 'object'
        ? deps.elements
        : {};
    const escapeHtml = typeof deps.escapeHtml === 'function'
        ? deps.escapeHtml
        : ((value = '') => String(value || ''));
    const getActiveVariation = typeof deps.getActiveVariation === 'function'
        ? deps.getActiveVariation
        : (() => null);
    const getPromptCompareContext = typeof deps.getPromptCompareContext === 'function'
        ? deps.getPromptCompareContext
        : (() => null);
    const getPromptHistoryVariation = typeof deps.getPromptHistoryVariation === 'function'
        ? deps.getPromptHistoryVariation
        : (() => null);
    const getPromptRollbackEntry = typeof deps.getPromptRollbackEntry === 'function'
        ? deps.getPromptRollbackEntry
        : (() => null);
    const getPromptVariationDisplayName = typeof deps.getPromptVariationDisplayName === 'function'
        ? deps.getPromptVariationDisplayName
        : ((variation = null) => String(variation?.name || '').trim());
    const getRoleLabel = typeof deps.getRoleLabel === 'function'
        ? deps.getRoleLabel
        : ((role = '') => String(role || ''));
    const getState = typeof deps.getState === 'function'
        ? deps.getState
        : (() => ({}));
    const hideTooltip = typeof deps.hideTooltip === 'function'
        ? deps.hideTooltip
        : (() => {});
    const publishActiveLocalPrompt = typeof deps.publishActiveLocalPrompt === 'function'
        ? deps.publishActiveLocalPrompt
        : (() => false);
    const renderVariations = typeof deps.renderVariations === 'function'
        ? deps.renderVariations
        : (() => {});
    const restorePromptVersion = typeof deps.restorePromptVersion === 'function'
        ? deps.restorePromptVersion
        : (() => false);
    const setState = typeof deps.setState === 'function'
        ? deps.setState
        : (() => {});
    const showCopyNotification = typeof deps.showCopyNotification === 'function'
        ? deps.showCopyNotification
        : (() => {});
    const syncCurrentEditorNow = typeof deps.syncCurrentEditorNow === 'function'
        ? deps.syncCurrentEditorNow
        : (() => {});
    const updateEditorContent = typeof deps.updateEditorContent === 'function'
        ? deps.updateEditorContent
        : (() => {});

    function hidePromptCompareModal() {
        const promptCompareModal = elements.promptCompareModal;
        if (!promptCompareModal) return false;
        promptCompareModal.classList?.remove('active');
        setState({
            activePromptCompareContext: null
        });
        return true;
    }

    function renderPromptCompareModalContent(role = '') {
        const promptCompareTitle = elements.promptCompareTitle;
        const promptCompareSummary = elements.promptCompareSummary;
        const promptCompareDiffView = elements.promptCompareDiffView;
        const promptCompareModal = elements.promptCompareModal;
        if (!promptCompareTitle || !promptCompareSummary || !promptCompareDiffView) return false;

        const context = getPromptCompareContext(role);
        setState({
            activePromptCompareContext: context || null
        });
        if (!context) {
            if (promptCompareModal?.classList?.contains('active')) {
                hidePromptCompareModal();
            }
            return false;
        }

        const { publicVariation, draftVariation } = context;
        promptCompareTitle.textContent = `Сравнение: ${getRoleLabel(role)} · ${getPromptVariationDisplayName(publicVariation) || 'Без названия'}`;
        promptCompareSummary.innerHTML = `
        <strong>Public:</strong> ${escapeHtml(getPromptVariationDisplayName(publicVariation) || 'Без названия')}
        <br>
        <strong>Draft:</strong> ${escapeHtml(getPromptVariationDisplayName(draftVariation) || 'Без названия')}
    `;
        promptCompareDiffView.innerHTML = buildPromptCompareDiffHtml(publicVariation.content || '', draftVariation.content || '');
        return true;
    }

    function showPromptCompareModal(role = '') {
        const promptCompareModal = elements.promptCompareModal;
        hideTooltip(true);
        if (!promptCompareModal) return false;
        syncCurrentEditorNow();
        if (!getPromptCompareContext(role)) {
            showCopyNotification('У этого промпта пока нет draft для сравнения.');
            return false;
        }
        renderPromptCompareModalContent(role);
        promptCompareModal.classList?.add('active');
        return true;
    }

    function publishComparedDraft(role = '') {
        hideTooltip(true);
        const context = getPromptCompareContext(role);
        if (!context) {
            showCopyNotification('Draft для публикации не найден.');
            hidePromptCompareModal();
            return false;
        }

        syncCurrentEditorNow();
        const state = getState();
        if (state.promptsData?.[context.role]) {
            state.promptsData[context.role].activeId = context.draftVariation.id;
        }
        if (!publishActiveLocalPrompt(context.role)) {
            showCopyNotification('Не удалось опубликовать draft.');
            return false;
        }

        renderVariations();
        updateEditorContent(context.role);
        hidePromptCompareModal();
        showCopyNotification('Draft опубликован в public.');
        return true;
    }

    function rollbackPublicPrompt(role = '') {
        hideTooltip(true);
        const historyVariation = getPromptHistoryVariation(role);
        const rollbackEntry = getPromptRollbackEntry(role, historyVariation);
        if (!historyVariation || !rollbackEntry) {
            showCopyNotification('Нет предыдущей public-версии для отката.');
            return false;
        }

        syncCurrentEditorNow();
        restorePromptVersion(rollbackEntry.id, role, historyVariation.id, {
            keepCurrentSelection: !!getActiveVariation(role)?.isLocal
        });
        showCopyNotification('Public-версия откатена к прошлой ревизии.');
        return true;
    }

    return {
        hidePromptCompareModal,
        publishComparedDraft,
        renderPromptCompareModalContent,
        rollbackPublicPrompt,
        showPromptCompareModal
    };
}
