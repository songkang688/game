/**
 * 窗口 1 · 第 3 轮收官 · 出货红线静态审计。
 *
 * 前两轮的取证都在真浏览器里跑（进得去、玩得赢、不泄漏）。这一份补的是另一半:
 * **不需要开浏览器、但一旦破了就不能发布**的那几条硬约束，一次性全扫一遍，
 * 免得收官结论只靠「我记得当时是绿的」。
 *
 * 扫七类:
 *   1. 商标黑名单（主管清单 29 个词，面向孩子的文案和代码注释都不许有）;
 *   2. 离线可玩（禁 three.js、禁 CDN 字体 / 外链音源 / 统计 SDK、禁 Socket、禁 fetch 外网）;
 *   3. 无血无死亡（失败文案只鼓励）;
 *   4. 目录约定（meta.ts 纯数据不 import 玩法；index.ts 顶部 re-export meta、导出 mount）;
 *   5. meta 三问答得上（modes / platform / levels 都填了，值在合法集合里）;
 *   6. destroy 拆干净（监听 / timer / rAF 各自有对应的清理）;
 *   7. 每款单测数 ≥ 15。
 *
 * 跑法: node scripts/qa-1.2-window1-r3-redline.mjs
 * 退出码非 0 就是有红线破了，不许发布。
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const GAMES_DIR = join(ROOT, "src", "games");

const WINDOW1 = [
  "orb-arena",
  "snake-royale",
  "block-drop",
  "combo-clash",
  "mahjong-bloom",
  "star-estate",
  "hero-cards",
  "weiqi-garden",
  "flight-chess",
  "merge-2048",
  "mine-garden",
  "sudoku-petal"
];

/** 第 1 步平台档做的公共文件，也算窗口 1 的出货面 */
const PLATFORM_FILES = [
  "src/ui/root12Contract.ts",
  "src/ui/rootGate.ts",
  "src/ui/homeFilters.ts",
  "src/ui/mobileText.ts",
  "src/ui/home.ts",
  "src/engine/playModes.ts",
  "src/engine/view25d.ts"
];

/** 主管红线里点名的商标黑名单，一个字不改地抄下来 */
const TRADEMARKS = [
  "愤怒的小鸟",
  "植物大战僵尸",
  "水果忍者",
  "地铁跑酷",
  "森林冰火人",
  "屁王兄弟",
  "拳皇",
  "街霸",
  "超级玛丽",
  "马里奥",
  "割绳子",
  "俄罗斯方块",
  "Tetris",
  "贪吃蛇大作战",
  "球球大作战",
  "我的世界",
  "Minecraft",
  "三国杀",
  "大富翁",
  "斗地主",
  "Pac-Man",
  "吃豆人",
  "宝可梦",
  "皮卡丘",
  "奥特曼",
  "喜羊羊",
  "蛋仔",
  "原神",
  "王者荣耀"
];

/**
 * 无血无死亡:面向孩子的字符串里不许出现。
 * `before` 是「跟在这些字后面就不算」的白名单 —— 中文里「锁死了」「卡死了」讲的是卡住,不是死亡。
 */
const GORE = [
  { word: "死亡", before: /[没不无]$/ },
  { word: "死了", before: /[锁卡困僵冻堵憋累笑]$/ },
  { word: "杀死", before: null },
  { word: "血腥", before: null },
  { word: "流血", before: /[没不无]$/ },
  { word: "尸体", before: null },
  { word: "残杀", before: null },
  { word: "毙", before: null }
];

/** 「不写死亡与流血」这种自我约束的说明句,不该被当成命中 */
const NEGATED = /[没不无未别勿禁][有写说提出现许]?[^。;；\n]{0,12}$/;

/**
 * 测试文件里的商标是**扫描器自己的语料**:黑名单数组、`expect(...).not.toContain("拳皇")`
 * 这类断言。这些行不算命中,否则「写了商标扫描」反而会被商标扫描判红。
 * 出货代码（非 `.test.ts`）不吃这一套豁免,一个词都不许有。
 */
