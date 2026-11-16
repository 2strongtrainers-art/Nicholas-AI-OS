// Deterministic, side-effect-free checks. No message contents are logged here.
export const RETENTION_MS = 48 * 60 * 60 * 1000;
export const MAX_INBOUND_CHARS = 1200;
export const MAX_REPLY_CHARS = 320;
export const MAX_AI_CALLS_PER_CONTACT_DAY = 20;
export const MIN_REPLY_GAP_MS = 12_000;

export function validContactId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{3,40}$/.test(value);
}
export function validEventId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(value);
}
export function validInbound(value) {
  return typeof value === 'string' && value.trim().length > 0 &&
    value.length <= MAX_INBOUND_CHARS && !/[\u0000-\u0008\u000e-\u001f]/.test(value);
}
export function contactsFromSecret(raw) {
  const contacts = Object.create(null);
  try {
    const value = JSON.parse(raw || '');
    if (!value || Array.isArray(value) || typeof value !== 'object') return contacts;
    for (const [id, data] of Object.entries(value)) {
      if (validContactId(id) && data && typeof data === 'object' &&
          !Array.isArray(data) && data.enabled === true && data.consent === true) {
        contacts[id] = { auto: data.auto === true };
      }
    }
    return contacts;
  } catch {
    return contacts;
  }
}
export function decideMode(env, contact) {
  if (!contact || env.ALLOW_PAID_AI !== 'true' || !env.OPENAI_API_KEY) return 'off';
  return contact.auto && env.ALLOW_OUTBOUND_SEND === 'true' &&
    env.AUTO_REPLY_ENABLED === 'true' ? 'auto' : 'draft';
}
export function classifyInbound(value) {
  const text = value.trim();
  if (/^(stop|unsubscribe|do not text|don't text|no more texts|opt out)\b/i.test(text)) return 'opt_out';
  // Avoid sending routine personally identifying details to a model at all.
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text) ||
      /(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}/.test(text) ||
      /\b\d{1,5}\s+(?:[a-z]+\s+){0,3}(?:street|st|avenue|ave|boulevard|blvd|road|rd|drive|dr|lane|ln)\b/i.test(text) ||
      /\b(?:date of birth|dob|birthday)\b/i.test(text)) return 'sensitive';
  if (
    /\b(?:verification|security|confirmation|one.time|2fa|otp|passcode|password|pin code|login code|reset code)\b/i.test(text) ||
    /\b(?:bank|credit card|account number|routing number|social security|ssn|passport|driver'?s license|wire transfer|venmo|zelle|payment|invoice|billing|debt|loan|tax|investment)\b/i.test(text) ||
    /\b(?:doctor|medical|diagnos\w*|prescriptions?|medications?|symptoms?|hospital|painful|injur\w*|suicid\w*|self.harm|overdos\w*|emergency|911|police|threat)\b/i.test(text) ||
    /\b(?:lawyer|attorney|lawsuit|court|legal notice|divorce|custody|break.?up|relationship|confidential|private|secret|intimate|romantic|i love you)\b/i.test(text) ||
    /\b(?:home address|where do you live|send me your location|your exact location)\b/i.test(text)
  ) return 'sensitive';
  return null;
}
export function safeReply(candidate) {
  if (typeof candidate !== 'string') return null;
  const text = candidate.trim().replace(/\s+/g, ' ');
  if (!text || text.length > MAX_REPLY_CHARS ||
      /(?:https?:\/\/|www\.|@[\w.-]+\.[a-z]{2,})/i.test(text) ||
      /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text) ||
      /(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}/.test(text) ||
      /\b(?:password|passcode|otp|verification code|bank account|credit card|guaranteed|i booked|i charged|i paid|i transferred|i will send money)\b/i.test(text)) return null;
  return text.replace(/^((?:Nick'?s )?AI assistant:\s*)+/i, '');
}
