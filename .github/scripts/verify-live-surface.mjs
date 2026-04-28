import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const liveUrl = 'https://client-simulator.ru/';
const timeoutMs = 10 * 60 * 1000;
const pollIntervalMs = 15 * 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractAssetVersion(html, assetBaseName) {
  const escapedName = assetBaseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`${escapedName}\\?v=([0-9-]+)`));
  return String(match?.[1] || '').trim();
}

function requireMatch(value, pattern, message) {
  if (!pattern.test(value)) {
    throw new Error(message);
  }
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'cache-control': 'no-cache'
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return await response.text();
}

async function fetchBuffer(url) {
  const response = await fetch(url, {
    headers: {
      'cache-control': 'no-cache'
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function waitForLiveHtml(expectedScriptVersion, expectedStyleVersion) {
  const deadline = Date.now() + timeoutMs;
  let lastHtml = '';
  let lastError = '';

  while (Date.now() < deadline) {
    try {
      const html = await fetchText(liveUrl);
      lastHtml = html;
      const hasScriptVersion = html.includes(`script.bundle.min.js?v=${expectedScriptVersion}`);
      const hasStyleVersion = html.includes(`style.min.css?v=${expectedStyleVersion}`);
      if (hasScriptVersion && hasStyleVersion) {
        return html;
      }
      lastError = `live html does not contain expected asset versions yet (script=${hasScriptVersion}, style=${hasStyleVersion})`;
    } catch (error) {
      lastError = String(error?.message || error);
    }

    await sleep(pollIntervalMs);
  }

  throw new Error(`Timed out waiting for live HTML update: ${lastError}\nLast HTML size: ${lastHtml.length}`);
}

async function main() {
  const localHtml = await fs.readFile(path.join(repoRoot, 'index.html'), 'utf8');
  const expectedScriptVersion = extractAssetVersion(localHtml, 'script.bundle.min.js');
  const expectedStyleVersion = extractAssetVersion(localHtml, 'style.min.css');

  if (!expectedScriptVersion || !expectedStyleVersion) {
    throw new Error('Could not extract expected asset versions from local index.html');
  }

  const liveHtml = await waitForLiveHtml(expectedScriptVersion, expectedStyleVersion);

  requireMatch(
    liveHtml,
    /<div id="nameModal" class="modal-overlay">/,
    'Live HTML must keep the auth modal hidden in raw markup'
  );
  if (liveHtml.includes('id="nameModal" class="modal-overlay active"')) {
    throw new Error('Live HTML must not expose the active auth modal in raw markup');
  }
  requireMatch(
    liveHtml,
    /<script type="module" src="script\.bundle\.min\.js\?v=[0-9-]+"><\/script>/,
    'Live HTML does not reference the bundled runtime'
  );
  requireMatch(
    liveHtml,
    /<link rel="stylesheet" href="style\.min\.css\?v=[0-9-]+">/,
    'Live HTML does not reference the minified stylesheet'
  );

  if (liveHtml.includes('src="script.js"') || liveHtml.includes('href="style.css"')) {
    throw new Error('Live HTML still references legacy non-minified runtime assets');
  }

  const scriptBuffer = await fetchBuffer(`${liveUrl}script.bundle.min.js?v=${expectedScriptVersion}`);
  const styleBuffer = await fetchBuffer(`${liveUrl}style.min.css?v=${expectedStyleVersion}`);

  if (scriptBuffer.byteLength < 100000) {
    throw new Error(`Live script bundle is unexpectedly small: ${scriptBuffer.byteLength} bytes`);
  }
  if (styleBuffer.byteLength < 30000) {
    throw new Error(`Live stylesheet is unexpectedly small: ${styleBuffer.byteLength} bytes`);
  }

  const scriptText = scriptBuffer.toString('utf8');
  const styleText = styleBuffer.toString('utf8');
  if (!scriptText.includes('settings-shell-panel')) {
    throw new Error('Live script bundle must keep the settings shell-panel activation path');
  }
  if (!styleText.includes('body.local-minimal-ui #settingsModal.settings-shell-panel{position:fixed!important;top:0!important;right:0!important;bottom:0!important;left:auto!important')) {
    throw new Error('Live stylesheet must keep desktop settings as a right-docked shell panel');
  }
  if (!styleText.includes('@media (max-width:1024px){body.local-minimal-ui .mobile-tabs{grid-template-columns:repeat(4,minmax(0,1fr))!important}body.local-minimal-ui #settingsModal.settings-shell-panel{position:relative!important')) {
    throw new Error('Live stylesheet must keep mobile settings as the fourth in-flow shell tab page');
  }

  console.log(JSON.stringify({
    ok: true,
    liveUrl,
    expectedScriptVersion,
    expectedStyleVersion,
    liveScriptBytes: scriptBuffer.byteLength,
    liveStyleBytes: styleBuffer.byteLength
  }));
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
