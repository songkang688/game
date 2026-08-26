// 冒险小王:188 关八大遗迹的关卡生成器(确定性,同一关每次布局完全一样)。
//
// 一关就是一条横向的遗迹走廊:一段一段的石台、中间是坑,坑太宽就必须用抓钩荡过去。
// 走廊里散着三件神器,集齐三件才推得开尽头的首领之门。
//
// 这里只生成数据,不画一个像素;index.ts 负责把数据变成画面,单测负责验证
// 「每个坑都过得去、三件神器都拿得到、门在最后」。
import { TOTAL_LEVELS, chapterOf, indexInChapter, mulberry32, randInt, type Chapter } from "../level99";
import { ROPE_MAX, dist, jumpDistance } from "./logic";

export const CHAPTERS: Chapter[] = [
  { name: "绿林遗迹", emoji: "🌿", color: "#d8f5cc", desc: "藤蔓爬满石台,先把跑跳和回旋镖练熟", size: 24 },
  { name: "沙丘神庙", emoji: "🏜️", color: "#ffe8c2", desc: "风沙里出现宽裂口,抓钩第一次派上用场", size: 24 },
  { name: "冰川裂谷", emoji: "🧊", color: "#d7f0ff", desc: "冰面很滑,落地要提前收脚", size: 24 },
  { name: "天空之城", emoji: "☁️", color: "#e6ecff", desc: "石台高高低低,连着荡好几次抓钩", size: 24 },
  { name: "熔岩地窟", emoji: "🌋", color: "#ffdcd2", desc: "坑底冒着热气,小怪也变多了", size: 23 },
  { name: "沉船珊瑚", emoji: "🐚", color: "#d6f7ef", desc: "水里轻飘飘,跳得高也落得慢", size: 23 },
  { name: "齿轮钟塔", emoji: "⚙️", color: "#ece2ff", desc: "齿轮转得快,守卫走得也快", size: 23 },
  { name: "星辉王座", emoji: "✨", color: "#fff0d6", desc: "最后的遗迹:长走廊、宽裂口、重重守卫", size: 23 },
];

/** 三件神器的名字与图标(全是本作原创的小石头) */
export const ARTIFACT_NAMES = ["日纹石", "月纹石", "星纹石"] as const;
export const ARTIFACT_EMOJI = ["🔶", "🔷", "🔮"] as const;

/** 能直接跳过去的坑,最宽就这么宽(留了约 40 像素安全余量) */
export const WALK_GAP_MAX = 150;
/** 必须荡抓钩的坑,至少这么宽(比 WALK_GAP_MAX 大,免得两类坑长得一样) */
export const SWING_GAP_MIN = 170;
/** 必须荡抓钩的坑,最宽就这么宽(再宽绳子够不着) */
export const SWING_GAP_MAX = 260;
/** 相邻石台的高度差上限 */
export const Y_DELTA_MAX = 45;
/** 锚点挂在两侧石台里较高那一侧上方这么高的地方 */
export const ANCHOR_HEIGHT = 125;
/** 石台左边这么宽的一条「落脚带」上不会有守卫巡逻,跳过来才有落脚的地方 */
export const LANDING_STRIP = 78;

/** 世界里的地面基准高度(画面坐标,越大越靠下) */
export const GROUND_Y = 400;
/** 石台最高能抬到哪 */
export const CEIL_Y = 240;

export interface Platform {
  x: number;
  /** 台面高度 */
  y: number;
  w: number;
}

export interface Anchor {
  x: number;
  y: number;
}

export interface Artifact {
  x: number;
  y: number;
  /** 0/1/2 对应日纹石 / 月纹石 / 星纹石 */
  kind: number;
}

export interface Enemy {
  x: number;
  y: number;
  /** 巡逻区间 */
  from: number;
  to: number;
  /** ground=地上走的石头怪,flyer=坑上方飘的小风灵 */
  kind: "ground" | "flyer";
}

/** 两个石台之间的坑 */
export interface Pit {
  from: number;
  to: number;
  /** 坑底有没有尖石(纯装饰:掉进任何一个坑都会掉一颗心) */
  spiky: boolean;
}

