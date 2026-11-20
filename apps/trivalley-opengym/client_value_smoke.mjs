import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { chromium, webkit } from 'playwright-core'
const root=path.resolve(process.argv[2]||'dist'), shot=process.argv[3]||'/tmp/client-value.png'
const engine=process.env.TV_ENGINE||'chromium', live=process.env.TV_LIVE_URL
const assert=(value,message)=>{if(!value)throw Error(message)}
let server,url=live,browser,page;const errors=[]
if(!url){
 const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'}
 server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!p.startsWith(root+path.sep)||!fs.existsSync(p)){res.writeHead(404);return res.end()}res.setHeader('Content-Type',types[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res)})
 await new Promise(r=>server.listen(0,'0.0.0.0',r));url=`http://127.0.0.1:${server.address().port}/`
}
try{
 browser=await (engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'&&process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),...(engine==='chromium'?{args:['--no-sandbox']}: {})})
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true})
 page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message))
 await page.goto(url+'#/home',{waitUntil:'networkidle'})
 await page.evaluate(()=>{localStorage.setItem('tv_daily_verse_enabled_v1','false')})
 await page.reload({waitUntil:'networkidle'})
 assert(await page.locator('[data-testid="tv-summary-sessions"]').textContent()==='0','Fresh client activity was invented')
 await page.getByRole('button',{name:'Programs',exact:true}).click()
 await page.locator('[data-testid="tv-open-setup"]').waitFor()
 assert(await page.locator('[data-testid="tv-program-schedule"]').count()===0,'Competing legacy schedule selector remains')
 for(const [width,height] of [[320,667],[390,844],[430,932]]){
  await page.setViewportSize({width,height})
  await page.waitForFunction(()=>{const a=document.querySelector('#app').getBoundingClientRect(),d=document.querySelector('[data-testid="tv-training-dock"]').getBoundingClientRect();return a.bottom<=d.top-6&&a.height>100&&d.bottom<=innerHeight-(document.documentElement.dataset.tvFreeHosted==='1'?76:0)+2})
  const layout=await page.evaluate(()=>{const app=document.querySelector('#app').getBoundingClientRect(),nav=document.querySelector('#tabbar').getBoundingClientRect();return {bottom:app.bottom,navTop:nav.top,navBottom:nav.bottom,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+2}})
  assert(layout.bottom<=layout.navTop+1,'App content extends behind navigation at '+width)
  assert(layout.navBottom<=layout.height+1&&!layout.overflow,'Navigation/viewport overflow at '+width)
 }
 await page.setViewportSize({width:390,height:844})
 await page.locator('[data-testid="tv-program-brief"] summary').click()
 assert((await page.locator('[data-testid="tv-program-brief"]').innerText()).includes('Adults comfortable'),'Program audience missing')
 assert((await page.locator('[data-testid="tv-program-brief"]').innerText()).includes('no fixed course end date'),'Template falsely sold as a multiweek course')
 for(let i=0;i<3;i++){
  await page.locator(`[data-testid="tv-preview-program-${i}"]`).click()
  await page.locator('[data-testid="tv-session-program-brief"]').waitFor()
  assert((await page.locator('[data-testid="tv-session-program-brief"]').innerText()).includes('min estimated'),'Session estimate not labelled')
  await page.locator('[data-testid="tv-poster-back"]').click()
 }
 await page.locator('[data-testid="tv-open-setup"]').click()
 await page.locator('#tv-setup-schedule').selectOption('none')
 const before=await page.evaluate(()=>localStorage.getItem('gym_state_v1'))
 await page.getByRole('button',{name:'Review my setup',exact:true}).click()
 assert(await page.evaluate(()=>localStorage.getItem('gym_state_v1'))===before,'Review modified saved data')
 await page.getByRole('button',{name:'Confirm program and training days',exact:true}).click()
 await page.locator('[data-testid="tv-today-calendar"]').waitFor()
 assert((await page.locator('[data-testid="tv-today-calendar"]').innerText()).toLowerCase().includes('rest day'),'Flexible plan implies a workout is due today')
 assert(await page.locator('[data-testid="tv-get-started"]').count()===0,'Returning user gets redundant onboarding')
 // Isolated synthetic history: real client data is never loaded by this test.
 await page.evaluate(()=>{
  const S=JSON.parse(localStorage.getItem('gym_state_v1')),now=Date.now()
  const day=offset=>{const d=new Date();d.setDate(d.getDate()+offset);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  const rec=(id,offset,reps,count=3,partial=false)=>({id,d:day(offset),end:now-1000+offset*86400000,unit:'lb',partial,entries:[{id:'0294',target:{mode:'reps'},sets:Array.from({length:count},()=>({w:50,r:reps,done:true}))}]})
  const full=rec('qa-full',0,10)
  S.workouts=[rec('qa-before',-7,8),rec('qa-partial',-2,9,1,true),full,full,rec('qa-future',1,14),{id:'qa-empty',d:day(0),entries:[]}]
  localStorage.setItem('gym_state_v1',JSON.stringify(S))
 })
 await page.reload({waitUntil:'networkidle'})
 assert(await page.locator('[data-testid="tv-summary-sessions"]').textContent()==='1','Complete/partial/duplicate/future session count incorrect')
 assert(await page.locator('[data-testid="tv-summary-sets"]').textContent()==='4','Only performed sets must count')
 assert(await page.locator('[data-testid="tv-summary-days"]').textContent()==='2','Days trained must be distinct')
 assert(await page.locator('.tv-weekly-days li').count()===7,'Seven activity days missing')
 assert((await page.locator('[data-testid="tv-progress-summary"]').innerText()).includes('1 partial workout'),'Partial effort missing')
 assert((await page.locator('[data-testid="tv-weekly-improvement"]').innerText()).includes('1 more rep'),'Same-load progress missing')
 await page.locator('[data-testid="tv-progress-summary"]').scrollIntoViewIfNeeded()
 await page.screenshot({path:shot,fullPage:true})
 await page.locator('[data-testid="tv-start-primary"]').click()
 await page.getByRole('button',{name:'Start without weighing in',exact:true}).click()
 await page.locator('[data-testid="tv-poster-active"]').waitFor()
 const input=page.locator('.tv-inline-set-fields input').first()
 await input.fill('35');await input.press('Tab')
 await input.focus();await page.setViewportSize({width:390,height:500})
 await input.scrollIntoViewIfNeeded()
 const reachable=await input.evaluate(n=>{const r=n.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return n.contains(hit)&&parseFloat(getComputedStyle(n).fontSize)>=16})
 assert(reachable,'Lifting input obscured or too small in reduced viewport')
 await page.setViewportSize({width:390,height:844})
 await page.reload({waitUntil:'networkidle'})
 assert(await page.evaluate(()=>JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0].sets[0].w===35),'Direct lifting entry lost after reload')
 await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gym_state_v1'));s.routines[0].ex=[];localStorage.setItem('gym_state_v1',JSON.stringify(s))});
 await page.goto(url+'#/plan',{waitUntil:'networkidle'});await page.reload({waitUntil:'networkidle'});
 assert(await page.locator('[data-testid="tv-start-program-0"]').isDisabled(),'Empty edited routine can start');
 await page.locator('[data-testid="tv-preview-program-0"]').click();
 assert((await page.locator('[data-testid="tv-session-program-brief"]').innerText()).includes('0 exercises'),'Empty routine brief invents exercises or crashes');
 assert(!errors.length,errors.join('; '))
 console.log(JSON.stringify({status:'CLIENT_VALUE_BROWSER_PASS',engine,checks:['320-430px non-overlapping navigation','one reviewed setup path','program and session briefs','honest seven-day card','separate partial effort','recorded same-load progress','rest-day clarity','returning-user onboarding','direct entry in reduced viewport','reload persistence'],physicalIPhone:'PENDING'}))
}catch(error){console.error(JSON.stringify({error:error.message,engine,page:page?await page.locator('body').innerText().catch(()=>null):null}));if(page)await page.screenshot({path:shot,fullPage:true}).catch(()=>{});throw error}
finally{await browser?.close();if(server)await new Promise(r=>server.close(r))}
