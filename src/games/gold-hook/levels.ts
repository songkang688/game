/**
 * 金矿钩钩 · 188 关矿脉表 + 无尽矿井。
 *
 * 这一份只吐数据,不画一个像素:
 *  - `CHAPTERS`:8 个主题章节,大小之和恰好 188;
 *  - `levelAt(i)`:第 i 关的矿洞(埋点、摆速、绳长、限时)与目标金额;
 *  - `endlessLayer(n)`:无尽模式往下第 n 层。
 *
 * 埋点是用 `mulberry32(seed)` 摆出来的,同一关每次进去布局完全一样。
 * 摆放时有一条硬规矩:**每颗矿石各占一条互不重叠的「扇面车道」**,
 * 也就是从悬挂点看过去,任意两颗的角度区间都不叠。这样「瞄准哪颗就钩到哪颗」,
 * 不会出现「想钩后面的钻石,结果被前面的石头挡下来」的冤枉事,
 * 模拟器算出来的时间也就和真实玩法对得上。
 *
 * 目标金额不是拍脑袋定的:先让贪心模拟器把这一关跑一遍,拿它能挖到的钱
 * 乘一个逐关抬升的难度系数(0.42 → 0.72)。所以「目标一定拿得到」是构造出来的。
 */
import { mulberry32, type Chapter } from "../level99";
import {
  DIG_BOTTOM,
  DIG_TOP,
  FIELD_W,
  ORES,
  PIVOT_X,
  PIVOT_Y,
  WALL,
  freeGaps,
  simulateRun,
  type MineField,
  type Ore,
  type OreKind,
  type Span,
} from "./logic";

export const CHAPTERS: Chapter[] = [
  { name: "浅层矿洞", emoji: "🪨", color: "#FFEFD6", desc: "第一铲:看准钩子摆到哪儿再放绳,先把金粒和金块钩上来", size: 24 },
  { name: "潮汐溶洞", emoji: "💧", color: "#DFF3FA", desc: "洞里开始有大石头,钩错了要拉好一会儿,学会绕开它", size: 24 },
  { name: "深海矿脉", emoji: "🌊", color: "#DCE9FB", desc: "钻石登场:又轻又值钱,是这一章最该抢的东西", size: 24 },
  { name: "熔岩矿坑", emoji: "🔥", color: "#FFE2D2", desc: "巨型金块沉得吓人,炸药和力量水该派上用场了", size: 23 },
  { name: "冰晶矿窟", emoji: "❄️", color: "#E3F6F8", desc: "宝箱藏在冰里,值多少要开了才知道,是这一章的赌一把", size: 23 },
  { name: "水晶回廊", emoji: "💎", color: "#EDE4FB", desc: "满墙钻石,但钩子摆得又快又宽,考的是出手时机", size: 23 },
  { name: "云顶浮矿", emoji: "☁️", color: "#EAF1FF", desc: "小地鼠抱着金子左右乱窜,得算提前量才钩得中", size: 24 },
  { name: "星空矿场", emoji: "🌌", color: "#E6E2F7", desc: "最深的一层,什么都有,金币目标也最高", size: 23 },
];

/** 战役总关数,和框架的 188 对齐 */
export const TOTAL = 188;

/** 每一章的矿石配方:抽签袋,权重越大越常出现 */
const MIX: Array<Array<[OreKind, number]>> = [
  [["nugget", 6], ["goldSmall", 4], ["pebble", 2]],
  [["nugget", 5], ["goldSmall", 5], ["goldBig", 2], ["pebble", 3], ["boulder", 1]],
  [["nugget", 4], ["goldSmall", 5], ["goldBig", 3], ["gem", 2], ["pebble", 3], ["boulder", 2]],
  [["nugget", 3], ["goldSmall", 4], ["goldBig", 4], ["goldHuge", 2], ["gem", 2], ["pebble", 3], ["boulder", 3]],
  [["nugget", 3], ["goldSmall", 4], ["goldBig", 4], ["goldHuge", 2], ["gem", 2], ["chest", 3], ["pebble", 3], ["boulder", 2]],
  [["nugget", 2], ["goldSmall", 3], ["goldBig", 4], ["goldHuge", 2], ["gem", 5], ["chest", 3], ["pebble", 3], ["boulder", 2]],
  // 1.2 起,最后两章开始掺 1.2 的新矿(泥泥矿会打滑、双层晶要连钩两次)。
  // 前六章的抽签袋一个字都没动 —— 老存档里的关卡不能变样。
  [["nugget", 3], ["goldSmall", 3], ["goldBig", 4], ["goldHuge", 3], ["gem", 4], ["chest", 3], ["pebble", 3], ["boulder", 3], ["muddy", 3]],
  [["nugget", 2], ["goldSmall", 3], ["goldBig", 4], ["goldHuge", 4], ["gem", 5], ["chest", 4], ["pebble", 4], ["boulder", 4], ["muddy", 3], ["twinCrystal", 2]],
];

