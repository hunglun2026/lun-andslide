/* 搶答計分板＋倒數計時器。資料只存在這台裝置的 localStorage，不上傳。
   Board.init(root) 完整計分板（教師專區分頁）；Board.mini(root) 精簡版（上課模式右側），兩個共用同一份分數。 */
window.Board = (function () {
  "use strict";
  const KEY = "ls-board-v1";
  const COLORS = ["#e07a3f", "#3a8fd9", "#5a9e4b", "#b0558f", "#d9a520", "#2fb5a0"];

  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s && Array.isArray(s.teams)) return s;
    } catch (e) { /* 無痕模式 */ }
    return { teams: [0, 1, 2, 3].map((i) => ({ name: "第 " + (i + 1) + " 組", score: 0 })) };
  }
  const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* 忽略 */ } };

  function init(root) {
    const st = loadState();
    root.innerHTML =
      '<h2 style="margin-top:0">搶答計分板</h2>' +
      '<div class="form-row"><label>組數<select id="nteam">' + [2, 3, 4, 5, 6].map((n) => "<option" + (n === st.teams.length ? " selected" : "") + ">" + n + "</option>").join("") + "</select></label>" +
      '<button class="btn danger" id="reset">全部歸零</button></div><div class="teams" id="teams"></div>' +
      '<h2>倒數計時器</h2><div class="timer" id="time">00:30</div>' +
      '<div class="form-row" style="justify-content:center"><button class="btn" data-s="10">10 秒</button><button class="btn" data-s="30">30 秒</button><button class="btn" data-s="60">1 分鐘</button><button class="btn" data-s="180">3 分鐘</button>' +
      '<button class="btn primary" id="go">開始 / 暫停</button></div>';

    const teamsEl = root.querySelector("#teams");
    function draw() {
      teamsEl.replaceChildren();
      st.teams.forEach((t, i) => {
        const d = document.createElement("div");
        d.className = "team";
        d.style.background = COLORS[i % COLORS.length];
        d.innerHTML = '<input type="text" aria-label="組名" value="' + LS.esc(t.name) + '"><div class="n">' + t.score + '</div><div class="row"><button class="btn" data-d="-1">−1</button><button class="btn" data-d="1">+1</button><button class="btn" data-d="5">+5</button></div>';
        d.querySelector("input").oninput = (e) => { t.name = e.target.value; save(st); };
        d.querySelectorAll("[data-d]").forEach((b) => (b.onclick = () => { t.score += +b.dataset.d; save(st); draw(); }));
        teamsEl.appendChild(d);
      });
    }
    root.querySelector("#nteam").onchange = (e) => {
      const n = +e.target.value;
      while (st.teams.length < n) st.teams.push({ name: "第 " + (st.teams.length + 1) + " 組", score: 0 });
      st.teams.length = n; save(st); draw();
    };
    root.querySelector("#reset").onclick = async () => {
      const ok = await LS.dialog("確定要把所有組別的分數歸零嗎？", [{ label: "取消", value: false }, { label: "歸零", value: true, danger: true }]);
      if (ok) { st.teams.forEach((t) => (t.score = 0)); save(st); draw(); }
    };

    // 計時器
    const tEl = root.querySelector("#time");
    let left = 30, timer = null;
    const fmt = (s) => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    const show = () => { tEl.textContent = fmt(left); tEl.style.color = left === 0 ? "var(--red)" : ""; };
    root.querySelectorAll("[data-s]").forEach((b) => (b.onclick = () => { clearInterval(timer); timer = null; left = +b.dataset.s; show(); }));
    root.querySelector("#go").onclick = () => {
      if (timer) { clearInterval(timer); timer = null; return; }
      if (left === 0) return;
      timer = setInterval(() => {
        left--; show();
        if (left <= 0) { clearInterval(timer); timer = null; Fx.ding(); }
      }, 1000);
    };
    draw(); show();
  }
  // 精簡版（老師上課模式右側用）：跟完整計分板共用同一份分數。回傳 add(第幾組, 加減分)、pick() 隨機抽一組
  function mini(root) {
    const st = loadState();
    function draw(hi) {
      root.innerHTML = st.teams.map((t, i) =>
        '<div class="mteam' + (i === hi ? " picked" : "") + '" style="background:' + COLORS[i % COLORS.length] + '"><span>' + LS.esc(t.name) +
        '<small>按 ' + (i + 1) + "</small></span><b>" + t.score + '</b><button class="btn" data-i="' + i + '" data-d="-1" aria-label="' + LS.esc(t.name) + '減 1 分">−</button><button class="btn" data-i="' + i + '" data-d="1" aria-label="' + LS.esc(t.name) + '加 1 分">+</button></div>').join("");
      root.querySelectorAll("[data-d]").forEach((b) => (b.onclick = () => add(+b.dataset.i, +b.dataset.d)));
    }
    function add(i, d) {
      if (!st.teams[i]) return;
      st.teams[i].score += d; save(st); draw();
      if (d > 0) Fx.right();
    }
    // 隨機抽一組：輪流亮幾下再停，全班看得到是公平抽的
    function pick() {
      let n = 0;
      const total = 10 + Math.floor(Math.random() * st.teams.length);
      const t = setInterval(() => {
        draw(n % st.teams.length); Fx.tick();
        if (++n > total) { clearInterval(t); Fx.ding(); }
      }, 120);
    }
    draw();
    return { add, pick };
  }
  return { init, mini };
})();