const SCANNER_LINE =
  /expect\s*\(|not\.to|toContain|toMatch|includes\s*\(|for\s*\(\s*const\s+\w+\s+of\s*\[|^\s*["'][^"']*["']\s*,?\s*$/;

const rows = [];
let bad = 0;
function log(area, ok, what, extra = "") {
  rows.push({ area, ok, what });
  if (!ok) bad++;
  console.log(`${ok ? "  ok  " : " FAIL "} [${area}] ${what}${extra ? ` — ${extra}` : ""}`);
}

const read = (p) => {
  try {
    return readFileSync(join(ROOT, p), "utf8");
  } catch {
    return null;
  }
};

/** 一款游戏目录下所有 .ts（含测试） */
function filesOf(id) {
  const dir = join(GAMES_DIR, id);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => ({ rel: `src/games/${id}/${f}`, abs: join(dir, f) }));
}

const ALL = [];
for (const id of WINDOW1) for (const f of filesOf(id)) ALL.push({ ...f, game: id });
for (const rel of PLATFORM_FILES) {
  const src = read(rel);
  if (src === null) {
    log("目录", false, `平台文件不见了: ${rel}`);
    continue;
  }
  ALL.push({ rel, abs: join(ROOT, rel), game: "platform" });
}
const SRC = new Map(ALL.map((f) => [f.rel, readFileSync(f.abs, "utf8")]));
/** 出货代码（不含测试），面向孩子的文案都在这里 */
const SHIP = [...SRC].filter(([rel]) => !rel.endsWith(".test.ts"));

// ── 1. 商标 ──────────────────────────────────────────────────────────────
{
  const hits = [];
  for (const [rel, src] of SRC) {
    const isTest = rel.endsWith(".test.ts");
    for (const [i, line] of src.split("\n").entries()) {
      if (isTest && SCANNER_LINE.test(line)) continue;
      for (const word of TRADEMARKS) {
        if (line.toLowerCase().includes(word.toLowerCase())) hits.push(`${rel}:${i + 1} ${word}`);
      }
    }
  }
  log("商标", hits.length === 0, `${TRADEMARKS.length} 个黑名单词 × ${SRC.size} 个文件`, hits.join(" / "));
}

// ── 2. 离线可玩 ───────────────────────────────────────────────────────────
{
  const checks = [
    { name: "three.js", re: /\bfrom\s+["']three|require\(["']three["']\)|THREE\./ },
    { name: "外链（http/https 绝对地址）", re: /["'`]https?:\/\/(?!www\.w3\.org)/ },
    { name: "Socket / 实时联网", re: /\bnew\s+WebSocket\b|\bio\(|socket\.io|EventSource\b|\bRTCPeerConnection\b/ },
    { name: "统计 SDK", re: /\bgtag\(|dataLayer|_hmt|google-analytics|sentry|umami|\bmixpanel\b/i },
    { name: "远端请求", re: /\bfetch\(\s*["'`]https?:|XMLHttpRequest|navigator\.sendBeacon/ },
    { name: "CDN 字体", re: /@import\s+url\(|fonts\.googleapis|@font-face[^}]*url\(\s*["']?https?:/ }
  ];
  for (const c of checks) {
    const hits = SHIP.filter(([, src]) => c.re.test(src)).map(([rel]) => rel);
    log("离线", hits.length === 0, `没有 ${c.name}`, hits.join(" / "));
  }
  // styles.css 里窗口 1 追加的那一段也扫一遍外链
  const css = read("src/styles.css") ?? "";
  log("离线", !/url\(\s*["']?https?:/.test(css), "styles.css 里没有外链资源");
}

// ── 3. 无血无死亡 ─────────────────────────────────────────────────────────
{
  const hits = [];
  for (const [rel, src] of SHIP) {
    for (const { word, before } of GORE) {
      for (const m of src.matchAll(new RegExp(word, "g"))) {
        const lead = src.slice(Math.max(0, m.index - 24), m.index);
        if (before?.test(lead)) continue; // 「锁死了」这种,讲的是卡住不是死亡
        if (NEGATED.test(lead)) continue; // 「全程没有死亡与流血的说法」这种自我约束句
        hits.push(`${rel}: ${word}（${src.slice(Math.max(0, m.index - 12), m.index + 8).replace(/\n/g, " ")}）`);
      }
    }
  }
  log("内容", hits.length === 0, `${GORE.length} 个血腥 / 死亡词 × ${SHIP.length} 个出货文件`, hits.join(" / "));
}

// ── 4. 目录约定 ───────────────────────────────────────────────────────────
{
  const metaImpure = [];
  const badIndex = [];
  for (const id of WINDOW1) {
    const meta = SRC.get(`src/games/${id}/meta.ts`);
    const index = SRC.get(`src/games/${id}/index.ts`);
    if (!meta) metaImpure.push(`${id} 没有 meta.ts`);
    else if (/^\s*import\s/m.test(meta)) metaImpure.push(`${id} 的 meta.ts import 了东西`);
    if (!index) badIndex.push(`${id} 没有 index.ts`);
    else {
      // 两种写法都算:`export { meta } from "./meta"`，或先 import 再 `export { meta }`
      const head = index.slice(0, 400);
      const reExport =
        /export\s*\{\s*meta\s*\}\s*from\s+["']\.\/meta["']/.test(head) ||
        (/import\s*\{[^}]*\bmeta\b[^}]*\}\s*from\s+["']\.\/meta["']/.test(head) &&
          /export\s*\{[^}]*\bmeta\b[^}]*\}/.test(head));
      if (!reExport) badIndex.push(`${id} 顶部没有 re-export meta`);
      if (!/export\s+function\s+mount\s*\(/.test(index)) badIndex.push(`${id} 没导出 mount`);
    }
  }
  log("目录", metaImpure.length === 0, "12 款的 meta.ts 都是纯数据、不 import 玩法", metaImpure.join(" / "));
  log("目录", badIndex.length === 0, "12 款的 index.ts 都 re-export meta 并导出 mount", badIndex.join(" / "));
}

// ── 5. meta 三问 ──────────────────────────────────────────────────────────
{
  const MODES = ["campaign", "versus", "endless", "twoPlayer", "coop", "quiz", "free"];
  const PLATFORMS = ["both", "mobile", "desktop"];
  const problems = [];
  const table = [];
  for (const id of WINDOW1) {
    const meta = SRC.get(`src/games/${id}/meta.ts`) ?? "";
    const modes = [...(meta.match(/modes\s*:\s*\[([^\]]*)\]/)?.[1] ?? "").matchAll(/["'](\w+)["']/g)].map((m) => m[1]);
    const platform = /platform\s*:\s*["'](\w+)["']/.exec(meta)?.[1];
    const levels = /levels\s*:\s*(\d+)/.exec(meta)?.[1];
    if (modes.length === 0) problems.push(`${id} 没填 modes`);
    for (const m of modes) if (!MODES.includes(m)) problems.push(`${id} 的 modes 有生词 ${m}`);
    if (!platform) problems.push(`${id} 没填 platform`);
    else if (!PLATFORMS.includes(platform)) problems.push(`${id} 的 platform 是生词 ${platform}`);
    if (modes.includes("campaign") && levels !== "188") problems.push(`${id} 有战役却不是 188 关`);
    table.push(`${id}=${modes.join("+")}/${platform}`);
  }
  log("meta", problems.length === 0, "12 款的模式 / 设备 / 关卡数都填准了", problems.join(" / "));
  console.log(`        ${table.join("  ")}`);
}

// ── 6. destroy 拆干净 ─────────────────────────────────────────────────────
{
  const problems = [];
  for (const id of WINDOW1) {
    const src = SRC.get(`src/games/${id}/index.ts`) ?? "";
    if (!/destroy\s*[(:]/.test(src)) {
      problems.push(`${id} 没有 destroy`);
      continue;
    }
    const pairs = [
      ["addEventListener", "removeEventListener"],
      ["setInterval", "clearInterval"],
      ["requestAnimationFrame", "cancelAnimationFrame"],
      ["setTimeout", "clearTimeout"]
    ];
    for (const [on, off] of pairs) {
      if (src.includes(on) && !src.includes(off)) problems.push(`${id} 用了 ${on} 却没有 ${off}`);
    }
    if (/new\s+AudioContext|webkitAudioContext/.test(src) && !/\.close\(\)/.test(src)) {
      problems.push(`${id} 自建了 AudioContext 却没 close`);
    }
  }
  log("destroy", problems.length === 0, "12 款都有 destroy，开了什么就关什么", problems.join(" / "));
}

// ── 7. 单测数 ─────────────────────────────────────────────────────────────
{
  const short = [];
  const counts = [];
  for (const id of WINDOW1) {
    let n = 0;
    for (const f of filesOf(id)) {
      if (!f.rel.endsWith(".test.ts")) continue;
      const src = SRC.get(f.rel) ?? readFileSync(f.abs, "utf8");
      n += [...src.matchAll(/^\s*it(?:\.\w+)?\s*\(/gm)].length;
    }
    counts.push(`${id}=${n}`);
    if (n < 15) short.push(`${id} 只有 ${n} 例`);
  }
  log("单测", short.length === 0, "12 款每款 ≥ 15 例", short.join(" / "));
  console.log(`        ${counts.join("  ")}`);
}

// ── 8. api.play 之外不许自己发声 ───────────────────────────────────────────
{
  const hits = [];
  for (const [rel, src] of SHIP) {
    if (!rel.startsWith("src/games/")) continue;
    if (/new\s+Audio\(|new\s+(?:webkit)?AudioContext\(/.test(src)) hits.push(rel);
  }
  log("音效", hits.length === 0, "12 款只走 api.play(...)，没有自己 new Audio", hits.join(" / "));
}

console.log(
  `\n窗口 1 · 第 3 轮红线审计: ${rows.filter((r) => r.ok).length}/${rows.length} 通过` +
    (bad ? `，${bad} 条红线破了` : "，全部通过")
);
process.exit(bad ? 1 : 0);
