import type { Env } from "./env";
import { handleCam } from "./cam";

const json = (data: unknown, cache: string) =>
  new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache },
  });

// 邊緣快取：同機房的請求直接回存好的結果，不查 D1。鍵帶 APP_VERSION 與前端傳的 m（meta 的 syncedAt），
// 同步後前端拿到新的 syncedAt，就會換新的鍵，不會把舊資料當新的存起來。
async function edge(url: URL, env: Env, ctx: ExecutionContext, cache: string, build: () => Promise<unknown>) {
  const key = new Request(`${url.origin}${url.pathname}?app=${encodeURIComponent(env.APP_VERSION)}&m=${encodeURIComponent(url.searchParams.get("m") ?? "")}`);
  const hit = await caches.default.match(key);
  if (hit) return hit;
  const res = json(await build(), cache);
  ctx.waitUntil(caches.default.put(key, res.clone()));
  return res;
}

export async function handleApi(url: URL, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (url.pathname === "/api/meta") {
    return edge(url, env, ctx, "public, max-age=60, s-maxage=300", async () => {
      const last = await env.DB.prepare("SELECT modified_date, ran_at, cam_count FROM sync_log WHERE status='ok' ORDER BY id DESC LIMIT 1").first();
      const n = await env.DB.prepare("SELECT count(*) AS n FROM cams WHERE active=1").first<{ n: number }>();
      return { version: env.APP_VERSION, modifiedDate: last?.modified_date ?? null, syncedAt: last?.ran_at ?? null, count: n?.n ?? 0 };
    });
  }
  if (url.pathname === "/api/cams") {
    // 60 支鏡頭一次回全部；不含原始影像網址（影像一律走 /api/cam/<id>）
    return edge(url, env, ctx, "public, max-age=3600, s-maxage=86400", async () => {
      const { results } = await env.DB.prepare(
        "SELECT id, station, name, role, county, district, place, lon, lat, url IS NOT NULL AS live FROM cams WHERE active=1 ORDER BY station, id",
      ).all();
      return { cams: results };
    });
  }
  if (url.pathname.startsWith("/api/cam/")) return handleCam(url.pathname.slice("/api/cam/".length), env, ctx);
  return json({ error: "not found" }, "no-store");
}
