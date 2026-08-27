/**
 * 窗口4 · 档B 五款共用的「源码巡检」工具。
 *
 * 本档五款是 `adventure-king` / `mole-pop` / `bubble-pop` / `fruit-slice` / `puzzle-tiles`,
 * 独占范围只有这五个目录,所以共用工具就落在本档第一款(按字母序)的目录下,
 * 其余四款的验收用例 `import` 过来即可,不去动任何窗口 1 的平台文件。
 *
 * 为什么要静态巡检:`vite.config.ts` 里 `test.environment = "node"`,
 * 仓库既有约定(见 `src/ui/a11y.test.ts`)就是「纯逻辑测试 + 源码静态巡检」,
 * 不引 jsdom / happy-dom 之类的新依赖。窄屏样式、监听回收、商标黑名单
 * 这类「玩起来才看得见」的东西,就靠这里把源码读出来逐条核对。
 *
 * 本文件只被 `*.test.ts` 引用,不会被 `import.meta.glob` 收进首页,也不会进任何 chunk。
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** 一个游戏目录里的一份实现源码(不含测试) */
export interface GameSource {
  /** 文件名,例如 `index.ts` */
  name: string;
  /** 全文 */
  text: string;
}

/** 本档五款的目录名 */
export const DOCK_B_GAMES = [
  "adventure-king",
  "mole-pop",
  "bubble-pop",
  "fruit-slice",
  "puzzle-tiles",
] as const;

export type DockBGame = (typeof DOCK_B_GAMES)[number];

function gameDir(game: DockBGame): string {
  return fileURLToPath(new URL(`../${game}/`, import.meta.url));
}

/**
 * 读一个游戏目录下的全部实现源码。
 * 测试文件与本档的验收脚手架(`qa*.ts`)自己就带着黑名单词,巡检时必须排除掉,
 * 否则扫的是「验收工具」而不是「游戏」。
 */
export function readGameSources(game: DockBGame): GameSource[] {
  const dir = gameDir(game);
  return readdirSync(dir)
    .filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts") && !n.startsWith("qa"))
    .sort()
    .map((name) => ({ name, text: readFileSync(dir + name, "utf8") }));
}

/** 只读某一份文件 */
export function readGameFile(game: DockBGame, name: string): string {
  return readFileSync(gameDir(game) + name, "utf8");
}

/** 把整个目录拼成一份大文本,做「全目录找一个词」的粗筛 */
export function joinSources(sources: readonly GameSource[]): string {
  return sources.map((s) => s.text).join("\n");
}

// ---------------------------------------------------------------------------
// 一、商标黑名单
// ---------------------------------------------------------------------------

/** 硬约束里点名的商标 / 官方角色名,一个都不许出现在实现源码里 */
export const TRADEMARK_BLACKLIST: readonly string[] = [
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
  "王者荣耀",
];