export interface AdvLevel {
  /** 0 基关号;无尽层与速通赛道用 -1 */
  index: number;
  chapter: number;
  width: number;
  platforms: Platform[];
  anchors: Anchor[];
  artifacts: Artifact[];
  enemies: Enemy[];
  pits: Pit[];
  door: { x: number; y: number };
  /** 这一关有几颗心 */
  hearts: number;
  /** 速通目标时间(秒) */
  parSec: number;
  /** 重力倍率:水里 0.75,平地 1 */
  gravityScale: number;
  /** 地面摩擦倍率:冰面只有 0.35,松手还会滑一段 */
  frictionScale: number;
  /** 小怪速度 */
  enemySpeed: number;
  hint: string;
}

interface GenOptions {
  chapter: number;
  /** 石台数量 */
  platforms: number;
  /** 宽裂口(必须荡抓钩)的比例 0..1 */
  swingRate: number;
  swingGapMax: number;
  enemies: number;
  enemySpeed: number;
  gravityScale: number;
  frictionScale: number;
  hearts: number;
  spikyRate: number;
  hint: string;
}

const HINTS = [
  "按住方向跑起来,遇到小坑直接跳过去!",
  "坑太宽就甩抓钩:挂上藤环,荡到最高点再松手。",
  "冰面很滑,提前松开方向键才停得住。",
  "连着好几个宽裂口,荡完一个马上找下一个藤环。",
  "坑底有尖石,掉下去会掉一颗心,稳一点!",
  "水里跳得高、落得慢,别急着松抓钩。",
  "守卫走得飞快,先用回旋镖把它敲晕再过去。",
  "最后的遗迹:三件神器藏得最深,慢慢来。",
];

/** 一次满速起跳的水平距离,用来校验「小坑真的跳得过去」 */
export const MAX_JUMP = jumpDistance();

function optionsFor(level: number): GenOptions {
  const ci = chapterOf(CHAPTERS, level);
  const idx = indexInChapter(CHAPTERS, level);
  const size = Math.max(1, CHAPTERS[ci].size - 1);
  const t = idx / size;
  const base: GenOptions = {
    chapter: ci,
    platforms: 5 + Math.floor(t * 3) + Math.floor(ci * 0.6),
    swingRate: ci === 0 ? 0 : Math.min(0.62, 0.16 + ci * 0.07 + t * 0.16),
    swingGapMax: Math.min(SWING_GAP_MAX, 190 + ci * 10 + Math.floor(t * 20)),
    enemies: Math.min(6, Math.floor(t * 2) + Math.floor(ci * 0.7)),
    enemySpeed: 44 + ci * 5 + Math.floor(t * 12),
    gravityScale: 1,
    frictionScale: 1,
    hearts: ci >= 3 ? 4 : 5,
    spikyRate: Math.min(0.8, 0.15 + ci * 0.08),
    hint: HINTS[ci] ?? HINTS[0],
  };
  if (ci === 2) base.frictionScale = 0.35;
  if (ci === 5) base.gravityScale = 0.75;
  if (ci === 6) base.enemySpeed += 18;
  if (ci === 7) {
    base.frictionScale = 0.6;
    base.enemies = Math.min(7, base.enemies + 1);
  }
  return base;
}

