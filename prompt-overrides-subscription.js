export function createPromptOverridesSubscriptionHelpers(deps = {}) {
    const buildNormalizedPromptOverridesStoreState = typeof deps.buildNormalizedPromptOverridesStoreState === 'function'
        ? deps.buildNormalizedPromptOverridesStoreState
        : ((store = {}) => ({ normalized: store || {}, hash: JSON.stringify(store || {}), hasData: false }));
    const canSyncPromptOverrides = typeof deps.canSyncPromptOverrides === 'function'
        ? deps.canSyncPromptOverrides
        : (() => false);
    const clearPromptOverridesSyncRetry = typeof deps.clearPromptOverridesSyncRetry === 'function'
        ? deps.clearPromptOverridesSyncRetry
        : (() => false);
    const debugLog = typeof deps.debugLog === 'function'
        ? deps.debugLog
        : (() => {});
    const getNextRealtimeRecoveryDelay = typeof deps.getNextRealtimeRecoveryDelay === 'function'
        ? deps.getNextRealtimeRecoveryDelay
        : ((_key, delay) => delay);
    const getPromptOverridesDbPath = typeof deps.getPromptOverridesDbPath === 'function'
        ? deps.getPromptOverridesDbPath
        : (() => '');
    const getState = typeof deps.getState === 'function'
        ? deps.getState
        : (() => ({}));
    const initPromptsData = typeof deps.initPromptsData === 'function'
        ? deps.initPromptsData
        : (() => false);
    const loadLocalPromptsStoreState = typeof deps.loadLocalPromptsStoreState === 'function'
        ? deps.loadLocalPromptsStoreState
        : (() => ({ normalized: {}, hasData: false, hash: '{}' }));
    const normalizeLogin = typeof deps.normalizeLogin === 'function'
        ? deps.normalizeLogin
        : ((value = '') => String(value || '').trim().toLowerCase());
    const persistPromptOverridesStoreLocally = typeof deps.persistPromptOverridesStoreLocally === 'function'
        ? deps.persistPromptOverridesStoreLocally
        : ((store = {}) => store);
    const queuePromptOverridesSave = typeof deps.queuePromptOverridesSave === 'function'
        ? deps.queuePromptOverridesSave
        : (() => false);
    const resetRealtimeRecoveryBackoff = typeof deps.resetRealtimeRecoveryBackoff === 'function'
        ? deps.resetRealtimeRecoveryBackoff
        : (() => {});
    const setState = typeof deps.setState === 'function'
        ? deps.setState
        : (() => {});
    const setTimeoutFn = typeof deps.setTimeoutFn === 'function'
        ? deps.setTimeoutFn
        : ((handler, delay) => setTimeout(handler, delay));
    const clearTimeoutFn = typeof deps.clearTimeoutFn === 'function'
        ? deps.clearTimeoutFn
        : ((id) => clearTimeout(id));
    const subscribeToPromptOverrides = typeof deps.subscribeToPromptOverrides === 'function'
        ? deps.subscribeToPromptOverrides
        : (() => () => {});

    function clearCurrentUserPromptOverridesRecovery() {
        const state = getState();
        if (state.currentUserPromptOverridesRecoveryTimerId) {
            clearTimeoutFn(state.currentUserPromptOverridesRecoveryTimerId);
            setState({
                currentUserPromptOverridesRecoveryTimerId: null
            });
        }
        resetRealtimeRecoveryBackoff('prompt-overrides');
        return true;
    }

    function hasHealthyCurrentUserPromptOverridesSubscription() {
        const state = getState();
        return typeof state.currentUserPromptOverridesUnsubscribe === 'function' && !!state.currentUserPromptOverridesSubscriptionHealthy;
    }

    function stopCurrentUserPromptOverridesListenerTransport() {
        clearCurrentUserPromptOverridesRecovery();
        const state = getState();
        const unsubscribe = state.currentUserPromptOverridesUnsubscribe;
        if (typeof unsubscribe === 'function') {
            try {
                unsubscribe();
            } catch (error) {
                console.warn('Failed to stop prompt overrides live listener:', error);
            }
        }
        setState({
            currentUserPromptOverridesSubscriptionHealthy: false,
            currentUserPromptOverridesUnsubscribe: null,
            currentUserPromptOverridesListenerLogin: ''
        });
        return true;
    }

    function stopCurrentUserPromptOverridesSubscription() {
        clearCurrentUserPromptOverridesRecovery();
        clearPromptOverridesSyncRetry();
        const state = getState();
        const unsubscribe = state.currentUserPromptOverridesUnsubscribe;
        if (typeof unsubscribe === 'function') {
            unsubscribe();
        }
        if (state.currentUserPromptOverridesSaveTimer) {
            clearTimeoutFn(state.currentUserPromptOverridesSaveTimer);
        }
        if (state.dirtyPromptOverrideRoles instanceof Set) {
            state.dirtyPromptOverrideRoles.clear();
        }
        setState({
            currentUserPromptOverridesListenerLogin: '',
            currentUserPromptOverridesSaveTimer: null,
            currentUserPromptOverridesStore: null,
            currentUserPromptOverridesStoreState: null,
            currentUserPromptOverridesSubscriptionHealthy: false,
            currentUserPromptOverridesUnsubscribe: null,
            lastPromptOverridesRemoteHash: '',
            pendingPromptOverridesRemoteHash: '',
            pendingPromptOverridesRemoteStore: null,
            pendingPromptOverridesRemoteStoreState: null,
            promptOverridesSyncInFlight: false,
            queuedPromptOverridesPayload: null,
            queuedPromptOverridesPayloadState: null
        });
        return true;
    }

    function scheduleCurrentUserPromptOverridesRecovery(login = '', reason = '', delayMs = 0) {
        const state = getState();
        const normalizedLogin = normalizeLogin(login || state.currentUserPromptOverridesListenerLogin || state.currentUser?.login || '');
        if (!normalizedLogin || state.currentUserPromptOverridesRecoveryTimerId) {
            return false;
        }
        const effectiveDelayMs = getNextRealtimeRecoveryDelay('prompt-overrides', delayMs);
        const timerId = setTimeoutFn(() => {
            setState({
                currentUserPromptOverridesRecoveryTimerId: null
            });
            const liveState = getState();
            if (!liveState.currentUser || normalizeLogin(liveState.currentUser.login) !== normalizedLogin) return;
            const syncCandidateUser = { ...liveState.currentUser, login: normalizedLogin };
            if (!canSyncPromptOverrides(syncCandidateUser)) return;
            debugLog('Recovering prompt overrides live listener', { reason, login: normalizedLogin });
            startCurrentUserPromptOverridesSubscription(normalizedLogin);
        }, effectiveDelayMs);
        setState({
            currentUserPromptOverridesRecoveryTimerId: timerId
        });
        return true;
    }

    function startCurrentUserPromptOverridesSubscription(login = '') {
        const state = getState();
        const normalizedLogin = normalizeLogin(login || state.currentUser?.login || '');
        const syncCandidateUser = state.currentUser
            ? { ...state.currentUser, login: normalizedLogin }
            : { login: normalizedLogin, role: 'user' };
        if (!canSyncPromptOverrides(syncCandidateUser)) {
            stopCurrentUserPromptOverridesSubscription();
            return false;
        }
        if (hasHealthyCurrentUserPromptOverridesSubscription() && state.currentUserPromptOverridesListenerLogin === normalizedLogin) {
            return true;
        }

        if (state.currentUserPromptOverridesListenerLogin && state.currentUserPromptOverridesListenerLogin !== normalizedLogin) {
            stopCurrentUserPromptOverridesSubscription();
        } else {
            stopCurrentUserPromptOverridesListenerTransport();
        }

        const remotePath = getPromptOverridesDbPath(normalizedLogin);
        if (!remotePath) {
            return false;
        }

        setState({
            currentUserPromptOverridesListenerLogin: normalizedLogin,
            currentUserPromptOverridesSubscriptionHealthy: false
        });

        const unsubscribe = subscribeToPromptOverrides(
            remotePath,
            (rawStore = {}) => {
                const liveState = getState();
                if (!liveState.currentUser || normalizeLogin(liveState.currentUser.login) !== normalizedLogin) return;
                clearCurrentUserPromptOverridesRecovery();
                setState({
                    currentUserPromptOverridesSubscriptionHealthy: true
                });

                const remoteStoreState = buildNormalizedPromptOverridesStoreState(rawStore || {});
                const localStoreState = loadLocalPromptsStoreState();
                const shouldBootstrapRemote = !remoteStoreState.hasData && localStoreState.hasData;
                const effectiveStoreState = shouldBootstrapRemote ? localStoreState : remoteStoreState;
                const effectiveStore = effectiveStoreState.normalized;

                if (shouldBootstrapRemote) {
                    queuePromptOverridesSave(effectiveStore);
                }

                const refreshedState = getState();
                if (refreshedState.isUserEditing || refreshedState.lastPromptsFirebaseSnapshot === null) {
                    setState({
                        pendingPromptOverridesRemoteStore: effectiveStore,
                        pendingPromptOverridesRemoteStoreState: effectiveStoreState,
                        pendingPromptOverridesRemoteHash: remoteStoreState.hash
                    });
                    return;
                }

                persistPromptOverridesStoreLocally(effectiveStore, { state: effectiveStoreState });
                setState({
                    currentUserPromptOverridesStore: effectiveStore,
                    currentUserPromptOverridesStoreState: effectiveStoreState,
                    lastPromptOverridesRemoteHash: remoteStoreState.hash
                });
                initPromptsData(refreshedState.lastPromptsFirebaseSnapshot || {});
            },
            (error) => {
                setState({
                    currentUserPromptOverridesSubscriptionHealthy: false
                });
                console.error('Prompt overrides live sync failed:', error);
                const localStoreState = loadLocalPromptsStoreState();
                setState({
                    currentUserPromptOverridesStore: localStoreState.normalized,
                    currentUserPromptOverridesStoreState: localStoreState,
                    pendingPromptOverridesRemoteStore: null,
                    pendingPromptOverridesRemoteStoreState: null,
                    pendingPromptOverridesRemoteHash: ''
                });
                const refreshedState = getState();
                if (!refreshedState.isUserEditing && refreshedState.lastPromptsFirebaseSnapshot !== null) {
                    initPromptsData(refreshedState.lastPromptsFirebaseSnapshot || {});
                }
                scheduleCurrentUserPromptOverridesRecovery(normalizedLogin, 'prompt-overrides-live-sync-failed', deps.defaultRecoveryDelayMs);
            }
        );

        setState({
            currentUserPromptOverridesUnsubscribe: unsubscribe
        });
        return true;
    }

    return {
        clearCurrentUserPromptOverridesRecovery,
        hasHealthyCurrentUserPromptOverridesSubscription,
        scheduleCurrentUserPromptOverridesRecovery,
        startCurrentUserPromptOverridesSubscription,
        stopCurrentUserPromptOverridesListenerTransport,
        stopCurrentUserPromptOverridesSubscription
    };
}
