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
  browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await page.goto(url+'#/home',{waitUntil:'networkidle0'});
  await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gym_state_v1')||'{}');s.routines=[{id:'keep',name:'My existing workout',emoji:'dumbbell',ex:[]}];s.week={0:'keep',1:'keep'};s.unit='lb';s.workouts=[];s.bodyweight=[];s.exWeights={};s.targetW=null;s.active=null;s.tvSetupDone=false;localStorage.setItem('gym_state_v1',JSON.stringify(s))});
  await page.reload({waitUntil:'networkidle0'});
  const clickText=async text=>{
    await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(n=>n.textContent.trim()===text),{timeout:10000},text);
    const buttons=await page.$$('button');
    for(const button of buttons){
      if((await button.evaluate(n=>n.textContent.trim()))!==text)continue;
      await button.evaluate(n=>n.scrollIntoView({block:'center',inline:'nearest'}));
      await page.waitForFunction(text=>{const b=[...document.querySelectorAll('button')].find(n=>n.textContent.trim()===text);const r=b?.getBoundingClientRect();if(!r)return false;const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===b||b.contains(hit)},{timeout:10000},text);
      await button.click();return;
    }
    throw new Error('Missing button '+text);
  };
  assert(!await page.$('[data-testid="tv-device-status"]'),'Healthy storage details clutter the client home screen');
  assert(!await page.evaluate(()=>[...document.querySelectorAll('a')].some(a=>a.href.startsWith('https://manage.wix.com/'))),'Owner management URL exposed in client links');
  await page.click('[data-testid="tv-client-more"] summary');
  await page.waitForSelector('.tv-client-more-panel a[aria-label*="corresponding source"]',{visible:true});
  await page.keyboard.press('Escape');
  assert(await page.$eval('[data-testid="tv-client-more"]',n=>!n.open&&n.querySelector('summary')===document.activeElement),'More does not close and restore focus on Escape');
  await page.click('[data-testid="tv-client-more"] summary');await clickText('Settings & backups');
  await page.waitForSelector('[data-testid="tv-device-status"]');
  await clickText('Today');

  await page.waitForSelector('[data-testid="tv-get-started"] summary',{visible:true});
  await page.click('[data-testid="tv-get-started"] summary');
  await clickText('Set up my training');await page.waitForSelector('#tv-setup-schedule');
  await page.click('[data-testid="tv-unit-options"] summary');
  await page.select('#tv-setup-unit','kg');await page.select('#tv-setup-schedule','mwf');
  const before=await page.evaluate(()=>localStorage.getItem('gym_state_v1'));
  await clickText('Review my setup');await page.waitForSelector('[data-testid="tv-setup-review"]');
  await page.waitForFunction(()=>document.activeElement?.textContent==='Review your changes');
  assert(await page.evaluate(()=>localStorage.getItem('gym_state_v1'))===before,'Review mutated the plan before confirmation');
  assert((await page.$eval('[data-testid="tv-setup-review"]',n=>n.textContent)).includes('My existing workout'),'Review hid an existing calendar replacement');
  await clickText('Back to choices');assert(await page.evaluate(()=>localStorage.getItem('gym_state_v1'))===before,'Back changed saved data');
  await clickText('Review my setup');await clickText('Confirm program and training days');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('gym_state_v1')).tvSetupDone===true);
  let s=await page.evaluate(()=>JSON.parse(localStorage.getItem('gym_state_v1')));
  assert(s.unit==='kg'&&s.routines.length===4&&s.week[0]==='keep','Setup changed unrelated records or lost the chosen unit');
  assert([1,3,5].every((d,i)=>s.week[d]===s.routines[i+1].id),'Program is not connected to chosen weekdays');
  await page.waitForSelector('.tv-program-schedule-note');
  await page.goto(url+'#/plan?setup=1',{waitUntil:'networkidle0'});await page.select('#tv-setup-schedule','tts');await clickText('Review my setup');await clickText('Confirm program and training days');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('gym_state_v1')).tvProgramSchedule==='tts');
  s=await page.evaluate(()=>JSON.parse(localStorage.getItem('gym_state_v1')));
  assert([1,3,5].every(d=>!s.week[d])&&s.week[0]==='keep'&&s.routines.length===4,'Moving days duplicated the split or removed an unrelated day');
  await page.goto(url+'#/settings',{waitUntil:'networkidle0'});await page.click('[data-testid="tv-app-help"] summary');
  const help=await page.$eval('[data-testid="tv-app-help"]',n=>n.innerText);
  assert(help.includes('Safari')&&help.includes('Add to Home Screen')&&help.includes('I saved this backup')&&help.includes('separate storage'),'Installation/backup guidance incomplete');
  for(const width of [320,390,430]){await page.setViewport({width,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Help overflow at '+width)}
  await page.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});await page.screenshot({path:screenshot,fullPage:true});
  await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gym_state_v1'));s.bodyweight=[{d:'2026-11-19',w:90}];localStorage.setItem('gym_state_v1',JSON.stringify(s))});
  await page.goto(url+'#/plan?setup=1',{waitUntil:'networkidle0'});await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('#tv-setup-unit');assert(await page.$eval('#tv-setup-unit',n=>n.disabled),'Setup bypassed the weight-unit lock');
  assert(!errors.length,'Browser errors: '+errors.join('; '));
  console.log(JSON.stringify({status:'GUIDED_SETUP_BROWSER_PASS',checks:['quiet client header','source and scripture under More','Escape focus return','healthy storage details limited to Settings','no owner management URLs','actual button hit testing','review heading focus','read-only review','Back preserves saved data','explicit replacement confirmation','chosen weight unit','program-calendar assignments','unrelated day preserved','moving split clears old days','no duplicate routines','calendar-sequence explanation','installation and backup help','320-430px guidance','existing-weight unit lock']}));
} catch(error) {
  console.error(JSON.stringify({errors,page:page?await page.evaluate(()=>document.body.innerText.slice(0,4500)).catch(()=>null):null}));
  if(page)await page.screenshot({path:screenshot,fullPage:true}).catch(()=>{});throw error;
} finally {
  if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));
}
