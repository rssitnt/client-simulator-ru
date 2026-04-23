export function createPromptHistoryHelpers(deps = {}) {
    const historyLimit = Number.isFinite(deps.historyLimit)
        ? Math.max(1, Number(deps.historyLimit))
        : 50;

    function getPromptHistoryKey(role, variationId) {
        return `${role}:${variationId}`;
    }

    function clonePromptHistoryEntry(entry = {}) {
        if (!entry || typeof entry !== 'object') return null;
        const id = String(entry.id || '').trim();
        if (!id) return null;
        return {
            id,
            ts: Number(entry.ts) || Date.now(),
            role: String(entry.role || ''),
            variationId: String(entry.variationId || ''),
            variationName: String(entry.variationName || ''),
            content: String(entry.content || ''),
            kind: String(entry.kind || 'edit'),
            note: String(entry.note || '')
        };
    }

    function buildPromptHistoryEntryHash(entry = null) {
        if (!entry || typeof entry !== 'object') return '';
        return [
            String(entry.id || ''),
            String(entry.ts || ''),
            String(entry.role || ''),
            String(entry.variationId || ''),
            String(entry.kind || 'edit')
        ].join('|');
    }

    function buildPromptHistorySnapshotHash(entries = []) {
        if (!Array.isArray(entries) || !entries.length) return '';
        return entries.map((entry) => buildPromptHistoryEntryHash(entry)).join('||');
    }

    function normalizePromptHistoryEntries(rawHistory = []) {
        const entries = Array.isArray(rawHistory)
            ? rawHistory
            : (rawHistory && typeof rawHistory === 'object' ? Object.values(rawHistory) : []);

        const normalized = entries
            .map((entry) => clonePromptHistoryEntry(entry))
            .filter(Boolean)
            .sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));

        const perPromptCount = new Map();
        const trimmedHistory = [];
        normalized.forEach((entry) => {
            const key = getPromptHistoryKey(entry.role, entry.variationId);
            const used = perPromptCount.get(key) || 0;
            if (used >= historyLimit) return;
            perPromptCount.set(key, used + 1);
            trimmedHistory.push(entry);
        });

        return trimmedHistory;
    }

    function getPromptHistoryEntries(history = [], role = '', variationId = '') {
        if (!role || !variationId) return [];
        const key = getPromptHistoryKey(role, variationId);
        return (Array.isArray(history) ? history : [])
            .filter((item) => getPromptHistoryKey(item?.role, item?.variationId) === key);
    }

    function getPromptHistoryKindLabel(kind = 'edit') {
        switch (String(kind || 'edit')) {
        case 'baseline':
            return 'База';
        case 'publish':
            return 'Публикация';
        case 'restore':
            return 'Откат';
        default:
            return 'Изменение';
        }
    }

    return {
        buildPromptHistoryEntryHash,
        buildPromptHistorySnapshotHash,
        clonePromptHistoryEntry,
        getPromptHistoryEntries,
        getPromptHistoryKey,
        getPromptHistoryKindLabel,
        normalizePromptHistoryEntries
    };
}
