// 水保署「土石流觀測站影像」的解析：兩份來源用「站號-鏡頭號」合併，欄位清理、鏡頭角色分類。
// 純函式，不碰網路與資料庫，scripts/test-stations.ts 可以離線測。
//
// 為什麼兩份：
//   官方 JSON（data.moa.gov.tw，資料集中繼資料指的那份）有縣市、行政區、架設地點，但影像網址只是 HTML 網頁。
//   原 API（fema.ardswc.gov.tw）影像網址是直接的 JPG，但沒有縣市。
//   兩份的 StationID／CCDId 與 /stations/{站號}/{鏡頭號}/ 是同一組編號，所以用 id 合併。

export interface RawCam {         // 原 API
  StationName?: string;
  Name?: string;
  Longitude?: string;
  Latitude?: string;
  URL?: string;
}

export interface MoaCam {         // 官方 JSON
  攝影機名稱?: string;
  縣市?: string;
  行政區?: string;
  架設或拍攝地點?: string;
  影像連結網址?: string;
  經度?: string;
  緯度?: string;
}

export type Role = "up" | "mid" | "down" | "pano" | "other";

export interface Cam {
  id: string;
  station: string;
  name: string;
  role: Role;
  county: string | null;
  district: string | null;
  place: string | null;
  lon: number | null;
  lat: number | null;
  url: string | null;             // 直接的即時 JPG 網址；null＝這支鏡頭沒有可代抓的畫面
}

const FEMA_ID = /\/stations\/(\d+)\/(\d+)\//;
const MOA_ID = /StationID=(\d+)&CCDId=(\d+)/;

// 鏡頭名 → 角色。先看「全景」（上游全景式、下游全景式要算全景），再看上中下游。
// 沒有上中下游字樣的（崩塌地、沉砂池、停車場…）歸 other，不硬猜。
export function roleOf(name: string): Role {
  if (/全景/.test(name)) return "pano";
  if (/上游/.test(name)) return "up";
  if (/中游/.test(name)) return "mid";
  if (/下游/.test(name)) return "down";
  return "other";
}

const num = (s: unknown): number | null => {
  const n = Number(String(s ?? "").trim());
  return Number.isFinite(n) && n !== 0 ? n : null;
};
const txt = (s: unknown): string | null => String(s ?? "").trim() || null;

// 台灣本島與離島大致範圍，座標跑出去就當壞資料（不收座標，但鏡頭還是留著）
const inTaiwan = (lon: number, lat: number) => lon > 118 && lon < 123 && lat > 21.5 && lat < 26.5;

// 官方 JSON 沒有獨立的「站名」欄，從鏡頭名切：「集來上游攝影機-1」→「集來」
const stationFromName = (full: string) => full.replace(/(上游|中游|下游|全景|攝影機).*$/, "").trim() || full;

export function toCams(fema: RawCam[], moa: MoaCam[] = []): Cam[] {
  const byId = new Map<string, Cam>();

  for (const r of fema) {
    const url = (r.URL ?? "").trim();
    const m = FEMA_ID.exec(url);
    if (!m || !url.startsWith("https://img.ardswc.gov.tw/")) continue; // 網址不對的整筆略過
    const id = `${m[1]}-${m[2]}`;
    if (byId.has(id)) continue;
    const name = (r.Name ?? "").trim();
    const lon = num(r.Longitude), lat = num(r.Latitude);
    const ok = lon !== null && lat !== null && inTaiwan(lon, lat);
    byId.set(id, { id, station: (r.StationName ?? "").trim(), name, role: roleOf(name),
      county: null, district: null, place: null, lon: ok ? lon : null, lat: ok ? lat : null, url });
  }

  for (const r of moa) {
    const m = MOA_ID.exec(r.影像連結網址 ?? "");
    if (!m) continue;
    const id = `${m[1]}-${m[2]}`;
    const full = (r.攝影機名稱 ?? "").trim();
    let c = byId.get(id);
    if (!c) { // 只有官方 JSON 有的鏡頭（例：集來站）：保留，但沒有可代抓的畫面
      const station = stationFromName(full);
      const name = full.startsWith(station) ? full.slice(station.length) || full : full;
      const lon = num(r.經度), lat = num(r.緯度);
      const ok = lon !== null && lat !== null && inTaiwan(lon, lat);
      c = { id, station, name, role: roleOf(name), county: null, district: null, place: null,
        lon: ok ? lon : null, lat: ok ? lat : null, url: null };
      byId.set(id, c);
    }
    c.county = txt(r.縣市);
    c.district = txt(r.行政區);
    c.place = txt(r.架設或拍攝地點);
  }

  // 沒有縣市的鏡頭（例：原 API 有、官方 JSON 沒有的 3-8），用同一個站號的其他鏡頭補
  const bySt = new Map<string, Cam>();
  for (const c of byId.values()) if (c.county) bySt.set(c.id.split("-")[0], c);
  for (const c of byId.values()) {
    if (c.county) continue;
    const s = bySt.get(c.id.split("-")[0]);
    if (s) { c.county = s.county; c.district = s.district; }
  }

  return [...byId.values()].sort((a, b) => {
    const [as, ac] = a.id.split("-").map(Number), [bs, bc] = b.id.split("-").map(Number);
    return as - bs || ac - bc;
  });
}