/** 第几章开始有会跑的小地鼠 */
const MOLE_FROM = 6;

const CHAPTER_HINTS = [
  "钩子会自己来回摆,按一下「放绳」它就顺着当前角度冲出去。",
  "大石头又重又不值钱,拉一次能耗掉小半关时间,看清了再放绳。",
  "钻石只有两分重,拉起来几乎不费时间,看见就先钩它。",
  "巨型金块很值钱但特别沉,先喝瓶力量水再动手会划算得多。",
  "宝箱开出来多少是随机的,时间紧的时候别把宝押在它身上。",
  "摆得越快,能瞄准的窗口越短,提前半拍按下去正好。",
  "小地鼠一直左右跑,朝它「要去的地方」放绳,别朝它现在的位置。",
  "最后一章按性价比排队:先钩又轻又值钱的,沉家伙留到有力量水再说。",
];

// ---------------------------------------------------------------------------
// 章节工具
// ---------------------------------------------------------------------------

export function chapterOfLevel(index: number): number {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    acc += CHAPTERS[i].size;
    if (index < acc) return i;
  }
  return CHAPTERS.length - 1;
}

/** 章节 ci 的第一关(0 基) */
export function chapterStartOf(ci: number): number {
  let acc = 0;
  for (let i = 0; i < ci; i++) acc += CHAPTERS[i].size;
  return acc;
}

/** 0..1 的整体进度,用来把各项难度参数线性抬上去 */
export function difficultyRamp(index: number): number {
  return Math.max(0, Math.min(1, index / (TOTAL - 1)));
}

// ---------------------------------------------------------------------------
// 矿洞生成
// ---------------------------------------------------------------------------

interface FieldSpec {
  seed: number;
  /** 想埋几颗(挤不下就少埋几颗,不会硬塞) */
  count: number;
  /** 抽签袋 */
  bag: Array<[OreKind, number]>;
  /** 至少要有几只地鼠 */
  moles: number;
  swingSpeed: number;
  swingSpan: number;
  phase: number;
  ropeMax: number;
  /**
   * 给多少时间,按「把这个洞里的矿全钩上来要多久」的比例算。
   * 1 就是够你一颗不落地清空,0.6 就是只够挑六成 —— 挑哪几颗才是这游戏的正题,
   * 所以战役后期这个数会一路往下压。
   */
  timeFactor: number;
}

function drawKind(bag: Array<[OreKind, number]>, rand: () => number): OreKind {
  let total = 0;
  for (const [, w] of bag) total += w;
  let r = rand() * total;
  for (const [kind, w] of bag) {
    r -= w;
    if (r <= 0) return kind;
  }
  return bag[bag.length - 1][0];
}

function makeOre(id: number, kind: OreKind, x: number, y: number, rand: () => number, run: number): Ore {
  const p = ORES[kind];
  // 宝箱值多少要开了才知道:60..320 之间按种子摇一个,摇出来就固定住
  const value = kind === "chest" ? 60 + Math.round(rand() * 260) : p.value;
  return {
    id,
    kind,
    x,
    y,
    value,
    weight: p.weight,
    radius: p.radius,
    runRange: run,
    runSpeed: run > 0 ? 34 + Math.round(rand() * 30) : 0,
  };
}

/** 车道之间留出来的角度余量,免得两颗矿石贴着边擦上 */
const LANE_PAD = 1.1;

/** 按宽度加权挑一个空档:空得越多的地方越容易被挑中,矿石分布才均匀 */
function pickGap(gaps: Span[], rand: () => number): Span | null {
  let total = 0;
  for (const g of gaps) total += Math.max(0, g.hi - g.lo);
  if (total <= 0) return null;
  let r = rand() * total;
  for (const g of gaps) {
    r -= Math.max(0, g.hi - g.lo);
    if (r <= 0) return g;
  }
  return gaps[gaps.length - 1];
}

/**
 * 按配方摆一个矿洞。
 *
 * 摆放规矩只有一条,但很硬:**从悬挂点看过去,任意两颗矿石的角度区间都不许叠**。
 * 满足这条以后,钩子沿任何角度冲出去都只可能碰上一颗,「瞄谁钩谁」成立。
 * 而且角度区间不叠 ⇒ 两颗矿石之间一定能画出一条过悬挂点的分割线 ⇒ 它们必不相交,
 * 所以不用再单独判圆和圆的重叠。
 *
 * 实现上先随机摇一个埋深,算出这颗矿在那个深度占多宽一条道,
 * 再到「还没被占的角度空档」里挑一条塞进去 —— 一维区间装箱,装得又满又快。
 * 大件先放,小件后面填缝。
 */
