/* 認識溪流：土石流是什麼、三個區域、兩種型態、12 項前兆、怎麼避難，以及「同一條溪不同位置」的鏡頭並排看。
   內容全部來自水保署官網（見 knowledge.js 的 SRC），查不到官方說法的不寫。 */
LS.boot(({ cams }) => {
  const root = document.getElementById("root");
  const { esc, el } = LS, K = LS.K;
  const src = (k) => '<small>出處：<a href="' + K.SRC[k].url + '" target="_blank" rel="noopener">' + K.SRC[k].name + "</a></small>";

  root.appendChild(el(
    '<div><section><h2>土石流是什麼？</h2><p class="lead zy">土石流是泥、砂、石頭和水混在一起，受到重力，從高處往低處流的自然現象。常常跟著山崩一起出現，速度很快（約每秒 2 到 20 公尺）。</p>' +
    "<p>它本來是自然現象；造成人受傷或財產損失的時候，才叫做「土石流災害」。<br>" + src("def") + "</p></section></div>"));

  const zones = el('<section><h2>土石流經過的三個區域</h2><div class="facts"></div><p>' + src("def") + "</p></section>");
  K.ZONES.forEach(([n, t]) => zones.querySelector(".facts").appendChild(el('<div class="fact"><h4>' + esc(n) + "</h4><p>" + esc(t) + "</p></div>")));
  root.appendChild(zones);
  root.appendChild(el('<section><h2>兩種型態</h2><p><b>坡面型</b>：沿著山坡的坡面流動。<br><b>溪流型</b>：沿著溪床或山溝流動。<br>' + src("def") + "</p></section>"));

  // 同一個觀測站裡，鏡頭名稱有上游、中游、下游的，並排看
  const bySt = {};
  cams.forEach((c) => { if (c.live && ["up", "mid", "down"].includes(c.role)) (bySt[c.station] = bySt[c.station] || []).push(c); });
  const stations = Object.keys(bySt).filter((s) => new Set(bySt[s].map((c) => c.role)).size >= 2);
  const sec = el('<section><h2>同一條溪的不同位置</h2><p>有些觀測站在溪流的不同位置各裝了鏡頭，名字叫上游、中游、下游。選一個站，並排看看。<br><small>鏡頭名字只說明裝在哪裡，不等於上面的三個區域。</small></p><div class="chips" id="st"></div><div class="trio" id="trio"></div></section>');
  const show = (name) => {
    sec.querySelectorAll("#st .chip").forEach((b) => b.setAttribute("aria-pressed", String(b.textContent === name)));
    const trio = sec.querySelector("#trio");
    trio.replaceChildren();
    const order = { up: 0, mid: 1, down: 2 };
    bySt[name].slice().sort((a, b) => order[a.role] - order[b.role]).forEach((c) => {
      const box = el('<figure class="trio-i"><figcaption><b>' + esc(c.name) + "</b></figcaption></figure>");
      box.appendChild(LS.camImage(c));
      trio.appendChild(box);
      Progress.seenCam(c.id);
    });
  };
  stations.forEach((s) => {
    const b = el('<button class="chip" aria-pressed="false">' + esc(s) + "</button>");
    b.onclick = () => show(s);
    sec.querySelector("#st").appendChild(b);
  });
  if (!stations.length) sec.querySelector("#st").textContent = "目前沒有可以並排看的鏡頭。";
  root.appendChild(sec);

  root.appendChild(el('<section><h2>水保署列出的 12 項前兆</h2><ol>' + K.SIGNS.map((x) => "<li>" + esc(x) + "</li>").join("") +
    "</ol><p>" + src("faq") + "</p></section>"));
  root.appendChild(el('<section><h2>怎麼避難？</h2><ul>' +
    "<li>向溪流兩側的高地疏散，不要往溪溝靠近。</li><li>避難時不要穿越土石流潛勢溪流。</li>" +
    "<li>來不及事先避難時，可往溪流兩側高地，或往鋼筋混凝土房舍 3 樓以上。</li>" +
    "<li>最好在發生之前，照平時演練的路線避難。</li></ul><p>" + src("guide") + "　" + src("faq") + "</p></section>"));
  root.appendChild(el('<p class="lead">學完了嗎？去<a href="/quiz">闖關</a>試試看！</p>'));
});
