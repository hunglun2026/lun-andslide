/* 頁首、頁尾與頁面啟動器。每頁 <body data-page="..."> 決定導覽列亮哪一個。 */
(function () {
  "use strict";
  const NAV = [
    ["watch", "看溪觀察站", "/watch", "📹"],
    ["map", "臺灣地圖", "/map", "🗺️"],
    ["river", "認識溪流", "/river", "⛰️"],
    ["streams", "我的鄉鎮", "/streams", "🏠"],
    ["quiz", "闖關", "/quiz", "🎮"],
    ["passport", "探險護照", "/passport", "🎫"],
    ["teacher", "教師專區", "/teacher", "🍎"],
  ];
  const page = document.body.dataset.page || "";
  const wrap = document.createElement("div");
  wrap.className = "wrap";
  const main = document.querySelector("main");
  main.before(wrap);
  wrap.innerHTML =
    '<header class="top"><a class="logo" href="/">⛰️ 土石流小偵探</a><nav aria-label="主選單">' +
    NAV.map((n) => '<a href="' + n[2] + '"' + (n[0] === page ? ' aria-current="page"' : "") + ">" + n[1] + "</a>").join("") +
    '</nav><button class="gradebtn" id="gradebtn"></button></header>';
  wrap.appendChild(main);

  // 年級鈕：共用電腦上一節低年級、下一節高年級，隨時可換，換了立刻生效
  const ICON = { low: "🌱", mid: "🌿", high: "🌳" };
  const gb = document.getElementById("gradebtn");
  const drawGrade = () => {
    const g = LS.grade();
    gb.textContent = ICON[g] + " " + LS.GRADES[g];
    gb.setAttribute("aria-label", "目前是" + LS.GRADES[g] + "，按一下換年級");
  };
  gb.onclick = async () => {
    const g = await LS.dialog("你幾年級？低年級會顯示注音、朗讀比較慢。", Object.keys(LS.GRADES).map((k) =>
      ({ label: ICON[k] + " " + LS.GRADES[k], value: k, primary: k === LS.grade() })).concat([{ label: "取消", value: "" }]));
    if (g) LS.setGrade(g);
  };
  document.addEventListener("ls-grade", drawGrade);
  drawGrade();

  // 手機底部分頁列：導覽在窄螢幕排成多行很擠，改成 4 個大按鈕（最後一個「更多」收首頁與說明）
  const TABS = [["📹", "看溪", "/watch", page === "watch"], ["🗺️", "地圖", "/map", page === "map"], ["🎮", "闖關", "/quiz", page === "quiz"]];
  const bar = document.createElement("nav");
  bar.className = "tabbar noprint";
  bar.setAttribute("aria-label", "快速選單");
  bar.innerHTML = TABS.map((t) => '<a href="' + t[2] + '"' + (t[3] ? ' aria-current="page"' : "") + "><i>" + t[0] + "</i>" + t[1] + "</a>").join("") +
    '<button type="button" id="more"><i>☰</i>更多</button>';
  document.body.appendChild(bar);
  const sheet = document.createElement("dialog");
  sheet.className = "sheetmenu";
  sheet.innerHTML = '<div class="dlg-in"><div class="dlg-bar"><button class="btn" data-close>關閉 ✕</button></div>' +
    [["🏠", "首頁", "/"]].concat(NAV.map((n) => [n[3], n[1], n[2]])).map((n) => '<a href="' + n[2] + '">' + n[0] + " " + n[1] + "</a>").join("") + "</div>";
  document.body.appendChild(sheet);
  document.getElementById("more").onclick = () => sheet.showModal();
  sheet.querySelector("[data-close]").onclick = () => sheet.close();
  sheet.onclick = (e) => { if (e.target === sheet) sheet.close(); };

  const foot = document.createElement("footer");
  foot.className = "foot";
  foot.innerHTML =
    '<div class="foot-brand"><img src="/img/hunglun-logo.webp" alt="鴻綸科技" width="282" height="56"></div>' +
    '<p class="foot-copy">資料來源：農業部農村發展及水土保持署（原農業部水土保持署）提供的《土石流觀測站影像》（2026 年取得）與《113年度1736條土石流潛勢溪流影響範圍圖》，依政府資料開放授權條款－第1版使用；資料版權屬原資料提供機關，由鴻綸科技整理製作。即時畫面由水保署提供，僅供教學觀察，不是官方警報，真正的防災資訊請看水保署與當地政府公告。本站程式、介面設計與整理編排 © 2026 鴻綸科技股份有限公司 版權所有。</p>' +
    '<p class="foot-links"><a href="/help">使用說明</a>　<a href="/open-data">資料來源與授權</a>　<a href="/privacy">隱私說明</a></p><p id="data-stamp" hidden></p>';
  wrap.appendChild(foot);

  // LS.boot(fn)：載入資料後呼叫 fn({cams, streams, meta})，處理載入中與失敗畫面
  window.LS.boot = async function (fn) {
    main.insertAdjacentHTML("beforeend", '<div class="loading" id="boot">正在準備資料⋯⛰️</div>');
    try {
      const data = await window.LS.load();
      document.getElementById("boot").remove();
      const st = document.getElementById("data-stamp");
      st.textContent = "目前收錄 " + data.cams.length + " 支觀測站鏡頭、" + data.streams.length + " 條土石流潛勢溪流（113 年度資料）。";
      st.hidden = false;
      await fn(data);
      // 量「畫面可以操作」的時間用：測試腳本讀 <html data-ready>（毫秒）
      document.documentElement.dataset.ready = Math.round(performance.now());
    } catch (e) {
      console.error(e);
      // 資料載入後頁面自己的程式出錯時，boot 已經被移除，要另外補一個錯誤畫面，不能讓學生看到一片空白
      const b = document.getElementById("boot") || main.appendChild(document.createElement("div"));
      b.className = "err";
      b.innerHTML = '頁面載入失敗了。請檢查網路後重新整理。<br><button class="btn" onclick="location.reload()">重新整理</button>';
      document.documentElement.dataset.error = String(e && e.message || e).slice(0, 200);
    }
  };
})();
