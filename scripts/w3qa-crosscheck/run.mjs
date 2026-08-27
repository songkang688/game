/**
 * 窗口3 走查主跑：从首页进入 → 打到真实胜负 → 各模式结算 → 360px。
 * 用法：node .w3qa/run.mjs --games=a,b --level=0 --what=win,lose,modes,narrow
 */
import { launch, enterFromHome, sleep, bot, idle, settle, dismissSettle, overflow360, clearStore, seed, clickSel, clickText } from "./lib.mjs";
import { GAMES, l99Seed, l99GotoLevel } from "./games.mjs";

const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const ids = (arg("games", Object.keys(GAMES).join(",")) || "").split(",").filter(Boolean);
const level = Number(arg("level", "0"));
const what = (arg("what", "win,lose,modes,narrow") || "").split(",");
const budget = Number(arg("budget", "70000"));
const tries = Number(arg("tries", "3"));
const width = Number(arg("width", "900"));

const { browser, page, errors } = await launch({ width, height: width === 360 ? 780 : 1200 });
const out = [];

async function reenter(id, lv) {
  const g = GAMES[id];
  if (lv > 0) await seed(page, l99Seed(id, lv + 1));
  await enterFromHome(page, id);
  if (g.campaign) {
    await g.enterCampaign(page);
    await sleep(500);
    if (lv > 0) {
      const back = await clickText(page, /回地图|选关|🗺️/);
      if (back) await sleep(400);
      const ok = await l99GotoLevel(page, lv);
      if (!ok) return { entered: false, note: `第 ${lv + 1} 关进不去` };
      await sleep(900);
    }
  }
  return { entered: true };
}

for (const id of ids) {
  const g = GAMES[id];
  if (!g) { console.log(`?? 未知 ${id}`); continue; }
  const rec = { id, errors: [], notes: [] };
  errors.length = 0;
  await clearStore(page);

  // ---- 赢一次 ----
  if (what.includes("win") && g.campaign !== false) {
    let got = null;
    for (let t = 0; t < tries && !got; t++) {
      const e = await reenter(id, level);
      if (!e.entered) { rec.notes.push(e.note); break; }
      const r = await bot(page, { budget, plan: g.plan, fpId: g.fp ? id : null });
      if (r.verdict === "win") got = r;
      else if (r.verdict !== "none") rec.notes.push(`第${t + 1}次:${r.verdict}`);
      if (!got && r.verdict === "lose") rec.lose = rec.lose ?? r;
    }
    rec.win = got;
  }

  // ---- 输一次（静置） ----
  if (what.includes("lose") && g.campaign !== false && !rec.lose) {
    const e = await reenter(id, level);
    if (e.entered) {
      const r = await idle(page, 45000);
      if (r.verdict === "lose") rec.lose = r;
      else {
        rec.notes.push(`静置 45s 未判负:${r.verdict}`);
        if (g.losePlan) {
          const e2 = await reenter(id, level);
          if (e2.entered) {
            const r2 = await bot(page, { budget: 60000, plan: g.losePlan });
            if (r2.verdict === "lose") rec.lose = r2;
            else rec.notes.push(`故意送头也没判负:${r2.verdict}`);
          }
        }
      }
    }
  }

  // ---- 各模式打到结算 ----
  if (what.includes("modes")) {
    rec.modes = [];
    for (const m of g.modes ?? []) {
      await clearStore(page);
      await enterFromHome(page, id);
      await m.enter(page);
      await sleep(900);
      const r = await bot(page, { budget, plan: m.plan, fpId: g.fp ? id : null });
      rec.modes.push({ name: m.name, verdict: r.verdict, ms: r.ms, text: (r.text || "").slice(0, 120) });
    }
  }

  // ---- 360px ----
  if (what.includes("narrow")) {
    await page.setViewport({ width: 360, height: 780 });
    await clearStore(page);
    await enterFromHome(page, id);
    if (g.campaign) await g.enterCampaign(page).catch(() => {});
    await sleep(1200);
    rec.narrow = await overflow360(page);
    await page.setViewport({ width, height: 1200 });
  }

  rec.errors = [...new Set(errors)].slice(0, 4);
  out.push(rec);
  console.log(JSON.stringify(rec));
}

await browser.close();
console.log("\n=== 汇总 ===");
for (const r of out) {
  console.log(
    `${r.id}: win=${r.win ? "✓" : "✗"} lose=${r.lose ? "✓" : "✗"} modes=${(r.modes ?? [])
      .map((m) => m.name + ":" + m.verdict)
      .join(" / ")} narrow=${r.narrow ? r.narrow.docOverflow : "-"} err=${r.errors.length} ${r.notes.join(";")}`
  );
}
