"""產生低年級用的注音資料 public/js/zhuyin.json（前端 zhuyin.js 讀）。

做法：繁體直接查 pypinyin 會失去詞庫（長頸鹿念成 ㄓㄤˇ），所以先轉簡體（zhconv，一字對一字）再斷詞查讀音，
      讀音跟單字預設不同的詞才收進詞表 w，其餘字放單字表 c；最後套台灣讀音校正（TW_CHAR、TW_WORD）。
文字來源：網站畫面文字（public 底下的 html／js，含 knowledge.js 的題庫）。
另外輸出縣市名字的注音對照 xlsx，給人抽查。

用法：python scripts/build-zhuyin.py [--xlsx 輸出路徑]
畫面或題庫加了新字之後重跑；重跑後 zhuyin.js 裡的 ?v 要跟著升。"""
import argparse
import json
import re
from pathlib import Path

import zhconv
from pypinyin import Style, lazy_pinyin
from pypinyin.seg.mmseg import seg

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "js" / "zhuyin.json"
HAN = "[" + chr(0x3400) + "-" + chr(0x9FFF) + "]"  # 中文字範圍
CJK = re.compile(HAN)

# 台灣（教育部）讀音跟對岸不同的字：只在讀音等於對岸預設時才換，詞裡的特殊讀音不動
TW_CHAR = {
    "危": "ㄨㄟˊ", "微": "ㄨㄟˊ", "企": "ㄑㄧˋ", "研": "ㄧㄢˊ", "液": "ㄧˋ", "綜": "ㄗㄨㄥˋ", "蝸": "ㄍㄨㄚ",
    "帆": "ㄈㄢˊ", "偽": "ㄨㄟˋ", "穴": "ㄒㄩㄝˊ", "迄": "ㄑㄧˋ", "卓": "ㄓㄨㄛˊ", "夕": "ㄒㄧˋ", "昔": "ㄒㄧˊ",
    "擁": "ㄩㄥˇ", "骼": "ㄍㄜˊ", "期": "ㄑㄧˊ", "垃": "ㄌㄜˋ", "圾": "ㄙㄜˋ", "息": "ㄒㄧ", "惜": "ㄒㄧ",
}
# 整詞指定（詞庫查不到或查錯的動物用語）
TW_WORD = {
    "長頸鹿": "ㄔㄤˊ ㄐㄧㄥˇ ㄌㄨˋ", "行為": "ㄒㄧㄥˊ ㄨㄟˊ", "兩棲": "ㄌㄧㄤˇ ㄑㄧ", "棲地": "ㄑㄧ ㄉㄧˋ", "棲息": "ㄑㄧ ㄒㄧ",
    "角鴞": "ㄐㄧㄠˇ ㄒㄧㄠ", "長得": "ㄓㄤˇ ˙ㄉㄜ", "身長": "ㄕㄣ ㄔㄤˊ", "體長": "ㄊㄧˇ ㄔㄤˊ", "尾長": "ㄨㄟˇ ㄔㄤˊ",
    "什麼": "ㄕㄜˊ ˙ㄇㄜ", "喜歡": "ㄒㄧˇ ㄏㄨㄢ",
}


def zy(s: str) -> list:
    """簡體字串 → 注音清單；輕聲符號照台灣習慣放前面（ㄉㄜ˙ → ˙ㄉㄜ）。"""
    out = [("˙" + p[:-1]) if p.endswith("˙") else p for p in lazy_pinyin(s, style=Style.BOPOMOFO, errors=lambda x: [""] * len(x))]
    # 「一」「不」照台灣課本標本調，不標變調（一般 ㄧ ㄅㄢ，不是 ㄧˋ ㄅㄢ）
    return [{"一": "ㄧ", "不": "ㄅㄨˋ"}.get(c, p) for c, p in zip(s, out)] if len(out) == len(s) else out


def tw(ch: str, reading: str, default_cn: str) -> str:
    return TW_CHAR[ch] if ch in TW_CHAR and reading == default_cn else reading


def texts() -> tuple:
    out = []
    for ext in ("html", "js"):
        for p in (ROOT / "public").rglob(f"*.{ext}"):
            out.append(p.read_text(encoding="utf-8"))
    # 要給人抽查讀音的名字：17 個有潛勢溪流的縣市（學生在題目與選項裡會看到）
    sj = json.loads((ROOT / "public" / "js" / "streams.json").read_text(encoding="utf-8"))
    names = sorted({r[1] for r in sj["rows"]})
    return out, [{"name_ch": n} for n in names]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--xlsx", default="")
    args = ap.parse_args()
    all_text, animals = texts()

    chars, words = {}, {}
    for t in all_text:
        for run in re.findall(HAN + "+", t):
            cn = zhconv.convert(run, "zh-cn")
            if len(cn) != len(run):  # 極少數轉換長度不一樣，就只收單字
                cn = "".join(zhconv.convert(c, "zh-cn")[:1] or c for c in run)
            for c, s in zip(run, cn):
                chars.setdefault(c, s)
            pos = 0
            for w in seg.cut(cn):
                tw_w = run[pos:pos + len(w)]
                pos += len(w)
                if len(w) < 2 or tw_w in words:
                    continue
                rd = zy(w)
                if rd != [zy(c)[0] for c in w]:
                    words[tw_w] = [tw(c, r, zy(s)[0]) for c, r, s in zip(tw_w, rd, w)]

    c_map = {}
    for c, s in chars.items():
        d = zy(s)[0]
        if d:
            c_map[c] = tw(c, d, d)
    for w, r in TW_WORD.items():
        words[w] = r.split()
    # 縣市名字整詞收進來（前端最長比對優先，名字裡的多音字才會照詞讀）
    names = []
    for a in animals:
        name = a["name_ch"].replace("?", "").replace("？", "")
        cn = zhconv.convert(name, "zh-cn")
        if len(cn) == len(name):
            rd = [tw(c, r, zy(s)[0]) for c, r, s in zip(name, zy(cn), cn)]
            for w, r in TW_WORD.items():  # 名字裡含指定詞（例：長頸鹿）就用指定讀音
                for m in re.finditer(w, name):
                    rd[m.start():m.end()] = r.split()
            if rd != [c_map.get(c, "") for c in name]:
                words[name] = rd
            names.append((name, " ".join(rd)))

    OUT.write_text(json.dumps({"w": words, "c": c_map}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"注音資料：單字 {len(c_map)} 個、整詞 {len(words)} 個，{OUT.stat().st_size // 1024} KB → {OUT}")

    if args.xlsx:
        from openpyxl import Workbook
        from openpyxl.styles import Font
        wb = Workbook()
        ws = wb.active
        ws.title = "縣市名字注音"
        ws.append(["縣市名字", "注音", "抽查結果（對打勾、錯寫正確讀音）"])
        for n, r in sorted(names):
            ws.append([n, r, ""])
        for c in ws[1]:
            c.font = Font(bold=True)
        ws.column_dimensions["A"].width = 22
        ws.column_dimensions["B"].width = 40
        ws.column_dimensions["C"].width = 34
        ws.freeze_panes = "A2"
        Path(args.xlsx).parent.mkdir(parents=True, exist_ok=True)
        wb.save(args.xlsx)
        print(f"名字對照表：{args.xlsx}")


if __name__ == "__main__":
    main()
