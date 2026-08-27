/**
 * 深关走查：第 1 / 100 / 188 关。
 * 做法是把前 N-1 关种成已通关，再从首页进去点「继续 第 N 关」，
 * 这样落点是确定的，不靠翻页碰运气。
 */
import { launch, enterFromHome, sleep, clearStore, seed, bot, settle, fingerprint, clickSel } from "./lib.mjs";
import { GAMES, seedFor, l99Enter } from "./games.mjs";

const ids = (process.argv[2] || "").split(",").filter(Boolean);
const levels = (process.argv[3] || "0,99,187").split(",").map(Number);
const budget = Number(process.argv[4] ?? 90000);
const { browser, page, errors } = await launch();

async function levelLabel(page) {
  return page.evaluate(() => {
    const t =
      document.querySelector(".l99-stagetitle") ??
      document.querySelector(".cs-level") ??
      document.querySelector(".slb-level") ??
      document.querySelector(".l99-continue");
    return (t?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
  });
}

for (const id of ids) {
  const g = GAMES[id];
  if (!g || !g.campaign) continue;
  for (const lv of levels) {
    errors.length = 0;
    await clearStore(page);
    if (lv > 0) await seed(page, seedFor(id, lv));
    await enterFromHome(page, id);
    const before = await levelLabel(page);
    await g.enterCampaign(page);
    await sleep(1000);
    const label = await levelLabel(page);
    const r = await bot(page, { budget, plan: g.plan, fpId: g.fp ? id : null });
    const fp = await fingerprint(page, id);
    const idx = (() => {
      const raw = Object.values(fp.hits)[0] ?? "";
      const m = raw.match(/[-\d,]+/);
      if (!m) return "";
      const arr = m[0].split(",");
      const first = arr.findIndex((v, i) => i >= lv && Number(v) > 0);
      return first >= 0 ? `第${first + 1}关有星` : "";
    })();
    console.log(
      `${id} L${lv + 1}: 地图按钮="${before}" 关内标题="${label}" => ${r.verdict} (${r.ms}ms) ${idx} | ${(r.text || "").slice(0, 110)}`
    );
    if (errors.length) console.log("   ERR", errors.slice(0, 2));
  }
}
await browser.close();
