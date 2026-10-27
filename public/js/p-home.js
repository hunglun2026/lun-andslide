/* 首頁：數字都從真實資料算，不寫死。 */
LS.boot(({ cams, streams }) => {
  const live = cams.filter((c) => c.live).length;
  const counties = new Set(streams.map((s) => s.county)).size;
  const high = streams.filter((s) => s.risk === "高").length;
  const stat = (n, t) => LS.el('<div class="fact"><h4>' + n + "</h4><p>" + t + "</p></div>");
  const box = document.getElementById("stats");
  box.append(stat(live, "支鏡頭有即時畫面"), stat(streams.length, "條土石流潛勢溪流"), stat(counties, "個縣市有潛勢溪流"), stat(high, "條風險等級為「高」"));
});
