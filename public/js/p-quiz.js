/* 闖關頁：選模式（入門／挑戰／60 秒）後開始。題目由 knowledge.js 產生。
   網址 #m=easy／hard／timed 直接開局。 */
LS.boot(({ streams }) => {
  const root = document.getElementById("root");
  const MODES = {
    easy: { key: "quiz-easy", title: "闖關・入門", lv: 1, n: 8 },
    hard: { key: "quiz-hard", title: "闖關・挑戰", lv: 2, n: 12 },
    timed: { key: "quiz-timed", title: "闖關・60 秒", lv: 2, timed: 60 },
  };
  function start(m) {
    const c = MODES[m];
    let rounds = LS.K.questions(streams, c.lv);
    if (c.timed) rounds = rounds.concat(LS.K.questions(streams, c.lv), LS.K.questions(streams, c.lv)); // 60 秒答不完整套，多準備幾輪
    else rounds = rounds.slice(0, c.n);
    Quiz.run(root, { key: c.key, title: c.title, rounds, timed: c.timed, onAgain: () => start(m) });
  }
  function menu() {
    root.replaceChildren(LS.el(
      '<div class="menu"><p class="lead zy">選一個玩法。每一題都有出處，答完會告訴你為什麼。</p><div class="cards">' +
      '<button class="btn primary big" data-m="easy">🌱 入門（8 題）</button>' +
      '<button class="btn big" data-m="hard">🌳 挑戰（12 題）</button>' +
      '<button class="btn big" data-m="timed">⚡ 60 秒搶分</button></div></div>'));
    root.querySelectorAll("[data-m]").forEach((b) => { b.onclick = () => start(b.dataset.m); });
  }
  const m = LS.hashParams().m;
  MODES[m] ? start(m) : menu();
});
