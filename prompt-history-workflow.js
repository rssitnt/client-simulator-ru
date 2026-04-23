export function createPromptHistoryWorkflowHelpers(deps = {}) {
    const buildPromptHistoryEntryDiffHtml = typeof deps.buildPromptHistoryEntryDiffHtml === 'function'
        ? deps.buildPromptHistoryEntryDiffHtml
        : (() => '');
    const checkpointPromptHistory = typeof deps.checkpointPromptHistory === 'function'
        ? deps.checkpointPromptHistory
        : (() => false);
    const createElement = typeof deps.createElement === 'function'
        ? deps.createElement
        : ((tagName = 'div') => document.createElement(tagName));
    const elements = deps.elements && typeof deps.elements === 'object'
        ? deps.elements
        : {};
    const escapeHtml = typeof deps.escapeHtml === 'function'
        ? deps.escapeHtml
        : ((value = '') => String(value || ''));
    const formatHistoryTime = typeof deps.formatHistoryTime === 'function'
        ? deps.formatHistoryTime
        : ((value = 0) => String(value || ''));
    const getActiveRole = typeof deps.getActiveRole === 'function'
        ? deps.getActiveRole
        : (() => '');
    const getActiveVariation = typeof deps.getActiveVariation === 'function'
        ? deps.getActiveVariation
        : (() => null);
    const getPromptHistoryEntries = typeof deps.getPromptHistoryEntries === 'function'
        ? deps.getPromptHistoryEntries
        : (() => []);
    const getPromptHistoryKindLabel = typeof deps.getPromptHistoryKindLabel === 'function'
        ? deps.getPromptHistoryKindLabel
        : ((kind = 'edit') => String(kind || 'edit'));
    const getPromptHistoryVariation = typeof deps.getPromptHistoryVariation === 'function'
        ? deps.getPromptHistoryVariation
        : (() => null);
    const getRoleLabel = typeof deps.getRoleLabel === 'function'
        ? deps.getRoleLabel
        : ((role = '') => String(role || ''));
    const getState = typeof deps.getState === 'function'
        ? deps.getState
        : (() => ({}));
    const hideTooltip = typeof deps.hideTooltip === 'function'
        ? deps.hideTooltip
        : (() => {});
    const historyLimit = Number.isFinite(deps.historyLimit)
        ? Math.max(1, Number(deps.historyLimit))
        : 50;
    const isAdmin = typeof deps.isAdmin === 'function'
        ? deps.isAdmin
        : (() => false);
    const renderPromptCompareModalContent = typeof deps.renderPromptCompareModalContent === 'function'
        ? deps.renderPromptCompareModalContent
        : (() => false);
    const renderVariations = typeof deps.renderVariations === 'function'
        ? deps.renderVariations
        : (() => {});
    const savePromptsToFirebaseNow = typeof deps.savePromptsToFirebaseNow === 'function'
        ? deps.savePromptsToFirebaseNow
        : (() => false);
    const updateEditorContent = typeof deps.updateEditorContent === 'function'
        ? deps.updateEditorContent
        : (() => {});

    function showPromptHistoryItem(entry = {}, previousContent = '', role = getActiveRole(), variationId = '') {
        const promptHistoryItemModal = elements.promptHistoryItemModal;
        const promptHistoryItemTitle = elements.promptHistoryItemTitle;
        const promptHistoryItemMeta = elements.promptHistoryItemMeta;
        const promptHistoryItemDiffView = elements.promptHistoryItemDiffView;
        if (!promptHistoryItemModal || !promptHistoryItemTitle || !promptHistoryItemMeta || !promptHistoryItemDiffView) {
            return false;
        }

        const safeRole = entry.role || role;
        const safeVariationId = entry.variationId || variationId;
        const normalizedEntry = {
            ...entry,
            id: entry.id,
            role: safeRole,
            variationId: safeVariationId,
            kind: entry.kind || 'edit',
            ts: entry.ts || Date.now(),
            variationName: entry.variationName || 'Без названия',
            note: entry.note || ''
        };

        const title = `${getRoleLabel(normalizedEntry.role)} · ${normalizedEntry.variationName || 'Без названия'}`;
        const time = formatHistoryTime(normalizedEntry.ts);
        const kindLabel = getPromptHistoryKindLabel(normalizedEntry.kind);
        const noteLabel = normalizedEntry.note
            ? `<br><strong>Примечание:</strong> ${escapeHtml(normalizedEntry.note)}`
            : '';

        promptHistoryItemTitle.textContent = `Версия: ${title}`;
        promptHistoryItemMeta.innerHTML = `<strong>${kindLabel}</strong> · ${escapeHtml(time)}${noteLabel}`;
        promptHistoryItemDiffView.innerHTML = buildPromptHistoryEntryDiffHtml(previousContent, String(entry?.content || ''));
        promptHistoryItemModal.classList?.add('active');
        return true;
    }

    function hidePromptHistoryItemModal() {
        const promptHistoryItemModal = elements.promptHistoryItemModal;
        if (!promptHistoryItemModal) return false;
        promptHistoryItemModal.classList?.remove('active');
        return true;
    }

    function renderPromptHistory() {
        const promptHistoryList = elements.promptHistoryList;
        const promptHistoryTitle = elements.promptHistoryTitle;
        if (!promptHistoryList || !promptHistoryTitle) return false;

        if (!isAdmin()) {
            promptHistoryList.innerHTML = '';
            hidePromptHistoryItemModal();
            return false;
        }

        const role = getActiveRole();
        const activeVariation = getActiveVariation(role);
        if (!activeVariation) {
            promptHistoryTitle.textContent = 'История промпта';
            promptHistoryList.innerHTML = '<div class="changes-empty">Выберите промпт.</div>';
            return true;
        }

        const historyVariation = getPromptHistoryVariation(role, activeVariation);
        if (!historyVariation) {
            promptHistoryTitle.textContent = `История: ${getRoleLabel(role)} · ${activeVariation.name || 'Без названия'}`;
            promptHistoryList.innerHTML = '<div class="changes-empty">У этого draft пока нет public-истории.</div>';
            return true;
        }

        const isDraftView = !!activeVariation.isLocal;
        promptHistoryTitle.textContent = isDraftView
            ? `Журнал public: ${getRoleLabel(role)} · ${historyVariation.name || 'Без названия'}`
            : `История: ${getRoleLabel(role)} · ${historyVariation.name || 'Без названия'}`;

        const items = getPromptHistoryEntries(role, historyVariation.id).slice(0, historyLimit);
        promptHistoryList.innerHTML = '';
        hidePromptHistoryItemModal();
        if (!items.length) {
            promptHistoryList.innerHTML = '<div class="changes-empty">Пока нет изменений у этого промпта.</div>';
            return true;
        }

        items.forEach((entry, index) => {
            const item = createElement('div');
            item.className = 'change-item';
            item.dataset.entryId = entry.id;
            const title = `${getRoleLabel(entry.role)} · ${entry.variationName || 'Без названия'}`;
            const time = formatHistoryTime(entry.ts);
            const previousEntry = items[index + 1] || null;
            const previousContent = previousEntry ? String(previousEntry.content || '') : '';

            const changeMeta = createElement('div');
            changeMeta.className = 'change-meta';

            const changeTitle = createElement('div');
            changeTitle.className = 'change-title';
            changeTitle.textContent = title;
            changeTitle.title = title;

            const changeTime = createElement('div');
            changeTime.className = 'change-time';
            changeTime.textContent = `${getPromptHistoryKindLabel(entry.kind)} · ${time}`;

            const changeNote = createElement('div');
            changeNote.className = 'change-note';
            changeNote.textContent = entry.note || '';
            changeNote.hidden = !entry.note;

            const restoreButton = createElement('button');
            restoreButton.className = 'btn-restore';
            restoreButton.dataset.id = entry.id;
            restoreButton.textContent = 'Восстановить';

            changeMeta.append(changeTitle, changeTime, changeNote);
            item.append(changeMeta, restoreButton);
            restoreButton.addEventListener('click', (event) => {
                event.stopPropagation();
                restorePromptVersion(entry.id, role, historyVariation.id, {
                    keepCurrentSelection: !!activeVariation.isLocal
                });
            });
            item.addEventListener('click', () => {
                showPromptHistoryItem(entry, previousContent, role, historyVariation.id);
            });
            promptHistoryList.appendChild(item);
        });

        return true;
    }

    function restorePromptVersion(entryId, role = getActiveRole(), variationId = getActiveVariation(role)?.id, options = {}) {
        if (!isAdmin()) return false;
        const state = getState();
        const promptHistory = Array.isArray(state.promptHistory) ? state.promptHistory : [];
        const entry = promptHistory.find((item) =>
            item.id === entryId &&
            (!role || item.role === role) &&
            (!variationId || item.variationId === variationId)
        );
        if (!entry) return false;

        role = entry.role;
        const promptsData = state.promptsData && typeof state.promptsData === 'object'
            ? state.promptsData
            : {};
        const roleState = promptsData[role] && typeof promptsData[role] === 'object'
            ? promptsData[role]
            : (promptsData[role] = { activeId: null, variations: [] });
        const variations = Array.isArray(roleState.variations)
            ? roleState.variations
            : (roleState.variations = []);
        const previousActiveId = roleState.activeId || null;

        let targetVar = variations.find((variation) => variation.id === entry.variationId);
        if (!targetVar) {
            targetVar = {
                id: entry.variationId,
                name: entry.variationName || 'Восстановленный',
                content: entry.content
            };
            variations.push(targetVar);
        } else {
            targetVar.content = entry.content;
        }

        const keepCurrentSelection = !!options.keepCurrentSelection &&
            !!previousActiveId &&
            variations.some((variation) => variation.id === previousActiveId);
        roleState.activeId = keepCurrentSelection ? previousActiveId : targetVar.id;

        renderVariations();
        updateEditorContent(role);
        checkpointPromptHistory(role, targetVar.id, {
            kind: 'restore',
            note: `Из версии ${formatHistoryTime(entry.ts)}`
        });
        savePromptsToFirebaseNow({ roles: [role] });

        const promptHistoryModal = elements.promptHistoryModal;
        const promptCompareModal = elements.promptCompareModal;
        if (promptHistoryModal?.classList?.contains('active')) {
            renderPromptHistory();
        }
        if (promptCompareModal?.classList?.contains('active')) {
            renderPromptCompareModalContent(role);
        }

        return true;
    }

    function showPromptHistoryModal() {
        hideTooltip(true);
        const promptHistoryModal = elements.promptHistoryModal;
        if (!promptHistoryModal) return false;
        renderPromptHistory();
        hidePromptHistoryItemModal();
        promptHistoryModal.classList?.add('active');
        return true;
    }

    function hidePromptHistoryModal() {
        const promptHistoryModal = elements.promptHistoryModal;
        if (!promptHistoryModal) return false;
        promptHistoryModal.classList?.remove('active');
        return true;
    }

    return {
        hidePromptHistoryItemModal,
        hidePromptHistoryModal,
        renderPromptHistory,
        restorePromptVersion,
        showPromptHistoryItem,
        showPromptHistoryModal
    };
}
