export const ATLAS_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0b0d12">
<title>Nick’s Digital Atlas — Find the Right Tool</title>
<meta name="description" content="Describe what you want to accomplish and Nick’s Digital Atlas will rank useful tools and websites from a curated 1,800-resource library.">
<style>
:root{color-scheme:dark;--bg:#090c12;--panel:#111722;--panel2:#151d2b;--soft:#1a2433;--text:#f7f9fc;--muted:#a9b5c7;--line:#263348;--line2:#35465f;--accent:#78d5ff;--mint:#9cf2cf;--gold:#f4d38a;--danger:#ffb0b9;--shadow:0 22px 70px rgba(0,0,0,.32)}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:radial-gradient(circle at 12% -8%,#152844 0,transparent 33%),radial-gradient(circle at 88% 12%,#13251f 0,transparent 28%),var(--bg);color:var(--text);font:15px/1.55 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
button,input,select{font:inherit}
a{color:inherit}
.skip{position:absolute;left:-9999px;top:auto}
.skip:focus{left:14px;top:14px;z-index:99;background:#fff;color:#111;padding:10px 12px;border-radius:10px}
.shell{max-width:1220px;margin:auto;padding:0 22px 60px}
.topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 0}
.brand{display:flex;align-items:center;gap:10px;font-weight:850;letter-spacing:-.02em}
.mark{width:34px;height:34px;border-radius:11px;background:linear-gradient(145deg,#1b3852,#17362c);border:1px solid var(--line2);display:grid;place-items:center}
.live{display:flex;align-items:center;gap:7px;color:var(--muted);font-size:12px}
.dot{width:7px;height:7px;border-radius:50%;background:var(--mint);box-shadow:0 0 14px rgba(156,242,207,.75)}
.hero{padding:48px 0 30px}
.eyebrow{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);background:rgba(17,23,34,.78);padding:7px 11px;border-radius:999px;color:var(--mint);font-weight:750;font-size:12px;letter-spacing:.03em}
h1{font-size:clamp(44px,7.7vw,88px);line-height:.94;letter-spacing:-.06em;margin:20px 0 18px;max-width:950px}
.lead{font-size:clamp(18px,2.2vw,23px);color:var(--muted);max-width:850px;margin:0}
.command{margin-top:30px;max-width:970px}
.commandbox{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;padding:8px;border:1px solid var(--line2);border-radius:20px;background:rgba(17,23,34,.92);box-shadow:var(--shadow)}
.input{width:100%;height:58px;border:0;background:transparent;color:var(--text);padding:0 15px;font-size:17px;outline:none;min-width:0}
.input::placeholder{color:#77869a}
.searchbtn{height:58px;border:0;border-radius:14px;padding:0 22px;background:var(--text);color:#0b0f16;font-weight:900;cursor:pointer;min-width:112px}
.searchbtn:active{transform:translateY(1px)}
.hint{margin:10px 3px 0;color:var(--muted);font-size:13px}
.quick{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.chip,.goal,.filterbtn{border:1px solid var(--line);background:rgba(17,23,34,.82);color:var(--text);cursor:pointer}
.chip{min-height:38px;border-radius:999px;padding:8px 12px;font-size:13px}
.chip:hover,.chip:focus-visible,.goal:hover,.goal:focus-visible,.filterbtn:hover,.filterbtn:focus-visible{border-color:var(--accent)}
.trust{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px;color:var(--muted);font-size:13px}
.trust span{border:1px solid var(--line);border-radius:999px;padding:6px 9px;background:rgba(9,12,18,.45)}
.section{padding:24px 0}
.sectionhead{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:14px}
.sectionhead h2{font-size:24px;letter-spacing:-.025em;margin:0}
.sectionhead p{margin:3px 0 0;color:var(--muted)}
.goals{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.goal{border-radius:18px;padding:18px;text-align:left;min-height:122px}
.goal.active{border-color:var(--accent);background:linear-gradient(180deg,rgba(120,213,255,.11),rgba(17,23,34,.95))}
.goal .icon{font-size:23px}
.goal b{display:block;font-size:17px;margin-top:11px}
.goal span{display:block;color:var(--muted);font-size:13px;margin-top:3px}
.library{scroll-margin-top:12px}
.toolbar{position:sticky;top:0;z-index:10;padding:10px 0;background:linear-gradient(var(--bg) 78%,transparent)}
.filters{display:grid;grid-template-columns:minmax(190px,1.5fr) repeat(3,minmax(125px,.8fr)) auto;gap:8px;padding:10px;background:rgba(17,23,34,.94);backdrop-filter:blur(18px);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow)}
.miniq,.select{width:100%;height:44px;border:1px solid #33435c;background:#0e141e;color:var(--text);border-radius:11px;padding:0 12px;outline:none;min-width:0}
.miniq:focus,.select:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(120,213,255,.12)}
.filterbtn{height:44px;border-radius:11px;padding:0 13px;font-weight:750}
.resultshead{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:18px 2px 12px}
.resultshead h2{margin:0;font-size:22px}
.resultshead p{margin:2px 0 0;color:var(--muted)}
.mode{color:var(--mint);font-size:12px;font-weight:750;text-align:right}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}
.card{min-width:0;background:linear-gradient(180deg,#141b27,#101620);border:1px solid var(--line);border-radius:18px;padding:17px;display:flex;flex-direction:column;min-height:270px;transition:.16s ease}
.card:hover{transform:translateY(-2px);border-color:#3d506d}
.cardtop{display:flex;justify-content:space-between;gap:12px}
.name{font-size:18px;font-weight:850;letter-spacing:-.018em;margin:0;overflow-wrap:anywhere}
.domain{font-size:12px;color:#8191a9;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.badges{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}
.badge{height:max-content;white-space:nowrap;border:1px solid var(--line);border-radius:999px;padding:4px 7px;font-size:10px;text-transform:uppercase;letter-spacing:.03em}
.badge.free{color:var(--mint)}.badge.login{color:var(--accent)}
.meta{margin:13px 0 0;color:var(--muted);font-size:13px}.meta b{color:#dce4ef}
.why{margin:13px 0 0;padding:11px 12px;border-radius:12px;background:#0d131c;border:1px solid #202d40;color:#bdc9d9;font-size:12px}
.why b{color:var(--gold)}
.keywords{margin:10px 0 14px;color:#8292aa;font-size:12px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.open{margin-top:auto;text-decoration:none;display:flex;justify-content:center;align-items:center;min-height:44px;border-radius:11px;background:var(--text);color:#0c1017;font-weight:900}
.open:hover{background:#dff5ff}
.empty,.error{display:none;border:1px dashed var(--line2);border-radius:18px;padding:42px;text-align:center;color:var(--muted)}
.error{border-style:solid;border-color:#643943;color:#ffd7db;background:#211217}
.retry{margin-top:12px}
.pager{display:flex;justify-content:center;align-items:center;gap:10px;padding:28px 0 42px}
.pagebtn{border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:11px;padding:10px 15px;font-weight:750;cursor:pointer;min-height:44px}
.pagebtn:disabled{opacity:.35;cursor:not-allowed}
.footer{border-top:1px solid var(--line);color:var(--muted);padding:28px 0 10px;display:grid;grid-template-columns:2fr 1fr;gap:18px}
.footer strong{color:var(--text)}
.small{font-size:12px}
@media(max-width:930px){.goals{grid-template-columns:repeat(2,minmax(0,1fr))}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.filters{grid-template-columns:1fr 1fr}.filters .miniq{grid-column:1/-1}}
@media(max-width:640px){
.shell{padding:0 14px 44px}.topbar{padding:13px 0}.hero{padding:31px 0 22px}h1{font-size:clamp(44px,14vw,64px)}
.lead{font-size:17px}.command{margin-top:22px}.commandbox{grid-template-columns:1fr;padding:7px}.input{height:52px;font-size:16px}.searchbtn{height:50px;width:100%}
.goals{grid-template-columns:1fr 1fr;gap:8px}.goal{padding:14px;min-height:118px}.goal b{font-size:15px}.section{padding:19px 0}
.toolbar{top:-1px}.filters{grid-template-columns:1fr 1fr;padding:8px}.filters .miniq{grid-column:1/-1}.filters .filterbtn{grid-column:1/-1}
.miniq,.select{font-size:16px}.grid{grid-template-columns:1fr}.card{min-height:245px}.resultshead{align-items:flex-start;flex-direction:column}.mode{text-align:left}
.footer{grid-template-columns:1fr}.brandtext{display:none}.live{font-size:11px}
}
@media(max-width:390px){.goals{grid-template-columns:1fr}.goal{min-height:auto}.filters{grid-template-columns:1fr}.filters .miniq,.filters .filterbtn{grid-column:auto}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.card{transition:none}}
</style>
</head>
<body>
<a class="skip" href="#library">Skip to resource library</a>
<main class="shell">
<header class="topbar">
<div class="brand"><span class="mark" aria-hidden="true">✦</span><span class="brandtext">Nick’s Digital Atlas</span></div>
<div class="live"><span class="dot" aria-hidden="true"></span><span>Live catalog · Atlas 3.0</span></div>
</header>

<section class="hero" aria-labelledby="title">
<div class="eyebrow">AI · tools · useful websites</div>
<h1 id="title">What are you trying to accomplish?</h1>
<p class="lead">Describe the outcome in normal language. Atlas ranks useful places to go next, then explains why each result may fit.</p>

<form id="commandForm" class="command" role="search">
<div class="commandbox">
<input id="commandInput" class="input" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" autocapitalize="sentences" placeholder="Example: I need a free tool to turn a PDF into a narrated video" aria-label="Describe what you want to accomplish">
<button class="searchbtn" type="submit">Find my route</button>
</div>
<p class="hint">Tip: include constraints such as “free,” “no login,” “for research,” “on my phone,” or the kind of result you want.</p>
</form>

<div class="quick" aria-label="Example searches">
<button class="chip" type="button" data-query="free AI video editor">Free AI video</button>
<button class="chip" type="button" data-query="research papers and academic sources">Research papers</button>
<button class="chip" type="button" data-query="build a website without coding">Build a website</button>
<button class="chip" type="button" data-query="3D maps GIS terrain">3D maps / GIS</button>
<button class="chip" type="button" data-query="business marketing automation">Business automation</button>
</div>

<div class="trust" aria-live="polite">
<span><b id="total">1,800</b> curated resources</span>
<span><b id="domainCount">—</b> unique domains</span>
<span>Direct website links</span>
<span>Source transparency</span>
</div>
</section>

<section class="section" aria-labelledby="goalTitle">
<div class="sectionhead"><div><h2 id="goalTitle">Start with a goal</h2><p>You do not need to know the name of a tool.</p></div></div>
<div class="goals">
<button class="goal" type="button" data-goal="create"><span class="icon">◈</span><b>Make something</b><span>Video, images, audio, writing, presentations and design.</span></button>
<button class="goal" type="button" data-goal="research"><span class="icon">⌕</span><b>Research something</b><span>Search, papers, data, references, science and maps.</span></button>
<button class="goal" type="button" data-goal="business"><span class="icon">↗</span><b>Earn or run a business</b><span>Marketing, sales, websites, productivity and commerce.</span></button>
<button class="goal" type="button" data-goal="learn"><span class="icon">◎</span><b>Learn something</b><span>Courses, tutorials, study tools and educational resources.</span></button>
<button class="goal" type="button" data-goal="automate"><span class="icon">⚙</span><b>Automate work</b><span>Agents, workflows, APIs, integrations and coding tools.</span></button>
<button class="goal" type="button" data-goal="explore"><span class="icon">✦</span><b>Explore the library</b><span>Browse everything when you are not sure what is possible.</span></button>
</div>
</section>

<section id="library" class="section library" aria-labelledby="resultsTitle">
<div class="toolbar">
<div class="filters">
<input id="q" class="miniq" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" placeholder="Search the full library…" aria-label="Search the full library">
<select id="source" class="select" aria-label="Filter by source library"><option value="">All source libraries</option></select>
<select id="category" class="select" aria-label="Filter by category"><option value="">All categories</option></select>
<select id="pricing" class="select" aria-label="Filter by pricing"><option value="">Any pricing</option><option value="free">Free</option><option value="freemium">Free / Paid</option><option value="paid">Paid</option><option value="unknown">Unknown</option></select>
<button id="clear" class="filterbtn" type="button">Clear filters</button>
</div>
</div>

<div class="resultshead">
<div><h2 id="resultsTitle">Recommended resources</h2><p id="count">Loading the live catalog…</p></div>
<div><div id="mode" class="mode">Loading Atlas…</div><div id="pageInfo" class="small"></div></div>
</div>
<div id="grid" class="grid" aria-live="polite"></div>
<div id="empty" class="empty">No strong matches yet. Try fewer words, a broader goal, or clear a filter.</div>
<div id="error" class="error"><b>Atlas could not load the catalog.</b><div id="errorText"></div><button id="retry" class="pagebtn retry" type="button">Try again</button></div>
<div class="pager"><button id="prev" class="pagebtn" type="button">Previous</button><span id="pages"></span><button id="next" class="pagebtn" type="button">Next</button></div>
</section>

<footer class="footer">
<div><strong>How Atlas chooses.</strong><br>Results are ranked from the tool name, category, subcategory, source, keywords, pricing and stated login requirement. Atlas does not claim that a third-party site is safe or suitable merely because it appears in the directory.</div>
<div class="small"><strong>Data note.</strong><br>Built from the normalized Nicholas AI / Web Surfers catalog. Third-party websites can change, move, add paywalls or disappear.</div>
</footer>
</main>

<script>
(function(){
'use strict';

var state={tools:[],filtered:[],page:1,size:24,goal:'',query:'',loading:true};
var $=function(id){return document.getElementById(id)};
var STOP=new Set(['a','an','and','are','as','at','be','for','from','i','in','is','it','me','my','of','on','or','the','to','tool','tools','want','with','without','need','find','help']);
var SYN={
video:['video','editor','editing','animation','motion','reel','reels','shorts'],
image:['image','photo','picture','design','graphic','graphics'],
picture:['image','photo','picture','design','graphic'],
research:['research','search','academic','paper','papers','scholar','reference','data'],
paper:['paper','papers','academic','research','scholar','journal'],
website:['website','web','site','builder','hosting','development'],
code:['code','coding','developer','development','programming'],
map:['map','maps','mapping','gis','geospatial','terrain'],
business:['business','marketing','sales','crm','commerce','productivity','seo'],
learn:['learn','learning','education','course','tutorial','study','training'],
automate:['automate','automation','workflow','agent','agents','integration','api','productivity'],
audio:['audio','voice','speech','music','sound','podcast'],
write:['write','writing','writer','text','copy','content'],
presentation:['presentation','slides','deck','powerpoint'],
free:['free','freemium'],
phone:['mobile','iphone','ios','phone'],
beginner:['beginner','easy','simple','no-code','nocode']
};
var GOALS={
create:['design','creative','video','image','photo','audio','music','writing','content','presentation','3d','animation'],
research:['research','search','data','academic','paper','science','reference','analysis','news','map','gis','geospatial'],
business:['business','marketing','sales','crm','finance','commerce','productivity','website','social','seo'],
learn:['education','learning','course','tutorial','study','training','reference','language'],
automate:['automation','workflow','agent','api','integration','code','developer','productivity'],
explore:[]
};

function norm(v){return String(v||'').toLowerCase().normalize('NFKD').replace(/[^\w\s.-]+/g,' ').replace(/\s+/g,' ').trim()}
function tokens(q){return norm(q).split(' ').filter(function(x){return x.length>1&&!STOP.has(x)})}
function expand(ts){
var out=new Set(ts);
ts.forEach(function(t){(SYN[t]||[]).forEach(function(x){out.add(x)})});
return Array.from(out);
}
function fillSelect(el,vals){vals.forEach(function(v){var o=document.createElement('option');o.value=v;o.textContent=v;el.appendChild(o)})}
function pricingRank(p){return p==='free'?3:p==='freemium'?2:p==='paid'?1:0}
function contains(h,n){return n&&h.indexOf(n)!==-1}
function prep(t){
t._name=norm(t.name);t._domain=norm(t.domain);t._cat=norm(t.category);t._sub=norm(t.subcategory);
t._keys=norm((t.keywords||[]).join(' '));t._source=norm(t.source);
t._all=[t._name,t._domain,t._cat,t._sub,t._keys,t._source].join(' ');
return t;
}
function scoreTool(t,raw,goal){
var score=0,reasons=[],base=tokens(raw),ex=expand(base),phrase=norm(raw);
if(phrase&&contains(t._name,phrase)){score+=20;reasons.push('name matches your request')}
else if(phrase&&contains(t._all,phrase)){score+=10;reasons.push('strong phrase match')}
base.forEach(function(x){
if(contains(t._name,x)){score+=8;reasons.push('matches '+x)}
else if(contains(t._cat,x)||contains(t._sub,x)){score+=6;reasons.push('fits '+x)}
else if(contains(t._keys,x)){score+=5;reasons.push('keyword match for '+x)}
else if(contains(t._domain,x)){score+=3}
});
ex.forEach(function(x){if(base.indexOf(x)===-1&&contains(t._all,x))score+=2});
var g=GOALS[goal]||[];
var ghits=0;g.forEach(function(x){if(contains(t._all,x))ghits++});
if(ghits){score+=Math.min(8,ghits*2);reasons.push('fits the '+goal+' goal')}
var qn=norm(raw);
if(contains(qn,'free')&&(t.pricing==='free'||t.pricing==='freemium')){score+=7;reasons.push('has a free option')}
if((contains(qn,'no login')||contains(qn,'without login'))&&t.login==='not_required_claimed'){score+=8;reasons.push('listed as no-login')}
if((contains(qn,'phone')||contains(qn,'iphone')||contains(qn,'mobile'))&&(contains(t._all,'mobile')||contains(t._all,'ios')||contains(t._all,'iphone'))){score+=4;reasons.push('mentions mobile use')}
return {score:score,reasons:Array.from(new Set(reasons)).slice(0,3)};
}
function whyText(t,rank){
var r=rank&&rank.reasons?rank.reasons:[];
if(r.length)return r.join(' · ')+'.';
var pieces=[];
if(t.pricing==='free')pieces.push('listed as free');
if(t.login==='not_required_claimed')pieces.push('listed as no-login');
pieces.push('matches this category');
return pieces.join(' · ')+'.';
}
function updateURL(){
try{
var u=new URL(location.href);
if(state.query)u.searchParams.set('q',state.query);else u.searchParams.delete('q');
if(state.goal&&state.goal!=='explore')u.searchParams.set('goal',state.goal);else u.searchParams.delete('goal');
['source','category','pricing'].forEach(function(id){var v=$(id).value;if(v)u.searchParams.set(id,v);else u.searchParams.delete(id)});
history.replaceState(null,'',u.pathname+(u.search?'?'+u.searchParams.toString():''));
}catch(e){}
}
function apply(opts){
opts=opts||{};
var raw=state.query=String(opts.query!==undefined?opts.query:$('q').value||'').trim();
$('q').value=raw;$('commandInput').value=raw;
var source=$('source').value,cat=$('category').value,pricing=$('pricing').value;
var hasIntent=Boolean(raw||state.goal);
var ranked=[];
state.tools.forEach(function(t){
if(source&&t.source!==source)return;
if(cat&&t.category!==cat)return;
if(pricing&&t.pricing!==pricing)return;
var rank=scoreTool(t,raw,state.goal);
if(hasIntent&&state.goal!=='explore'&&rank.score<=0)return;
if(raw&&rank.score<=0)return;
ranked.push({tool:t,rank:rank});
});
ranked.sort(function(a,b){
if(hasIntent&&b.rank.score!==a.rank.score)return b.rank.score-a.rank.score;
var pr=pricingRank(b.tool.pricing)-pricingRank(a.tool.pricing);if(pr)return pr;
return a.tool.name.localeCompare(b.tool.name);
});
state.filtered=ranked;state.page=1;
render();updateURL();
if(opts.scroll){try{$('library').scrollIntoView({behavior:'smooth',block:'start'})}catch(e){location.hash='library'}}
}
function badge(text,cls){var s=document.createElement('span');s.className='badge '+(cls||'');s.textContent=text;return s}
function card(item){
var t=item.tool,rank=item.rank;
var el=document.createElement('article');el.className='card';
var top=document.createElement('div');top.className='cardtop';
var left=document.createElement('div');left.style.minWidth='0';
var h=document.createElement('h3');h.className='name';h.textContent=String(t.name||'');
var d=document.createElement('div');d.className='domain';d.textContent=String(t.domain||'');left.append(h,d);
var badges=document.createElement('div');badges.className='badges';
badges.appendChild(badge(t.pricing==='freemium'?'Free / Paid':t.pricing,t.pricing==='free'?'free':''));
if(t.login==='not_required_claimed')badges.appendChild(badge('No login','login'));
top.append(left,badges);
var meta=document.createElement('div');meta.className='meta';var mb=document.createElement('b');mb.textContent=String(t.category||'');meta.append(mb,document.createTextNode(' · '+String(t.subcategory||'')+' · '+String(t.source||'')));
var why=document.createElement('div');why.className='why';var wb=document.createElement('b');wb.textContent='Why Atlas recommends it: ';why.append(wb,document.createTextNode(whyText(t,rank)));
var kw=document.createElement('div');kw.className='keywords';kw.textContent=(t.keywords||[]).slice(0,10).join(' · ');
var a=document.createElement('a');a.className='open';a.href=t.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Open website ↗';
el.append(top,meta,why,kw,a);return el;
}
function render(){
var total=state.filtered.length,max=Math.max(1,Math.ceil(total/state.size));state.page=Math.min(state.page,max);
var start=(state.page-1)*state.size,rows=state.filtered.slice(start,start+state.size);
$('grid').replaceChildren.apply($('grid'),rows.map(card));$('grid').style.display=rows.length?'grid':'none';
$('empty').style.display=!state.loading&&!rows.length?'block':'none';
$('error').style.display='none';
$('count').textContent=state.loading?'Loading the live catalog…':total.toLocaleString()+' matching resources';
$('pageInfo').textContent=total?'Showing '+(start+1)+'–'+Math.min(start+state.size,total):'';
$('pages').textContent='Page '+state.page+' of '+max;$('prev').disabled=state.page<=1;$('next').disabled=state.page>=max;
var intent=state.query?('Ranked for “'+state.query+'”'):(state.goal&&state.goal!=='explore'?'Goal: '+state.goal:'Full library');
$('mode').textContent=intent;
}
function setGoal(goal){
state.goal=goal;
document.querySelectorAll('[data-goal]').forEach(function(b){b.classList.toggle('active',b.getAttribute('data-goal')===goal)});
apply({scroll:true});
}
function load(){
state.loading=true;render();$('error').style.display='none';
fetch('/atlas/catalog',{headers:{'accept':'application/json'}}).then(function(r){if(!r.ok)throw new Error('Catalog unavailable ('+r.status+')');return r.json()}).then(function(data){
state.tools=(data.tools||[]).map(prep);state.loading=false;
$('total').textContent=Number(data.count||state.tools.length).toLocaleString();$('domainCount').textContent=Number(data.domains||0).toLocaleString();
$('source').length=1;$('category').length=1;fillSelect($('source'),data.sources||[]);fillSelect($('category'),data.categories||[]);
var params;try{params=new URL(location.href).searchParams}catch(e){params=new URLSearchParams()}
var initialQ=params.get('q')||'';var initialGoal=params.get('goal')||'';
['source','category','pricing'].forEach(function(id){var v=params.get(id)||'';if(v)$(id).value=v});
state.goal=GOALS[initialGoal]?initialGoal:'';
if(state.goal)document.querySelectorAll('[data-goal]').forEach(function(b){b.classList.toggle('active',b.getAttribute('data-goal')===state.goal)});
apply({query:initialQ});
}).catch(function(err){
state.loading=false;$('grid').replaceChildren();$('empty').style.display='none';$('error').style.display='block';$('errorText').textContent=err&&err.message?err.message:'Unknown loading error';$('count').textContent='Catalog failed to load';$('mode').textContent='Connection error';
});
}
function goPage(delta){
var max=Math.max(1,Math.ceil(state.filtered.length/state.size));var next=Math.min(max,Math.max(1,state.page+delta));if(next===state.page)return;state.page=next;render();
try{$('resultsTitle').scrollIntoView({behavior:'smooth',block:'start'})}catch(e){}
}
var timer=null;
function queueApply(){clearTimeout(timer);timer=setTimeout(function(){apply()},160)}

$('commandForm').addEventListener('submit',function(e){e.preventDefault();state.query=$('commandInput').value;apply({query:state.query,scroll:true})});
$('commandInput').addEventListener('search',function(){state.query=this.value;apply({query:state.query,scroll:true})});
$('q').addEventListener('input',function(){state.query=this.value;queueApply()});
$('q').addEventListener('search',function(){state.query=this.value;apply()});
$('q').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();state.query=this.value;apply()}});
['source','category','pricing'].forEach(function(id){$(id).addEventListener('change',function(){apply()})});
$('clear').addEventListener('click',function(){
state.goal='';state.query='';$('q').value='';$('commandInput').value='';$('source').value='';$('category').value='';$('pricing').value='';
document.querySelectorAll('[data-goal]').forEach(function(b){b.classList.remove('active')});apply();
});
$('prev').addEventListener('click',function(){goPage(-1)});$('next').addEventListener('click',function(){goPage(1)});$('retry').addEventListener('click',load);
document.querySelectorAll('[data-query]').forEach(function(b){b.addEventListener('click',function(){var q=b.getAttribute('data-query')||'';state.query=q;apply({query:q,scroll:true})})});
document.querySelectorAll('[data-goal]').forEach(function(b){b.addEventListener('click',function(){setGoal(b.getAttribute('data-goal')||'')})});

load();
})();
</script>
</body>
</html>`;
