// 離線測試：解析 2026-10-27 抓下來的真實 API 回應（scripts/fixtures/cams.json）。
// 執行：npm test（Node 22 --experimental-strip-types）
import { readFileSync } from "node:fs";
import { toCams, roleOf } from "../src/stations.ts";

let fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
};

const raw = JSON.parse(readFileSync(new URL("./fixtures/cams.json", import.meta.url), "utf8"));
const moa = JSON.parse(readFileSync(new URL("./fixtures/moa.json", import.meta.url), "utf8"));
const cams = toCams(raw, moa);
const by = Object.fromEntries(cams.map((c) => [c.id, c]));

eq("合併後 64 支（原 API 60＋官方 JSON 獨有 4）", cams.length, 64);
eq("id 不重複", new Set(cams.map((c) => c.id)).size, 64);
eq("23 個觀測站（含集來）", new Set(cams.map((c) => c.station)).size, 23);
eq("依站號鏡頭號排序", cams.map((c) => c.id).slice(0, 2), ["1-2", "2-1"]);
eq("九份二山 2-1 座標轉數字", [by["2-1"].station, by["2-1"].lon, by["2-1"].lat], ["九份二山", 120.8552, 23.95073]);
eq("沒有前後空白的鏡頭名", cams.filter((c) => c.name !== c.name.trim()).length, 0);
eq("每支都有座標", cams.filter((c) => c.lon === null).length, 0);
eq("每支都有縣市", cams.filter((c) => !c.county).length, 0);
eq("大粗坑在新北市瑞芳鎮", [by["7-2"].county, by["7-2"].district], ["新北市", "瑞芳鎮"]);
eq("集來 4 支只有官方 JSON，沒有即時畫面", cams.filter((c) => c.station === "集來" && c.url === null).length, 4);
eq("集來在高雄市杉林區", [by["19-1"].county, by["19-1"].district], ["高雄市", "杉林區"]);
const st3 = cams.filter((c) => c.id.startsWith("3-") && c.id !== "3-8" && c.county);
eq("3-8 原本沒有縣市，用同站其他鏡頭補上", [st3.length > 0, by["3-8"].county], [true, st3[0]?.county]);
eq("其餘 60 支都有即時畫面網址", cams.filter((c) => c.url).length, 60);
eq("火炎山名稱寫法不同仍合併", by["26-1"].station, "火炎山");

eq("上游全景式算全景", roleOf("上游全景式攝影機"), "pano");
eq("下游攝影機-2 算下游", roleOf("下游攝影機-2"), "down");
eq("愛玉子溪上游攝影機-1 算上游", roleOf("愛玉子溪上游攝影機-1"), "up");
eq("中游鋼索攝影機 算中游", roleOf("中游鋼索攝影機"), "mid");
eq("沉砂池攝影機 算 other", roleOf("沉砂池攝影機"), "other");
eq("崩塌地攝影機 算 other", roleOf("崩塌地攝影機"), "other");

// 壞資料：網址不是水保署影像站、座標跑到海外
const bad = toCams([
  { StationName: "甲", Name: "上游攝影機", Longitude: "120.1", Latitude: "23.1", URL: "https://evil.example/stations/1/1/x" },
  { StationName: "乙", Name: "上游攝影機", Longitude: "0", Latitude: "0", URL: "https://img.ardswc.gov.tw/opendata/api/v1/debris/stations/9/9/lastest/k" },
]);
eq("非水保署網址整筆略過", bad.length, 1);
eq("座標 0 不收但鏡頭保留", [bad[0].lon, bad[0].lat], [null, null]);
eq("集來站名切法", toCams([], [{ 攝影機名稱: "集來上游攝影機-1", 影像連結網址: "x?StationID=19&CCDId=1" }])[0].station, "集來");

const role = Object.fromEntries(["up", "mid", "down", "pano", "other"].map((r) => [r, cams.filter((c) => c.role === r).length]));
console.log("角色分布", JSON.stringify(role));
console.log(fail ? `\n${fail} 項失敗` : "\n全部通過");
process.exit(fail ? 1 : 0);
