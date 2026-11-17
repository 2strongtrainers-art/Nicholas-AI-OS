# ARGUS Event Graph v1 — integrity-first link analysis

**Status:** proposed integration, not a live intelligence deployment. No owner-private
case data, secrets, or source image bytes are committed. Requires reviewed PR and CI
before merge; the n8n/Chief live workflow is unchanged.

## Selection and acquisition

- **NetworkX 3.7** (BSD-3-Clause), installed by the new GitHub Actions job from a
  pinned requirements file. Its MultiDiGraph stores separate directed evidence
  links and event-event links.
- **Offline SVG viewer** in intel-desk/event-graph.html is self-contained: no third-party scripts or network calls; loads a selected JSON locally.
- **Cytoscape.js** (MIT) was evaluated as an optional future high-volume visual engine, but is deliberately NOT loaded for owner-private cases to avoid third-party runtime code.
- **OASIS STIX 2.1** inspired explicit source, target, kind, confidence, and
  external references, but this is **not** a fully conformant STIX bundle.
- **ACLED** inspired immutable event IDs, event-date precision, explicit source
  attribution, and revision-friendly notes; no ACLED feed access is claimed.
- **ICD 203** inspired distinct source claims, analytical hypotheses, and
  documented limitations.

## Model

Canonical JSON keys: schema, cutoff, visibility, sources[], events[],
relationships[]. Each event has stable id, occurred_on, optional occurred_to,
date precision, summary, tags, review_status, and source_ids. Each source
has an HTTPS URL and publisher_family. Each event-event relationship has
stable id, source_event_id, target_event_id, type, assertion, source_ids,
confidence, and review_status.

Allowed types are Shared subject, Temporal sequence, Documented interaction,
Hypothesis. An edge is not an instruction to infer who attacked whom.
Source→event REPORTS edges are mechanically derived from explicit source_ids.
Event→event edges are **manually authored** and reviewed, not discovered
automatically from headline proximity.

The validator rejects:
1. Dangling endpoints and sources, duplicate IDs, self-links, duplicate triples.
2. Missing provenance, HTTP URLs, invalid dates and future events.
3. Temporal links backwards in time.
4. Shared-subject/temporal edges without a shared specific controlled tag.
5. "Causes" or any other unapproved relationship type.
6. Documented interaction without reviewed status and 2 publisher families.
7. Promotion of an untested Hypothesis to established fact.

A shared tag is **only a basic semantic guard**, not proof of a real relationship.
Two publishers might also repeat the same unverified original claim; source
independence must be evaluated by a human analyst. The validator cannot verify
source truth, real-world identities or causal mechanisms.

## Local use (owner-private)

Keep the real case JSON **outside the public repo**:
    python -m pip install -r requirements/argus-event-graph.txt
    python scripts/argus_event_graph.py /private/path/graph.json --graphml /private/path/graph.graphml

Open intel-desk/event-graph.html in a browser; choose the JSON file. The
page uses the local File API with no network requests and no third-party runtime.
It renders a selected event's source/reporting edges and explicitly authored
candidate relationships. The browser does NOT perform server-side validation:
run the Python integrity gate first. The raw JSON can be reloaded into
NetworkX or reviewed using Gephi.

## Production gates

1. PR CI green including bad-link regression tests.
2. Owner-private mission payload reconciled to the local canonical case
   dataset; ARGUS save_report requires the *current* mission revision and full
   replacement arrays. Do not publish the mission into this public repo.
3. Independent human confirmation of every proposed Documented interaction.
4. Red-team test: deliberate cross-theater links and wrong source IDs fail.
5. Only after owner approval, wire a reviewed/private exporter into existing
   ARGUS → n8n → Chief workflow. No automated publishing or causality promotion.

References:
- https://networkx.org/documentation/stable/reference/classes/multidigraph.html
- https://js.cytoscape.org/
- https://docs.oasis-open.org/cti/stix/v2.1/stix-v2.1-os.html
- https://acleddata.com/methodology/acled-codebook
- https://www.dni.gov/index.php/how-we-work/objectivity
