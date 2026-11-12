"""Summarize dated aggregate evidence for the public TriValley.fit funnel."""

from datetime import datetime

from commerce.instagram.control import instant, integer


METRIC_SOURCES = {
    "home_views": "wix_analytics",
    "assessment_page_views": "wix_analytics",
    "guide_shop_views": "wix_analytics",
    "homepage_to_assessment": "wix_analytics",
    "homepage_to_guides": "wix_analytics",
    "assessment_clicks": "verified_click_analytics",
    "guide_shop_clicks": "verified_click_analytics",
    "guide_preview_opens": "verified_click_analytics",
    "dumbbell_checkout_sessions": "wix_analytics",
    "trx_checkout_sessions": "wix_analytics",
    "shoulder_checkout_sessions": "wix_analytics",
    "confirmed_assessment_bookings": "wix_bookings",
    "dumbbell_paid_orders": "wix_orders",
    "trx_paid_orders": "wix_orders",
    "shoulder_paid_orders": "wix_orders",
    "online_coaching_paid_signups": "stripe_checkout",
}


def summarize(snapshot: dict, now: datetime) -> dict:
    if not isinstance(snapshot, dict):
        raise ValueError("Website evidence must be an object")
    start = instant(snapshot["period_start"])
    end = instant(snapshot["period_end"])
    if not start < end <= now:
        raise ValueError("Website evidence needs a complete, ordered date window")
    qa_traffic = snapshot.get("qa_traffic_possible", True)
    if type(qa_traffic) is not bool:
        raise ValueError("qa_traffic_possible must be Boolean")
    observations = snapshot.get("observations", {})
    if not isinstance(observations, dict) or observations.keys() - METRIC_SOURCES.keys():
        raise ValueError("Website evidence contains an unknown observation")

    counts = {}
    for metric, source in METRIC_SOURCES.items():
        observation = observations.get(metric)
        if observation is None:
            counts[metric] = {"count": None, "source": source}
            continue
        if not isinstance(observation, dict) or observation.get("source") != source:
            raise ValueError(f"{metric} needs evidence from {source}")
        count = integer(observation.get("count"), metric)
        reference = observation.get("reference")
        if not isinstance(reference, str) or not reference.strip():
            raise ValueError(f"{metric} needs a source reference")
        counts[metric] = {"count": count, "source": source, "reference": reference.strip()}

    return {
        "period_start": start.isoformat(),
        "period_end": end.isoformat(),
        "qa_traffic_possible": qa_traffic,
        "observations": counts,
    }
