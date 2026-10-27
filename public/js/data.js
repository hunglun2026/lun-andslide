/* 土石流小偵探：共用資料層。所有頁面都先載入這支，再各自畫畫面。
   負責：抓鏡頭與溪流資料並快取、風險與縣市小工具、鏡頭畫面載入、對話框、年級、網址參數。
   全域名稱 LS（Landslide）。 */
(function () {
  "use strict";

  // ---- 風險等級（水保署潛勢溪流的「風險」欄）----
  // 用顏色以外還有文字與符號，色盲也分得出來
  const RISK = {
    高: { id: "high", name: "高", mark: "▲", color: "#c8341f", rank: 3, hint: "發生的可能性高，而且影響範圍內的住戶多" },
    中: { id: "mid", name: "中", mark: "◆", color: "#e0742a", rank: 2, hint: "發生的可能性和影響住戶數都在中間" },
    低: { id: "low", name: "低", mark: "●", color: "#d9a520", rank: 1, hint: "發生的可能性和影響住戶數都比較低" },
    持續觀察: { id: "watch", name: "持續觀察", mark: "○", color: "#566a5e", rank: 0, hint: "影響範圍內沒有保全住戶，水保署持續觀察" },
  };
  const riskOf = (s) => RISK[s] || RISK["持續觀察"];

  // 縣市由北到南排，讓下拉選單與統計圖不是照筆畫
  const COUNTY_ORDER = ["基隆市", "臺北市", "新北市", "桃園市", "新竹縣", "苗栗縣", "臺中市", "彰化縣", "南投縣", "雲林縣", "嘉義縣", "臺南市", "高雄市", "屏東縣", "宜蘭縣", "花蓮縣", "臺東縣"];
  const countyRank = (c) => { const i = COUNTY_ORDER.indexOf(c); return i < 0 ? 99 : i; };

  // ---- 載入與快取 ----
  const KEY = "ls-cache-v1";
  const FORMAT = 1; // 快取資料的格式代號：API 欄位改了就加 1，舊快取就不會被新程式拿來用
  function readCache() {
    try {
      const c = JSON.parse(localStorage.getItem(KEY) || "null");
      if (c && c.format === FORMAT && c.cams && c.meta) return c;
    } catch (e) { /* 無痕模式或壞資料 */ }
    return null;
  }
  function saveCache(meta, cams) {
    try { localStorage.setItem(KEY, JSON.stringify({ format: FORMAT, meta, cams })); } catch (e) { /* 存不了不影響使用 */ }
  }
  const getJson = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u + " HTTP " + r.status); return r.json(); });

  // 溪流資料是靜態檔（一年才更新一次），轉成物件陣列。檔案網址不帶版號，快取最晚隔天生效
  async function loadStreams() {
    const d = await getJson("/js/streams.json");
    return d.rows.map((r) => { const o = {}; d.fields.forEach((f, i) => { o[f] = r[i]; }); o.id = o.no; return o; });
  }

  // 回 { cams, streams, meta }。有本機快取先用快取（畫面馬上出來），背景檢查有沒有新資料
  async function load() {
    const streamsP = loadStreams();
    const cached = readCache();
    const metaP = getJson("/api/meta");
    let meta, cams;
    if (cached) {
      cams = cached.cams;
      meta = cached.meta;
      metaP.then(async (m) => {
        if (m.syncedAt !== cached.meta.syncedAt) saveCache(m, (await getJson("/api/cams?m=" + encodeURIComponent(m.syncedAt || ""))).cams);
      }).catch(() => { /* 離線就用快取 */ });
    } else {
      meta = await metaP;
      cams = (await getJson("/api/cams?m=" + encodeURIComponent(meta.syncedAt || ""))).cams;
      saveCache(meta, cams);
    }
    return { cams, streams: await streamsP, meta };
  }

  // ---- 鏡頭畫面 ----
  // camImage(cam, onState)：回傳一個容器，載入即時畫面。onState(狀態) 狀態有：
  //   loading／ok／dark（太暗，多半是晚上）／none（現在看不到）
  // 為什麼在前端算亮度：影像是我們自己網域代抓的，canvas 不會被跨網域擋；不必在 Worker 解碼圖片
  function camImage(cam, onState) {
    const box = document.createElement("div");
    box.className = "camimg";
    const say = (state, text) => {
      box.dataset.state = state;
      let msg = box.querySelector(".cammsg");
      if (!msg) { msg = document.createElement("div"); msg.className = "cammsg"; box.appendChild(msg); }
      msg.textContent = text || "";
      if (onState) onState(state);
    };
    if (!cam.live) { say("none", "這支鏡頭沒有提供即時畫面"); return box; }
    // 水保署的伺服器有時要等十幾秒甚至超時，所以失敗時給「再試一次」，不讓學生只能重新整理整頁
    const fail = () => {
      say("none", "現在看不到這支鏡頭（水保署的伺服器有時很慢）");
      const b = document.createElement("button");
      b.className = "btn";
      b.textContent = "再試一次";
      b.onclick = () => { box.replaceChildren(); go(); };
      box.appendChild(b);
    };
    const go = () => {
      say("loading", "畫面載入中⋯可能要等幾秒，最多約半分鐘");
      fetch("/api/cam/" + encodeURIComponent(cam.id))
        .then(async (r) => {
          if (r.status !== 200) throw new Error("no image");
          const blob = await r.blob();
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.alt = cam.station + cam.name + "現在的畫面";
          img.onload = () => {
            let dark = false;
            try {
              const c = document.createElement("canvas");
              c.width = 32; c.height = 18; // 縮小再算，快又穩
              const g = c.getContext("2d");
              g.drawImage(img, 0, 0, 32, 18);
              const d = g.getImageData(0, 0, 32, 14).data; // 底部 4 列有時間文字，不算
              let sum = 0;
              for (let i = 0; i < d.length; i += 4) sum += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
              dark = sum / (d.length / 4) < 28;
            } catch (e) { /* 算不出來就當作正常 */ }
            box.prepend(img);
            say(dark ? "dark" : "ok", dark ? "畫面很暗，可能是晚上或鏡頭被遮住" : "");
          };
          img.onerror = fail;
          img.src = url;
        })
        .catch(fail);
    };
    go();
    return box;
  }

  // ---- 小工具 ----
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const pick = (arr, n) => shuffle(arr).slice(0, n);
  // el(html)：HTML 字串轉成「單一」元素。多個頂層元素要自己包一層 <div>，否則後面的會被丟掉
  const el = (html) => {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    if (t.content.children.length > 1) console.warn("LS.el：HTML 有多個頂層元素，只會用第一個", html.slice(0, 60));
    return t.content.firstElementChild;
  };

  // 自製確認對話框（不用瀏覽器內建的 alert／confirm）
  function dialog(message, buttons) {
    return new Promise((resolve) => {
      const d = document.createElement("dialog");
      d.className = "zdlg";
      d.innerHTML = "<p>" + esc(message) + '</p><div class="row"></div>';
      (buttons || [{ label: "好", value: true, primary: true }]).forEach((b) => {
        const btn = document.createElement("button");
        btn.className = "btn" + (b.primary ? " primary" : "") + (b.danger ? " danger" : "");
        btn.textContent = b.label;
        btn.onclick = () => { d.close(); d.remove(); resolve(b.value); };
        d.lastChild.appendChild(btn);
      });
      document.body.appendChild(d);
      d.showModal();
    });
  }

  // 年級（low／mid／high）：只影響呈現（注音、朗讀語速），不擋內容。切換時發 ls-grade 事件，頁面不用重整
  const GRADES = { low: "低年級", mid: "中年級", high: "高年級" };
  function grade() {
    try {
      const g = localStorage.getItem("ls-grade");
      if (GRADES[g]) return g;
    } catch (e) { /* 無痕模式 */ }
    return "mid";
  }
  function setGrade(g) {
    if (!GRADES[g]) return;
    try { localStorage.setItem("ls-grade", g); } catch (e) { /* 忽略 */ }
    document.documentElement.dataset.grade = g;
    document.dispatchEvent(new CustomEvent("ls-grade", { detail: g }));
  }
  if (typeof document !== "undefined" && document.documentElement) document.documentElement.dataset.grade = grade();

  // 網址 # 後面的 c=南投縣&t=埔里鎮（直達某縣市鄉鎮、老師的班級連結用）。不是 a=b 格式的回空物件
  function hashParams() {
    const h = location.hash.slice(1);
    const out = {};
    if (h.includes("=")) new URLSearchParams(h).forEach((v, k) => { out[k] = v; });
    return out;
  }

  // 老師的班級連結 #m=easy&grade=low：年級只收 low／mid／high，套用後把 grade 從網址拿掉（其餘參數留給各頁用）
  (function applyClassLink() {
    if (typeof location === "undefined") return;
    const h = hashParams();
    if (!("grade" in h)) return;
    if (GRADES[h.grade]) setGrade(h.grade);
    const p = new URLSearchParams(location.hash.slice(1));
    p.delete("grade");
    history.replaceState(null, "", location.pathname + location.search + (p.toString() ? "#" + p : ""));
  })();

  window.LS = { RISK, riskOf, COUNTY_ORDER, countyRank, GRADES, load, camImage, esc, shuffle, pick, el, dialog, grade, setGrade, hashParams };
})();
