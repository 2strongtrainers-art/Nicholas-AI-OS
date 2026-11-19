import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const root=path.resolve(process.argv[2]), shot=process.argv[3]||'/tmp/audit.png';
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.png':'image/png','.webp':'image/webp'};
let server, url=process.env.TV_LIVE_URL;
if(!url){server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!p.startsWith(root+path.sep)||!fs.existsSync(p)){res.writeHead(404);return res.end()};res.setHeader('Content-Type',types[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res)});await new Promise(r=>server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${server.address().port}/`}
const chrome=[process.env.CHROME_PATH,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(p=>p&&fs.existsSync(p));
const assert=(v,msg)=>{if(!v)throw Error(msg)};
let browser,page;const errors=[];
try{
 browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
 await page.goto(url+'#/home',{waitUntil:'networkidle0'});
 await page.evaluate(()=>{localStorage.setItem('tv_daily_verse_enabled_v1','false');localStorage.setItem('tv_daily_verse_seen_v1',new Date().toLocaleDateString('en-CA'))});
 await page.reload({waitUntil:'networkidle0'});
 // Optional support is a real public payment link, with corresponding-source credit preserved.
 assert(await page.$eval('.tv-support-link',n=>n.textContent==='Donate'&&n.href==='https://donate.stripe.com/bJe3cw6LUfnw8Z1biqf3a02'&&n.target==='_blank'),'Donation header link');
 const clickText=async text=>{await page.evaluate(text=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);if(!b)throw Error('Button missing: '+text);b.click()},text)};
 const openCheckin=async()=>{await page.click('[data-testid="tv-log-bodyweight"]');await page.waitForSelector('[role="dialog"] #tv-bodyweight-value');await page.waitForFunction(()=>getComputedStyle(document.querySelector('[role="dialog"]')).transform==='none')};
 await openCheckin();
 assert(await page.$eval('#tv-bodyweight-value',n=>n.value===''),'Invented body-weight default');
 assert(await page.$eval('[role="dialog"] button.primary',n=>n.disabled),'Blank body weight can be saved');
 assert(await page.evaluate(()=>document.activeElement?.id==='tv-bodyweight-value'),'Initial dialog focus');
 for(let i=0;i<18;i++){if(i>=9)await page.keyboard.down('Shift');await page.keyboard.press('Tab');if(i>=9)await page.keyboard.up('Shift');assert(await page.evaluate(()=>!!document.activeElement?.closest('[role="dialog"]')),'Dialog focus escaped')}
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));
 await page.waitForFunction(()=>document.activeElement?.dataset.testid==='tv-log-bodyweight',{timeout:3000});
 await openCheckin();await page.type('#tv-bodyweight-value','221.5');await page.click('[role="dialog"] button.primary');
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('gym_state_v1')).bodyweight.some(b=>b.w===221.5));
 await page.goto(url+'#/settings',{waitUntil:'networkidle0'});
 assert(await page.evaluate(()=>[...document.querySelectorAll('.seg button')].filter(b=>b.textContent==='kg'||b.textContent==='lb').some(b=>b.disabled)),'Saved weight does not lock alternate unit');
 await page.goto(url+'#/plan',{waitUntil:'networkidle0'});await page.waitForSelector('[data-testid="tv-add-program"]');await page.click('[data-testid="tv-add-program"]');
 await page.goto(url+'#/home',{waitUntil:'networkidle0'});await page.waitForSelector('[data-testid="tv-program-next-name"]');
 assert(!await page.$('[data-testid="tv-session-brief"]'),'Duplicate Home program guide');
 await page.click('[data-testid="tv-start-primary"]');await page.waitForSelector('#tv-bodyweight-value');await clickText('Start without weighing in');
 await page.waitForSelector('[data-testid="tv-poster-active"]');await clickText('One exercise');await page.waitForSelector('.setrow .w input');
 assert(await page.$eval('.setrow .w input',n=>n.getAttribute('aria-label')?.includes('set 1')),'Lifting weight field has no contextual name');
 await page.click('.setrow .w input',{clickCount:3});await page.keyboard.press('Backspace');await page.type('.setrow .w input','50');await page.keyboard.press('Tab');await page.click('.setrow [role="checkbox"]');
 await page.waitForSelector('#timer.rest');
 const timer=await page.evaluate(()=>JSON.parse(localStorage.getItem('tv_rest_timer_v1')));
 await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('#timer.rest');
 assert(await page.evaluate(t=>JSON.parse(localStorage.getItem('tv_rest_timer_v1')).endsAt===t.endsAt,timer),'Rest deadline reset on reload');
 assert(await page.$('button[aria-label="Add 15 seconds to rest"]'),'Rest increment has ambiguous name');
 await page.click('button[aria-label="Finish"]');await page.waitForFunction(()=>document.body.innerText.includes('Finish early?'));await clickText('Continue workout');
 assert(await page.evaluate(()=>!!JSON.parse(localStorage.getItem('gym_state_v1')).active),'Cancel finish lost active workout');
 await page.click('button[aria-label="Finish"]');await clickText('Save partial workout');await page.waitForFunction(()=>document.body.innerText.includes('Partial workout saved'));
 const w=await page.evaluate(()=>JSON.parse(localStorage.getItem('gym_state_v1')).workouts.at(-1));
 assert(w.partial===true&&w.entries.length===1&&w.entries[0].sets.length===1&&w.entries[0].sets[0].w===50,'Partial history credited unperformed sets');
 assert(await page.evaluate(()=>!localStorage.getItem('tv_rest_timer_v1')),'Finished rest timer left behind');
 await clickText('Nice!');await page.waitForFunction(()=>document.querySelector('[data-testid="tv-program-next-name"]')?.textContent==='Back & Biceps');
 await page.goto(url+'#/stats',{waitUntil:'networkidle0'});assert(await page.evaluate(()=>document.querySelector('h1')?.textContent==='Progress'),'Inconsistent Progress title');
 // Exact exercise details must have a readable heading and one full instruction block.
 await page.goto(url+'#/library',{waitUntil:'networkidle0'});await page.waitForSelector('input[type="search"]');await page.type('input[type="search"]','hamer curl');
 await page.waitForFunction(()=>document.body.innerText.includes('Did you mean'));
 await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Did you mean')).click());
 await page.waitForSelector('button[aria-label="View form and details for dumbbell hammer curl"]');await page.click('button[aria-label="View form and details for dumbbell hammer curl"]');
 await page.waitForSelector('.tv-exercise-detail-heading h3');assert(await page.$eval('.tv-exercise-detail-heading h3',n=>n.getBoundingClientRect().width>130),'Exercise heading collapsed');
 assert(await page.$$eval('[role="dialog"] ol',ns=>ns.length===1),'Full instructions are duplicated');
 await page.screenshot({path:shot,fullPage:true});
 await page.addScriptTag({content:fs.readFileSync(new URL('./node_modules/axe-core/axe.min.js',import.meta.url),'utf8')});
 const axe=await page.evaluate(async()=>await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));
 assert(!axe.violations.length,'Dialog accessibility: '+JSON.stringify(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))));
 assert(!errors.length,errors.join('; '));console.log(JSON.stringify({status:'FIRST_USER_AUDIT_FIXES_PASS',checks:['donation link','blank valid body-weight entry','modal initial focus, Tab, Shift+Tab, Escape, restore','unit lock','named lifting fields','rest deadline after reload','partial history and program day','progress title','typo suggestion','readable detail title','single full instructions','dialog accessibility'],physicalIPhoneAcceptance:'PENDING'}));
}catch(e){console.error(JSON.stringify({error:e.message,page:page?await page.evaluate(()=>document.body.innerText.slice(0,6000)).catch(()=>null):null}));if(page)await page.screenshot({path:shot,fullPage:true}).catch(()=>{});throw e}
finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r))}
