import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createContext, Script } from "node:vm";

const html = await readFile(new URL("../website/wix/funnel-events.html", import.meta.url), "utf8");
const script = new Script(html.match(/<script>([\s\S]+)<\/script>/)[1]);
const origin = "https://www.trivalley.fit";

function browser(path = "/", search = "") {
  class Element {
    constructor(href, { id = "", hero = false } = {}) {
      this.href = href;
      this.id = id;
      this.hero = hero;
    }
    closest(selector) {
      return selector === "a[href]" || (selector === "#tv-coaching-hero" && this.hero) ? this : null;
    }
  }
  const listeners = [];
  const window = { location: { origin, pathname: path, search }, dataLayer: [] };
  const document = { addEventListener: (type, handler) => {
    assert.equal(type, "click");
    listeners.push(handler);
  } };
  const context = createContext({ document, Element, URL, URLSearchParams, window });
  script.runInContext(context);
  script.runInContext(context);
  assert.equal(listeners.length, 1);
  return {
    click: (href, options = {}, isTrusted = true) => {
      listeners[0]({ target: new Element(href, options), isTrusted });
    },
    events: window.dataLayer,
  };
}

test("known homepage links emit intent once without copying hrefs or URL parameters", () => {
  const b = browser();
  b.click(origin + "/service-page/start-here-elite-assessment?test=opaque", { hero: true });
  b.click(origin + "/fitness-guides", { hero: true });
  b.click(origin + "/coaching", { hero: true });
  b.click(origin + "/fitness-guides");
  b.click("https://other.example/fitness-guides", { hero: true });
  b.click(origin + "/coaching", { hero: true }, false);
  assert.deepEqual(b.events.map(item => item.funnel_action), ["assessment_click", "guides_click", "online_coaching_click"]);
  assert.ok(b.events.every(item => Object.keys(item).length === 2 && item.event === "tvf_website_funnel"));
});

test("guide samples and checkout entry emit only the action and allowlisted guide", () => {
  const b = browser("/product-page/trx-suspension-strength");
  b.click("https://static.wixstatic.com/media/example.jpg", { id: "tv-guide-sample-link" });
  b.click(origin + "/checkout?checkoutId=synthetic");
  assert.deepEqual(b.events.map(item => item.funnel_action), ["guide_preview_open", "wix_checkout_entry"]);
  assert.ok(b.events.every(item => item.guide_slug === "trx-suspension-strength"));
  assert.doesNotMatch(JSON.stringify(b.events), /checkoutId|synthetic|example\.jpg/);
});

test("the coaching checkout route and QA exclusion work independently", () => {
  const b = browser("/coaching");
  b.click("https://buy.stripe.com/demo");
  assert.deepEqual(b.events.map(item => item.funnel_action), ["stripe_checkout_entry"]);
  const qa = browser("/", "?utm_source=trivalley_qa");
  qa.click(origin + "/coaching", { hero: true });
  assert.equal(qa.events.length, 0);
});
