import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { chromium, webkit } from 'playwright-core'

const root = path.resolve(process.argv[2])
const repairedIds = ['0634','0691','0735','0826','1466','1495','3204','0459','3239','1774','2329','2466','0002','0969','0985','1011','1014','0226','1714']
const batch9Ids = new Set(['0279','0283','0284','0285','0291','0293','0295','0298','0299','0300','0301','0302','0309','0311','1201','1646','1647','1648','1654','1731','2137','3016','3545','3635','3769'])
const batch10Ids = new Set(['0023','0024','0026','0028','0029','0030','0031','0033','0034','0035','0036','0037','0038','0039','0041','0042','0043','1013','1016','1017','1255','1316','1369','1370','2407'])
const batch11Ids = new Set(['0044','0046','0047','0048','0049','0050','0051','0052','0053','0054','0055','0056','0057','0058','0059','0063','1409','1410','1435','1461','1462','1545','1719','1720','3562'])
const batch12Ids = new Set(['0022','0045','0060','0061','0064','0065','0066','0067','0068','0069','0070','0072','0073','0074','0075','0076','0077','0078','0079','0080','1411','1412','1751','2187','3017'])
const batch13Ids = new Set(['0040','0081','0082','0083','0084','0086','0087','0088','0089','0090','0091','0092','0095','0096','0097','0098','0099','0118','1256','1257','1317','1371','1718','1721','1756'])
const batch14Ids = new Set(['0100','0101','0102','0103','0104','0106','0107','0108','0109','0110','0111','0112','0113','0114','0115','0116','0120','1372','1456','1457','1629','2798','2799','2810','3305'])
const batch15Ids = new Set(['0119','0121','0122','1258','0124','0123','0126','0125','0127','3212','0128','3360','1259','0129','1399','0130','0139','0140','3543','1771','1374','1160','1494','0148','0151'])
const batch16Ids = new Set(["0149", "3235", "0150", "1630", "1631", "0152", "0153", "0154", "0155", "0868", "0157", "0158", "1260", "1261", "0159", "1632", "0160", "0161", "0162", "0164", "0165", "1722", "0167", "0168", "0169"])
const batch17Ids = new Set(["1318", "0171", "0170", "0172", "0173", "0174", "0860", "3697", "0176", "0177", "2616", "0178", "0179", "0180", "1634", "0182", "0184", "0185", "0186", "0188", "0189", "0190", "1262", "1263", "1264"])
const batch18Ids = new Set(["1265", "1266", "1267", "1633", "1635", "1769", "1770", "2414", "2800", "3019", "3156", "3158", "3161", "3162", "3165", "3166", "3167", "3168", "3563", "0105", "0137", "0191", "0192", "0193", "1723"])
const batch19Ids = new Set(['1636','1637','1319','0195','1268','0196','0198','0197','1638','0201','0199','0202','0203','0204','0205','0206','2406','1413','0209','0210','0207','0208','1320','1321','1322'])
const batch20Ids = new Set(["1639", "1724", "1725", "1726", "1640", "1323", "2144", "1641", "0213", "0214", "1642", "1643", "0215", "0216", "2399", "0218", "0219", "0220", "0221", "1717", "1644", "0224", "1375", "0225", "2331"])
const batch21Ids = new Set(["1274", "1275", "2403", "0286", "1649", "1650", "0287", "0288", "0290", "1651", "1652", "1653", "2401", "1655", "1656", "0296", "1657", "2136", "0303", "1276", "1617", "0305", "0304", "0306", "0307"])
const batch22Ids = new Set(["1437", "1277", "1732", "1659", "0312", "2402", "1664", "0315", "0316", "0318", "0317", "0319", "1278", "0320", "0321", "1618", "0322", "1279", "1280", "1619", "1620", "0323", "1281", "1282", "0324"])
const batch23Ids = new Set(["1283", "0325", "0326", "0327", "0328", "0329", "3542", "0330", "0331", "1733", "3541", "0332", "1734", "1660", "0335", "1658", "0337", "1729", "0338", "0863", "0339", "0340", "2470", "0341", "0343"])
const batch24Ids = new Set(["0342", "0344", "0345", "0346", "0347", "2705", "1284", "1328", "0348", "1735", "0349", "2706", "1661", "0350", "0351", "1662", "0352", "1285", "0292", "1286", "0353", "1287", "1288", "1736", "1663"])
const batch25Ids = new Set(["1621", "1289", "0354", "0355", "0356", "1290", "1665", "1666", "1291", "0358", "0359", "1622", "1414", "1667", "1668", "1669", "1415", "0361", "0360", "3888", "1670", "1671", "0362", "0363", "0364"])
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
  const staged = release.movementIllustrations.filter(asset => asset.review?.movement?.startsWith('operator-reviewed against the exact catalogue demonstration') && !batch9Ids.has(asset.id) && !batch10Ids.has(asset.id) && !batch11Ids.has(asset.id) && !batch12Ids.has(asset.id) && !batch13Ids.has(asset.id) && !batch14Ids.has(asset.id) && !batch15Ids.has(asset.id) && !batch16Ids.has(asset.id) && !batch17Ids.has(asset.id) && !batch18Ids.has(asset.id) && !batch19Ids.has(asset.id) && !batch20Ids.has(asset.id) && !batch21Ids.has(asset.id) && !batch22Ids.has(asset.id) && !batch23Ids.has(asset.id) && !batch24Ids.has(asset.id) && !batch25Ids.has(asset.id))
  const held = []
  assert.equal(staged.length,200)
  const ids = new Set(release.movementIllustrations.map(x => x.id))
  assert.equal(ids.size, 63 + staged.length + batch9Ids.size + batch10Ids.size + batch11Ids.size + batch12Ids.size + batch13Ids.size + batch14Ids.size + batch15Ids.size + batch16Ids.size + batch17Ids.size + batch18Ids.size + batch19Ids.size + batch20Ids.size + batch21Ids.size + batch22Ids.size + batch23Ids.size + batch24Ids.size + batch25Ids.size)
  assert(repairedIds.every(id => ids.has(id)), 'A repaired card is missing from the release')
  const assets = [...staged, ...[...batch12Ids, ...batch13Ids, ...batch14Ids, ...batch15Ids, ...batch16Ids, ...batch17Ids, ...batch18Ids, ...batch19Ids, ...batch20Ids,...batch21Ids, ...batch22Ids, ...batch23Ids, ...batch24Ids, ...batch25Ids].map(id => release.movementIllustrations.find(a => a.id === id))]
  assert(assets.every(Boolean), 'A Batch 12 through 21 card is missing from the release')
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
    assert.deepEqual(
      await img.evaluate(e=>[e.naturalWidth,e.naturalHeight]),
      [asset.width,asset.height],
      'Rendered media dimensions must match the exact-ID manifest'
    )
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
    unchangedPriorPairs:194,repairedPairs:repairedIds.length,cacheSize,checks:['media bytes and SHA-256','exact ID start/finish','no horizontal overflow at 320/390/430','offline image and log retention','existing routines and history retained'] }))
} finally {
  await browser?.close()
  if(server) await new Promise(resolve=>server.close(resolve))
}
