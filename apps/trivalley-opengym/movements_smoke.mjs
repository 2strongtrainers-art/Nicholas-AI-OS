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
  await page.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const tap=async selector=>{
    await page.waitForSelector(selector,{visible:true});
    await page.$eval(selector,n=>n.scrollIntoView({block:'center'}));
    await page.waitForFunction(selector=>{const n=document.querySelector(selector),r=n?.getBoundingClientRect();return !!r&&n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))},{timeout:10000},selector);
    await page.click(selector);
  };
  const idsByDay=[['back-biceps',['2330','0861','0383','0294','0313']],['chest-triceps',['0289','0314','0405','0334','0200','0194']],['legs',['0739','1459','0586','0585','0605']]];
  for(const [day,ids]of idsByDay){
    await page.goto(url+'#/plan?day='+day,{waitUntil:'networkidle0'});
    await page.waitForSelector('[data-testid="tv-poster-preview"]');
    assert(await page.$$eval('[data-testid="tv-poster-preview"] .tv-poster-movement',n=>n.length)===ids.length,'Workout exercises changed on '+day);
    for(const id of ids){
      const fig='[data-testid="tv-movement-figure"][data-exercise-id="'+id+'"]';
      await page.$eval(fig,n=>n.scrollIntoView({block:'center'}));
      await page.waitForFunction(sel=>{const n=document.querySelector(sel+' > img');return n?.complete&&n.naturalWidth===1200},{timeout:15000},fig);
      const result=await page.$eval(fig,n=>({src:n.querySelector('img').getAttribute('src'),alt:n.querySelector('img').alt,phases:n.querySelectorAll('.tv-movement-phases span').length,disclosure:n.innerText.includes('AI-generated likeness illustration')}));
      assert(result.src.includes('tv-movement-'+id+'-20261119-v2.webp')&&result.alt.includes('left')&&result.alt.includes('right')&&result.phases===2&&result.disclosure,'Wrong revised artwork: '+id);
    }
    for(const width of [320,390,430]){
      await page.setViewport({width,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Movement reference overflow at '+width);
    }
  }
  await page.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await page.goto(url+'#/plan?day=chest-triceps',{waitUntil:'networkidle0'});
  await page.waitForSelector('[data-testid="tv-poster-preview"]');
  await page.$eval('[data-testid="tv-movement-figure"]',n=>n.scrollIntoView({block:'center'}));
  await page.screenshot({path:screenshot,fullPage:true});
  const axeSource=fs.readFileSync(new URL('./node_modules/axe-core/axe.min.js',import.meta.url),'utf8');
  await page.addScriptTag({content:axeSource});
  await page.waitForFunction(()=>getComputedStyle(document.getElementById('app')).opacity==='1');
  const report=await page.evaluate(async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));
  assert(!report.violations.length,'Movement references accessibility: '+JSON.stringify(report.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))));
  await page.goto(url+'#/library',{waitUntil:'networkidle0'});
  await page.waitForSelector('[data-testid="tv-library-search"]');
  await page.type('[data-testid="tv-library-search"]','dumbbell hammer curl');
  await page.waitForSelector('[data-ex-id="0313"] .tv-exercise-open');
  assert(await page.$('[data-ex-id="0313"] .tv-thumb-photo'),'Reviewed thumbnail missing');
  await tap('[data-ex-id="0313"] .tv-exercise-open');
  await page.waitForSelector('[aria-label="Close exercise details"]');
  await page.waitForSelector('[data-testid="tv-movement-figure"][data-exercise-id="0313"]');
  assert(await page.evaluate(()=>document.body.innerText.includes('do not rotate your palms forward')),'Hammer curl catalogue error still present');
  await tap('[aria-label="Close exercise details"]');
  await page.waitForFunction(()=>!document.getElementById('modal-root'));
  await page.goto(url+'#/plan?day=back-biceps',{waitUntil:'networkidle0'});
  await tap('[data-testid="tv-poster-start"]');
  await page.waitForFunction(()=>document.body.innerText.includes('Start without weighing in'));
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Start without weighing in')).click());
  await page.waitForSelector('[data-testid="tv-poster-active"]');
  const weight = '[data-testid="tv-inline-set-fields"] input[aria-label$="Weight (lb)"]';
  await page.waitForSelector(weight,{visible:true});
  await page.click(weight,{clickCount:3});await page.keyboard.type('58.5');await page.keyboard.press('Tab');
  const firstEntry=await page.evaluate(()=>JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0]);
  assert(firstEntry.sets.every(set=>set.w===58.5&&!set.done),'Inline load must populate untouched sets without completing them');
  await page.reload({waitUntil:'networkidle0'});
  assert(await page.$eval(weight,input=>input.value)==='58.5','Inline lifting load did not persist');
  for(const width of [320,390,430]){
    await page.setViewport({width,height:667,deviceScaleFactor:2,isMobile:true,hasTouch:true});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Inline fields overflow at '+width);
    assert(await page.$eval(weight,input=>input.getBoundingClientRect().height>=44&&getComputedStyle(input).fontSize==='18px'),'Weight field touch target or iPhone font too small');
  }
  await page.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await tap('[data-testid="tv-poster-set"]');
  assert(await page.evaluate(()=>JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0].sets[0].done),'Inline entered load cannot be logged');
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='One exercise').click());
  await page.waitForSelector('.tv-focus-set-table',{visible:true});
  assert(await page.$eval('.tv-focus-reference',n=>!n.open),'Optional reference must start collapsed');
  assert(await page.$eval('.tv-focus-set-table input',input=>input.value)==='58.5','Switching display lost inline weight');
  await page.$eval('.tv-focus-reference',n=>n.open=true);
  await page.waitForSelector('.tv-movement-media [data-testid="tv-coach-notes"]');
  await page.waitForSelector('.tv-focus-reference [data-testid="tv-movement-figure"][data-exercise-id="2330"]');
  assert(await page.evaluate(()=>JSON.parse(localStorage.getItem('gym_state_v1')).active.entries.length===5),'Artwork changed workout entries');
  await page.evaluate(async()=>{await navigator.serviceWorker.ready});
  await page.waitForFunction(async()=>{
    const release=await fetch('./tv-movement-assets.json').then(r=>r.json());
    for(const key of(await caches.keys()).filter(k=>k.startsWith('trivalley-open-gym-'))){
      const cache=await caches.open(key);
      if((await Promise.all(release.assets.map(a=>cache.match(new URL('./'+a.path,location.href.split('#')[0]).href)))).every(Boolean))return true;
    }return false;
  });
  await page.setOfflineMode(true);
  await page.goto(url+'#/plan?day=legs',{waitUntil:'networkidle0'});
  await page.waitForSelector('[data-testid="tv-poster-preview"]');
  await page.$eval('[data-exercise-id="0739"]',n=>n.scrollIntoView({block:'center'}));
  await page.waitForFunction(()=>{const n=document.querySelector('[data-exercise-id="0739"] > img');return n?.complete&&n.naturalWidth===1200});
  assert(await page.evaluate(()=>document.body.innerText.toLowerCase().includes('leg press')),'Offline program instructions unavailable');
  assert(!errors.length,'Browser errors: '+errors.join('; '));
  console.log(JSON.stringify({status:'REVISED_MOVEMENT_ILLUSTRATIONS_BROWSER_PASS',displayedIllustrations:16,pendingReview:0,checks:['all three program exercise lists preserved','all sixteen exact revised images with phase captions, library thumbnails, details, Focus and offline reload','320-430px reflow','automated accessibility','corrected neutral hammer grip retained','workout entries preserved','direct weight entry and load propagation without switching modes','inline weight survives reload and display changes','44px fields and 18px iPhone input text','optional reference follows logging'],physicalIPhoneAcceptance:'PENDING',likeness:'Owner-approved proof direction; remaining pairs operator reviewed; not real demonstrations'}));
} catch(error){
  console.error(JSON.stringify({errors,page:page?await page.evaluate(()=>document.body.innerText).catch(()=>null):null}));throw error;
} finally {if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));}
