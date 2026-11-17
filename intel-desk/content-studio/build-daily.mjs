#!/usr/bin/env node
/* Prepares one public-safe draft pack. No network, model, social-send or payment calls. */
import "./data.js";
import {createHash} from "node:crypto";
import {mkdirSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";

export const dataset=globalThis.TRI_CONTENT;
export function pacificToday(now=new Date()){
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  const m=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return m.year+"-"+m.month+"-"+m.day;
}
export function build(date){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+"T12:00:00Z")))throw new Error("Provide an ISO calendar date");
  const d=new Date(date+"T12:00:00Z");
  if(d.toISOString().slice(0,10)!==date)throw new Error("Invalid calendar date");
  const plan=dataset.plan.find(x=>x.date===date);
  if(!plan)return {schema:"trivalley.daily-content.v1",date,state:"OUT_OF_CAMPAIGN",publication_performed:false,paid_provider_calls:0};
  const reel=dataset.reels.find(x=>x.idea_id===plan.idea_id)||null;
  const car=dataset.carousels.find(x=>x.idea_id===plan.idea_id)||null;
  const draft={
    schema:"trivalley.daily-content.v1",date,day:plan.day,day_id:plan.id,
    campaign:"2026-11-17_to_2026-12-16",timezone:dataset.timezone,
    suggested_time:plan.timePT,source_idea_id:plan.idea_id,format:plan.format,
    pillar:plan.pillar,title:plan.title,hook:plan.hook,
    takeaway:plan.takeaway,caption:plan.caption,cta:plan.cta,
    booking_url:dataset.offers.booking_url,
    reel_script:reel,carousel_storyboard:car,
    editorial_status:"DRAFT_PENDING_HUMAN_REVIEW",
    claims_verified_for_publication:false,media_rights_verified:false,
    publication_approved:false,publication_performed:false,
    paid_provider_calls:0,outbound_actions:0,
    required_review:["Confirm coach cues and any evidence claims","Review and license private filming/voice/portrait assets",
      "Check current offer and destination","Inspect render on a phone","Approve social publication separately"]
  };
  return draft;
}
export function renderMarkdown(draft){
  if(draft.state==="OUT_OF_CAMPAIGN")return "# TriValley.fit\n\nNo content brief for "+draft.date+".\n";
  const lines=["# TriValley.fit | "+draft.date+" | DRAFT","",
    "Status: DRAFT PENDING HUMAN REVIEW — NO SOCIAL PUBLICATION","",
    "## Suggested post","",draft.format+" · "+draft.suggested_time+" (hypothesis, not proven optimal)","",
    "### "+draft.title,"","> "+draft.hook,"",draft.takeaway,"",
    "## Paste-ready caption","",draft.caption,"",
    "## CTA","",draft.cta,"","## Review gates"];
  for(const x of draft.required_review)lines.push("- [ ] "+x);
  if(draft.reel_script)lines.push("","## Reel script","",JSON.stringify(draft.reel_script,null,2));
  if(draft.carousel_storyboard)lines.push("","## Carousel storyboard","",JSON.stringify(draft.carousel_storyboard.slides,null,2));
  lines.push("","Evidence: editorial hypothesis only; do not present as a verified trend, therapeutic recommendation or client testimonial.","");
  return lines.join("\n");
}
export function writePack(date,out){
  const draft=build(date),root=resolve(out);
  mkdirSync(root,{recursive:true});
  const data=JSON.stringify(draft,null,2)+"\n";
  const sha=createHash("sha256").update(data).digest("hex");
  const receipt={
    schema:"trivalley.content-draft-receipt.v1",
    receipt_key:"content-"+date,
    date,created_at:new Date().toISOString(),
    state:draft.state==="OUT_OF_CAMPAIGN"?"SKIPPED_OUT_OF_CAMPAIGN":"PREPARED_NOT_PUBLISHED",
    source:"2strongtrainers-art/Nicholas-AI-OS",
    github_run_id:process.env.GITHUB_RUN_ID||null,
    artifact_file:draft.state==="OUT_OF_CAMPAIGN"?null:"draft.json",
    sha256:sha,
    created_in_public_research_repo:true,
    publication_performed:false,outbound_actions:0,paid_provider_calls:0,
    chief_delivery:"artifact_prepared; acknowledgment_not_observed"
  };
  writeFileSync(resolve(root,"draft.json"),data,{encoding:"utf8",mode:0o644});
  writeFileSync(resolve(root,"draft.md"),renderMarkdown(draft),{encoding:"utf8",mode:0o644});
  writeFileSync(resolve(root,"receipt.json"),JSON.stringify(receipt,null,2)+"\n",{encoding:"utf8",mode:0o644});
  return {draft,receipt};
}
if(process.argv[1]&&import.meta.url===new URL("file://"+resolve(process.argv[1])).href){
  if(["true","1"].includes((process.env.ALLOW_OUTBOUND_SEND||"false").toLowerCase())||
    ["true","1"].includes((process.env.ALLOW_PAID_AI||"false").toLowerCase())){
    console.error("Refusing to run with outbound or paid AI enabled; this job must remain deterministic and no-send.");
    process.exit(2);
  }
  const date=process.argv[2]||pacificToday();
  const output=process.argv[3]||"./content-draft-artifact";
  const result=writePack(date,output);
  console.log(JSON.stringify({receipt_key:result.receipt.receipt_key,state:result.receipt.state,
    sha256:result.receipt.sha256,publication_performed:false,paid_provider_calls:0},null,2));
}
