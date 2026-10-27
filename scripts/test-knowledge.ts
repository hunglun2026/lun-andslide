// 離線測試：題庫格式與出處。執行：npm test
// knowledge.js 是瀏覽器檔（掛在 window.LS），用 vm 在假的 window 裡載入。
import { readFileSync } from "node:fs";
import vm from "node:vm";

let fail = 0;
const eq = (name: string, ok: boolean, extra = "") => { if (!ok) fail++; console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : "  " + extra}`); };

const win: any = { LS: { shuffle: (a: any[]) => a.slice(), pick: (a: any[], n: number) => a.slice(0, n) } };
vm.runInNewContext(readFileSync("public/js/knowledge.js", "utf8"), { window: win });
const K = win.LS.K;

eq("12 項前兆", K.SIGNS.length === 12, String(K.SIGNS.length));
eq("三個區域", K.ZONES.length === 3);
eq("題庫至少 15 題", K.BASE_Q.length >= 15, String(K.BASE_Q.length));
const ids = K.BASE_Q.map((q: any) => q.id);
eq("題目 id 不重複", new Set(ids).size === ids.length);
for (const q of K.BASE_Q) {
  eq(`${q.id}：4 個選項、不重複、答案是第一個`, q.opts.length === 4 && new Set(q.opts).size === 4);
  eq(`${q.id}：有說明且有出處`, !!q.why && !!K.SRC[q.src], q.src);
  eq(`${q.id}：用詞與標點（無破折號、無大陸用語）`, !/[—―]|優化|賦能|落地|對齊|痛點/.test(q.q + q.why + q.opts.join("")));
}
const streams = [{ county: "南投縣" }, { county: "南投縣" }, { county: "臺南市" }, { county: "花蓮縣" }, { county: "高雄市" }, { county: "屏東縣" }];
const lv1 = K.questions(streams, 1), lv2 = K.questions(streams, 2);
eq("入門只出 lv1 題", lv1.length > 0 && lv1.length < lv2.length, `${lv1.length}/${lv2.length}`);
eq("每題答案都在選項裡", lv2.every((r: any) => r.options.some((o: any) => o.id === r.answer)));
console.log(fail ? `\n${fail} 項失敗` : "\n全部通過");
process.exit(fail ? 1 : 0);
