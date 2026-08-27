/** 窗口 3 验收 · 单款探针:打印一款游戏的模式条、地图、结算探测结果,用来调走查脚本。 */
import * as D from "./driver.mjs";

const id = process.argv[2];
const title = process.argv[3] ?? "";
const secs = Number(process.argv[4] ?? 12);

const { browser, page } = await D.launch();
const errs = D.collectErrors(page);
await page.goto(`${D.BASE}/`, { waitUntil: "networkidle0" });
await D.seedProgress(page, [id]);

const entry = await D.openFromHome(page, { id, title });
console.log("entry:", JSON.stringify(entry));
console.log("stage buttons:", JSON.stringify(await D.stageButtons(page)));
console.log("chapter tabs:", JSON.stringify(await D.chapterTabs(page)));
console.log("l99 nodes:", await page.evaluate(() => document.querySelectorAll(".l99-node").length));
console.log(
  "stage html head:",
  (await page.evaluate(() => document.querySelector(".game-stage")?.innerHTML ?? "")).slice(0, 1400)
);

const res = await D.play(page, { ms: secs * 1000, stopOnResult: false });
console.log("play:", JSON.stringify(res));
console.log("overflow:", JSON.stringify(await D.overflowPx(page)));
console.log("errors:", errs.errors.slice(0, 8));
await browser.close();
