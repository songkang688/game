/**
 * 360px 溢出定位:哪个元素把关卡页撑宽了。
 * 用法:node scripts/qa-window3/overflow.mjs bowling-lane 1
 */
import * as D from "./driver.mjs";

const [id, lvArg] = process.argv.slice(2);
const lv = Number(lvArg ?? 1);

const main = async () => {
  const { browser, page } = await D.launch({ width: 360, height: 720 });
  await page.goto(`${D.BASE}/`, { waitUntil: "networkidle0" });
  await D.clearStorage(page);
  await D.seedProgress(page, [id], 188);
  await D.gotoGame(page, id);
  await D.enterCampaign(page);
  await D.gotoChapterOf(page, lv);
  const opened = await D.openLevel(page, lv);
  // 溢出常常是「打起来以后」才出现的(计分板一格格填满、道具栏长出来),
  // 所以先真打一会儿再量。
  await D.play(page, { ms: 12000, seed: 3, stopOnResult: false, stayInLevel: true });
  await D.sleep(600);
  const out = await page.evaluate(() => {
    const doc = document.documentElement;
    // 走查驱动量的是 max(html.scrollWidth, body.scrollWidth) —— 撑宽的东西可能在 .game-stage 外面
    const over = Math.max(doc.scrollWidth, document.body.scrollWidth) - doc.clientWidth;
    const worst = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      const past = Math.round(r.right - doc.clientWidth);
      if (past > 0 && r.width > 8 && r.height > 8) {
        worst.push({
          past,
          left: Math.round(r.left),
          w: Math.round(r.width),
          tag: el.tagName.toLowerCase(),
          cls: (typeof el.className === "string" ? el.className : "").slice(0, 50),
          txt: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 30),
        });
      }
    }
    worst.sort((a, b) => b.past - a.past);
    return {
      over,
      clientWidth: doc.clientWidth,
      scrollWidth: doc.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      worst: worst.slice(0, 12),
    };
  });
  console.log(`${id} 第${lv}关 · 打开=${JSON.stringify(opened)}`);
  console.log(
    `视口 ${out.clientWidth}px,html ${out.scrollWidth}px,body ${out.bodyWidth}px → 横向溢出 ${out.over}px`
  );
  for (const w of out.worst) {
    console.log(`  超出 ${String(w.past).padStart(3)}px  <${w.tag} class="${w.cls}"> left=${w.left} w=${w.w} 「${w.txt}」`);
  }
  await browser.close();
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
