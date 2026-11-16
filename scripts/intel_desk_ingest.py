#!/usr/bin/env python3
"""Zero-key, bounded public intelligence ingest. Metadata only; never infer causality."""
from __future__ import annotations
import argparse
import hashlib
import csv
import io
import zipfile
import json
import re
import sys
import time
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree as ET
from pathlib import Path
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

SCHEMA = "trivalley.global-intel.v1"
TOPICS = {
    "Security": '"cyberattack" OR "ransomware" OR "critical infrastructure"',
    "Geopolitics": '"military strike" OR "border clashes" OR "sanctions"',
    "Energy": '"oil supply" OR "shipping disruption" OR "oil tanker"',
    "Economy": '"central bank" OR "inflation" OR "trade tariffs"',
}
MENTIONS = ("Iran", "Ukraine", "Russia", "Taiwan", "China", "Israel",
            "Lebanon", "Syria", "India", "Pakistan", "Venezuela",
            "North Korea", "Red Sea", "Strait of Hormuz", "United States")
FEEDS = {
    "USGS": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson",
    "NASA EONET": "https://eonet.gsfc.nasa.gov/api/v3/events/geojson?days=7&status=open&limit=100",
}
OFFICIAL_RSS = {
    "Federal Reserve": ("Economy", "https://www.federalreserve.gov/feeds/press_all.xml"),
    "State Department": ("Geopolitics", "https://www.state.gov/rss-feed/press-releases/feed/"),
    "CISA": ("Security", "https://www.cisa.gov/cybersecurity-advisories/alerts.xml"),
    "EIA": ("Energy", "https://www.eia.gov/rss/todayinenergy.xml"),
}
USER_AGENT = "TriValley-GlobalIntelDesk/1.0 (public read-only research)"
MAX_RESPONSE = 3_000_000


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def safe_url(value):
    if not isinstance(value, str) or len(value) > 2000:
        return ""
    try:
        u = urlparse(value)
        if u.scheme != "https" or not u.netloc or u.username or u.password:
            return ""
        if u.hostname in ("localhost", "127.0.0.1", "::1"):
            return ""
        return value
    except ValueError:
        return ""


def label(value, limit=190):
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return text[:limit]


def event_id(kind, identity):
    return hashlib.sha256((kind + "|" + identity).encode("utf-8")).hexdigest()[:20]


