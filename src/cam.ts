import type { Env } from "./env";

// /api/cam/<id>：替學生代抓鏡頭「現在」的畫面。
// 為什麼代抓：原站一張約 300KB、要等數秒；一班 30 人同時開不能全部打到水保署主機。
// 為什麼只收 id、不收網址：網址只從 D1 查，避免被拿來當跳板去抓別的網站（SSRF）。
// 取不到或不是 JPEG 就回 204，前端顯示「現在看不到」，不把壞掉的東西當圖片傳出去。
const TTL = 300; // 秒；機房快取 5 分鐘
const ID = /^\d{1,3}-\d{1,3}$/;

export async function handleCam(id: string, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (!ID.test(id)) return new Response(null, { status: 404 });
  const key = new Request(`https://cam.cache/${id}`);
  const hit = await caches.default.match(key);
  if (hit) return hit;

  const row = await env.DB.prepare("SELECT url FROM cams WHERE id=? AND active=1").bind(id).first<{ url: string | null }>();
  if (!row) return new Response(null, { status: 404 });
  if (!row.url) return new Response(null, { status: 204, headers: { "cache-control": "public, max-age=3600" } }); // 這支沒有直接畫面

  // 取不到一律回 204（前端顯示「現在看不到」），原因寫在 x-cam-error 標頭，排錯時 curl -D - 就看得到
  const fail = (why: string) => new Response(null, { status: 204, headers: { "cache-control": "public, max-age=30", "x-cam-error": why } });
  let up: Response;
  try {
    up = await fetch(row.url, { headers: { "User-Agent": "Mozilla/5.0 landslide-detective" }, signal: AbortSignal.timeout(25000) });
  } catch (e) {
    return fail(`fetch失敗：${e instanceof Error ? e.message : String(e)}`);
  }
  const type = up.headers.get("content-type") ?? "";
  if (!up.ok) return fail(`上游 HTTP ${up.status}`);
  if (!/^image\/jpeg/i.test(type)) return fail(`上游不是 JPEG：${type.slice(0, 40)}`);
  const body = await up.arrayBuffer();
  if (body.byteLength < 2000) return fail(`畫面太小（${body.byteLength} 位元組）`);

  const res = new Response(body, {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": `public, max-age=${TTL}`,
      "x-fetched-at": new Date().toISOString(), // 前端可顯示「幾分鐘前的畫面」，驗證快取也看這個
    },
  });
  ctx.waitUntil(caches.default.put(key, res.clone()));
  return res;
}
