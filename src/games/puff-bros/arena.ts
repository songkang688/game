/**
 * 噗噗兄弟 · 场地数据层(纯数据 + 确定性生成器,不碰 DOM)。
 *
 * 一屏一场地:底下一整条地板,上面若干层「单向浮台」(从下面能顶穿上去,
 * 走到边上就掉下来,蹲着按跳能从脚下穿过去)。噗噗兄弟站在浮台上朝前
 * 吹一股「泡泡糖气流」,把咕噜怪裹进泡泡里,再噗一下戳破就变成糖果。
 *
 * 可解性是硬性要求,所以场地不是随便撒的,而是长成一棵「支撑树」:
 *  - 第 0 层是整条地板,永远存在;
 *  - 第 r 层的每一块浮台都记着自己的 parent(第 r-1 层的那块浮台,地板记 -1),
 *    并且保证它的中点正好压在 parent 的跨度里;
 *  - 层高 ROW_H 明显小于一次起跳的最高点,所以站在 parent 上对着中点起跳,
 *    一定能顶穿上去站稳;想下来就蹲着按跳穿回去。
 * 于是任意两块地面之间都有一条「照着 parent 走」的通路,
 * 怪物又永远不会离开自己那块浮台 —— 每一关在几何上都必然可以清空。
 * arena.test.ts / logic.test.ts 会把这两件事逐关验算一遍。
 *
 * 坐标是屏幕式的:x 向右增长,y 向下增长,0 在场地顶部。
 * 角色与怪物的 (x, y) 指「脚底中点」,浮台的 y 指它的上表面。
 */
import { mulberry32, randInt, type Chapter } from "../level99";

// ---------------------------------------------------------------------------
// 场地尺寸与几何红线
// ---------------------------------------------------------------------------

export const ARENA_W = 640;
export const ARENA_H = 372;
/** 地板厚度(画出来的那条边) */
export const FLOOR_H = 26;
/** 地板上表面 */
export const FLOOR_Y = ARENA_H - FLOOR_H;
/** 天花板下沿:泡泡最高只能飘到这儿 */
export const CEILING_Y = 26;
/** 左右墙厚 */
export const WALL = 14;
/**
 * 层高:必须明显小于 logic.ts 里一次起跳的最高点(logic.test.ts 会断言)。
 * 还有一条不那么显眼的约束 —— 站在最高一层也得跳得起来,
 * 所以顶层的头顶到天花板要留出一截,见 topRowHeadroom()。
 */
export const ROW_H = 80;
/** 最多几层浮台(章节配方里的 rows 不会超过这个数) */
export const MAX_ROWS = 3;
/** 浮台最窄 / 最宽 */
export const MIN_PLATFORM_W = 96;
export const MAX_PLATFORM_W = 208;
/** 同一层两块浮台之间至少留这么宽的缝,人才掉得下去 */
export const ROW_GAP = 46;
/** 浮台中点离 parent 两端至少留这么远,免得踩在悬空的边角上起跳 */
export const SUPPORT_INSET = 30;
/** 怪物巡逻区离浮台两端的内缩 */
export const PATROL_INSET = 20;

/** 第 row 层地面的上表面(row = 0 是地板) */
export function rowSurface(row: number): number {
  return FLOOR_Y - ROW_H * Math.max(0, Math.round(row));
}

/** 站在最高一层时,头顶到天花板还剩多少(逻辑层用它断言「顶层也跳得动」) */
export function topRowHeadroom(playerHeight: number): number {
  return rowSurface(MAX_ROWS) - playerHeight - CEILING_Y;
}

// ---------------------------------------------------------------------------
// 章节:八个主题,合计 188 关
// ---------------------------------------------------------------------------

