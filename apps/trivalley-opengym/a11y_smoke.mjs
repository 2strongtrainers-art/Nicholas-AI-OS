// TriValley FIT v4 automated accessibility smoke on actual Chromium DOM.
// This is WCAG-oriented automated coverage, not physical Safari/VoiceOver certification.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import puppeteer from 'puppeteer-core';
const require=createRequire(import.meta.url);
const root=path.resolve(process.argv[2]||'upstream/frontend/dist');
const live=process.env.TV_LIVE_URL?.trim();
const axePath=require.resolve('axe-core/axe.min.js');
let server,url=live||'';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
if(!url) {
  server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const relative=pathname.replace(/^\/+/, '')||'index.html';
    const f=path.resolve(root,relative);
    if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){
      res.writeHead(404);res.end('Not found');return;
    }
    res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  url='http://127.0.0.1:'+server.address().port+'/';
}
const executablePath=[process.env.CHROME_PATH,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(p=>p&&fs.existsSync(p));
if(!executablePath)throw new Error('Chromium not installed for accessibility testing');
const browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const problems=[],results=[];
try {
  const page=await browser.newPage();
  await page.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.goto(url,{waitUntil:'networkidle0',timeout:30000});
  for(const [route,selector] of [['home','[data-testid="tv-today-hero"]'],['library','[data-testid="tv-library"]'],['plan','#app'],['workout','#app'],['stats','#app']]){
    await page.evaluate(r=>{location.hash='#/'+r},route);
    await page.waitForSelector(selector,{timeout:15000});
    await page.waitForFunction(r=>location.hash==='#/'+r,{timeout:10000},route);
    await page.addScriptTag({path:axePath});
    const report=await page.evaluate(async()=>await window.axe.run(document,{
      runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']},
      resultTypes:['violations']
    }));
    const relevant=report.violations.map(v=>({
      route,id:v.id,impact:v.impact,nodeCount:v.nodes.length,
      firstTarget:v.nodes[0]?.target,firstFailure:v.nodes[0]?.failureSummary?.slice(0,190)
    }));
    problems.push(...relevant);
    results.push({route,violationCount:relevant.length,criticalOrSerious:relevant.filter(v=>['critical','serious'].includes(v.impact)).length});
  }
  await page.evaluate(()=>{location.hash='#/library'});
  await page.waitForSelector('[data-testid="tv-library"]');
  await page.click('[data-testid="tv-library-filters"]');
  await page.waitForSelector('[data-testid="tv-filter-overlay"] [role="dialog"][aria-modal="true"]');
  await page.addScriptTag({path:axePath});
  const dialog=await page.evaluate(async()=>await window.axe.run(document.querySelector('[data-testid="tv-filter-overlay"]'),{
    runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}
  }));
  for(const v of dialog.violations)problems.push({route:'filters',id:v.id,impact:v.impact,
    nodeCount:v.nodes.length,firstTarget:v.nodes[0]?.target,firstFailure:v.nodes[0]?.failureSummary?.slice(0,190)});
  results.push({route:'filters',violationCount:dialog.violations.length});
  const severe=problems.filter(p=>['critical','serious'].includes(p.impact));
  console.log(JSON.stringify({status:severe.length?'ACCESSIBILITY_FINDINGS':'ACCESSIBILITY_AUTOMATED_PASS',
    checks:results,violations:problems},null,2));
  if(severe.length)throw new Error('Critical/serious automated accessibility issues: '+severe.length);
}finally {
  await browser.close();
  if(server)await new Promise(resolve=>server.close(resolve));
}
