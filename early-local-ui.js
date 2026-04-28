(function applyEarlyLocalMinimalUiClass() {
    var host = String(window.location.hostname || '').trim().toLowerCase();
    var root = document.documentElement;
    var body = document.body;
    function revealBootUi() {
        if (body) {
            body.classList.remove('app-booting');
        }
        if (root) {
            root.classList.add('app-booted');
        }
    }
    window.__clientSimulatorRevealBootUi = revealBootUi;
    var shouldUseMinimalUi = host === 'localhost'
        || host === '127.0.0.1'
        || host === '[::1]'
        || host === 'client-simulator.ru'
        || host === 'www.client-simulator.ru';
    if (shouldUseMinimalUi) {
        if (root) {
            root.classList.add('local-minimal-ui');
        }
        if (body) {
            body.classList.add('local-minimal-ui');
            body.classList.add('app-booting');
        }
        window.setTimeout(revealBootUi, 5000);
        return;
    }
    if (root) {
        root.classList.remove('local-minimal-ui');
    }
    if (body) {
        body.classList.remove('local-minimal-ui');
        body.classList.remove('app-booting');
    }
})();
