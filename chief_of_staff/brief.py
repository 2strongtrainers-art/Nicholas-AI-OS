"""Build replayable briefings from normalized, source-verified inputs."""

from __future__ import annotations

import argparse
from contextlib import closing
from datetime import datetime, time, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import sys
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo


SOURCES = {
    "gmail": {"mail.google.com"},
    "calendar": {"calendar.google.com", "www.google.com"},
    "github": {"github.com"},
    "slack": {"app.slack.com"},
}
SOURCE_STATES = {"ok", "partial", "unavailable", "not_configured"}
URGENCIES = {"overdue": 0, "due_soon": 1, "normal": 2}
PRIORITIES = {"high": 0, "normal": 1, "low": 2}
DIRECTIONS = {"owner_action", "waiting_on", "calendar"}
MAX_PRIORITIES = 5
MAX_CALENDAR = 6
HISTORY_DAYS = 30
PACIFIC = ZoneInfo("America/Los_Angeles")


def timestamp(value: str) -> datetime:
    if not isinstance(value, str):
        raise ValueError("Expected an ISO 8601 timestamp with a time zone")
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if result.tzinfo is None:
        raise ValueError("Timestamps require a time zone")
    return result.astimezone(timezone.utc)


def text_field(record: dict, key: str, limit: int) -> str:
    value = record.get(key)
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        raise ValueError(f"{key} must be nonempty text up to {limit} characters")
    if any(ord(character) < 32 or ord(character) == 127 for character in value):
        raise ValueError(f"{key} must be on one line")
    return value.strip()


def source_link(source: str, url: str) -> None:
    parsed = urlsplit(url)
    host = parsed.hostname or ""
    allowed = host in SOURCES[source] or (source == "slack" and host.endswith(".slack.com"))
    if parsed.scheme != "https" or not allowed or parsed.username is not None or parsed.port is not None:
        raise ValueError(f"{source} items require an HTTPS source link on an approved domain")
    if source == "calendar" and host == "www.google.com" and not parsed.path.startswith("/calendar/"):
        raise ValueError("Calendar link must refer to Google Calendar")
    if any(character.isspace() for character in url):
        raise ValueError("Source links may not contain whitespace")


def normalize(payload: dict) -> tuple[str, datetime, dict, list[dict]]:
    if not isinstance(payload, dict):
        raise ValueError("Snapshot must be a JSON object")
    run_id = text_field(payload, "run_id", 80)
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", run_id):
        raise ValueError("run_id permits letters, digits, hyphens, periods and underscores")
    as_of = timestamp(payload.get("as_of"))
    coverage = payload.get("coverage")
    if not isinstance(coverage, dict) or not coverage or not coverage.keys() <= SOURCES.keys():
        raise ValueError("Provide coverage for at least one known source")
    if any(not isinstance(state, str) or state not in SOURCE_STATES for state in coverage.values()):
        raise ValueError("Unknown coverage state")
    coverage = {source: coverage.get(source, "not_configured") for source in SOURCES}

    rows = payload.get("items")
    if not isinstance(rows, list) or len(rows) > 500:
        raise ValueError("items must be an array of at most 500 normalized records")

    items = {}
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("Each item must be an object")
        source = text_field(row, "source", 20)
        if coverage.get(source) not in {"ok", "partial"}:
            raise ValueError("Item source must have current or partial coverage")
        key = (source, text_field(row, "id", 200))
        observed_at = timestamp(row.get("observed_at"))
        if observed_at > as_of:
            raise ValueError("observed_at cannot be after as_of")
        direction = text_field(row, "direction", 30)
        priority = text_field(row, "priority", 12)
        if direction not in DIRECTIONS or priority not in PRIORITIES:
            raise ValueError("Unknown direction or priority")
        due = row.get("due_at")
        due_at = timestamp(due) if due is not None else None
        if direction == "calendar" and (source != "calendar" or due_at is None):
            raise ValueError("Calendar entries require a calendar source and start time")
        end_at = timestamp(row["end_at"]) if row.get("end_at") is not None else None
        if end_at is not None and (direction != "calendar" or end_at < due_at):
            raise ValueError("end_at requires a calendar item with an end at or after its start")
        url = text_field(row, "url", 2048)
        source_link(source, url)

        item = {
            "source": key[0],
            "id": key[1],
            "version": text_field(row, "version", 200),
            "title": text_field(row, "title", 220),
            "next_step": text_field(row, "next_step", 320),
            "url": url,
            "observed_at": observed_at,
            "due_at": due_at,
            "end_at": end_at,
            "direction": direction,
            "priority": priority,
        }
        previous = items.get(key)
        if previous and previous["observed_at"] == observed_at and previous != item:
            raise ValueError("Conflicting entries with the same source, id and observed_at")
        if previous is None or observed_at > previous["observed_at"]:
            items[key] = item
    return run_id, as_of, coverage, list(items.values())


def urgency(item: dict, as_of: datetime) -> str:
    due_at = item["due_at"]
    if due_at is None:
        return "normal"
    if due_at < as_of:
        return "overdue"
    if due_at - as_of <= timedelta(hours=24):
        return "due_soon"
    return "normal"


