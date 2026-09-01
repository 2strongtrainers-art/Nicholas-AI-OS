import shard01 from "./catalog/websurfers-01.txt";
import shard02 from "./catalog/websurfers-02.txt";
import shard03 from "./catalog/websurfers-03.txt";
import shard04 from "./catalog/websurfers-04.txt";
import shard05 from "./catalog/websurfers-05.txt";
import shard06 from "./catalog/websurfers-06.txt";
import shard07 from "./catalog/websurfers-07.txt";
import shard08 from "./catalog/websurfers-08.txt";
import gaming01 from "../../../hermes/tool_registry/websurfers/gaming-tools-01.json";
import gaming02 from "../../../hermes/tool_registry/websurfers/gaming-tools-02.json";
import gaming03 from "../../../hermes/tool_registry/websurfers/gaming-tools-03.json";
import gaming04 from "../../../hermes/tool_registry/websurfers/gaming-tools-04.json";
import gaming05 from "../../../hermes/tool_registry/websurfers/gaming-tools-05.json";
import gaming06 from "../../../hermes/tool_registry/websurfers/gaming-tools-06.json";
import gaming07 from "../../../hermes/tool_registry/websurfers/gaming-tools-07.json";
import gaming08 from "../../../hermes/tool_registry/websurfers/gaming-tools-08.json";

type CompactRegistry = {
  v: number;
  cats: string[];
  subs: Array<string | null>;
  login: Record<string, number>;
  tools: Array<[string, string, number, number, number, string[], number]>;
};

type SupplementRecord = {
  n: string;
  u: string;
  c: string;
  s: string;
  p: string;
  k: string[];
  row: number;
  l?: string;
};

type Supplement = { source: string; records: SupplementRecord[] };

type AtlasTool = {
  id: string;
  name: string;
  url: string;
  domain: string;
  category: string;
  subcategory: string;
  pricing: "free" | "freemium" | "paid" | "unknown";
  keywords: string[];
  login: "not_required_claimed" | "required_claimed" | "unknown";
  source: string;
};

const CATALOG_B64 = [shard01, shard02, shard03, shard04, shard05, shard06, shard07, shard08]
  .join("")
  .replace(/\s+/g, "");
const GAMING: Supplement[] = [gaming01, gaming02, gaming03, gaming04, gaming05, gaming06, gaming07, gaming08] as Supplement[];
const PRICES: AtlasTool["pricing"][] = ["free", "freemium", "paid", "unknown"];
const DESIGN_START_INDEX = 270;
const DESIGN_END_INDEX_EXCLUSIVE = 270 + 366;
const INVALID_DESIGN_ROWS = new Set([40, 171]);
let atlasPromise: Promise<AtlasTool[]> | undefined;

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

function domainOf(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return "";
  }
}

function validHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function sourceForBaseIndex(index: number): string {
  if (index < 270) return "AI Tools";
  if (index < 636) return "Design & Creative";
  return "Education & Learning";
}

function assertCount(actual: number, expected: number, label: string): void {
  if (actual !== expected) throw new Error(`${label} count mismatch: expected ${expected}, got ${actual}`);
}

function makeTool(
  id: string,
  name: string,
  url: string,
  category: string,
  subcategory: string,
  pricing: string,
  keywords: string[],
  login: string,
  source: string,
): AtlasTool | null {
  const domain = domainOf(url);
  if (!name.trim() || !domain || !validHttpUrl(url)) return null;
  const normalizedPrice: AtlasTool["pricing"] = PRICES.includes(pricing as AtlasTool["pricing"])
    ? pricing as AtlasTool["pricing"]
    : "unknown";
  const normalizedLogin: AtlasTool["login"] = login === "not_required_claimed" || login === "required_claimed"
    ? login
    : "unknown";
  return {
    id,
    name: name.trim(),
    url: url.trim(),
    domain,
    category: category || "Other",
    subcategory: subcategory || "General",
    pricing: normalizedPrice,
    keywords: Array.isArray(keywords) ? keywords : [],
    login: normalizedLogin,
    source,
  };
}

