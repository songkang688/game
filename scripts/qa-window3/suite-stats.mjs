/**
 * 窗口 3 验收 · 把 vitest 的 JSON 报告切成「本窗 19 款各自多少文件 / 多少用例 / 有没有红」,
 * 并挑出与「胜 / 负 / 无尽 / 难度曲线」直接相关的用例名,当作报告里的取证索引。
 *
 * 用法:npx vitest run --reporter=json --outputFile=/tmp/vitest.json
 *      node scripts/qa-window3/suite-stats.mjs /tmp/vitest.json 1
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const src = process.argv[2] ?? "/tmp/vitest.json";
const round = process.argv[3] ?? "1";
const IDS = [
  "duo-rush", "duo-arena", "duo-vs-star", "sling-birds", "candy-swing", "gold-hook",
  "garden-guard", "sprout-defense", "monster-crisis", "shoot-range", "sky-squad", "tank-battle",
  "bomb-buddies", "snow-fight", "bumper-cars", "bowling-lane", "ice-fire-forest", "puff-bros",
  "prince-princess",
];
const KEY_RE = /赢|胜|输|败|通关|打不过|摆烂|必输|无尽|越来越难|难度|曲线|单调|结算|188|第 ?188|存档|纪录|最好成绩/;

const raw = JSON.parse(readFileSync(src, "utf8"));
const suites = raw.testResults ?? [];

const total = { files: suites.length, tests: 0, failed: 0 };
const per = {};
for (const id of IDS) per[id] = { files: 0, tests: 0, failed: 0, keyTests: [], failedTests: [] };

for (const s of suites) {
  const name = (s.name ?? "").replace(/\\/g, "/");
  const m = name.match(/src\/games\/([^/]+)\//);
  const gid = m && IDS.includes(m[1]) ? m[1] : null;
  const cases = s.assertionResults ?? [];
  total.tests += cases.length;
  const failedHere = cases.filter((c) => c.status === "failed");
  total.failed += failedHere.length;
  if (!gid) continue;
  per[gid].files++;
  per[gid].tests += cases.length;
  per[gid].failed += failedHere.length;
  for (const c of cases) {
    const title = [...(c.ancestorTitles ?? []), c.title].join(" › ");
    if (c.status === "failed") per[gid].failedTests.push(title);
    else if (KEY_RE.test(title) && per[gid].keyTests.length < 14) per[gid].keyTests.push(title);
  }
}

const windowTotals = IDS.reduce(
  (a, id) => ({ files: a.files + per[id].files, tests: a.tests + per[id].tests, failed: a.failed + per[id].failed }),
  { files: 0, tests: 0, failed: 0 }
);

console.log(`全库:${total.files} 个测试文件 / ${total.tests} 条用例,失败 ${total.failed}`);
console.log(`本窗 19 款:${windowTotals.files} 个文件 / ${windowTotals.tests} 条用例,失败 ${windowTotals.failed}`);
console.log("");
for (const id of IDS) {
  const p = per[id];
  console.log(`${id.padEnd(17)} 文件 ${String(p.files).padStart(2)} · 用例 ${String(p.tests).padStart(4)} · 失败 ${p.failed}`);
  if (p.failedTests.length) for (const t of p.failedTests.slice(0, 5)) console.log(`    ✗ ${t}`);
}

mkdirSync("docs/qa/_evidence", { recursive: true });
const out = `docs/qa/_evidence/window3-round${round}-suite.json`;
writeFileSync(out, JSON.stringify({ total, windowTotals, per }, null, 2));
console.log(`\n证据落盘:${out}`);
