/**
 * sky-squad 专项:一个键都不按,看第 N 关会不会自己判过关。
 * 用法:node scripts/qa-window3/skyidle.mjs 7 20 45 90 132 170
 */
import * as D from "./driver.mjs";

const LEVELS = (process.argv.slice(2).length ? process.argv.slice(2) : ["7", "20", "45", "90", "132", "170", "188"]).map(Number);

const main = async () => {
  const { browser, page } = await D.launch();
  const errs = D.collectErrors(page);
  await page.goto(`${D.BASE}/`, { waitUntil: "networkidle0" });

  for (const lv of LEVELS) {
    await D.clearStorage(page);
    await D.seedProgress(page, ["sky-squad"], 188);
    await D.gotoGame(page, "sky-squad");
    await D.enterCampaign(page);
    const found = await D.gotoChapterOf(page, lv);
    if (!found) {
      console.log(`第${lv}关 章节没找到`);
      continue;
    }
    const opened = await D.openLevel(page, lv);
    if (opened.open !== "clicked" || opened.stage !== "ok") {
      console.log(`第${lv}关 打不开:${JSON.stringify(opened)}`);
      continue;
    }
    // 一个键都不按,只等
    const t0 = Date.now();
    let res = null;
    while (Date.now() - t0 < 70000) {
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
