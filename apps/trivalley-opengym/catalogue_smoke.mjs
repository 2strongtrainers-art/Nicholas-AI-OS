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

  await page.goto(url+'#/library',{waitUntil:'networkidle0'});
  await page.waitForSelector('[data-testid="tv-exercise-card"]');
  assert(await page.$$eval('[data-testid="tv-exercise-card"]',cards=>cards.length)===16,'Recommended Main 16 is not the default');
  await page.click('[data-testid="tv-mode-all"]');
  // The actual rendered collection, not a second hardcoded exercise list.
  while(await page.$('.tv-load-more')) {
    await page.$eval('.tv-load-more',button=>button.click());
  }
  const ids=await page.$$eval('[data-testid="tv-exercise-card"]',cards=>cards.map(card=>card.dataset.exId));
  assert(ids.length===1324 && new Set(ids).size===1324,'Complete unique catalogue not rendered');
  let illustrated=0,written=0;
  for (const [index,id] of ids.entries()) {
    await page.$eval('[data-ex-id="'+id+'"] .tv-exercise-open',button=>button.click());
    await page.waitForSelector('[aria-label="Close exercise details"]',{visible:true});
    const details=await page.$eval('#modal-root',modal=>({
      name:modal.querySelector('h3')?.textContent?.trim(),
      instructions:modal.querySelectorAll('.steps-list li').length,
      notes:modal.querySelectorAll('[data-testid="tv-coach-notes"] dt').length,
      picture:!!modal.querySelector('[data-testid="tv-movement-figure"]'),
      add:[...modal.querySelectorAll('button')].some(button=>button.textContent.includes('Add to my plan')),
      overflow:modal.scrollWidth>innerWidth+2
    }));
    assert(details.name && details.add && (details.instructions>0 || details.notes===4),'Incomplete details '+id+': '+JSON.stringify(details));
    assert(!details.overflow,'Details overflow '+id);
    if(details.notes===4) {illustrated++; assert(details.picture,'Main exercise illustration missing '+id)} else written++;
    await page.$eval('[aria-label="Close exercise details"]',button=>button.click());
    await page.waitForFunction(()=>!document.getElementById('modal-root'));
    if(index%200===0) console.log('Checked exercise details '+(index+1)+'/'+ids.length);
  }
  assert(illustrated===16 && written===1308,'Exercise guidance coverage mismatch');
  await page.click('[data-testid="tv-mode-essentials"]');
  assert(await page.$$eval('[data-testid="tv-exercise-card"]',n=>n.length)===16,'Main 16 filter missing');
  for(const width of [320,390,430]) {
    await page.setViewport({width,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Main collection overflow '+width);
  }
  await page.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await page.screenshot({path:screenshot,fullPage:false});
  assert(!errors.length,'Browser errors: '+errors.join('; '));
  console.log(JSON.stringify({status:'COMPLETE_CATALOGUE_DETAILS_PASS',exercises:ids.length,structuredCoaching:illustrated,writtenReferences:written,checks:['every rendered catalogue detail opens with instructions and an add-to-plan action','all details close','main16 collection','320/390/430 reflow'],limits:['clicks are scripted; not 1324 human technique reviews','physical iPhone and real-person usability unverified']}));
} catch(error) {
  console.error(JSON.stringify({errors,page:page?await page.evaluate(()=>document.body.innerText).catch(()=>null):null}));throw error;
} finally {if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));}
