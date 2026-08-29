#!/usr/bin/env python3
"""Recover @lucaswebq public TikTok series metadata via TikWM's public user-feed API.

This is source recovery only. It records public Lucas post IDs/captions for Parts
351-749 and never infers a website identity from the caption.
"""
from __future__ import annotations

import argparse
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

API = "https://www.tikwm.com/api/user/posts"
HANDLE = "lucaswebq"
PART_MIN = 351
PART_MAX = 749
COUNT = 35
MAX_PAGES = 30
REQUEST_INTERVAL_SECONDS = 11
PART_RE = re.compile(r"powerful\s+websites\s+you\s+should\s+know.*?part\s*\(?\s*(\d{1,4})\s*\)?", re.I)


def fetch_page(cursor: str) -> dict:
    query = urllib.parse.urlencode({"unique_id": HANDLE, "count": COUNT, "cursor": cursor})
    req = urllib.request.Request(
        f"{API}?{query}",
        headers={
            "Accept": "application/json, text/plain, */*",
            "Referer": "https://www.tikwm.com/",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/148 Safari/537.36",
        },
    )
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=45) as response:
                payload = json.loads(response.read().decode("utf-8"))
            if payload.get("code") != 0 or not isinstance(payload.get("data"), dict):
                raise RuntimeError(f"TikWM response error: code={payload.get('code')} msg={payload.get('msg')!r}")
            return payload["data"]
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, RuntimeError) as exc:
            last_error = exc
            if attempt < 2:
                time.sleep(15 * (attempt + 1))
    raise RuntimeError(f"TikWM page fetch failed after retries: {last_error}")


def part_from_title(title: str) -> int | None:
    match = PART_RE.search(title or "")
    if not match:
        return None
    part = int(match.group(1))
    return part if PART_MIN <= part <= PART_MAX else None


def recover() -> dict:
    cursor = "0"
    seen_cursors: set[str] = set()
    pages = 0
    feed_posts_seen = 0
    candidates: dict[int, list[dict]] = {}

    while pages < MAX_PAGES:
        if cursor in seen_cursors:
            raise RuntimeError(f"Cursor loop detected at {cursor}")
        seen_cursors.add(cursor)
        page = fetch_page(cursor)
        pages += 1
        videos = page.get("videos") or []
        if not isinstance(videos, list):
            raise RuntimeError("TikWM videos field is not an array")
        feed_posts_seen += len(videos)

        for video in videos:
            if not isinstance(video, dict):
                continue
            author = video.get("author") or {}
            author_handle = str(author.get("unique_id") or author.get("uniqueId") or "").lstrip("@").lower()
            if author_handle and author_handle != HANDLE:
                continue
            title = str(video.get("title") or video.get("desc") or "").strip()
            part = part_from_title(title)
            if part is None:
                continue
            video_id = str(video.get("id") or video.get("video_id") or video.get("aweme_id") or "").strip()
            if not video_id.isdigit():
                continue
            record = {
                "part": part,
                "lucas_source_url": f"https://www.tiktok.com/@{HANDLE}/video/{video_id}",
                "video_id": video_id,
                "exact_caption": title,
                "source_kind": "tiktok_public_creator_feed_via_tikwm",
                "verification_status": "Exact @lucaswebq public-feed post ID and caption recovered; website identity not inferred",
                "create_time": video.get("create_time"),
                "evidence_sources": [
                    f"https://www.tiktok.com/@{HANDLE}/video/{video_id}",
                    f"{API}?unique_id={HANDLE}&count={COUNT}&cursor=<paginated>",
                ],
            }
            candidates.setdefault(part, []).append(record)

        has_more = bool(page.get("hasMore") if "hasMore" in page else page.get("has_more"))
        next_cursor = str(page.get("cursor") or "")
        print(
            f"page={pages} videos={len(videos)} recovered_parts={len(candidates)} "
            f"cursor={cursor} next_cursor={next_cursor} has_more={has_more}",
            flush=True,
        )
        if not has_more or not next_cursor:
            break
        cursor = next_cursor
        time.sleep(REQUEST_INTERVAL_SECONDS)

    duplicate_parts = {
        str(part): [{"video_id": r["video_id"], "caption": r["exact_caption"]} for r in rows]
        for part, rows in candidates.items()
        if len({r["video_id"] for r in rows}) > 1
    }

    records = []
    for part in sorted(candidates):
        rows = candidates[part]
        # Feed is newest-first. Keep the first unique post as the primary source,
        # but preserve duplicate candidates above for manual review.
        unique = []
        seen_ids = set()
        for row in rows:
            if row["video_id"] not in seen_ids:
                unique.append(row)
                seen_ids.add(row["video_id"])
        records.append(unique[0])

    recovered = {r["part"] for r in records}
    expected = set(range(PART_MIN, PART_MAX + 1))
    missing = sorted(expected - recovered)
    return {
        "creator": f"@{HANDLE}",
        "range": {"start": PART_MIN, "end": PART_MAX, "total_parts": len(expected)},
        "source": "TikWM public user-feed API; canonical source URLs point back to TikTok",
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "pages_fetched": pages,
        "feed_posts_seen": feed_posts_seen,
        "records": records,
        "recovered_count": len(records),
        "missing_parts": missing,
        "duplicate_parts": duplicate_parts,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    data = recover()
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"RECOVERY_COMPLETE recovered={data['recovered_count']} missing={len(data['missing_parts'])}")


if __name__ == "__main__":
    main()
