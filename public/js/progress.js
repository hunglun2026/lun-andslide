/* 探險護照的紀錄：看過哪些鏡頭與鄉鎮、各遊戲最好幾顆星、徽章。只存在這台裝置的 localStorage，不上傳、不蒐集個資。
   Progress.seenCam(id)、Progress.seenTown(縣市+鄉鎮)、Progress.stars(key, n)、Progress.badges(data)、Progress.get()、Progress.clear() */
window.Progress = (function () {
  "use strict";
  const KEY = "ls-progress-v1";
  function get() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s && s.cams) return s;
    } catch (e) { /* 無痕模式 */ }
    return { cams: {}, towns: {}, stars: {} };
  }
  function update(fn) {
    const s = get();
    fn(s);
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* 存不了就算了，不影響遊戲 */ }
  }
  const seenCam = (id) => update((s) => { s.cams[id] = s.cams[id] || Date.now(); });
  const seenTown = (key) => update((s) => { s.towns[key] = s.towns[key] || Date.now(); });
  const stars = (key, n) => update((s) => { s.stars[key] = Math.max(s.stars[key] || 0, n); });
  const clear = () => { try { localStorage.removeItem(KEY); } catch (e) { /* 忽略 */ } };

  // 各遊戲在護照上顯示的名字（key 要跟各遊戲存星數用的一樣）
  const GAMES = [["quiz-easy", "闖關・入門"], ["quiz-hard", "闖關・挑戰"], ["quiz-timed", "闖關・60 秒"], ["map-find", "臺灣地圖・找站點"]];

  // 徽章：有沒有拿到全部從紀錄算出來，不另外存，規則改了舊紀錄也會跟著對
  function badges(data) {
    const s = get();
    const nCam = Object.keys(s.cams).length, nTown = Object.keys(s.towns).length;
    const st = (k) => s.stars[k] || 0;
    const live = data.cams.filter((c) => c.live).length;
    return [
      ["👣", "第一步", "看第 1 支鏡頭的即時畫面", nCam >= 1],
      ["📹", "小小觀察員", "看過 10 支不同的鏡頭", nCam >= 10],
      ["🔭", "全臺觀察員", "看過所有有畫面的鏡頭（共 " + live + " 支）", live > 0 && nCam >= live],
      ["🏠", "我的家鄉", "查過自己的縣市與鄉鎮", nTown >= 1],
      ["🗺️", "走遍臺灣", "查過 5 個不同的鄉鎮", nTown >= 5],
      ["🏆", "闖關高手", "闖關挑戰拿到三顆星", st("quiz-hard") >= 3],
      ["⚡", "閃電快手", "60 秒挑戰拿到三顆星", st("quiz-timed") >= 3],
      ["🎯", "地圖達人", "臺灣地圖找站點拿到三顆星", st("map-find") >= 3],
    ].map(([icon, name, how, got]) => ({ icon, name, how, got }));
  }
  return { get, seenCam, seenTown, stars, clear, badges, GAMES };
})();
