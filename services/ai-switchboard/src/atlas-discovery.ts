const DISCOVERY_CSS = `
.discover{margin-top:30px;max-width:1050px}.discoverhead{display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:12px}.discoverhead h2{font-size:25px;letter-spacing:-.03em;margin:3px 0 0}.kicker{font-size:11px;letter-spacing:.09em;font-weight:850;color:var(--mint)}.surprise{border:1px solid var(--line2);background:linear-gradient(135deg,#19314a,#17352c);color:var(--text);border-radius:14px;padding:11px 15px;font-weight:850;min-height:44px;cursor:pointer}.moods{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.mood{border:1px solid var(--line);background:linear-gradient(180deg,rgba(20,27,39,.96),rgba(14,20,30,.96));color:var(--text);border-radius:17px;padding:15px;text-align:left;min-height:118px;cursor:pointer;transition:.15s ease}.mood:active{transform:scale(.99)}.mood:hover,.mood:focus-visible{border-color:var(--accent)}.mood>span{font-size:21px}.mood b{display:block;margin-top:8px;font-size:15px}.mood small{display:block;margin-top:3px;color:var(--muted);font-size:12px;line-height:1.35}.deck{margin-top:10px;border:1px solid var(--line2);background:linear-gradient(135deg,rgba(20,33,48,.96),rgba(16,28,25,.96));border-radius:19px;padding:17px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:center}.deckcopy{min-width:0}.deck h3{font-size:22px;letter-spacing:-.025em;margin:4px 0 4px}.deck p{color:var(--muted);margin:0;max-width:720px}.deckmeta{margin-top:8px;color:#8fa0b8;font-size:12px}.deckactions{display:grid;gap:8px;min-width:126px}.deckopen,.deckanother{min-height:44px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-weight:850;text-decoration:none}.deckopen{background:var(--text);color:#0c1017}.deckanother{border:1px solid var(--line2);background:rgba(9,12,18,.55);color:var(--text);cursor:pointer}.searchlabel{margin:28px 2px -16px;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}.searchlabel b{font-size:15px}
@media(max-width:640px){.discover{margin-top:22px}.discoverhead{align-items:flex-start;flex-direction:column}.surprise{width:100%}.moods{grid-template-columns:1fr 1fr}.mood{min-height:112px;padding:13px}.deck{grid-template-columns:1fr}.deckactions{grid-template-columns:1fr 1fr;min-width:0}.searchlabel{margin-top:24px}}
@media(max-width:390px){.moods{grid-template-columns:1fr}.mood{min-height:auto}}
`;

const DISCOVERY_HTML = `
<section class="discover" aria-labelledby="discoverTitle">
<div class="discoverhead"><div><span class="kicker">JUST BROWSING?</span><h2 id="discoverTitle">Pick a mood. No search required.</h2></div><button id="surpriseTop" class="surprise" type="button">✦ Surprise me</button></div>
<div class="moods">
<button class="mood" type="button" data-discover="quick"><span>⏱</span><b>Kill 5 minutes</b><small>Fast, fun, interactive finds</small></button>
<button class="mood" type="button" data-discover="cool"><span>✦</span><b>Show me something cool</b><small>AI, 3D, maps, visuals and experiments</small></button>
<button class="mood" type="button" data-discover="learn"><span>◎</span><b>Teach me something random</b><small>Science, history, reference and learning</small></button>
<button class="mood" type="button" data-discover="make"><span>◈</span><b>Let me make something</b><small>Images, video, music, writing and design</small></button>
<button class="mood" type="button" data-discover="play"><span>◇</span><b>Give me something to play with</b><small>Games, simulators, builders and interactive tools</small></button>
<button class="mood" type="button" data-discover="useful"><span>↗</span><b>Useful right now</b><small>Practical free tools worth knowing</small></button>
</div>
<div id="discoveryDeck" class="deck" aria-live="polite"><div class="deckcopy"><span id="deckLabel" class="kicker">TODAY'S DISCOVERY</span><h3 id="deckName">Loading something interesting…</h3><p id="deckWhy">Atlas is choosing a beginner-friendly place to start.</p><div id="deckMeta" class="deckmeta"></div></div><div class="deckactions"><a id="deckOpen" class="deckopen" href="#" target="_blank" rel="noopener noreferrer">Open it ↗</a><button id="deckAnother" class="deckanother" type="button">Another</button></div></div>
</section>
<div class="searchlabel"><span class="kicker">KNOW WHAT YOU NEED?</span><b>Search all 1,800 resources</b></div>
`;