export const CHAPTERS: Chapter[] = [
  {
    name: "泡泡糖工坊",
    emoji: "🫧",
    color: "#DDF1FF",
    desc: "先在工坊里练手:吹一口泡泡糖气流把咕噜怪裹起来,再噗一下戳破。",
    size: 24,
  },
  {
    name: "果冻花园",
    emoji: "🍮",
    color: "#E4F7D9",
    desc: "花园里多了两层浮台,蹦上去清高处的咕噜怪,蹲着按跳就能穿回来。",
    size: 24,
  },
  {
    name: "云朵晾衣场",
    emoji: "☁️",
    color: "#E8EEFB",
    desc: "蹦蹦怪会一下一下往上弹,等它落地那一刻再吹气流最稳。",
    size: 24,
  },
  {
    name: "汽水瀑布",
    emoji: "🥤",
    color: "#D8F0F4",
    desc: "追追怪盯上谁就往谁那儿跑,别贴太近,退半步再吹。",
    size: 24,
  },
  {
    name: "棉花糖高台",
    emoji: "🍬",
    color: "#FFE6F1",
    desc: "浮台叠到三层高,先把顶上的清干净,糖果会自己掉下来。",
    size: 23,
  },
  {
    name: "星星阁楼",
    emoji: "🌟",
    color: "#FFF3D6",
    desc: "阁楼窄、怪物快,泡泡飘上去就那么几秒,吹完马上跟过去戳。",
    size: 23,
  },
  {
    name: "彩虹回廊",
    emoji: "🌈",
    color: "#F0E6FF",
    desc: "三种咕噜怪一起上,连着戳破好几个泡泡能拿到彩虹糖。",
    size: 23,
  },
  {
    name: "噗噗大剧场",
    emoji: "🎪",
    color: "#FFE2D6",
    desc: "最后的舞台,前面学过的全在这儿了,把整场清空就是噗噗冠军!",
    size: 23,
  },
];

/** 关卡总数(应恒为 188) */
export const TOTAL = CHAPTERS.reduce((s, c) => s + c.size, 0);

/** 0 基关号属于第几章 */
export function chapterIndexOf(level: number): number {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    acc += CHAPTERS[i].size;
    if (level < acc) return i;
  }
  return CHAPTERS.length - 1;
}

/** 0 基关号在本章内的序号 */
export function indexInChapterOf(level: number): number {
  const ci = chapterIndexOf(level);
  let acc = 0;
  for (let i = 0; i < ci; i++) acc += CHAPTERS[i].size;
  return level - acc;
}

// ---------------------------------------------------------------------------
// 数据结构
// ---------------------------------------------------------------------------

/** 单向浮台:从下面能顶穿上去,从上面踩得住 */
export interface PlatformDef {
  /** 左端 */
  x: number;
  /** 上表面 */
  y: number;
  w: number;
  /** 第几层(1 起,地板是 0) */
  row: number;
  /** 支撑它的那块浮台下标;-1 表示直接架在地板上 */
  parent: number;
}

/** 咕噜怪的三个品种 */
export type MonsterKind = "walker" | "hopper" | "chaser";

export interface MonsterDef {
  kind: MonsterKind;
  x: number;
  /** 站在哪块地面上:-1 是地板,否则是 platforms 的下标 */
  surface: number;
  minX: number;
  maxX: number;
  speed: number;
  dir: 1 | -1;
}

export interface CandyDef {
  x: number;
  /** 糖果落在哪块地面上 */
  surface: number;
}

export interface SpawnDef {
  x: number;
  surface: number;
}

export type ArenaKind = "campaign" | "endless" | "versus";

export interface ArenaDef {
  kind: ArenaKind;
  /** 战役里的 0 基关号;无尽是波次号;对战是场地编号 */
  index: number;
  chapterIndex: number;
  name: string;
  feature: string;
  hint: string;
  platforms: PlatformDef[];
  monsters: MonsterDef[];
  candies: CandyDef[];
  spawns: SpawnDef[];
  /** 合作模式共用的心;对战模式用不到 */
  hearts: number;
  /** 三星标准之一:标准用时(秒) */
  parSeconds: number;
  /** 三星标准之一:吃到的糖果数 */
  candyGoal: number;
  /** 时间上限(秒);0 表示不限时。对战模式里是一局的长度 */
  timeLimit: number;
  /** 对战模式:先戳破对手几次就赢下这一局 */
  roundTarget: number;
}

// ---------------------------------------------------------------------------
// 章节配方
// ---------------------------------------------------------------------------

interface ChapterKit {
  /** 地板之上摆几层浮台 */
  rows: number;
  /** 加权怪物池:同一个词出现几次就是几倍权重 */
  pool: MonsterKind[];
  spots: string[];
  feature: string;
  hint: string;
}

