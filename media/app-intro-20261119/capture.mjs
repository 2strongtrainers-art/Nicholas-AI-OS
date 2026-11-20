import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
const root=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]);fs.mkdirSync(out,{recursive:true});
const release=JSON.parse(fs.readFileSync(path.join(root,'tv-release.json')));if(release.version!=='5.11.0'||release.sourceCommit!=='7ede5600a02bf16278cfaf09912bcc1a3b05988b')throw Error('Unexpected app build');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404);return res.end()}res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true});const ctx=await browser.newContext({viewport:{width:390,height:680},deviceScaleFactor:2,isMobile:true,hasTouch:true,timezoneId:'America/Los_Angeles'});const p=await ctx.newPage();p.setDefaultTimeout(12000);
const errors=[];p.on('pageerror',e=>errors.push(e.message));const events=[];
const snap=async name=>{await p.screenshot({path:path.join(out,name+'.png')});};
const go=async (name,fn)=>{await fn();await p.waitForTimeout(350);await snap(name);events.push({name,url:p.url()});};
try{
await p.goto(`http://127.0.0.1:${server.address().port}/#/home`,{waitUntil:'networkidle'});await p.evaluate(()=>localStorage.setItem('tv_daily_verse_enabled_v1','false'));await p.reload({waitUntil:'networkidle'});
await snap('01-home');
await go('02-programs',()=>p.getByRole('button',{name:'Programs',exact:true}).click());
await p.locator('[data-testid="tv-preview-program-0"]').scrollIntoViewIfNeeded();await snap('03-choice');
await go('04-brief',()=>p.locator('[data-testid="tv-preview-program-0"]').click());
await p.locator('[data-testid="tv-poster-start"]').scrollIntoViewIfNeeded();await snap('05-start');
await go('06-check-in',()=>p.locator('[data-testid="tv-poster-start"]').click());
await go('07-active',()=>p.getByRole('button',{name:'Start without weighing in',exact:true}).click());
const fields=p.locator('[data-testid="tv-inline-set-fields"] input');await fields.first().scrollIntoViewIfNeeded();await snap('08-fields');
await fields.nth(0).fill('35');await fields.nth(0).press('Tab');await fields.nth(1).fill('10');await fields.nth(1).press('Tab');await snap('09-entered');
await go('10-rest',()=>p.locator('[data-testid="tv-poster-set"]').first().click());
await p.getByRole('button',{name:'Skip',exact:true}).click();await p.waitForTimeout(300);await snap('11-finish');
// Separate demo history in a fresh browser profile. Never access real client storage.
await p.evaluate(()=>{const S=JSON.parse(localStorage.getItem('gym_state_v1'));const day=o=>{const d=new Date();d.setDate(d.getDate()+o);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};S.active=null;S.workouts=[0,-2,-4].map((d,i)=>({id:'tutorial-demo-'+i,d:day(d),end:Date.now()+d*86400000-60000,unit:'lb',entries:[{id:'0294',target:{mode:'reps'},sets:Array.from({length:3},()=>({w:25,r:10,done:true}))}]}));localStorage.setItem('gym_state_v1',JSON.stringify(S));});
await p.reload({waitUntil:'networkidle'});await go('12-progress',()=>p.getByRole('button',{name:'Progress',exact:true}).click());
const weekly=p.locator('[data-testid="tv-progress-summary"]');await weekly.scrollIntoViewIfNeeded();await snap('13-weekly');
if(await p.locator('[data-testid="tv-summary-sessions"]').textContent()!=='3')throw Error('Demo history not counted');
// The settings route is linked by the public More menu; capture its visible backup controls.
await p.goto(`http://127.0.0.1:${server.address().port}/#/settings`,{waitUntil:'networkidle'});await snap('14-settings');
fs.writeFileSync(path.join(out,'settings-text.txt'),await p.locator('body').innerText());
const backup=p.getByRole('button',{name:/backup|Back up/i}).first();if(await backup.count())await backup.scrollIntoViewIfNeeded();await snap('15-backup');
fs.writeFileSync(path.join(out,'capture-receipt.json'),JSON.stringify({version:release.version,sourceCommit:release.sourceCommit,syntheticData:true,viewport:{width:390,height:680,deviceScaleFactor:2},events,errors},null,2));if(errors.length)throw Error(errors.join(';'));
console.log('TUTORIAL_CAPTURE_PASS');
}catch(e){await snap('capture-error');console.error(e.message);console.error(await p.locator('body').innerText());throw e}finally{await browser.close();server.close();}