export function buildField(spec: FieldSpec): MineField {
  const rand = mulberry32(spec.seed);
  const wanted: Array<{ kind: OreKind; run: number }> = [];
  // 地鼠的跑动半径要先摇出来:它连跑带占占掉的扇面比谁都宽,得排在最前面先占位
  for (let i = 0; i < spec.moles; i++) wanted.push({ kind: "mole", run: 20 + Math.round(rand() * 20) });
  for (let i = wanted.length; i < spec.count; i++) wanted.push({ kind: drawKind(spec.bag, rand), run: 0 });
  wanted.sort((a, b) => ORES[b.kind].radius + b.run - (ORES[a.kind].radius + a.run));

  const lo = -spec.swingSpan + 2;
  const hi = spec.swingSpan - 2;
  const taken: Span[] = [];
  const placed: Ore[] = [];
  let id = 0;

  for (const want of wanted) {
    const profile = ORES[want.kind];
    for (let tryN = 0; tryN < 40; tryN++) {
      const gaps = freeGaps(taken, lo, hi);
      const gap = pickGap(gaps, rand);
      if (!gap) break;
      const run = want.run;
      const reach = profile.radius + run;
      // 先在空档里挑一个角度,再看这个角度上能埋多深:
      // 越靠边的角度越早撞上石壁,所以深浅是被角度决定的,反过来算会一直撞墙
      let a = gap.lo + rand() * (gap.hi - gap.lo);
      const rad = (a * Math.PI) / 180;
      const sin = Math.abs(Math.sin(rad));
      const cos = Math.cos(rad);
      if (cos <= 0.05) continue;
      const dWall = sin > 1e-3 ? (FIELD_W / 2 - WALL - reach) / sin : Number.POSITIVE_INFINITY;
      const dMax = Math.min(spec.ropeMax - profile.radius, dWall, (DIG_BOTTOM - profile.radius - PIVOT_Y) / cos);
      const dMin = Math.max(100, (DIG_TOP - PIVOT_Y) / cos);
      if (dMax <= dMin + 6) continue;
      // 埋深往深处偏:越深的矿占的扇面越窄,同一个洞里能多塞好几颗
      const d = dMin + Math.pow(rand(), 0.5) * (dMax - dMin);
      const half = (Math.atan2(reach, d) * 180) / Math.PI + LANE_PAD;
      if (gap.hi - gap.lo < 2 * half) continue;
      a = Math.max(gap.lo + half, Math.min(gap.hi - half, a));
      const rad2 = (a * Math.PI) / 180;
      const x = PIVOT_X + Math.sin(rad2) * d;
      const y = PIVOT_Y + Math.cos(rad2) * d;
      if (x - reach < WALL || x + reach > FIELD_W - WALL) continue;
      if (y < DIG_TOP || y + profile.radius > DIG_BOTTOM) continue;
      const ore = makeOre(id, want.kind, Math.round(x), Math.round(y), rand, run);
      placed.push(ore);
      taken.push({ lo: a - half, hi: a + half });
      id++;
      break;
    }
  }
  placed.sort((a, b) => a.y - b.y);
  const draft: MineField = {
    ores: placed,
    swingSpeed: spec.swingSpeed,
    swingSpan: spec.swingSpan,
    phase: spec.phase,
    ropeMax: spec.ropeMax,
    time: Number.POSITIVE_INFINITY,
  };
  return { ...draft, time: budgetFor(draft, spec.timeFactor) };
}

/**
 * 这个洞该给多少秒:先让模拟器不限时地把矿全钩一遍,拿总耗时乘上 timeFactor。
 * 时间跟着矿洞走,所以矿多的洞自动给得多,不会出现「东西一堆但根本来不及」。
 */
export function budgetFor(field: MineField, timeFactor: number): number {
  const full = simulateRun({ ...field, time: Number.POSITIVE_INFINITY });
  return Math.max(26, Math.round(full.timeUsed * Math.max(0.1, timeFactor)));
}

// ---------------------------------------------------------------------------
// 战役关卡
// ---------------------------------------------------------------------------

export interface HookLevel {
  /** 0 基关号 */
  index: number;
  chapter: number;
  seed: number;
  field: MineField;
  /** 过关要挖到多少金币 */
  target: number;
  /** 开局白送的启动金币,好让商店一开始就用得上 */
  startCoins: number;
  hint: string;
}

/** 难度系数:第 1 关只要求挖到贪心上限的四成出头,最后一关要挖到接近七成 */
export function targetRatio(index: number): number {
  return 0.42 + 0.26 * difficultyRamp(index);
}

