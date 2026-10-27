#!/usr/bin/env bash
# 把 school/lun-andslide 的「公開部分」同步到 GitHub hunglun2026/lun-andslide（白名單複製、掃機密、推 main）。
# 為什麼不用 subtree：專案裡有 進度.md、學習筆記.md、.dev.vars 等內部檔，不能公開。
# 用法：bash scripts/publish-public.sh "commit 訊息"
# 前置：GitHub 上要先有 hunglun2026/lun-andslide 這個 repo（發布前先跟 Steve 確認帳號與 repo，這支腳本不會自己建）。
# 憑證：只讀 steve0802 的 PAT，放程序內變數，不切換全機 gh 登入。
# workflow：hunglun2026 的 PAT 已補 Workflows 權限（2026-10-21），.github/ 也一起複製。
set -euo pipefail
MSG="${1:-更新}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="${CLAUDEONLY_ROOT:-$(cd "$SRC/../.." && pwd)}"   # ClaudeOnly 根目錄（school/lun-andslide 往上兩層）
STG="$(mktemp -d)"
trap 'rm -rf "$STG"' EXIT
PAT="$(grep '^hunglun2026=' "$ROOT/steve0802/gh-tokens.txt" | cut -d= -f2- | tr -d '\r\n ')"
B64="$(printf 'x-access-token:%s' "$PAT" | base64 -w0)"
GIT_AUTH=(-c "http.https://github.com/.extraheader=AUTHORIZATION: basic $B64")

# 取遠端現況（保留歷史），再用白名單覆蓋
git "${GIT_AUTH[@]}" clone -q https://github.com/hunglun2026/lun-andslide.git "$STG/repo"
cd "$STG/repo"
git ls-files | xargs -r rm -f
cd "$SRC"
cp -r src public migrations .github package.json package-lock.json wrangler.jsonc README.md .gitignore "$STG/repo/"
mkdir -p "$STG/repo/scripts"; cp -r scripts/*.ts scripts/*.py scripts/*.sh scripts/fixtures "$STG/repo/scripts/"

# 掃機密：本機與正式密鑰、Cloudflare／GitHub token 內容
python -X utf8 - "$STG/repo" "$ROOT" "$SRC" <<'PYEOF'
import json,os,re,sys
root,top,src=sys.argv[1:4]
vals=[]
for f in ('.dev.vars','.prod.secrets'):
    p=os.path.join(src,f)
    if not os.path.exists(p): continue
    t=open(p,encoding='utf-8').read()
    try:
        vals+=[str(v) for k,v in json.loads(t).items() if k!='D1_ID']  # D1 資料庫 id 本來就寫在公開的 wrangler.jsonc，不是密鑰
    except Exception:
        vals+=[l.split('=',1)[1].strip() for l in t.splitlines() if '=' in l]
for f in ('cf-tokens.txt','gh-tokens.txt'):
    for l in open(os.path.join(top,'steve0802',f),encoding='utf-8'):
        if '=' in l and not l.startswith('#'): vals.append(l.split('=',1)[1].strip())
vals=[v for v in vals if len(v)>=12]
hit=0
for d,_,fs in os.walk(root):
    if '.git' in d.split(os.sep): continue
    for fn in fs:
        p=os.path.join(d,fn); t=open(p,encoding='utf-8',errors='ignore').read()
        if any(v in t for v in vals) or re.search('(' + 'gh' + 'p_|github' + '_pat_)',t): print('機密命中',p); hit+=1
print('機密掃描：命中',hit); sys.exit(1 if hit else 0)
PYEOF

cd "$STG/repo"
git config user.name hunglun2026; git config user.email hunglun2026@gmail.com
git add -A
if git diff --cached --quiet; then echo "沒有變更，不推送"; exit 0; fi
git commit -q -m "$MSG"
git "${GIT_AUTH[@]}" push -q origin main
echo "已推送：$(git rev-parse --short HEAD) $MSG"
