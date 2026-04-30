export function createPromptStateHelpers(deps = {}) {
    const promptRoles = Array.isArray(deps.promptRoles)
        ? deps.promptRoles.filter((role) => typeof role === 'string' && role.trim())
        : [];
    const generateId = typeof deps.generateId === 'function'
        ? deps.generateId
        : (() => `id_${Math.random().toString(36).slice(2, 10)}`);
    const hasMeaningfulPromptSnapshot = typeof deps.hasMeaningfulPromptSnapshot === 'function'
        ? deps.hasMeaningfulPromptSnapshot
        : ((snapshot = {}) => promptRoles.some((role) => {
            const prompt = String(snapshot?.[role + '_prompt'] || '').trim();
            const variations = Array.isArray(snapshot?.[role + '_variations']) ? snapshot[role + '_variations'] : [];
            const activeId = typeof snapshot?.[role + '_activeId'] === 'string'
                ? snapshot[role + '_activeId'].trim()
                : '';
            return !!prompt || variations.length > 0 || !!activeId;
        }));
    const unescapeMarkdown = typeof deps.unescapeMarkdown === 'function'
        ? deps.unescapeMarkdown
        : ((value = '') => String(value || ''));

    function isPromptRole(role = '') {
        return promptRoles.includes(role);
    }

    function normalizePromptVariationEntry(rawVariation = {}, fallbackId = '') {
        if (!rawVariation || typeof rawVariation !== 'object') {
            return null;
        }

        const rawId = String(
            rawVariation.id || rawVariation.variationId || rawVariation.key || rawVariation.uid || ''
        ).trim();
        const fallback = String(fallbackId || '').trim();
        const variationId = rawId || fallback;
        if (!variationId) {
            return null;
        }

        return {
            id: variationId,
            name: String(rawVariation.name || 'Основной').trim() || 'Основной',
            content: String(rawVariation.content || rawVariation.prompt || rawVariation.text || ''),
            ...(normalizePromptFirstReplyCache(rawVariation.firstReplyCache)
                ? { firstReplyCache: normalizePromptFirstReplyCache(rawVariation.firstReplyCache) }
                : {}),
            isLocal: false
        };
    }

    function normalizePromptSnapshotVariations(rawVariations = []) {
        const normalized = [];
        const seenIds = new Set();
        const rawList = Array.isArray(rawVariations)
            ? rawVariations
            : rawVariations && typeof rawVariations === 'object'
                ? Object.entries(rawVariations).map(([key, value]) => {
                    if (!value || typeof value !== 'object') {
                        return null;
                    }
                    return { ...value, id: value?.id || key };
                })
                : [];

        rawList.forEach((rawVariation, index) => {
            const fallbackId = typeof index === 'number' ? `legacy-${index + 1}` : '';
            const normalizedVariation = normalizePromptVariationEntry(rawVariation, fallbackId);
            if (!normalizedVariation) {
                return;
            }

            let variationId = normalizedVariation.id;
            while (seenIds.has(variationId)) {
                variationId = generateId();
            }
            seenIds.add(variationId);
            normalizedVariation.id = variationId;
            normalized.push(normalizedVariation);
        });

        return normalized;
    }

    function normalizePromptSnapshotForCache(rawSnapshot = {}) {
        const source = rawSnapshot && typeof rawSnapshot === 'object' ? rawSnapshot : {};
        const normalized = {};

        promptRoles.forEach((role) => {
            const legacyPrompt = String(source[role + '_prompt'] || '').trim();
            const variations = normalizePromptSnapshotVariations(source[role + '_variations']);

            if (legacyPrompt) {
                normalized[role + '_prompt'] = legacyPrompt;
            }
            if (variations.length) {
                normalized[role + '_variations'] = variations;
            }
            const activeId = typeof source[role + '_activeId'] === 'string'
                ? String(source[role + '_activeId']).trim()
                : '';
            if (activeId) {
                normalized[role + '_activeId'] = activeId;
            }
        });

        const clientFirstReplyCache = normalizePromptFirstReplyCache(source.client_firstReplyCache);
        if (clientFirstReplyCache) {
            normalized.client_firstReplyCache = clientFirstReplyCache;
        }

        return normalized;
    }

    function normalizePromptFirstReplyCache(rawCache = null) {
        if (!rawCache || typeof rawCache !== 'object') return null;
        const fingerprint = String(rawCache.fingerprint || rawCache.promptHash || '').trim();
        const message = String(rawCache.message || rawCache.text || '').replace(/\r\n/g, '\n').trim();
        if (!fingerprint || !message) return null;
        return {
            fingerprint,
            message: message.slice(0, 2000),
            generatedAt: String(rawCache.generatedAt || '').trim(),
            sourceVariationId: String(rawCache.sourceVariationId || '').trim(),
            role: String(rawCache.role || 'client').trim() || 'client'
        };
    }

    function buildNormalizedPromptSnapshotState(rawSnapshot = {}) {
        const normalized = normalizePromptSnapshotForCache(rawSnapshot);
        return {
            normalized,
            hash: JSON.stringify(normalized),
            hasMeaningfulContent: hasMeaningfulPromptSnapshot(normalized)
        };
    }

    function getPublicPromptRoleSnapshotFromNormalizedData(source = {}, role = '') {
        if (!isPromptRole(role)) {
            return { prompt: '', variations: [], activeId: null };
        }
        const safeSource = source && typeof source === 'object' ? source : {};
        const activeId = typeof safeSource[role + '_activeId'] === 'string'
            ? String(safeSource[role + '_activeId']).trim() || null
            : null;
        return {
            prompt: String(safeSource[role + '_prompt'] || ''),
            variations: Array.isArray(safeSource[role + '_variations']) ? safeSource[role + '_variations'] : [],
            activeId
        };
    }

    function getPromptSnapshotRoleHashes(snapshotState = null) {
        if (!snapshotState || typeof snapshotState !== 'object') {
            return {};
        }
        if (!snapshotState.roleHashes || typeof snapshotState.roleHashes !== 'object') {
            const normalizedSnapshot = snapshotState.normalized && typeof snapshotState.normalized === 'object'
                ? snapshotState.normalized
                : normalizePromptSnapshotForCache(snapshotState.rawSnapshot || {});
            snapshotState.normalized = normalizedSnapshot;
            snapshotState.roleHashes = Object.fromEntries(
                promptRoles.map((role) => [role, JSON.stringify(getPublicPromptRoleSnapshotFromNormalizedData(normalizedSnapshot, role))])
            );
        }
        return snapshotState.roleHashes;
    }

    function getPromptSnapshotRoleHash(snapshotState = null, role = '') {
        if (!isPromptRole(role)) {
            return JSON.stringify({ prompt: '', variations: [], activeId: null });
        }
        const roleHashes = getPromptSnapshotRoleHashes(snapshotState);
        return typeof roleHashes[role] === 'string'
            ? roleHashes[role]
            : JSON.stringify(getPublicPromptRoleSnapshotFromNormalizedData(snapshotState?.normalized || {}, role));
    }

    function normalizePromptOverrideVariation(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const id = String(raw.id || '').trim();
        if (!id) return null;
        const baseVariationId = String(raw.baseVariationId || '').trim();
        return {
            id,
            name: String(raw.name || 'Локальный').trim() || 'Локальный',
            content: unescapeMarkdown(raw.content || ''),
            isLocal: true,
            baseVariationId: baseVariationId || null
        };
    }

    function normalizePromptOverridesStore(rawStore = {}) {
        const source = rawStore && typeof rawStore === 'object' ? rawStore : {};
        const normalized = {};

        promptRoles.forEach((role) => {
            const rawVariations = Array.isArray(source[role + '_variations'])
                ? source[role + '_variations']
                : [];
            const seenIds = new Set();
            const variations = rawVariations
                .map((item) => normalizePromptOverrideVariation(item))
                .filter((item) => {
                    if (!item || seenIds.has(item.id)) return false;
                    seenIds.add(item.id);
                    return true;
                });
            const requestedActiveId = typeof source[role + '_activeId'] === 'string'
                ? String(source[role + '_activeId']).trim()
                : '';

            normalized[role + '_variations'] = variations;
            normalized[role + '_activeId'] = variations.some((item) => item.id === requestedActiveId)
                ? requestedActiveId
                : null;
        });

        return normalized;
    }

    function promptOverridesStoreHasData(store = {}) {
        const normalized = normalizePromptOverridesStore(store);
        return promptRoles.some((role) => {
            const variations = normalized[role + '_variations'] || [];
            const activeId = normalized[role + '_activeId'] || null;
            return variations.length > 0 || !!activeId;
        });
    }

    function buildNormalizedPromptOverridesStoreState(rawStore = {}) {
        const normalized = normalizePromptOverridesStore(rawStore);
        return {
            normalized,
            hash: JSON.stringify(normalized),
            hasData: promptOverridesStoreHasData(normalized)
        };
    }

    function getPromptOverridesRoleSnapshotFromNormalizedStore(store = {}, role = '') {
        if (!isPromptRole(role)) {
            return { variations: [], activeId: null };
        }
        const normalizedStore = store && typeof store === 'object' ? store : {};
        return {
            variations: Array.isArray(normalizedStore[role + '_variations']) ? normalizedStore[role + '_variations'] : [],
            activeId: normalizedStore[role + '_activeId'] || null
        };
    }

    function getPromptOverridesRoleDataFromStore(store = {}, role = '') {
        const normalized = normalizePromptOverridesStore(store);
        return {
            variations: Array.isArray(normalized[role + '_variations']) ? normalized[role + '_variations'] : [],
            activeId: typeof normalized[role + '_activeId'] === 'string' ? normalized[role + '_activeId'] : null
        };
    }

    function promptOverridesRoleDataHasData(roleData = null) {
        return !!(
            roleData
            && ((Array.isArray(roleData.variations) && roleData.variations.length > 0) || roleData.activeId)
        );
    }

    function buildPromptOverridesRoleDataMap(store = {}) {
        const normalizedStore = store && typeof store === 'object' ? store : {};
        return Object.fromEntries(
            promptRoles.map((role) => [role, getPromptOverridesRoleSnapshotFromNormalizedStore(normalizedStore, role)])
        );
    }

    function getPromptOverridesStoreRoleHashes(storeState = null) {
        if (!storeState || typeof storeState !== 'object') {
            return {};
        }
        if (!storeState.roleHashes || typeof storeState.roleHashes !== 'object') {
            const normalizedStore = storeState.normalized && typeof storeState.normalized === 'object'
                ? storeState.normalized
                : normalizePromptOverridesStore(storeState.rawStore || {});
            storeState.normalized = normalizedStore;
            storeState.roleHashes = Object.fromEntries(
                promptRoles.map((role) => [role, JSON.stringify(getPromptOverridesRoleSnapshotFromNormalizedStore(normalizedStore, role))])
            );
        }
        return storeState.roleHashes;
    }

    function getPromptOverridesStoreRoleHash(storeState = null, role = '') {
        if (!isPromptRole(role)) {
            return JSON.stringify({ variations: [], activeId: null });
        }
        const roleHashes = getPromptOverridesStoreRoleHashes(storeState);
        return typeof roleHashes[role] === 'string'
            ? roleHashes[role]
            : JSON.stringify(getPromptOverridesRoleSnapshotFromNormalizedStore(storeState?.normalized || {}, role));
    }

    function getPromptOverridesRoleSnapshot(store, role) {
        return getPromptOverridesRoleSnapshotFromNormalizedStore(normalizePromptOverridesStore(store || {}), role);
    }

    function mergeLegacyPromptOverridesStores(entries = []) {
        const merged = {};

        promptRoles.forEach((role) => {
            const seenIds = new Set();
            const mergedVariations = [];
            let mergedActiveId = null;

            entries.forEach((entry) => {
                const roleData = entry?.roleDataMap?.[role] || { variations: [], activeId: null };
                if (!mergedActiveId && typeof roleData.activeId === 'string' && roleData.activeId.trim()) {
                    mergedActiveId = roleData.activeId.trim();
                }
                (roleData.variations || []).forEach((variation) => {
                    if (!variation || typeof variation.id !== 'string' || seenIds.has(variation.id)) return;
                    seenIds.add(variation.id);
                    mergedVariations.push(variation);
                });
            });

            merged[role + '_variations'] = mergedVariations;
            merged[role + '_activeId'] = mergedVariations.some((variation) => variation.id === mergedActiveId)
                ? mergedActiveId
                : null;
        });

        return normalizePromptOverridesStore(merged);
    }

    return {
        buildNormalizedPromptOverridesStoreState,
        buildNormalizedPromptSnapshotState,
        buildPromptOverridesRoleDataMap,
        getPromptOverridesRoleDataFromStore,
        getPromptOverridesRoleSnapshot,
        getPromptOverridesRoleSnapshotFromNormalizedStore,
        getPromptOverridesStoreRoleHash,
        getPromptOverridesStoreRoleHashes,
        getPromptSnapshotRoleHash,
        getPromptSnapshotRoleHashes,
        getPublicPromptRoleSnapshotFromNormalizedData,
        mergeLegacyPromptOverridesStores,
        normalizePromptOverrideVariation,
        normalizePromptOverridesStore,
        normalizePromptSnapshotForCache,
        normalizePromptSnapshotVariations,
        normalizePromptVariationEntry,
        promptOverridesRoleDataHasData,
        promptOverridesStoreHasData
    };
}
