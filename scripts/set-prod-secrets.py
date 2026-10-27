"""設定正式 Worker 的執行期密鑰（ADMIN_TOKEN、NTFY_TOPIC），然後強制同步一次資料。

用法：python -X utf8 school/lun-andslide/scripts/set-prod-secrets.py
憑證來源：steve0802/cf-tokens.txt、cf-account-ids.txt（hunglun2026）與專案的 .prod.secrets。
全部在程序內讀取，不印出任何金鑰，只印每一步的成功與否與同步結果。
為什麼獨立成腳本：Worker 密鑰不能走 GitHub Actions（CI 只管程式碼），第一次部署後要用 Cloudflare API 設一次；
之後換密鑰或換電腦重跑同一支就好。
"""
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]  # ClaudeOnly（scripts → lun-andslide → school → ClaudeOnly）
PROJ = Path(__file__).resolve().parents[1]
SERVICE = "landslide-detective"
SITE = "https://landslide.hunglun.com"


def kv(path: Path, key: str) -> str:
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip()
    raise SystemExit(f"{path.name} 找不到 {key}")


def call(url, method, headers, body=None):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, method=method, headers=headers)
    return json.load(urllib.request.urlopen(req, timeout=90))


def main():
    tok = kv(ROOT / "steve0802" / "cf-tokens.txt", "hunglun2026")
    acc = kv(ROOT / "steve0802" / "cf-account-ids.txt", "hunglun2026")
    sec = json.loads((PROJ / ".prod.secrets").read_text(encoding="utf-8"))
    h = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
    for name in ("ADMIN_TOKEN", "NTFY_TOPIC"):
        r = call(f"https://api.cloudflare.com/client/v4/accounts/{acc}/workers/scripts/{SERVICE}/secrets", "PUT", h,
                 {"name": name, "text": sec[name], "type": "secret_text"})
        print(f"設定 {name}：{'成功' if r.get('success') else '失敗 ' + str(r.get('errors'))}")
    # 強制同步一次：把觀測站清單匯入遠端 D1（之後每天台灣 03:00 自動檢查）
    r = call(f"{SITE}/admin/sync?force=1", "POST", {"Authorization": f"Bearer {sec['ADMIN_TOKEN']}", "User-Agent": "Mozilla/5.0 set-prod-secrets"})
    print("首次同步：", json.dumps(r, ensure_ascii=False))


if __name__ == "__main__":
    main()
