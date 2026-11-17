// End-to-end browser acceptance of the *synthetic* coaching preview.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const root=path.resolve(process.argv[2]);
const screenshot=process.argv[3]||'/tmp/m2-preview.png';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'};
const errors=[],requests=[];
const server=http.createServer((req,res)=>{
  const part=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const relative=part.replace(/^\/+/,'')||'m2-preview/index.html';
  const file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
    res.writeHead(404);res.end('Not found');return;
  }
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const target='http://127.0.0.1:'+server.address().port+'/m2-preview/index.html';
const chrome=[process.env.CHROME_PATH,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium']
  .find(p=>p&&fs.existsSync(p));
if(!chrome)throw new Error('Chromium required for UI acceptance');
const browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
  const page=await browser.newPage();
  await page.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{
    requests.push(r.url());
    if(new URL(r.url()).origin!==new URL(target).origin)errors.push('External request: '+r.url());
  });
  const res=await page.goto(target,{waitUntil:'networkidle0',timeout:20000});
  if(res.status()!==200)throw new Error('Preview failed to load');
  await page.waitForSelector('[role="tablist"]');
  const first=await page.evaluate(()=>document.body.innerText);
  if(!first.includes('DEMONSTRATION ONLY')||!first.includes('Synthetic')||!first.includes('Coach demo'))
    throw new Error('Unambiguous synthetic-only user consent messaging missing');
  const hasOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
  if(hasOverflow)throw new Error('Synthetic coaching preview overflows mobile width');
  await page.screenshot({path:screenshot,fullPage:true});
  await page.click('[data-action="client"]');
  await page.waitForFunction(()=>document.body.innerText.includes('Your assigned program'));
  await page.click('#simulate-offline');
  await page.click('[data-action="log-workout"]');
  await page.waitForFunction(()=>document.body.innerText.includes('Unsynchronized sample sessions: 1'));
  await page.click('#simulate-offline');
  await page.click('[data-action="sync"]');
  await page.waitForFunction(()=>document.body.innerText.includes('Unsynchronized sample sessions: 0'));
  await page.$eval('#checkin-note',node=>{node.value='Sample check-in, no real personal data';node.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.click('#checkin-form button[type=submit]');
  await page.waitForFunction(()=>document.body.innerText.includes('Sample check-in submitted'));
  await page.click('[data-action="coach"]');
  await page.waitForFunction(()=>document.body.innerText.includes('Coaching check-ins'));
  const coachText=await page.evaluate(()=>document.body.innerText);
  if(!coachText.includes('1')||!coachText.includes('pending')||!coachText.includes('Sample check-in, no real personal data'))
    throw new Error('Coach did not receive synchronized synthetic workout/checkin');
  await page.click('[data-action="review"]');
  await page.waitForFunction(()=>document.body.innerText.includes('reviewed'));
  await page.$eval('#new-title',el=>{el.value='Sample Revised Program';el.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.click('#create-program button[type=submit]');
  await page.waitForFunction(()=>document.body.innerText.includes('Synthetic program published'));
  await page.click('[data-action="client"]');
  await page.waitForFunction(()=>document.body.innerText.includes('Sample Revised Program'));
  for(const w of [320,375,390,430]){
    await page.setViewport({width:w,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
    if(overflow)throw new Error('Horizontal overflow on '+w+'px phone');
  }
  const js=await page.evaluate(()=>({
    localKeys:Object.keys(localStorage),
    sessionKeys:Object.keys(sessionStorage),
    body:document.body.innerText,
    scripts:[...document.scripts].map(s=>s.src)
  }));
  if(js.localKeys.some(x=>/token|auth|client|coaching/i.test(x))||js.sessionKeys.some(x=>/token|auth|client|coaching/i.test(x)))
    throw new Error('Demo persisted client credentials/records unexpectedly');
  if(js.body.includes('Live coaching platform')||js.body.includes('Real clients connected'))
    throw new Error('Misleading production capability claim');
  if(errors.length)throw new Error('Browser security/runtime errors: '+errors.slice(0,3).join(' | '));
  console.log(JSON.stringify({status:'M2_SYNTHETIC_BROWSER_PASS',requests:requests.length,
    offlineReplay:true,reviewedCheckin:true,assignedProgram:true,
    mobileWidths:[320,375,390,430],externalRequests:0},null,2));
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
