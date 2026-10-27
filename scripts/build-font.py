"""產生自架中文字型子集 public/fonts/ls-sans-<包>-<雜湊>.woff2（Noto Sans TC，SIL OFL 1.1）。

拆包：瀏覽器靠 @font-face 的 unicode-range 只下載畫面上真的出現的字所在的那包。
  第 0 包＝介面文字（首頁、遊戲頁只要這包加第 1 包）；第 1 包＝地名（縣市、鄉鎮、村里、站名）；之後＝介紹文字，依出現次數每包約 400 字。
  檔名帶內容雜湊，可以放心設長快取；@font-face 由本腳本寫進 style.css 的 FONTS:BEGIN～END 區塊（不要手改）。

為什麼自架：不自架的話，每台電腦會退回不同系統字型，字形不一致；Google Fonts 又多一次外部連線。
字元範圍（多收沒關係，少收才會退回系統字型）：
  1. 網站所有頁面與程式裡的文字
  2. streams.json（縣市、鄉鎮、村里名）與觀測站 fixtures 的全部文字
  （不再額外收 Big5 常用字：那樣檔案 1.6MB，教室網路太慢；資料更新出現新字時跑 --check 補切）
用法：
  python scripts/build-font.py           重新切字型
  python scripts/build-font.py --check   檢查現有資料與網站文字有沒有字不在任何一包裡（有就離場碼 1）
來源字型沿用 tools/web-design 的快取（~/.cache/web-design/fonts/），不用重新下載 12MB。
"""
import csv
import hashlib
import io
import re
import shutil
import sys
from pathlib import Path

sys.path.insert(0, r"D:\ClaudeOnly\tools\web-design")
from webdesign import fonts  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "public" / "fonts"
CSS = ROOT / "public" / "css" / "style.css"
CHUNK = 400
EMOJI = re.compile("[\u2190-\u2bff\u3030\u303d\u3297\u3299\U0001f000-\U0001faff\ufe0f\u200d\u20e3]")




def ui_text() -> str:
    return "".join(p.read_text(encoding="utf-8") for ext in ("html", "js", "css") for p in (ROOT / "public").rglob(f"*.{ext}"))


def data_rows() -> list:
    """潛勢溪流（縣市、鄉鎮、村里）與觀測站（站名、鏡頭名、地點）：每列一個 dict，值都是字串。"""
    import json
    rows = []
    sj = ROOT / "public" / "js" / "streams.json"
    if sj.exists():
        d = json.loads(sj.read_text(encoding="utf-8"))
        rows += [dict(zip(d["fields"], map(str, r))) for r in d["rows"]]
    for f in ("cams.json", "moa.json"):
        fp = ROOT / "scripts" / "fixtures" / f
        if fp.exists():
            rows += [{k: str(v) for k, v in r.items()} for r in json.loads(fp.read_text(encoding="utf-8"))]
    return rows


def keep(text: str) -> set:
    skip = "\r\n\t" + chr(0xFFFD)  # 0xFFFD 是 csv.ts 偵測來源壞字用的比對字元，不是要顯示的字
    return {c for c in text if ord(c) >= 0x20 and c not in skip and not EMOJI.match(c)}


def needed() -> set:
    rows = "".join("".join(r.values()) for r in data_rows())
    # 低年級注音：注音符號與聲調記號在 zhuyin.json 裡（不是 html／js，要另外收）
    zy = ROOT / "public" / "js" / "zhuyin.json"
    bopo = "".join(chr(c) for c in range(0x3105, 0x312A)) + "ˊˇˋ˙"
    return keep(ui_text() + rows
                + (zy.read_text(encoding="utf-8") if zy.exists() else "") + bopo)


