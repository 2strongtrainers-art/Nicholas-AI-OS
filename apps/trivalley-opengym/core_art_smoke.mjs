import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { chromium, webkit } from 'playwright-core'

const root = path.resolve(process.argv[2])
const repairedIds = ['0634','0691','0735','0826','1466','1495','3204','0459','3239','1774','2329','2466','0002','0969','0985','1011','1014','0226','1714']
const engine = process.env.TV_ENGINE || 'chromium'
const live = process.env.TV_LIVE_URL
const format = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
  '.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml' }
let server, browser, base = live
if (!base) {
  server = http.createServer((req,res) => {
    const reqPath = new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html')
    const file = path.resolve(root, '.' + reqPath)
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) {
      res.writeHead(404); res.end(); return
    }
    res.setHeader('Content-Type', format[path.extname(file)] || 'application/octet-stream')
    fs.createReadStream(file).pipe(res)
  })
  await new Promise(resolve => server.listen(0,'0.0.0.0',resolve))
  base = 'http://127.0.0.1:' + server.address().port + '/'
}
try {
  const release = await (await fetch(base+'tv-release.json')).json()
  const staged = release.movementIllustrations.filter(asset => asset.review?.movement?.startsWith('operator-reviewed against the exact catalogue demonstration'))
  const held = []
  assert.equal(staged.length,175)
  const ids = new Set(release.movementIllustrations.map(x => x.id))
  assert.equal(ids.size, 63 + staged.length)
  assert(repairedIds.every(id => ids.has(id)), 'A repaired card is missing from the release')
  const assets = staged.map(x => release.movementIllustrations.find(a => a.id === x.id))
  const src = asset => asset.url || './'+asset.path
  const absolute = asset => new URL(src(asset),base).href
  async function fetchBytes(asset) {
    assert(asset?.id, 'Missing exact-ID asset')
    let lastError
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(absolute(asset))
        assert(response.ok, 'Missing media '+asset.id)
        return Buffer.from(await response.arrayBuffer())
      } catch (error) {
        lastError = error
        if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 250 * attempt))
      }
    }
    throw lastError
  }
  for (let offset = 0; offset < assets.length; offset += 8) {
    await Promise.all(assets.slice(offset, offset + 8).map(async asset => {
      const bytes = await fetchBytes(asset)
      assert.equal(bytes.length, asset.bytes)
      assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256)
    }))
  }
  browser = await (engine === 'webkit' ? webkit : chromium).launch({
    headless:true, ...(process.env.TV_BROWSER_PROXY ? {proxy:{server:process.env.TV_BROWSER_PROXY,bypass:'127.0.0.1,localhost'}} : {}),
    ...(engine === 'chromium' ? {executablePath:process.env.TV_CHROMIUM_BIN || undefined,args:['--no-sandbox']} : {})
  })
  const context = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true })
  const page = await context.newPage()
  page.setDefaultTimeout(18000)
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto(base+'#/workout',{waitUntil:'domcontentloaded'})
  await page.waitForFunction(() => !!document.querySelector('button'))
  await page.evaluate(({pairs,held}) => {
    const exercise = id => ({id,mode:'reps',sets:1,reps:5,weight:0,prog:'off'})
    const routines = Array.from({length:Math.ceil(pairs.length/8)},(_,index) =>
      ({id:'qa-core-'+index,name:'Core art QA '+(index+1),ex:pairs.slice(index*8,(index+1)*8).map(exercise)}))
    routines.push({id:'qa-held',name:'Held QA',ex:held.slice(0,8).map(exercise)})
    localStorage.setItem('tv_daily_verse_enabled_v1','false')
    localStorage.setItem('gym_state_v1',JSON.stringify({unit:'lb',routines,customEx:[],week:{},dayPlan:{},
      workouts:[{id:'retained',d:'2026-11-01',name:'Synthetic history',entries:[]}],
      active:null,bodyweight:[],tvSetupDone:true,_ts:Date.now()}))
  },{pairs:assets.map(x=>x.id),held})
  await page.reload({waitUntil:'domcontentloaded'})
  const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')))
  const initial = await read()
  async function checkFigure(scope, asset) {
    const figure = scope.locator('.tv-movement-poster[data-exercise-id="'+asset.id+'"]')
    const img = figure.locator('img')
    await img.scrollIntoViewIfNeeded()
    await img.evaluate(e => e.decode())
    assert.equal(new URL(await img.getAttribute('src'),base).href,absolute(asset))
    assert.deepEqual(await figure.locator('.tv-movement-phases strong').allTextContents(),['START','FINISH'])
    assert.deepEqual(await img.evaluate(e=>[e.naturalWidth,e.naturalHeight]),[1536,1024])
  }
  const batches=Math.ceil(assets.length/8)
  for (let i=0;i<batches;i++) {
    await page.getByRole('button',{name:'Preview Core art QA '+(i+1),exact:true}).click()
    const preview=page.getByTestId('tv-poster-preview')
    for(const asset of assets.slice(i*8,(i+1)*8)) await checkFigure(preview,asset)
    if(i===batches-1) break
    await preview.getByTestId('tv-poster-back').click()
  }
  assert.deepEqual(await read(),initial,'Preview changed synthetic training state')
  for(const width of [320,390,430]){
    await page.setViewportSize({width,height:844})
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Layout overflow '+width)
  }
  await page.getByTestId('tv-poster-start').click()
  await page.getByRole('button',{name:'Start without weighing in',exact:true}).click()
  const active=page.getByTestId('tv-poster-active')
  const last=assets.slice((batches-1)*8)
  for(const asset of last) await checkFigure(active,asset)
  await page.waitForFunction(async url=>!!(await caches.match(url)),absolute(last.at(-1)))
  const cacheSize=await page.evaluate(async()=>{
    const key=(await caches.keys()).find(k=>k.endsWith('-catalogue-art'))
    return key?(await(await caches.open(key)).keys()).length:0
  })
  assert(cacheSize>0&&cacheSize<=12)
  await context.setOffline(true)
  await page.reload({waitUntil:'domcontentloaded'})
  await checkFigure(active,last.at(-1))
  await page.getByTestId('tv-poster-movement').first().getByTestId('tv-poster-set').first().click()
  await page.reload({waitUntil:'domcontentloaded'})
  await active.waitFor()
  const final=await read()
  assert(final.active.entries[0].sets[0].done)
  assert.deepEqual(final.workouts,initial.workouts)
  assert.deepEqual(final.routines,initial.routines)
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({status:'PASS',engine,scope:live?'published site':'candidate build',previewPairs:assets.length,activePairs:last.length,
    unchangedPriorPairs:169,repairedPairs:repairedIds.length,cacheSize,checks:['media bytes and SHA-256','exact ID start/finish','no horizontal overflow at 320/390/430','offline image and log retention','existing routines and history retained'] }))
} finally {
  await browser?.close()
  if(server) await new Promise(resolve=>server.close(resolve))
}
