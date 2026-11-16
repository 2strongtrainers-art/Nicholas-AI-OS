# Controlled personal AI texting — iPhone + Cloudflare

STATUS: Source implementation prepared for review. It is NOT deployed, NOT connected to the owner's iPhone and NOT enabled for outgoing texting. The system does not port a phone number or change Beside settings.

## Architecture and limits

One specific person sends an SMS or iMessage to the existing iPhone number → an Apple Shortcuts Message automation on that phone runs → a POST to an independent Cloudflare Worker → the Worker checks the token, approved pseudonymous contact ID, and paid/send guards → a model generates a bounded response and recalls recent approved history → the Worker returns a send/draft/handoff decision → ONLY the iPhone Send Message action can transmit a text → the Shortcut acknowledges successful execution of the send action for memory.

The new Cloudflare Worker is named nk-personal-text-assistant. It is completely separate from nicholas-ai-switchboard and nicholas-ai-os. It does not call n8n or Hermes, has no scheduled unsolicited outreach and cannot send SMS itself. A live iPhone, cellular/Wi-Fi connectivity, correct Shortcuts permissions and real-device testing are required. An ACK means the local send action completed, not that the recipient's carrier delivered it.

## Security controls

- NO universal inbound reader and NO "anyone" auto-sending: one Message automation for each specifically approved sender; hardcode the same person as recipient in its Send Message step.
- CONTACTS_JSON is a Cloudflare Worker secret containing anonymous IDs with enabled:true and consent:true; auto:true additionally required to return action=send.
- Independent secret CLIENT_TOKEN (at least 32 random characters) for reply and acknowledgment and separate CONTROL_TOKEN for pause/resume/forget. Never reuse Cloudflare or Hermes keys as a phone token.
- OPENAI_API_KEY is a project-scoped Cloudflare secret. Never embed it in Shortcuts or this public GitHub repository.
- ALLOW_PAID_AI, ALLOW_OUTBOUND_SEND and AUTO_REPLY_ENABLED each default to false. The code never calls paid AI unless the paid gate is true and never returns send unless ALL three flags are true.
- Max 20 AI requests per contact per UTC day; 12 seconds maximum upstream response time; duplicates and rapid message loops are suppressed.
- STOP is stored even while paid AI is off or the contact is paused. STOP, owner pause/forget, and retention expiry cancel an in-flight reply before it can authorize a local send. These controls cannot recall a response already returned to the phone; disable its Message automation for immediate takeover.
- Inbound authentication codes, crises, medical, money, legal, romantic, and other sensitive requests are handed off rather than auto-replied. Opt-outs permanently stop that contact's automation pending deliberate owner review.
- Short structured model output; no tool execution, booking, payment, URLs, secrets or personal claims. Every automatic reply starts with "AI assistant:".
- Each contact's conversation history resides in a separate SQLite Durable Object, limited to 12 messages and erased 48 hours after the last inbound/ack. Paused/opted-out markers survive. Provider request uses store:false. No raw message bodies are deliberately logged.
- If any check or service fails, DO NOT send a text. Turn off the Message automation in Shortcuts for immediate manual takeover.

## Cloudflare activation sequence — owner-only

1. Review this PR and CI results. Merge only if checks pass. Deployment is manual-only from main.
2. In the existing Cloudflare account deploy this *separate* Worker. Either run npm ci and npm run deploy from services/personal-text-assistant in an authenticated development environment, or run the GitHub Action named Deploy Personal Text Assistant, entering confirmation "deploy-isolated-worker". Its GitHub environment is personal-text-assistant, and it requires CLOUDFLARE_API_TOKEN as a GitHub secret and CLOUDFLARE_ACCOUNT_ID as a GitHub variable. An editor token restricted to other existing Workers cannot create this new Worker. Have an authorized account operator provision nk-personal-text-assistant once, then restrict its deployment token to that Worker's immutable ID. Keep the environment restricted to main. Workers product Admin is only needed by an operator creating the new Worker; no DNS, billing, Containers, KV or unrelated Worker permission is required by this workers.dev + Durable Object design. Do not broaden the existing production token to make deployment pass.
3. In Cloudflare Workers & Pages → nk-personal-text-assistant → Settings → Variables and Secrets, add encrypted CLIENT_TOKEN, CONTROL_TOKEN, OPENAI_API_KEY and CONTACTS_JSON. For a single test contact, the CONTACTS_JSON secret value is:
   {"pilot_01":{"enabled":true,"consent":true,"auto":false}}
   No real phone number, identity or message belongs in this config. Use the same ID in Shortcuts.
4. Test the Worker's /health endpoint. A healthy endpoint does NOT imply that AI is enabled. With the three false gates, /reply must return action=skip.
5. To permit draft-only tests, change ALLOW_PAID_AI to "true" in wrangler.jsonc through a reviewed update, redeploy the independent Worker, and leave ALLOW_OUTBOUND_SEND, AUTO_REPLY_ENABLED and contact auto as false. Review the OpenAI project's usage and billing controls: this service limits requests per contact, not total dollars. Test short nonsensitive messages and ensure replies are returned as action=draft only.
6. Once the recipient has been informed of the AI assistant and the on-device path has been verified, review and change ALLOW_OUTBOUND_SEND and AUTO_REPLY_ENABLED to "true" and set that contact's auto:true inside the encrypted Cloudflare secret. Redeploy. No other contact becomes eligible until individually added.
7. To turn off paid requests, set ALLOW_PAID_AI false and redeploy. To turn off sending, set AUTO_REPLY_ENABLED false and redeploy; the fastest manual kill switch is disabling the iOS Message automation.

