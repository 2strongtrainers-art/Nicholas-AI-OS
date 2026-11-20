import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = path.resolve(process.argv[2] || 'upstream/frontend/dist');
const screenshot = process.argv[3] || '/tmp/trivalley-browser.png';
const types = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.webmanifest':'application/manifest+json' };
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
const assert=(value,why)=>{if(!value)throw new Error(why)};
let browser,page;const errors=[];
try {
  browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  const tap=async selector=>{
    await page.waitForSelector(selector,{visible:true});
    await page.$eval(selector,n=>n.scrollIntoView({block:'center'}));
    await page.waitForFunction(selector=>{const n=document.querySelector(selector),r=n?.getBoundingClientRect();return !!r&&n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))},{timeout:10000},selector);
    await page.click(selector);
  };
  const unobscured=selector=>page.$eval(selector,n=>{
    const r=n.getBoundingClientRect();
    return r.top>=0&&r.bottom<=innerHeight&&[r.top+5,r.top+r.height/2,r.bottom-5].every(y=>n.contains(document.elementFromPoint(r.x+r.width/2,y)));
  });
  const settled=()=>page.waitForFunction(()=>{
    const app=document.getElementById('app'),toast=document.getElementById('toast');
    return (!app||getComputedStyle(app).opacity==='1')&&(!toast||getComputedStyle(toast).opacity==='0');
  });
  const violations=report=>report.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary,html:n.html}))}));
  const installFlexible = async () => {
    await page.waitForSelector('[data-testid="tv-open-setup"]');
    await page.click('[data-testid="tv-open-setup"]');
    await page.waitForSelector('#tv-setup-schedule');
    await page.select('#tv-setup-schedule','none');
    await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Review my setup').click());
    await page.waitForSelector('[data-testid="tv-setup-review"]');
    await page.click('[data-testid="tv-setup-review"] button.primary');
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('gym_state_v1')||'{}').tvSetupDone===true);
    await page.goto(url+'#/plan',{waitUntil:'networkidle0'});
    await page.waitForSelector('[data-testid="tv-program-launchers"]');
  };
  await page.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await page.goto(url+'#/plan',{waitUntil:'networkidle0'});
  await page.waitForSelector('[data-testid="tv-ready-programs"]');
  assert(await unobscured('[data-testid="tv-open-setup"]'),'Program Add is hidden by floating navigation before any long preview');
  assert(await page.$$eval('[data-testid="tv-program-cover-card"]',n=>n.length===3),'Missing cover cards');
  for(let i=0;i<3;i++){
    const selector=`[data-testid="tv-program-cover-card"]:nth-child(${i+1}) .tv-program-art-photo`;
    await page.$eval(selector,n=>n.scrollIntoView({block:'center'}));
    await page.waitForFunction(selector=>{const n=document.querySelector(selector);return n.complete&&n.naturalWidth===1200},{timeout:10000},selector);
  }
  assert(await page.evaluate(()=>document.querySelector('[data-testid="tv-program-launchers"]').compareDocumentPosition(document.querySelector('[data-testid="tv-program-preview"]'))&Node.DOCUMENT_POSITION_FOLLOWING),'Start controls are after the long exercise preview');
  await page.evaluate(()=>{localStorage.setItem('tv_daily_verse_enabled_v1','false')});
  await installFlexible();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('gym_state_v1')||'{}').routines?.length===3);
  await page.screenshot({path:screenshot,fullPage:true});
  await page.evaluate(()=>{location.hash='#/home'});
  await page.waitForFunction(()=>document.querySelector('[data-testid="tv-program-next-name"]')?.textContent==='Back & Biceps');
  for(const [width,height] of [[320,667],[390,844],[430,932]]){
    await page.setViewport({width,height,deviceScaleFactor:2,isMobile:true,hasTouch:true});
    await page.evaluate(()=>document.getElementById('app').scrollTo(0,0));
    assert(await unobscured('[data-testid="tv-start-primary"]'),'Continue action is obscured at '+width+'x'+height);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Home overflows at '+width);
  }
  await page.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await settled();
  await page.screenshot({path:screenshot.replace(/\.png$/,'-home.png'),fullPage:true});
  const axeSource=fs.readFileSync(new URL('./node_modules/axe-core/axe.min.js',import.meta.url),'utf8');
  await page.addScriptTag({content:axeSource});
  let report=await page.evaluate(async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));
  assert(!report.violations.length,'Program Home accessibility: '+JSON.stringify(violations(report)));
  await tap('[data-testid="tv-start-primary"]');
  await page.waitForFunction(()=>document.body.innerText.includes('Start without weighing in'));
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Start without weighing in')).click());
  await page.waitForSelector('[data-testid="tv-poster-active"]');
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('gym_state_v1')).active);
  assert(before.tvTemplate?.day==='back-biceps','Active session lacks its durable template tag');
  await page.evaluate(()=>{location.hash='#/home'});
  await page.waitForFunction(()=>document.querySelector('[data-testid="tv-start-primary"]')?.textContent==='Resume workout');
  await tap('[data-testid="tv-start-primary"]');
  await page.waitForSelector('[data-testid="tv-poster-active"]');
  assert(await page.evaluate(id=>JSON.parse(localStorage.getItem('gym_state_v1')).active.id===id,before.id),'Resume replaced an active session');
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='One exercise').click());
  await page.waitForSelector('.setrow .w input');
  await page.click('.setrow .w input',{clickCount:3});await page.keyboard.press('Backspace');await page.type('.setrow .w input','25');await page.keyboard.press('Tab');
  await page.$eval('.setrow [role="checkbox"]',b=>b.click());
  await page.click('button[aria-label="Finish"]');
  await page.waitForFunction(()=>document.body.innerText.includes('Finish early?'));
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Save partial workout').click());
  await page.waitForFunction(()=>!JSON.parse(localStorage.getItem('gym_state_v1')).active);
  const finished=await page.evaluate(()=>JSON.parse(localStorage.getItem('gym_state_v1')).workouts[0]);
  assert(finished.tvTemplate?.day==='back-biceps','Finished record lost its template tag');
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Nice!').click());
  await page.waitForFunction(()=>document.querySelector('[data-testid="tv-program-next-name"]')?.textContent==='Back & Biceps');
  await page.reload({waitUntil:'networkidle0'});
  await page.waitForFunction(()=>document.querySelector('[data-testid="tv-program-next-name"]')?.textContent==='Back & Biceps');
  assert(await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('gym_state_v1')).week).length===0),'Rotation overwrote the calendar');
  await page.evaluate(()=>{location.hash='#/plan'});await page.waitForSelector('[data-testid="tv-program-cover-card"]');
  await settled();
  await page.addScriptTag({content:axeSource});
  report=await page.evaluate(async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));
  assert(!report.violations.length,'Program cards accessibility: '+JSON.stringify(violations(report)));
  await page.evaluate(async()=>{await navigator.serviceWorker.ready});
  await page.waitForFunction(async()=>{
    const keys=await caches.keys();
    for(const key of keys.filter(k=>k.startsWith('trivalley-open-gym-'))){
      const c=await caches.open(key);
      if((await Promise.all(['2330','0314','1459'].map(k=>c.match(new URL('./assets/tv-movement-'+k+'-20261119-v2.webp',location.href.split('#')[0]).href)))).every(Boolean))return true;
    }
    return false;
  });
  await page.setOfflineMode(true);await page.reload({waitUntil:'networkidle0'});
  await page.waitForSelector('[data-testid="tv-program-cover-card"]');
  for(let i=0;i<3;i++){
    const selector=`[data-testid="tv-program-cover-card"]:nth-child(${i+1}) .tv-program-art-photo`;
    await page.$eval(selector,n=>n.scrollIntoView({block:'center'}));
    await page.waitForFunction(selector=>{const n=document.querySelector(selector);return n.complete&&n.naturalWidth===1200},{timeout:10000},selector);
  }
  assert(!errors.length,'Browser errors: '+errors.join('; '));
  console.log(JSON.stringify({status:'PROGRAM_VISUALS_BROWSER_PASS',checks:['three approved cover images','Add and Start before long previews','320x667 to 430x932 unobscured Continue','program accessibility','actual Start and guarded Resume','durable template tags','partial finish retains its program day','reload keeps sequence','calendar stays user-controlled','offline covers and program state'],physicalIPhoneAcceptance:'PENDING'}));
}catch(error){
  console.error(JSON.stringify({errors,page:page?await page.evaluate(()=>document.body.innerText.slice(0,5000)).catch(()=>null):null}));
  if(page)await page.screenshot({path:screenshot,fullPage:true}).catch(()=>{});
  throw error;
}finally{
  if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));
}