/** 真正的生成器:给定参数与随机种子,吐出一条走廊 */
export function generateLevel(opts: GenOptions, seed: number, index: number): AdvLevel {
  const rand = mulberry32(seed >>> 0);
  const platforms: Platform[] = [];
  const anchors: Anchor[] = [];
  const pits: Pit[] = [];
  const enemies: Enemy[] = [];
  const artifacts: Artifact[] = [];

  const count = Math.max(4, Math.min(14, Math.round(opts.platforms)));
  let y = GROUND_Y;
  platforms.push({ x: 0, y, w: 220 });

  for (let i = 1; i < count; i++) {
    const prev = platforms[i - 1];
    const prevRight = prev.x + prev.w;
    const wide = rand() < opts.swingRate;
    const gap = wide
      ? randInt(rand, SWING_GAP_MIN, Math.max(SWING_GAP_MIN, Math.round(opts.swingGapMax)))
      : randInt(rand, 70, WALK_GAP_MAX);
    const dy = randInt(rand, -Y_DELTA_MAX, Y_DELTA_MAX);
    y = Math.max(CEIL_Y, Math.min(GROUND_Y, prev.y + dy));
    const w = i === count - 1 ? randInt(rand, 220, 300) : randInt(rand, 130, 230);
    const x = prevRight + gap;
    platforms.push({ x, y, w });
    pits.push({ from: prevRight, to: x, spiky: rand() < opts.spikyRate });
    if (wide) {
      anchors.push({
        x: Math.round((prevRight + x) / 2),
        y: Math.round(Math.min(prev.y, y) - ANCHOR_HEIGHT),
      });
    }
  }

  // 三件神器:分别藏在走廊的前段、中段、后段,不放在出生台上
  const usable = platforms.map((_, i) => i).filter((i) => i > 0);
  const picks: number[] = [];
  for (let k = 0; k < 3; k++) {
    const lo = Math.floor((usable.length * k) / 3);
    const hi = Math.max(lo, Math.floor((usable.length * (k + 1)) / 3) - 1);
    let pi = usable[randInt(rand, lo, hi)];
    while (picks.includes(pi) && pi + 1 < platforms.length) pi++;
    picks.push(pi);
  }
  picks.forEach((pi, k) => {
    const p = platforms[pi];
    artifacts.push({ x: Math.round(p.x + p.w / 2 + randInt(rand, -30, 30)), y: p.y - 42, kind: k });
  });

  // 小怪:只站在够宽的石台上来回巡逻,出生台永远干净。
  // 先隔一块放一只、放满了再回头补空位,保证不会有两只叠在同一块石台上。
  const roomy = platforms.map((p, i) => ({ p, i })).filter(({ p, i }) => i > 0 && p.w >= 150);
  const slots: number[] = [];
  for (let i = 1; i < roomy.length; i += 2) slots.push(i);
  for (let i = 0; i < roomy.length; i += 2) slots.push(i);
  for (let k = 0; k < Math.min(opts.enemies, slots.length); k++) {
    const { p } = roomy[slots[k]];
    // 台面左边留一条落脚带:玩家从坑那边荡/跳过来时不会一落地就撞上守卫
    const from = p.x + LANDING_STRIP;
    const to = p.x + p.w - 24;
    const flyer = opts.chapter >= 3 && k % 3 === 2;
    enemies.push({
      x: Math.round((from + to) / 2),
      // 飘的小风灵挂在齐胸高:站着会撞上,也正好在回旋镖的高度上
      y: flyer ? p.y - 34 : p.y,
      from: Math.round(from),
      to: Math.round(to),
      kind: flyer ? "flyer" : "ground",
    });
  }

  const last = platforms[platforms.length - 1];
  const door = { x: Math.round(last.x + last.w - 96), y: last.y };
  const width = Math.round(last.x + last.w + 120);
  const swings = anchors.length;
  const parSec = Math.max(12, Math.round(width / 190 + swings * 2 + enemies.length * 0.9));

  return {
    index,
    chapter: opts.chapter,
    width,
    platforms,
    anchors,
    artifacts,
    enemies,
    pits,
    door,
    hearts: opts.hearts,
    parSec,
    gravityScale: opts.gravityScale,
    frictionScale: opts.frictionScale,
    enemySpeed: opts.enemySpeed,
    hint: opts.hint,
  };
}

/** 第 level 关(0 基) */
export function buildLevel(level: number): AdvLevel {
  const lv = Math.max(0, Math.min(TOTAL_LEVELS - 1, Math.round(level)));
  return generateLevel(optionsFor(lv), 90210 + lv * 7717, lv);
}

export const LEVELS: AdvLevel[] = Array.from({ length: TOTAL_LEVELS }, (_, i) => buildLevel(i));

