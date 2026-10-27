/* 臺灣地圖：用 canvas 畫海岸線（Natural Earth，公有領域，簡化過）加上 1692 條潛勢溪流與觀測站鏡頭。
   探索模式：篩縣市與風險、點一下看資料。找站點遊戲：給站名，點地圖，看離答案幾公里。
   這是給小朋友看的示意圖，簡化過的海岸線不能拿來量距離。網址 #c=縣市 直接篩選。 */
LS.boot(async ({ cams, streams }) => {
  const root = document.getElementById("root");
  const { esc, el } = LS;
  const tw = (await (await fetch("/js/taiwan.json")).json()).outline;
  const RISKS = ["高", "中", "低", "持續觀察"];
  const LON0 = 119.95, LON1 = 122.1, LAT0 = 21.8, LAT1 = 25.4, KX = Math.cos(23.6 * Math.PI / 180);
  const counties = [...new Set(streams.map((s) => s.county))].sort((a, b) => LS.countyRank(a) - LS.countyRank(b));
  let county = "", mode = "explore";
  const on = { 高: true, 中: true, 低: true, 持續觀察: true };

  root.appendChild(el(
    '<div><p class="lead zy">每個點是一條土石流潛勢溪流，黑色方塊是觀測站鏡頭。點一下看是哪裡。</p>' +
    '<div class="chips" id="modes"></div><div class="chips" id="cchips"></div><div class="chips" id="rchips"></div>' +
    '<div class="mapwrap"><canvas id="cv" role="img" aria-label="臺灣地圖，標出土石流潛勢溪流與觀測站"></canvas></div>' +
    '<div id="info" class="fact" role="status" aria-live="polite"></div><div id="game"></div></div>'));
  const cv = document.getElementById("cv"), ctx = cv.getContext("2d"), info = document.getElementById("info"), game = document.getElementById("game");
  let W = 0, H = 0, hit = null, marks = []; // marks：遊戲裡額外畫的標記

  function size() {
    const ratio = (LAT1 - LAT0) / ((LON1 - LON0) * KX);
    // 寬度不超過 560，高度不超過視窗高度的 72%（不然桌機要捲動才看得到整個臺灣）；最窄 280
    const w = Math.max(280, Math.min(root.clientWidth || 360, 560, Math.round((window.innerHeight * 0.72) / ratio))), h = Math.round(w * ratio);
    const r = window.devicePixelRatio || 1;
    cv.style.width = w + "px"; cv.style.height = h + "px";
    cv.width = Math.round(w * r); cv.height = Math.round(h * r);
    ctx.setTransform(r, 0, 0, r, 0, 0);
    W = w; H = h;
  }
  const px = (lon, lat) => [((lon - LON0) * KX / ((LON1 - LON0) * KX)) * W, (1 - (lat - LAT0) / (LAT1 - LAT0)) * H];
  const unpx = (x, y) => [LON0 + (x / W) * (LON1 - LON0), LAT0 + (1 - y / H) * (LAT1 - LAT0)];
  const km = (a, b, c, d) => { // 兩點的地面距離（公里）
    const R = 6371, t = Math.PI / 180, dl = (c - a) * t, dp = (d - b) * t;
    const h = Math.sin(dp / 2) ** 2 + Math.cos(b * t) * Math.cos(d * t) * Math.sin(dl / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    tw.forEach(([lo, la], i) => { const [x, y] = px(lo, la); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.closePath();
    ctx.fillStyle = "#eef3ec"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#8aa093"; ctx.stroke();
    if (mode === "explore") {
      streams.forEach((s) => {
        if (s.lon == null || !on[s.risk] || (county && s.county !== county)) return;
        const k = LS.riskOf(s.risk), [x, y] = px(s.lon, s.lat);
        ctx.fillStyle = k.color; ctx.globalAlpha = county ? 0.9 : 0.6;
        ctx.beginPath(); ctx.arc(x, y, s.risk === "高" ? 3.2 : 2.4, 0, 7); ctx.fill();
      });
      ctx.globalAlpha = 1;
    }
    cams.forEach((c) => {
      if (c.lon == null) return;
      if (mode === "explore" && county && c.county !== county) return;
      const [x, y] = px(c.lon, c.lat);
      ctx.fillStyle = "#23332b"; ctx.fillRect(x - 4, y - 4, 8, 8);
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.strokeRect(x - 4, y - 4, 8, 8);
    });
    marks.forEach((m) => {
      const [x, y] = px(m.lon, m.lat);
      ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fillStyle = m.color; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
    });
  }

  function drawChips() {
    const modes = document.getElementById("modes");
    modes.replaceChildren(...[["explore", "🔎 探索"], ["find", "🎯 找站點"]].map(([m, t]) => {
      const b = el('<button class="chip" aria-pressed="' + (mode === m) + '">' + t + "</button>");
      b.onclick = () => { mode = m; marks = []; info.textContent = ""; drawChips(); m === "find" ? startFind() : (game.replaceChildren(), draw()); };
      return b;
    }));
    const cc = document.getElementById("cchips"), rc = document.getElementById("rchips");
    cc.style.display = rc.style.display = mode === "explore" ? "" : "none"; // .chips 是 flex，hidden 屬性會被蓋掉，所以直接設 display
    cc.replaceChildren(...[["", "全臺"]].concat(counties.map((c) => [c, c])).map(([v, t]) => {
      const b = el('<button class="chip" aria-pressed="' + (county === v) + '">' + esc(t) + "</button>");
      b.onclick = () => { county = v; drawChips(); draw(); };
      return b;
    }));
    rc.replaceChildren(...RISKS.map((r) => {
      const k = LS.riskOf(r), b = el('<button class="chip" aria-pressed="' + on[r] + '"><span style="color:' + k.color + '">' + k.mark + "</span> " + esc(r) + "</button>");
      b.onclick = () => { on[r] = !on[r]; drawChips(); draw(); };
      return b;
    }));
  }

  // 點地圖：探索模式找最近的鏡頭或溪流（14 像素內）；遊戲模式交給 onPick
  let onPick = null;
  cv.addEventListener("click", (e) => {
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * (W / r.width), y = (e.clientY - r.top) * (H / r.height);
    if (onPick) return onPick(x, y);
    let best = null, bd = 14;
    cams.forEach((c) => { if (c.lon == null || (county && c.county !== county)) return; const [cx, cy] = px(c.lon, c.lat), d = Math.hypot(cx - x, cy - y); if (d < bd) { bd = d; best = { cam: c }; } });
    if (!best) streams.forEach((s) => { if (s.lon == null || !on[s.risk] || (county && s.county !== county)) return; const [sx, sy] = px(s.lon, s.lat), d = Math.hypot(sx - x, sy - y); if (d < bd) { bd = d; best = { s }; } });
    if (!best) { info.innerHTML = "這裡附近沒有點，換個地方點點看。"; return; }
    if (best.cam) {
      const c = best.cam;
      info.innerHTML = "📹 <b>" + esc(c.station + "・" + c.name) + "</b>　" + esc((c.county || "") + (c.district || "")) + (c.live ? '　<a href="/watch#cam=' + esc(c.id) + '">看現在的畫面 ➜</a>' : "（沒有即時畫面）");
    } else {
      const s = best.s, k = LS.riskOf(s.risk);
      info.innerHTML = "<b>" + esc(s.county + s.town + s.vill) + "</b>　風險：<b style=\"color:" + k.color + '">' + k.mark + " " + esc(s.risk) + "</b>　" + (s.res ? "影響 " + s.res + " 戶" : "影響範圍內沒有住戶") + "<br><small>" + esc(LS.K.riskText[s.risk]) + "</small>";
    }
  });

  // ---- 找站點遊戲 ----
  function startFind() {
    const stations = {};
    cams.forEach((c) => { if (c.lon != null && !stations[c.station]) stations[c.station] = c; });
    const pool = LS.pick(Object.values(stations), 5);
    let i = 0, right = 0;
    marks = []; draw();
    const ask = () => {
      const c = pool[i];
      marks = [];
      draw();
      game.innerHTML = '<p class="lead zy">第 ' + (i + 1) + " / " + pool.length + " 題：<b>" + esc(c.station) + "</b>觀測站在哪裡？請在地圖上點一下。</p>";
      onPick = (x, y) => {
        onPick = null;
        const [lo, la] = unpx(x, y), d = km(lo, la, c.lon, c.lat), ok = d <= 20;
        if (ok) { right++; Fx.right(); } else Fx.wrong();
        marks = [{ lon: lo, lat: la, color: ok ? "#2f8f5b" : "#c8341f" }, { lon: c.lon, lat: c.lat, color: "#3a8fd9" }];
        draw();
        const last = i === pool.length - 1;
        game.innerHTML = '<p class="feedback ' + (ok ? "ok" : "no") + '">' + (ok ? "答對了！🎉" : "差一點點。") + "離答案約 " + Math.round(d) + " 公里。" + esc(c.station) + "在" + esc((c.county || "") + (c.district || "")) +
          "（藍點是答案）。</p>" + '<p><button class="btn primary big" id="nx">' + (last ? "看成績 🏆" : "下一題 ➜") + "</button></p>";
        game.querySelector("#nx").onclick = () => { i++; last ? end() : ask(); };
      };
    };
    const end = () => {
      const stars = right >= 5 ? 3 : right >= 3 ? 2 : right > 0 ? 1 : 0;
      Progress.stars("map-find", stars);
      if (stars === 3) Fx.confetti();
      marks = []; draw();
      game.innerHTML = '<div class="stage"><h2>找站點完成！</h2><div class="stars">' + "⭐".repeat(stars) + "☆".repeat(3 - stars) + "</div><p>答對 " + right + " / " + pool.length + " 題（距離 20 公里內算對）。</p>" +
        '<p><button class="btn primary big" id="again">再玩一次</button></p></div>';
      game.querySelector("#again").onclick = startFind;
    };
    ask();
  }

  size();
  const h = LS.hashParams();
  if (counties.includes(h.c)) county = h.c;
  drawChips();
  draw();
  let rt = null;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { size(); draw(); }, 150); });
});
