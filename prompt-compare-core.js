export function createPromptCompareHelpers(deps = {}) {
    const promptRoles = Array.isArray(deps.promptRoles)
        ? deps.promptRoles.filter((role) => typeof role === 'string' && role.trim())
        : [];
    const diffWordsWithSpace = typeof deps.diffWordsWithSpace === 'function'
        ? deps.diffWordsWithSpace
        : null;
    const escapeHtml = typeof deps.escapeHtml === 'function'
        ? deps.escapeHtml
        : ((value = '') => String(value || ''));
    const findBasePublicVariationForLocal = typeof deps.findBasePublicVariationForLocal === 'function'
        ? deps.findBasePublicVariationForLocal
        : (() => null);
    const findLocalOverrideForPublicVariation = typeof deps.findLocalOverrideForPublicVariation === 'function'
        ? deps.findLocalOverrideForPublicVariation
        : (() => null);
    const getActiveVariation = typeof deps.getActiveVariation === 'function'
        ? deps.getActiveVariation
        : (() => null);
    const getPromptHistoryEntries = typeof deps.getPromptHistoryEntries === 'function'
        ? deps.getPromptHistoryEntries
        : (() => []);

    function isPromptRole(role = '') {
        return promptRoles.includes(role);
    }

    function getPromptCompareContext(role = '') {
        if (!isPromptRole(role)) return null;
        const activeVariation = getActiveVariation(role);
        if (!activeVariation) return null;

        if (activeVariation.isLocal) {
            const publicVariation = findBasePublicVariationForLocal(role, activeVariation);
            if (!publicVariation) return null;
            return {
                role,
                publicVariation,
                draftVariation: activeVariation,
                activeVariation
            };
        }

        const draftVariation = findLocalOverrideForPublicVariation(role, activeVariation);
        if (!draftVariation) return null;

        return {
            role,
            publicVariation: activeVariation,
            draftVariation,
            activeVariation
        };
    }

    function getPromptHistoryVariation(role = '', activeVariation = getActiveVariation(role)) {
        if (!isPromptRole(role) || !activeVariation) return null;
        if (activeVariation.isLocal) {
            return findBasePublicVariationForLocal(role, activeVariation);
        }
        return activeVariation;
    }

    function getPromptRollbackEntry(role = '', historyVariation = getPromptHistoryVariation(role)) {
        if (!historyVariation || historyVariation.isLocal) return null;
        const currentContent = String(historyVariation.content || '');
        return getPromptHistoryEntries(role, historyVariation.id)
            .find((entry) => String(entry?.content || '') !== currentContent) || null;
    }

    function buildPromptCompareDiffHtml(publicContent = '', draftContent = '') {
        const safePublicContent = String(publicContent || '');
        const safeDraftContent = String(draftContent || '');
        if (!diffWordsWithSpace) {
            const fallbackHtml = escapeHtml(safeDraftContent).replace(/\n/g, '<br>');
            return `<div class="prompt-compare-richdiff">${fallbackHtml}</div>`;
        }

        const parts = diffWordsWithSpace(safePublicContent, safeDraftContent);
        const html = parts.map((part) => {
            const safeValue = escapeHtml(part?.value || '').replace(/\n/g, '<br>');
            if (!safeValue) return '';
            if (part?.added) {
                return `<span class="diff-added-inline">${safeValue}</span>`;
            }
            if (part?.removed) {
                return `<span class="diff-removed-inline">${safeValue}</span>`;
            }
            return safeValue;
        }).join('');

        return `<div class="prompt-compare-richdiff">${html || '<span class="changes-empty">Без различий.</span>'}</div>`;
    }

    return {
        buildPromptCompareDiffHtml,
        getPromptCompareContext,
        getPromptHistoryVariation,
        getPromptRollbackEntry
    };
}
