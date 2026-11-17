import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync,existsSync,mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {dataset,build,pacificToday,writePack,renderMarkdown} from "../intel-desk/content-studio/build-daily.mjs";

test("all seven techniques have complete starter artifacts",()=>{
  assert.equal(dataset.schema,"trivalley.content-studio.v1");
  assert.equal(dataset.plan.length,30);
  assert.equal(dataset.ideas.length,50);
  assert.equal(dataset.reels.length,10);
  assert.equal(dataset.carousels.length,3);
  assert.equal(dataset.carousels.reduce((sum,c)=>sum+c.slides.length,0),30);
  assert.equal(dataset.repurpose.reels.length,5);
  assert.equal(dataset.repurpose.carousels.length,3);
  assert.equal(dataset.repurpose.short_posts.length,5);
  assert.equal(dataset.repurpose.linkedin.length,2);
  assert.equal(dataset.caption_styles.length,5);
  assert.equal(dataset.auto_publish,false);
  assert.equal(dataset.external_model_calls,0);
  assert.equal(dataset.owner_review_required,true);
});
test("calendar dates and IDs are unique, bounded and editorially safe",()=>{
  assert.equal(dataset.start_date,"2026-11-17");
  assert.equal(dataset.end_date,"2026-12-16");
  assert.equal(new Set(dataset.ideas.map(x=>x.id)).size,50);
  assert.equal(new Set(dataset.plan.map(x=>x.date)).size,30);
  assert.equal(new Set(dataset.reels.map(x=>x.id)).size,10);
  const ids=new Set(dataset.ideas.map(x=>x.id));
  dataset.plan.forEach((entry,index)=>{
    assert.equal(entry.day,index+1);
    const date=new Date(Date.UTC(2026,10,17+index)).toISOString().slice(0,10);
    assert.equal(entry.date,date);
    assert.ok(ids.has(entry.idea_id));
    assert.equal(entry.scheduled_published,false);
    assert.match(entry.status,/DRAFT/);
    assert.ok(entry.caption.length<2200,"IG caption too long");
    assert.ok(entry.caption.includes("#TriValleyFit"));
    assert.match(entry.booking_url,/^https:\/\/www\.trivalley\.fit\/booking-calendar\//);
  });
  for(const r of dataset.reels){
    assert.ok(ids.has(r.idea_id));
    for(const k of ["hook_0_3","body_3_10","body_10_24","interrupt_12","close_24_35","shots"]){
      assert.ok(typeof r[k]==="string"&&r[k].length>12,k);
    }
    assert.equal(r.status,"SCRIPT_ONLY_NOT_RENDERED");
    assert.ok(r.caption.length<2200);
  }
});
test("Pacific day boundary and out-of-window handling",()=>{
  assert.equal(pacificToday(new Date("2026-11-17T05:00:00Z")),"2026-11-16");
  assert.equal(pacificToday(new Date("2026-11-17T09:30:00Z")),"2026-11-17");
  assert.equal(build("2026-11-16").state,"OUT_OF_CAMPAIGN");
  assert.equal(build("2026-12-17").state,"OUT_OF_CAMPAIGN");
  assert.throws(()=>build("2026-11-31"),/Invalid calendar date/);
  assert.throws(()=>build("../../whatever"),/ISO calendar date/);
});
test("daily pack emits a verifiable draft, not a publication receipt",()=>{
  const base=mkdtempSync(join(tmpdir(),"trivalley-draft-test-"));
  try{
    const a=writePack("2026-11-17",base);
    assert.equal(a.receipt.receipt_key,"content-2026-11-17");
    assert.equal(a.receipt.state,"PREPARED_NOT_PUBLISHED");
    assert.equal(a.receipt.chief_delivery,"artifact_prepared; acknowledgment_not_observed");
    assert.equal(a.receipt.paid_provider_calls,0);
    assert.equal(a.receipt.outbound_actions,0);
    assert.equal(a.receipt.publication_performed,false);
    assert.equal(a.draft.publication_approved,false);
    assert.equal(a.draft.media_rights_verified,false);
    assert.equal(a.draft.claims_verified_for_publication,false);
    const bytes=readFileSync(join(base,"draft.json"),"utf8");
    assert.equal(createHash("sha256").update(bytes).digest("hex"),a.receipt.sha256);
    assert.deepEqual(JSON.parse(readFileSync(join(base,"receipt.json"),"utf8")),a.receipt);
    const md=readFileSync(join(base,"draft.md"),"utf8");
    assert.equal(md,renderMarkdown(a.draft));
    assert.match(md,/NO SOCIAL PUBLICATION/);
    assert.equal(existsSync(join(base,"draft.json")),true);
  }finally{rmSync(base,{force:true,recursive:true});}
});
test("studio has mobile layout and no required external runtime",()=>{
  const dir=resolve("intel-desk/content-studio");
  const html=readFileSync(join(dir,"index.html"),"utf8");
  const css=readFileSync(join(dir,"style.css"),"utf8");
  const js=readFileSync(join(dir,"app.js"),"utf8");
  assert.match(html,/name="viewport"/);
  assert.match(css,/@media\(max-width:600px\)/);
  assert.match(html,/script src="\.\/data\.js"/);
  assert.match(js,/publication_performed:false/);
  assert.doesNotMatch(js,/fetch\(|XMLHttpRequest|https:\/\/.*api\./);
  assert.match(html,/noindex,nofollow/);
});
