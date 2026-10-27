import type { Env } from "./env";
import { handleApi } from "./api";
import { runSync } from "./sync";

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) return handleApi(url, env, ctx);
    if (url.pathname === "/admin/sync" && req.method === "POST") {
      // 手動補跑：header 帶 Authorization: Bearer <ADMIN_TOKEN>；?force=1 不管日期都重匯入
      if (!env.ADMIN_TOKEN || req.headers.get("authorization") !== `Bearer ${env.ADMIN_TOKEN}`) {
        return new Response("unauthorized", { status: 401 });
      }
      return Response.json(await runSync(env, url.searchParams.get("force") === "1"));
    }
    return env.ASSETS.fetch(req);
  },
  async scheduled(_e: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runSync(env));
  },
};
