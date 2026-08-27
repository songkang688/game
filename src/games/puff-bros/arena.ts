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
import { gadget, type GadgetDef, type GadgetKind } from "./gadgets";
import type { Pit } from "./bounds";

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

export type ArenaKind = "campaign" | "endless" | "versus" | "climb";

export interface ArenaDef {
  kind: ArenaKind;
  /** 战役里的 0 基关号;无尽是波次号;对战是场地编号;上升气流是段号 */
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
  /**
   * 1.2 新增的机关(气流管 / 可推箱 / 脆弱地板 / 弹簧云 / 传送泡)。
   * **前 99 关一律是空数组** —— 已经通关的孩子回头再打,那 99 关必须一格不差,
   * `arena.test.ts` 用逐关指纹把这件事钉死。
   */
  gadgets: GadgetDef[];
  /**
   * 1.2 新增的坑:x 落在坑里就没有地板接着。空数组表示四面封死(战役与波次无尽都是)。
   * 掉进坑里走 `bounds.ts` 的两段式:先打转,救不回来才出局。
   */
  pits: Pit[];
  /** 1.2 新增:上升气流的终点层(>0 才是爬塔关,踩上这一层就算过) */
  climbRow: number;
}

/** 1.1 就有的那些字段;指纹只看它们,新加的字段不参与,老关卡才钉得住 */
export const LEGACY_FIELDS = [
  "kind",
  "index",
  "chapterIndex",
  "name",
  "feature",
  "hint",
  "platforms",
  "monsters",
  "candies",
  "spawns",
  "hearts",
  "parSeconds",
  "candyGoal",
  "timeLimit",
  "roundTarget",
] as const;

function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** 一关的「老字段指纹」:只要 1.1 就有的那些数据没变,它就不变 */
export function arenaFingerprint(def: ArenaDef): string {
  const legacy: Record<string, unknown> = {};
  for (const key of LEGACY_FIELDS) legacy[key] = def[key];
  return fnv1a(JSON.stringify(legacy));
}

/** 前 n 关的合并指纹。测试拿它跟写死的值对账,少一格都对不上 */
export function campaignFingerprint(count: number): string {
  let all = "";
  for (let i = 0; i < count; i++) all += `${arenaFingerprint(buildLevel(i))};`;
  return fnv1a(all);
}

/**
 * 1.1 收尾时前 99 关的合并指纹。这串东西不许改 —— 它变了就说明
 * 老存档里已经打过的关卡被动了,已经拿到的三星就对不上了。
 */
