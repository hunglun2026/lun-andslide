-- cams：水保署土石流觀測站的攝影機，每次同步都會被覆寫（沒出現就下架，不刪）
CREATE TABLE cams (
  id           TEXT PRIMARY KEY,      -- 由影像網址取出的「站號-鏡頭號」，例：2-1
  station      TEXT NOT NULL,         -- 觀測站名，例：九份二山
  name         TEXT NOT NULL,         -- 鏡頭名（已去前後空白），例：中游攝影機
  role         TEXT NOT NULL,         -- up / mid / down / pano / other（由鏡頭名判斷）
  county       TEXT,                  -- 縣市（官方 JSON 提供；缺的用同站其他鏡頭補）
  district     TEXT,                  -- 鄉鎮市區
  place        TEXT,                  -- 架設或拍攝地點
  lon          REAL,
  lat          REAL,
  url          TEXT,                  -- 原始即時影像網址；只給 /api/cam 代抓用，不直接給前端。NULL＝沒有可代抓的畫面
  active       INTEGER NOT NULL DEFAULT 1,
  synced_at    TEXT
);
CREATE INDEX idx_cams_active ON cams(active);

-- sync_log：每次檢查一列，出問題時回頭查
CREATE TABLE sync_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ran_at        TEXT NOT NULL,
  modified_date TEXT,   -- data.gov.tw 回報的 modifiedDate
  status        TEXT NOT NULL,   -- ok / skipped / error
  cam_count     INTEGER,
  message       TEXT
);
