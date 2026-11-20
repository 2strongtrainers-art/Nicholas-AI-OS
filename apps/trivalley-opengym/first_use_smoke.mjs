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

 await page.goto(url+'#/start',{waitUntil:'networkidle'})
 await page.getByTestId('tv-start-guide').waitFor()
 const original=await page.evaluate(()=>localStorage.getItem('gym_state_v1'))
 assert(await page.locator('.tv-start-main').count()===1,'First-use guide must have one main action')
 assert((await page.getByRole('region',{name:'Where your workouts are saved'}).innerText()).includes('don’t automatically receive'),'Coach monitoring boundary missing')
 await page.getByRole('button',{name:'Set up my training',exact:true}).click()
 await page.locator('#tv-setup-schedule').waitFor()
 await page.locator('#tv-setup-schedule').selectOption('none')
 await page.getByRole('button',{name:'Review my setup',exact:true}).click()
 assert(await page.evaluate(()=>localStorage.getItem('gym_state_v1'))===original,'Review changed the saved plan')
 await page.getByRole('button',{name:'Back to choices',exact:true}).click()
 await page.getByRole('button',{name:'Close setup',exact:true}).click()
 await page.getByRole('button',{name:'Library',exact:true}).click()
 await page.getByTestId('tv-exercise-card').first().waitFor()
 assert(await page.getByTestId('tv-exercise-card').count()===16,'First library visit must recommend Main 16')
 await page.getByTestId('tv-library-search').fill('Air Bike')
 assert((await page.getByTestId('tv-exercise-list').innerText()).toLowerCase().includes('air bike'),'Search did not include full catalogue')
 assert(await page.getByTestId('tv-mode-all').getAttribute('aria-pressed')==='true','Full-search scope not visibly selected')
 await page.goto(url+'#/calculators',{waitUntil:'networkidle'})
 const choose=page.getByLabel('What would you like to work out?',{exact:true})
 await choose.selectOption('bmr')
 await page.getByRole('button',{name:'kg / cm',exact:true}).click()
 for(const [k,v]of Object.entries({age:'30',sex:'male',height:'180',weight:'80'})){const f=page.locator('#tv-calc-'+k);if(k==='sex')await f.selectOption(v);else await f.fill(v)}
 await page.getByRole('button',{name:'Calculate my estimate',exact:true}).click()
 assert((await page.getByTestId('tv-calc-next').innerText()).includes('not what you should eat'),'Resting-energy interpretation missing')
 await page.getByRole('button',{name:'Estimate my full day instead',exact:true}).click()
 assert(await choose.inputValue()==='maintenance','Resting to maintenance guidance routes incorrectly')
 assert(await page.getByTestId('tv-calc-result').count()===0,'Old resting result retained')
 await choose.selectOption('macros');await page.locator('#tv-calc-activity').selectOption('1.55')
 await page.getByRole('button',{name:'Calculate my estimate',exact:true}).click()
 await page.locator('.tv-meal-example summary').click()
 assert((await page.locator('.tv-meal-example').innerText()).includes('51.7'),'Four-share arithmetic wrong')
 await page.locator('#tv-meal-count').selectOption('3')
 assert((await page.locator('.tv-meal-example').innerText()).includes('69'),'Three-share arithmetic wrong')
 assert((await page.locator('.tv-meal-example').innerText()).includes('division only'),'Meal example presented as prescription')
 assert(await page.evaluate(()=>localStorage.getItem('gym_state_v1'))===original,'Guides or calculators changed training records')
 await page.goto(url+'#/start',{waitUntil:'networkidle'})
 for(const width of [320,390,430]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Start guide overflow '+width)}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:shot,fullPage:true})
 await page.addScriptTag({content:fs.readFileSync(new URL('./node_modules/axe-core/axe.min.js',import.meta.url),'utf8')})
 const axe=await page.evaluate(async()=>await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}))
 assert(!axe.violations.length,'Start guide accessibility: '+JSON.stringify(axe.violations.map(x=>({id:x.id,nodes:x.nodes.map(n=>n.target)}))))
 assert(!errors.length,errors.join(';'))
 console.log(JSON.stringify({status:'FIRST_USE_GUIDANCE_BROWSER_PASS',engine,checks:['one primary guide action','review and cancellation preserve data','recommended Main 16 default','full catalogue search','question-led calculator labels','BMR to maintenance route','three/four-share macro arithmetic','explicit local records and no coach monitoring','320/390/430 reflow','automated accessibility'],physicalIPhone:'UNVERIFIED'}))
} catch(error){console.error(JSON.stringify({error:error.message,page:page?await page.locator('body').innerText().catch(()=>null):null}));throw error}
finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r))}
