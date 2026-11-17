/* No network calls, publishing, model spend or access to customer data. */
(function () {
  "use strict";
  const D=globalThis.TRI_CONTENT;
  if(!D||D.schema!=="trivalley.content-studio.v1"){document.getElementById("content").textContent="Content data unavailable.";return;}
  const el=function(id){return document.getElementById(id);};
  const esc=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(x){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x];});};
  const attrs=function(s){return encodeURIComponent(String(s));};
  const sections={
    calendar:["30-day publishing plan","Suggested windows, not scheduled Instagram posts. Review each draft before release."],
    ideas:["50 content ideas","Research-informed creative hypotheses. Popularity and virality are not guaranteed."],
    reels:["10 ready-to-shoot Reel scripts","Original scripts, shot direction, a 3-second hook and review-safe closing action."],
    carousels:["10-slide Instagram storyboards","Three separate 10-slide outlines; 1080 × 1350 artwork still requires rendering and review."],
    repurpose:["One source, fifteen outputs","A complete illustrative repurposing example, with short-form copy for each channel."],
    captions:["Caption and hashtag workshop","Five deterministic caption angles for your topic; edit for accuracy and personality."],
    operations:["Deployment and review controls","The automation prepares drafts only. External publishing needs separate approval and credentials."]
  };
  let tab="calendar",search="",pillar="All pillars",selectedCarousel="CAR01",captionTopic="How to start strength training after time away";
  el("count-days").textContent=D.plan.length;
  el("count-ideas").textContent=D.ideas.length;
  el("count-reels").textContent=D.reels.length;
  el("count-carousels").textContent=D.carousels.length;
  D.pillars.forEach(function(p){const o=document.createElement("option");o.textContent=p;el("pillar-select").appendChild(o);});
  function toast(text){const e=el("toast");e.textContent=text;e.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(function(){e.classList.remove("show");},2600);}
  function copy(text){if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(function(){toast("Copied to clipboard.");},function(){toast("Clipboard blocked: use a secure browser and select text manually.");});}else{toast("Clipboard unavailable: use a secure browser.");}}
  function download(filename,text,type){
    const blob=new Blob([text],{type:type||"application/json;charset=utf-8"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;a.style.display="none";
    document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);
    toast("Downloaded "+filename);
  }
  function copyButton(text,label){return '<button class="mini-btn" type="button" data-copy="'+attrs(text)+'">'+esc(label||"Copy draft")+'</button>';}
  function match(item){
    const hay=[item.pillar,item.title,item.hook,item.takeaway,item.format,item.caption].filter(Boolean).join(" ").toLowerCase();
    return (pillar==="All pillars"||item.pillar===pillar)&&(!search||hay.includes(search));
  }
  function card(meta,title,hook,body,actions,extra){
    return '<article class="content-card"><div class="card-top"><span class="card-id">'+esc(meta)+'</span><span class="card-kind">'+esc(extra||"EDITORIAL DRAFT")+'</span></div>'+
      '<h3 class="card-title">'+esc(title)+'</h3><p class="card-hook">'+esc(hook)+'</p><p class="card-body">'+esc(body)+'</p>'+
      '<div class="card-footer"><span class="pill warning">NOT PUBLISHED</span>'+actions+'</div></article>';
  }
  function renderCalendar(){
    const rows=D.plan.filter(match);
    el("result-count").textContent=rows.length+" / 30 drafts";
    if(!rows.length)return '<div class="empty">No dates match these filters.</div>';
    return '<div class="grid-cards">'+rows.map(function(p){
      const label=new Date(p.date+"T12:00:00Z").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",timeZone:"UTC"});
      return card("DAY "+p.day+" · "+label,p.title,p.hook,p.takeaway,
        copyButton(p.caption,"Copy caption"),p.format+" · test "+p.timePT);
    }).join("")+'</div>';
  }
  function renderIdeas(){
    const rows=D.ideas.filter(match);
    el("result-count").textContent=rows.length+" / 50 concepts";
    if(!rows.length)return '<div class="empty">No ideas match these filters.</div>';
    return '<div class="grid-cards">'+rows.map(function(p){
      const brief="Topic: "+p.title+"\n3-second hook: "+p.hook+"\nTakeaway: "+p.takeaway+"\nFormat: "+p.format+"\nPillar: "+p.pillar+"\nReview required before publishing.";
      return card(p.id+" · "+p.pillar,p.title,p.hook,p.takeaway,copyButton(brief,"Copy concept"),p.format);
    }).join("")+'</div>';
  }
  function reelText(r){
    return r.title+"\n0–3s HOOK: "+r.hook_0_3+"\n3–10s OPEN: "+r.body_3_10+
      "\n10–24s DEMO/LESSON: "+r.body_10_24+"\nPATTERN INTERRUPT: "+r.interrupt_12+
      "\n24–35s CTA: "+r.close_24_35+"\nSHOT LIST: "+r.shots+
      "\nCAPTION: "+r.caption+"\nAUDIO: "+r.audio+
      "\nSTATE: SCRIPT ONLY; footages, claims, rights and approval pending.";
  }
  function reelHandoff(r){
    return {schema:"trivalley.content-draft.v1",episode_id:"trivalley-content-"+r.id.toLowerCase()+"-20261117",
      headline:r.title,cue:r.body_10_24,shot_list:r.shots,caption:r.caption,
      asset_status:"awaiting_footage",review_status:"draft",
      booking_url:D.offers.booking_url,source_idea_id:r.idea_id,
      publication_performed:false,external_provider_calls:0,
      note:"For manual mapping into existing n8n Reel review Data Table; no network delivery is implemented."};
  }
  function renderReels(){
    const rows=D.reels.filter(function(r){const i=D.ideas.find(function(z){return z.id===r.idea_id;});return i&&match(i);});
    el("result-count").textContent=rows.length+" / 10 scripts";
    if(!rows.length)return '<div class="empty">No scripts match these filters.</div>';
    return '<div class="stack">'+rows.map(function(r){
      const parts=[["00–03 SEC · HOOK",r.hook_0_3],["03–10 SEC · SCENE",r.body_3_10],
        ["10–24 SEC · TEACH",r.body_10_24],["PATTERN INTERRUPT",r.interrupt_12],
        ["24–35 SEC · CTA",r.close_24_35],["SHOOTING NOTES",r.shots]];
      return '<article class="feature-card"><div class="card-top"><span class="card-id">'+esc(r.id)+'</span><span class="pill warning">SCRIPT / NO VIDEO YET</span></div>'+
        '<h3>'+esc(r.title)+'</h3><div class="beats">'+parts.map(function(b){return '<div class="beat"><strong>'+esc(b[0])+'</strong><p>'+esc(b[1])+'</p></div>';}).join("")+'</div>'+
        '<div class="rich-block"><h4>INSTAGRAM CAPTION</h4><p>'+esc(r.caption)+'</p></div>'+
        '<div class="card-actions">'+copyButton(reelText(r),"Copy complete script")+
        '<button class="mini-btn" type="button" data-reel="'+esc(r.id)+'">Export review-queue JSON ↓</button></div></article>';
    }).join("")+'</div>';
  }
  function carouselText(c){
    return c.title+"\n"+c.slides.map(function(s){return "Slide "+s.number+" — "+s.heading+"\n"+s.body;}).join("\n\n")+
      "\n\nREVIEW GATE: 1080x1350 artwork, accessibility, sources, visuals and publication approval.";
  }
  function renderCarousels(){
    el("result-count").textContent="3 storyboard options";
    const tabs='<div class="segmented">'+D.carousels.map(function(c){
      return '<button type="button" data-carousel="'+esc(c.id)+'" class="'+(selectedCarousel===c.id?"selected":"")+'" aria-pressed="'+(selectedCarousel===c.id)+'">'+esc(c.title)+'</button>';
    }).join("")+'</div>';
    const c=D.carousels.find(function(x){return x.id===selectedCarousel;})||D.carousels[0];
    return tabs+'<article class="feature-card"><div class="card-top"><span class="card-id">'+esc(c.id)+'</span><span class="pill warning">STORYBOARD — ARTWORK PENDING</span></div>'+
      '<h3>'+esc(c.title)+'</h3><p>Original, 10-step carousel layout. Creative direction: premium navy/gold, large phone-readable type, selective approved imagery, one takeaway per slide.</p>'+
      '<div class="slide-grid">'+c.slides.map(function(s){
        return '<div class="slide" aria-label="Slide '+s.number+'"><span class="slide-number">'+String(s.number).padStart(2,"0")+' / 10</span>'+
          '<h4>'+esc(s.heading)+'</h4><p>'+esc(s.body)+'</p><div class="slide-footer">TRIVALLEY.FIT · SAVE / SHARE</div></div>';
      }).join("")+'</div><div class="card-actions">'+copyButton(carouselText(c),"Copy 10-slide storyboard")+'</div></article>';
  }
  function group(title,items){
    return '<section class="feature-card"><div class="card-top"><span class="card-id">'+esc(title)+'</span><span class="card-kind">'+items.length+" ASSETS"+'</span></div>'+
      '<div class="stack">'+items.map(function(item,i){
        const text=typeof item==="string"?item:item.copy;
        const label=typeof item==="string"?"POST "+(i+1):item.title;
        return '<div class="rich-block"><h4>'+esc(label)+'</h4><p>'+esc(text)+'</p><div class="card-actions">'+copyButton(text,"Copy")+'</div></div>';
      }).join("")+'</div></section>';
  }
  function renderRepurpose(){
    const p=D.repurpose;
    el("result-count").textContent="5 Reels · 3 carousels · 5 posts · 2 LinkedIn";
    return '<div class="info-panel"><h3>Reusable source: coach-led hip-hinge demonstration</h3><p>'+esc(p.source)+'</p><p class="note">'+esc(p.note)+'</p></div>'+
      '<div class="mini-grid">'+group("5 REEL ADAPTATIONS",p.reels)+group("3 CAROUSEL OUTLINES",p.carousels)+
      group("5 SHORT SOCIAL POSTS",p.short_posts)+group("2 LINKEDIN POSTS",p.linkedin)+'</div>';
  }
  function makeCaption(style,topic){
    const txt=topic.trim().slice(0,160)||"your next training session";
    const tag=txt.toLowerCase().includes("box")?"#TriValleyFit #BoxingBasics #DublinCAFitness #BoxingTraining #CoachNick":
      txt.toLowerCase().includes("golf")?"#TriValleyFit #GolfFitness #TriValleyGolf #GolfStrength #PersonalTraining":
      "#TriValleyFit #StrengthTraining #SanRamonFitness #PersonalTraining #TrainConsistently";
    return txt+"\n\n"+style.intro+" Work from your current ability, practice one clear movement cue and keep the session realistic for your schedule. Adjust the plan based on your goals, equipment and feedback.\n\n"+style.ending+"\n\n"+tag;
  }
  function renderCaptions(){
    el("result-count").textContent="5 caption angles";
    return '<div class="feature-card"><h3>Caption workshop</h3><p>Enter an educational topic, then review and copy five stylistic variants. This is a rule-based generator, not an AI service or trending-hashtag feed.</p>'+
      '<div class="caption-form"><label for="topic-input" class="sr-only">Caption topic</label><input id="topic-input" class="topic-input" maxlength="160" value="'+esc(captionTopic)+'" placeholder="Your training topic">'+
      '<button id="generate-captions" class="primary-btn" type="button">Generate five captions</button></div>'+
      '<div class="mini-grid">'+D.caption_styles.map(function(s){
        const t=makeCaption(s,captionTopic);return '<article class="rich-block"><h4>'+esc(s.name)+'</h4><p>'+esc(t)+'</p><div class="card-actions">'+copyButton(t,"Copy caption")+'</div></article>';
      }).join("")+'</div></div>';
  }
  function renderOps(){
    el("result-count").textContent="NO AUTOMATED PUBLICATION";
    return '<div class="two-column">'+
      '<div class="info-panel"><h3>What is implemented</h3><ul>'+
      '<li>30 dated editorial briefs with suggested posting windows.</li>'+
      '<li>50 topic hypotheses, 10 complete Reel scripts and 30 storyboard slides.</li>'+
      '<li>Repurposing and deterministic, platform-specific captions.</li>'+
      '<li>Full-pack JSON and calendar CSV exports, plus a reviewed Reel handoff schema.</li>'+
      '<li>A zero-provider-call GitHub Actions job prepares a daily draft artifact without sending it.</li>'+
      '</ul><h3>Human review before release</h3><ol>'+
      '<li>Review source claims, coaching scope, current offers, consent and footage rights.</li>'+
      '<li>Render photo/video assets with approved private sources.</li>'+
      '<li>Review mobile accessibility and accurate captions.</li>'+
      '<li>Use the existing n8n review table; record an actual execution receipt.</li>'+
      '<li>Publish only through the authorized social channel and verify the post URL.</li>'+
      '</ol></div>'+
      '<div class="info-panel"><h3>Integration boundaries</h3><p><strong>GitHub Actions:</strong> draft packaging and tests only. No pay-per-token APIs or outbound social posts.</p>'+
      '<p><strong>n8n:</strong> export a compatible handoff for manual import into the existing Reel review queue. This site does not invoke n8n.</p>'+
      '<p><strong>Wix:</strong> live booking and checkout remain untouched. All conversion links use the known assessment route.</p>'+
      '<p><strong>Chief:</strong> reviewer role; actual receipt and acknowledgment must be observed before declaring end-to-end completion.</p>'+
      '<p><strong>Data safety:</strong> this is a public GitHub Pages site, NOT a private portal. Never enter credentials or private client material.</p>'+
      '<h3>Topic research signals</h3><ul class="source-list">'+D.evidence.map(function(s){
        return '<li><a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.label)+'</a> — '+esc(s.purpose)+'</li>';
      }).join("")+'</ul><p class="note">Testing suggested posting times requires actual channel analytics; these times are not proven optimal.</p></div></div>';
  }
  function render(){
    const cfg=sections[tab];el("section-title").textContent=cfg[0];el("section-description").textContent=cfg[1];
    document.querySelectorAll("[data-tab]").forEach(function(b){const yes=b.dataset.tab===tab;b.classList.toggle("active",yes);if(yes)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current");});
    el("filters").hidden=!["calendar","ideas","reels"].includes(tab);
    let html="";
    if(tab==="calendar")html=renderCalendar();
    else if(tab==="ideas")html=renderIdeas();
    else if(tab==="reels")html=renderReels();
    else if(tab==="carousels")html=renderCarousels();
    else if(tab==="repurpose")html=renderRepurpose();
    else if(tab==="captions")html=renderCaptions();
    else html=renderOps();
    el("content").innerHTML=html;
  }
  function csvEscape(v){return '"'+String(v==null?"":v).replace(/"/g,'""')+'"';}
  function exportCsv(){
    const fields=["date","timePT","pillar","format","title","hook","takeaway","caption","cta","status","scheduled_published"];
    const csv=[fields.map(csvEscape).join(",")].concat(D.plan.map(function(row){return fields.map(function(f){return csvEscape(row[f]);}).join(",");})).join("\r\n");
    download("trivalley-fit-30-day-calendar-2026-11.csv","\ufeff"+csv,"text/csv;charset=utf-8");
  }
  document.querySelectorAll("[data-tab]").forEach(function(btn){btn.addEventListener("click",function(){tab=btn.dataset.tab;render();});});
  el("search-input").addEventListener("input",function(e){search=e.target.value.toLowerCase().trim().slice(0,160);render();});
  el("pillar-select").addEventListener("change",function(e){pillar=e.target.value;render();});
  el("export-all").addEventListener("click",function(){download("trivalley-fit-content-studio-2026-11.json",JSON.stringify(D,null,2));});
  el("export-csv").addEventListener("click",exportCsv);
  el("content").addEventListener("click",function(e){
    const btn=e.target.closest("button");if(!btn)return;
    if(btn.hasAttribute("data-copy"))copy(decodeURIComponent(btn.dataset.copy));
    if(btn.hasAttribute("data-reel")){
      const r=D.reels.find(function(x){return x.id===btn.dataset.reel;});if(r)download(r.id.toLowerCase()+"-manual-review.json",JSON.stringify(reelHandoff(r),null,2));
    }
    if(btn.hasAttribute("data-carousel")){selectedCarousel=btn.dataset.carousel;render();}
    if(btn.id==="generate-captions"){const input=el("topic-input");captionTopic=input.value.trim().slice(0,160)||"your next training session";render();toast("Five draft captions generated. Review before publishing.");}
  });
  render();
})();
