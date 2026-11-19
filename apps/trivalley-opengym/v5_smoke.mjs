import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = path.resolve(process.argv[2] || 'upstream/frontend/dist');
const screenshot = process.argv[3] || '/tmp/trivalley-browser.png';
const types = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json' };
let server;
let url = process.env.TV_LIVE_URL ? process.env.TV_LIVE_URL.replace(/\/?$/, '/') : '';
if (!url) {
server = http.createServer((req,res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const relative = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html';
  const filepath = path.resolve(root, relative);
  if (!(filepath === root || filepath.startsWith(root + path.sep)) || !fs.existsSync(filepath) || !fs.statSync(filepath).isFile()) {
    res.writeHead(404, {'Content-Type':'text/plain'});res.end('Not found');return;
  }
  res.writeHead(200, {'Content-Type':types[path.extname(filepath)] || 'application/octet-stream', 'Cache-Control':'no-store'});
  fs.createReadStream(filepath).pipe(res);
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
url = 'http://127.0.0.1:' + server.address().port + '/';
}
const chrome = [process.env.CHROME_PATH,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].find(p => p && fs.existsSync(p));
if (!chrome) throw new Error('No Chrome/Chromium executable available for actual-browser QA');
const assert = (value, reason) => { if (!value) throw new Error(reason) };
let browser;
let page, errors = [];
try {
  browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  page = await browser.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-testid="tv-progress-summary"]');
  assert(await page.$eval('[data-testid="tv-summary-sessions"]', n => n.textContent === '0'), 'First use fabricated activity');
  assert(!await page.$('[data-testid="tv-session-brief"]'), 'First use fabricated a scheduled routine');
  assert(await page.evaluate(() => document.documentElement.dataset.tvStyle === 'premium'), 'Premium appearance not applied');

  // Synthetic records exist only in this isolated browser profile, never in a real client.
  await page.evaluate(() => {
    const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const today = new Date(), yesterday = new Date(); yesterday.setDate(today.getDate()-1);
    const cfg = { id: '0001', sets: 3, reps: 10, weight: 0, mode: 'reps' };
    const record = (id, d, reps) => ({ id, d: iso(d), unit: 'lb', name: 'Synthetic acceptance session', start: +d - 600000, end: +d, entries: [{ id: cfg.id, target: cfg, sets: Array.from({ length: 3 }, () => ({ w: 0, r: reps, done: true })) }] });
    localStorage.setItem('gym_state_v1', JSON.stringify({ unit: 'lb', theme: 'dark', routines: [{ id: 'qa', name: 'Acceptance Strength', ex: [cfg] }], week: { [today.getDay()]: 'qa' }, workouts: [record('qa1', yesterday, 8), record('qa2', today, 10)], _ts: Date.now() }));
    localStorage.setItem('tv_daily_verse_enabled_v1', 'false');
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-testid="tv-session-brief"]');
  await page.click('[data-testid="tv-session-brief"] summary');
  assert(await page.$eval('[data-testid="tv-next-target"]', n => n.textContent.includes('11 reps')), 'Guide disagrees with bodyweight progression');
  assert(await page.$eval('[data-testid="tv-summary-sessions"]', n => n.textContent === '2'), 'Completed-session summary incorrect');
  assert(await page.$eval('[data-testid="tv-summary-sets"]', n => n.textContent === '6'), 'Completed-set summary incorrect');
  assert(await page.$eval('[data-testid="tv-session-brief"]', n => n.textContent.includes('Previous') && n.textContent.includes('10 reps')), 'Previous logged target missing');
  for (const width of [320, 390, 430]) {
    await page.setViewport({ width, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'Horizontal overflow at ' + width);
  }
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.screenshot({ path: screenshot, fullPage: true });

  await page.evaluate(() => { location.hash = '#/settings' });
  await page.waitForSelector('[data-testid="tv-backup-panel"]');
  await page.$eval('[data-testid="tv-backup-panel"] .primary', b => b.click());
  await page.waitForFunction(() => !!JSON.parse(localStorage.getItem('tv_backup_status_v1') || '{}').prepared);
  assert(await page.evaluate(() => !JSON.parse(localStorage.getItem('tv_backup_status_v1')).confirmed), 'Download was falsely called a saved backup');
  await page.$eval('[data-testid="tv-backup-panel"] .tv-backup-confirm button', b => b.click());
  await page.waitForFunction(() => !!JSON.parse(localStorage.getItem('tv_backup_status_v1') || '{}').confirmed);
  assert(await page.$eval('[data-testid="tv-backup-panel"]', n => n.textContent.includes('Backup confirmed by you')), 'Explicit backup confirmation not shown');

  // Deny only workout-state writes after boot: the edit must stay in memory with a warning.
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'gym_state_v1') throw new DOMException('Synthetic quota denial', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Light').click());
  await page.waitForFunction(() => document.querySelector('[data-testid="tv-device-status"]')?.textContent.includes('Changes are not saved'));
  assert(await page.evaluate(() => document.documentElement.dataset.theme === 'light'), 'Denied edit lost from in-memory state');
  assert(await page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')).theme === 'dark'), 'Quota fixture unexpectedly persisted');
  assert(await page.$('[role="alert"]'), 'Failed save warning is not announced');
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Classic').click());
  await page.waitForFunction(() => document.documentElement.dataset.tvStyle === 'classic');
  assert(await page.$('.swatches'), 'Classic accent controls missing');
  await page.evaluate(() => { Storage.prototype.setItem = function() { throw new DOMException('Synthetic full storage', 'QuotaExceededError') } });
  await page.$eval('[data-testid="tv-backup-panel"] .primary', b => b.click());
  await page.waitForFunction(() => document.body.innerText.includes('Backup file ready — save it now. Reminder status could not be stored.'));
  assert(!errors.length, 'Browser errors: ' + errors.join('; '));
  console.log(JSON.stringify({ status: 'V5_BROWSER_PASS', checks: ['empty-state honesty', 'existing progression', 'previous logged sets', 'completed-record summaries', '320-430px reflow', 'prepared versus confirmed backup', 'quota-failure warning and in-memory edit', 'export available when all storage writes fail', 'premium/light/classic appearance'], physicalIPhoneAcceptance: 'PENDING' }));
} catch (error) {
  if (page) {
    console.error(JSON.stringify({ errors, page: await page.evaluate(() => document.body.innerText.slice(0, 5000)).catch(() => 'unavailable') }));
    await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
  }
  throw error;
} finally {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
