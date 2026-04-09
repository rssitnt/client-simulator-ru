import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--no-first-run','--no-default-browser-check'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
try {
  await page.goto('http://127.0.0.1:3001', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#nameModal.active');
  await page.fill('#modalNameInput', 'Локальный Тестер');
  await page.fill('#modalLoginInput', 'local.dev@tradicia-k.ru');
  await page.fill('#modalPasswordInput', 'Passw0rd!');
  await page.click('#localhostDevAuthBtn');
  await page.waitForFunction(() => !document.getElementById('nameModal')?.classList.contains('active'));
  await page.waitForFunction(() => {
    const btn = document.getElementById('startBtn');
    return !!btn && !btn.disabled;
  });
  await page.click('#startBtn');
  await page.waitForSelector('text=Готов обсудить задачу.');
  await page.fill('#userInput', 'Нужен гидробур на CASE 260.');
  await page.click('#sendBtn');
  await page.waitForFunction(() => Array.from(document.querySelectorAll('#chatMessages .message')).some((n) => String(n.textContent || '').includes('Ок.')));
  await page.waitForSelector('#mainDialogHistoryList .dialog-history-item');
  console.log('history item ready');
  await page.hover('#mainDialogHistoryList .dialog-history-item');
  console.log('hovered');
  const renamePrompt = page.waitForEvent('dialog', { timeout: 10000 });
  await page.click('#mainDialogHistoryList .dialog-history-item-menu-toggle');
  console.log('toggle clicked');
  const actions = await page.locator('#mainDialogHistoryList .dialog-history-item-menu-action').allTextContents();
  console.log('actions', actions);
  await page.click('#mainDialogHistoryList .dialog-history-item-menu-action');
  console.log('rename clicked');
  const dialog = await renamePrompt;
  console.log('dialog type', dialog.type(), 'message', dialog.message());
  await dialog.accept('Мой тестовый диалог');
  console.log('dialog accepted');
  await page.waitForTimeout(1000);
  const listTitle = await page.locator('#mainDialogHistoryList .dialog-history-item-title').textContent();
  console.log('title after rename', listTitle);
  await page.reload({ waitUntil: 'domcontentloaded' });
  console.log('reloaded');
  await page.waitForFunction(() => !document.getElementById('nameModal')?.classList.contains('active'));
  await page.waitForSelector('#mainDialogHistoryList .dialog-history-item');
  const reloadedTitle = await page.locator('#mainDialogHistoryList .dialog-history-item-title').textContent();
  console.log('title after reload', reloadedTitle);
} catch (error) {
  console.error('SCRIPT_ERROR', error);
} finally {
  await browser.close();
}
