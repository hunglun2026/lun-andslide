/* 探險護照：看過幾支鏡頭、幾個鄉鎮、各遊戲幾顆星、徽章。資料只在這台裝置上。 */
LS.boot((data) => {
  const root = document.getElementById("root");
  const { esc, el } = LS;
  const s = Progress.get();
  const nCam = Object.keys(s.cams).length, nTown = Object.keys(s.towns).length;
  root.appendChild(el('<p class="lead zy">你看過 <b>' + nCam + "</b> 支鏡頭、查過 <b>" + nTown + "</b> 個鄉鎮。</p>"));
  const games = el('<div class="facts"></div>');
  Progress.GAMES.forEach(([k, name]) => {
    const n = s.stars[k] || 0;
    games.appendChild(el('<div class="fact"><h4>' + esc(name) + "</h4><p>" + "⭐".repeat(n) + "☆".repeat(3 - n) + "</p></div>"));
  });
  root.appendChild(games);
  const bd = el('<div class="badges"></div>');
  Progress.badges(data).forEach((b) => bd.appendChild(el('<div class="bdg' + (b.got ? " got" : "") + '"><span class="ico">' + b.icon + "</span><b>" + esc(b.name) + "</b><small>" + esc(b.how) + "</small></div>")));
  root.appendChild(bd);
  const clr = el('<p><button class="btn danger">清除我的紀錄</button></p>');
  clr.querySelector("button").onclick = async () => {
    if (await LS.dialog("確定要清除這台裝置上的所有紀錄嗎？", [{ label: "清除", value: true, danger: true }, { label: "取消", value: false, primary: true }])) { Progress.clear(); location.reload(); }
  };
  root.appendChild(clr);
});