def chunks() -> list:
    """回傳每包的字（字串清單），互不重疊、合起來＝needed()。"""
    need = needed()
    first = set(fonts.charset([ui_text()])) & need | (set(fonts.charset([""])))  # 介面＋基本符號
    rows = data_rows()
    names = keep("".join(r.get("county", "") + r.get("town", "") + r.get("vill", "") + r.get("StationName", "") + r.get("攝影機名稱", "") + r.get("架設或拍攝地點", "") for r in rows)) - first
    names &= need
    rest = need - first - names
    freq = {}
    for r in rows:
        for c in "".join(r.values()):
            if c in rest:
                freq[c] = freq.get(c, 0) + 1
    ordered = sorted(rest, key=lambda c: (-freq.get(c, 0), c))
    out = ["".join(sorted(first)), "".join(sorted(names))]
    rest_chunks = [ordered[i:i + CHUNK] for i in range(0, len(ordered), CHUNK)]
    if len(rest_chunks) > 1 and len(rest_chunks[-1]) < CHUNK // 4:  # 最後一包太小就併進前一包，少一個請求
        tail = rest_chunks.pop()  # 先 pop 再接：寫成 a[-2] += a.pop() 會在 pop 後寫回錯的位置
        rest_chunks[-1] += tail
    out += ["".join(sorted(c)) for c in rest_chunks]
    return [c for c in out if c]


def ranges(chars: str) -> str:
    """字元轉 unicode-range（連續的合併成 U+4E00-4E05）。"""
    cps = sorted({ord(c) for c in chars})
    parts, start = [], cps[0]
    for prev, cur in zip(cps, cps[1:] + [None]):
        if cur != prev + 1:
            parts.append(f"U+{start:X}" if start == prev else f"U+{start:X}-{prev:X}")
            start = cur
    return ",".join(parts)


def main() -> int:
    if "--check" in sys.argv:
        from fontTools.ttLib import TTFont

        cmap = set()
        for f in FONTS.glob("ls-sans-*.woff2"):
            cmap |= set(TTFont(f).getBestCmap())
        missing = sorted(c for c in needed() if ord(c) not in cmap)
        print(f"字型 {len(list(FONTS.glob('ls-sans-*.woff2')))} 包共 {len(cmap)} 字；網站與資料用到 {len(needed())} 字；缺 {len(missing)} 字")
        if missing:
            print("缺字：", "".join(missing))
        return 1 if missing else 0

    FONTS.mkdir(parents=True, exist_ok=True)
    for old in FONTS.glob("ls-sans*.woff2"):
        old.unlink()
    faces, total = [], 0
    for i, chars in enumerate(chunks()):
        blob = fonts.subset_woff2("sans", chars)
        name = f"ls-sans-{i}-{hashlib.sha1(blob).hexdigest()[:8]}.woff2"
        (FONTS / name).write_bytes(blob)
        total += len(blob)
        faces.append('@font-face{font-family:"LSSans";src:url("/fonts/%s") format("woff2");font-weight:400 800;font-display:swap;unicode-range:%s}' % (name, ranges(chars)))
        print(f"第 {i} 包：{len(chars)} 字，{len(blob) / 1024:.0f} KB → {name}")
    css = CSS.read_text(encoding="utf-8")
    a, b = css.index("/* FONTS:BEGIN"), css.index("/* FONTS:END */")
    CSS.write_text(css[:a] + "/* FONTS:BEGIN 由 scripts/build-font.py 產生，不要手改 */\n" + "\n".join(faces) + "\n" + css[b:], encoding="utf-8")
    # 每頁 <head> 預先載入第 0 包（介面文字）：不然要等 CSS 下載、解析完才開始抓字型，大標題會晚很久才畫好
    first = re.search(r'/fonts/(ls-sans-0-[0-9a-f]+\.woff2)', faces[0]).group(1)
    tag = f'<link rel="preload" as="font" type="font/woff2" href="/fonts/{first}" crossorigin>'
    for page in (ROOT / "public").glob("*.html"):
        html = page.read_text(encoding="utf-8")
        new, n = re.subn(r'<link rel="preload" as="font"[^>]*ls-sans-0-[^>]*>', tag, html)
        if not n:
            new = html.replace('<link rel="stylesheet" href="/css/style.css', tag + '\n<link rel="stylesheet" href="/css/style.css', 1)
        if new != html:
            page.write_text(new, encoding="utf-8")
    lic = fonts.cache_dir() / "OFL-LICENSE.txt"
    if lic.exists():
        shutil.copy(lic, FONTS / "LICENSE-OFL.txt")
    print(f"共 {len(faces)} 包 {total / 1024:.0f} KB；已更新 style.css。記得全站升 ?v=N（style.css 變了）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
