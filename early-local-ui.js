(function applyEarlyLocalMinimalUiClass() {
    var host = String(window.location.hostname || '').trim().toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
        document.documentElement.classList.add('local-minimal-ui');
        if (document.body) {
            document.body.classList.add('local-minimal-ui');
        }
    }
})();
