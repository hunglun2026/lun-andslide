/* 教師專區：學習單（可列印）、全螢幕上課模式、搶答計分板、班級連結、課程包。
   題目來源：knowledge.js 的官方知識題；「我的縣市」題目由潛勢溪流資料現算，答案不是寫死的。
   網址 #board、#link 等可直接開分頁。 */
LS.boot(({ streams }) => {
  const { esc, el } = LS;
  const counties = [...new Set(streams.map((s) => s.county))].sort((a, b) => LS.countyRank(a) - LS.countyRank(b));
  const themeSel = document.getElementById("theme");
  themeSel.innerHTML = '<option value="knowledge">土石流防災知識</option>' + counties.map((c) => '<option value="county:' + esc(c) + '">我的縣市：' + esc(c) + "</option>").join("");

  // ---- 題目 ----
  const near = (n) => { // 數字題的選項：正確答案加三個附近的數
    const set = new Set([n]);
    for (const d of LS.shuffle([-20, -10, -5, -3, -2, 2, 3, 5, 10, 20])) { if (set.size >= 4) break; if (n + d >= 0) set.add(n + d); }
    return LS.shuffle([...set]).map(String);
  };
  function countyQuestions(c) {
    const inC = streams.filter((s) => s.county === c);
    const high = inC.filter((s) => s.risk === "高").length;
    const by = {};
    inC.forEach((s) => { by[s.town] = (by[s.town] || 0) + 1; });
    const towns = Object.keys(by).sort((a, b) => by[b] - by[a]);
    const qs = [
      { q: c + "有幾條土石流潛勢溪流？（113 年度資料）", choices: near(inC.length), answer: String(inC.length), fill: true },
      { q: c + "有幾條潛勢溪流的風險等級是「高」？", choices: near(high), answer: String(high), fill: true },
      { q: c + "哪個鄉鎮的潛勢溪流最多？", choices: LS.shuffle(towns.slice(0, 4)), answer: towns[0], explain: towns[0] + "有 " + by[towns[0]] + " 條。", fill: true },
      { q: "風險等級寫「持續觀察」，是什麼意思？", choices: LS.shuffle([LS.K.riskText["持續觀察"], "已經確定今天會發生土石流", "這條溪流已經消失了", "風險比「高」還要大"]), answer: LS.K.riskText["持續觀察"],
        explain: '<small>出處：<a href="' + LS.K.SRC.delimit.url + '" target="_blank" rel="noopener">' + LS.K.SRC.delimit.name + "</a></small>" },
    ];
    return qs;
  }
  function build(theme, n) {
    if (theme === "knowledge") {
      return LS.K.questions(streams, 2).slice(0, n).map((r) => ({ q: r.prompt, choices: r.options.map((o) => o.label), answer: r.answer, explain: r.explain }));
    }
    return countyQuestions(theme.slice(7));
  }
  let qs = null;

  // ---- 學習單 ----
  const sheet = document.getElementById("sheet"), genBtn = document.getElementById("gen"), printBtn = document.getElementById("print"), cmBtn = document.getElementById("cm");
  genBtn.disabled = printBtn.disabled = cmBtn.disabled = false;
  const MARK = ["①", "②", "③", "④"];
  function gen() {
    const theme = themeSel.value, n = +document.getElementById("num").value;
    qs = build(theme, n);
    const title = theme === "knowledge" ? "土石流防災知識" : "我的縣市：" + theme.slice(7);
    const body = qs.map((q, i) => '<div class="q"><b>' + (i + 1) + ". " + esc(q.q) + "</b><br>" + q.choices.map((c, k) => MARK[k] + " " + esc(c)).join("　") + "</div>").join("");
    const extra = theme === "knowledge" ? "" : '<div class="q"><b>' + (qs.length + 1) + '. 找出你住的鄉鎮，寫下它有幾條潛勢溪流：</b> <span class="blank"></span> 條</div>' +
      '<div class="q"><b>' + (qs.length + 2) + '. 用自己的話說說看：潛勢溪流是「現在就會發生」嗎？為什麼？</b><br><span class="blank" style="width:90%"></span></div>';
    const ans = document.getElementById("withAns").checked
      ? '<div class="pb"></div><h2>答案</h2>' + qs.map((q, i) => '<div class="q"><b>' + (i + 1) + '.</b> <span class="ans">' + esc(q.answer) + "</span>" + (q.explain ? "<br><small>" + q.explain + "</small>" : "") + "</div>").join("")
      : "";
    sheet.innerHTML = "<h2>" + esc(title) + "學習單</h2><p>班級：<span class=\"blank\"></span>　座號：<span class=\"blank\" style=\"min-width:3em\"></span>　姓名：<span class=\"blank\"></span></p>" + body + extra +
      '<p><small>資料來源：農業部農村發展及水土保持署（政府資料開放授權條款第 1 版）。本學習單僅供教學，不是官方警報。</small></p>' + ans;
    sheet.hidden = false;
  }
  genBtn.onclick = gen;
  printBtn.onclick = () => { if (sheet.hidden) gen(); window.print(); };

  // ---- 上課模式 ----
  cmBtn.onclick = () => { qs = build(themeSel.value, +document.getElementById("num").value); ClassMode.start(qs); };

  // ---- 搶答計分板、班級連結 ----
  Board.init(document.getElementById("tab-board"));
  ClassLink.init(document.getElementById("tab-link"));

  // ---- 課程包 ----
  document.querySelectorAll("[data-pack]").forEach((b) => {
    b.onclick = () => {
      themeSel.value = b.dataset.pack === "knowledge" ? "knowledge" : "county:" + (counties.includes("南投縣") ? "南投縣" : counties[0]);
      show("sheet"); gen(); sheet.scrollIntoView({ behavior: "smooth" });
    };
  });

  // ---- 分頁 ----
  function show(name) {
    document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === name)));
    document.querySelectorAll(".panel").forEach((p) => { p.hidden = p.id !== "tab-" + name; });
  }
  document.querySelectorAll(".tab").forEach((t) => { t.onclick = () => show(t.dataset.tab); });
  const h = location.hash.slice(1);
  if (["sheet", "slides", "board", "link", "guide"].includes(h)) show(h);
});
