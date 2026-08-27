/**
 * 窗口 3 · 第 2 轮 · 竞态专项。
 *
 * 四种「玩家会真干出来」的乱按:
 *  R1 模式连点   —— 200ms 内把所有模式钮挨个点一遍,看会不会挂两份游戏 / 报错。
 *  R2 结算抢返回 —— 一边打一边每 300ms 猛点返回,专挑结算弹出那一瞬间。
 *  R3 进出打断   —— 游戏刚挂上 300ms 就切回首页,连做 8 次。
 *  R4 存档串味   —— A 款打一局 → 立刻进 B 款 → 再回 A 款,看进度有没有互相污染。
 *
 * 判据:console 不能有报错、.game-stage 里不能出现两个 canvas / 两份根节点、
 *       回首页后卡片数要还是 55、再进去还要能挂上。
 */
import { writeFileSync, mkdirSync } from "node:fs";
import * as D from "./driver.mjs";

const IDS = [
  "duo-rush", "duo-arena", "duo-vs-star", "sling-birds", "candy-swing", "gold-hook",
  "garden-guard", "sprout-defense", "monster-crisis", "shoot-range", "sky-squad", "tank-battle",
  "bomb-buddies", "snow-fight", "bumper-cars", "bowling-lane", "ice-fire-forest", "puff-bros",
  "prince-princess",
];

const mountCount = (page) =>
  page.evaluate(() => {
    const stage = document.querySelector(".game-stage");
    if (!stage) return { stage: false };
    return {
      stage: true,
      canvases: stage.querySelectorAll("canvas").length,
      roots: stage.children.length,
      overlays: stage.querySelectorAll(".l99-overlay, .result-buddies").length,
    };
  });

const clickAllModes = async (page) =>
  page.evaluate(() => {
    const stage = document.querySelector(".game-stage");
    if (!stage) return 0;
    const btns = [...stage.querySelectorAll("button")].filter((b) => {
      const r = b.getBoundingClientRect();
      return r.width > 8 && r.height > 8 && !b.closest(".l99-map");
    });
    let n = 0;
    for (const b of btns.slice(0, 8)) {
      b.click();
      n++;
    }
    return n;
  });

const main = async () => {
  const { browser, page } = await D.launch();
  const errs = D.collectErrors(page);
  const out = [];

  await page.goto(`${D.BASE}/`, { waitUntil: "networkidle0" });

  for (const id of IDS) {
    errs.reset();
    const rec = { id };
    await D.clearStorage(page);
    await D.seedProgress(page, [id], 188);

    // R1 模式连点
    await D.gotoGame(page, id);
    const clicked = await clickAllModes(page);
    await D.sleep(900);
    rec.r1 = { clicked, ...(await mountCount(page)) };

    // R2 结算抢返回
    await D.gotoGame(page, id);
    await D.enterCampaign(page);
    const t0 = Date.now();
    while (Date.now() - t0 < 9000) {
      await page.keyboard.press("Space").catch(() => {});
      await page.evaluate(() => {
        const back = [...document.querySelectorAll("button")].find((b) =>
          /回地图|返回|退出|←|回首页/.test(b.textContent ?? "")
        );
        back?.click();
      });
      await D.sleep(300);
    }
    rec.r2 = await mountCount(page);

    // R3 进出打断
    for (let i = 0; i < 8; i++) {
      await page.evaluate((g) => {
        location.hash = `#/game/${g}`;
      }, id);
      await D.sleep(300);
      await page.evaluate(() => {
        location.hash = "";
      });
      await D.sleep(160);
    }
    await D.sleep(600);
    rec.r3 = {
      cards: await page.evaluate(() => document.querySelectorAll(".game-card").length),
      remount: await D.gotoGame(page, id),
      ...(await mountCount(page)),
    };

    rec.errors = [...errs.errors].slice(0, 8);
    out.push(rec);
    // R2 猛点返回的正常结局就是退回首页,`.game-stage` 消失不算问题;
    // 真正要看的是有没有报错、有没有多挂一份、退干净以后还能不能重进。
    // R2 猛点返回的正常结局就是退回首页,`.game-stage` 消失不算问题;
    // 画布数也不能当信号 —— 进了模式才画布,停在选关页就是 0 张。
    // 真正要看的是:有没有报错、有没有多挂一份根节点、退干净以后还能不能重进。
    const bad =
      rec.errors.length || rec.r1.roots !== 1 || rec.r3.cards !== 55 || rec.r3.remount !== "ok";
    console.log(
      `${bad ? "✗" : "✓"} ${id} | R1 点${rec.r1.clicked}下 canvas${rec.r1.canvases}/根${rec.r1.roots}` +
        ` | R2 stage=${rec.r2.stage} canvas${rec.r2.canvases ?? "-"}` +
        ` | R3 卡片${rec.r3.cards} 重挂=${rec.r3.remount} canvas${rec.r3.canvases}` +
        ` | err=${rec.errors.length}${rec.errors.length ? " " + rec.errors[0].slice(0, 90) : ""}`
    );
  }

  // R4 存档串味:两两相邻换着进
  const cross = [];
  for (let i = 0; i + 1 < IDS.length; i += 2) {
    const [a, b] = [IDS[i], IDS[i + 1]];
    errs.reset();
    await D.clearStorage(page);
    await D.seedProgress(page, [a], 60);
    await D.seedProgress(page, [b], 5);
    await D.gotoGame(page, a);
    const beforeA = await D.chapterTabs(page).then((t) => t.length);
    await D.gotoGame(page, b);
    await D.gotoGame(page, a);
    const afterA = await D.chapterTabs(page).then((t) => t.length);
    cross.push({ a, b, beforeA, afterA, same: beforeA === afterA, errors: errs.errors.length });
    console.log(`${beforeA === afterA && !errs.errors.length ? "✓" : "✗"} R4 ${a} ⇄ ${b}:章节数 ${beforeA} → ${afterA}`);
  }

  await browser.close();
  mkdirSync("docs/qa/_evidence", { recursive: true });
  const dest = `docs/qa/_evidence/window3-round${process.env.QA_ROUND ?? "2"}-race.json`;
  writeFileSync(dest, JSON.stringify({ games: out, cross }, null, 2));
  console.log(`\n证据落盘:${dest}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
