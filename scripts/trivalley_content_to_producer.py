#!/usr/bin/env python3
"""TriValley Content Studio V2 to owner-private production-queue adapter.
No network, provider charges, video rendering or publishing."""
import argparse
import json
from pathlib import Path
from datetime import date

def make_jobs(data, days=7):
    if data.get("auto_publish") is not False or data.get("owner_review_required") is not True:
        raise ValueError("Owner review required; auto-publish must be false")
    if not 1 <= days <= 30:
        raise ValueError("Invalid number of days")
    scripts={r["idea_id"]:r for r in data.get("reels",[])}
    jobs=[]
    for item in data["plan"][:days]:
        fmt=item["format"]
        if fmt not in ("Reel","Carousel","Story","Photo"):
            raise ValueError("Unsupported format")
        date.fromisoformat(item["date"])
        reel=scripts.get(item["idea_id"]) if fmt=="Reel" else None
        if fmt=="Reel" and reel is None:
            raise ValueError("Missing Reel script")
        needs=fmt=="Reel" and item["idea_id"] in ("TV01","TV03","TV04","TV06","TV08","TV10","TV13","TV15","TV19","TV27")
        cta=item.get("cta","")
        if "$297" in cta or "assessment link" in cta.lower():
            cta="Apply for private or hybrid coaching at https://www.trivalley.fit/coaching before an assessment."
        jobs.append({
            "schema":"trivalley.owner-private-production.v1","id":item["id"],
            "date":item["date"],"timezone":"America/Los_Angeles",
            "title":item["title"],"format":fmt,"idea_id":item["idea_id"],
            "caption_draft":item.get("caption"),"cta":cta,
            "platforms":{"instagram":None,"facebook":None,"youtube_shorts":None},
            "voice":{"display_name":"August Nick","catalog_verified":True,"audio_attached":False},
            "brand":"Nick Style 3; Celtic Trinity knot; navy and gold",
            "production":{"state":"awaiting_real_footage" if needs else "creative_review",
                          "needs_real_footage":needs,"footage_attached":False,
                          "moneyprinter_fast_reel":fmt=="Reel","video_wizard_clip_score":None,
                          "clip_timestamps":[],"script":reel.get("voiceover_script") if reel else None,
                          "shots":reel.get("shots") if reel else None,
                          "ready_to_render":False,"license_reviewed":False},
            "analytics":{"views":None,"saves":None,"watch_time":None,"inquiries":None,"applications":None},
            "publication":{"approved":False,"auto_publish":False,"post_url":None,"status":"not_published"}
        })
    return jobs

def output_jobs(jobs, destination):
    folder=Path(destination)
    folder.mkdir(parents=True,exist_ok=True)
    for job in jobs:
        path=folder/(job["id"].lower()+"-"+job["format"].lower()+".json")
        path.write_text(json.dumps(job,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    summary={"count":len(jobs),"needs_footage":sum(j["production"]["needs_real_footage"] for j in jobs),
             "render_ready":0,"published":0,"paid_calls":0}
    (folder/"queue-summary.json").write_text(json.dumps(summary,indent=2)+"\n",encoding="utf-8")
    return summary

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("source",type=Path)
    parser.add_argument("output",type=Path)
    parser.add_argument("--days",type=int,default=7)
    args=parser.parse_args()
    data=json.loads(args.source.read_text(encoding="utf-8"))
    print(json.dumps(output_jobs(make_jobs(data,args.days),args.output)))
