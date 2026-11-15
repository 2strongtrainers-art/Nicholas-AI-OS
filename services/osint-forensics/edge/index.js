/* ARGUS PRIVATE forensic gateway. Distinct from the existing Switchboard.
   Uploaded evidence is not logged, archived, crawled, or persisted.
   A 32+ character ARGUS_FORENSICS_API_KEY secret is REQUIRED to process. */
import { DurableObject } from "cloudflare:workers";

const LIMIT = 25 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg","image/png","image/webp","image/tiff",
                         "image/avif","image/heic","video/mp4"]);
const PORT = 8080;
function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store",
               "x-content-type-options": "nosniff" },
  });
}
async function correctBearer(header, secret) {
  if (typeof secret !== "string" || secret.length < 32 || !header.startsWith("Bearer ") || header.length > 4096) return false;
  const encoder = new TextEncoder();
  const a = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(secret)));
  const b = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(header.slice(7))));
  let diff = 0;
  for (let i = 0; i < 32; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
export class ForensicInstance extends DurableObject {
  starting;
  async fetch(request) {
    if (new URL(request.url).pathname !== "/analyze") return json(404, {error:"not_found"});
    this.starting ??= this.ensureStarted().finally(() => { this.starting = undefined; });
    await this.starting;
    const url = new URL(request.url);
    url.protocol = "http:";
    url.host = "container";
    const forwarded = new Request(url, request);
    forwarded.headers.delete("authorization");
    forwarded.headers.delete("host");
    return this.ctx.container.getTcpPort(PORT).fetch(forwarded);
  }
  async ensureStarted() {
    const container = this.ctx.container;
    if (!container) throw new Error("container_unavailable");
    if (!container.running) {
      // This is the isolation boundary: block all outbound Internet and DNS.
      container.start({ image:container.images.base, instance:"lite", enableInternet:false });
    }
    await container.setInactivityTimeout(60000);
    const port = container.getTcpPort(PORT);
    for (let i=0; i<80; i++) {
      try {
        const check = await port.fetch("http://container/health", {signal:AbortSignal.timeout(1000)});
        await check.body?.cancel();
        if (check.ok) return;
      } catch { /* Container not yet accepting requests. */ }
      await scheduler.wait(250);
    }
    throw new Error("container_not_ready");
  }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return json(200, {service:"argus-prime-forensics",enabled:
        typeof env.ARGUS_FORENSICS_API_KEY === "string" && env.ARGUS_FORENSICS_API_KEY.length >= 32});
    }
    if (url.pathname !== "/analyze") return json(404, {error:"not_found"});
    if (request.method !== "POST") return json(405, {error:"method_not_allowed"});
    if (typeof env.ARGUS_FORENSICS_API_KEY !== "string" || env.ARGUS_FORENSICS_API_KEY.length < 32) {
      return json(503, {error:"not_configured"});
    }
    if (!(await correctBearer(request.headers.get("authorization") || "", env.ARGUS_FORENSICS_API_KEY))) {
      return json(401, {error:"unauthorized"});
    }
    const type = (request.headers.get("content-type") || "").split(";",1)[0].trim().toLowerCase();
    if (!ALLOWED.has(type)) return json(415, {error:"unsupported_media_type"});
    const claimed = request.headers.get("content-length");
    if (claimed && (!/^\d+$/.test(claimed) || Number(claimed) > LIMIT)) {
      return json(413, {error:"evidence_too_large"});
    }
    const bytes = await request.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > LIMIT) return json(413, {error:"invalid_evidence_size"});
    const sensitive = request.headers.get("x-argus-sensitive") === "1" ? "1" : "0";
    const forwarded = new Request("https://container/analyze", {method:"POST",
      headers: {"content-type":type,"content-length":String(bytes.byteLength),
                "x-argus-sensitive":sensitive},body:bytes});
    try {
      const result = await env.FORENSIC_CONTAINER.getByName("argus-private-primary").fetch(forwarded);
      const h = new Headers(result.headers);
      h.set("cache-control","no-store");
      h.set("x-content-type-options","nosniff");
      return new Response(result.body, {status:result.status,headers:h});
    } catch {
      return json(503, {error:"forensic_container_unavailable"});
    }
  }
};
