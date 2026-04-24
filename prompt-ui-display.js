export function createPromptUiDisplayHelpers(deps = {}) {
    const elements = deps.elements && typeof deps.elements === 'object'
        ? deps.elements
        : {};
    const eyeOffIcon = typeof deps.eyeOffIcon === 'string'
        ? deps.eyeOffIcon
        : '';
    const eyeOpenIcon = typeof deps.eyeOpenIcon === 'string'
        ? deps.eyeOpenIcon
        : '';
    const getActiveContent = typeof deps.getActiveContent === 'function'
        ? deps.getActiveContent
        : (() => '');
    const getActiveVariation = typeof deps.getActiveVariation === 'function'
        ? deps.getActiveVariation
        : (() => null);
    const getRoleLabel = typeof deps.getRoleLabel === 'function'
        ? deps.getRoleLabel
        : ((role = '') => String(role || ''));
    const getPromptCompareContext = typeof deps.getPromptCompareContext === 'function'
        ? deps.getPromptCompareContext
        : (() => null);
    const getPromptSyncConflictMessage = typeof deps.getPromptSyncConflictMessage === 'function'
        ? deps.getPromptSyncConflictMessage
        : (() => '');
    const isAdmin = typeof deps.isAdmin === 'function'
        ? deps.isAdmin
        : (() => false);
    const isLocalMinimalUiEnabled = typeof deps.isLocalMinimalUiEnabled === 'function'
        ? deps.isLocalMinimalUiEnabled
        : (() => false);
    const isValidRole = typeof deps.isValidRole === 'function'
        ? deps.isValidRole
        : ((role = '') => !!role);
    const managerCallPromptMaxChars = Number.isFinite(deps.managerCallPromptMaxChars)
        ? Number(deps.managerCallPromptMaxChars)
        : 0;
    const openPromptEditorPanel = typeof deps.openPromptEditorPanel === 'function'
        ? deps.openPromptEditorPanel
        : (() => {});
    const setCustomTooltip = typeof deps.setCustomTooltip === 'function'
        ? deps.setCustomTooltip
        : (() => {});

    function getPromptVariationDisplayName(variation) {
        const rawName = String(variation?.name || '').trim();
        if (!variation?.isLocal) {
            return rawName;
        }
        return rawName.replace(/\s*\(локальный\)$/i, '').trim() || rawName;
    }

    function getPromptRoleLabel(role = '') {
        if (role === 'client') return 'Клиент';
        if (role === 'manager') return 'Менеджер';
        if (role === 'manager_call') return 'Клиент звонок';
        if (role === 'rater') return 'Оценщик';
        return String(role || '');
    }

    function updatePromptVisibilityButton() {
        const promptVisibilityBtn = elements.promptVisibilityBtn;
        if (!promptVisibilityBtn) return false;

        if (!isAdmin()) {
            promptVisibilityBtn.style.display = 'none';
            return false;
        }

        const activeVariation = getActiveVariation();
        if (!activeVariation) {
            promptVisibilityBtn.style.display = 'none';
            return false;
        }

        promptVisibilityBtn.style.display = '';
        const isLocal = !!activeVariation.isLocal;
        promptVisibilityBtn.innerHTML = isLocal ? eyeOpenIcon : eyeOffIcon;
        promptVisibilityBtn.classList?.toggle('state-hidden', isLocal);
        const tooltipText = isLocal
            ? 'Показать промпт пользователям'
            : 'Скрыть промпт от пользователей';
        setCustomTooltip(promptVisibilityBtn, tooltipText);
        return isLocal;
    }

    function updatePromptLengthInfo(role = '') {
        const promptLengthInfo = elements.promptLengthInfo;
        if (!promptLengthInfo) return false;
        if (role !== 'manager_call') {
            promptLengthInfo.style.display = 'none';
            promptLengthInfo.textContent = '';
            promptLengthInfo.classList?.remove('is-over');
            return false;
        }

        promptLengthInfo.style.display = '';
        const currentLength = String(getActiveContent(role) || '').length;
        promptLengthInfo.textContent = `${currentLength.toLocaleString('ru-RU')} символов из ${managerCallPromptMaxChars.toLocaleString('ru-RU')}`;
        promptLengthInfo.classList?.toggle('is-over', currentLength > managerCallPromptMaxChars);
        return currentLength <= managerCallPromptMaxChars;
    }

    function renderPromptContextBar(role = '') {
        const promptContextRoleName = elements.promptContextRoleName;
        const promptContextVariationBadge = elements.promptContextVariationBadge;
        if (promptContextRoleName) {
            promptContextRoleName.textContent = getRoleLabel(role);
        }
        if (promptContextVariationBadge) {
            const activeVariation = getActiveVariation(role);
            const badgeText = isLocalMinimalUiEnabled()
                ? (activeVariation
                    ? getPromptVariationDisplayName(activeVariation)
                    : 'Сценарий не выбран')
                : (activeVariation
                    ? `Вариант: ${getPromptVariationDisplayName(activeVariation)}`
                    : 'Вариант не выбран');
            promptContextVariationBadge.textContent = badgeText;
        }
        return true;
    }

    function getPromptVariationsLabelState(role = '', visibleCount = 0) {
        const count = Math.max(0, Number(visibleCount) || 0);
        return {
            hidden: count <= 1,
            text: count <= 1
                ? 'Варианты промпта'
                : `Варианты ${getRoleLabel(role).toLowerCase()}`
        };
    }

    function renderPromptSyncConflictNotice(role = '') {
        const promptSyncConflictNotice = elements.promptSyncConflictNotice;
        const promptSyncConflictNoticeText = elements.promptSyncConflictNoticeText;
        const promptSyncConflictActionBtn = elements.promptSyncConflictActionBtn;
        if (!promptSyncConflictNotice) return false;

        const message = isValidRole(role)
            ? String(getPromptSyncConflictMessage(role) || '').trim()
            : '';
        promptSyncConflictNotice.hidden = !message;
        if (promptSyncConflictNoticeText) {
            promptSyncConflictNoticeText.textContent = message;
        } else {
            promptSyncConflictNotice.textContent = message;
        }

        if (message && isAdmin()) {
            openPromptEditorPanel();
        }

        if (promptSyncConflictActionBtn) {
            const compareContext = message && isAdmin() ? getPromptCompareContext(role) : null;
            const compareLabel = compareContext?.activeVariation?.isLocal
                ? 'Сравнить draft'
                : 'Сравнить hidden draft';
            promptSyncConflictActionBtn.hidden = !compareContext;
            if (compareContext) {
                promptSyncConflictActionBtn.textContent = compareLabel;
                setCustomTooltip(promptSyncConflictActionBtn, compareLabel);
            } else {
                setCustomTooltip(promptSyncConflictActionBtn, '');
            }
        }
        return !!message;
    }

    return {
        getPromptRoleLabel,
        getPromptVariationDisplayName,
        getPromptVariationsLabelState,
        renderPromptContextBar,
        renderPromptSyncConflictNotice,
        updatePromptLengthInfo,
        updatePromptVisibilityButton
    };
}