const KITS: ChapterKit[] = [
  {
    rows: 2,
    pool: ["walker", "walker", "walker"],
    spots: ["搅糖锅", "吹气管", "配方台", "彩糖罐", "包装带", "试味窗", "学徒角", "招牌下"],
    feature: "吹泡泡入门",
    hint: "对着咕噜怪吹一口泡泡糖气流,它就被裹起来了,再噗一下戳破。",
  },
  {
    rows: 2,
    pool: ["walker", "walker", "walker", "hopper"],
    spots: ["果冻池", "布丁坡", "藤蔓架", "露水台", "花瓣桥", "蜜罐边", "苗圃间", "凉亭顶"],
    feature: "上下两层浮台",
    hint: "站在浮台正下方按跳,能顶穿上去;蹲着按跳就从脚下穿回来。",
  },
  {
    rows: 3,
    pool: ["walker", "walker", "hopper", "hopper"],
    spots: ["晾衣绳", "云梯口", "风铃廊", "洗衣盆", "折云台", "晒毯架", "雾气窗", "顶层云"],
    feature: "会弹跳的蹦蹦怪",
    hint: "蹦蹦怪一下一下往上弹,等它落回浮台那一刻再吹最准。",
  },
  {
    rows: 3,
    pool: ["walker", "hopper", "chaser", "chaser"],
    spots: ["气泡潭", "汽水阀", "冰块桥", "吸管道", "瀑布口", "回旋槽", "杯沿台", "水花亭"],
    feature: "会追人的追追怪",
    hint: "追追怪会朝你跑过来,退半步拉开距离再吹气流。",
  },
  {
    rows: 3,
    pool: ["walker", "walker", "hopper", "chaser"],
    spots: ["棉花坡", "拉丝机", "糖霜台", "彩针架", "高空绳", "云糖顶", "转糖盘", "观景窗"],
    feature: "三层高台",
    hint: "先清最上面那层,糖果会自己掉到下面,回头顺路捡就行。",
  },
  {
    rows: 3,
    pool: ["walker", "hopper", "hopper", "chaser"],
    spots: ["旧木梯", "星灯下", "望远窗", "阁楼门", "书箱边", "斜屋顶", "铜风向", "钟摆旁"],
    feature: "又窄又快",
    hint: "泡泡飘上去只停几秒,吹完马上跟过去,别让咕噜怪跑出来。",
  },
  {
    rows: 3,
    pool: ["walker", "hopper", "chaser", "chaser", "walker"],
    spots: ["红拱门", "橙石阶", "黄灯廊", "绿藤梯", "青水台", "蓝窗格", "紫穹顶", "彩虹桥"],
    feature: "三种咕噜怪混编",
    hint: "连着戳破好几个泡泡会一次掉一大把糖果,先攒够再一起收。",
  },
  {
    rows: 3,
    pool: ["walker", "hopper", "chaser", "chaser", "hopper"],
    spots: ["聚光灯", "后台梯", "幕布边", "乐池上", "空中环", "布景塔", "谢幕台", "冠军席"],
    feature: "全员登场",
    hint: "跳、蹲、吹、戳,前面学过的全用上,把整个舞台清空!",
  },
];

// ---------------------------------------------------------------------------
// 生成器
// ---------------------------------------------------------------------------

/** 一段站得住的地面 */
export interface Span {
  x0: number;
  x1: number;
  /** 这段地面在 platforms 里的下标;-1 是地板 */
  id: number;
}

const FLOOR_SPAN: Span = { x0: WALL, x1: ARENA_W - WALL, id: -1 };

function pickFrom<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

/**
 * 按支撑树摆浮台:第 r 层的每一块都挂在第 r-1 层的某块(或地板)上,
 * 中点一定压在 parent 的跨度里,所以从 parent 上原地起跳就能顶上来。
 */
function buildPlatforms(rand: () => number, rows: number, perRow: number): PlatformDef[] {
  const out: PlatformDef[] = [];
  let below: Span[] = [FLOOR_SPAN];

  for (let row = 1; row <= rows; row++) {
    const y = rowSurface(row);
    const placed: PlatformDef[] = [];
    const want = Math.max(1, Math.min(3, perRow - (row - 1)));
    // 多试几次,挤不下就少放一块,绝不放出「中点悬空」的浮台
    for (let attempt = 0; attempt < want * 4 && placed.length < want; attempt++) {
      const sup = below[randInt(rand, 0, below.length - 1)];
      const supW = sup.x1 - sup.x0;
      if (supW < SUPPORT_INSET * 2 + 20) continue;
      const w = randInt(rand, MIN_PLATFORM_W, MAX_PLATFORM_W);
      const midMin = Math.max(sup.x0 + SUPPORT_INSET, WALL + w / 2);
      const midMax = Math.min(sup.x1 - SUPPORT_INSET, ARENA_W - WALL - w / 2);
      if (midMax < midMin) continue;
      const mid = randInt(rand, Math.ceil(midMin), Math.floor(midMax));
      const x = Math.round(mid - w / 2);
      const clash = placed.some((p) => x < p.x + p.w + ROW_GAP && x + w + ROW_GAP > p.x);
      if (clash) continue;
      placed.push({ x, y, w, row, parent: sup.id });
    }
    if (placed.length === 0) break;
    const base = out.length;
    out.push(...placed);
    below = placed.map((p, i) => ({ x0: p.x, x1: p.x + p.w, id: base + i }));
  }

  return out;
}

