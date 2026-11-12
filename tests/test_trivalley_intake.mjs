import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createContext, runInNewContext, SourceTextModule, SyntheticModule } from "node:vm";

const root = new URL("../workflows/n8n/", import.meta.url);
const workflow = JSON.parse(await readFile(new URL("trivalley-coaching-intake.json", root), "utf8"));
const route = workflow.nodes.find(node => node.type === "n8n-nodes-base.code").parameters.jsCode;
const relay = await readFile(new URL("wix-backend-events.js", root), "utf8");
const inquiryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sample = { id: inquiryId, service: "coaching", contactPermission: true };
const formId = "synthetic-coaching-form";
const consentField = "test_consent";
const webhook = "https://intake.example.test/webhook";
const configuredRelay = relay
  .replace("__TRIVALLEY_WIX_FORM_ID__", formId)
  .replace("__TRIVALLEY_WIX_CONSENT_FIELD__", consentField)
  .replace("__TRIVALLEY_N8N_WEBHOOK_URL__", webhook)
  .replace("__TRIVALLEY_INTAKE_CUTOVER_UTC__", "2026-11-12T17:08:00Z");

function decision(body) {
  const input = { first: () => ({ json: { body } }) };
  const result = runInNewContext(`(() => { ${route} })()`, { $input: input }, { timeout: 1000 });
  return JSON.parse(JSON.stringify(result[0].json));
}

function submission(overrides = {}, metadata = {}) {
  return {
    entity: {
      formId,
      namespace: "wix.form_app.form",
      status: "CONFIRMED",
      _createdDate: "2026-11-12T18:00:00Z",
      _id: inquiryId,
      submissions: { [consentField]: true, private_test_field: "synthetic value" },
      ...overrides,
    },
    metadata,
  };
}

async function startRelay(responses = [], credential = "b".repeat(64), source = configuredRelay) {
  const requests = [];
  const errors = [];
  const context = createContext({ console: { error: (...args) => errors.push(args) } });
  const bindings = {
    "wix-auth": { elevate: fn => fn },
    "wix-secrets-backend.v2": { secrets: { getSecretValue: async () => ({ value: credential }) } },
    "wix-fetch": {
      fetch: async (url, options) => {
        requests.push({ url, options, body: JSON.parse(options.body) });
        const outcome = responses.shift();
        if (outcome instanceof Error) throw outcome;
        if (outcome !== undefined) return { status: outcome, ok: false };
        return { ok: true, json: async () => decision(JSON.parse(options.body)).body };
      },
    },
  };
  const module = new SourceTextModule(source, { context });
  await module.link(specifier => {
    const exports = bindings[specifier];
    assert.ok(exports, `Unexpected relay dependency ${specifier}`);
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
    }, { context });
  });
  await module.evaluate();
  return { handlers: module.namespace, requests, errors };
}

test("the n8n restore starts inactive and has no environment bindings", () => {
  assert.equal(workflow.active, false);
  assert.deepEqual(workflow.pinData, {});
  assert.ok(workflow.nodes.every(node => !node.credentials && !node.webhookId));
  const trigger = workflow.nodes.find(node => node.type === "n8n-nodes-base.webhook");
  assert.equal(trigger.parameters.authentication, "headerAuth");
  assert.equal(workflow.settings.saveDataSuccessExecution, "none");
  assert.equal(workflow.settings.saveDataErrorExecution, "none");
  assert.equal(workflow.settings.saveManualExecutions, false);
  const write = workflow.nodes.find(node => node.type === "n8n-nodes-base.dataTable");
  assert.equal(write.parameters.dataTableId.value, "");
  assert.equal(write.parameters.operation, "upsert");
  assert.deepEqual(write.parameters.filters.conditions, [
    { keyName: "inquiry_id", keyValue: "={{ $json.body.id }}" },
  ]);
  assert.doesNotMatch(JSON.stringify(workflow) + relay, /app\.n8n\.cloud|https:\/\/[^"]+\/webhook\//);
});

test("explicit consent creates a draft and every other consent value is held", () => {
  const ready = decision(sample);
  assert.equal(ready.body.status, "draft-for-review");
  assert.equal(ready.body.id, inquiryId);
  assert.ok(ready.body.draft.subject);
  for (const permission of [false, undefined, "true", 1, null]) {
    assert.deepEqual(decision({ ...sample, contactPermission: permission }), {
      httpStatus: 200, body: { id: inquiryId, status: "hold-for-consent" },
    });
  }
});

test("bad IDs, other services, and extra fields never queue", () => {
  for (const [body, field] of [
    [[], "body"], [{ ...sample, id: "invalid" }, "id"],
    [{ ...sample, service: "other" }, "service"],
    [{ ...sample, private_test_field: "synthetic value" }, "unexpected-field"],
  ]) {
    assert.deepEqual(decision(body), { httpStatus: 400, body: { status: "invalid-intake", field } });
  }
});

test("the Wix relay minimizes the payload and ignores older, unrelated, or unconfirmed submissions", async () => {
  const { handlers, requests } = await startRelay();
  await handlers.wixForms_onSubmissionCreated(submission({ status: "PENDING" }));
  await handlers.wixForms_onSubmissionUpdated(submission({ formId: "unrelated" }));
  await handlers.wixForms_onSubmissionUpdated(submission({ _createdDate: "2026-11-11T00:00:00Z" }));
  await handlers.wixForms_onSubmissionUpdated(submission({}, { triggeredByAnonymizeRequest: true }));
  assert.equal(requests.length, 0);
  await handlers.wixForms_onSubmissionUpdated(submission({ _id: inquiryId.toUpperCase() }));
  await handlers.wixForms_onSubmissionCreated(submission({ submissions: { [consentField]: false } }));
  assert.deepEqual(requests.map(r => r.body), [sample, { ...sample, contactPermission: false }]);
  assert.equal(requests[0].url, webhook);
  assert.equal(requests[0].options.redirect, "error");
});

test("a transient retry reuses the same inquiry ID and a permanent failure stops", async () => {
  const transient = await startRelay([503]);
  await transient.handlers.wixForms_onSubmissionCreated(submission());
  assert.equal(transient.requests.length, 2);
  assert.deepEqual(transient.requests.map(r => r.body), [sample, sample]);
  assert.equal(transient.errors.length, 0);
  const denied = await startRelay([403]);
  await denied.handlers.wixForms_onSubmissionCreated(submission());
  assert.equal(denied.requests.length, 1);
  assert.equal(denied.errors.length, 1);
  assert.doesNotMatch(JSON.stringify(denied.errors), new RegExp(inquiryId));
});

test("missing restore values or an invalid credential prevent delivery", async () => {
  const unconfigured = await startRelay([], "b".repeat(64), relay);
  await unconfigured.handlers.wixForms_onSubmissionCreated(submission());
  assert.equal(unconfigured.requests.length, 0);
  const invalid = await startRelay([], "invalid");
  await invalid.handlers.wixForms_onSubmissionCreated(submission());
  assert.equal(invalid.requests.length, 0);
});