def parse_gdelt_date(raw):
    if not isinstance(raw, str):
        return None
    try:
        return datetime.strptime(raw, "%Y%m%dT%H%M%SZ").replace(
            tzinfo=timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    except ValueError:
        return None


def headline_mentions(text):
    return [term for term in MENTIONS if re.search(
        r"(?<![A-Za-z])" + re.escape(term) + r"(?![A-Za-z])", text, flags=re.I)]


def valid_coordinates(coords):
    if not isinstance(coords, list) or len(coords) < 2:
        return None
    lon, lat = coords[:2]
    if (isinstance(lon, bool) or isinstance(lat, bool) or
            not isinstance(lon, (int, float)) or not isinstance(lat, (int, float)) or
            not -180 <= lon <= 180 or not -90 <= lat <= 90):
        return None
    return [round(float(lat), 5), round(float(lon), 5)]


def normalize_article(article, topic):
    if not isinstance(article, dict):
        return None
    url = safe_url(article.get("url"))
    title = label(article.get("title"))
    if not url or not title:
        return None
    domain = label(article.get("domain") or urlparse(url).hostname, 90)
    return {
        "id": event_id("GDELT", url), "kind": "report", "source": "GDELT",
        "publisher": domain, "topic": topic, "title": title, "url": url,
        "observed_at": parse_gdelt_date(article.get("seendate")),
        "mentions": headline_mentions(title), "position": None,
        "trust": "Media report (unverified)", "basis": "Article indexed by GDELT",
    }


def normalize_quake(feature):
    if not isinstance(feature, dict):
        return None
    p = feature.get("properties") or {}
    pos = valid_coordinates((feature.get("geometry") or {}).get("coordinates"))
    url = safe_url(p.get("url"))
    if not pos or not url:
        return None
    mag = p.get("mag")
    value = ("M" + str(round(mag, 1))) if isinstance(mag, (int, float)) and not isinstance(mag, bool) else "Earthquake"
    ts = p.get("time")
    observed = (datetime.fromtimestamp(ts / 1000, tz=timezone.utc).isoformat(
        timespec="seconds").replace("+00:00", "Z")
        if isinstance(ts, (int, float)) and ts > 0 else None)
    title = label(value + " — " + str(p.get("place") or "location not stated"))
    return {"id": event_id("USGS", str(feature.get("id") or url)), "kind": "hazard",
            "source": "USGS", "publisher": "USGS", "topic": "Earthquake",
            "title": title, "url": url, "observed_at": observed,
            "mentions": [], "position": pos, "trust": "Agency catalog",
            "basis": "USGS event coordinates; event parameters may be revised"}


def normalize_eonet(feature):
    if not isinstance(feature, dict):
        return None
    props = feature.get("properties") or {}
    geom = feature.get("geometry") or {}
    if geom.get("type") != "Point":
        return None
    pos = valid_coordinates(geom.get("coordinates"))
    url = safe_url(props.get("link"))
    if not pos or not url:
        return None
    cats = props.get("categories") or []
    cat = cats[0] if cats else {}
    topic = label(cat.get("title") if isinstance(cat, dict) else str(cat), 44) or "Natural event"
    date = props.get("date")
    try:
        stamp = datetime.fromisoformat(str(date).replace("Z", "+00:00")).astimezone(
            timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z") if date else None
    except ValueError:
        stamp = None
    return {"id": event_id("EONET", str(props.get("id") or feature.get("id") or url)),
            "kind": "hazard", "source": "NASA EONET", "publisher": "NASA EONET",
            "topic": topic, "title": label(props.get("title") or topic), "url": url,
            "observed_at": stamp, "mentions": [], "position": pos,
            "trust": "Curated natural-event metadata",
            "basis": "NASA EONET point location (not a precise impact footprint)"}


def fetch_json(url):
    err = None
    for attempt in range(2):
        try:
            req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
            with urlopen(req, timeout=18) as res:
                body = res.read(MAX_RESPONSE + 1)
                if len(body) > MAX_RESPONSE:
                    raise ValueError("response too large")
                return json.loads(body)
        except (HTTPError, URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
            # Report only a generic failure class; never echo external response bodies.
            err = "HTTP " + str(exc.code) if isinstance(exc, HTTPError) else type(exc).__name__
            if isinstance(exc, HTTPError) and exc.code not in (429, 500, 502, 503, 504):
                break
            if attempt == 0:
                time.sleep(1.5)
    raise RuntimeError(err or "unknown fetch error")


def normalize_rss_item(item, source, topic):
    title = label(item.findtext("title"))
    url = safe_url(item.findtext("link"))
    if not title or not url:
        return None
    raw_date = item.findtext("pubDate")
    try:
        date = parsedate_to_datetime(raw_date)
        date = (date.replace(tzinfo=timezone.utc) if date.tzinfo is None else date)
        observed = date.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    except (ValueError, TypeError, OverflowError, AttributeError):
        observed = None
    return {"id": event_id(source, url), "kind": "report", "source": source,
            "publisher": source, "topic": topic, "title": title, "url": url,
            "observed_at": observed, "mentions": headline_mentions(title),
            "position": None, "trust": "Official agency publication",
            "basis": "Source RSS headline, not independent verification of its content"}


GDELT_LAST_UPDATE = "https://data.gdeltproject.org/gdeltv2/lastupdate.txt"
GDELT_ARCHIVE_BASE = "https://data.gdeltproject.org/gdeltv2/"
GDELT_CAMEO_ROOTS = {
    "01": "Public statements", "02": "Appeals", "03": "Intent statements",
    "04": "Consultations", "05": "Diplomatic cooperation", "06": "Material cooperation",
    "07": "Aid", "08": "Concessions", "09": "Investigations",
    "10": "Demands", "11": "Disapproval", "12": "Rejection",
    "13": "Threats", "14": "Protests", "15": "Force posture",
    "16": "Relations reduced", "17": "Coercion",
    "18": "Assault reporting", "19": "Combat reporting",
    "20": "Mass violence reporting",
}


def normalize_gdelt_bulk_row(fields, archive_url):
    """GDELT event rows are algorithmically coded article claims, never verified incidents."""
    if not isinstance(fields, (list, tuple)) or len(fields) < 58:
        return None
    root = fields[28].strip()
    if root not in GDELT_CAMEO_ROOTS:
        return None
    try:
        sources = int(fields[32])
    except (ValueError, TypeError):
        return None
    if sources < 1:
        return None
    a1 = label(fields[6], 60)
    a2 = label(fields[16], 60)
    location = label(fields[50], 80)
    if not a1 and not a2:
        return None
    time_added = fields[56]
    try:
        observed = datetime.strptime(time_added, "%Y%m%d%H%M%S").replace(
            tzinfo=timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    except ValueError:
        return None
    source_url = safe_url(fields[57].strip())
    url = source_url or archive_url
    headline = "GDELT CAMEO " + root + " (" + GDELT_CAMEO_ROOTS[root] + "): "
    headline += (a1 or "Unspecified actor") + " / " + (a2 or "Unspecified target")
    if location:
        headline += " — " + location
    topic = "Security" if root in ("15", "17", "18", "19", "20") else "Geopolitics"
    return {
        "id": event_id("GDELT-BULK", fields[0]), "kind": "report", "source": "GDELT event data",
        "publisher": label(urlparse(fields[57]).hostname or "GDELT", 80),
        "topic": topic, "title": label(headline), "url": url,
        "observed_at": observed, "mentions": headline_mentions(headline),
        "position": None, "trust": ("Automated SINGLE-SOURCE coding; unverified" if sources == 1 else "Automated multi-source coding; unverified"),
        "basis": "GDELT CAMEO code from news articles; location not independently geolocated",
        "report_count": sources
    }


def fetch_gdelt_bulk():
    req = Request(GDELT_LAST_UPDATE, headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=18) as res:
        last = res.read(3000).decode("ascii", errors="replace")
    match = re.search(
        r"https?://data[.]gdeltproject[.]org/gdeltv2/(\d{14}[.]export[.]CSV[.]zip)",
        last,
    )
    if not match:
        raise ValueError("unrecognized GDELT latest-index format")
    url = GDELT_ARCHIVE_BASE + match.group(1)
    req = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=18) as res:
        blob = res.read(3_000_001)
    if len(blob) > 3_000_000:
        raise ValueError("GDELT archive exceeds bounded download")
    with zipfile.ZipFile(io.BytesIO(blob)) as zf:
        members = [x for x in zf.infolist() if x.filename.endswith(".CSV")]
        if len(members) != 1 or members[0].file_size > 15_000_000:
            raise ValueError("unrecognized GDELT archive contents")
        data = zf.read(members[0]).decode("utf-8", errors="replace")
    rows = csv.reader(io.StringIO(data), delimiter="\t")
    parsed = [e for cols in rows if (e := normalize_gdelt_bulk_row(cols, url))]
    parsed.sort(key=lambda e: -e["report_count"])
    return parsed[:60]


def fetch_rss(url):
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/xml"})
    with urlopen(req, timeout=18) as res:
        body = res.read(1_000_001)
    if len(body) > 1_000_000 or b"<!DOCTYPE" in body[:4096].upper():
        raise ValueError("invalid RSS size or DTD")
    root = ET.fromstring(body)
    if root.tag not in ("rss", "{http://www.w3.org/2005/Atom}feed"):
        raise ValueError("not an RSS-compatible feed")
    return root


def connections(events):
    by_mention = {}
    now = datetime.now(timezone.utc)
    for e in events:
        if e.get("kind") != "report":
            continue
        try:
            published = datetime.fromisoformat(e["observed_at"].replace("Z", "+00:00"))
            age = now - published
            if age < timedelta(minutes=-2) or age > timedelta(hours=48):
                continue
        except (TypeError, ValueError, AttributeError, KeyError):
            continue
        for mention in e.get("mentions", []):
            by_mention.setdefault(mention, []).append(e)
    output = []
    for place, items in by_mention.items():
        topics = sorted({e["topic"] for e in items})
        domains = {e["publisher"].lower() for e in items}
        if len(topics) < 2 or len(domains) < 2:
            continue
        evidence = []
        used_domains = set()
        for e in items:
            if e["publisher"].lower() in used_domains:
                continue
            evidence.append({"title": e["title"], "url": e["url"], "publisher": e["publisher"]})
            used_domains.add(e["publisher"].lower())
            if len(evidence) == 4:
                break
        output.append({
            "place_mention": place, "topics": topics, "article_count": len(items),
            "publisher_count": len(domains), "evidence": evidence,
            "classification": "CANDIDATE_ONLY",
            "method": "Headline keyword and 48h window overlap; no causation or event geolocation verified",
        })
    return sorted(output, key=lambda c: (-len(c["topics"]), -c["publisher_count"]))[:12]


def collect():
    items, health = [], []
    for topic, query in TOPICS.items():
        url = "https://api.gdeltproject.org/api/v2/doc/doc?" + urlencode({
            "query": query, "mode": "artlist", "format": "json",
            "maxrecords": 35, "timespan": "48h", "sort": "datedesc",
        })
        try:
            data = fetch_json(url)
            rows = [e for a in (data.get("articles") or []) if (e := normalize_article(a, topic))]
            items.extend(rows[:35])
            health.append({"name": "GDELT / " + topic, "state": "ok", "count": len(rows)})
        except Exception as exc:
            health.append({"name": "GDELT / " + topic, "state": "error", "count": 0,
                           "error": label(str(exc), 70)})
        time.sleep(0.7)  # avoid bursts to a public service
    try:
        rows = fetch_gdelt_bulk()
        items.extend(rows)
        health.append({"name": "GDELT bulk", "state": "ok", "count": len(rows)})
    except Exception as exc:
        health.append({"name": "GDELT bulk", "state": "error", "count": 0,
                       "error": label(type(exc).__name__, 70)})
    for source, (topic, url) in OFFICIAL_RSS.items():
        try:
            root = fetch_rss(url)
            channel = root.find("channel")
            if channel is None:
                raise ValueError("RSS channel absent")
            rows = [e for a in channel.findall("item")
                    if (e := normalize_rss_item(a, source, topic))]
            items.extend(rows[:30])
            health.append({"name": source, "state": "ok", "count": len(rows)})
        except Exception as exc:
            health.append({"name": source, "state": "error", "count": 0,
                           "error": label(type(exc).__name__, 70)})
    for name, url in FEEDS.items():
        try:
            data = fetch_json(url)
            normalizer = normalize_quake if name == "USGS" else normalize_eonet
            rows = [e for a in (data.get("features") or []) if (e := normalizer(a))]
            items.extend(rows[:120])
            health.append({"name": name, "state": "ok", "count": len(rows)})
        except Exception as exc:
            health.append({"name": name, "state": "error", "count": 0,
                           "error": label(str(exc), 70)})
    unique = {e["id"]: e for e in items}
    results = sorted(unique.values(), key=lambda e: e.get("observed_at") or "", reverse=True)
    good = sum(x["state"] == "ok" for x in health)
    if good == 0:
        raise RuntimeError("Every public data source failed; refusing a false fresh snapshot")
    return {"schema": SCHEMA, "generated_at": now_iso(), "source_health": health,
            "status": "OK" if good == len(health) else "DEGRADED",
            "events": results[:300], "connections": connections(results),
            "methodology": "Source-indexed signals; textual co-mention != causation; map contains agency coordinates only"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="intel-desk/data/events.json")
    args = parser.parse_args()
    report = collect()
    path = Path(args.output)
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = (json.dumps(report, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    path.write_bytes(encoded)
    digest = hashlib.sha256(encoded).hexdigest()
    print(json.dumps({"schema": SCHEMA, "status": report["status"],
                      "generated_at": report["generated_at"], "events": len(report["events"]),
                      "connections": len(report["connections"]), "sha256": digest,
                      "output_path": str(path)}, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("INGEST_FAILED: " + type(exc).__name__ + ": " + str(exc), file=sys.stderr)
        sys.exit(1)
