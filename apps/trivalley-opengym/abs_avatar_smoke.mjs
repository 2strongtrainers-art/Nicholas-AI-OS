import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import {chromium,webkit} from 'playwright-core'

const root=path.resolve(process.argv[2]||'dist'),shot=process.argv[3]||'/tmp/abs-avatar.png'
const engine=process.env.TV_ENGINE||'chromium'
const ids=['0001','0003','0006','0262','0267','0276','3640','0687','0871','3639']
const assert=(ok,message)=>{if(!ok)throw Error(message)}
let server,browser,page,url=process.env.TV_LIVE_URL;const errors=[]
if(!url){
 const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'}
 server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end()}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res)})
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url=`http://127.0.0.1:${server.address().port}/`
}
try{
 const release=await(await fetch(url+'tv-release.json')).json()
 const assets=ids.map(id=>release.movementIllustrations.find(a=>a.id===id))
 assert(assets.every(Boolean),'Ten exact abdominal IDs missing from built release')
 browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{args:['--no-sandbox']}: {})})
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true})
 page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message))
 await page.goto(url+'#/workout',{waitUntil:'networkidle'})
 // Synthetic fixture in a brand-new isolated browser context, never an owner's profile.
 await page.evaluate(ids=>{
  const routine={id:'qa-abs-avatar',name:'Abdominal artwork QA',ex:ids.map(id=>({id,mode:'reps',sets:1,reps:5,weight:0,prog:'off'}))}
  localStorage.setItem('tv_daily_verse_enabled_v1','false')
  localStorage.setItem('gym_state_v1',JSON.stringify({unit:'lb',routines:[routine],customEx:[],week:{},dayPlan:{},workouts:[{id:'qa-retained-history',d:'2026-11-01',name:'Retained synthetic history',entries:[]}],active:null,bodyweight:[],tvSetupDone:true,_ts:Date.now()}))
 },ids)
 await page.reload({waitUntil:'networkidle'})
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('gym_state_v1')))
 const before=await read()
 await page.getByRole('button',{name:'Preview Abdominal artwork QA',exact:true}).click()
 await page.getByTestId('tv-poster-preview').waitFor()
 async function verifyPair(asset,scope=page){
  const figure=scope.locator('.tv-movement-poster[data-exercise-id="'+asset.id+'"]')
  await figure.waitFor();const img=figure.locator('img');await img.scrollIntoViewIfNeeded()
  await img.evaluate(e=>e.complete&&e.naturalWidth>0?true:new Promise((resolve,reject)=>{e.addEventListener('load',()=>resolve(true),{once:true});e.addEventListener('error',()=>reject(Error('Artwork failed to load')),{once:true})}))
  assert(await img.getAttribute('src')===asset.url,'Wrong artwork '+asset.id)
  assert((await figure.locator('.tv-movement-phases strong').allTextContents()).join('/')==='START/FINISH','Missing phase labels '+asset.id)
  const size=await img.evaluate(e=>({w:e.naturalWidth,h:e.naturalHeight}));assert(size.w===asset.width&&size.h===asset.height,'Wrong source dimensions '+asset.id)
 }
 for(const asset of assets)await verifyPair(asset,page.getByTestId('tv-poster-preview'))
 assert(JSON.stringify(await read())===JSON.stringify(before),'Preview modified saved training')
 await page.getByTestId('tv-poster-start').click()
 await page.getByRole('button',{name:'Start without weighing in',exact:true}).click()
 await page.getByTestId('tv-poster-active').waitFor()
 const activeId=(await read()).active.id
 for(const asset of assets)await verifyPair(asset,page.getByTestId('tv-poster-active'))
 for(const width of [320,390,430]){
  await page.setViewportSize({width,height:844})
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Overflow at '+width)
 }
 await page.getByRole('button',{name:'One exercise',exact:true}).click()
 for(const [i,asset]of assets.entries()){
  await verifyPair(asset)
  if(asset.id==='0276')await page.screenshot({path:shot,fullPage:true})
  if(i<assets.length-1)await page.getByRole('button',{name:'Next',exact:true}).click()
 }
 await page.waitForFunction(async urls=>{for(const url of urls)if(!await caches.match(url))return false;return true},assets.map(a=>a.url),{timeout:45000})
 await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'})
 await verifyPair(assets[assets.length-1])
 await page.getByRole('button',{name:'All exercises',exact:true}).click()
 for(const asset of assets)await verifyPair(asset,page.getByTestId('tv-poster-active'))
 const first=page.getByTestId('tv-poster-movement').first()
 await first.getByTestId('tv-poster-set').first().click()
 await page.reload({waitUntil:'domcontentloaded'});await page.getByTestId('tv-poster-active').waitFor()
 const after=await read()
 assert(after.active.id===activeId&&after.active.entries[0].sets[0].done,'Offline set did not persist')
 assert(after.active.entries[0].sets[0].w===0&&after.active.entries[0].sets[0].r===5,'Offline bodyweight values changed')
 for(const key of ['routines','workouts','week','dayPlan','bodyweight'])assert(JSON.stringify(after[key])===JSON.stringify(before[key]),'Unrelated data changed: '+key)
 assert(!errors.length,errors.join('; '))
 console.log(JSON.stringify({status:'ABS_AVATAR_CONTEXTS_PASS',engine,exactIds:ids,checks:['ten preview pairs','ten active-workout pairs','ten Focus pairs','320/390/430 reflow','preview read-only','all ten viewed pairs available offline','offline set survives reload','existing synthetic history/routine/calendar preserved'],physicalIPhone:'UNVERIFIED',qualifiedMovementReview:'UNVERIFIED'}))
}catch(error){if(page)await page.screenshot({path:shot,fullPage:true}).catch(()=>{});throw error}
finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve))}
