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

 await page.goto(url+'#/calculators',{waitUntil:'networkidle'})
 await page.getByTestId('tv-calculators').waitFor()
 const initial=await page.evaluate(()=>localStorage.getItem('gym_state_v1'))
 assert(await page.locator('[aria-label="Choose your calculator"] option').count()===13,'Expected thirteen native tools')
 assert(await page.getByTestId('tv-calc-result').count()===0,'Result fabricated before input')
 await page.getByRole('button',{name:'Calculate my estimate',exact:true}).click()
 assert(await page.getByRole('alert').isVisible(),'Blank inputs should show validation')
 assert(await page.getByTestId('tv-calc-result').count()===0,'Blank values produced zero/result')
 await page.getByRole('button',{name:'kg / cm',exact:true}).click()
 const fixtures={age:'30',sex:'male',height:'180',weight:'80',activity:'1.55',goal:'maintain',bodyFat:'20',lift:'100',reps:'5',minutes:'30',metActivity:'02054'}
 const expected={calories:'2,759',maintenance:'2,759',macros:'206.9',protein:'206.9',carbs:'275.9',fats:'92',bmr:'1,864.4',rmr:'1,864.4',lean:'64',bmi:'24.7','one-rm':'116.7',burn:'147',creatine:'5'}
 const nonGets=[];page.on('request',request=>{if(request.method()!=='GET')nonGets.push(request.method()+' '+request.url())})
 for(const [id,value]of Object.entries(expected)){
  await page.getByLabel('Choose your calculator',{exact:true}).selectOption(id)
  for(const [key,value]of Object.entries(fixtures)){
   const field=page.locator('#tv-calc-'+key)
   if(await field.count()){
    if(await field.evaluate(n=>n.tagName)==='SELECT')await field.selectOption(value)
    else await field.fill(value)
   }
  }
  await page.getByRole('button',{name:'Calculate my estimate',exact:true}).click()
  await page.getByTestId('tv-calc-result').waitFor()
  assert((await page.getByTestId('tv-calc-result').innerText()).includes(value),'Wrong known UI result for '+id)
  assert(await page.evaluate(()=>document.activeElement?.textContent==='Your starting estimate'),'Result focus did not move')
  for(const width of [320,390,430]){
   await page.setViewportSize({width,height:844})
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Calculator overflow '+id+' at '+width)
  }
 }
 await page.getByLabel('Choose your calculator',{exact:true}).selectOption('macros')
 await page.locator('#tv-calc-ratio').selectOption('custom')
 for(const [key,value]of [['carbPercent','50'],['proteinPercent','25'],['fatPercent','24']])await page.locator('#tv-calc-'+key).fill(value)
 await page.getByRole('button',{name:'Calculate my estimate',exact:true}).click()
 assert((await page.getByRole('alert').innerText()).includes('100'),'Invalid macro total accepted')
 await page.locator('#tv-calc-fatPercent').fill('25')
 await page.getByRole('button',{name:'Calculate my estimate',exact:true}).click()
 assert((await page.getByTestId('tv-calc-result').innerText()).includes('172.4'),'Custom macros wrong')
 await page.getByRole('button',{name:'lb / inches',exact:true}).click()
 assert(Math.abs(Number(await page.locator('#tv-calc-weight').inputValue())-176.369809748)<0.00001,'Weight relabelled without conversion')
 assert(Math.abs(Number(await page.locator('#tv-calc-height').inputValue())-70.8661417323)<0.00001,'Height relabelled without conversion')
 assert(await page.getByTestId('tv-calc-result').count()===0,'Stale result survived unit change')
 await page.getByRole('button',{name:'kg / cm',exact:true}).click()
 await page.getByRole('button',{name:'Calculate my estimate',exact:true}).click()
 await page.setViewportSize({width:390,height:844})
 await page.locator('.tv-calc-result').screenshot({path:shot})
 await page.addScriptTag({content:fs.readFileSync(new URL('./node_modules/axe-core/axe.min.js',import.meta.url),'utf8')})
 const axe=await page.evaluate(async()=>await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}))
 assert(!axe.violations.length,'Calculator accessibility: '+JSON.stringify(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))))
 assert(await page.locator('.tv-calc-external a').count()===4,'External resource count changed')
 assert(await page.evaluate(()=>localStorage.getItem('gym_state_v1'))===initial,'Calculators changed training records')
 assert(nonGets.length===0,'Unexpected non-GET request '+nonGets.join(';'))
 await page.getByRole('button',{name:'Library',exact:true}).click()
 await page.getByRole('button',{name:'Fitness calculators · nutrition & training',exact:true}).click()
 await page.getByTestId('tv-calculators').waitFor()
 assert(await page.locator('#tv-calc-weight').inputValue()==='','Private entries persisted across leaving')
 await page.locator('.tv-client-more summary').click()
 await page.getByRole('button',{name:'Fitness calculators',exact:true}).click()
 assert(await page.getByTestId('tv-calculators').isVisible(),'Header entry does not route')
 assert(!errors.length,'Browser errors: '+errors.join(';'))
 console.log(JSON.stringify({status:'FITNESS_CALCULATORS_BROWSER_PASS',engine,calculators:13,externalResources:4,checks:['thirteen known-answer results','blank and invalid-macro rejection','unit conversions','stale result invalidation','result keyboard focus','320/390/430px reflow','automated accessibility','training data unchanged','no non-GET requests','entries cleared on route exit','header and library entries'],physicalIPhone:'UNVERIFIED'}))
} catch(error){console.error(JSON.stringify({error:error.message,page:page?await page.locator('body').innerText().catch(()=>null):null}));throw error}
finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r))}
