/** 输一次专场：先起个头再撒手 / 故意乱打，取「就差一点点」的证据。 */
import { launch, enterFromHome, sleep, clearStore, warmIdle, bot, fingerprint, drag, holdKey, tap } from "./lib.mjs";
import { GAMES } from "./games.mjs";

const ids = (process.argv[2] || "").split(",").filter(Boolean);
const { browser, page, errors } = await launch();

/** 故意打歪：弹弓往反方向拉（小鸟飞出画面左侧） */
const wastePlan = async (p, i, box) => {
  if (!box) return;
  const sx = box.x + box.w * 0.3;
  const sy = box.y + box.h * 0.5;
  await drag(p, sx, sy, sx + 70, sy - 60, 8, 100);
  await sleep(1800);
};

const SPECIAL = {
  "sling-birds": { plan: wastePlan, budget: 90000 },
  "sky-squad": { plan: async (p) => { await holdKey(p, "w", 900); }, budget: 90000 },
  "candy-swing": {
    plan: async (p, i, box) => {
      if (!box) return;
      const y = box.y + box.h * 0.18;
      await drag(p, box.x + box.w * 0.02, y, box.x + box.w * 0.98, y, 16, 20);
      await sleep(900);
    },
    budget: 60000
  }
};

for (const id of ids) {
  const g = GAMES[id];
  errors.length = 0;
  await clearStore(page);
  await enterFromHome(page, id);
  if (g.campaign) await g.enterCampaign(page);
  else if (g.modes?.[0]) await g.modes[0].enter(page);
  await sleep(900);
  const sp = SPECIAL[id];
  const r = sp
    ? await bot(page, { budget: sp.budget, plan: sp.plan })
    : await warmIdle(page, g.plan, { warm: 5000, budget: 80000 });
  console.log(`${id} => ${r.verdict} (${r.ms}ms) ${(r.text || "").slice(0, 170)}`);
  if (errors.length) console.log("   ERR", errors.slice(0, 2));
}
await browser.close();
