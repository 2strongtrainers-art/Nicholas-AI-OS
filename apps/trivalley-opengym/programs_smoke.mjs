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
let browser, page; const errors = [];
try {
  browser = await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  page = await browser.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await page.goto(url + '#/plan', {waitUntil:'networkidle0'});
  await page.waitForSelector('[data-testid="tv-ready-programs"]');
  await page.click('[data-testid="tv-program-preview"] summary');
  assert(await page.$$eval('.tv-program-day li', nodes => nodes.length === 16), 'Expected all 16 exercise prescriptions');
  for(const width of [320,390,430]) {
    await page.setViewport({width,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'Program preview overflow at '+width);
  }
  await page.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await page.evaluate(() => {
    const now=Date.now(), date=new Date(), day=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    const active={id:'qa-existing-active',d:day,start:now,name:'My active workout',cur:0,entries:[{id:'0001',target:{id:'0001',sets:1,reps:10},sets:[{w:0,r:10,done:false}]}]};
    localStorage.setItem('gym_state_v1',JSON.stringify({unit:'lb',routines:[{id:'qa-existing-routine',name:'My routine',ex:[]}],week:{1:'qa-existing-routine'},workouts:[],active,_ts:now}));
    localStorage.setItem('tv_daily_verse_enabled_v1','false');
  });
  await page.reload({waitUntil:'networkidle0'});
  await page.waitForSelector('[data-testid="tv-ready-programs"]');
  await page.select('[data-testid="tv-program-schedule"]','mwf');
  await page.click('[data-testid="tv-add-program"]');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('gym_state_v1')||'{}').routines?.length===4);
  const installed=await page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')));
  assert(installed.active.id==='qa-existing-active','Installation replaced an active workout');
  assert(installed.week[1]==='qa-existing-routine','Installation overwrote an occupied weekday');
  assert(installed.routines[0].name==='My routine' && installed.workouts.length===0,'Installation replaced existing data');
  assert(installed.week[3]===installed.routines[2].id && installed.week[5]===installed.routines[3].id,'Wrong split day assigned');
  assert(await page.$$eval('[data-testid^="tv-start-program-"]',buttons=>buttons.length===3 && buttons.every(b=>b.disabled)), 'Starting a new day could overwrite an active workout');
  await page.click('[data-testid="tv-add-program"]');
  assert(await page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')).routines.length===4),'Repeated add duplicated routines');
  await page.evaluate(() => {const S=JSON.parse(localStorage.getItem('gym_state_v1'));S.active=null;localStorage.setItem('gym_state_v1',JSON.stringify(S))});
  await page.reload({waitUntil:'networkidle0'});
  await page.waitForSelector('[data-testid="tv-program-launchers"]');
  await page.click('[data-testid="tv-program-preview"] summary');
  await page.screenshot({path:screenshot,fullPage:true});
  await page.click('[data-testid="tv-start-program-0"]');
  await page.waitForFunction(() => document.body.innerText.includes('Quick check-in'));
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b=>b.textContent.includes('Start without weighing in')).click());
  await page.waitForSelector('[data-testid="tv-poster-active"]');
  await page.$eval('[data-testid="tv-poster-set"]',b=>b.click());
  assert(await page.evaluate(() => !JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0].sets[0].done),'Poster allowed an unknown working load');
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b=>b.textContent==='Focus view').click());
  await page.waitForSelector('[data-testid="tv-working-load-note"]');
  assert(await page.$('[data-testid="tv-workout-prep"]'),'Warm-up guidance not available in the workout');
  await page.$eval('.setrow [role="checkbox"]',b=>b.click());
  assert(await page.evaluate(() => !JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0].sets[0].done),'Unknown zero load was logged as bodyweight');
  await page.click('.setrow .w input',{clickCount:3});
  await page.keyboard.press('Backspace'); await page.type('.setrow .w input','25'); await page.keyboard.press('Tab');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0].sets.every(s=>s.w===25));
  await page.$eval('.setrow [role="checkbox"]',b=>b.click());
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0].sets[0].done);
  await page.waitForSelector('#timer .t');
  const clock=await page.$eval('#timer .t',n=>n.textContent);
  assert(/^1:5\d$|^2:00$/.test(clock),'Exercise-specific 120-second rest not started: '+clock);
  assert(!errors.length,'Browser errors: '+errors.join('; '));
  console.log(JSON.stringify({status:'READY_PROGRAMS_BROWSER_PASS',checks:['16 catalogue-backed prescriptions','320-430px preview','append-only install','occupied schedule preservation','active-workout protection','duplicate prevention','direct program start','warm-up guidance','working-load required','first load fills untouched sets','exercise rest timer']}));
} catch(error) {
  console.error(JSON.stringify({errors,page:page?await page.evaluate(()=>document.body.innerText.slice(0,4500)).catch(()=>null):null}));
  if(page)await page.screenshot({path:screenshot,fullPage:true}).catch(()=>{});
  throw error;
} finally {
  if(browser)await browser.close();
  if(server)await new Promise(resolve=>server.close(resolve));
}
