import assert from "node:assert/strict";
import { after, test } from "node:test";
import { build } from "esbuild";

const { outputFiles } = await build({
  entryPoints: [new URL("../src/hermes-index.ts", import.meta.url).pathname],
  bundle: true,
  write: false,
  format: "esm",
  loader: { ".txt": "text" },
});
const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);
const calls = [];
const replies = [];
const upstream = test.mock.method(globalThis, "fetch", async (url, options) => {
  calls.push({ url, ...JSON.parse(options.body) });
  assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(options.headers.get("authorization"), "Bearer fake-openrouter-key");
  assert.ok(replies.length, "unexpected upstream request");
  const reply = replies.shift();
  if (reply instanceof Error) throw reply;
  return reply;
});
after(() => upstream.mock.restore());

function ask(body, vars = {}, authorized = true, signal) {
  calls.length = 0;
  const request = new Request("https://switchboard.example/ask", {
    method: "POST",
    headers: authorized ? { authorization: "Bearer fake-switchboard-key" } : {},
    body: JSON.stringify(body),
    signal,
  });
  return worker.fetch(request, {
    SWITCHBOARD_API_KEY: "fake-switchboard-key",
    OPENROUTER_API_KEY: "fake-openrouter-key",
    OX_MODEL: "z-ai/glm-5.3",
    QWEN_MODEL: "qwen/qwen3.8-2.4t-a95b",
    ...vars,
  });
}

function completion(model, finish = "stop", content = "Finding with evidence", usage = { cost: 0.002 }) {
  return Response.json({ model, choices: [{ finish_reason: finish, message: { content } }], usage });
}

function rejection(status, source, { reason, message = "Upstream internal detail", headers } = {}) {
  return Response.json({ error: { code: status, message, metadata: { limit_source: source, reason } } }, { status, headers });
}

test("production schema advertises a 1,500-token default and all aliases", async () => {
  const response = await worker.fetch(new Request("https://switchboard.example/openapi.json"), {});
  const schema = await response.json();
  const askSchema = schema.paths["/ask"].post.requestBody.content["application/json"].schema;
  assert.equal(askSchema.properties.max_tokens.default, 1500);
  assert.deepEqual(askSchema.properties.model.enum, ["ox", "qwen", "auto", "free", "qwen-flash"]);
  assert.equal(schema.paths["/hermes/jobs"].post.operationId, "createHermesJob");
  assert.equal(calls.length, 0);
});

test("configured Ox, Qwen and Auto make one completion call and report provider attribution and cost", async () => {
  for (const [alias, model, tokens] of [
    ["ox", "z-ai/glm-5.3", undefined],
    ["qwen", "qwen/qwen3.8-2.4t-a95b", 7000],
    ["auto", "openrouter/auto", 64],
  ]) {
    replies.push(completion(model === "openrouter/auto" ? "provider/actual-model" : model));
    const response = await ask({ model: alias, prompt: "One finding", max_tokens: tokens });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].model, model);
    assert.equal(calls[0].max_tokens, Math.max(256, tokens ?? 1500));
    assert.equal(body.attempts, 1);
    assert.equal(body.response_model, model === "openrouter/auto" ? "provider/actual-model" : model);
    assert.equal(body.cost_usd, 0.002);
    assert.equal(body.truncated, false);
  }
});

test("free works with paid routing disabled and Flash applies a provider price ceiling", async () => {
  replies.push(completion("provider/actual-free-model", "stop", "Evidence", { cost: 0 }));
  const free = await ask({ model: "free", prompt: "Public evidence" }, { ALLOW_PAID_AI: "false" });
  assert.equal(free.status, 200);
  assert.equal(calls[0].model, "openrouter/free");
  assert.equal((await free.json()).cost_usd, 0);
  replies.push(completion("qwen/qwen3.7-flash"));
  const flash = await ask({ model: "qwen-flash", prompt: "Public evidence" });
  assert.equal(flash.status, 200);
  assert.equal(calls[0].model, "qwen/qwen3.7-flash");
  assert.deepEqual(calls[0].provider.max_price, { prompt: 0.1, completion: 0.3, request: 0 });
});

