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
let browser,page; const errors=[];
try {
 browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 page=await browser.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
 const clickText=async text=>{await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===text),{},text);const buttons=await page.$$('button');for(const b of buttons)if(await b.evaluate(n=>n.textContent.trim())===text){await b.click();return}throw Error('Missing '+text)};
 const geometry=async label=>{
  await page.waitForFunction(()=>{const a=document.querySelector('#app')?.getBoundingClientRect(),d=document.querySelector('[data-testid="tv-training-dock"]')?.getBoundingClientRect();return a&&d&&a.height>100&&a.bottom<=d.top-6});
  const g=await page.evaluate(()=>{const a=document.querySelector('#app').getBoundingClientRect(),d=document.querySelector('[data-testid="tv-training-dock"]').getBoundingClientRect(),n=document.querySelector('#tabbar').getBoundingClientRect(),t=document.querySelector('#timer')?.getBoundingClientRect();return {a:a.toJSON(),d:d.toJSON(),n:n.toJSON(),t:t?.toJSON(),h:innerHeight,w:innerWidth,host:document.documentElement.dataset.tvFreeHosted}});
  assert(g.a.bottom<=g.d.top-6,label+': content overlaps dock');
  assert(g.d.bottom<=g.h-(g.host==='1'?76:0)+2,label+': dock overlaps host chrome');
  if(g.t)assert(g.t.bottom<=g.n.top-6,label+': timer overlaps navigation');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),label+': horizontal overflow');
 };
 const reachable=async selector=>{
  await page.waitForSelector(selector,{visible:true});
  await page.$eval(selector,n=>{n.focus();n.scrollIntoView({block:'nearest',inline:'nearest'})});
  await page.waitForFunction(selector=>{const n=document.querySelector(selector),r=n?.getBoundingClientRect(),a=document.querySelector('#app').getBoundingClientRect();if(!r||r.top<a.top||r.bottom>a.bottom)return false;return [r.top+3,r.top+r.height/2,r.bottom-3].every(y=>n.contains(document.elementFromPoint(r.x+r.width/2,y)))},{timeout:10000},selector);
 };
 await page.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});await page.goto(url+'#/home',{waitUntil:'networkidle0'});
 await geometry('first visit');
 await page.click('[data-testid="tv-start-primary"]');await page.waitForSelector('[data-testid="tv-ready-programs"]');
 assert(!await page.$('[role="dialog"]')&&!await page.evaluate(()=>JSON.parse(localStorage.getItem('gym_state_v1')||'{}').active),'Choose workout started an empty session');
 assert(await page.$$eval('[data-testid="tv-open-setup"]',n=>n.length===1),'More than one setup entry');
 assert(!await page.$('[data-testid="tv-program-schedule"]')&&!await page.$('[data-testid="tv-add-program"]'),'Legacy competing setup remains');
 await page.click('[data-testid="tv-open-setup"]');await page.waitForSelector('#tv-setup-schedule');
 assert(!await page.$('[data-testid="tv-program-launchers"]')&&!await page.$('.tv-calendar-tools'),'Setup mixed with workout/calendar tools');
 await page.select('#tv-setup-schedule','none');const original=await page.evaluate(()=>localStorage.getItem('gym_state_v1'));
 await clickText('Review my setup');await page.waitForSelector('[data-testid="tv-setup-review"]');
 assert(await page.evaluate(()=>localStorage.getItem('gym_state_v1'))===original,'Setup review changed saved data');
 await clickText('Back to choices');await clickText('Close setup');await page.waitForSelector('[data-testid="tv-open-setup"]');
 assert(await page.evaluate(()=>localStorage.getItem('gym_state_v1'))===original,'Cancelling setup changed data');
 await page.click('[data-testid="tv-open-setup"]');await page.waitForSelector('#tv-setup-schedule');await page.select('#tv-setup-schedule','none');await clickText('Review my setup');await page.waitForSelector('[data-testid="tv-setup-review"]');await clickText('Confirm program and training days');await page.waitForSelector('[data-testid="tv-program-next-name"]');
 assert(!await page.$('[data-testid="tv-get-started"]'),'Confirmed user still sees onboarding');
 await page.click('#tabbar button:nth-child(3)');await page.waitForFunction(()=>location.hash==='#/workout');await page.waitForFunction(()=>document.querySelector('h1')?.textContent==='Start workout');
 assert(!await page.$('[role="dialog"]')&&!await page.evaluate(()=>JSON.parse(localStorage.getItem('gym_state_v1')).active),'Navigation unexpectedly started a workout');
 await page.click('#tabbar button:nth-child(2)');await page.waitForSelector('[data-testid="tv-preview-program-0"]');await page.click('[data-testid="tv-preview-program-0"]');await page.waitForSelector('[data-testid="tv-poster-preview"]');
 assert(!await page.$('.tv-calendar-tools'),'Workout preview contains unrelated calendar tools');
 await reachable('[data-testid="tv-poster-start"]');await page.click('[data-testid="tv-poster-start"]');await page.waitForSelector('#tv-bodyweight-value');await clickText('Start without weighing in');await page.waitForSelector('[data-testid="tv-inline-set-fields"] input');
 const field='[data-testid="tv-inline-set-fields"] input';await reachable(field);await page.click(field,{clickCount:3});await page.keyboard.press('Backspace');await page.type(field,'25');await page.keyboard.press('Tab');await page.click('[data-testid="tv-poster-set"]');await page.waitForSelector('#timer.rest');
 for(const [width,height] of [[320,667],[390,844],[430,932],[1280,900]]) {
  await page.setViewport({width,height,deviceScaleFactor:1,isMobile:width<600,hasTouch:width<600});
  if(!process.env.TV_LIVE_URL)await page.evaluate(()=>{document.documentElement.dataset.tvFreeHosted='1';if(!document.getElementById('qa-hosted-banner')){const n=document.createElement('div');n.id='qa-hosted-banner';n.textContent='Hosted banner fixture';n.style.cssText='position:fixed;bottom:0;right:0;height:64px;width:230px;background:white;color:black;z-index:2147483647';document.body.append(n)}});
  await geometry('active '+width+'x'+height);
  for(const fraction of [0,.3,.7,1]) {await page.$eval('#app',(n,f)=>n.scrollTo(0,(n.scrollHeight-n.clientHeight)*f),fraction);await geometry('scroll '+width+' '+fraction)}
  await reachable(field);await reachable('[data-testid="tv-poster-set"]');
  for(const route of ['plan','library','settings']){await page.evaluate(route=>{location.hash='#/'+route},route);await page.waitForFunction(route=>location.hash==='#/'+route,{},route);await page.waitForSelector('#app');await geometry(route+' '+width)}
  await page.evaluate(()=>{location.hash='#/workout'});await page.waitForSelector('[data-testid="tv-poster-active"]');
 }
 await page.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});await geometry('final active');await reachable(field);await page.screenshot({path:screenshot,fullPage:false});
 const active=await page.evaluate(()=>JSON.parse(localStorage.getItem('gym_state_v1')).active);assert(active.entries[0].sets[0].w===25&&active.entries[0].sets[0].done,'Navigation changed logged values');
 await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gym_state_v1'));s.active=null;s.tvSetupDone=false;s.workouts=[{id:'returning',d:'2026-11-19',entries:[{id:'2330',sets:[{w:25,r:10}]}]}];localStorage.setItem('gym_state_v1',JSON.stringify(s))});await page.goto(url+'#/home',{waitUntil:'networkidle0'});await page.reload({waitUntil:'networkidle0'});assert(!await page.$('[data-testid="tv-get-started"]'),'Returning trainee sees first-use onboarding');
 assert(!errors.length,errors.join('; '));console.log(JSON.stringify({status:'NAVIGATION_LAYOUT_BROWSER_PASS',checks:['one reviewed setup route','new-user choice does not create Freestyle','read-only review and cancellation','focused setup and preview pages','returning-user guidance','Train is navigation, not a hidden start','reserved content and timer/navigation regions','320x667 through 1280x900','free-host banner clearance','scroll boundaries at four positions','native nearest-scroll and focus reach actual set fields','logged data preserved'],physicalIPhoneAcceptance:'PENDING'}));
}catch(e){console.error(JSON.stringify({error:e.message,page:page?await page.evaluate(()=>document.body.innerText.slice(0,5500)).catch(()=>null):null}));if(page)await page.screenshot({path:screenshot,fullPage:false}).catch(()=>{});throw e}
finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve))}
