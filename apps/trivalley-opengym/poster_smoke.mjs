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
  await page.evaluate(() => {
    const today = new Date(), day = today.getDay();
    const ex = [
      {id:'0001',sets:2,reps:10,weight:20,mode:'reps',sg:'a'},
      {id:'0002',sets:2,sec:3,weight:0,mode:'time',sg:'a'},
      {id:'0003',sets:2,reps:8,weight:15,mode:'reps'}
    ];
    localStorage.setItem('gym_state_v1',JSON.stringify({unit:'lb',theme:'dark',sound:false,restSec:90,routines:[{id:'qa-poster',name:'Poster Acceptance',ex}],week:{[day]:'qa-poster'},workouts:[],tvWorkoutView:'poster',_ts:Date.now()}));
    localStorage.setItem('tv_daily_verse_enabled_v1','false');
  });
  await page.reload({waitUntil:'networkidle0'});
  await page.waitForSelector('[data-testid="tv-session-brief"]');
  await page.$eval('[data-testid="tv-session-brief"] .tv-text-action', b => b.click());
  await page.waitForSelector('[data-testid="tv-poster-preview"]');
  assert(await page.$$eval('[data-testid="tv-poster-movement"]', cards => cards.length === 3),'Preview omitted routine exercises');
  assert(await page.evaluate(() => !JSON.parse(localStorage.getItem('gym_state_v1')).active),'Preview started a session prematurely');
  await page.click('[data-testid="tv-poster-start"]');
  await page.waitForFunction(()=>document.body.innerText.includes('Start without weighing in'));
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Start without weighing in')).click());
  await page.waitForSelector('[data-testid="tv-poster-active"]');
  const id=await page.evaluate(()=>JSON.parse(localStorage.getItem('gym_state_v1')).active.id);
  assert(await page.$eval('[data-testid="tv-started-at"]',n=>n.textContent!=='Not recorded'),'Start timestamp missing');
  assert(await page.$eval('[data-testid="tv-finished-at"]',n=>n.textContent==='In progress'),'Unfinished session has invented end time');
  // Log an exercise outside current focus. Rest must use that exercise, not a different superset.
  await page.$$eval('[data-testid="tv-poster-movement"]',cards=>cards[2].querySelector('[data-testid="tv-poster-set"]').click());
  await page.waitForSelector('#timer.rest');
  assert(await page.evaluate(()=>JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[2].sets[0].done),'Poster logged the wrong exercise');
  assert(await page.evaluate(()=>!JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0].sets[0].done),'Poster altered a different exercise');
  await page.$$eval('[data-testid="tv-poster-movement"]',cards=>cards[1].querySelector('.tv-poster-hold').click());
  await page.waitForSelector('#timer.working');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[1].sets[0].done,{timeout:12000});
  assert(await page.evaluate(()=>JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[1].sets[0].sec===3),'Timed hold did not log its elapsed seconds');
  await page.type('.tv-poster-notes textarea','Synthetic poster acceptance note');
  for(const width of [320,390,768,1280]) {
    await page.setViewport({width,height:844,deviceScaleFactor:1,isMobile:width<650,hasTouch:width<650});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Poster overflows at '+width);
  }
  await page.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await page.screenshot({path:screenshot,fullPage:true});
  const axeSource=fs.readFileSync(new URL('./node_modules/axe-core/axe.min.js',import.meta.url),'utf8');
  await page.addScriptTag({content:axeSource});
  const a11y=await page.evaluate(async()=>{
    const r=await axe.run('[data-testid="tv-poster-active"]',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});
    return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length}));
  });
  assert(!a11y.length,'Poster accessibility findings: '+JSON.stringify(a11y));
  await page.reload({waitUntil:'networkidle0'});
  await page.waitForSelector('[data-testid="tv-poster-active"]');
  assert(await page.evaluate(expected=>JSON.parse(localStorage.getItem('gym_state_v1')).active.id===expected,id),'Reload replaced the session');
  assert(await page.$eval('.tv-poster-notes textarea',n=>n.value==='Synthetic poster acceptance note'),'Session notes did not survive reload');
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='One exercise').click());
  await page.waitForSelector('.setrow');
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='All exercises').click());
  await page.waitForSelector('[data-testid="tv-poster-active"]');
  await page.click('button[aria-label="Finish"]');
  await page.waitForFunction(()=>document.body.innerText.includes('Finish early?'));
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Finish workout').click());
  await page.waitForFunction(()=>!JSON.parse(localStorage.getItem('gym_state_v1')).active);
  const record=await page.evaluate(()=>JSON.parse(localStorage.getItem('gym_state_v1')).workouts);
  assert(record.length===1 && record[0].id===id,'Finished session was missing or duplicated');
  assert(record[0].end>=record[0].start && record[0].note==='Synthetic poster acceptance note','Finish time or notes were lost');
  assert(record[0].entries.length===2,'Unperformed exercises were credited');
  assert(await page.$eval('[data-testid="tv-finished-at"]',n=>!['Not recorded','In progress'].includes(n.textContent)),'Finish summary did not show recorded finish time');
  assert(!errors.length,'Browser errors: '+errors.join('; '));
  console.log(JSON.stringify({status:'POSTER_BROWSER_PASS',checks:['preview without starting','live start time','all planned targets','correct exercise/superset set logging','rest controls','timed-set countdown','local notes and reload','320-1280px reflow','poster automated accessibility','focus-view compatibility','exactly one finished record with timestamps and performed sets'],physicalIPhoneAcceptance:'PENDING'}));
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
