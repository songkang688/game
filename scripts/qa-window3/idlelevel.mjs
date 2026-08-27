/**
 * 通用「摆烂」探针:进指定款的指定关,一个键都不按,只等结算。
 *
 * `skyidle.mjs` 是 sky-squad 专用的,第 3 轮要把摆烂扫描铺到全窗口,
 * 而有 6 款(sling-birds / shoot-range / sky-squad / snow-fight /
 * bowling-lane / ice-fire-forest)在纯逻辑层没有干净的「完全不动」口子,
 * 只能在真机上量。这一份就干这件事。
 *
 * 用法:node scripts/qa-window3/idlelevel.mjs --games a,b --levels 1,60,133,188 [--wait 45000]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import * as D from "./driver.mjs";

const argv = process.argv.slice(2);
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : d;
};
const GAMES = arg("games", "").split(",").map((s) => s.trim()).filter(Boolean);
const LEVELS = arg("levels", "1,60,133,188").split(",").map(Number);
const WAIT = Number(arg("wait", 45000));
const OUT = arg("out", "docs/qa/_evidence/window3-round3-idlelevel.json");

const main = async () => {
  const { browser, page } = await D.launch();
  const errs = D.collectErrors(page);
  await page.goto(`${D.BASE}/`, { waitUntil: "networkidle0" });
  const rows = [];

  for (const id of GAMES) {
    for (const lv of LEVELS) {
      await D.clearStorage(page);
      await D.seedProgress(page, [id], 188);
      const got = await D.gotoGame(page, id);
      if (got !== "ok") {
        rows.push({ id, level: lv, result: `进不去(${got})` });
        continue;
      }
      await D.enterCampaign(page);
      let opened;
      if (D.CUSTOM_MAP[id]) {
        opened = (await D.openCustomLevel(page, id, lv)) ?? { open: "custom-map-miss" };
      } else {
        if (!(await D.gotoChapterOf(page, lv))) {
          rows.push({ id, level: lv, result: "章节没找到" });
          continue;
        }
        opened = await D.openLevel(page, lv);
      }
      if (opened.open !== "clicked" || opened.stage !== "ok") {
        rows.push({ id, level: lv, result: `打不开:${JSON.stringify(opened)}` });
        continue;
      }
      const t0 = Date.now();
      let res = null;
      while (Date.now() - t0 < WAIT) {
        await D.sleep(700);
        res = await D.readResult(page);
        if (res && (res.kind === "win" || res.kind === "lose")) break;
      }
      const seconds = Math.round((Date.now() - t0) / 1000);
      const row = {
        id, level: lv, seconds,
        result: res?.kind ?? "没结算",
        stars: res?.stars ?? null,
        text: res ? res.text.replace(/\s+/g, " ").slice(0, 100) : "",
      };
      rows.push(row);
      console.log(
        `${id.padEnd(17)} 第${String(lv).padStart(3)}关 摆烂 ${String(seconds).padStart(2)} 秒 → ${row.result}` +
          `${row.stars !== null ? ` (${row.stars} 星)` : ""}${row.text ? ` | ${row.text}` : ""}`
      );
      await D.dismissResult(page);
    }
  }

  console.log(`\nconsole 报错 ${errs.errors.length} 条`);
  mkdirSync("docs/qa/_evidence", { recursive: true });
  writeFileSync(OUT, JSON.stringify({ games: GAMES, levels: LEVELS, waitMs: WAIT, rows, consoleErrors: errs.errors.length }, null, 2));
  console.log(`证据落盘:${OUT}`);
  await browser.close();
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