export const CAMPAIGN_99_FINGERPRINT = "3a0bbdde";
/** 机关是第 100 关(0 基 99)才开始出现的 */
export const GADGET_FROM_LEVEL = 99;

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
export function buildSupportTree(rand: () => number, rows: number, perRow: number): PlatformDef[] {
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

// ---------------------------------------------------------------------------
// 机关摆放(1.2 新增)
// ---------------------------------------------------------------------------

/** 机关离「机器人要走的地方」至少留这么远 */
export const GADGET_CLEAR = 54;
/** 脆弱地板悬在地面上方这么高:刚好过得了头,跳上去才踩得到 */
export const BRITTLE_LIFT = 44;

interface Band {
  lo: number;
  hi: number;
}

/**
 * 这块地面上「不许摆机关」的那几段。
 *
 * 188 关的可解性是靠机器人逐关实打实跑出来的,而机器人只认三个地方:
 * 自己脚下这块的中点(从那儿穿下去)、孩子浮台的中点(从那儿顶上去)、
 * 还有咕噜怪的巡逻带。机关一旦压在这三处上,机器人就可能被弹走、被吹跑、
 * 被传送到别处,原本必然可解的路就断了 —— 所以这几段整段让开。
 */
function busyBands(
  platforms: readonly PlatformDef[],
  monsters: readonly MonsterDef[],
  spawns: readonly SpawnDef[],
  surface: number
): Band[] {
  const bands: Band[] = [];
  const own = surfaceSpan(platforms, surface);
  if (surface >= 0) {
    // 机器人要从自己这块浮台的中点蹲跳穿下去,那一段得空着。
    // 地板没有「穿下去」这回事,所以地板的中间反倒是最安全的空地。
    const mid = (own.x0 + own.x1) / 2;
    bands.push({ lo: mid - GADGET_CLEAR, hi: mid + GADGET_CLEAR });
  }
  platforms.forEach((p) => {
    if (p.parent !== surface) return;
    const cm = p.x + p.w / 2;
    bands.push({ lo: cm - GADGET_CLEAR, hi: cm + GADGET_CLEAR });
  });
  for (const m of monsters) {
    if (m.surface !== surface) continue;
    // 只让开咕噜怪站的那一小段就够了:机关碰不到咕噜怪,
    // 整条巡逻带一让,地板上就一寸空地都不剩了
    bands.push({ lo: m.x - GADGET_CLEAR, hi: m.x + GADGET_CLEAR });
  }
  for (const s of spawns) {
    if (s.surface !== surface) continue;
    bands.push({ lo: s.x - GADGET_CLEAR, hi: s.x + GADGET_CLEAR });
  }
  return bands;
}

/** 在这块地面上找一个宽 w 的空位;整块都腾不出来就返回 null */
function freeSlot(
  platforms: readonly PlatformDef[],
  bands: readonly Band[],
  surface: number,
  w: number,
  taken: readonly number[]
): number | null {
  const span = surfaceSpan(platforms, surface);
  const half = w / 2 + 6;
  const lo = span.x0 + half;
  const hi = span.x1 - half;
  if (hi < lo) return null;
  const blocked = (x: number): boolean => {
    for (const b of bands) if (x + half > b.lo && x - half < b.hi) return true;
    for (const t of taken) if (Math.abs(t - x) < w + 16) return true;
    return false;
  };
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    // 从两头往中间找:中点那一带是机器人的通道,越靠边越安全
    const t = i / steps;
    for (const x of [lo + (hi - lo) * t * 0.5, hi - (hi - lo) * t * 0.5]) {
      if (!blocked(x)) return Math.round(x);
    }
  }
  return null;
}

/** 第 lv 关(0 基)解锁到哪几种机关:一种一种教,不一次全端上来 */
export function gadgetKindsFor(lv: number): GadgetKind[] {
  if (lv < GADGET_FROM_LEVEL) return [];
  const out: GadgetKind[] = ["brittle", "spring"];
  if (lv >= 118) out.push("updraft");
  if (lv >= 141) out.push("crate");
  if (lv >= 164) out.push("warp");
  return out;
}

/**
 * 给第 lv 关摆机关。前 99 关直接返回空数组 —— 那 99 关的数据一格都不许动。
 */
function placeGadgets(
  rand: () => number,
  lv: number,
  platforms: readonly PlatformDef[],
  monsters: readonly MonsterDef[],
  spawns: readonly SpawnDef[]
): GadgetDef[] {
  const kinds = gadgetKindsFor(lv);
  if (kinds.length === 0) return [];

  const surfaces = [-1, ...platforms.map((_, i) => i)];
  const bands = new Map<number, Band[]>();
  const taken = new Map<number, number[]>();
  for (const s of surfaces) {
    bands.set(s, busyBands(platforms, monsters, spawns, s));
    taken.set(s, []);
  }

  const out: GadgetDef[] = [];
  const want = 2 + (lv % 3);
  // 从解锁列表里轮着取,保证每一种都轮得到,不会整章只见一种
  for (let n = 0; n < want; n++) {
    const kind = kinds[(lv + n) % kinds.length];
    const need = kind === "warp" ? 2 : 1;
    const picked: Array<{ surface: number; x: number }> = [];
    const start = randInt(rand, 0, surfaces.length - 1);
    for (let attempt = 0; attempt < surfaces.length * 3 && picked.length < need; attempt++) {
      const surface = surfaces[(start + attempt) % surfaces.length];
      const w = kind === "brittle" ? BRITTLE_W_HINT : kind === "spring" ? SPRING_W_HINT : SLOT_W_HINT;
      const x = freeSlot(platforms, bands.get(surface) ?? [], surface, w, taken.get(surface) ?? []);
      if (x === null) continue;
      // 一对传送泡要么落在不同地面上,要么在同一块地面上离得够远,不然传了等于没传
      if (picked.some((q) => q.surface === surface && Math.abs(q.x - x) < WARP_MIN_SPAN)) continue;
      taken.get(surface)?.push(x);
      picked.push({ surface, x });
    }
    if (picked.length < need) continue;

    if (kind === "warp") {
      const base = out.length;
      picked.forEach((p, i) => {
        out.push(
          gadget("warp", p.x, surfaceY(platforms, p.surface), {
            under: p.surface,
            link: base + (1 - i),
          })
        );
      });
      continue;
    }
    const spot = picked[0];
    const top = surfaceY(platforms, spot.surface);
    // 脆弱地板悬在半空当捷径,其余的都坐在地面上
    const y = kind === "brittle" ? top - BRITTLE_LIFT : top;
    out.push(gadget(kind, spot.x, Math.round(y), { under: spot.surface }));
  }
  return out;
}

