/**
 * 窗口 3 · 红线扫描。
 *
 * 两张单子:
 *  1. 血 / 死 / 伤害 / 杀 / 尸 —— 面向孩子的措辞红线;
 *  2. `src/games/copy.test.ts` 里那份 `BRAND_WORDS` 商标黑名单。
 *
 * 只扫**字符串字面量**(玩家有机会看见的那一部分),注释与标识符另算一列,
 * 因为那两处玩家看不见,但值得知道有多少条,免得下一个人以为已经洗干净了。
 *
 * 用法:node scripts/qa-window3/redline.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const GAMES = [
  "duo-rush", "duo-arena", "duo-vs-star", "sling-birds", "candy-swing", "gold-hook",
  "garden-guard", "sprout-defense", "monster-crisis", "shoot-range", "sky-squad",
  "tank-battle", "bomb-buddies", "snow-fight", "bumper-cars", "bowling-lane",
  "ice-fire-forest", "puff-bros", "prince-princess",
];

const KID_WORDS = ["血", "死", "伤害", "杀", "尸"];

/** 从 copy.test.ts 里把商标黑名单原样读出来,不另抄一份免得两边走样 */
function brandWords() {
  const src = readFileSync("src/games/copy.test.ts", "utf8");
  const body = src.slice(src.indexOf("BRAND_WORDS: readonly string[] = ["));
  const arr = body.slice(body.indexOf("[") + 1, body.indexOf("];"));
  return [...arr.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".ts") && !p.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

/** 逐行摘出双引号 / 单引号 / 反引号里的内容 */
function literalsOf(line) {
  return [...line.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`/g)]
    .map((m) => m[1] ?? m[2] ?? m[3] ?? "")
    .filter(Boolean);
}

const BRAND = brandWords();
const report = { kidWordHits: [], brandHits: [], commentHits: [], brandWordCount: BRAND.length, files: 0 };

for (const id of GAMES) {
  for (const file of walk(join("src/games", id))) {
    report.files++;
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      const isComment = trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
      const texts = isComment ? [line] : literalsOf(line);
      for (const t of texts) {
        for (const w of KID_WORDS) {
          if (!t.includes(w)) continue;
          const rec = { game: id, file, line: i + 1, word: w, text: t.trim().slice(0, 120) };
          (isComment ? report.commentHits : report.kidWordHits).push(rec);
        }
        for (const w of BRAND) {
          if (t.toLowerCase().includes(w.toLowerCase())) {
            report.brandHits.push({ game: id, file, line: i + 1, word: w, text: t.trim().slice(0, 120) });
          }
        }
      }
    });
  }
}

mkdirSync("docs/qa/_evidence", { recursive: true });
writeFileSync("docs/qa/_evidence/window3-round3-redline.json", JSON.stringify(report, null, 2));

console.log(`扫了 ${report.files} 个非测试 .ts(本窗 19 款)`);
console.log(`商标黑名单 ${report.brandWordCount} 词 → 命中 ${report.brandHits.length} 条`);
for (const h of report.brandHits) console.log(`   ✗ ${h.file}:${h.line} 「${h.word}」 ${h.text}`);
console.log(`血/死/伤害/杀/尸(字符串字面量)→ 命中 ${report.kidWordHits.length} 条`);
const byGame = new Map();
for (const h of report.kidWordHits) byGame.set(h.game, [...(byGame.get(h.game) ?? []), h]);
for (const [g, hs] of byGame) {
  console.log(`   ${g}(${hs.length} 条)`);
  for (const h of hs) console.log(`      ${h.file.replace(`src/games/${g}/`, "")}:${h.line} 「${h.word}」 ${h.text}`);
}
console.log(`同一批词出现在注释里 ${report.commentHits.length} 条(玩家看不见,只作存档)`);