/** 时间宽裕度:第 1 关够你把洞挖空,越往后越只够挑着钩 */
export function timeFactorOf(index: number): number {
  return 0.92 - 0.34 * difficultyRamp(index);
}

function specFor(index: number): FieldSpec {
  const ch = chapterOfLevel(index);
  const ramp = difficultyRamp(index);
  const inCh = index - chapterStartOf(ch);
  return {
    seed: 90001 + index * 911,
    count: 14 + Math.round(ramp * 10) + (inCh % 3),
    bag: MIX[ch],
    moles: ch >= MOLE_FROM ? 1 + (inCh % 2) : 0,
    swingSpeed: Math.round(40 + ramp * 52 + (inCh % 4) * 2),
    swingSpan: Math.round(60 + ramp * 16),
    phase: (index * 37) % 90,
    ropeMax: Math.round(330 + ramp * 130),
    timeFactor: timeFactorOf(index),
  };
}

function buildLevel(index: number): HookLevel {
  const i = Math.max(0, Math.min(TOTAL - 1, Math.round(index)));
  const ch = chapterOfLevel(i);
  const spec = specFor(i);
  const field = buildField(spec);
  const reachable = simulateRun(field).coins;
  const target = Math.max(40, Math.round((reachable * targetRatio(i)) / 5) * 5);
  return {
    index: i,
    chapter: ch,
    seed: spec.seed,
    field,
    target,
    startCoins: 25 + ch * 20,
    hint: CHAPTER_HINTS[ch],
  };
}

const CACHE = new Map<number, HookLevel>();

/** 第 index 关(0 基);算过的存下来,同一关每次拿到的是同一份数据 */
export function levelAt(index: number): HookLevel {
  const i = Math.max(0, Math.min(TOTAL - 1, Math.round(index)));
  const hit = CACHE.get(i);
  if (hit) return hit;
  const made = buildLevel(i);
  CACHE.set(i, made);
  return made;
}

/** 188 关全表(测试与统计用;正常游玩只会按需要算某一关) */
export function allLevels(): HookLevel[] {
  return Array.from({ length: TOTAL }, (_, i) => levelAt(i));
}

// ---------------------------------------------------------------------------
// 无尽矿井:一层一层往下挖,没有尽头
// ---------------------------------------------------------------------------

export interface EndlessLayer {
  /** 第几层(1 起) */
  depth: number;
  field: MineField;
  /** 这一层要挖够多少金币才能继续下潜 */
  quota: number;
  /** 这一层叫什么(每五层换一个名字,循环用) */
  name: string;
}

const LAYER_NAMES = ["浅土层", "潮汐层", "深蓝层", "熔岩层", "冰晶层", "水晶层", "云母层", "星尘层"];

/**
 * 第 n 层的配额比例:要挖到「这一层能挖到的钱」的百分之多少。
 * 越往下要求越苛刻,但封顶在 0.88 —— 永远留一点余量,不会出现根本挖不完的层。
 */
export function endlessQuotaRatio(depth: number): number {
  const n = Math.max(1, Math.round(depth));
  return Math.min(0.88, 0.46 + 0.035 * (n - 1));
}

/** 往下第 n 层的矿洞 */
export function endlessLayer(depth: number): EndlessLayer {
  const n = Math.max(1, Math.round(depth));
  const ramp = Math.min(1, (n - 1) / 16);
  const field = buildField({
    seed: 460001 + n * 7717,
    count: 14 + Math.round(ramp * 9) + (n % 3),
    bag: MIX[Math.min(MIX.length - 1, Math.floor((n - 1) / 2))],
    moles: n >= 4 ? 1 + (n % 2) : 0,
    swingSpeed: Math.round(42 + ramp * 54),
    swingSpan: Math.round(62 + ramp * 14),
    phase: (n * 53) % 90,
    ropeMax: Math.round(340 + ramp * 120),
    timeFactor: 0.9 - 0.36 * ramp,
  });
  const reachable = simulateRun(field).coins;
  return {
    depth: n,
    field,
    quota: Math.max(60, Math.round((reachable * endlessQuotaRatio(n)) / 5) * 5),
    name: LAYER_NAMES[(n - 1) % LAYER_NAMES.length],
  };
}

/** 无尽模式收工时的一句话 */
export function endlessLine(depth: number, coins: number, best: number): string {
  if (depth <= 1) return `第一层就卡住啦,先把又轻又值钱的钩上来,再来一趟!`;
  if (coins >= best) return `下潜到第 ${depth} 层,一共挖到 ${coins} 金币,刷新了自己的最好成绩!`;
  return `下潜到第 ${depth} 层,挖到 ${coins} 金币,离最好成绩 ${best} 还差一点点。`;
}
