const STRIPE_VERSION = "2026-09-30.endive";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export function validCheckoutSessionId(value) {
  return typeof value === "string" && /^cs_(live|test)_[A-Za-z0-9]+$/.test(value);
}

export function eligibleSession(session, env) {
  if (!session || typeof session !== "object") return false;
  const expectedAmount = Number(env.EXPECTED_AMOUNT);
  const expectedCurrency = String(env.EXPECTED_CURRENCY || "").toLowerCase();
  const requireLive = String(env.REQUIRE_LIVE || "true").toLowerCase() === "true";

  return (
    session.payment_status === "paid" &&
    session.payment_link === env.PAYMENT_LINK_ID &&
    Number(session.amount_total) === expectedAmount &&
    String(session.currency || "").toLowerCase() === expectedCurrency &&
    (!requireLive || session.livemode === true)
  );
}

async function retrieveSession(sessionId, env) {
  const response = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.STRIPE_RESTRICTED_KEY}`,
        "Stripe-Version": STRIPE_VERSION,
      },
    },
  );

  if (!response.ok) return null;
  return response.json();
}

function configured(env) {
  return Boolean(
    env.STRIPE_RESTRICTED_KEY &&
      env.DOWNLOADS &&
      env.BUYER_OBJECT_KEY &&
      env.PAYMENT_LINK_ID &&
      env.EXPECTED_AMOUNT &&
      env.EXPECTED_CURRENCY,
  );
}

async function secureDownload(url, env) {
  if (!configured(env)) {
    return json({ ok: false, error: "service_unavailable" }, 503);
  }

  const sessionId = url.searchParams.get("session_id");
  if (!validCheckoutSessionId(sessionId)) {
    return json({ ok: false, error: "access_denied" }, 403);
  }

  const session = await retrieveSession(sessionId, env);
  if (!eligibleSession(session, env)) {
    return json({ ok: false, error: "access_denied" }, 403);
  }

  const object = await env.DOWNLOADS.get(env.BUYER_OBJECT_KEY);
  if (!object || !object.body) {
    return json({ ok: false, error: "file_unavailable" }, 502);
  }

  const headers = new Headers();
  headers.set("Content-Type", "application/zip");
  headers.set(
    "Content-Disposition",
    `attachment; filename="${env.BUYER_FILENAME || "TriValley_Dumbbell_Strength_Starter_v2_1.zip"}"`,
  );
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Pragma", "no-cache");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Content-Security-Policy", "default-src 'none'");
  return new Response(object.body, { status: 200, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        ok: true,
        service: "trivalley-digital-delivery",
        configured: configured(env),
      });
    }

    if (request.method === "GET" && url.pathname === "/download") {
      return secureDownload(url, env);
    }

    return json({ ok: false, error: "not_found" }, 404);
  },
};
