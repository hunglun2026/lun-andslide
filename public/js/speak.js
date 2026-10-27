/* 朗讀：包瀏覽器內建的 speechSynthesis（不用下載音檔、不用註冊服務）。只管「念出來」，念什麼由各頁決定。
   Speak.say(items)：items 是字串，或 [[文字, 要亮起的元素], ...]，一段一段念，念到哪段那段加 .reading 黃底
   Speak.btn(getItems, label)：做一顆 🔈 按鈕，按了念、再按停；這台裝置沒有中文聲音時按鈕會說明，不會像壞掉
   Speak.auto(on)：這個遊戲要不要自動念題（學生按過一次喇叭才打開，全班平板才不會一進來就一起出聲）
   語速跟著年級（LS.grade）：低年級慢一點、高年級快一點。 */
window.Speak = (function () {
  "use strict";
  const has = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  const RATE = { low: 0.85, mid: 1, high: 1.1 };
  let zh = null, en = null, noZh = false, token = 0, autoOn = false;

  // 挑聲音：台灣中文優先，其次其他中文（排除粵語）；名字有 Natural／Online／Google 的通常比較自然
  const score = (v) => (/natural|online|google/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
  const best = (list) => list.sort((a, b) => score(b) - score(a))[0] || null;
  function pickVoices() {
    const vs = speechSynthesis.getVoices();
    if (!vs.length) return;
    zh = best(vs.filter((v) => /^zh[-_]TW/i.test(v.lang))) || best(vs.filter((v) => /^zh/i.test(v.lang) && !/HK|yue/i.test(v.lang + v.name)));
    en = best(vs.filter((v) => /^en[-_]US/i.test(v.lang))) || best(vs.filter((v) => /^en/i.test(v.lang)));
    noZh = !zh;
    document.querySelectorAll(".spk").forEach(drawBtn);
  }
  if (has) { pickVoices(); speechSynthesis.addEventListener("voiceschanged", pickVoices); }

  // 念之前整理文字：emoji 不念、遮住的名字念「牠」；多音字換成同音字，確保念台灣的讀音
  const PRON = [
    [/長頸鹿/g, "常頸鹿"], [/棲/g, "妻"], [/鴞/g, "梟"], [/○○/g, "牠"], [/（名稱待確認）/g, ""],
  ];
  function clean(t) {
    // 低年級畫面有注音，從畫面抓的文字會夾著注音符號，要先拿掉
    let s = String(t || "").replace(/<rt>.*?<\/rt>/g, "").replace(/<[^>]+>/g, "")
      .replace(/[\p{Extended_Pictographic}️‍ㄅ-ㄯˇˊˋ˙]/gu, "");
    PRON.forEach(([re, to]) => { s = s.replace(re, to); });
    return s.replace(/\s+/g, " ").trim();
  }
  // 長段落切成句子再念：Chrome 一次念太長會念到一半自己停掉
  const sentences = (s) => s.split(/(?<=[。！？!?；;])/).map((x) => x.trim()).filter(Boolean);

  function stop() {
    token++;
    if (has) speechSynthesis.cancel();
    document.querySelectorAll(".reading").forEach((e) => e.classList.remove("reading"));
    document.querySelectorAll(".spk.on").forEach((b) => b.classList.remove("on"));
  }

  function utter(text, lang) {
    return new Promise((done) => {
      const u = new SpeechSynthesisUtterance(text);
      const v = lang === "en" ? en : zh;
      if (v) u.voice = v;
      u.lang = v ? v.lang : lang === "en" ? "en-US" : "zh-TW";
      u.rate = RATE[LS.grade()] || 1;
      u.onend = u.onerror = () => done();
      speechSynthesis.speak(u);
    });
  }

  // 依序念每一段；中途被 stop() 或念別的就不再往下
  async function say(items, lang) {
    if (!has) return;
    stop();
    const my = token;
    const list = typeof items === "string" ? [[items, null]] : items;
    for (const [text, elx] of list) {
      const s = lang === "en" ? String(text || "").trim() : clean(text);
      if (!s) continue;
      if (elx) elx.classList.add("reading");
      for (const part of lang === "en" ? [s] : sentences(s)) {
        if (my !== token) return;
        await utter(part, lang);
      }
      if (elx) elx.classList.remove("reading");
      if (my !== token) return;
    }
    if (my === token) document.querySelectorAll(".spk.on").forEach((b) => b.classList.remove("on"));
  }

  function drawBtn(b) {
    const off = !has || noZh;
    b.disabled = off && b.dataset.lang !== "en";
    if (b.dataset.lang === "en") b.hidden = !has || !en;
    b.title = off ? "這台裝置沒有中文語音，沒辦法朗讀" : b.dataset.label;
  }
  function btn(getItems, label, lang) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "spk";
    b.textContent = lang === "en" ? "🔈 英文" : "🔈";
    b.dataset.label = label || "念給我聽";
    if (lang) b.dataset.lang = lang;
    b.setAttribute("aria-label", b.dataset.label);
    b.onclick = (e) => {
      e.stopPropagation();
      if (b.classList.contains("on")) { stop(); return; }
      say(getItems(), lang);
      b.classList.add("on");
      autoOn = true; // 學生自己按過喇叭，之後的題目就自動念
    };
    drawBtn(b);
    return b;
  }

  addEventListener("pagehide", stop);
  return {
    say, stop, btn, clean,
    ok: () => has && !noZh,
    auto: (on) => { if (on !== undefined) autoOn = on; return autoOn; },
  };
})();
