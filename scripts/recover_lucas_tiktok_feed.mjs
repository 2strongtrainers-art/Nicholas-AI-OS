import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const TARGET_HANDLE = 'lucaswebq';
const TARGET_URL = `https://www.tiktok.com/@${TARGET_HANDLE}`;
const OUT = process.env.LUCAS_FEED_OUT || path.join(process.cwd(), 'lucas-public-feed.json');

const chromeCandidates = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter((p) => fs.existsSync(p));

if (!chromeCandidates.length) {
  throw new Error(`No supported system Chromium browser found on ${process.platform}.`);
}

const browser = await chromium.launch({
  headless: true,
  executablePath: chromeCandidates[0],
  args: [
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
  ],
});

const context = await browser.newContext({
  locale: 'en-US',
  timezoneId: 'America/Los_Angeles',
  viewport: { width: 1440, height: 1000 },
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
});

const page = await context.newPage();
const rows = new Map();
const responseLog = [];
let lastCursor = null;
let hasMore = true;
let capturedPages = 0;

function addItems(items, sourceUrl) {
  for (const item of items || []) {
    if (!item?.id) continue;
    const author = item.author || {};
    const uniqueId = author.uniqueId || author.unique_id || TARGET_HANDLE;
    if (String(uniqueId).toLowerCase() !== TARGET_HANDLE) continue;
    rows.set(String(item.id), {
      id: String(item.id),
      desc: item.desc || '',
      createTime: item.createTime || item.create_time || null,
      webVideoUrl: `https://www.tiktok.com/@${TARGET_HANDLE}/video/${item.id}`,
      author: uniqueId,
      stats: item.stats || null,
      sourceResponseUrl: sourceUrl,
    });
  }
}

page.on('response', async (response) => {
  const url = response.url();
  if (!url.includes('/api/post/item_list/')) return;
  try {
    const data = await response.json();
    const items = data?.itemList || data?.item_list || [];
    addItems(items, url);
    lastCursor = data?.cursor ?? data?.maxCursor ?? data?.max_cursor ?? lastCursor;
    if (typeof data?.hasMore === 'boolean') hasMore = data.hasMore;
    if (typeof data?.has_more === 'boolean') hasMore = data.has_more;
    capturedPages += 1;
    responseLog.push({
      url,
      count: items.length,
      cursor: lastCursor,
      hasMore,
      status: response.status(),
    });
    console.log(`captured page ${capturedPages}: ${items.length} items, total=${rows.size}, hasMore=${hasMore}, cursor=${lastCursor}`);
  } catch (err) {
    console.warn('Failed to parse post/item_list response:', err?.message || String(err));
  }
});

try {
  console.log(`Opening ${TARGET_URL}`);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  // Pull any warm profile state embedded into the initial HTML as a fallback.
  const warmItems = await page.evaluate(() => {
    const candidates = [];
    const script = document.querySelector('#__UNIVERSAL_DATA_FOR_REHYDRATION__');
    if (script?.textContent) {
      try {
        const parsed = JSON.parse(script.textContent);
        const walk = (node, depth = 0) => {
          if (!node || typeof node !== 'object' || depth > 12) return;
          if (Array.isArray(node)) {
            for (const child of node) walk(child, depth + 1);
            return;
          }
          if (Array.isArray(node.itemList)) candidates.push(...node.itemList);
          if (Array.isArray(node.item_list)) candidates.push(...node.item_list);
          for (const value of Object.values(node)) walk(value, depth + 1);
        };
        walk(parsed);
      } catch {}
    }
    return candidates;
  });
  addItems(warmItems, 'embedded_profile_state');
  console.log(`warm state total=${rows.size}`);

  let unchanged = 0;
  let previousCount = rows.size;
  for (let i = 0; i < 90; i += 1) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.mouse.wheel(0, 6000);
    await page.waitForTimeout(1800);

    if (rows.size === previousCount) unchanged += 1;
    else unchanged = 0;
    previousCount = rows.size;

    if (hasMore === false && unchanged >= 2) break;
    if (unchanged >= 10) {
      console.log('No new posts after repeated scrolls; stopping to avoid an infinite loop.');
      break;
    }
  }

  const records = [...rows.values()].sort((a, b) => Number(b.createTime || 0) - Number(a.createTime || 0));
  const partRe = /Powerful\s+Website(?:s)?\s+You\s+Should\s+Know\s*\(Part\s*(\d+)\)/i;
  const partRecords = records.map((r) => {
    const m = r.desc.match(partRe);
    return { ...r, part: m ? Number(m[1]) : null };
  });
  const targetRecords = partRecords.filter((r) => r.part >= 351 && r.part <= 749);

  const payload = {
    creator: `@${TARGET_HANDLE}`,
    collectedAt: new Date().toISOString(),
    collectionMethod: 'public TikTok profile feed via browser page-context network responses; no login and no cookies persisted',
    browserExecutable: chromeCandidates[0],
    hostname: os.hostname(),
    platform: process.platform,
    totalPublicPostsCaptured: partRecords.length,
    targetPartsCaptured: targetRecords.length,
    targetPartMin: targetRecords.length ? Math.min(...targetRecords.map((r) => r.part)) : null,
    targetPartMax: targetRecords.length ? Math.max(...targetRecords.map((r) => r.part)) : null,
    responseLog,
    records: partRecords,
  };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${OUT}`);
  console.log(`Target Parts captured: ${targetRecords.length}`);

  if (targetRecords.length < 50) {
    console.warn('Low capture count; the workflow artifact is still useful for diagnosis.');
  }
} finally {
  await browser.close();
}