test("authorization, paid kill switch and invalid inputs stop before provider traffic", async () => {
  assert.equal((await ask({ prompt: "Review" }, {}, false)).status, 401);
  for (const model of [undefined, "ox", "qwen", "qwen-flash", "auto"]) {
    const response = await ask({ model, prompt: "Review" }, { ALLOW_PAID_AI: false });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error_code, "paid_ai_disabled");
    assert.equal(calls.length, 0);
  }
  for (const body of [null, [], { model: "typo", prompt: "Review" }, { prompt: "Review", max_tokens: "1200" }, { prompt: "Review", max_tokens: -1 }]) {
    assert.equal((await ask(body)).status, 400);
    assert.equal(calls.length, 0);
  }
  assert.equal((await ask({ prompt: "Review", system: "x".repeat(200_000) })).status, 413);
  assert.equal(calls.length, 0);
});

test("an affordable 402 retries once on the same model at the smaller allowance", async () => {
  replies.push(
    rejection(402, "openrouter_credits", { reason: "weight_exceeds_budget" }),
    completion("qwen/qwen3.8-2.4t-a95b", "length"),
  );
  const response = await ask({ model: "qwen", prompt: "Review" });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(calls.map(call => call.max_tokens), [1500, 750]);
  assert.ok(calls.every(call => call.model === "qwen/qwen3.8-2.4t-a95b"));
  assert.equal(body.attempts, 2);
  assert.equal(body.max_tokens, 750);
  assert.equal(body.truncated, true);
});

test("legacy 402 can supply the exact affordable token cap", async () => {
  replies.push(
    rejection(402, undefined, { message: "You requested up to 1500 tokens, but can only afford 438." }),
    completion("z-ai/glm-5.3"),
  );
  const response = await ask({ model: "ox", prompt: "Review" });
  assert.equal(response.status, 200);
  assert.deepEqual(calls.map(call => call.max_tokens), [1500, 438]);
});

test("repeated rejection ends the retry and exposes the actionable limit without echoing provider text", async () => {
  replies.push(
    rejection(402, "openrouter_credits", { reason: "weight_exceeds_budget" }),
    rejection(402, "openrouter_key_limit"),
  );
  const response = await ask({ model: "qwen", prompt: "Review" });
  const body = await response.json();
  assert.equal(response.status, 402);
  assert.equal(body.limit_source, "openrouter_key_limit");
  assert.equal(body.attempts, 2);
  assert.equal(calls.length, 2);
  assert.match(body.error, /key reached/);
  assert.doesNotMatch(JSON.stringify(body), /Upstream internal detail/);
});

test("empty credits, workspace budget, in-flight and rate limits do not retry or substitute a model", async () => {
  for (const [status, source, extra] of [
    [402, "openrouter_credits", { message: "You requested up to 1500 tokens, but can only afford 10." }],
    [402, "openrouter_key_limit"],
    [403, "openrouter_workspace_budget"],
    [402, "openrouter_in_flight_budget"],
    [429, "openrouter_free_tier_per_day"],
  ]) {
    replies.push(rejection(status, source, { ...extra, headers: { "Retry-After": "12", "X-RateLimit-Reset": "1794537000000" } }));
    const response = await ask({ model: source.includes("free") ? "free" : "ox", prompt: "Review" });
    const body = await response.json();
    assert.equal(response.status, status);
    assert.equal(body.limit_source, source);
    assert.equal(body.retry_after, "12");
    assert.equal(body.rate_limit_reset_ms, 1794537000000);
    assert.equal(response.headers.get("retry-after"), "12");
    assert.equal(calls.length, 1);
  }
});

test("ambiguous failures are not retried and missing usage or identity stays unknown", async () => {
  replies.push(new Error("ambiguous connection reset"));
  const failure = await ask({ model: "qwen", prompt: "Review" });
  assert.equal(failure.status, 502);
  assert.equal(calls.length, 1);
  replies.push(completion(undefined, "stop", "Evidence", null));
  const unknown = await (await ask({ model: "qwen", prompt: "Review" })).json();
  assert.equal(unknown.response_model, null);
  assert.equal(unknown.cost_usd, null);
  replies.push(completion("qwen/qwen3.8-2.4t-a95b", "length", ""));
  const empty = await ask({ model: "qwen", prompt: "Review" });
  assert.equal(empty.status, 502);
  assert.equal((await empty.json()).truncated, true);
  assert.equal(calls.length, 1);
});
