import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function startServer() {
  const root = 'C:/projects/sites/client-simulator';
  const server = createServer((req, res) => {
    try {
      let p = req.url || '/';
      if (p === '/') p = '/index.html';
      const filePath = resolve(root + p);
      const data = readFileSync(filePath);
      let ct = 'text/plain';
      if (filePath.endsWith('.html')) ct = 'text/html';
      else if (filePath.endsWith('.js')) ct = 'application/javascript';
      else if (filePath.endsWith('.css')) ct = 'text/css';
      else if (filePath.endsWith('.png')) ct = 'image/png';
      res.writeHead(200, { 'Content-Type': `${ct}; charset=utf-8`, 'Cache-Control': 'no-store' });
      res.end(data);
    } catch (error) {
      res.writeHead(404);
      res.end('not found');
    }
  });

  return new Promise((resolveServer) => {
    server.listen(0, '127.0.0.1', () => resolveServer(server));
  });
}

(async () => {
  const server = await startServer();
  const port = server.address().port;

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  await page.addInitScript(() => {
    const login = 'admin@example.com';
    const fio = 'Тест Админ';
    const now = new Date().toISOString();
    const key = Array.from(login.toLowerCase()).map((c) => c.codePointAt(0).toString(16)).join('_');
    localStorage.setItem('authSession:v1', JSON.stringify({ login, signedAt: now }));
    localStorage.setItem('authUsers:v1', JSON.stringify({
      [key]: {
        login,
        fio,
        role: 'admin',
        emailVerifiedAt: now,
        failedLoginAttempts: 0,
        isBlocked: false,
        blockedReason: null,
        blockedAt: null,
        failedLoginBackoffUntil: null,
        sessionRevokedAt: null,
        lastLoginAt: now,
        lastSeenAt: now,
        activeMs: 0,
        passwordHash: '',
        passwordNeedsSetup: false,
        passwordHashScheme: null
      }
    }));
    localStorage.setItem('managerName', fio);
    localStorage.setItem('managerLogin', login);
    localStorage.setItem('userRole', 'admin');
  });

  const messages = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.toLowerCase().includes('error') || text.toLowerCase().includes('admin') || text.toLowerCase().includes('failed')) {
      messages.push(text);
    }
  });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });

  await page.click('#settingsBtn');
  await page.waitForSelector('#settingsModal.active');
  const before = await page.textContent('#adminUsersTableBody');
  console.log('INITIAL:', before?.trim().slice(0, 200));

  await page.click('#adminPanelAccordion summary');
  await page.click('#adminUsersAccessAccordion summary');

  await page.waitForTimeout(2000);
  const after2 = await page.textContent('#adminUsersTableBody');
  console.log('AFTER2:', after2?.trim().slice(0, 200));

  await page.waitForTimeout(5000);
  const after7 = await page.textContent('#adminUsersTableBody');
  console.log('AFTER7:', after7?.trim().slice(0, 200));

  console.log('CONSOLE:\n' + messages.join('\n'));

  await browser.close();
  server.close();
})();
