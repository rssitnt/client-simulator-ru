export function createPromptOverridesRuntimeHelpers(deps = {}) {
    const buildMergedPromptOverridesStore = typeof deps.buildMergedPromptOverridesStore === 'function'
        ? deps.buildMergedPromptOverridesStore
        : ((store = {}) => store && typeof store === 'object' ? { ...store } : {});
    const buildMergedPromptsSnapshot = typeof deps.buildMergedPromptsSnapshot === 'function'
        ? deps.buildMergedPromptsSnapshot
        : ((snapshot = {}) => snapshot && typeof snapshot === 'object' ? { ...snapshot } : {});
    const buildNormalizedPromptOverridesStoreState = typeof deps.buildNormalizedPromptOverridesStoreState === 'function'
        ? deps.buildNormalizedPromptOverridesStoreState
        : ((store = {}) => ({ normalized: store || {}, hash: JSON.stringify(store || {}), hasData: false }));
    const buildPromptOverridesPayload = typeof deps.buildPromptOverridesPayload === 'function'
        ? deps.buildPromptOverridesPayload
        : (() => ({}));
    const canSyncPromptOverrides = typeof deps.canSyncPromptOverrides === 'function'
        ? deps.canSyncPromptOverrides
        : (() => false);
    const getPromptOverridesDbPath = typeof deps.getPromptOverridesDbPath === 'function'
        ? deps.getPromptOverridesDbPath
        : (() => '');
    const getState = typeof deps.getState === 'function'
        ? deps.getState
        : (() => ({}));
    const initPromptsData = typeof deps.initPromptsData === 'function'
        ? deps.initPromptsData
        : (() => false);
    const normalizeLogin = typeof deps.normalizeLogin === 'function'
        ? deps.normalizeLogin
        : ((value = '') => String(value || '').trim().toLowerCase());
    const persistPromptOverridesStoreLocally = typeof deps.persistPromptOverridesStoreLocally === 'function'
        ? deps.persistPromptOverridesStoreLocally
        : ((store = {}) => store);
    const resolvePromptSyncConflicts = typeof deps.resolvePromptSyncConflicts === 'function'
        ? deps.resolvePromptSyncConflicts
        : (() => []);
    const retryDelayMs = Number.isFinite(deps.retryDelayMs)
        ? deps.retryDelayMs
        : 2000;
    const saveDebounceMs = Number.isFinite(deps.saveDebounceMs)
        ? deps.saveDebounceMs
        : 800;
    const savePromptsToFirebase = typeof deps.savePromptsToFirebase === 'function'
        ? deps.savePromptsToFirebase
        : (() => false);
    const setState = typeof deps.setState === 'function'
        ? deps.setState
        : (() => {});
    const setTimeoutFn = typeof deps.setTimeoutFn === 'function'
        ? deps.setTimeoutFn
        : ((handler, delay) => setTimeout(handler, delay));
    const clearTimeoutFn = typeof deps.clearTimeoutFn === 'function'
        ? deps.clearTimeoutFn
        : ((id) => clearTimeout(id));
    const writePromptOverrides = typeof deps.writePromptOverrides === 'function'
        ? deps.writePromptOverrides
        : (async () => true);

    function clearPromptOverridesSyncRetry() {
        const state = getState();
        if (!state.promptOverridesSyncRetryTimerId) return false;
        clearTimeoutFn(state.promptOverridesSyncRetryTimerId);
        setState({
            promptOverridesSyncRetryTimerId: null
        });
        return true;
    }

    function schedulePromptOverridesSyncRetry(payload = null) {
        const state = getState();
        const payloadState = payload
            ? buildNormalizedPromptOverridesStoreState(payload)
            : (state.queuedPromptOverridesPayloadState || buildNormalizedPromptOverridesStoreState(state.queuedPromptOverridesPayload || buildPromptOverridesPayload()));
        setState({
            queuedPromptOverridesPayload: payloadState.normalized,
            queuedPromptOverridesPayloadState: payloadState
        });
        if (state.promptOverridesSyncRetryTimerId) {
            return false;
        }
        const timerId = setTimeoutFn(() => {
            setState({
                promptOverridesSyncRetryTimerId: null
            });
            void savePromptOverridesToFirebaseNow();
        }, retryDelayMs);
        setState({
            promptOverridesSyncRetryTimerId: timerId
        });
        return true;
    }

    function queuePromptOverridesSave(payload = null) {
        if (!canSyncPromptOverrides()) return false;
        const state = getState();
        const payloadState = buildNormalizedPromptOverridesStoreState(payload || buildPromptOverridesPayload());
        const normalizedPayload = payloadState.normalized;
        if (payloadState.hash === state.lastPromptOverridesRemoteHash) {
            if (state.currentUserPromptOverridesSaveTimer) {
                clearTimeoutFn(state.currentUserPromptOverridesSaveTimer);
            }
            clearPromptOverridesSyncRetry();
            setState({
                currentUserPromptOverridesSaveTimer: null,
                queuedPromptOverridesPayload: null,
                queuedPromptOverridesPayloadState: null
            });
            return false;
        }

        if (state.currentUserPromptOverridesSaveTimer) {
            clearTimeoutFn(state.currentUserPromptOverridesSaveTimer);
        }
        const timerId = setTimeoutFn(() => {
            void savePromptOverridesToFirebaseNow();
        }, saveDebounceMs);
        setState({
            currentUserPromptOverridesSaveTimer: timerId,
            queuedPromptOverridesPayload: normalizedPayload,
            queuedPromptOverridesPayloadState: payloadState
        });
        return true;
    }

    async function savePromptOverridesToFirebaseNow(payload = null, options = {}) {
        const startState = getState();
        if (startState.currentUserPromptOverridesSaveTimer) {
            clearTimeoutFn(startState.currentUserPromptOverridesSaveTimer);
            setState({
                currentUserPromptOverridesSaveTimer: null
            });
        }

        const refreshedState = getState();
        const payloadState = payload
            ? buildNormalizedPromptOverridesStoreState(payload)
            : (refreshedState.queuedPromptOverridesPayloadState || buildNormalizedPromptOverridesStoreState(refreshedState.queuedPromptOverridesPayload || buildPromptOverridesPayload()));
        const normalizedPayload = payloadState.normalized;

        if (refreshedState.promptOverridesSyncInFlight) {
            schedulePromptOverridesSyncRetry(normalizedPayload);
            return false;
        }

        if (refreshedState.pendingPromptOverridesRemoteStore !== null) {
            setState({
                queuedPromptOverridesPayload: normalizedPayload,
                queuedPromptOverridesPayloadState: payloadState
            });
            return false;
        }

        setState({
            queuedPromptOverridesPayload: null,
            queuedPromptOverridesPayloadState: null
        });

        if (!canSyncPromptOverrides()) {
            return false;
        }

        const activeState = getState();
        const normalizedLogin = normalizeLogin(
            activeState.currentUserPromptOverridesListenerLogin || activeState.currentUser?.login || ''
        );
        if (!normalizedLogin) {
            return false;
        }

        if (!options.force && payloadState.hash === activeState.lastPromptOverridesRemoteHash) {
            return false;
        }

        const remotePath = getPromptOverridesDbPath(normalizedLogin);
        if (!remotePath) {
            return false;
        }

        try {
            setState({
                promptOverridesSyncInFlight: true
            });
            await writePromptOverrides(remotePath, payloadState.hasData ? normalizedPayload : null);
            clearPromptOverridesSyncRetry();
            const dirtyPromptOverrideRoles = getState().dirtyPromptOverrideRoles;
            if (dirtyPromptOverrideRoles instanceof Set) {
                dirtyPromptOverrideRoles.clear();
            }
            setState({
                currentUserPromptOverridesStore: normalizedPayload,
                currentUserPromptOverridesStoreState: payloadState,
                lastPromptOverridesRemoteHash: payloadState.hash
            });
            return true;
        } catch (error) {
            schedulePromptOverridesSyncRetry(normalizedPayload);
            throw error;
        } finally {
            setState({
                promptOverridesSyncInFlight: false
            });
        }
    }

    function applyDeferredPromptRemoteState() {
        const state = getState();
        if (state.isUserEditing) return false;

        let didApply = false;

        if (state.pendingPromptOverridesRemoteStore !== null) {
            const pendingPromptOverridesState = state.pendingPromptOverridesRemoteStoreState
                || buildNormalizedPromptOverridesStoreState(state.pendingPromptOverridesRemoteStore);
            const mergedPromptOverridesStore = buildMergedPromptOverridesStore(pendingPromptOverridesState.normalized);
            const mergedPromptOverridesStoreState = buildNormalizedPromptOverridesStoreState(mergedPromptOverridesStore);
            persistPromptOverridesStoreLocally(mergedPromptOverridesStoreState.normalized, { state: mergedPromptOverridesStoreState });
            setState({
                currentUserPromptOverridesStore: mergedPromptOverridesStoreState.normalized,
                currentUserPromptOverridesStoreState: mergedPromptOverridesStoreState,
                lastPromptOverridesRemoteHash: state.pendingPromptOverridesRemoteHash,
                pendingPromptOverridesRemoteStore: null,
                pendingPromptOverridesRemoteStoreState: null,
                pendingPromptOverridesRemoteHash: ''
            });
            didApply = true;
        }

        const stateAfterOverrides = getState();
        if (stateAfterOverrides.pendingPromptsFirebaseSnapshot !== null) {
            const remoteSnapshot = stateAfterOverrides.pendingPromptsFirebaseSnapshot;
            resolvePromptSyncConflicts(remoteSnapshot);
            const mergedSnapshot = buildMergedPromptsSnapshot(remoteSnapshot);
            setState({
                pendingPromptsFirebaseSnapshot: null,
                pendingPromptsFirebaseSnapshotState: null
            });
            const didApplyPrompts = initPromptsData(mergedSnapshot);
            didApply = didApply || didApplyPrompts;
        }

        const finalState = getState();
        if (!didApply) {
            return false;
        }

        if (finalState.dirtyPublicPromptRoles instanceof Set && finalState.dirtyPublicPromptRoles.size) {
            savePromptsToFirebase();
        }
        if ((finalState.dirtyPromptOverrideRoles instanceof Set && finalState.dirtyPromptOverrideRoles.size) || finalState.queuedPromptOverridesPayload) {
            queuePromptOverridesSave();
        }
        return true;
    }

    return {
        applyDeferredPromptRemoteState,
        clearPromptOverridesSyncRetry,
        queuePromptOverridesSave,
        savePromptOverridesToFirebaseNow,
        schedulePromptOverridesSyncRetry
    };
}