/** 找空位时按这几个宽度留白(比机关本身宽一点,免得贴着边) */
const SLOT_W_HINT = 48;
const BRITTLE_W_HINT = 86;
const SPRING_W_HINT = 66;
/** 同一块地面上的一对传送泡至少隔这么远 */
const WARP_MIN_SPAN = 150;

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

  const platforms = buildSupportTree(rand, kit.rows, 2 + (pos % 2));
  const spans = surfaceSpans(platforms);
  const monsterCount = Math.min(11, 3 + Math.round(t * 6) + (pos % 3));
  const { monsters, candies } = fillArena(rand, kit, spans, {
    monsterCount,
    monsterSpeed: 34 + Math.round(t * 34) + ci * 2,
    candyCount: 2 + (pos % 3),
  });

  const parSeconds = Math.round(10 + monsters.length * 5.5);
  const total = candies.length + monsters.length;
  const spawns = defaultSpawns();
  // 名字要在摆机关之前抽,不然 rand 的调用次序变了,前 99 关的关名就跟着变
  const name = levelName(rand, ci);
  const gadgets = placeGadgets(rand, lv, platforms, monsters, spawns);

  return {
    kind: "campaign",
    index: lv,
    chapterIndex: ci,
    name,
    feature: gadgets.length > 0 ? `${kit.feature} + 机关` : kit.feature,
    hint: gadgets.length > 0 ? `${kit.hint}${GADGET_HINT[gadgets[0].kind]}` : kit.hint,
    platforms,
    monsters,
    candies,
    spawns,
    hearts: 5,
    parSeconds,
    candyGoal: Math.max(2, Math.ceil(total * 0.7)),
    timeLimit: Math.round(parSeconds * 2.6 + 30),
    roundTarget: 0,
    gadgets,
    pits: [],
    climbRow: 0,
  };
}