const DISCOVERY_JS = `
var DISCOVER={quick:['game','interactive','quiz','simulator','generator','puzzle','arcade','calculator','visual'],cool:['3d','map','maps','gis','space','ai','image','visual','animation','earth','design','experiment'],learn:['science','history','education','learning','reference','museum','academic','geography','language','encyclopedia'],make:['video','image','music','audio','design','writing','generator','creative','animation','3d'],play:['gaming','game','simulator','builder','sandbox','interactive','mario','minecraft','puzzle'],useful:['productivity','calculator','utility','converter','search','research','writing','pdf','map','free']};
var discoveryMode='cool',discoveryPool=[],discoveryIndex=0;
function discoveryScore(t,mode){var keys=DISCOVER[mode]||DISCOVER.cool,score=0;keys.forEach(function(k){if(contains(t._name,k))score+=6;else if(contains(t._cat,k)||contains(t._sub,k))score+=4;else if(contains(t._keys,k))score+=3;else if(contains(t._all,k))score+=1});if(t.pricing==='free')score+=2;if(t.login==='not_required_claimed')score+=1;return score}
function refreshDiscovery(mode,randomize){if(!state.tools.length)return;discoveryMode=mode||discoveryMode||'cool';var ranked=state.tools.map(function(t){return {tool:t,score:discoveryScore(t,discoveryMode)}}).filter(function(x){return x.score>0});ranked.sort(function(a,b){if(b.score!==a.score)return b.score-a.score;return a.tool.name.localeCompare(b.tool.name)});var top=ranked.slice(0,Math.min(90,ranked.length));if(!top.length)top=state.tools.slice(0,90).map(function(t){return {tool:t,score:0}});var seed=(new Date()).toISOString().slice(0,10).split('').reduce(function(a,c){return a+c.charCodeAt(0)},0);if(randomize)seed+=Math.floor(Math.random()*100000);discoveryPool=top;discoveryIndex=top.length?seed%top.length:0;showDiscovery()}
function showDiscovery(){if(!discoveryPool.length)return;var x=discoveryPool[discoveryIndex%discoveryPool.length],t=x.tool;var labels={quick:'KILL 5 MINUTES',cool:'SOMETHING COOL',learn:'LEARN SOMETHING RANDOM',make:'MAKE SOMETHING',play:'PLAY WITH THIS',useful:'USEFUL RIGHT NOW'};$('deckLabel').textContent=labels[discoveryMode]||'DISCOVERY';$('deckName').textContent=t.name||'Interesting find';var why=[];if(t.pricing==='free')why.push('has a free option');if(t.login==='not_required_claimed')why.push('listed as no-login');why.push('fits this browsing mood');$('deckWhy').textContent='Why try it: '+why.join(' · ')+'.';$('deckMeta').textContent=[t.category,t.subcategory,t.source].filter(Boolean).join(' · ');$('deckOpen').href=t.url}
function nextDiscovery(){if(!discoveryPool.length)return;discoveryIndex=(discoveryIndex+1)%discoveryPool.length;showDiscovery()}
function bindDiscovery(){document.querySelectorAll('[data-discover]').forEach(function(b){b.addEventListener('click',function(){refreshDiscovery(b.getAttribute('data-discover')||'cool',true);try{$('discoveryDeck').scrollIntoView({behavior:'smooth',block:'center'})}catch(e){}})});$('deckAnother').addEventListener('click',nextDiscovery);$('surpriseTop').addEventListener('click',function(){var modes=Object.keys(DISCOVER);refreshDiscovery(modes[Math.floor(Math.random()*modes.length)]||'cool',true);try{$('discoveryDeck').scrollIntoView({behavior:'smooth',block:'center'})}catch(e){}})}
`;

export function withAtlasDiscovery(html: string): string {
  let out = html
    .replace('Live catalog · Atlas 3.0', 'Live catalog · Atlas 3.1')
    .replace('<h1 id="title">What are you trying to accomplish?</h1>', '<h1 id="title">Find something useful—or just explore.</h1>')
    .replace('<p class="lead">Describe the outcome in normal language. Atlas ranks useful places to go next, then explains why each result may fit.</p>', '<p class="lead">No idea what to search? That is fine. Tap a mood below and Atlas will give you somewhere interesting to go. If you already know what you need, search normally.</p>');
  out = out.replace('</style>', DISCOVERY_CSS + '</style>');
  out = out.replace('<form id="commandForm" class="command" role="search">', DISCOVERY_HTML + '<form id="commandForm" class="command" role="search">');
  out = out.replace('function norm(v){', DISCOVERY_JS + 'function norm(v){');
  out = out.replace('apply({query:initialQ});', "refreshDiscovery('cool',false);apply({query:initialQ});");
  out = out.replace("document.querySelectorAll('[data-query]').forEach", "bindDiscovery();document.querySelectorAll('[data-query]').forEach");
  return out;
}
