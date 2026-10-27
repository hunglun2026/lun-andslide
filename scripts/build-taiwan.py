"""從 Natural Earth 10m 國界資料（公有領域）取出臺灣本島海岸線，簡化後存成 public/js/taiwan.json。

用法：python scripts/build-taiwan.py [geojson路徑]（不給就下載 ne_10m_admin_0_countries.geojson，約 13MB）
只留本島（點最多的那塊）；離島用不到，因為潛勢溪流都在本島。簡化用 Douglas-Peucker，容差 0.004 度（約 400 公尺），
給小朋友看的示意地圖夠用，不能拿來量距離或做精確比對。
"""
import json, sys, urllib.request
from pathlib import Path

URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson"
OUT = Path(__file__).resolve().parent.parent / "public" / "js" / "taiwan.json"
EPS = 0.004


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = (dx * dx + dy * dy) ** 0.5 or 1e-12
    idx, dmax = 0, 0.0
    for i in range(1, len(pts) - 1):
        d = abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / norm
        if d > dmax:
            idx, dmax = i, d
    if dmax > eps:
        return rdp(pts[:idx + 1], eps)[:-1] + rdp(pts[idx:], eps)
    return [pts[0], pts[-1]]


def main():
    data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")) if len(sys.argv) > 1 else json.load(urllib.request.urlopen(URL, timeout=180))
    feat = next(f for f in data["features"] if f["properties"].get("ISO_A3") == "TWN" or f["properties"].get("NAME") == "Taiwan")
    g = feat["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    ring = max((p[0] for p in polys), key=len)
    ring = [(round(x, 4), round(y, 4)) for x, y in ring]
    if ring[0] == ring[-1]:
        ring = ring[:-1]  # 閉合環頭尾同點，Douglas-Peucker 會退化；去掉重複點、從中間切成兩段各自簡化
    h = len(ring) // 2
    pts = rdp(ring[:h + 1], EPS)[:-1] + rdp(ring[h:] + [ring[0]], EPS)[:-1]
    OUT.write_text(json.dumps({"source": "Natural Earth 10m admin_0 (public domain)", "outline": pts}, separators=(",", ":")), encoding="utf-8")
    print(f"{len(ring)} 點 → {len(pts)} 點 → {OUT}（{OUT.stat().st_size} bytes）")


if __name__ == "__main__":
    main()