/** 场地上全部「站得住的地面」:地板 + 每块浮台 */
export function surfaceSpans(platforms: readonly PlatformDef[]): Span[] {
  return [FLOOR_SPAN, ...platforms.map((p, i) => ({ x0: p.x, x1: p.x + p.w, id: i }))];
}

/** 某块地面的上表面高度 */
export function surfaceY(platforms: readonly PlatformDef[], surface: number): number {
  if (surface < 0 || surface >= platforms.length) return FLOOR_Y;
  return platforms[surface].y;
}

/** 某块地面的左右边界 */
export function surfaceSpan(platforms: readonly PlatformDef[], surface: number): { x0: number; x1: number } {
  if (surface < 0 || surface >= platforms.length) return { x0: FLOOR_SPAN.x0, x1: FLOOR_SPAN.x1 };
  const p = platforms[surface];
  return { x0: p.x, x1: p.x + p.w };
}

/** 从某块地面顺着 parent 一路数到地板(含自己,末项恒为 -1) */
export function supportChain(platforms: readonly PlatformDef[], surface: number): number[] {
  const chain: number[] = [];
  let cur = surface;
  let guard = 0;
  while (cur >= 0 && cur < platforms.length && guard++ < 16) {
    chain.push(cur);
    cur = platforms[cur].parent;
  }
  chain.push(-1);
  return chain;
}

function monsterOn(
  rand: () => number,
  kit: ChapterKit,
  span: Span,
  speed: number,
  forced?: MonsterKind
): MonsterDef | null {
  const x0 = span.x0 + PATROL_INSET;
  const x1 = span.x1 - PATROL_INSET;
  if (x1 - x0 < 40) return null;
  return {
    kind: forced ?? pickFrom(rand, kit.pool),
    x: randInt(rand, Math.ceil(x0), Math.floor(x1)),
    surface: span.id,
    minX: x0,
    maxX: x1,
    speed,
    dir: rand() < 0.5 ? -1 : 1,
  };
}

interface FillOpts {
  monsterCount: number;
  monsterSpeed: number;
  candyCount: number;
}

interface Filled {
  monsters: MonsterDef[];
  candies: CandyDef[];
}

/** 同一块地面上两只咕噜怪至少隔这么远,不然玩家挤在中间没处站 */
export const MONSTER_GAP = 46;
/** 出生角落留出的安全区:一进场就被贴脸太吓人了 */
const SPAWN_CLEAR = 110;

/** 这块地面上真正能放怪的一段(巡逻区再去掉出生角落) */
function patrolBand(m: MonsterDef): { lo: number; hi: number } {
  let lo = m.minX;
  let hi = m.maxX;
  if (m.surface === -1) {
    lo = Math.max(lo, FLOOR_SPAN.x0 + SPAWN_CLEAR);
    hi = Math.min(hi, FLOOR_SPAN.x1 - SPAWN_CLEAR);
  }
  if (hi < lo) {
    const mid = (m.minX + m.maxX) / 2;
    return { lo: mid, hi: mid };
  }
  return { lo, hi };
}

/**
 * 在这段地面上给新来的咕噜怪挑个位置:先照掷出来的落点试,
 * 挤着同伴就沿着这段地面找离大家最远的地方。整段都塞不下就返回 null ——
 * 这只怪让给下一块地面,宁可少放一只,也不让两只叠在一起挪不开身。
 */
function spotOn(taken: readonly number[], band: { lo: number; hi: number }, wish: number): number | null {
  const gap = (x: number): number => taken.reduce((d, o) => Math.min(d, Math.abs(o - x)), Infinity);
  const start = Math.min(Math.max(wish, band.lo), band.hi);
  if (gap(start) >= MONSTER_GAP) return Math.round(start);

  let best = start;
  let bestGap = gap(start);
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const x = band.lo + ((band.hi - band.lo) * i) / steps;
    const d = gap(x);
    if (d > bestGap) {
      bestGap = d;
      best = x;
    }
  }
  return bestGap >= MONSTER_GAP ? Math.round(best) : null;
}

