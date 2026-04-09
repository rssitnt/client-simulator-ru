(function applyEarlyLocalMinimalUiClass() {
    var host = String(window.location.hostname || '').trim().toLowerCase();
    var shouldUseMinimalUi = host === 'localhost'
        || host === '127.0.0.1'
        || host === '[::1]'
        || host === 'client-simulator.ru'
        || host === 'www.client-simulator.ru';
    if (shouldUseMinimalUi) {
        document.documentElement.classList.add('local-minimal-ui');
        if (document.body) {
            document.body.classList.add('local-minimal-ui');
        }
    }
})();