/** 关卡提示语里给机关补的那半句 */
const GADGET_HINT: Record<GadgetKind, string> = {
  updraft: "这一关有气流管,掉进去会被托着往上飘。",
  crate: "这一关有可推箱,顶一顶或者噗一口就能挪走。",
  brittle: "这一关有脆弱地板,踩出裂纹就得赶紧走。",
  spring: "这一关有弹簧云,跳上去会被弹得老高。",
  warp: "这一关有传送泡,站上去按 ⬇ 就飞到另一头。",
};

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

  const platforms = buildSupportTree(rand, kit.rows, 2 + (r % 2));
  const spans = surfaceSpans(platforms);
  // 无尽是一波接一波连着打的,心不回满,所以每一波单看都得是「拼一下能清完」的量,
  // 难度靠波次叠加,而不是靠某一波突然塞满一屏怪
  const { monsters, candies } = fillArena(rand, kit, spans, {
    monsterCount: Math.min(10, 3 + Math.floor(r * 0.6)),
    monsterSpeed: 40 + Math.min(40, r * 4),
    candyCount: 2 + (r % 3),
  });

  const spawns = defaultSpawns();
  // 波次无尽是上升气流的热身场,第三波起也摆机关(闯关的前 99 关不受影响)
  const gadgets = placeGadgets(rand, GADGET_FROM_LEVEL + r * 23, platforms, monsters, spawns);

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
    spawns,
    hearts: 3,
    parSeconds: Math.round(10 + monsters.length * 5),
    candyGoal: Math.max(1, candies.length),
    timeLimit: 0,
    roundTarget: 0,
    gadgets,
    pits: [],
    climbRow: 0,
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

  /**
   * 成对地摆:算一次左边的 x,右边直接取 ARENA_W - x。
   * 关键是**不能**各算各的 —— 浮台的 x 是取整过的,左右两块的中点可能差半格,
   * 各算各的就会让道具刷新点差出 1、2 个像素,对战场就不再是「谁都不吃亏」了。
   */
  function mirrorX(leftX: number): [number, number] {
    const x = Math.round(leftX);
    return [x, ARENA_W - x];
  }

  const candies: CandyDef[] = [];
  // 地板中线那颗正好落在坑上,所以地板这一层拆成左右两颗
  for (const x of mirrorX(ARENA_W / 2 - VERSUS_PIT_HALF_W - 46)) candies.push({ x, surface: -1 });
  // 浮台是成对生成的(0/1 一对、2/3 一对),照左边那块算,右边镜像过去
  for (let i = 0; i + 1 < platforms.length; i += 2) {
    const left = platforms[i];
    if (left.w < 80) continue;
    const [lx, rx] = mirrorX(left.x + left.w / 2);
    candies.push({ x: lx, surface: i });
    candies.push({ x: rx, surface: i + 1 });
  }

  // 机关也成对镜像:左边有什么,右边同一个位置就有什么
  const gadgets: GadgetDef[] = [];
  const deckY = rowSurface(1);
  const springs = mirrorX(ARENA_W / 2 - VERSUS_PIT_HALF_W - 74);
  for (const x of springs) gadgets.push(gadget("spring", x, FLOOR_Y, { under: -1 }));
  if (platforms.length >= 2) {
    const left = platforms[0];
    const [lx, rx] = mirrorX(left.x + left.w / 2 - Math.min(38, left.w / 2 - 18));
    gadgets.push(gadget("crate", lx, deckY, { under: 0 }));
    gadgets.push(gadget("crate", rx, deckY, { under: 1 }));
  }
  // 场地中央那道坑的两侧各一根气流管:掉下去还能被托一把
  for (const x of mirrorX(ARENA_W / 2 - VERSUS_PIT_HALF_W - 18)) {
    gadgets.push(gadget("updraft", x, FLOOR_Y, { under: -1 }));
  }

  return {
    kind: "versus",
    index: r,
    chapterIndex: r % CHAPTERS.length,
    name: `噗噗擂台 第 ${r + 1} 号场地`,
    feature: "三局两胜",
    hint: "把对手裹进泡泡里,再冲上去噗一下,就得一分!当心中间那道口子。",
    platforms,
    monsters: [],
    candies,
    spawns: defaultSpawns(),
    hearts: 0,
    parSeconds: VERSUS_ROUND_SECONDS,
    candyGoal: 0,
    timeLimit: VERSUS_ROUND_SECONDS,
    roundTarget: VERSUS_ROUND_TARGET,
    gadgets,
    // 正中间一道口子,关于中线对称,两边一样宽
    pits: [{ x0: ARENA_W / 2 - VERSUS_PIT_HALF_W, x1: ARENA_W / 2 + VERSUS_PIT_HALF_W }],
    climbRow: 0,
  };
}

/**
 * 对战场中间那道口子的半宽:关于中线对称,谁也不吃亏。
 * 它必须窄到「一次起跳跨得过去」,不然两边就被切成两个孤岛,谁也够不着谁。
 */
export const VERSUS_PIT_HALF_W = 36;
