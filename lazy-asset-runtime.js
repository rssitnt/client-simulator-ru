export function createLazyAssetRuntime(options = {}) {
    const assets = options.assets || {};
    const root = options.root || globalThis;
    const doc = options.documentRef || root.document;
    const logger = options.logger || console;
    const onMarkedConfigured = typeof options.onMarkedConfigured === 'function'
        ? options.onMarkedConfigured
        : null;
    const lazyThirdPartyPromises = new Map();
    let markedLibraryConfigured = false;
    let turndownService = null;

    function isLazyThirdPartyAssetReady(asset = {}) {
        return asset.globalName && typeof root[asset.globalName] !== 'undefined';
    }

    function loadLazyScriptAsset(assetKey) {
        const asset = assets[assetKey];
        if (!asset) return Promise.resolve(false);
        if (isLazyThirdPartyAssetReady(asset)) return Promise.resolve(true);
        if (lazyThirdPartyPromises.has(assetKey)) return lazyThirdPartyPromises.get(assetKey);
        if (!doc?.querySelector || !doc?.createElement || !doc?.head?.appendChild) {
            return Promise.resolve(false);
        }

        const promise = new Promise((resolve, reject) => {
            const existingScript = doc.querySelector(`script[data-lazy-lib="${assetKey}"]`);
            if (existingScript) {
                existingScript.addEventListener('load', () => resolve(true), { once: true });
                existingScript.addEventListener('error', () => reject(new Error(`Failed to load ${assetKey}`)), { once: true });
                return;
            }

            const script = doc.createElement('script');
            script.src = asset.url;
            script.async = true;
            script.crossOrigin = 'anonymous';
            script.dataset.lazyLib = assetKey;
            if (asset.integrity) {
                script.integrity = asset.integrity;
            }
            script.onload = () => resolve(true);
            script.onerror = () => reject(new Error(`Failed to load ${assetKey}`));
            doc.head.appendChild(script);
        }).catch((error) => {
            logger?.warn?.(`Lazy library load failed: ${assetKey}`, error);
            lazyThirdPartyPromises.delete(assetKey);
            return false;
        });

        lazyThirdPartyPromises.set(assetKey, promise);
        return promise;
    }

    function loadLazyStylesheetAsset(assetKey) {
        const asset = assets[assetKey];
        if (!asset) return Promise.resolve(false);
        if (!doc?.querySelector || !doc?.createElement || !doc?.head?.appendChild) {
            return Promise.resolve(false);
        }
        if (doc.querySelector(`link[data-lazy-lib="${assetKey}"]`)) return Promise.resolve(true);
        if (lazyThirdPartyPromises.has(assetKey)) return lazyThirdPartyPromises.get(assetKey);

        const promise = new Promise((resolve, reject) => {
            const link = doc.createElement('link');
            link.rel = 'stylesheet';
            link.href = asset.url;
            link.crossOrigin = 'anonymous';
            link.dataset.lazyLib = assetKey;
            if (asset.integrity) {
                link.integrity = asset.integrity;
            }
            link.onload = () => resolve(true);
            link.onerror = () => reject(new Error(`Failed to load ${assetKey}`));
            doc.head.appendChild(link);
        }).catch((error) => {
            logger?.warn?.(`Lazy stylesheet load failed: ${assetKey}`, error);
            lazyThirdPartyPromises.delete(assetKey);
            return false;
        });

        lazyThirdPartyPromises.set(assetKey, promise);
        return promise;
    }

    function configureMarkedLibrary() {
        const markedLib = root.marked;
        if (!markedLib || markedLibraryConfigured) return false;
        markedLib.setOptions({
            breaks: true,
            gfm: true,
            highlight(code, lang) {
                const highlighter = root.hljs;
                if (highlighter && lang && highlighter.getLanguage(lang)) {
                    try {
                        return highlighter.highlight(code, { language: lang }).value;
                    } catch (e) {}
                }
                return code;
            }
        });
        markedLibraryConfigured = true;
        onMarkedConfigured?.();
        return true;
    }

    function configureTurndownLibrary() {
        if (turndownService) return turndownService;
        const Turndown = root.TurndownService;
        if (!Turndown) return null;

        turndownService = new Turndown({
            headingStyle: 'atx',
            hr: '---',
            bulletListMarker: '-',
            codeBlockStyle: 'fenced',
            emDelimiter: '*',
            strongDelimiter: '**'
        });
        turndownService.escape = function(string) { return string; };
        turndownService.addRule('strong', {
            filter: ['strong', 'b'],
            replacement(content) {
                if (!content.trim()) return '';
                return '**' + content + '**';
            }
        });
        turndownService.addRule('emphasis', {
            filter: ['em', 'i'],
            replacement(content) {
                if (!content.trim()) return '';
                return '*' + content + '*';
            }
        });
        turndownService.addRule('strikethrough', {
            filter: ['del', 's', 'strike'],
            replacement(content) {
                return '~~' + content + '~~';
            }
        });
        return turndownService;
    }

    async function ensureMarkdownRenderLibrariesLoaded(loadOptions = {}) {
        const withHighlight = !!loadOptions.withHighlight;
        const loads = [
            loadLazyScriptAsset('marked'),
            loadLazyScriptAsset('dompurify')
        ];
        if (withHighlight) {
            loads.push(loadLazyStylesheetAsset('highlightCss'));
            loads.push(loadLazyScriptAsset('highlight'));
        }
        await Promise.all(loads);
        configureMarkedLibrary();
        return !!root.marked;
    }

    async function ensureDiffLibraryLoaded() {
        await loadLazyScriptAsset('diff');
        return !!root.Diff?.diffWordsWithSpace;
    }

    async function ensureTurndownServiceLoaded() {
        await loadLazyScriptAsset('turndown');
        return configureTurndownLibrary();
    }

    return {
        configureMarkedLibrary,
        configureTurndownLibrary,
        ensureDiffLibraryLoaded,
        ensureMarkdownRenderLibrariesLoaded,
        ensureTurndownServiceLoaded,
        isLazyThirdPartyAssetReady,
        loadLazyScriptAsset,
        loadLazyStylesheetAsset
    };
}
