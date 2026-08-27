/** 窗口 3 验收 · 探针:打印一款游戏进入后的按钮与选关 DOM,用来对齐走查脚本的选择器。 */
import * as D from "./driver.mjs";

const id = process.argv[2];
const title = process.argv[3] ?? "";
const clickText = process.argv[4] ?? "";

const { browser, page } = await D.launch();
const errs = D.collectErrors(page);
await page.goto(`${D.BASE}/`, { waitUntil: "networkidle0" });
await D.seedProgress(page, [id]);

console.log("entry:", JSON.stringify(await D.openFromHome(page, { id, title })));
const dump = async (tag) => {
  console.log(`--- ${tag}`);
  console.log("buttons:", JSON.stringify(await D.stageButtons(page)));
  console.log("l99 tabs:", (await D.chapterTabs(page)).length, "nodes:", await page.evaluate(() => document.querySelectorAll(".l99-node").length));
  console.log(
    "classes:",
    JSON.stringify(
      await page.evaluate(() => {
        const stage = document.querySelector(".game-stage");
        const seen = new Set();
        for (const el of stage?.querySelectorAll("*") ?? []) {
          const c = typeof el.className === "string" ? el.className.split(/\s+/)[0] : "";
          if (c) seen.add(c);
        }
        return [...seen].slice(0, 60);
      })
    )
  );
};
await dump("进入后");
if (clickText) {
  console.log("click:", clickText, await D.clickButtonByText(page, clickText));
  await dump(`点了「${clickText}」`);
}
console.log("errors:", errs.errors.slice(0, 5));
await browser.close();
