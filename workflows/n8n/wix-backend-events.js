import { elevate } from "wix-auth";
import { fetch } from "wix-fetch";
import { secrets } from "wix-secrets-backend.v2";

const coachingFormId = "__TRIVALLEY_WIX_FORM_ID__";
const consentTarget = "__TRIVALLEY_WIX_CONSENT_FIELD__";
const intakeCutover = Date.parse("__TRIVALLEY_INTAKE_CUTOVER_UTC__");
const queueWebhook = "__TRIVALLEY_N8N_WEBHOOK_URL__";
const loadIntakeSecret = elevate(secrets.getSecretValue);
const submissionIdPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export function wixForms_onSubmissionCreated(event) {
  return relayConfirmedSubmission(event);
}

export function wixForms_onSubmissionUpdated(event) {
  return relayConfirmedSubmission(event);
}

async function relayConfirmedSubmission(event) {
  const submission = event?.entity;
  if (
    submission?.formId !== coachingFormId ||
    submission.namespace !== "wix.form_app.form" ||
    submission.status !== "CONFIRMED" ||
    event.metadata?.triggeredByAnonymizeRequest === true
  ) return;

  const createdAt = new Date(submission._createdDate ?? submission.createdDate).getTime();
  if (!(createdAt >= intakeCutover)) return;

  const id = submission._id ?? submission.id ?? event.metadata?.entityId;
  if (typeof id !== "string" || !submissionIdPattern.test(id)) {
    console.error("TriValley intake relay: missing or invalid submission ID.");
    return;
  }

  const payload = {
    id: id.toLowerCase(),
    service: "coaching",
    contactPermission: submission.submissions?.[consentTarget] === true
  };
  const expectedRoute = payload.contactPermission ? "draft-for-review" : "hold-for-consent";

  let secret;
  try {
    const result = await loadIntakeSecret("TRIVALLEY_N8N_COACHING_INTAKE");
    secret = typeof result === "string" ? result : result?.value;
    if (typeof secret !== "string" || !/^[a-f0-9]{64}$/.test(secret)) {
      throw new Error("Invalid intake secret format");
    }
  } catch {
    console.error("TriValley intake relay: could not load the webhook credential.");
    return;
  }

  let failure = "network";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(queueWebhook, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-trivalley-intake-key": secret
        },
        body: JSON.stringify(payload),
        redirect: "error"
      });
      if (response.ok) {
        const receipt = await response.json();
        if (receipt?.id === payload.id && receipt.status === expectedRoute) return;
        failure = "unexpected receipt";
        break;
      }
      failure = response.status;
      if (response.status < 500 && response.status !== 408 && response.status !== 429) break;
    } catch {
      failure = "network or invalid response";
    }
  }
  console.error("TriValley intake relay: delivery did not complete.", { failure });
}
