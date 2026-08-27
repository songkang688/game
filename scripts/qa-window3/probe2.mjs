/** 探针 2:盯 188 关解锁与结算面板,调走查脚本用。 */
import * as D from "./driver.mjs";

const id = process.argv[2] ?? "bowling-lane";
const title = process.argv[3] ?? "保龄球小馆";

const { browser, page } = await D.launch();
const errs = D.collectErrors(page);
await page.goto(`${D.BASE}/`, { waitUntil: "networkidle0" });
await D.clearStorage(page);
await D.seedProgress(page, [id]);
console.log("seeded len:", await page.evaluate((g) => JSON.parse(localStorage.getItem(`yiduo-yixing.l99.${g}`)).length, id));

await D.openFromHome(page, { id, title });
console.log("tabs:", (await D.chapterTabs(page)).length);
const dump = async (tag) => {
  const st = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll(".l99-node")];
    return {
      count: nodes.length,
      first: nodes[0]?.getAttribute("aria-label"),
      last: nodes[nodes.length - 1]?.getAttribute("aria-label"),
      locked: nodes.filter((n) => n.classList.contains("l99-node-lock")).length,
      saveLen: (() => {
        try {
          return JSON.parse(localStorage.getItem("yiduo-yixing.l99.__x") ?? "null");
        } catch {
          return null;
        }
      })(),
    };
  });
  console.log(tag, JSON.stringify(st, null, 0));
};
await dump("初始:");

console.log("goto ch of 1:", await D.gotoChapterOf(page, 1));
await dump("ch1:");
let o = await D.openLevel(page, 1);
console.log("open 1:", JSON.stringify(o));
const p = await D.play(page, { ms: 20000, drag: true, stopOnResult: false });
console.log("play lv1:", JSON.stringify(p));
console.log(
  "stage html:",
  (await page.evaluate(() => document.querySelector(".l99-stage")?.innerHTML ?? "")).slice(0, 900)
);
await D.dismissResult(page);
await D.backToMap(page);
await dump("回地图:");
console.log("save now:", await page.evaluate((g) => localStorage.getItem(`yiduo-yixing.l99.${g}`)?.slice(0, 120), id));
console.log("goto ch of 188:", await D.gotoChapterOf(page, 188));
await dump("ch8:");
console.log("open 188:", JSON.stringify(await D.openLevel(page, 188)));
console.log("errors:", errs.errors.slice(0, 5));
await browser.close();
