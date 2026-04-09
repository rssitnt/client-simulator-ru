import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = 'C:/projects/sites/client-simulator';
const mimeTypes = new Map([
 ['.html','text/html; charset=utf-8'],['.js','application/javascript; charset=utf-8'],['.css','text/css; charset=utf-8'],['.json','application/json; charset=utf-8'],['.svg','image/svg+xml'],['.png','image/png'],['.jpg','image/jpeg'],['.jpeg','image/jpeg'],['.ico','image/x-icon'],['.webmanifest','application/manifest+json'],['.txt','text/plain; charset=utf-8']
]);
async function createStaticFileServer(rootDir){
 const server=createServer(async(req,res)=>{try{const url=new URL(req.url||'/', 'http://127.0.0.1'); let filePath=path.join(rootDir, decodeURIComponent(url.pathname)); if(url.pathname==='/'||url.pathname===''){filePath=path.join(rootDir,'index.html');} const info=await stat(filePath).catch(()=>null); if(info?.isDirectory()) filePath=path.join(filePath,'index.html'); const body=await readFile(filePath); const ext=path.extname(filePath).toLowerCase(); res.writeHead(200,{ 'content-type': mimeTypes.get(ext)||'application/octet-stream','cache-control':'no-store'}); res.end(body);} catch {res.writeHead(404); res.end('not found');}});
 await new Promise((resolve)=>server.listen(3017,'127.0.0.1',resolve));
 return server;
}
const server = await createStaticFileServer(projectRoot);
const browser = await chromium.launch({ headless:true, args:['--no-first-run','--no-default-browser-check'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();
page.on('console', msg => console.log('console:', msg.type(), msg.text()));
page.on('pageerror', err => console.log('pageerror:', err.message));
try {
 await page.goto('http://127.0.0.1:3017', { waitUntil:'domcontentloaded' });
 await page.waitForSelector('#nameModal.active');
 await page.fill('#modalNameInput','Локальный Тестер');
 await page.fill('#modalLoginInput','local.dev@tradicia-k.ru');
 await page.fill('#modalPasswordInput','Passw0rd!');
 await page.click('#localhostDevAuthBtn');
 await page.waitForFunction(() => !document.getElementById('nameModal')?.classList.contains('active'));
 await page.waitForFunction(() => {
   const startBtn = document.getElementById('startBtn');
   return !!startBtn && !startBtn.disabled;
 });
 console.log('ready');
 await page.click('#startBtn');
 await page.waitForSelector('text=Готов обсудить задачу.');
 console.log('started');
 await page.fill('#userInput', 'Нужен гидробур на CASE 260.');
 await page.click('#sendBtn');
 await page.waitForFunction(() => Array.from(document.querySelectorAll('#chatMessages .message')).some((n)=>String(n.textContent||'').includes('Ок.')), null, { timeout: 30000 });
 console.log('assistant ok');
 await page.waitForSelector('#mainDialogHistoryList .dialog-history-item');
 await page.waitForFunction(() => /диалог/i.test(String(document.getElementById('mainDialogHistoryScopeMeta')?.textContent || '')));
 await page.waitForFunction(() => /гидробур|case/i.test(String(document.querySelector('#mainDialogHistoryList .dialog-history-item-title')?.textContent || '')));
 console.log('history row visible');
 const firstHistoryItem = page.locator('#mainDialogHistoryList .dialog-history-item').first();
 await firstHistoryItem.hover();
 await firstHistoryItem.locator('.dialog-history-item-menu-toggle').click();
 const renameDialogPromise = page.waitForEvent('dialog');
 await page.locator('.dialog-history-item-menu-action', { hasText: 'Переименовать' }).click();
 const renameDialog = await renameDialogPromise;
 console.log('dialog type', renameDialog.type(), 'msg', renameDialog.message());
 await renameDialog.accept('Мой тестовый диалог');
 await page.waitForFunction(() => String(document.querySelector('#mainDialogHistoryList .dialog-history-item-title')?.textContent || '').includes('Мой тестовый диалог'), null, { timeout: 30000 });
 console.log('renamed');
 await page.reload({ waitUntil:'domcontentloaded' });
 await page.waitForFunction(() => !document.getElementById('nameModal')?.classList.contains('active'));
 await page.waitForSelector('#mainDialogHistoryList .dialog-history-item');
 await page.waitForFunction(() => {
   const meta = document.getElementById('mainDialogHistoryScopeMeta');
   const listTitle = document.querySelector('#mainDialogHistoryList .dialog-history-item-title');
   return /диалог/i.test(String(meta?.textContent || '')) && String(listTitle?.textContent || '').includes('Мой тестовый диалог');
 }, null, { timeout: 30000 });
 console.log('reload ok');
} catch (error) {
 console.error('FAIL', error);
 try { await page.screenshot({ path: 'C:/projects/sites/client-simulator/output/playwright/debug-history-flow.png', fullPage:true, timeout:5000 }); } catch(e) { console.error('screenshot fail', e); }
} finally {
 await context.close();
 await browser.close();
 await new Promise(resolve => server.close(resolve));
}
