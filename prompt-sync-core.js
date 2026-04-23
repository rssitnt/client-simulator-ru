export function createPromptSyncHelpers(deps = {}) {
    const promptRoles = Array.isArray(deps.promptRoles)
        ? deps.promptRoles.filter((role) => typeof role === 'string' && role.trim())
        : [];
    const buildNormalizedPromptSnapshotState = typeof deps.buildNormalizedPromptSnapshotState === 'function'
        ? deps.buildNormalizedPromptSnapshotState
        : ((snapshot = {}) => ({ normalized: snapshot || {}, hash: JSON.stringify(snapshot || {}), hasMeaningfulContent: false }));
    const buildPromptOverridesPayload = typeof deps.buildPromptOverridesPayload === 'function'
        ? deps.buildPromptOverridesPayload
        : (() => ({}));
    const buildPromptsSyncPayload = typeof deps.buildPromptsSyncPayload === 'function'
        ? deps.buildPromptsSyncPayload
        : (() => ({}));
    const findLocalOverrideForPublicVariation = typeof deps.findLocalOverrideForPublicVariation === 'function'
        ? deps.findLocalOverrideForPublicVariation
        : (() => null);
    const generateId = typeof deps.generateId === 'function'
        ? deps.generateId
        : (() => `id_${Math.random().toString(36).slice(2, 10)}`);
    const getPromptOverridesStoreRoleHash = typeof deps.getPromptOverridesStoreRoleHash === 'function'
        ? deps.getPromptOverridesStoreRoleHash
        : (() => JSON.stringify({ variations: [], activeId: null }));
    const getPromptSnapshotRoleHash = typeof deps.getPromptSnapshotRoleHash === 'function'
        ? deps.getPromptSnapshotRoleHash
        : (() => JSON.stringify({ prompt: '', variations: [], activeId: null }));
    const getPromptVariationDisplayName = typeof deps.getPromptVariationDisplayName === 'function'
        ? deps.getPromptVariationDisplayName
        : ((variation = null) => String(variation?.name || '').trim());
    const getState = typeof deps.getState === 'function'
        ? deps.getState
        : (() => ({}));
    const getPublicPromptRoleSnapshotFromNormalizedData = typeof deps.getPublicPromptRoleSnapshotFromNormalizedData === 'function'
        ? deps.getPublicPromptRoleSnapshotFromNormalizedData
        : (() => ({ prompt: '', variations: [], activeId: null }));
    const normalizePromptOverridesStore = typeof deps.normalizePromptOverridesStore === 'function'
        ? deps.normalizePromptOverridesStore
        : ((store = {}) => store && typeof store === 'object' ? { ...store } : {});
    const normalizePromptSnapshotVariations = typeof deps.normalizePromptSnapshotVariations === 'function'
        ? deps.normalizePromptSnapshotVariations
        : ((value = []) => Array.isArray(value) ? value : []);
    const saveLocalPromptsData = typeof deps.saveLocalPromptsData === 'function'
        ? deps.saveLocalPromptsData
        : (() => false);

    function isPromptRole(role = '') {
        return promptRoles.includes(role);
    }

    function recordDirtyPromptOverrideRoles(baseStore, nextStore) {
        const state = getState();
        const dirtyPromptOverrideRoles = state.dirtyPromptOverrideRoles;
        if (!(dirtyPromptOverrideRoles instanceof Set)) {
            return false;
        }
        const baseStoreState = state.buildNormalizedPromptOverridesStoreState
            ? state.buildNormalizedPromptOverridesStoreState(baseStore || {})
            : deps.buildNormalizedPromptOverridesStoreState(baseStore || {});
        const nextStoreState = state.buildNormalizedPromptOverridesStoreState
            ? state.buildNormalizedPromptOverridesStoreState(nextStore || {})
            : deps.buildNormalizedPromptOverridesStoreState(nextStore || {});
        promptRoles.forEach((role) => {
            const before = getPromptOverridesStoreRoleHash(baseStoreState, role);
            const after = getPromptOverridesStoreRoleHash(nextStoreState, role);
            if (before !== after) {
                dirtyPromptOverrideRoles.add(role);
            }
        });
        return true;
    }

    function getPublicPromptRoleSnapshotFromFirebaseData(source = {}, role = '') {
        if (!isPromptRole(role)) {
            return { prompt: '', variations: [], activeId: null };
        }
        const safeSource = source && typeof source === 'object' ? source : {};
        const normalizedRoleSource = {
            [role + '_prompt']: String(safeSource[role + '_prompt'] || ''),
            [role + '_variations']: normalizePromptSnapshotVariations(safeSource[role + '_variations']),
            [role + '_activeId']: typeof safeSource[role + '_activeId'] === 'string'
                ? String(safeSource[role + '_activeId']).trim() || null
                : null
        };
        return getPublicPromptRoleSnapshotFromNormalizedData(normalizedRoleSource, role);
    }

    function getCurrentPublicPromptRoleSnapshot(role = '') {
        if (!isPromptRole(role)) {
            return { prompt: '', variations: [], activeId: null };
        }
        const rolePayload = buildPromptsSyncPayload([role]);
        return getPublicPromptRoleSnapshotFromFirebaseData(rolePayload, role);
    }

    function getPublicPromptRoleSnapshotHash(source, role = '') {
        return JSON.stringify(getPublicPromptRoleSnapshotFromFirebaseData(source, role));
    }

    function rememberPromptEditBaseline(role = '') {
        if (!isPromptRole(role)) return false;
        const state = getState();
        const dirtyPublicPromptRoles = state.dirtyPublicPromptRoles;
        const promptEditRemoteBaselineHashes = state.promptEditRemoteBaselineHashes;
        if (!(dirtyPublicPromptRoles instanceof Set) || !promptEditRemoteBaselineHashes || typeof promptEditRemoteBaselineHashes !== 'object') {
            return false;
        }
        if (dirtyPublicPromptRoles.has(role) && promptEditRemoteBaselineHashes[role]) return false;
        promptEditRemoteBaselineHashes[role] = getPromptSnapshotRoleHash(state.lastPromptsFirebaseSnapshotState, role);
        return true;
    }

    function clearPromptEditBaseline(role = '') {
        if (!isPromptRole(role)) return false;
        const state = getState();
        const promptEditRemoteBaselineHashes = state.promptEditRemoteBaselineHashes;
        if (!promptEditRemoteBaselineHashes || typeof promptEditRemoteBaselineHashes !== 'object') {
            return false;
        }
        delete promptEditRemoteBaselineHashes[role];
        return true;
    }

    function setPromptSyncConflictMessage(role = '', message = '') {
        if (!isPromptRole(role)) return false;
        const state = getState();
        const promptSyncConflictMessages = state.promptSyncConflictMessages;
        if (!promptSyncConflictMessages || typeof promptSyncConflictMessages !== 'object') {
            return false;
        }
        const normalizedMessage = String(message || '').trim();
        if (normalizedMessage) {
            promptSyncConflictMessages[role] = normalizedMessage;
        } else {
            delete promptSyncConflictMessages[role];
        }
        return true;
    }

    function preservePromptConflictAsLocalDraft(role = '') {
        if (!isPromptRole(role)) return false;
        const state = getState();
        const promptsData = state.promptsData;
        const dirtyPublicPromptRoles = state.dirtyPublicPromptRoles;
        const roleState = promptsData?.[role];
        if (!roleState || !Array.isArray(roleState.variations)) return false;

        const activeVariation = roleState.variations.find((variation) => variation.id === roleState.activeId) || null;
        if (!activeVariation || activeVariation.isLocal) return false;

        let localOverride = findLocalOverrideForPublicVariation(role, activeVariation);
        if (!localOverride) {
            localOverride = {
                id: generateId(),
                baseVariationId: activeVariation.id,
                name: getPromptVariationDisplayName(activeVariation) || activeVariation.name || 'Промпт',
                content: activeVariation.content || '',
                isLocal: true
            };
            roleState.variations.push(localOverride);
        } else {
            localOverride.baseVariationId = activeVariation.id;
            localOverride.name = getPromptVariationDisplayName(activeVariation) || activeVariation.name || 'Промпт';
            localOverride.content = activeVariation.content || '';
        }

        roleState.activeId = localOverride.id;
        saveLocalPromptsData();
        if (dirtyPublicPromptRoles instanceof Set) {
            dirtyPublicPromptRoles.delete(role);
        }
        clearPromptEditBaseline(role);
        setPromptSyncConflictMessage(
            role,
            'Публичный промпт был изменён в другом окне или другим админом. Ваши правки сохранены как локальный скрытый draft; сравните и опубликуйте его вручную, если нужно.'
        );
        return true;
    }

    function resolvePromptSyncConflicts(remoteSnapshot = {}) {
        const state = getState();
        const dirtyPublicPromptRoles = state.dirtyPublicPromptRoles;
        if (!(dirtyPublicPromptRoles instanceof Set)) {
            return [];
        }
        const remoteSnapshotState = state.pendingPromptsFirebaseSnapshotState
            && state.pendingPromptsFirebaseSnapshot === remoteSnapshot
            ? state.pendingPromptsFirebaseSnapshotState
            : buildNormalizedPromptSnapshotState(remoteSnapshot);
        const conflictRoles = [];
        dirtyPublicPromptRoles.forEach((role) => {
            if (!isPromptRole(role)) return;
            const baselineHash = state.promptEditRemoteBaselineHashes?.[role];
            if (!baselineHash) return;
            const remoteHash = getPromptSnapshotRoleHash(remoteSnapshotState, role);
            if (remoteHash !== baselineHash) {
                conflictRoles.push(role);
            }
        });

        conflictRoles.forEach((role) => {
            preservePromptConflictAsLocalDraft(role);
        });

        return conflictRoles;
    }

    function buildMergedPromptsSnapshot(firebaseData = {}) {
        const state = getState();
        const dirtyPublicPromptRoles = state.dirtyPublicPromptRoles;
        const mergedSnapshot = { ...(firebaseData || {}) };
        if (!(dirtyPublicPromptRoles instanceof Set) || !dirtyPublicPromptRoles.size) {
            return mergedSnapshot;
        }

        dirtyPublicPromptRoles.forEach((role) => {
            if (!isPromptRole(role)) return;
            const rolePayload = buildPromptsSyncPayload([role]);
            mergedSnapshot[role + '_prompt'] = rolePayload[role + '_prompt'];
            mergedSnapshot[role + '_variations'] = rolePayload[role + '_variations'];
            mergedSnapshot[role + '_activeId'] = rolePayload[role + '_activeId'];
        });

        return mergedSnapshot;
    }

    function buildMergedPromptOverridesStore(remoteStore = {}) {
        const state = getState();
        const dirtyPromptOverrideRoles = state.dirtyPromptOverrideRoles;
        const mergedStore = normalizePromptOverridesStore(remoteStore || {});
        if (!(dirtyPromptOverrideRoles instanceof Set) || !dirtyPromptOverrideRoles.size) {
            return mergedStore;
        }

        const localStore = buildPromptOverridesPayload();
        dirtyPromptOverrideRoles.forEach((role) => {
            if (!isPromptRole(role)) return;
            mergedStore[role + '_variations'] = localStore[role + '_variations'] || [];
            mergedStore[role + '_activeId'] = localStore[role + '_activeId'] || null;
        });

        return normalizePromptOverridesStore(mergedStore);
    }

    return {
        buildMergedPromptOverridesStore,
        buildMergedPromptsSnapshot,
        clearPromptEditBaseline,
        getCurrentPublicPromptRoleSnapshot,
        getPublicPromptRoleSnapshotFromFirebaseData,
        getPublicPromptRoleSnapshotHash,
        preservePromptConflictAsLocalDraft,
        recordDirtyPromptOverrideRoles,
        rememberPromptEditBaseline,
        resolvePromptSyncConflicts,
        setPromptSyncConflictMessage
    };
}