Cloudflare secrets are attached to the NEW Worker only. Never copy unrelated production bindings or credentials from Hermes.

## iPhone shortcut build — required local user action

Apple requires personal automation setup on your iPhone. A Cloudflare Worker or chat session cannot install or approve a Message automation remotely.

For each consenting, explicitly approved contact:

1. In Shortcuts select Automation, add a Message trigger and select that ONE contact as Sender. Use Run Immediately if available and allow running while locked where supported. Never choose every sender for full AI responses.
2. In the automation, identify the incoming text through the Shortcut Input magic variable. Check on the device that it contains the message body, not the sender's name or the entire message object. If unavailable, stop and do not send.
3. Add Generate UUID and save it as a variable named Event ID; retain this identical value through the whole run.
4. Add URL with your deployed HTTPS endpoint ending /reply. Follow with Get Contents of URL, POST, request body JSON containing:
   contact_id = pilot_01 (Text)
   event_id = Event ID (Variable)
   message = incoming message text (Variable)
   HTTP header Authorization = Bearer followed by CLIENT_TOKEN (private)
5. Read Dictionary Value "action" from the JSON response. Add an IF block: ONLY if action is exactly "send", obtain dictionary "text", and execute Send Message to the same approved contact hardcoded in the automation. Turn off Show When Run if iOS allows automatic sending. Any draft, handoff, skip, failure, empty or malformed response MUST NOT enter the Send Message branch.
6. After the Send Message action completes successfully, add another Get Contents of URL with POST to /ack, JSON contact_id = pilot_01, event_id = SAME Event ID, identical Authorization header. An attempted or failed Send Message is not an acknowledged send.
7. Optionally display a local notification without any message contents when action is handoff or draft.
8. For a second contact create a NEW sender-specific automation with its own alias in CONTACTS_JSON and its recipient explicitly pinned. Never extract an outbound recipient from incoming message content.

For manual pause, disable the specific Message automation. Advanced option: create a separate Pause AI Texting shortcut POST /control with Authorization: Bearer CONTROL_TOKEN and JSON contact_id=pilot_01, command=pause; use command=resume only after contact consent remains valid. The forget command deletes all stored history and flags; first remove an opted-out user from CONTACTS_JSON to avoid unintended reactivation.

## API specification

GET /health: publicly reports simple service liveness, but no secrets, contact details or approval state.

POST /reply: Authorization: Bearer CLIENT_TOKEN. JSON has contact_id, event_id (UUID generated per incoming event), and message (up to 1200 characters). Response action is one of: send, draft, skip, handoff. Only send authorizes the *local* Send Message step.

POST /ack: same authorization. JSON: contact_id, event_id. Marks that specific pending outgoing text as sent by the Shortcuts action, adding that approved turn to contact memory. This is not an SMS delivery receipt.

POST /control: Authorization: Bearer CONTROL_TOKEN. JSON: contact_id, command (pause/resume/forget). Never place CONTROL_TOKEN inside the incoming-message automation.

Never put personal messages, phone numbers, tokens, or provider keys into GitHub, logs, screenshots, PR descriptions or connected agents.

## Before enabling live auto-send, prove these on the actual phone

Test both SMS and iMessage from the one approved sender, locked screen, no network, incorrect token, identical and rapid consecutive texts, sensitive message, STOP, failing provider, a manual text intervening, sent-message acknowledgment, and pause/resume. Do not claim live functionality without these checks. Keep early sending limited to routine, low-sensitivity contacts; do not enroll banks, medical practices, lawyers, family/romantic conversations, unknown senders, or clients with confidential health information.

## Data/privacy caveats

Forwarding a message to a cloud AI provider takes its content outside iMessage end-to-end encryption. Tell recipients that an automated AI assistant may read and reply, obtain appropriate consent, and do not connect unrelated personal/medical/client threads. Cloudflare's memory expires after 48 hours via Durable Object alarms, but platform/provider retention, backup, and legal obligations may differ. Disable the Shortcut and revoke contact approval if consent is withdrawn.

## Reproducible developer validation

From services/personal-text-assistant:
- npm run check
- npm test
- npm ci --no-audit --no-fund --ignore-scripts
- WRANGLER_SEND_METRICS=false npm run dry-run

Use Node 22.15 or newer. Runtime tests substitute an in-memory Durable Object base and synthetic provider responses, and cover opt-out while disabled/paused, cancellation during provider I/O, authentication, cost reservations, duplicates and acknowledgments. They make no model or message-sending requests. Wrangler's compile-only check verifies the Worker bundle and bindings; actual Cloudflare and iPhone acceptance remain separate checks.

The repository's PR CI performs these checks without model requests or outbound messaging. A passing CI is not an actual iPhone send test.
