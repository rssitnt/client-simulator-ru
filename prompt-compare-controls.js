export function createPromptCompareControlHelpers(deps = {}) {
    const elements = deps.elements && typeof deps.elements === 'object'
        ? deps.elements
        : {};
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
    const isAdmin = typeof deps.isAdmin === 'function'
        ? deps.isAdmin
        : (() => false);
    const setCustomTooltip = typeof deps.setCustomTooltip === 'function'
        ? deps.setCustomTooltip
        : (() => {});

    function updatePromptHistoryButton() {
        const promptHistoryBtn = elements.promptHistoryBtn;
        if (!promptHistoryBtn) return false;

        if (!isAdmin()) {
            promptHistoryBtn.style.display = 'none';
            return false;
        }

        const activeVariation = getActiveVariation();
        promptHistoryBtn.style.display = activeVariation ? '' : 'none';
        return !!activeVariation;
    }

    function updatePromptWorkflowButtons(role = '') {
        const promptCompareBtn = elements.promptCompareBtn;
        const isAdminUser = isAdmin();
        const compareContext = isAdminUser ? getPromptCompareContext(role) : null;

        if (isAdminUser) {
            const historyVariation = getPromptHistoryVariation(role);
            getPromptRollbackEntry(role, historyVariation);
        }

        if (!promptCompareBtn) {
            return !!compareContext;
        }

        promptCompareBtn.style.display = compareContext ? '' : 'none';
        if (compareContext) {
            const compareLabel = compareContext.activeVariation?.isLocal
                ? 'Сравнить текущий draft с public'
                : 'Сравнить hidden draft с public';
            setCustomTooltip(promptCompareBtn, compareLabel);
        }
        return !!compareContext;
    }

    return {
        updatePromptHistoryButton,
        updatePromptWorkflowButtons
    };
}
