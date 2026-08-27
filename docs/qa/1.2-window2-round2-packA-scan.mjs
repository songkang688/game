#!/usr/bin/env node
/**
 * 一朵一星 · 窗口 2 第 2 轮验收 · 测试员包 A 的只读走查脚本。
 *
 * 只读文件、只打印结论，不改任何东西，也不参与 `npm test`（vitest 只收 `src/**\/*.test.ts`）。
 * 覆盖两条不需要跑游戏就能取证的铁则：
 *   铁则 1  从首页 / 深链 `#/game/<id>` 定位得到这 5 款；
 *   铁则 7  商标黑名单 24 词 0 命中。
 *
 * 用法：node docs/qa/1.2-window2-round2-packA-scan.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const PACK_A = ["dot-maze", "fruit-stack", "pool-stars", "junqi-camp", "chess-garden"];

const TRADEMARKS = [
  "愤怒的小鸟", "植物大战僵尸", "水果忍者", "地铁跑酷", "森林冰火人", "屁王兄弟",
  "拳皇", "街霸", "超级玛丽", "马里奥", "割绳子", "Tetris", "我的世界", "Minecraft",
  "斗地主", "Pac-Man", "吃豆人", "宝可梦", "皮卡丘", "奥特曼", "喜羊羊", "蛋仔",
  "原神", "王者荣耀",
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

let bad = 0;

/* ---------------- 铁则 1：首页收录 + 深链解析 ---------------- */

console.log("## 铁则 1 · 首页 / 深链");

// 首页靠 loader.ts 的 import.meta.glob("../games/*/meta.ts") eager 收集，
// 所以「目录里有 meta.ts + index.ts」就等于「首页有卡片」。
const routeRe = /\/\^#\\?\/\?game\\?\/\(\.\+\)\$\//;
const appSrc = readFileSync("src/ui/app.ts", "utf8");
const hasRoute = /#\\?\/\?game\\\/\(\.\+\)\$/.test(appSrc) || appSrc.includes("^#\\/?game\\/(.+)$");
console.log(`- app.ts 里 hash 路由正则${hasRoute ? "在" : "**找不到**"}：${(appSrc.match(/location\.hash\.match\(([^)]*)\)/) ?? ["(没读到)"])[0]}`);
if (!hasRoute) bad++;

const loaderSrc = readFileSync("src/engine/loader.ts", "utf8");
const eager = loaderSrc.includes('import.meta.glob("../games/*/meta.ts"');
console.log(`- loader.ts eager 收集 meta.ts：${eager ? "在" : "**没有**"}`);
if (!eager) bad++;

for (const id of PACK_A) {
  const metaSrc = readFileSync(`src/games/${id}/meta.ts`, "utf8");
  const declared = (metaSrc.match(/id:\s*"([^"]+)"/) ?? [])[1];
  const modes = (metaSrc.match(/modes:\s*\[([^\]]*)\]/) ?? [])[1] ?? "";
  const levels = (metaSrc.match(/levels:\s*(\d+)/) ?? [])[1] ?? "-";
  const okId = declared === id;
  const okImpl = readdirSync(`src/games/${id}`).includes("index.ts");
  // 深链要能落到这个 id 上
  const deep = `#/game/${id}`;
  const m = deep.match(/^#\/?game\/(.+)$/);
  const okDeep = m && m[1] === id;
  console.log(
    `- ${id.padEnd(13)} meta.id=${okId ? "✅" : "❌"} index.ts=${okImpl ? "✅" : "❌"} 深链 ${deep} → ${okDeep ? "✅" : "❌"} ` +
      `modes=[${modes.replace(/\s+/g, " ").trim()}] levels=${levels}`
  );
  if (!okId || !okImpl || !okDeep) bad++;
}

/* ---------------- 铁则 7：商标黑名单 ---------------- */

// 会上屏的只有产品代码；`*.test.ts` 里的命中全是各款自己的「禁用词表」，单列不计数。
console.log("\n## 铁则 7 · 商标黑名单（24 词）");
let hits = 0;
let files = 0;
let selfChecks = 0;
for (const id of PACK_A) {
  const perGame = [];
  let inTests = 0;
  for (const f of walk(`src/games/${id}`)) {
    if (!/\.(ts|json|css|svg|md)$/.test(f)) continue;
    const isTest = /\.test\.ts$/.test(f);
    if (!isTest) files++;
    const text = readFileSync(f, "utf8");
    for (const word of TRADEMARKS) {
      if (!text.includes(word)) continue;
      if (isTest) inTests++;
      else perGame.push(`${f} → ${word}`);
    }
  }
  hits += perGame.length;
  selfChecks += inTests;
  console.log(
    `- ${id.padEnd(13)} 产品代码 ${perGame.length === 0 ? "0 命中 ✅" : `**${perGame.length} 命中**\n    ` + perGame.join("\n    ")}` +
      `（自查词表里另有 ${inTests} 处，是各款自己的黑名单常量，不算命中）`
  );
}
console.log(`共扫 ${files} 个产品文件，上屏文案命中合计 ${hits}；自查词表 ${selfChecks} 处。`);
if (hits > 0) bad++;

console.log(`\n结论：${bad === 0 ? "两条铁则全通过。" : `**有 ${bad} 处需要看**。`}`);
process.exit(0);
