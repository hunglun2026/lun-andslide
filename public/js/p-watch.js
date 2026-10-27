/* 看溪觀察站：挑一支鏡頭，看現在的畫面，用觀察清單自己看。
   即時畫面沒有標準答案，所以這頁不計分，只蓋護照章；網址 #cam=站號-鏡頭號 直接開某支。 */
LS.boot(({ cams }) => {
  const root = document.getElementById("root");
  const byId = Object.fromEntries(cams.map((c) => [c.id, c]));
  const ROLE = { up: "上游", mid: "中游", down: "下游", pano: "全景", other: "其他" };
  let county = "";

  const counties = [...new Set(cams.map((c) => c.county).filter(Boolean))].sort((a, b) => LS.countyRank(a) - LS.countyRank(b));
  const head = LS.el(
    '<div><p class="lead zy">這些是水保署架在溪邊的鏡頭，你現在看到的是<b>剛剛拍的畫面</b>。挑一支來看看吧！</p>' +
    '<div class="chips" id="chips"></div><div class="grid" id="list"></div></div>');
  root.appendChild(head);
  const chips = head.querySelector("#chips");
  const list = head.querySelector("#list");

  function drawChips() {
    chips.replaceChildren();
    [["", "全部（" + cams.length + "）"]].concat(counties.map((c) => [c, c + "（" + cams.filter((x) => x.county === c).length + "）"])).forEach(([v, label]) => {
      const b = LS.el('<button class="chip" aria-pressed="' + (county === v) + '">' + LS.esc(label) + "</button>");
      b.onclick = () => { county = v; drawChips(); drawList(); };
      chips.appendChild(b);
    });
  }
  function drawList() {
    list.replaceChildren();
    const seen = Progress.get().cams;
    cams.filter((c) => !county || c.county === county).forEach((c) => {
      const b = LS.el(
        '<button class="lscard' + (seen[c.id] ? " seen" : "") + '"><b>' + LS.esc(c.station) + "</b><span>" + LS.esc(c.name) + "</span><small>" +
        LS.esc((c.county || "") + (c.district || "")) + " ・ " + ROLE[c.role] + (c.live ? "" : " ・ 沒有畫面") + "</small></button>");
      b.onclick = () => open(c.id);
      list.appendChild(b);
    });
  }

  function open(id) {
    const c = byId[id];
    if (!c) return;
    history.replaceState(null, "", "#cam=" + id);
    Progress.seenCam(id);
    const d = document.createElement("dialog");
    d.className = "camdlg";
    d.innerHTML =
      '<div class="dlg-in"><div class="dlg-bar"><b>' + LS.esc(c.station + "・" + c.name) + '</b><button class="btn" data-close>關閉 ✕</button></div>' +
      '<p class="camwhere">' + LS.esc(c.place || (c.county || "") + (c.district || "")) + '</p><div id="pic"></div>' +
      '<p class="camnote">這是一張照片，只看一眼<b>看不出</b>會不會有土石流。真正的警戒請看水保署與當地政府的公告。</p>' +
      '<h3>觀察清單（自己看，沒有對錯）</h3><ul class="chk"></ul>' +
      '<details><summary>水保署列出的土石流前兆（共 ' + LS.K.SIGNS.length + " 項）</summary><ol>" + LS.K.SIGNS.map((s) => "<li>" + LS.esc(s) + "</li>").join("") + "</ol>" +
      '<small>出處：<a href="' + LS.K.SRC.faq.url + '" target="_blank" rel="noopener">' + LS.K.SRC.faq.name + "</a></small></details></div>";
    const CHK = ["溪水是清的，還是混濁的？", "水裡有沒有樹枝、木頭（流木）？", "水量看起來多，還是少？", "旁邊有沒有崩塌的土石？"];
    d.querySelector(".chk").innerHTML = CHK.map((t, k) => '<li><label><input type="checkbox" id="k' + k + '"> ' + LS.esc(t) + "</label></li>").join("");
    d.querySelector("#pic").appendChild(LS.camImage(c));
    document.body.appendChild(d);
    d.querySelector("[data-close]").onclick = () => d.close();
    d.addEventListener("close", () => { d.remove(); history.replaceState(null, "", location.pathname); drawList(); });
    d.showModal();
  }

  drawChips();
  drawList();
  const h = LS.hashParams().cam;
  if (h) open(h);
});
