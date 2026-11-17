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
let browser;
const findings = [];
try {
  browser = await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page = await browser.newPage();
  await page.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  let intentionalOffline = false;
  page.on('pageerror',e => findings.push('PAGEERROR: '+e.message));
  page.on('console',m => {
    if(m.type()==='error' && !(intentionalOffline && m.text().includes('ERR_INTERNET_DISCONNECTED'))) findings.push('CONSOLE: '+m.text());
  });
  const response = await page.goto(url,{waitUntil:'networkidle0',timeout:25000});
  if (process.env.TV_EXPECTED_JS) {
    const script = await page.evaluate(() => [...document.scripts].find(s => s.src.includes('/assets/index-'))?.src || '');
    if (!script.includes(process.env.TV_EXPECTED_JS)) throw new Error('Live host is not serving the expected release: ' + script);
  }
  if (response.status() !== 200) throw new Error('App HTTP '+response.status());
  await page.waitForFunction(() => document.querySelector('h1')?.textContent?.includes('TriValley FIT'),{timeout:18000});
  const initial = await page.evaluate(() => ({title:document.title, text:document.body.innerText.slice(0,1800), unit:JSON.parse(localStorage.getItem('gym_state_v1')||'{}').unit}));
  await page.screenshot({path:screenshot,fullPage:true});
  if (!initial.text.includes('Ready to train?')) throw new Error('First-use onboarding missing: '+initial.text.slice(0,450));
  if (!initial.text.includes('Start a workout now')) throw new Error('No immediate workout action in onboarding');
  if (initial.text.includes('Let the Coach build it')) throw new Error('Fake AI Coach visible');
  if (initial.unit && initial.unit !== 'lb') throw new Error('US-first weight unit default missing');

  const clicked = await page.evaluate(() => {
    const button=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Load starter plan'));
    if(!button)return false;button.click();return true;
  });
  if(!clicked)throw new Error('Starter plan button missing');
  await page.waitForFunction(() => {
    const s=JSON.parse(localStorage.getItem('gym_state_v1')||'{}');
    return Array.isArray(s.routines) && s.routines.length===3 && Object.keys(s.week||{}).length>=3 && s.unit==='lb';
  },{timeout:10000});
  await page.reload({waitUntil:'networkidle0',timeout:20000});
  await page.waitForFunction(() => document.querySelector('h1')?.textContent?.includes('TriValley FIT'),{timeout:15000});
  const persisted=await page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')||'{}').routines?.length);
  if(persisted!==3)throw new Error('Starter plan was not persisted after reload');
  await page.evaluate(()=>{location.hash='#/workout'});
  await page.waitForFunction(()=>document.body.innerText.includes('Start workout'),{timeout:12000});
  const workout=await page.evaluate(()=>document.body.innerText);
  if(!workout.includes('Push Day'))throw new Error('Push Day not accessible in workout chooser');

  // Real workout acceptance: start a planned routine, mark a set, finish early, and confirm saved history.
  const selected=await page.evaluate(() => {
    const item=[...document.querySelectorAll('.item')].find(el=>el.textContent.includes('Push Day'));
    if(!item)return false;item.click();return true;
  });
  if(!selected)throw new Error('Cannot select Push Day from workout chooser');
  await page.waitForFunction(()=>document.body.innerText.includes('Quick check-in'),{timeout:10000});
  const skipped=await page.evaluate(() => {
    const b=[...document.querySelectorAll('button')].find(el=>el.textContent.includes('Start without weighing in'));
    if(!b)return false;b.click();return true;
  });
  if(!skipped)throw new Error('Cannot skip optional bodyweight check-in');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('gym_state_v1')||'{}').active?.entries?.length>=1,{timeout:10000});
  const setChecked=await page.evaluate(() => {
    const box=document.querySelector('.setrow [role="checkbox"]');
    if(!box)return false;box.click();return true;
  });
  if(!setChecked)throw new Error('Cannot find exercise set checkbox');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('gym_state_v1')||'{}').active?.entries?.[0]?.sets?.[0]?.done===true,{timeout:10000});
  await page.evaluate(() => document.querySelector('button[aria-label="Finish"]')?.click());
  await page.waitForFunction(()=>document.body.innerText.includes('Finish early?'),{timeout:10000});
  const confirmed=await page.evaluate(() => {
    const b=[...document.querySelectorAll('button')].find(el=>el.textContent.trim()==='Finish workout');
    if(!b)return false;b.click();return true;
  });
  if(!confirmed)throw new Error('Cannot confirm finishing workout');
  await page.waitForFunction(() => {
    const s=JSON.parse(localStorage.getItem('gym_state_v1')||'{}');
    return !s.active && s.workouts?.length===1 && s.workouts[0].entries?.some(e=>e.sets.some(x=>x.done));
  },{timeout:10000});
  await page.evaluate(() => {
    const b=[...document.querySelectorAll('button')].find(el=>el.textContent.trim()==='Nice!');
    b?.click();
  });
  const recorded=await page.evaluate(()=>JSON.parse(localStorage.getItem('gym_state_v1')||'{}').workouts?.length);
  if(recorded!==1)throw new Error('Workout not recorded after finish');

  await page.evaluate(()=>{location.hash='#/settings'});
  await page.waitForFunction(()=>document.querySelector('h1')?.textContent?.includes('Settings'),{timeout:12000});
  const settings=await page.evaluate(()=>document.body.innerText);
  if(!settings.includes('Local workout storage'))throw new Error('Settings incorrectly presents this as a demo');
  if(settings.includes('Reset demo data'))throw new Error('Destructive demo reset remains exposed');
  if(settings.includes('Meet the Coach'))throw new Error('Simulated AI coach remains visible');

  await page.evaluate(() => { location.hash = '#/library' });
  await page.waitForFunction(() => document.querySelector('h1')?.textContent?.includes('Exercises'), {timeout:12000});
  const catalogue = await page.evaluate(() => document.body.innerText);
  if (!catalogue.includes('step-by-step form notes')) throw new Error('Exercise library form guidance label missing');
  if (catalogue.includes('with animations') || catalogue.includes('no animation')) throw new Error('Exercise library still promises missing media');

  await page.waitForFunction(async () => { const r=await navigator.serviceWorker?.getRegistration(); return r?.active?.scriptURL?.endsWith('/tv-sw.js') },{timeout:25000});
  const worker = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return {supported:false};
    const ready=await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('SW not ready')),15000))]);
    return {supported:true,script:ready.active?.scriptURL,scope:ready.scope};
  });
  if(!worker.script?.endsWith('/tv-sw.js'))throw new Error('Incorrect service worker: '+JSON.stringify(worker));

  await page.goto(url,{waitUntil:'networkidle0',timeout:20000});
  intentionalOffline = true;
  await page.setOfflineMode(true);
  await page.reload({waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForFunction(()=>document.querySelector('h1')?.textContent?.includes('TriValley FIT'),{timeout:15000});
  const offline=await page.evaluate(()=>({text:document.body.innerText.slice(0,160),saved:JSON.parse(localStorage.getItem('gym_state_v1')||'{}').routines?.length}));
  if(offline.saved!==3)throw new Error('Offline reload lost workout plan');

  // A deliberately offline reload may log ERR_INTERNET_DISCONNECTED for a speculative
  // browser request even while our cached app renders correctly. It is not a UI failure.
  const unexpectedFindings = findings.filter(x => !x.includes('net::ERR_INTERNET_DISCONNECTED'));
  if (unexpectedFindings.length) throw new Error('Browser runtime errors: '+unexpectedFindings.slice(0,8).join(' | '));
  console.log(JSON.stringify({status:'BROWSER_SMOKE_PASS',initialTitle:initial.title,initialUnit:initial.unit,plans:3,workoutChooser:true,loggedSets:1,finishedWorkouts:1,settingsNoDemo:true,worker,offline,chrome,screenshot},null,2));
} finally {
  if(browser)await browser.close();
  if (server) await new Promise(resolve=>server.close(resolve));
}
