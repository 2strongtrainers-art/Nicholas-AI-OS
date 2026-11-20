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
 const go=async route=>{await page.goto(url+'#'+route,{waitUntil:'networkidle'});await page.locator('h1').first().waitFor()}
 const storage=()=>page.evaluate(()=>localStorage.getItem('gym_state_v1'))
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('gym_state_v1')))
 await go('/home');await page.evaluate(()=>localStorage.setItem('tv_daily_verse_enabled_v1','false'));await page.reload({waitUntil:'networkidle'})
 const baseline=await read(),styles=new Set()
 for(const [key,count] of [['nick-upper-body',5],['nick-supported-lower',4],['nick-core-control',5],['nick-dumbbell-foundation',4]]){
  const before=await storage();await go('/posters/'+key);await page.getByTestId('tv-poster-preview').waitFor()
  assert(await page.getByTestId('tv-poster-movement').count()===count,'Wrong per-side movement count '+key)
  assert(await page.getByTestId('tv-nick-art').count()===count,'Illustration mapping missing '+key)
  for(const figure of await page.getByTestId('tv-nick-art').all()){
   styles.add(await figure.getAttribute('data-style'));const img=figure.locator('img');await img.scrollIntoViewIfNeeded();await img.evaluate(e=>e.complete&&e.naturalWidth>0?true:new Promise((resolve,reject)=>{e.addEventListener('load',()=>resolve(true),{once:true});e.addEventListener('error',()=>reject(Error('Artwork download failed')),{once:true})}))
  }
  assert(await storage()===before,'Preview changed workout records '+key)
  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Horizontal overflow '+width)}
  await page.addScriptTag({path:new URL('node_modules/axe-core/axe.min.js',import.meta.url).pathname})
  const violations=await page.evaluate(async()=>{const r=await axe.run('[data-testid="tv-quick-poster-detail"]',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations.map(v=>v.id)})
  assert(!violations.length,'Accessibility '+violations.join(','))
  await page.getByRole('button',{name:'Save workout to My routines',exact:true}).click();await page.getByRole('button',{name:'Edit my saved workout',exact:true}).waitFor()
 }
 assert(styles.has('TRX')&&styles.has('Dumbbell'),'Requested blend missing')
 let s=await read();assert(s.routines.length===baseline.routines.length+4,'Explicit saves did not add exactly four presets');assert(s.customEx.length===baseline.customEx.length+18,'Custom definitions missing or duplicated')
 for(const k of ['week','dayPlan','workouts','active','bodyweight'])assert(JSON.stringify(s[k])===JSON.stringify(baseline[k]),'Preset saves changed '+k)
 await go('/posters/nick-dumbbell-foundation');await page.getByTestId('tv-poster-start').click();assert(!(await read()).active,'Started before check-in confirmation');await page.getByRole('button',{name:'Start without weighing in',exact:true}).click();await page.getByTestId('tv-poster-active').waitFor();s=await read();const activeId=s.active.id
 assert(s.active.entries.every(e=>e.target.loadRequired===true&&e.sets.every(x=>x.w===0)),'Invented starting load')
 const first=page.getByTestId('tv-poster-movement').first();await first.getByTestId('tv-poster-set').first().click();assert(!(await read()).active.entries[0].sets[0].done,'Zero working weight accepted')
 const fields=first.getByTestId('tv-inline-set-fields').first();await fields.locator('input').nth(0).fill('10');await fields.locator('input').nth(0).press('Tab');await fields.locator('input').nth(1).fill('8');await fields.locator('input').nth(1).press('Tab');await first.getByTestId('tv-poster-set').first().click()
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0].sets[0].done)
 s=await read();assert(s.active.entries[0].sets[0].w===10&&s.active.entries[0].sets[0].r===8,'Actual set not recorded')
 await go('/posters/nick-core-control');assert(!(await page.getByTestId('tv-poster-start').isEnabled()),'Preview can replace active training');assert((await read()).active.id===activeId,'Active workout replaced')
 await page.screenshot({path:shot,fullPage:true})
 await page.waitForFunction(async()=>!!(await caches.match('https://static.wixstatic.com/media/856ae2_cf1ed6d791f7407f9268ea06198c4b38~mv2.png')),{timeout:30000})
 await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.getByTestId('tv-nick-art').first().waitFor();const image=page.getByTestId('tv-nick-art').first().locator('img');await image.scrollIntoViewIfNeeded();await page.waitForFunction(()=>[...document.querySelectorAll('[data-testid="tv-nick-art"] img')].some(e=>e.complete&&e.naturalWidth>0));await context.setOffline(false)
 assert(!errors.length,errors.join('; '));console.log(JSON.stringify({status:'ILLUSTRATED_PRESETS_BROWSER_PASS',engine,checks:['four original presets','18 separate side entries','both likeness styles','all mapped artwork loads','preview no mutation','explicit append-only save','working weight required','actual set logging','active protection','320/390/430 reflow','automated accessibility','cached artwork offline'],physicalIPhone:'UNVERIFIED'}))
}catch(e){console.error(JSON.stringify({error:e.message,engine,page:page?await page.locator('body').innerText().catch(()=>null):null}));if(page)await page.screenshot({path:shot,fullPage:true}).catch(()=>{});throw e}finally{await browser?.close();if(server)await new Promise(r=>server.close(r))}