def build_brief(run_id: str, as_of: datetime, coverage: dict, items: list[dict], seen: dict) -> dict:
    calendar = []
    priorities = []
    window_end = datetime.combine(as_of.astimezone(PACIFIC).date() + timedelta(days=2), time(), PACIFIC)
    for item in items:
        key = (item["source"], item["id"])
        if item["direction"] == "calendar":
            if item["due_at"] < window_end and (item["end_at"] or item["due_at"]) >= as_of:
                calendar.append(item)
            continue
        level = urgency(item, as_of)
        earlier = seen.get(key)
        if earlier:
            if earlier[0] > item["observed_at"]:
                continue
            if earlier[1] == item["version"] and URGENCIES[level] >= URGENCIES[earlier[2]]:
                continue
        priorities.append({**item, "urgency": level})

    priorities.sort(key=lambda item: (
        URGENCIES[item["urgency"]],
        item["due_at"] or datetime.max.replace(tzinfo=timezone.utc),
        PRIORITIES[item["priority"]],
        item["direction"] != "owner_action",
        -item["observed_at"].timestamp(),
        item["source"], item["id"],
    ))
    calendar.sort(key=lambda item: (item["due_at"], item["source"], item["id"]))
    visible_calendar = calendar[:MAX_CALENDAR]
    conflicts = []
    for index, first in enumerate(visible_calendar):
        for second in visible_calendar[index + 1:]:
            if first["end_at"] is None or second["end_at"] is None:
                continue
            start_at = max(first["due_at"], second["due_at"], as_of)
            end_at = min(first["end_at"], second["end_at"])
            if start_at < end_at:
                conflicts.append({"start_at": start_at, "end_at": end_at, "sources": [first["url"], second["url"]]})
    return {
        "run_id": run_id,
        "as_of": as_of,
        "coverage": coverage,
        "priorities": [dict(item, number=index) for index, item in enumerate(priorities[:MAX_PRIORITIES], 1)],
        "calendar": visible_calendar,
        "calendar_conflicts": conflicts,
        "more_priorities": max(0, len(priorities) - MAX_PRIORITIES),
        "more_calendar": max(0, len(calendar) - MAX_CALENDAR),
    }


def briefing(payload: dict, state_path: Path) -> str:
    run_id, as_of, coverage, items = normalize(payload)
    canonical_items = sorted(items, key=lambda item: (item["source"], item["id"]))
    fingerprint = hashlib.sha256(
        json.dumps([as_of, coverage, canonical_items], default=datetime.isoformat, sort_keys=True).encode()
    ).hexdigest()

    state_path = state_path.expanduser()
    state_path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    descriptor = os.open(state_path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        if os.fstat(descriptor).st_mode & 0o077:
            raise ValueError("State file permissions must be 0600 or stricter")
    finally:
        os.close(descriptor)
    with closing(sqlite3.connect(state_path, timeout=10)) as connection, connection:
        connection.execute(
            "CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, as_of TEXT, input_hash TEXT, output TEXT)"
        )
        connection.execute(
            "CREATE TABLE IF NOT EXISTS seen (source TEXT, id TEXT, observed_at TEXT, version TEXT, "
            "urgency TEXT, shown_at TEXT, PRIMARY KEY (source, id))"
        )
        connection.execute("BEGIN IMMEDIATE")
        prior = connection.execute("SELECT input_hash, output FROM runs WHERE id = ?", (run_id,)).fetchone()
        if prior:
            if prior[0] != fingerprint:
                raise ValueError("Run ID already used for different input")
            return prior[1]
        latest = connection.execute("SELECT MAX(as_of) FROM runs").fetchone()[0]
        as_of_text = as_of.isoformat()
        if latest and as_of_text < latest:
            raise ValueError("New run as_of cannot precede the last recorded run")
        cutoff = (as_of - timedelta(days=HISTORY_DAYS)).isoformat()
        connection.execute("DELETE FROM seen WHERE shown_at < ?", (cutoff,))
        connection.execute("DELETE FROM runs WHERE as_of < ?", (cutoff,))
        seen = {
            (source, item_id): (timestamp(observed_at), version, level)
            for source, item_id, observed_at, version, level in connection.execute(
                "SELECT source, id, observed_at, version, urgency FROM seen"
            )
        }
        report = build_brief(run_id, as_of, coverage, items, seen)
        result = json.dumps(report, default=datetime.isoformat, indent=2, ensure_ascii=False)
        connection.execute("INSERT INTO runs VALUES (?, ?, ?, ?)", (run_id, as_of_text, fingerprint, result))
        connection.executemany(
            "INSERT INTO seen VALUES (?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(source, id) DO UPDATE SET observed_at = excluded.observed_at, "
            "version = excluded.version, urgency = excluded.urgency, shown_at = excluded.shown_at",
            [
                (item["source"], item["id"], item["observed_at"].isoformat(), item["version"], item["urgency"], as_of_text)
                for item in report["priorities"]
            ],
        )
        return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("snapshot", type=Path, help="Normalized JSON snapshot")
    parser.add_argument(
        "--state", type=Path, default=Path.home() / ".local/state/trivalley/chief-of-staff.sqlite",
        help="Private local briefing state file",
    )
    args = parser.parse_args()
    try:
        payload = json.loads(args.snapshot.read_text(encoding="utf-8"))
        print(briefing(payload, args.state))
    except (OSError, ValueError, sqlite3.Error) as error:
        print(f"Briefing failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
