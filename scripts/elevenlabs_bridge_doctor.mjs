/** Read-only health check for the existing TriValley Cloudflare ElevenLabs MCP bridge.
 * No credentials, generation, billing, logout, connection mutation, or private identifiers.
 * The public /health endpoint cannot establish an authenticated ChatGPT connection.
 */
const DEFAULT_URL = 'https://nicholas-ai-os.2strongtrainers.workers.dev';
export async function diagnose(fetchImpl = fetch, baseUrl = DEFAULT_URL, timeoutMs = 7000) {
  const result = {
    checked_at: new Date().toISOString(),
    endpoint: new URL('/health', baseUrl).href,
    bridge_reachable: false,
    expected_service: false,
    oauth_configured: null,
    grant_storage_bound: null,
    provider_voice_verified: false,
    chatgpt_mcp_verified: false,
    recommended_action: null,
    status: 'UNKNOWN',
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(result.endpoint, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!response.ok) {
      result.status = 'HEALTH_HTTP_ERROR';
      result.recommended_action = `Worker health returned HTTP ${response.status}; inspect the existing Cloudflare deployment (not Replit).`;
      return result;
    }
    let json;
    try { json = await response.json(); }
    catch {
      result.status = 'INVALID_HEALTH_JSON';
      result.recommended_action = 'Worker responds but health JSON cannot be parsed. Check deployment/route.';
      return result;
    }
    result.bridge_reachable = json.ok === true;
    result.expected_service = json.service === 'nicholas-elevenlabs-bridge';
    result.oauth_configured = json.oauth_configured === true;
    result.grant_storage_bound = json.grant_storage_bound === true;
    if (!result.bridge_reachable || !result.expected_service) {
      result.status = 'WRONG_SERVICE';
      result.recommended_action = 'Verify the Cloudflare URL targets the ElevenLabs bridge; do not send credentials.';
    } else if (!result.grant_storage_bound) {
      result.status = 'OAUTH_STORAGE_MISSING';
      result.recommended_action = 'Verify OAUTH_GRANTS binding and oauth-grants-v1 SQLite Durable Object migration.';
    } else if (!result.oauth_configured) {
      result.status = 'OAUTH_SECRETS_MISSING';
      result.recommended_action = 'In the authenticated Cloudflare Worker, configure OAUTH_SIGNING_SECRET and CHATGPT_SETUP_CODE as secrets. Never put values in GitHub or chat.';
    } else {
      result.status = 'PUBLIC_PREFLIGHT_PASS';
      result.recommended_action = 'Next: reconnect ChatGPT custom MCP using PKCE, test authenticated bridge_status/find_voices and verify the existing August Nick voice. The public health result alone is not a full connection test.';
    }
    return result;
  } catch (error) {
    result.status = error?.name === 'AbortError' ? 'HEALTH_TIMEOUT' : 'NETWORK_ERROR';
    result.recommended_action = 'Check Cloudflare Worker routing and service status, then retry one read-only probe.';
    return result;
  } finally { clearTimeout(timer); }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const arg = process.argv.find(x => x.startsWith('--url='));
  const base = arg ? arg.slice(6) : DEFAULT_URL;
  if (!/^https:\/\//.test(base)) { console.error('Only https:// URLs are allowed'); process.exit(64); }
  const report = await diagnose(fetch, base);
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.status === 'PUBLIC_PREFLIGHT_PASS' ? 0 : 2;
}