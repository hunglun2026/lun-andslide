"""掃簡體字：網站程式與頁面、後端、潛勢溪流資料（資料也會顯示給學生看）。有問題離場碼 1。
判斷方式：用 zhconv 逐字轉成繁體，跟原字不同就是簡體字（不手寫字表，避免誤列兩岸共用字）。
「一簡對多繁」但繁體本來合法的字放白名單。需要：pip install zhconv"""
import sys
from pathlib import Path

from zhconv import convert

ROOT = Path(__file__).resolve().parent.parent
ALWAYS_OK = set("准划占栗虱郁台里后干范")  # 核准、划算、占用、苗栗、虱目魚、濃郁、台、里、后、干、范


def in_big5(ch: str) -> bool:
    try:
        ch.encode("cp950")
        return True
    except UnicodeEncodeError:
        return False


def bad_chars(text: str) -> dict:
    """zhconv 說不同、而且不在台灣用的 Big5 字集裡，才算簡體字。
    只靠 zhconv 會把岩、游、泄、祕、污、凶、苧…這些繁體本來就合法的一簡對多繁字誤報。"""
    out = {}
    for ch in set(text):
        if ord(ch) > 0x2E80 and ch not in ALWAYS_OK and convert(ch, "zh-tw") != ch and not in_big5(ch):
            out[ch] = convert(ch, "zh-tw")
    return out


def main() -> int:
    bad = 0
    # 網站程式與頁面、後端、離線資料（streams.json 會顯示給學生看；zhuyin.json 是注音對照不掃）
    files = [p for p in (ROOT / "public").rglob("*") if p.name != "zhuyin.json"] + list((ROOT / "src").glob("*.ts")) + [ROOT / "public" / "js" / "streams.json"]
    for p in files:
        if p.suffix in (".html", ".js", ".css", ".ts", ".json"):
            b = bad_chars(p.read_text(encoding="utf-8"))
            if b:
                bad += 1
                print(f"[簡體] {p.relative_to(ROOT)}: {b}")
    print("沒有發現簡體字" if not bad else f"共 {bad} 處需要看")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
