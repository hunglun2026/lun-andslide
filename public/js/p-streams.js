/* 我的鄉鎮：選縣市、鄉鎮，看那裡有幾條土石流潛勢溪流、風險怎麼分、旁邊有哪些觀測站鏡頭。
   資料是水保署 113 年度潛勢溪流（一條溪流可能有好幾個溢流點，已合併成一條）。網址 #c=縣市&t=鄉鎮 直達。 */
LS.boot(({ cams, streams }) => {
  const root = document.getElementById("root");
  const { esc, el } = LS;
  const RISKS = ["高", "中", "低", "持續觀察"];
  let county = "", town = "";

  const counties = [...new Set(streams.map((s) => s.county))].sort((a, b) => LS.countyRank(a) - LS.countyRank(b));
  const count = (list) => { const o = { 高: 0, 中: 0, 低: 0, 持續觀察: 0 }; list.forEach((s) => { o[s.risk] = (o[s.risk] || 0) + 1; }); return o; };

  // 風險長條：文字數字一定寫出來，不只靠顏色
  function riskBars(list) {
    const c = count(list), max = Math.max(1, ...RISKS.map((r) => c[r]));
    return '<div class="rbars">' + RISKS.map((r) => {
      const k = LS.riskOf(r);
      return '<div class="rbar"><span class="rl">' + k.mark + " " + esc(r) + '</span><span class="rt"><i style="width:' + (c[r] / max) * 100 + "%;background:" + k.color + '"></i></span><b>' + c[r] + "</b></div>";
    }).join("") + "</div>";
  }
  const legend = '<details class="fbox"><summary>風險等級是什麼意思？</summary><ul>' + RISKS.map((r) => "<li><b>" + LS.riskOf(r).mark + " " + esc(r) + "</b>：" + esc(LS.K.riskText[r]) + "</li>").join("") +
    '</ul><small>出處：<a href="' + LS.K.SRC.delimit.url + '" target="_blank" rel="noopener">' + LS.K.SRC.delimit.name + "</a>。潛勢溪流是「有可能發生」的地方，不是「現在就會發生」。</small></details>";

  function render() {
    root.replaceChildren();
    root.appendChild(el('<p class="lead zy">選你的縣市，看看家鄉附近有幾條土石流潛勢溪流。</p>'));
    const chips = el('<div class="chips"></div>');
    counties.forEach((c) => {
      const b = el('<button class="chip" aria-pressed="' + (c === county) + '">' + esc(c) + "</button>");
      b.onclick = () => { county = c; town = ""; sync(); render(); };
      chips.appendChild(b);
    });
    root.appendChild(chips);
    if (!county) { root.appendChild(el("<p>請先選一個縣市。</p>")); root.appendChild(el("<div>" + legend + "</div>")); return; }

    const inC = streams.filter((s) => s.county === county);
    const sec = el('<section><h2>' + esc(county) + "：" + inC.length + " 條</h2>" + riskBars(inC) + "</section>");
    const towns = [...new Set(inC.map((s) => s.town))].sort((a, b) => inC.filter((s) => s.town === b).length - inC.filter((s) => s.town === a).length);
    const tchips = el('<div class="chips"><span class="lab">鄉鎮：</span></div>');
    towns.forEach((t) => {
      const n = inC.filter((s) => s.town === t).length;
      const b = el('<button class="chip" aria-pressed="' + (t === town) + '">' + esc(t) + "（" + n + "）</button>");
      b.onclick = () => { town = t; Progress.seenTown(county + t); sync(); render(); };
      tchips.appendChild(b);
    });
    sec.appendChild(tchips);
    root.appendChild(sec);

    if (town) {
      const inT = inC.filter((s) => s.town === town).sort((a, b) => LS.riskOf(b.risk).rank - LS.riskOf(a.risk).rank || a.vill.localeCompare(b.vill, "zh-Hant"));
      const box = el("<section><h2>" + esc(county + town) + "：" + inT.length + " 條</h2>" + riskBars(inT) + "</section>");
      const tbl = el('<table class="gtable"><thead><tr><th>村里</th><th>風險</th><th>影響住戶</th></tr></thead><tbody></tbody></table>');
      inT.forEach((s) => {
        const k = LS.riskOf(s.risk);
        tbl.querySelector("tbody").appendChild(el("<tr><td>" + esc(s.vill) + '</td><td><span class="rk" style="color:' + k.color + '">' + k.mark + " " + esc(s.risk) + "</span></td><td>" + (s.res ? s.res + " 戶" : "無") + "</td></tr>"));
      });
      box.appendChild(tbl);
      root.appendChild(box);
    }

    // 這個縣市裡的觀測站鏡頭（有座標與縣市對得上才列）
    const near = cams.filter((c) => c.county === county && c.live);
    if (near.length) {
      const sc = el("<section><h2>" + esc(county) + "的觀測站鏡頭（" + near.length + " 支）</h2><div class=\"chips\"></div></section>");
      near.forEach((c) => sc.querySelector(".chips").appendChild(el('<a class="chip" href="/watch#cam=' + esc(c.id) + '">📹 ' + esc(c.station + c.name) + "</a>")));
      root.appendChild(sc);
    }
    root.appendChild(el("<div>" + legend + "</div>"));
  }

  const sync = () => history.replaceState(null, "", county ? "#c=" + encodeURIComponent(county) + (town ? "&t=" + encodeURIComponent(town) : "") : location.pathname);
  const h = LS.hashParams();
  if (counties.includes(h.c)) { county = h.c; if (h.t && streams.some((s) => s.county === h.c && s.town === h.t)) { town = h.t; Progress.seenTown(county + town); } }
  render();
});
