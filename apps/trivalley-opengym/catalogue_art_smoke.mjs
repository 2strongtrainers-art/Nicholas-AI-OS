import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import {chromium,webkit} from 'playwright-core'
const root=path.resolve(process.argv[2]||'dist'),shot=process.argv[3]||'/tmp/illustrated.png',engine=process.env.TV_ENGINE||'chromium'
const assert=(v,m)=>{if(!v)throw Error(m)}
let server,url=process.env.TV_LIVE_URL,browser,page;const errors=[]
if(!url){const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!p.startsWith(root+path.sep)||!fs.existsSync(p)){res.writeHead(404);return res.end()}res.setHeader('Content-Type',types[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res)});await new Promise(r=>server.listen(0,'0.0.0.0',r));url=`http://127.0.0.1:${server.address().port}/`}
try{
 browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{args:['--no-sandbox']}: {})})
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message))
 const response=await fetch(url+'tv-catalogue-art-batch2.json'),manifest=await response.json();assert(manifest.assets.length===25,'Wrong new catalogue count')
 const crypto=await import('node:crypto');const unique=new Map(manifest.assets.map(a=>[a.url,a]));assert(unique.size===9,'Unexpected atlas count')
 for(const [url,a]of unique){const response=await fetch(url);assert(response.ok,'Artwork HTTP '+response.status);const bytes=Buffer.from(await response.arrayBuffer());assert(bytes.length===a.bytes&&crypto.createHash('sha256').update(bytes).digest('hex')===a.sha256,'Public artwork digest mismatch')}
 await page.goto(url+'#/library',{waitUntil:'networkidle'});await page.getByTestId('tv-mode-all').click();const before=await page.evaluate(()=>localStorage.getItem('gym_state_v1'));const styles=new Set()
 for(const art of manifest.assets){
  await page.getByTestId('tv-library-search').fill(art.name);await page.getByTestId('tv-library-search').press('Tab');await page.waitForFunction(name=>document.querySelector('[data-testid="tv-library-search"]')?.value===name,art.name);const open=page.locator('[data-ex-id="'+art.id+'"] .tv-exercise-open');await open.click()
  const figure=page.locator('[data-testid="tv-movement-figure"][data-exercise-id="'+art.id+'"]');await figure.waitFor();const img=figure.locator('img');await img.scrollIntoViewIfNeeded();await img.evaluate(e=>e.complete&&e.naturalWidth>0?true:new Promise((resolve,reject)=>{e.addEventListener('load',()=>resolve(true),{once:true});e.addEventListener('error',()=>reject(Error('Illustration failed to load')),{once:true})}));assert(await img.getAttribute('src')===art.url,'Wrong exact-ID image')
  const geometry=await figure.locator('.tv-movement-window').evaluate(e=>{const r=e.getBoundingClientRect(),i=e.querySelector('img').getBoundingClientRect();return{ratio:r.width/r.height,top:(r.top-i.top)/r.height}})
  assert(Math.abs(geometry.ratio-art.width/art.cropHeight)<0.03&&Math.abs(geometry.top-art.top/art.cropHeight)<0.03,'Wrong or distorted crop '+art.id)
  styles.add(art.style);assert((await figure.innerText()).includes('AI-generated likeness illustration'),'Disclosure missing')
  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Overflow '+art.id+' '+width)}
  if(art.id==='0662')await page.screenshot({path:shot,fullPage:false})
  await page.getByRole('button',{name:'Close exercise details',exact:true}).click();await page.locator('#modal-root').waitFor({state:'detached'})
 }
 assert(styles.size===2,'Requested style mix missing');assert(await page.evaluate(()=>localStorage.getItem('gym_state_v1'))===before,'Reading artwork changed training data')
 await page.getByTestId('tv-library-search').fill('pull-up');await page.locator('[data-ex-id="0652"] .tv-exercise-open').click();await page.locator('[data-exercise-id="0652"] img').scrollIntoViewIfNeeded()
 const pull=manifest.assets.find(a=>a.id==='0652');await page.waitForFunction(async url=>!!(await caches.match(url)),pull.url,{timeout:45000})
 const cacheSizes=await page.evaluate(async()=>{const names=(await caches.keys()).filter(n=>n.endsWith('-catalogue-art'));return Promise.all(names.map(async name=>(await (await caches.open(name)).keys()).length))});assert(cacheSizes.length===1&&cacheSizes[0]<=12,'Artwork cache unbounded')
 await page.addScriptTag({path:new URL('node_modules/axe-core/axe.min.js',import.meta.url).pathname});const violations=await page.evaluate(async()=>{const r=await axe.run('#modal-root',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations.map(v=>v.id)});assert(!violations.length,'Accessibility '+violations.join(','))
 await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.getByTestId('tv-mode-all').click();await page.getByTestId('tv-library-search').fill('pull-up');await page.locator('[data-ex-id="0652"] .tv-exercise-open').click();await page.locator('[data-exercise-id="0652"] img').scrollIntoViewIfNeeded();await page.waitForFunction(()=>{const i=document.querySelector('[data-exercise-id="0652"] img');return i?.complete&&i.naturalWidth>0});await context.setOffline(false)
 assert(!errors.length,errors.join('; '));console.log(JSON.stringify({status:'CATALOGUE_ART_BATCH2_PASS',engine,newExactIds:25,totalIllustrated:41,remaining:1283,checks:['25 exact-ID views','nine public asset digests','two likeness styles','undistorted correct image regions','320/390/430 reflow','no workout mutation','automated accessibility','on-demand cache bounded to12','viewed artwork offline'],physicalIPhone:'UNVERIFIED'}))
}catch(e){console.error(JSON.stringify({error:e.message,engine,page:page?await page.locator('body').innerText().catch(()=>null):null}));if(page)await page.screenshot({path:shot,fullPage:true}).catch(()=>{});throw e}finally{await browser?.close();if(server)await new Promise(r=>server.close(r))}
