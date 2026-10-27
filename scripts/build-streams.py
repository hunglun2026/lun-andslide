"""把農業部「土石流潛勢溪流影響範圍圖」(data.gov.tw/dataset/167441) 轉成前端用的 public/js/streams.json。

用法：python scripts/build-streams.py [zip路徑]
  不給路徑就下載 113 年度版。新年度版出現時，改 URL 與 VERSION 後重跑。

做的事：
  1. 純 Python 讀 zip 內的 .dbf（不用 GIS 套件）
  2. TWD97 TM2 (121E) 座標轉經緯度；有裝 pyproj 就拿來逐筆核對
  3. 同一條溪流有多個溢流點（多列），合併成一條：風險取最嚴重、戶數取最大、座標取第一個溢流點
  4. 只留縣市、鄉鎮、村里層級，不輸出保全住戶門牌（個資）

輸出格式（陣列的陣列，省流量）：欄位順序見 FIELDS。
"""
import io, json, math, struct, sys, zipfile, urllib.request
from pathlib import Path

VERSION = "113"
URL = "https://data.moa.gov.tw/OpenData/GetOpenDataFile.aspx?id=I89&FileType=SHP&RID=37086"
OUT = Path(__file__).resolve().parent.parent / "public" / "js" / "streams.json"
FIELDS = ["no", "county", "town", "vill", "risk", "res", "lon", "lat"]
RISK_ORDER = {"高": 3, "中": 2, "低": 1, "持續觀察": 0}  # 只用來挑「最嚴重」；持續觀察不比低更嚴重


def read_dbf(data: bytes):
    n, hl, rl = struct.unpack("<xxxxIHH", data[:12])
    fields, o = [], 32
    while data[o] != 0x0D:
        fields.append((data[o:o + 11].split(b"\0")[0].decode(), data[o + 16]))
        o += 32
    for i in range(n):
        rec = data[hl + i * rl + 1: hl + (i + 1) * rl]
        p, d = 0, {}
        for k, ln in fields:
            d[k] = rec[p:p + ln].decode("utf8", "ignore").strip()
            p += ln
        yield d


def twd97_to_lonlat(x: float, y: float):
    """TM2 投影反算（GRS80，中央經線 121E，比例 0.9999，東偏 250000）。"""
    a, f = 6378137.0, 1 / 298.257222101
    k0, lon0, dx = 0.9999, math.radians(121), 250000.0
    e2 = f * (2 - f)
    ep2 = e2 / (1 - e2)
    M = y / k0
    mu = M / (a * (1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256))
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    phi1 = (mu + (3 * e1 / 2 - 27 * e1**3 / 32) * math.sin(2 * mu)
            + (21 * e1**2 / 16 - 55 * e1**4 / 32) * math.sin(4 * mu)
            + (151 * e1**3 / 96) * math.sin(6 * mu)
            + (1097 * e1**4 / 512) * math.sin(8 * mu))
    s, c, t = math.sin(phi1), math.cos(phi1), math.tan(phi1)
    N1 = a / math.sqrt(1 - e2 * s * s)
    T1, C1 = t * t, ep2 * c * c
    R1 = a * (1 - e2) / (1 - e2 * s * s) ** 1.5
    D = (x - dx) / (N1 * k0)
    lat = phi1 - (N1 * t / R1) * (D**2 / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1**2 - 9 * ep2) * D**4 / 24
                                  + (61 + 90 * T1 + 298 * C1 + 45 * T1**2 - 252 * ep2 - 3 * C1**2) * D**6 / 720)
    lon = lon0 + (D - (1 + 2 * T1 + C1) * D**3 / 6
                  + (5 - 2 * C1 + 28 * T1 - 3 * C1**2 + 8 * ep2 + 24 * T1**2) * D**5 / 120) / c
    return math.degrees(lon), math.degrees(lat)


def main():
    if len(sys.argv) > 1:
        blob = Path(sys.argv[1]).read_bytes()
    else:
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        blob = urllib.request.urlopen(req, timeout=120).read()
    z = zipfile.ZipFile(io.BytesIO(blob))
    dbf = next(n for n in z.namelist() if n.lower().endswith(".dbf"))
    rows = list(read_dbf(z.read(dbf)))

    try:
        from pyproj import Transformer
        tr = Transformer.from_crs("EPSG:3826", "EPSG:4326", always_xy=True)
    except Exception:
        tr = None
        print("[提醒] 沒有 pyproj，只用自己的公式轉座標，未逐筆核對")

    streams, maxdiff = {}, 0.0
    for r in rows:
        no = r["Debrisno"]
        try:
            x, y = float(r["Overflow_X"]), float(r["Overflow_Y"])
            lon, lat = twd97_to_lonlat(x, y)
        except ValueError:
            lon = lat = None
        if tr and lon is not None:
            plon, plat = tr.transform(x, y)
            maxdiff = max(maxdiff, abs(plon - lon), abs(plat - lat))
        res = int(r["Total_Res"] or 0)
        risk = r["Risk"]
        s = streams.get(no)
        if s is None:
            streams[no] = {"no": no, "county": r["County"], "town": r["Town"], "vill": r["Vill"],
                           "risk": risk, "res": res,
                           "lon": round(lon, 5) if lon else None, "lat": round(lat, 5) if lat else None}
        else:
            if RISK_ORDER.get(risk, 0) > RISK_ORDER.get(s["risk"], 0):
                s["risk"] = risk
            s["res"] = max(s["res"], res)
    out = [[s[k] for k in FIELDS] for s in streams.values()]
    out.sort(key=lambda a: (a[1], a[2], a[0]))
    OUT.write_text(json.dumps({"version": VERSION, "fields": FIELDS, "rows": out}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"dbf {len(rows)} 列 → {len(out)} 條溪流 → {OUT}（{OUT.stat().st_size // 1024} KB）")
    if tr:
        print(f"自製公式與 pyproj 最大差：{maxdiff:.2e} 度（約 {maxdiff * 111000:.2f} 公尺）")
    nolonlat = sum(1 for a in out if a[6] is None)
    print(f"沒有座標：{nolonlat}")


if __name__ == "__main__":
    main()
