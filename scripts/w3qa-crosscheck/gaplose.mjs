/** 补输：对还没拿到「输」证据的几款单独设计输法。 */
import { launch, enterFromHome, sleep, clearStore, warmIdle, bot, fingerprint, drag, tap, clickText, holdKey } from "./lib.mjs";
import { GAMES } from "./games.mjs";

const ids = (process.argv[2] || "").split(",").filter(Boolean);
const { browser, page, errors } = await launch();

const SPECIAL = {
  // 竞速：只按刹车不按跑，撞满 3 次就判负
  "duo-rush": {
    enter: async (p) => { await clickText(p, /双人同屏|无尽对战/); },
    plan: async (p, i) => { await holdKey(p, i % 2 ? "s" : "ArrowDown", 500); },
    budget: 120000
  },
  // 切糖：只在最上沿横切，切不到糖果，回合结束就判负
  "candy-swing": {
    plan: async (p, i, box) => {
      if (!box) return;
      const y = box.y + box.h * 0.08;
      await drag(p, box.x + box.w * 0.02, y, box.x + box.w * 0.98, y, 14, 18);
      await sleep(1200);
    },
    budget: 150000
  },
  // 塔防：一棵塔都不种，只在空白处点，元气罐被抢光判负
  "garden-guard": { plan: async (p, i, box) => { if (box) await tap(p, box.x + box.w * 0.5, box.y + box.h * 0.02); }, budget: 200000 },
  "sprout-defense": { plan: async (p, i, box) => { if (box) await tap(p, box.x + box.w * 0.5, box.y + box.h * 0.02); }, budget: 200000 }
};

for (const id of ids) {
  const g = GAMES[id];
  errors.length = 0;
  await clearStore(page);
  await enterFromHome(page, id);
  const sp = SPECIAL[id];
  if (sp?.enter) await sp.enter(page);
  else if (g.campaign) await g.enterCampaign(page);
  else if (g.modes?.[0]) await g.modes[0].enter(page);
  await sleep(1000);
  const r = sp
    ? await bot(page, { budget: sp.budget, plan: sp.plan, fpId: g.fp ? id : null })
    : await warmIdle(page, g.plan, { warm: 6000, budget: 180000 });
  const fp = await fingerprint(page, id);
  console.log(`${id} => ${r.verdict} (${r.ms}ms) ${(r.text || "").slice(0, 180)}`);
  console.log(`   fp ${JSON.stringify(fp).slice(0, 180)} err ${errors.length}`);
}
await browser.close();
console.log("DONE");
