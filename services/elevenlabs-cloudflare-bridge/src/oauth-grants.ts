import { DurableObject } from "cloudflare:workers";

/** One strongly consistent Durable Object per OAuth grant. Never use KV for redemption. */
type Grant = { expiresAt: number; refreshId: string; revoked: boolean };

export class OAuthGrantStore extends DurableObject {

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return new Response(null, { status: 405 });
    const action = new URL(request.url).pathname;
    if (!["/consume", "/rotate", "/active"].includes(action)) return new Response(null, { status: 404 });
    let body: Record<string, unknown>;
    try {
      body = await request.json();
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    } catch { return new Response(null, { status: 400 }); }
    const now = Date.now();
    if (action === "/consume" &&
        (typeof body.refreshId !== "string" || !body.refreshId ||
         !Number.isSafeInteger(body.expiresAt) || Number(body.expiresAt) <= now ||
         Number(body.expiresAt) > now + 31 * 86400_000)) return new Response(null, { status: 400 });
    if (action === "/rotate" &&
        (typeof body.refreshId !== "string" || !body.refreshId ||
         typeof body.nextRefreshId !== "string" || !body.nextRefreshId)) return new Response(null, { status: 400 });

    const accepted = await this.ctx.storage.transaction(async (txn) => {
      const grant = await txn.get<Grant>("grant");
      if (action === "/consume") {
        if (grant) {
          await txn.put("grant", { ...grant, revoked: true });
          return false;
        }
        await txn.put("grant", { expiresAt: body.expiresAt, refreshId: body.refreshId, revoked: false });
        await txn.setAlarm(Number(body.expiresAt) + 60_000);
        return true;
      }
      if (!grant || grant.revoked || grant.expiresAt <= now) return false;
      if (action === "/active") return true;
      if (grant.refreshId !== body.refreshId) {
        await txn.put("grant", { ...grant, revoked: true });
        return false;
      }
      await txn.put("grant", { ...grant, refreshId: body.nextRefreshId });
      return true;
    });
    return new Response(null, { status: accepted ? 204 : 409 });
  }

  async alarm(): Promise<void> { await this.ctx.storage.deleteAll(); }
}
