/* 老師上課模式：全螢幕，題目、照片、倒數、各組計分在同一個畫面，簡報筆就能上完一堂。
   ClassMode.start(題目清單, 離開時要做的事)。題目格式 { q, choices, answer, explain(html) }。
   按鍵：下一頁／→／空白＝揭曉答案，再按＝下一題；上一頁／←＝上一題；B 或 .（簡報筆黑畫面鍵）＝倒數開始／暫停；
        1～6＝該組加 1 分、Shift＋數字＝減 1 分；R＝隨機抽一組；S＝自動念題開關；Esc＝離開。 */
window.ClassMode = (function () {
  "use strict";
  const { esc, el } = LS;
  const SECS = 15;

  function start(qs, onExit) {
    let i = 0, showAns = false, loud = true, left = SECS, timer = null;
    const box = el(
      '<div class="classmode" role="dialog" aria-label="上課模式">' +
      '<div class="cm-top"><b>⛰️ 課堂大挑戰</b><span id="cm-n"></span><button class="btn" id="cm-loud"></button><button class="btn" id="cm-x">✕ 離開（Esc）</button></div>' +
      '<div class="cm-main"><div id="cm-q"></div></div>' +
      '<aside class="cm-side"><div class="cm-timer" id="cm-t"></div>' +
      '<p class="cm-row"><button class="btn" id="cm-go">⏱️ 開始／暫停（B）</button><button class="btn" id="cm-r">🎲 抽一組（R）</button></p>' +
      '<div id="cm-teams" class="cm-teams"></div></aside>' +
      '<div class="cm-keys">下一頁／空白：揭曉答案 → 下一題　上一頁：上一題　B：倒數　1～6：加分（Shift 減分）　R：抽組　S：自動念</div></div>'
    );
    document.body.appendChild(box);
    document.body.classList.add("cm-on");
    if (box.requestFullscreen) box.requestFullscreen().catch(() => { /* 不能全螢幕也照樣用 */ });
    const $ = (id) => box.querySelector("#" + id);
    const teams = Board.mini($("cm-teams"));

    // 念題目：題目＋選項；揭曉時念答案
    const read = () => {
      if (!loud) return;
      const q = qs[i];
      if (showAns) Speak.say("答案是：" + q.answer);
      else Speak.say([[q.q, $("cm-h")]].concat(q.choices.map((c, k) => ["第" + (k + 1) + "個，" + c, $("cm-o").children[k]])));
    };
    function draw() {
      const q = qs[i];
      $("cm-n").textContent = "第 " + (i + 1) + " / " + qs.length + " 題";
      $("cm-q").replaceChildren(el(
        '<div><h2 id="cm-h" class="zy">' + esc(q.q) + "</h2>" +
        '<div class="opts" id="cm-o">' + q.choices.map((c) => '<div class="opt zy' + (showAns && c === q.answer ? " right" : "") + '">' + esc(c) + "</div>").join("") + "</div>" +
        '<div class="cm-ans">' + (showAns ? "答案：" + esc(q.answer) + (q.explain ? "<br><small>" + q.explain + "</small>" : "") : "") + "</div>" +
        '<p class="cm-row"><button class="btn big" id="cm-prev">◀ 上一題</button><button class="btn primary big" id="cm-next">' +
        (showAns ? (i === qs.length - 1 ? "最後一題了" : "下一題 ▶") : "揭曉答案") + "</button></p></div>"
      ));
      $("cm-prev").onclick = prev;
      $("cm-next").onclick = forward;
      $("cm-loud").textContent = loud ? "🔊 自動念：開（S）" : "🔇 自動念：關（S）";
      read();
    }
    function forward() {
      if (!showAns) { showAns = true; stopTimer(); draw(); return; }
      if (i < qs.length - 1) { i++; showAns = false; resetTimer(); draw(); }
    }
    function prev() { if (i > 0) { i--; showAns = false; resetTimer(); draw(); } }

    // 倒數（每題 15 秒，換題重設）
    const drawTimer = () => { $("cm-t").textContent = left > 0 ? left : "時間到！"; $("cm-t").classList.toggle("hurry", left <= 3); };
    const stopTimer = () => { clearInterval(timer); timer = null; };
    const resetTimer = () => { stopTimer(); left = SECS; drawTimer(); };
    function toggleTimer() {
      if (timer) return stopTimer();
      if (left <= 0) left = SECS;
      timer = setInterval(() => {
        left--; drawTimer();
        if (left > 0 && left <= 3) Fx.tick();
        if (left <= 0) { stopTimer(); Fx.ding(); }
      }, 1000);
    }

    function exit() {
      stopTimer(); Speak.stop();
      document.removeEventListener("keydown", key);
      document.removeEventListener("fullscreenchange", fsOut);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      box.remove();
      document.body.classList.remove("cm-on");
      if (onExit) onExit();
    }
    // 使用者按瀏覽器自己的 Esc 離開全螢幕時，上課模式也一起關
    const fsOut = () => { if (!document.fullscreenElement && box.isConnected) exit(); };
    document.addEventListener("fullscreenchange", fsOut);

    function key(e) {
      if (e.target.matches && e.target.matches("input,select,textarea")) return;
      const k = e.key, digit = /^Digit([1-6])$/.exec(e.code);
      let hit = true;
      if (["PageDown", "ArrowRight", "ArrowDown", " ", "Enter"].includes(k)) forward();
      else if (["PageUp", "ArrowLeft", "ArrowUp"].includes(k)) prev();
      else if (k === "b" || k === "B" || k === ".") toggleTimer();
      else if (digit) teams.add(+digit[1] - 1, e.shiftKey ? -1 : 1);
      else if (k === "r" || k === "R") teams.pick();
      else if (k === "s" || k === "S") { loud = !loud; if (!loud) Speak.stop(); draw(); }
      else if (k === "Escape") exit();
      else hit = false;
      if (hit) e.preventDefault();
    }
    document.addEventListener("keydown", key);
    $("cm-x").onclick = exit;
    $("cm-go").onclick = toggleTimer;
    $("cm-r").onclick = () => teams.pick();
    $("cm-loud").onclick = () => { loud = !loud; if (!loud) Speak.stop(); draw(); };
    resetTimer();
    draw();
  }
  return { start };
})();
