/**
 * 独立复核「摆烂通关」：进关之后一个键都不按、一下都不点，只等。
 * 用的是本测试员自己那套驱动（从首页 .game-card 点进去），
 * 跟 scripts/qa-window3 那套完全独立，专门用来交叉验证 B1/B2/B3/S5。
 */
import { launch, enterFromHome, sleep, clearStore, seed, settle } from "./lib.mjs";
import { GAMES, seedFor } from "./games.mjs";

const ids = (process.argv[2] || "").split(",").filter(Boolean);
const levels = (process.argv[3] || "1").split(",").map(Number);
const budget = Number(process.argv[4] ?? 60000);
const { browser, page, errors } = await launch();

async function levelLabel(p) {
  return p.evaluate(() => {
    const t = document.querySelector(".l99-stagetitle") ?? document.querySelector(".cs-level");
    return (t?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
  });
}

for (const id of ids) {
  const g = GAMES[id];
  if (!g) { console.log(`${id}: 没配`); continue; }
  for (const lv of levels) {
    errors.length = 0;
    await clearStore(page);
    if (lv > 1) await seed(page, seedFor(id, lv - 1));
    await enterFromHome(page, id);
    if (g.campaign) await g.enterCampaign(page);
    else if (g.modes?.[0]) await g.modes[0].enter(page);
    await sleep(1200);
    const label = await levelLabel(page);

    // 从这里开始：一个键不按、一下不点，只轮询结算。
    const t0 = Date.now();
    let r = null;
    while (Date.now() - t0 < budget) {
      const s = await settle(page);
      if (s && s.verdict !== "none") { r = s; break; }
      await sleep(400);
    }
    const ms = Date.now() - t0;
    const stars = r ? ((r.text || "").match(/★+/) || [""])[0].length : 0;
    console.log(
      `${id} L${lv} [${label}] 摆烂 ${(ms / 1000).toFixed(1)}s => ${r ? r.verdict : "none"}` +
      (stars ? ` ${stars}星` : "") + ` | ${(r?.text || "").slice(0, 120)}`
    );
    if (errors.length) console.log("   ERR", errors.slice(0, 2));
  }
}
await browser.close();
console.log("DONE");
