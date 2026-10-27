/* 教師專區的「班級連結」：選遊戲、年級，產生一條網址和 QR 碼，全班平板掃了就是同一個年級、同一個遊戲。
   網址格式 #m=easy&grade=low，學生端的套用在 data.js 的 applyClassLink。
   QR 碼用 js/vendor/qrcode.js（qrcode-generator，MIT），畫在 canvas 上。 */
window.ClassLink = (function () {
  "use strict";
  const { esc, el } = LS;

  // [顯示名稱, 路徑, m 參數（沒有就直接進頁面）]
  const TARGETS = [
    ["闖關・入門", "/quiz", "easy"], ["闖關・挑戰", "/quiz", "hard"], ["闖關・60 秒", "/quiz", "timed"],
    ["看溪觀察站", "/watch", ""], ["我的鄉鎮", "/streams", ""], ["認識溪流", "/river", ""], ["臺灣地圖", "/map", ""], ["首頁", "/", ""],
  ];

  function drawQR(canvas, text) {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount(), quiet = 4, px = Math.max(3, Math.floor(280 / (n + quiet * 2)));
    const size = (n + quiet * 2) * px;
    canvas.width = canvas.height = size;
    const c = canvas.getContext("2d");
    c.fillStyle = "#fff";
    c.fillRect(0, 0, size, size);
    c.fillStyle = "#000";
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) c.fillRect((k + quiet) * px, (r + quiet) * px, px, px);
  }

  function init(root) {
    const g = LS.grade();
    root.replaceChildren(el(
      '<div><h2 style="margin-top:0">班級連結</h2>' +
      '<p class="lead">選好遊戲和年級，把連結貼到班級群組，或把下面的 QR 碼投影出來讓全班掃。學生點開就是同一個年級（低年級自動有注音），不用每台自己設定。</p>' +
      '<div class="form-row noprint"><label>遊戲<select id="cl-game">' + TARGETS.map((t, i) => '<option value="' + i + '">' + esc(t[0]) + "</option>").join("") + "</select></label></div>" +
      '<fieldset style="border:0;padding:0;margin:8px 0"><legend><b>年級</b></legend>' +
      Object.entries(LS.GRADES).map(([k, v]) => '<label style="margin-right:16px"><input type="radio" name="cl-grade" value="' + k + '"' + (k === g ? " checked" : "") + "> " + esc(v) + "</label>").join("") + "</fieldset>" +
      '<p><input id="cl-url" readonly style="width:100%;font:inherit;padding:10px;border:3px solid var(--line);border-radius:12px" aria-label="班級連結網址"></p>' +
      '<p><button class="btn primary" id="cl-copy">複製連結</button> <a class="btn" id="cl-open" target="_blank" rel="noopener">開啟看看</a> <span id="cl-msg" role="status" style="margin-left:8px;color:var(--green-d);font-weight:700"></span></p>' +
      '<div style="text-align:center"><canvas id="cl-qr" role="img" aria-label="班級連結的 QR 碼" style="max-width:100%;border:3px solid var(--line);border-radius:12px;background:#fff"></canvas></div></div>'
    ));
    const url = root.querySelector("#cl-url"), open = root.querySelector("#cl-open"), msg = root.querySelector("#cl-msg"), canvas = root.querySelector("#cl-qr");
    const refresh = () => {
      const [, path, m] = TARGETS[+root.querySelector("#cl-game").value];
      const p = new URLSearchParams();
      if (m) p.set("m", m);
      p.set("grade", root.querySelector("[name=cl-grade]:checked").value);
      const full = location.origin + path + "#" + p;
      url.value = full;
      open.href = full;
      drawQR(canvas, full);
      msg.textContent = "";
    };
    root.querySelectorAll("select,input[type=radio],input[type=checkbox]").forEach((x) => x.addEventListener("change", refresh));
    root.querySelector("#cl-copy").onclick = async () => {
      try { await navigator.clipboard.writeText(url.value); msg.textContent = "已複製"; }
      catch (e) { url.select(); msg.textContent = "請按 Ctrl＋C 複製"; }
    };
    refresh();
  }
  return { init };
})();