/**
 * 把怪物和糖果撒到各块地面上。
 * 每只怪先随机挑一块地面,那块塞不下就顺着往下一块试:
 * 既不会全堆在地板上,也不会三只挤在同一块小浮台上。
 */
function fillArena(rand: () => number, kit: ChapterKit, spans: Span[], opts: FillOpts): Filled {
  const monsters: MonsterDef[] = [];
  const candies: CandyDef[] = [];
  const usable = spans.filter((s) => s.x1 - s.x0 >= PATROL_INSET * 2 + 40);
  if (usable.length === 0) return { monsters, candies };

  for (let i = 0; i < opts.monsterCount; i++) {
    const start = randInt(rand, 0, usable.length - 1);
    for (let k = 0; k < usable.length; k++) {
      const span = usable[(i + start + k) % usable.length];
      const m = monsterOn(rand, kit, span, opts.monsterSpeed + randInt(rand, 0, 18));
      if (!m) continue;
      const taken = monsters.filter((o) => o.surface === m.surface).map((o) => o.x);
      const x = spotOn(taken, patrolBand(m), m.x);
      if (x === null) continue;
      m.x = x;
      monsters.push(m);
      break;
    }
  }

  for (let i = 0; i < opts.candyCount; i++) {
    const span = usable[randInt(rand, 0, usable.length - 1)];
    const x = randInt(rand, Math.ceil(span.x0 + 16), Math.floor(span.x1 - 16));
    candies.push({ x, surface: span.id });
  }

  return { monsters, candies };
}

function levelName(rand: () => number, ci: number): string {
  return `${CHAPTERS[ci].name}·${pickFrom(rand, KITS[ci].spots)}`;
}

/** 两位噗噗兄弟的出生点:地板左右两头 */
function defaultSpawns(): SpawnDef[] {
  return [
    { x: FLOOR_SPAN.x0 + 56, surface: -1 },
    { x: FLOOR_SPAN.x1 - 56, surface: -1 },
  ];
}

/**
 * 生成合作战役第 index 关(0 基)。同一个关号每次生成的结果完全一样。
 */
export function buildLevel(index: number): ArenaDef {
  const lv = Math.max(0, Math.min(TOTAL - 1, Math.round(index)));
  const ci = chapterIndexOf(lv);
  const pos = indexInChapterOf(lv);
  const kit = KITS[ci];
  const rand = mulberry32(0x7b0b00 + lv * 7919 + 29);
  const t = TOTAL > 1 ? lv / (TOTAL - 1) : 0;

  const platforms = buildPlatforms(rand, kit.rows, 2 + (pos % 2));
  const spans = surfaceSpans(platforms);
  const monsterCount = Math.min(11, 3 + Math.round(t * 6) + (pos % 3));
  const { monsters, candies } = fillArena(rand, kit, spans, {
    monsterCount,
    monsterSpeed: 34 + Math.round(t * 34) + ci * 2,
    candyCount: 2 + (pos % 3),
  });

  const parSeconds = Math.round(10 + monsters.length * 5.5);
  const total = candies.length + monsters.length;

  return {
    kind: "campaign",
    index: lv,
    chapterIndex: ci,
    name: levelName(rand, ci),
    feature: kit.feature,
    hint: kit.hint,
    platforms,
    monsters,
    candies,
    spawns: defaultSpawns(),
    hearts: 5,
    parSeconds,
    candyGoal: Math.max(2, Math.ceil(total * 0.7)),
    timeLimit: Math.round(parSeconds * 2.6 + 30),
    roundTarget: 0,
  };
}

/** 战役全 188 关(按需生成一次并缓存) */
let cachedLevels: ArenaDef[] | null = null;
export function allLevels(): ArenaDef[] {
  if (!cachedLevels) {
    cachedLevels = [];
    for (let i = 0; i < TOTAL; i++) cachedLevels.push(buildLevel(i));
  }
  return cachedLevels;
}

/**
 * 无尽模式「噗噗不停」的第 wave 波(0 基)。
 * 越往后怪越多越快,场地也换着主题来,心不会自己回满。
 */