/** 无尽遗迹的第 floor 层(1 基):越往下越长、坑越宽、守卫越多 */
export function buildEndlessFloor(floor: number): AdvLevel {
  const f = Math.max(1, Math.round(floor));
  const ci = (f - 1) % CHAPTERS.length;
  const base = optionsFor(chapterStartLevel(ci));
  const opts: GenOptions = {
    ...base,
    platforms: Math.min(13, 5 + Math.floor(f / 2)),
    swingRate: Math.min(0.6, 0.12 + f * 0.05),
    swingGapMax: Math.min(SWING_GAP_MAX, 180 + f * 8),
    enemies: Math.min(6, Math.floor(f / 2)),
    enemySpeed: Math.min(108, 48 + f * 5),
    hearts: 4,
    hint: "遗迹一层比一层深,拿齐三件神器就能往下走!",
  };
  return generateLevel(opts, 515000 + f * 4813, -1);
}

/** 速通赛道:每章一条固定路线,只比时间 */
export function buildSpeedrunCourse(chapter: number): AdvLevel {
  const ci = Math.max(0, Math.min(CHAPTERS.length - 1, Math.round(chapter)));
  const base = optionsFor(chapterStartLevel(ci));
  const opts: GenOptions = {
    ...base,
    platforms: 9,
    swingRate: ci === 0 ? 0.25 : Math.min(0.6, 0.3 + ci * 0.04),
    swingGapMax: Math.min(SWING_GAP_MAX, 200 + ci * 8),
    enemies: Math.min(4, 1 + Math.floor(ci / 2)),
    hearts: 3,
    hint: "计时开始!捡齐三件神器冲到首领之门,越快越好。",
  };
  return generateLevel(opts, 770000 + ci * 9137, -1);
}

/** 某章第一关的 0 基关号 */
export function chapterStartLevel(ci: number): number {
  let acc = 0;
  for (let i = 0; i < ci && i < CHAPTERS.length; i++) acc += CHAPTERS[i].size;
  return acc;
}

// ---------------------------------------------------------------------------
// 可通过性校验(单测直接用,保证不会生成「过不去的坑」)
// ---------------------------------------------------------------------------

export interface GapInfo {
  from: number;
  to: number;
  width: number;
  leftY: number;
  rightY: number;
  /** 覆盖这个坑的锚点下标,-1 表示没有 */
  anchor: number;
  /** 不用抓钩、直接跳过去行不行 */
  jumpable: boolean;
}

/** 这个锚点能不能把这个坑接下来:两侧起跳点、落点都在绳长之内,且挂得够高 */
export function anchorCovers(gap: { from: number; to: number; leftY: number; rightY: number }, a: Anchor): boolean {
  if (a.x < gap.from - 40 || a.x > gap.to + 40) return false;
  if (a.y > Math.min(gap.leftY, gap.rightY) - 60) return false;
  if (dist(gap.from, gap.leftY, a.x, a.y) > ROPE_MAX) return false;
  if (dist(gap.to, gap.rightY, a.x, a.y) > ROPE_MAX) return false;
  return true;
}

/** 列出一关里所有的坑,并标注它是「跳得过去」还是「靠哪个锚点荡过去」 */
export function gapsOf(level: AdvLevel): GapInfo[] {
  const out: GapInfo[] = [];
  for (let i = 1; i < level.platforms.length; i++) {
    const left = level.platforms[i - 1];
    const right = level.platforms[i];
    const from = left.x + left.w;
    const to = right.x;
    const info = {
      from,
      to,
      width: to - from,
      leftY: left.y,
      rightY: right.y,
      anchor: -1,
      jumpable: to - from <= WALK_GAP_MAX,
    };
    info.anchor = level.anchors.findIndex((a) => anchorCovers(info, a));
    out.push(info);
  }
  return out;
}

/** 整关能不能从头走到尾:每个坑要么跳得过去,要么有锚点接着 */
export function levelTraversable(level: AdvLevel): boolean {
  return gapsOf(level).every((g) => g.jumpable || g.anchor >= 0);
}

/** 三件神器都落在某块石台的台面上吗(不会飘在坑上方) */
export function artifactsGrounded(level: AdvLevel): boolean {
  if (level.artifacts.length !== 3) return false;
  const kinds = new Set(level.artifacts.map((a) => a.kind));
  if (kinds.size !== 3) return false;
  return level.artifacts.every((a) =>
    level.platforms.some((p) => a.x >= p.x && a.x <= p.x + p.w && Math.abs(a.y - (p.y - 42)) < 1)
  );
}
