/**
 * 摆烂复验(浏览器层):进关以后一个键都不按,看会不会自己判过关。
 * skyidle.mjs 的通用版 —— 第一个参数是款号,后面是关号。
 * 用法:node scripts/qa-window3/idleplay.mjs duo-vs-star 1 134 145
 */
import * as D from "./driver.mjs";

const [id, ...lvArgs] = process.argv.slice(2);
if (!id) {
  console.error("用法:node scripts/qa-window3/idleplay.mjs <款号> <关号...>");
  process.exit(1);
}
const LEVELS = (lvArgs.length ? lvArgs : ["1"]).map(Number);
const WAIT_MS = Number(process.env.QA_IDLE_WAIT ?? 70000);

const main = async () => {
  const { browser, page } = await D.launch();
  const errs = D.collectErrors(page);
  await page.goto(`${D.BASE}/`, { waitUntil: "networkidle0" });

  for (const lv of LEVELS) {
    await D.clearStorage(page);
    await D.seedProgress(page, [id], 188);
    await D.gotoGame(page, id);
    // 自带地图的几款(章节条长得不一样)走各自的开关路径。
    // candy-swing 首屏就是关卡格子,那个「🗺️ 闯关 188 关」按钮是「直接开打」,
    // 先点它反而会跳进别的关,所以这类款不能先 enterCampaign。
    let opened;
    if (D.CUSTOM_MAP[id]) {
      opened = await D.openCustomLevel(page, id, lv);
    } else if ((await D.enterCampaign(page), !(await D.gotoChapterOf(page, lv)))) {
      console.log(`第${lv}关 章节没找到`);
      continue;
    } else {
      opened = await D.openLevel(page, lv);
    }
    if (opened?.open !== "clicked" || opened?.stage !== "ok") {
      console.log(`第${lv}关 打不开:${JSON.stringify(opened)}`);
      continue;
    }
    const t0 = Date.now();
    let res = null;
    while (Date.now() - t0 < WAIT_MS) {
      await D.sleep(700);
      res = await D.readResult(page);
      if (res && (res.kind === "win" || res.kind === "lose")) break;
    }
    console.log(
      `第${lv}关 摆烂 ${Math.round((Date.now() - t0) / 1000)} 秒 → ${res?.kind ?? "没结算"}` +
        `${res?.stars !== undefined ? ` (${res.stars} 星)` : ""}` +
        `${res ? ` | ${res.text.replace(/\s+/g, " ").slice(0, 110)}` : ""}`
    );
    await D.dismissResult(page);
  }
  console.log(`console 报错 ${errs.errors.length} 条`);
  await browser.close();
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