export function buildWave(wave: number): ArenaDef {
  const r = Math.max(0, Math.round(wave));
  const ci = r % KITS.length;
  const kit = KITS[ci];
  const rand = mulberry32(0x5eed11 + r * 104729 + 17);

  const platforms = buildPlatforms(rand, kit.rows, 2 + (r % 2));
  const spans = surfaceSpans(platforms);
  // 无尽是一波接一波连着打的,心不回满,所以每一波单看都得是「拼一下能清完」的量,
  // 难度靠波次叠加,而不是靠某一波突然塞满一屏怪
  const { monsters, candies } = fillArena(rand, kit, spans, {
    monsterCount: Math.min(10, 3 + Math.floor(r * 0.6)),
    monsterSpeed: 40 + Math.min(40, r * 4),
    candyCount: 2 + (r % 3),
  });

  return {
    kind: "endless",
    index: r,
    chapterIndex: ci,
    name: `第 ${r + 1} 波 · ${CHAPTERS[ci].name}`,
    feature: kit.feature,
    hint: "一波接一波,心用完才结束!戳破得越快,连击分越高。",
    platforms,
    monsters,
    candies,
    spawns: defaultSpawns(),
    hearts: 3,
    parSeconds: Math.round(10 + monsters.length * 5),
    candyGoal: Math.max(1, candies.length),
    timeLimit: 0,
    roundTarget: 0,
  };
}

/** 一局对战的长度(秒) */
export const VERSUS_ROUND_SECONDS = 75;
/** 一局对战里先戳破对手几次就赢 */
export const VERSUS_ROUND_TARGET = 3;

/**
 * 对战场地(0 基编号)。左右完全对称,谁都不吃亏;
 * 场上不放咕噜怪,只放糖果当加分点,免得分心。
 */
export function buildVersusArena(index: number): ArenaDef {
  const r = Math.max(0, Math.round(index));
  const rand = mulberry32(0xbeef77 + r * 40503 + 5);
  const platforms: PlatformDef[] = [];

  /** 镜像地放一对浮台:同宽同高,中点关于场地中线对称,支撑链各自独立 */
  function mirrorPair(row: number, w: number, mid: number, parents: [number, number]): void {
    const y = rowSurface(row);
    let lo = WALL + w / 2;
    let hi = ARENA_W / 2 - 24;
    const left = parents[0];
    if (left >= 0) {
      // 中点必须压在正下方那块的跨度里,不然跳上去以后没法原路返回
      const sup = platforms[left];
      lo = Math.max(lo, sup.x + SUPPORT_INSET);
      hi = Math.min(hi, sup.x + sup.w - SUPPORT_INSET);
    }
    const clamped = hi >= lo ? Math.min(Math.max(mid, lo), hi) : (lo + hi) / 2;
    platforms.push({ x: Math.round(clamped - w / 2), y, w, row, parent: parents[0] });
    platforms.push({ x: Math.round(ARENA_W - clamped - w / 2), y, w, row, parent: parents[1] });
  }

  const w1 = randInt(rand, MIN_PLATFORM_W, 172);
  const mid1 = randInt(rand, 118, 186);
  mirrorPair(1, w1, mid1, [-1, -1]);

  // 第二层只在半数场地出现:每块都架在正下方那块的跨度里,跳上去、蹲下来都走得通
  if (r % 2 === 1) {
    const w2 = randInt(rand, MIN_PLATFORM_W, Math.max(MIN_PLATFORM_W, w1 - 8));
    const inset = Math.min(SUPPORT_INSET, Math.max(0, (w1 - 20) / 2));
    const mid2 = Math.min(Math.max(mid1 + randInt(rand, -20, 20), mid1 - inset), mid1 + inset);
    mirrorPair(2, w2, mid2, [0, 1]);
  }

  const spans = surfaceSpans(platforms);
  const candies: CandyDef[] = spans
    .filter((s) => s.x1 - s.x0 >= 80)
    .map((s) => ({ x: Math.round((s.x0 + s.x1) / 2), surface: s.id }));

  return {
    kind: "versus",
    index: r,
    chapterIndex: r % CHAPTERS.length,
    name: `噗噗擂台 第 ${r + 1} 号场地`,
    feature: "三局两胜",
    hint: "把对手裹进泡泡里,再冲上去噗一下,就得一分!",
    platforms,
    monsters: [],
    candies,
    spawns: defaultSpawns(),
    hearts: 0,
    parSeconds: VERSUS_ROUND_SECONDS,
    candyGoal: 0,
    timeLimit: VERSUS_ROUND_SECONDS,
    roundTarget: VERSUS_ROUND_TARGET,
  };
}
