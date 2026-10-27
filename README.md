# 土石流小偵探

用農業部農村發展及水土保持署的開放資料做的國小土石流防災教學網站（網域待確認）。給老師課堂使用，免註冊、免安裝。

工具：看溪觀察站（64 支鏡頭的即時畫面）、臺灣地圖（含找站點遊戲）、認識溪流（官方知識與前兆）、我的鄉鎮（17 縣市的潛勢溪流）、闖關、探險護照、教師專區（學習單、全螢幕上課模式、搶答計分板、班級連結與 QR 碼、課程包）。

## 資料來源與授權

- [土石流觀測站影像](https://data.gov.tw/dataset/9327)：鏡頭名稱、縣市、行政區、地點、經緯度與即時畫面
- [113 年度土石流潛勢溪流影響範圍圖](https://data.gov.tw/dataset/167441)：縣市、鄉鎮、村里、風險等級、影響住戶數（不使用保全住戶門牌）
- 防災知識：水保署「土石流及大規模崩塌防災資訊網」官方頁面，每題附出處
- 以上依[政府資料開放授權條款第 1 版](https://data.gov.tw/license)使用，資料版權屬原提供機關
- 臺灣海岸線：Natural Earth（公有領域）
- 即時畫面只代抓並暫存 5 分鐘，不長期保存；本站不是官方警報

## 架構

一支 Cloudflare Worker 同時提供網頁（`public/`）、API（`src/api.ts`）與每日排程（`src/sync.ts`）。

| 路徑 | 負責 |
|---|---|
| `src/index.ts` | 路由入口（fetch、scheduled、`/admin/sync`） |
| `src/api.ts` | `/api/meta`、`/api/cams`（含邊緣快取） |
| `src/cam.ts` | `/api/cam/<id>` 代抓即時影像，快取 5 分鐘 |
| `src/stations.ts` | 兩份觀測站資料合併、鏡頭角色分類 |
| `src/sync.ts` | 每天檢查資料集更新並匯入 D1，失敗走 ntfy |
| `public/js/streams.json` | 潛勢溪流（`scripts/build-streams.py` 從 SHP 轉出） |
| `public/js/taiwan.json` | 臺灣海岸線（`scripts/build-taiwan.py`） |
| `scripts/` | 離線測試、資料轉檔、字型子集、注音、簡體字檢查、端對端腳本 |

## 開發

```
npm install
npm run db:local
npx wrangler dev --port 8813
curl -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" "http://127.0.0.1:8813/admin/sync?force=1"
npm test                                   # 解析、合併、題庫的離線檢查
python scripts/check-simplified.py         # 簡體字檢查
python scripts/build-font.py --check       # 字型缺字檢查
```

本機 `.dev.vars` 寫 `ADMIN_TOKEN=...`；正式環境的 `NTFY_TOPIC`、`ADMIN_TOKEN` 是 Worker 密鑰，不放在 repo。
