import type { Env } from "./env";
import { toCams, type Cam, type MoaCam, type RawCam } from "./stations";
import { notifyError } from "./notify";

const META_URL = (id: string) => `https://data.gov.tw/api/v2/rest/dataset/${id}`;
// 直接 JPG 的影像網址只有這支 API 有；縣市、行政區、地點在中繼資料指的官方 JSON（見 stations.ts 開頭）
const FEMA_API = "https://fema.ardswc.gov.tw/WebServices/GetSWCBStationCCDInfo.ashx";
const MOA_FALLBACK = "https://data.moa.gov.tw/Service/OpenData/DataFileService.aspx?UnitId=111&IsTransData=1";
const getJson = async (url: string, what: string) => {
  const resp = await get(url);
  if (!resp.ok) throw new Error(`下載${what}失敗：HTTP ${resp.status}`);
  const data = JSON.parse((await resp.text()).replace(/^﻿/, ""));
  if (!Array.isArray(data)) throw new Error(`${what}不是陣列，格式可能改版`);
  return data;
};
const MIN_ROWS = 20; // 低於這個筆數視為來源異常，保留舊資料（平常 60 支）
// 失敗時把來源網站名稱寫進錯誤訊息（ntfy 通知與同步紀錄才看得出是哪一個來源逾時或被擋）
const get = async (url: string) => {
  try {
    return await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 landslide-detective" }, signal: AbortSignal.timeout(20000) });
  } catch (e) {
    throw new Error(`連不上 ${new URL(url).host}：${e instanceof Error ? e.message : String(e)}`);
  }
};

export interface SyncResult { status: "ok" | "skipped" | "error"; message: string; modified?: string; cams?: number }

async function log(env: Env, r: SyncResult) {
  await env.DB.prepare("INSERT INTO sync_log (ran_at, modified_date, status, cam_count, message) VALUES (?,?,?,?,?)")
    .bind(new Date().toISOString(), r.modified ?? null, r.status, r.cams ?? null, r.message).run();
}

// force=true：不管日期有沒有變都重匯入（手動補跑用）
export async function runSync(env: Env, force = false): Promise<SyncResult> {
  let res: SyncResult;
  try {
    const meta: any = await (await get(META_URL(env.DATASET_ID))).json();
    const r = meta.result ?? meta;
    const modified: string = r.modifiedDate;
    if (!modified) throw new Error("中繼資料沒有 modifiedDate，來源格式可能改版");

    const last = await env.DB.prepare("SELECT modified_date FROM sync_log WHERE status='ok' ORDER BY id DESC LIMIT 1").first<{ modified_date: string }>();
    if (!force && last?.modified_date === modified) {
      res = { status: "skipped", message: "資料沒有更新", modified };
      await log(env, res);
      return res;
    }

    const moaUrl: string = (r.distribution ?? []).find((d: any) => /json/i.test(d.resourceFormat))?.resourceDownloadUrl ?? MOA_FALLBACK;
    const fema = (await getJson(FEMA_API, "影像網址資料")) as RawCam[];
    const moa = (await getJson(moaUrl, "觀測站地點資料")) as MoaCam[];
    const cams = toCams(fema, moa);
    if (cams.length < MIN_ROWS) throw new Error(`只解析出 ${cams.length} 支鏡頭（少於 ${MIN_ROWS}），疑似來源異常，已保留舊資料`);

    await importCams(env, cams);
    res = { status: "ok", message: `匯入 ${cams.length} 支鏡頭（影像 ${fema.length} 列、地點 ${moa.length} 列）`, modified, cams: cams.length };
    await log(env, res);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res = { status: "error", message: msg };
    try { await log(env, res); } catch { /* log 寫不進去也要繼續通知 */ }
    await notifyError(env, "土石流小偵探：資料同步失敗", msg);
    return res;
  }
}

const COLS = ["id", "station", "name", "role", "county", "district", "place", "lon", "lat", "url"] as const;

// 一個 batch ＝ 一個交易：先全部下架，再逐筆 upsert 設回上架。任何一步失敗整批回滾。
async function importCams(env: Env, cams: Cam[]) {
  const now = new Date().toISOString();
  const sql =
    `INSERT INTO cams (${COLS.join(",")}, active, synced_at) VALUES (${COLS.map(() => "?").join(",")}, 1, ?) ` +
    `ON CONFLICT(id) DO UPDATE SET ${COLS.filter((c) => c !== "id").map((c) => `${c}=excluded.${c}`).join(",")}, active=1, synced_at=excluded.synced_at`;
  const stmts = [env.DB.prepare("UPDATE cams SET active=0")];
  for (const c of cams) stmts.push(env.DB.prepare(sql).bind(...COLS.map((k) => (c as any)[k]), now));
  await env.DB.batch(stmts);
}