async function loadAtlas(): Promise<AtlasTool[]> {
  if (atlasPromise) return atlasPromise;
  atlasPromise = (async () => {
    const binary = atob(CATALOG_B64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const body = new Blob([bytes.buffer as ArrayBuffer]).stream().pipeThrough(new DecompressionStream("gzip"));
    const compact = JSON.parse(await new Response(body).text()) as CompactRegistry;
    if (!Array.isArray(compact.tools)) throw new Error("Atlas base catalog is invalid");
    assertCount(compact.tools.length, 1414, "Atlas base");

    const tools: AtlasTool[] = [];
    compact.tools.forEach((record, index) => {
      const [name, url, categoryIndex, subcategoryIndex, priceIndex, keywords, sourceRow] = record;
      const isDesignRecord = index >= DESIGN_START_INDEX && index < DESIGN_END_INDEX_EXCLUSIVE;
      if (isDesignRecord && INVALID_DESIGN_ROWS.has(sourceRow)) return;
      const loginCode = compact.login[String(index)];
      const tool = makeTool(
        `ws-base-${String(index + 1).padStart(4, "0")}-${slug(name || "")}`,
        name || "",
        url || "",
        compact.cats[categoryIndex] || "",
        compact.subs[subcategoryIndex] || "",
        PRICES[priceIndex] || "unknown",
        keywords || [],
        loginCode === 0 ? "not_required_claimed" : loginCode === 1 ? "required_claimed" : "unknown",
        sourceForBaseIndex(index),
      );
      if (tool) tools.push(tool);
    });
    assertCount(tools.length, 1412, "Atlas filtered base");

    for (const supplement of GAMING) {
      for (const record of supplement.records || []) {
        const tool = makeTool(
          `ws-${String(tools.length + 1).padStart(4, "0")}-${slug(record.n || "")}`,
          record.n || "",
          record.u || "",
          record.c || "",
          record.s || "",
          record.p || "unknown",
          record.k || [],
          record.l || "unknown",
          "Gaming",
        );
        if (tool) tools.push(tool);
      }
    }
    assertCount(tools.length, 1800, "Atlas total");
    return tools;
  })();
  return atlasPromise;
}

function catalogResponse(tools: AtlasTool[]): Response {
  const categories = [...new Set(tools.map((t) => t.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const sources = [...new Set(tools.map((t) => t.source))];
  return new Response(JSON.stringify({
    ok: true,
    title: "Nick’s Digital Atlas",
    count: tools.length,
    domains: new Set(tools.map((t) => t.domain)).size,
    sources,
    categories,
    tools,
  }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}

const ATLAS_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0b0d12">
<title>Nick’s Digital Atlas — 1,800 Useful Websites</title>
<meta name="description" content="Search 1,800 curated AI, design, education, gaming and digital resources from Nick’s Digital Atlas.">
<style>
:root{color-scheme:dark;--bg:#0b0d12;--panel:#121621;--soft:#181e2b;--text:#f7f8fb;--muted:#aab3c2;--line:#293244;--accent:#7dd3fc;--accent2:#a7f3d0;--shadow:0 18px 60px rgba(0,0,0,.28)}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:radial-gradient(circle at 15% -5%,#14233a 0,transparent 35%),var(--bg);color:var(--text);font:15px/1.55 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
a{color:inherit}.wrap{max-width:1240px;margin:auto;padding:24px}.hero{padding:48px 0 26px}.eyebrow{display:inline-flex;gap:8px;align-items:center;border:1px solid var(--line);background:rgba(18,22,33,.72);padding:7px 11px;border-radius:999px;color:var(--accent2);font-weight:700;font-size:12px;letter-spacing:.03em}.dot{width:7px;height:7px;border-radius:99px;background:var(--accent2);box-shadow:0 0 15px var(--accent2)}h1{font-size:clamp(38px,7vw,76px);line-height:.98;letter-spacing:-.055em;margin:22px 0 18px;max-width:900px}.lead{font-size:clamp(17px,2.2vw,22px);color:var(--muted);max-width:820px;margin:0}.stats{display:flex;flex-wrap:wrap;gap:10px;margin:25px 0 0}.stat{border:1px solid var(--line);background:rgba(18,22,33,.76);border-radius:14px;padding:10px 13px;color:var(--muted)}.stat b{color:var(--text)}.controls{position:sticky;top:0;z-index:10;padding:13px 0;background:linear-gradient(var(--bg) 75%,transparent)}.bar{background:rgba(18,22,33,.94);backdrop-filter:blur(18px);border:1px solid var(--line);border-radius:20px;padding:12px;box-shadow:var(--shadow);display:grid;grid-template-columns:minmax(200px,2fr) repeat(3,minmax(130px,1fr));gap:9px}.input,.select{width:100%;height:46px;border:1px solid #34405a;background:#0e121a;color:var(--text);border-radius:12px;padding:0 13px;font:inherit;outline:none}.input:focus,.select:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(125,211,252,.12)}.results-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:26px 2px 14px}.results-head h2{font-size:22px;margin:0}.results-head p{margin:2px 0 0;color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.card{min-width:0;background:linear-gradient(180deg,#141925,#11151f);border:1px solid var(--line);border-radius:18px;padding:17px;display:flex;flex-direction:column;min-height:210px;transition:.18s ease}.card:hover{transform:translateY(-2px);border-color:#3b4b68}.top{display:flex;justify-content:space-between;gap:12px}.name{font-size:18px;font-weight:800;letter-spacing:-.015em;margin:0;overflow-wrap:anywhere}.domain{font-size:12px;color:#8fa0b8;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pill{height:max-content;white-space:nowrap;border:1px solid var(--line);border-radius:999px;padding:4px 8px;font-size:11px;text-transform:capitalize;color:var(--accent2)}.meta{margin:15px 0 0;color:var(--muted);font-size:13px}.meta b{color:#d8deea;font-weight:650}.keywords{margin:10px 0 14px;color:#8fa0b8;font-size:12px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.open{margin-top:auto;text-decoration:none;display:flex;justify-content:center;align-items:center;height:42px;border-radius:11px;background:var(--text);color:#0c0f15;font-weight:850}.open:hover{background:#dff5ff}.empty{display:none;border:1px dashed var(--line);border-radius:18px;padding:44px;text-align:center;color:var(--muted)}.pager{display:flex;justify-content:center;align-items:center;gap:10px;padding:28px 0 48px}.btn{border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:11px;padding:10px 15px;font-weight:700;cursor:pointer}.btn:disabled{opacity:.35;cursor:not-allowed}.foot{border-top:1px solid var(--line);color:var(--muted);padding:28px 0 50px}.foot strong{color:var(--text)}
@media(max-width:900px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.bar{grid-template-columns:1fr 1fr}.bar .input{grid-column:1/-1}}
@media(max-width:620px){.wrap{padding:17px}.hero{padding:30px 0 18px}.grid{grid-template-columns:1fr}.bar{grid-template-columns:1fr}.bar .input{grid-column:auto}.controls{top:-1px}.card{min-height:190px}.results-head{align-items:flex-start;flex-direction:column}}
</style>
</head>
<body>
<main class="wrap">
<section class="hero" aria-labelledby="title">
<div class="eyebrow"><span class="dot"></span> Web Surfers library · live directory</div>
<h1 id="title">Nick’s Digital Atlas</h1>
<p class="lead">Start with what you want to accomplish. Search the full resource library directly—no Notion detours, no placeholder buttons, and every result opens the website’s real URL.</p>
<div class="stats" aria-live="polite"><div class="stat"><b id="total">1,800</b> resources</div><div class="stat"><b id="domainCount">—</b> unique domains</div><div class="stat">AI · Design · Education · Gaming</div></div>
</section>
<section class="controls" aria-label="Search and filters"><div class="bar">
<input id="q" class="input" type="search" autocomplete="off" placeholder="Search: video editor, anatomy, Minecraft, 3D maps…" aria-label="Search resources">
<select id="source" class="select" aria-label="Filter by library"><option value="">All libraries</option></select>
<select id="category" class="select" aria-label="Filter by category"><option value="">All categories</option></select>
<select id="pricing" class="select" aria-label="Filter by pricing"><option value="">Any pricing</option><option value="free">Free</option><option value="freemium">Free / Paid</option><option value="paid">Paid</option><option value="unknown">Unknown</option></select>
</div></section>
<section aria-labelledby="resultsTitle"><div class="results-head"><div><h2 id="resultsTitle">Resource library</h2><p id="count">Loading catalog…</p></div><p id="pageInfo"></p></div><div id="grid" class="grid"></div><div id="empty" class="empty">No resources match those filters. Try a broader search.</div><div class="pager"><button id="prev" class="btn">Previous</button><span id="pages"></span><button id="next" class="btn">Next</button></div></section>
<footer class="foot"><strong>About this directory.</strong> Built from the Web Surfers resource spreadsheets and the normalized Nicholas AI catalog. Third-party sites can change, move or disappear; review a site before entering sensitive information or downloading files.</footer>
</main>
<script>
const state={tools:[],filtered:[],page:1,size:60};
const $=id=>document.getElementById(id);
const escText=v=>String(v??'');
function fillSelect(el,vals){for(const v of vals){const o=document.createElement('option');o.value=v;o.textContent=v;el.appendChild(o)}}
function normalize(s){return String(s||'').toLowerCase()}
function apply(){const q=normalize($('q').value).trim();const source=$('source').value;const cat=$('category').value;const pricing=$('pricing').value;state.filtered=state.tools.filter(t=>{if(source&&t.source!==source)return false;if(cat&&t.category!==cat)return false;if(pricing&&t.pricing!==pricing)return false;if(!q)return true;const hay=normalize([t.name,t.domain,t.category,t.subcategory,(t.keywords||[]).join(' ')].join(' '));return q.split(/\s+/).every(x=>hay.includes(x))});state.page=1;render()}
function card(t){const el=document.createElement('article');el.className='card';const top=document.createElement('div');top.className='top';const left=document.createElement('div');left.style.minWidth='0';const h=document.createElement('h3');h.className='name';h.textContent=escText(t.name);const d=document.createElement('div');d.className='domain';d.textContent=escText(t.domain);left.append(h,d);const p=document.createElement('span');p.className='pill';p.textContent=t.pricing==='freemium'?'Free / Paid':t.pricing;top.append(left,p);const meta=document.createElement('div');meta.className='meta';meta.innerHTML='<b></b>';meta.querySelector('b').textContent=escText(t.category);meta.append(document.createTextNode(' · '+escText(t.subcategory)+' · '+escText(t.source)));const kw=document.createElement('div');kw.className='keywords';kw.textContent=(t.keywords||[]).slice(0,10).join(' · ');const a=document.createElement('a');a.className='open';a.href=t.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Open website ↗';el.append(top,meta,kw,a);return el}
function render(){const total=state.filtered.length;const max=Math.max(1,Math.ceil(total/state.size));state.page=Math.min(state.page,max);const start=(state.page-1)*state.size;const rows=state.filtered.slice(start,start+state.size);$('grid').replaceChildren(...rows.map(card));$('grid').style.display=rows.length?'grid':'none';$('empty').style.display=rows.length?'none':'block';$('count').textContent=total.toLocaleString()+' matching resources';$('pageInfo').textContent=total?'Showing '+(start+1)+'–'+Math.min(start+state.size,total):'';$('pages').textContent='Page '+state.page+' of '+max;$('prev').disabled=state.page<=1;$('next').disabled=state.page>=max}
$('prev').addEventListener('click',()=>{if(state.page>1){state.page--;render();scrollTo({top:$('resultsTitle').offsetTop-90,behavior:'smooth'})}});$('next').addEventListener('click',()=>{if(state.page<Math.ceil(state.filtered.length/state.size)){state.page++;render();scrollTo({top:$('resultsTitle').offsetTop-90,behavior:'smooth'})}});['q','source','category','pricing'].forEach(id=>$(id).addEventListener(id==='q'?'input':'change',apply));
fetch('/atlas/catalog').then(r=>{if(!r.ok)throw new Error('Catalog unavailable');return r.json()}).then(data=>{state.tools=data.tools||[];$('total').textContent=Number(data.count||state.tools.length).toLocaleString();$('domainCount').textContent=Number(data.domains||0).toLocaleString();fillSelect($('source'),data.sources||[]);fillSelect($('category'),data.categories||[]);state.filtered=state.tools;render()}).catch(err=>{$('count').textContent='Catalog failed to load';$('empty').style.display='block';$('empty').textContent=err.message});
</script>
</body></html>`;

export async function handleAtlas(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method !== "GET") return null;
  if (url.pathname === "/atlas" || url.pathname === "/atlas/") {
    return new Response(ATLAS_HTML, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=300",
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin",
      },
    });
  }
  if (url.pathname === "/atlas/catalog") {
    try {
      return catalogResponse(await loadAtlas());
    } catch (error) {
      return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }), {
        status: 503,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }
  }
  return null;
}
