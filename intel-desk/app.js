/* TriValley Global Intelligence Desk: public metadata, read-only, no inferred geolocation. */
(function () {
  "use strict";
  const $ = function (id) { return document.getElementById(id); };
  const state = { dataset: null, category: "All", search: "", days: 7, map: null, markers: null };
  const NOW_STALE_MS = 8 * 60 * 60 * 1000;
  function node(tag, className, value) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (value !== undefined && value !== null) n.textContent = String(value);
    return n;
  }
  function put(parent, child) { parent.appendChild(child); return child; }
  function safeLink(value) {
    try { const u = new URL(value); return u.protocol === "https:" ? u.href : null; }
    catch (_) { return null; }
  }
  function formattedDate(value, short) {
    if (!value) return "Time not supplied";
    const date = new Date(value);
    if (Number.isNaN(+date)) return "Time unavailable";
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", timeZoneName: short ? undefined : "short"
    }).format(date);
  }
  function isHazard(e) { return e && e.kind === "hazard"; }
  function isIncluded(e) {
    if (state.category === "Hazards" && !isHazard(e)) return false;
    if (state.category !== "All" && state.category !== "Hazards" && e.topic !== state.category) return false;
    const words = [e.title, e.publisher, e.topic, (e.mentions || []).join(" ")].join(" ").toLowerCase();
    if (state.search && !words.includes(state.search)) return false;
    if (e.observed_at) {
      const age = Date.now() - Date.parse(e.observed_at);
      if (Number.isFinite(age) && age > state.days * 86400000) return false;
    }
    return true;
  }
  function setWarning(text) {
    const box = $("warning");
    box.hidden = !text;
    box.textContent = text || "";
  }
  function statusView(data) {
    const health = Array.isArray(data.source_health) ? data.source_health : [];
    const good = health.filter(function (s) { return s.state === "ok"; }).length;
    const updated = Date.parse(data.generated_at);
    const age = Date.now() - updated;
    const stale = !Number.isFinite(age) || age < -120000 || age > NOW_STALE_MS;
    const isMissing = !health.length;
    const isDegraded = data.status !== "OK" || good < health.length;
    const pill = $("live-status");
    pill.classList.remove("failed", "degraded");
    if (stale || isMissing) {
      pill.classList.add("failed");
      pill.lastChild.textContent = "STALE / UNVERIFIED";
      setWarning("No validated recent snapshot is available. Do not treat displayed records as current intelligence.");
    } else if (isDegraded) {
      pill.classList.add("degraded");
      pill.lastChild.textContent = "PARTIAL FEED COVERAGE";
      setWarning("One or more feeds failed in the last refresh. Coverage is incomplete; verify at each source.");
    } else {
      pill.lastChild.textContent = "PUBLIC FEEDS UPDATED";
      setWarning("");
    }
    $("as-of").textContent = "AS OF " + (data.generated_at ? formattedDate(data.generated_at, false) : "NOT AVAILABLE");
    $("metric-health").textContent = good + " / " + health.length;
    const box = $("source-health");
    box.replaceChildren();
    if (!health.length) put(box, node("p", "footnote", "No ingestion receipt is available."));
    health.forEach(function (feed) {
      const line = put(box, node("div", "source-line"));
      put(line, node("span", "", feed.name));
      put(line, node("span", feed.state === "ok" ? "ok" : "error",
        feed.state === "ok" ? "OK · " + (feed.count || 0) : "ERROR"));
    });
  }
  function renderFeed(items) {
    $("feed-count").textContent = items.length + " SHOWN";
    const target = $("feed-list");
    target.replaceChildren();
    if (!items.length) {
      put(target, node("div", "placeholder", "No signals match these filters. Check feed health and the snapshot timestamp."));
      return;
    }
    items.slice(0, 100).forEach(function (item) {
      const url = safeLink(item.url);
      const entry = node(url ? "a" : "div", "feed-item");
      if (url) {
        entry.href = url;
        entry.target = "_blank";
        entry.rel = "noopener noreferrer";
      }
      const tags = put(entry, node("div", "event-tags"));
      put(tags, node("span", "event-category" + (isHazard(item) ? " hazard" : ""), item.topic));
      put(tags, node("span", "", item.source + " · " + formattedDate(item.observed_at, true)));
      put(entry, node("span", "event-title", item.title || "Untitled source event"));
      const foot = put(entry, node("div", "event-foot"));
      put(foot, node("span", "", item.publisher || "Source unknown"));
      put(foot, node("span", "", isHazard(item) ? "Agency metadata · open source ↗" : "Media report · not verified ↗"));
      put(target, entry);
    });
  }
  function createPopup(item) {
    const wrap = node("div");
    put(wrap, node("strong", "", item.title));
    put(wrap, node("div", "", item.source + " · " + formattedDate(item.observed_at, true)));
    const url = safeLink(item.url);
    if (url) {
      const a = put(wrap, node("a", "", "Open original record ↗"));
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
    return wrap;
  }
  function renderMap(events) {
    if (typeof window.L === "undefined") {
      $("map").replaceChildren(node("div", "map-loading", "Map library unavailable. Event wire remains accessible."));
      return;
    }
    if (!state.map) {
      $("map").replaceChildren();
      state.map = window.L.map("map", { zoomControl: true, worldCopyJump: true }).setView([23, 7], 2);
      window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
      }).addTo(state.map);
      state.markers = window.L.layerGroup().addTo(state.map);
    }
    state.markers.clearLayers();
    let count = 0;
    events.forEach(function (e) {
      if (!isHazard(e) || !Array.isArray(e.position) || e.position.length !== 2) return;
      const lat = Number(e.position[0]), lng = Number(e.position[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
          Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
      const color = e.source === "USGS" ? "#deb273" : "#47cdbd";
      window.L.circleMarker([lat, lng], {
        radius: e.source === "USGS" ? 6 : 5, color: color,
        weight: 1, fillColor: color, fillOpacity: 0.62
      }).bindPopup(createPopup(e)).addTo(state.markers);
      count++;
    });
    $("metric-mapped").textContent = String(count);
    setTimeout(function () { state.map.invalidateSize(); }, 0);
  }
  function renderConnections(data) {
    const target = $("connections-list");
    target.replaceChildren();
    const list = Array.isArray(data.connections) ? data.connections : [];
    const visible = list.filter(function (c) {
      return !state.search || (c.place_mention + " " + c.topics.join(" ")).toLowerCase().includes(state.search);
    });
    if (!visible.length) {
      put(target, node("div", "placeholder",
        "No cross-topic candidates passed the strict keyword and publisher checks. This is not evidence of safety or absence."));
      return;
    }
    visible.forEach(function (c) {
      const card = put(target, node("article", "connection"));
      const heading = put(card, node("div", "connection-head"));
      put(heading, node("strong", "", c.place_mention));
      put(heading, node("span", "", "CANDIDATE · UNVERIFIED"));
      const tags = put(card, node("div", "topic-tags"));
      (c.topics || []).forEach(function (t) { put(tags, node("span", "topic-tag", t)); });
      put(card, node("small", "", (c.article_count || 0) + " indexed reports · " +
        (c.publisher_count || 0) + " publisher domains · shared headline mention only"));
      const sources = put(card, node("div", "connection-evidence"));
      (c.evidence || []).slice(0, 3).forEach(function (e) {
        const url = safeLink(e.url);
        if (!url) return;
        const a = put(sources, node("a", "", e.publisher + ": " + e.title + " ↗"));
        a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
      });
    });
  }
  function renderCorroboration(assessment, source) {
    const list = $("corroboration-list");
    const official = $("primary-review-list");
    list.replaceChildren();
    official.replaceChildren();
    const current = assessment && assessment.schema === "trivalley.global-intel-corroboration.v1" &&
      assessment.generated_at === source.generated_at && assessment.approval_state === "REVIEW_REQUIRED";
    if (!current) {
      $("corroboration-status").textContent = "Review data missing or does not match the current snapshot. No cross-publisher verification claimed.";
      put(list, node("div", "placeholder", "No current corroboration receipt available."));
      return;
    }
    const candidates = Array.isArray(assessment.cross_publisher_leads) ? assessment.cross_publisher_leads : [];
    const primary = Array.isArray(assessment.official_publication_leads) ? assessment.official_publication_leads : [];
    const counts = assessment.counts || {};
    $("corroboration-status").textContent = candidates.length + " cross-publisher review leads · " +
      primary.length + " official publication leads · " +
      (counts.eligible_report_headlines || 0) + " eligible headlines · " +
      "not independently fact-checked";
    if (!candidates.length) {
      put(list, node("div", "placeholder", "No cross-publisher pairs met the strict checks. This is not an all-clear and does not rule out serious events."));
    }
    candidates.slice(0, 6).forEach(function (candidate) {
      const card = put(list, node("article", "connection"));
      const heading = put(card, node("div", "connection-head"));
      put(heading, node("strong", "", candidate.place_mention + " · " + candidate.action_tag));
      put(heading, node("span", "", "LEAD · NOT VERIFIED"));
      put(card, node("small", "", candidate.topic + " · independent publisher families: " +
        (candidate.publisher_families || []).join(" / ") + " · editorial syndication unresolved"));
      const sources = put(card, node("div", "connection-evidence"));
      (candidate.evidence || []).slice(0, 2).forEach(function (e) {
        const u = safeLink(e.url);
        if (!u) return;
        const a = put(sources, node("a", "", e.publisher + " — " + e.title + " ↗"));
        a.href = u; a.target = "_blank"; a.rel = "noopener noreferrer";
      });
    });
    primary.slice(0, 5).forEach(function (e) {
      const u = safeLink(e.url);
      if (!u) return;
      const a = put(official, node("a", "", e.publisher + " — " + e.title + " ↗"));
      a.href = u; a.target = "_blank"; a.rel = "noopener noreferrer";
    });
  }
  function redraw() {
    if (!state.dataset) return;
    const all = Array.isArray(state.dataset.events) ? state.dataset.events : [];
    const filtered = all.filter(isIncluded);
    renderFeed(filtered);
    renderMap(filtered);
    renderConnections(state.dataset);
  }
  async function load() {
    try {
      const response = await fetch("./data/events.json", { cache: "no-store" });
      if (!response.ok) throw Error("HTTP " + response.status);
      const data = await response.json();
      if (data.schema !== "trivalley.global-intel.v1" ||
          !Array.isArray(data.events) || !Array.isArray(data.connections)) {
        throw Error("Unrecognized data format");
      }
      state.dataset = data;
      $("metric-events").textContent = String(data.events.length);
      $("metric-links").textContent = String(data.connections.length);
      $("metric-mapped").textContent = String(data.events.filter(function (e) {
        return isHazard(e) && Array.isArray(e.position);
      }).length);
      statusView(data);
      redraw();
      try {
        const corroborationResponse = await fetch("./data/corroboration.json", { cache: "no-store" });
        if (!corroborationResponse.ok) throw Error("review_data_unavailable");
        renderCorroboration(await corroborationResponse.json(), data);
      } catch (_) {
        renderCorroboration(null, data);
      }
    } catch (err) {
      $("live-status").classList.add("failed");
      $("live-status").lastChild.textContent = "FEED UNAVAILABLE";
      setWarning("Unable to load a validated snapshot (" + String(err.message || "unknown error") +
        "). Open the sources below to verify current conditions.");
      $("feed-list").replaceChildren(node("div", "placeholder", "No records loaded. No demonstration events substituted."));
      $("connections-list").replaceChildren(node("div", "placeholder", "No analysis without source data."));
      $("source-health").replaceChildren(node("p", "footnote", "Feed health unavailable."));
      $("corroboration-status").textContent = "No validated current source evidence.";
      $("corroboration-list").replaceChildren(node("div", "placeholder", "Review queue unavailable."));
      $("primary-review-list").replaceChildren();
    }
  }
  document.querySelectorAll(".filter").forEach(function (button) {
    button.addEventListener("click", function () {
      state.category = button.dataset.filter;
      document.querySelectorAll(".filter").forEach(function (b) {
        b.classList.toggle("active", b === button);
        b.setAttribute("aria-pressed", String(b === button));
      });
      redraw();
    });
  });
  $("search").addEventListener("input", function (e) {
    state.search = String(e.target.value || "").trim().toLowerCase().slice(0, 100);
    redraw();
  });
  $("window").addEventListener("change", function (e) {
    state.days = Number(e.target.value) === 2 ? 2 : 7;
    redraw();
  });
  load();
}());