/** 命中一条就返回一条「文件 → 词」的记录 */
export function scanTrademarks(sources: readonly GameSource[]): string[] {
  const hits: string[] = [];
  for (const s of sources) {
    const lower = s.text.toLowerCase();
    for (const word of TRADEMARK_BLACKLIST) {
      if (lower.includes(word.toLowerCase())) hits.push(`${s.name} → ${word}`);
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// 二、分级红线:无血、无死亡、失败只鼓励
// ---------------------------------------------------------------------------

/**
 * 分级红线词。
 * 「死」单字太常见(「死局」「死角」是关卡术语),所以这里只挑真正描写伤亡的组合词。
 */
export const RATING_BLACKLIST: readonly string[] = [
  "流血",
  "鲜血",
  "血条",
  "血量",
  "出血",
  "死亡",
  "杀死",
  "打死",
  "尸体",
  "僵尸",
  "残忍",
  "血腥",
];

export function scanRatingWords(sources: readonly GameSource[]): string[] {
  const hits: string[] = [];
  for (const s of sources) {
    for (const word of RATING_BLACKLIST) {
      if (s.text.includes(word)) hits.push(`${s.name} → ${word}`);
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// 三、外部依赖红线:不许 three.js / CDN / Socket
// ---------------------------------------------------------------------------

/** 检出「引入了外部运行时依赖」的证据行 */
export function scanExternalDeps(sources: readonly GameSource[]): string[] {
  const hits: string[] = [];
  const patterns: Array<[string, RegExp]> = [
    ["three.js", /from\s+["']three(?:\/|["'])|require\(["']three["']\)|three\.js/],
    ["CDN 地址", /https?:\/\/(?!www\.w3\.org)/],
    ["WebSocket", /\bnew\s+WebSocket\b|\bsocket\.io\b/i],
    ["fetch 联网", /\bfetch\s*\(/],
    ["XMLHttpRequest", /\bXMLHttpRequest\b/],
  ];
  for (const s of sources) {
    for (const [label, re] of patterns) {
      const lines = s.text.split("\n");
      lines.forEach((line, i) => {
        if (re.test(line)) hits.push(`${s.name}:${i + 1} → ${label} :: ${line.trim().slice(0, 80)}`);
      });
    }
  }
  return hits;
}

/** 音效红线:只允许走 `api.play(...)`,不许自己开 AudioContext / new Audio */
export function scanAudioMisuse(sources: readonly GameSource[]): string[] {
  const hits: string[] = [];
  const re = /\bnew\s+(?:webkit)?AudioContext\b|\bnew\s+Audio\s*\(|\bHTMLAudioElement\b/;
  for (const s of sources) {
    s.text.split("\n").forEach((line, i) => {
      if (re.test(line)) hits.push(`${s.name}:${i + 1} → ${line.trim().slice(0, 80)}`);
    });
  }
  return hits;
}

// ---------------------------------------------------------------------------
// 四、存档 key:只增不改
// ---------------------------------------------------------------------------

/** 抓出源码里出现过的全部 `yiduo-yixing.*` 字面 key(去掉光秃秃的前缀本身) */
export function saveKeysIn(sources: readonly GameSource[]): string[] {
  const found = new Set<string>();
  const re = /yiduo-yixing\.[A-Za-z0-9._-]+/g;
  for (const s of sources) {
    for (const m of s.text.matchAll(re)) {
      const key = m[0];
      if (key !== "yiduo-yixing.") found.add(key);
    }
  }
  return [...found].sort();
}

// ---------------------------------------------------------------------------
// 五、窄屏(360px)巡检
// ---------------------------------------------------------------------------

/** 窄屏基准宽度:剧本点名的 360px */
export const NARROW_WIDTH = 360;

/**
 * 把源码里的内联样式表(模板字符串里的 CSS)抠出来。
 * 判据很粗但够用:一段文本里同时出现 `{` `}` 和 `:` `;`,并且带类选择器。
 */
export function inlineCss(source: GameSource): string {
  const chunks: string[] = [];
  const re = /`([^`]*)`/g;
  for (const m of source.text.matchAll(re)) {
    const body = m[1];
    if (/\.[a-z][\w-]*\s*\{/i.test(body) && body.includes(";")) chunks.push(body);
  }
  return chunks.join("\n");
}

export interface WideRule {
  /** 出问题的声明,例如 `min-width:420px` */
  decl: string;
  /** 声明里的像素值 */
  px: number;
}

/**
 * 找出「在 360px 屏上一定会横向溢出」的固定宽度声明。
 * 只看 `width` / `min-width` / `flex-basis` 这类真的会撑开容器的属性,
 * 不看 `max-width`(那是收窄用的)、也不看 `height`。
 */
export function overflowingRules(css: string, limit: number = NARROW_WIDTH): WideRule[] {
  const out: WideRule[] = [];
  const re = /(?:^|[;{\s])(min-width|width|flex-basis)\s*:\s*(\d+(?:\.\d+)?)px/gi;
  for (const m of css.matchAll(re)) {
    const px = Number(m[2]);
    if (px > limit) out.push({ decl: `${m[1]}:${m[2]}px`, px });
  }
  return out;
}

/** 内联样式表里声明过的窄屏断点(`@media (max-width: N…)`) */
export function narrowBreakpoints(css: string): number[] {
  const out: number[] = [];
  for (const m of css.matchAll(/@media[^{]*max-width\s*:\s*(\d+)px/gi)) out.push(Number(m[1]));
  return out.sort((a, b) => a - b);
}

/** 内联样式表里有没有照顾 `prefers-reduced-motion` */
export function respectsReducedMotion(css: string): boolean {
  return /prefers-reduced-motion/.test(css);
}

// ---------------------------------------------------------------------------
// 六、destroy 回收巡检
// ---------------------------------------------------------------------------

export interface ListenerBalance {
  /** `window.addEventListener("x"` 里出现过的事件名 */
  added: string[];
  /** `window.removeEventListener("x"` 里出现过的事件名 */
  removed: string[];
  /** 加了却没摘的事件名 */
  leaked: string[];
}

/**
 * 挂在 `window` / `document` 上的监听是最容易泄漏的一类:
 * 元素本身随 DOM 一起 remove 掉就没事了,全局监听不摘就会一直堆。
 */
export function globalListenerBalance(source: GameSource): ListenerBalance {
  const grab = (verb: "add" | "remove"): string[] => {
    const re = new RegExp(`\\b(?:window|document|globalThis)\\.${verb}EventListener\\(\\s*["'\`]([\\w-]+)`, "g");
    return [...source.text.matchAll(re)].map((m) => m[1]);
  };
  const added = grab("add");
  const removed = grab("remove");
  const removedSet = new Set(removed);
  const leaked = [...new Set(added)].filter((e) => !removedSet.has(e));
  return { added, removed, leaked };
}

/**
 * 更严的一档:每一条 `window.addEventListener` 的下一行就得把「怎么摘」登记进口袋。
 * 返回没登记的那些行号。
 */
export function globalListenersRegisteredInBag(source: GameSource, bagName = "bag"): string[] {
  const lines = source.text.split("\n");
  const bad: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /\b(?:window|document|globalThis)\.addEventListener\(\s*["'`]([\w-]+)/.exec(lines[i]);
    if (!m) continue;
    const next = lines[i + 1] ?? "";
    const ok = next.includes(`${bagName}.add(`) && next.includes("removeEventListener");
    if (!ok) bad.push(`${source.name}:${i + 1} → ${m[1]}`);
  }
  return bad;
}

/**
 * rAF 有没有配套的取消。
 * 取消可以写在本文件,也可以把帧号交给收尾口袋(`bag.onRaf(...)`)——
 * 后一种要求同一款游戏里确实有个文件负责 `cancelAnimationFrame`。
 */
export function rafBalanced(source: GameSource, siblings: readonly GameSource[] = []): boolean {
  const req = (source.text.match(/requestAnimationFrame\s*\(/g) ?? []).length;
  if (req === 0) return true;
  if (/cancelAnimationFrame\s*\(/.test(source.text)) return true;
  const handed = /\bonRaf\s*\(/.test(source.text);
  return handed && siblings.some((s) => s !== source && /cancelAnimationFrame\s*\(/.test(s.text));
}

/** 每个 `mountXxx` 都得把 destroy 还回来 */
export function mountFunctionsReturnDestroy(source: GameSource): string[] {
  const bad: string[] = [];
  for (const line of source.text.split("\n")) {
    const m = /function\s+(mount[A-Za-z0-9_]*)\s*\(/.exec(line);
    if (m && !/destroy/.test(line)) bad.push(m[1]);
  }
  return bad;
}
