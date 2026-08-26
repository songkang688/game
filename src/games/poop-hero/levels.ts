/**
 * 便便超人 · 关卡数据层(纯数据 + 确定性生成器,不碰 DOM)。
 *
 * 八个主题章节合计 188 关,走 `src/games/level99.ts` 的通用闯关框架:
 *  ①香香街 ②阳光公园 ③下水道潜行 ④垃圾山 ⑤屋顶追逐 ⑥泡泡洗衣坊 ⑦花田肥料厂 ⑧云端净化厂
 *
 * 每一关都是「一条连续的地面 + 若干可跳过的断口」,所有要清理的脏东西一律摆在地面主路上,
 * 空中平台只放香香星当支线奖励 —— 这样任何一关在几何上都保证能 100% 清干净,
 * 不会生成出「数学上不可能三星」的关(levels.test.ts 会逐关验算这件事)。
 *
 * 坐标约定:x 向右增长,y 向下增长,地面上表面 y = 0,空中的东西 y 是负数。
 */
import { mulberry32, randInt, type Chapter } from "../level99";

// ---------------------------------------------------------------------------
// 几何红线:比 logic.ts 里那套跳跃物理算出来的极限更保守,留足容错
// logic.test.ts 会断言这些值确实小于物理极限,改物理参数时测试会立刻拦住
// ---------------------------------------------------------------------------

/** 地面断口最窄(太窄反而看不清) */
export const MIN_GAP = 58;
/** 地面断口最宽:必须明显小于一次跳跃的水平距离 */
export const MAX_GAP = 128;
/** 空中平台最高:必须明显小于一次跳跃的最高点 */
export const MAX_PLATFORM_RISE = 96;
/** 低矮管道下沿离地高度:蹲下来(26px 高)能钻过去,站着(46px 高)钻不过去 */
export const BEAM_CLEARANCE = 32;
/** 关卡最左边这一段永远是干净平地,给玩家看清楚状况 */
export const START_PAD = 220;
/** 净化门离关卡末端的距离 */
export const GOAL_INSET = 120;

// ---------------------------------------------------------------------------
// 章节
// ---------------------------------------------------------------------------

export const CHAPTERS: Chapter[] = [
  {
    name: "香香街",
    emoji: "🏙️",
    color: "#FFE7D6",
    desc: "先在自家街口练手:跑、跳,轻轻踩一下臭臭怪,它就变成一朵小花。",
    size: 24,
  },
  {
    name: "阳光公园",
    emoji: "🌳",
    color: "#E2F5D8",
    desc: "弹簧蘑菇把你弹上半空,空中平台上藏着一串香香星。",
    size: 24,
  },
  {
    name: "下水道潜行",
    emoji: "🚇",
    color: "#DCE8F7",
    desc: "管道又矮又长,蹲下来钻过去;黏答答的泥洼会拖慢脚步,冲刺一下就干净。",
    size: 24,
  },
  {
    name: "垃圾山",
    emoji: "🗑️",
    color: "#EFE6D2",
    desc: "废纸团从山坡滚下来!跳过去躲,或者用冲刺清扫把它扫开。",
    size: 24,
  },
  {
    name: "屋顶追逐",
    emoji: "🏠",
    color: "#F7DDE8",
    desc: "臭味潮从后面追上来了,屋顶断口一个接一个,别停下!",
    size: 24,
  },
  {
    name: "泡泡洗衣坊",
    emoji: "🫧",
    color: "#DFF1FB",
    desc: "地板滑溜溜,泡泡浮台左右飘,提前一点点起跳才稳。",
    size: 23,
  },
  {
    name: "花田肥料厂",
    emoji: "🌻",
    color: "#FFF3CE",
    desc: "臭臭怪成群结队,清得越干净,身后的花田开得越大片。",
    size: 23,
  },
  {
    name: "云端净化厂",
    emoji: "☁️",
    color: "#EAE4FA",
    desc: "最后一段云上长廊,前面学过的全部机关一起上,把城市彻底变香!",
    size: 22,
  },
];

/** 章节名(给关卡命名与文案用) */
export const CHAPTER_NAMES = CHAPTERS.map((c) => c.name);

// ---------------------------------------------------------------------------
// 关卡数据结构
// ---------------------------------------------------------------------------

/** 地面断口:x0 到 x1 之间没有地面 */
export interface Gap {
  x0: number;
  x1: number;
}

export type PlatformKind = "solid" | "move";

export interface PlatformDef {
  /** 平台左端 */
  x: number;
  /** 平台上表面(负数,越小越高) */
  y: number;
  w: number;
  kind: PlatformKind;
  /** kind = "move" 时左右巡航的半径 */
  range?: number;
  /** kind = "move" 时的速度(px/s) */
  speed?: number;
}

/** 臭臭怪:可爱的小棕云,踩一下或者被冲刺扫到就变成小花 */
export interface MonsterDef {
  x: number;
  minX: number;
  maxX: number;
  speed: number;
}

/** 地上的小污渍:冲刺或者扫一扫就干净 */
export interface StainDef {
  x: number;
}

/** 黏答答泥洼:踩上去会变慢,清理掉就恢复 */
export interface SludgeDef {
  x: number;
  w: number;
}

/** 香香星:收集品 */
export interface SparkleDef {
  x: number;
  y: number;
  /** 地面主路上捡得到的(不用爬平台) */
  ground: boolean;
}

export interface SpringDef {
  x: number;
}

/** 低矮管道:站着过不去,蹲下来才能钻 */
export interface BeamDef {
  x: number;
  w: number;
}

/** 滚过来的废纸团 */
export interface JunkDef {
  x: number;
  speed: number;
}

export type StageKind = "campaign" | "endless" | "coop";

export interface LevelDef {
  kind: StageKind;
  /** 战役里的 0 基关号;无尽 / 双人用轮次号 */
  index: number;
  chapterIndex: number;
  name: string;
  feature: string;
  hint: string;
  len: number;
  goalX: number;
  gaps: Gap[];
  platforms: PlatformDef[];
  monsters: MonsterDef[];
  stains: StainDef[];
  sludges: SludgeDef[];
  sparkles: SparkleDef[];
  springs: SpringDef[];
  beams: BeamDef[];
  junks: JunkDef[];
  /** 臭味潮速度(px/s);null 表示这一关没有追逐 */
  chaserSpeed: number | null;
  /** 滑溜地板 */
  slippery: boolean;
  /** 净化门打开需要的清洁比例(0..1) */
  requiredRatio: number;
  /** 三星标准之一:标准用时(秒) */
  parSeconds: number;
  /** 三星标准之一:香香星收集数 */
  sparkleGoal: number;
  /** 本关时间上限(秒);超时算没完成 */
  timeLimit: number;
  hearts: number;
  /** 需要几个人一起站到净化门前 */
  goalNeedsAll: boolean;
}

// ---------------------------------------------------------------------------
// 生成器
// ---------------------------------------------------------------------------

type FeatureKind =
  | "monster"
  | "stain"
  | "sludge"
  | "gap"
  | "spring"
  | "platform"
  | "movePlat"
  | "beam"
  | "junk";

interface ChapterKit {
  /** 加权特征池:同一个词出现几次就是几倍权重 */
  pool: FeatureKind[];
  slippery: boolean;
  chaser: boolean;
  /** 关卡命名用的小词 */
  spots: string[];
  feature: string;
  hint: string;
}

const KITS: ChapterKit[] = [
  {
    pool: ["monster", "monster", "monster", "monster", "stain", "stain", "stain"],
    slippery: false,
    chaser: false,
    spots: ["早班车站", "面包铺门口", "邮筒转角", "小广场", "斑马线", "花坛边", "报刊亭", "钟楼下"],
    feature: "跑跳入门",
    hint: "踩一下臭臭怪它就变小花;按冲刺键还能横着扫一片。",
  },
  {
    pool: ["monster", "monster", "monster", "stain", "stain", "spring", "spring", "platform", "platform", "platform", "gap"],
    slippery: false,
    chaser: false,
    spots: ["草坡", "长椅旁", "喷水池", "秋千架", "小树林", "石板桥", "风筝坪", "观景台"],
    feature: "弹簧与空中平台",
    hint: "踩上弹簧蘑菇能弹得特别高,上面那串香香星就靠它。",
  },
  {
    pool: ["monster", "monster", "monster", "stain", "stain", "sludge", "sludge", "sludge", "beam", "beam", "beam", "gap"],
    slippery: false,
    chaser: false,
    spots: ["检修口", "圆管道", "水阀间", "回声廊", "苔藓弯", "老铁梯", "分岔口", "排水渠"],
    feature: "蹲行潜过管道",
    hint: "遇到矮管道按「蹲」钻过去;泥洼里跑不快,先冲刺把它清干净。",
  },
  {
    pool: ["monster", "monster", "monster", "stain", "stain", "junk", "junk", "junk", "sludge", "gap", "gap", "platform"],
    slippery: false,
    chaser: false,
    spots: ["纸箱坡", "旧轮胎堆", "铁皮棚", "分类台", "压缩机旁", "废纸山", "回收带", "山顶哨"],
    feature: "滚落的废纸团",
    hint: "废纸团滚过来时跳起来躲,或者迎面冲刺把它扫开。",
  },
  {
    pool: ["monster", "monster", "stain", "stain", "gap", "gap", "gap", "platform", "platform"],
    slippery: false,
    chaser: true,
    spots: ["晾衣绳", "老虎窗", "红瓦顶", "烟囱旁", "天台门", "水塔边", "招牌架", "月台檐"],
    feature: "屋顶追逐",
    hint: "臭味潮在后面追,别回头太久;断口连着跳,落地马上再冲。",
  },
  {
    pool: ["monster", "monster", "stain", "stain", "spring", "spring", "movePlat", "movePlat", "movePlat", "platform", "gap"],
    slippery: true,
    chaser: false,
    spots: ["泡沫池", "滚筒边", "晾衣架", "烘干口", "肥皂坡", "水汽廊", "折叠台", "香香柜"],
    feature: "滑地板与移动浮台",
    hint: "地板滑,松手也会往前溜一点;浮台飘到脚边再跳。",
  },
  {
    pool: ["monster", "monster", "monster", "monster", "monster", "stain", "stain", "sludge", "sludge", "spring", "platform"],
    slippery: false,
    chaser: false,
    spots: ["育苗棚", "堆肥池", "向日葵行", "浇水塔", "花种仓", "彩虹田", "蜜蜂屋", "丰收门"],
    feature: "成群的臭臭怪",
    hint: "臭臭怪扎堆的时候用冲刺清扫,一下能变出一排小花。",
  },
  {
    pool: [
      "monster",
      "monster",
      "monster",
      "stain",
      "stain",
      "sludge",
      "gap",
      "gap",
      "spring",
      "platform",
      "movePlat",
      "beam",
      "junk",
    ],
    slippery: false,
    chaser: true,
    spots: ["云门", "过滤塔", "香氛管", "星轨桥", "净化池", "风车层", "彩窗厅", "顶层花园"],
    feature: "全机关混战",
    hint: "前面学过的全在这儿了:蹲、跳、冲刺,一样都不能少。",
  },
];

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

/** 关卡总数(应恒为 188) */
export const TOTAL = CHAPTERS.reduce((s, c) => s + c.size, 0);

function pickFrom<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

/** 生成过程中的可变累加器 */
interface Builder {
  gaps: Gap[];
  platforms: PlatformDef[];
  monsters: MonsterDef[];
  stains: StainDef[];
  sludges: SludgeDef[];
  sparkles: SparkleDef[];
  springs: SpringDef[];
  beams: BeamDef[];
  junks: JunkDef[];
  groundSparkles: number;
}

function emptyBuilder(): Builder {
  return {
    gaps: [],
    platforms: [],
    monsters: [],
    stains: [],
    sludges: [],
    sparkles: [],
    springs: [],
    beams: [],
    junks: [],
    groundSparkles: 0,
  };
}

/**
 * 沿着 x 轴从左往右摆机关:每摆一个就把游标推过它自己的宽度再加安全间距,
 * 所以断口永远不会压在脏东西上面,脏东西也永远踩得到。
 */
function walk(
  b: Builder,
  rand: () => number,
  kit: ChapterKit,
  opts: { from: number; to: number; density: number; monsterSpeed: number; gapMax: number }
): void {
  let x = opts.from;
  const step = Math.max(96, 210 - opts.density * 70);
  let guard = 0;
  while (x < opts.to && guard++ < 400) {
    const feat = pickFrom(rand, kit.pool);
    switch (feat) {
      case "monster": {
        const span = randInt(rand, 30, 70);
        b.monsters.push({
          x,
          minX: x - span,
          maxX: x + span,
          speed: opts.monsterSpeed + randInt(rand, 0, 24),
        });
        x += span + step + randInt(rand, 0, 40);
        break;
      }
      case "stain": {
        b.stains.push({ x });
        x += step - 20 + randInt(rand, 0, 40);
        break;
      }
      case "sludge": {
        const w = randInt(rand, 64, 104);
        b.sludges.push({ x, w });
        x += w + step - 40;
        break;
      }
      case "gap": {
        const g = randInt(rand, MIN_GAP, opts.gapMax);
        b.gaps.push({ x0: x, x1: x + g });
        // 断口对面放一颗香香星当奖励,跳过去顺手就吃到
        b.sparkles.push({ x: x + g + 40, y: -44, ground: true });
        b.groundSparkles++;
        x += g + step + 20;
        break;
      }
      case "spring": {
        b.springs.push({ x });
        const py = -randInt(rand, 70, MAX_PLATFORM_RISE);
        b.platforms.push({ x: x + 60, y: py - 40, w: randInt(rand, 110, 150), kind: "solid" });
        b.sparkles.push({ x: x + 100, y: py - 84, ground: false });
        b.sparkles.push({ x: x + 140, y: py - 84, ground: false });
        x += step + 120;
        break;
      }
      case "platform": {
        const w = randInt(rand, 110, 170);
        const py = -randInt(rand, 62, MAX_PLATFORM_RISE);
        b.platforms.push({ x, y: py, w, kind: "solid" });
        b.sparkles.push({ x: x + w * 0.35, y: py - 40, ground: false });
        b.sparkles.push({ x: x + w * 0.7, y: py - 40, ground: false });
        x += w + step - 30;
        break;
      }
      case "movePlat": {
        const w = randInt(rand, 100, 140);
        const py = -randInt(rand, 60, MAX_PLATFORM_RISE);
        b.platforms.push({
          x,
          y: py,
          w,
          kind: "move",
          range: randInt(rand, 50, 90),
          speed: 44 + randInt(rand, 0, 26),
        });
        b.sparkles.push({ x: x + w * 0.5, y: py - 42, ground: false });
        x += w + step + 40;
        break;
      }
      case "beam": {
        const w = randInt(rand, 90, 150);
        b.beams.push({ x, w });
        // 管道里塞一颗贴地的香香星,蹲着钻过去就能吃到
        b.sparkles.push({ x: x + w * 0.5, y: -16, ground: true });
        b.groundSparkles++;
        x += w + step;
        break;
      }
      case "junk": {
        b.junks.push({ x: x + 320, speed: 130 + randInt(rand, 0, 70) });
        // 废纸团之间留够空档:落地以后总来得及看清下一个再起跳
        x += step + 170;
        break;
      }
      default:
        x += step;
        break;
    }

    // 空隙里撒一颗地面香香星,让主路一直有东西可捡
    if (rand() < 0.55) {
      const sx = x - step * 0.4;
      if (sx > opts.from && sx < opts.to && !inAnyGap(b.gaps, sx)) {
        b.sparkles.push({ x: sx, y: -44, ground: true });
        b.groundSparkles++;
      }
    }
  }
}

/** x 处是否落在某个断口里 */
export function inAnyGap(gaps: readonly Gap[], x: number): boolean {
  return gaps.some((g) => x > g.x0 - 12 && x < g.x1 + 12);
}

/** x 处有没有实心地面 */
export function groundSolidAt(def: Pick<LevelDef, "gaps" | "len">, x: number): boolean {
  if (x < 0 || x > def.len) return false;
  return !def.gaps.some((g) => x > g.x0 && x < g.x1);
}

/** 一关里要清理的脏东西总数 */
export function dirtCount(def: Pick<LevelDef, "monsters" | "stains" | "sludges">): number {
  return def.monsters.length + def.stains.length + def.sludges.length;
}

/**
 * 兜底:每段路至少三处要清的东西、三颗香香星,
 * 免得随机结果太稀,「清洁大作战」变成空跑一趟。
 */
function ensureMinimums(b: Builder, len: number): void {
  let fill = 0;
  while (dirtCount(b) < 3 && fill++ < 8) {
    const x = START_PAD + 140 * (fill + 1);
    if (x < len - GOAL_INSET - 80 && groundSolidAt({ gaps: b.gaps, len }, x)) b.stains.push({ x });
  }
  let spark = 0;
  while (b.sparkles.length < 3 && spark++ < 8) {
    const x = START_PAD + 120 * (spark + 1);
    if (x < len - GOAL_INSET - 80 && groundSolidAt({ gaps: b.gaps, len }, x)) {
      b.sparkles.push({ x, y: -44, ground: true });
      b.groundSparkles++;
    }
  }
}

function levelName(rand: () => number, ci: number, pos: number): string {
  return `${CHAPTERS[ci].name}·${pickFrom(rand, KITS[ci].spots)}`;
}

/**
 * 生成战役第 index 关(0 基)。同一个关号每次生成的结果完全一样。
 */
export function buildLevel(index: number): LevelDef {
  const lv = Math.max(0, Math.min(TOTAL - 1, Math.round(index)));
  const ci = chapterIndexOf(lv);
  const pos = indexInChapterOf(lv);
  const kit = KITS[ci];
  const rand = mulberry32(0x9f0000 + lv * 7919 + 13);
  const t = TOTAL > 1 ? lv / (TOTAL - 1) : 0;

  const len = Math.round(1700 + ci * 210 + pos * 22);
  const b = emptyBuilder();
  walk(b, rand, kit, {
    from: START_PAD,
    to: len - GOAL_INSET - 180,
    density: 0.2 + t * 0.8,
    monsterSpeed: 36 + Math.round(t * 40),
    gapMax: Math.min(MAX_GAP, 74 + ci * 8 + Math.round(pos * 0.6)),
  });

  ensureMinimums(b, len);

  const dirt = dirtCount(b);
  const parSeconds = Math.round(len / 190 + dirt * 0.85 + 6);

  return {
    kind: "campaign",
    index: lv,
    chapterIndex: ci,
    name: levelName(rand, ci, pos),
    feature: kit.feature,
    hint: kit.hint,
    len,
    goalX: len - GOAL_INSET,
    gaps: b.gaps,
    platforms: b.platforms,
    monsters: b.monsters,
    stains: b.stains,
    sludges: b.sludges,
    sparkles: b.sparkles,
    springs: b.springs,
    beams: b.beams,
    junks: b.junks,
    chaserSpeed: kit.chaser ? 52 + ci * 5 + Math.round(pos * 0.8) : null,
    slippery: kit.slippery,
    requiredRatio: Math.min(0.9, 0.55 + t * 0.35),
    parSeconds,
    sparkleGoal: Math.max(1, Math.ceil(b.groundSparkles * 0.75)),
    timeLimit: Math.round(parSeconds * 2.4 + 25),
    hearts: 3,
    goalNeedsAll: false,
  };
}

/** 战役全 188 关(按需生成一次并缓存) */
let cachedLevels: LevelDef[] | null = null;
export function allLevels(): LevelDef[] {
  if (!cachedLevels) {
    cachedLevels = [];
    for (let i = 0; i < TOTAL; i++) cachedLevels.push(buildLevel(i));
  }
  return cachedLevels;
}

/**
 * 无尽模式「清洁马拉松」的第 round 段街区(0 基)。
 * 段落一段接一段地往前接,越往后越长、越挤,身后的臭味潮也越快。
 */
export function buildEndless(round: number): LevelDef {
  const r = Math.max(0, Math.round(round));
  const rand = mulberry32(0x5eed00 + r * 104729 + 7);
  const ci = r % KITS.length;
  const kit = KITS[ci];
  const len = 2600 + Math.min(1800, r * 180);
  const b = emptyBuilder();
  walk(b, rand, kit, {
    from: START_PAD,
    to: len - GOAL_INSET - 160,
    density: Math.min(1, 0.35 + r * 0.08),
    monsterSpeed: 40 + Math.min(48, r * 5),
    gapMax: Math.min(MAX_GAP, 80 + r * 5),
  });
  ensureMinimums(b, len);

  return {
    kind: "endless",
    index: r,
    chapterIndex: ci,
    name: `第 ${r + 1} 街区 · ${CHAPTERS[ci].name}`,
    feature: kit.feature,
    hint: "一直往前清,身后的臭味潮越追越快!",
    len,
    goalX: len - GOAL_INSET,
    gaps: b.gaps,
    platforms: b.platforms,
    monsters: b.monsters,
    stains: b.stains,
    sludges: b.sludges,
    sparkles: b.sparkles,
    springs: b.springs,
    beams: b.beams,
    junks: b.junks,
    chaserSpeed: 62 + Math.min(70, r * 6),
    slippery: kit.slippery,
    // 街区要清到七成才通往下一段:不然「清洁马拉松」就只剩下埋头跑
    requiredRatio: 0.7,
    parSeconds: Math.round(len / 190 + 8),
    sparkleGoal: Math.max(1, b.groundSparkles),
    timeLimit: 0,
    hearts: 3,
    goalNeedsAll: false,
  };
}

/**
 * 双人合作模式的第 round 张图(0 基)。
 * 路更短、脏东西更多,两个人分头清,清到 100% 再一起站到净化门前才算赢。
 */
export function buildCoop(round: number): LevelDef {
  const r = Math.max(0, Math.round(round));
  const rand = mulberry32(0xc00b00 + r * 26417 + 3);
  const ci = r % KITS.length;
  const kit = KITS[ci];
  const len = 1900 + Math.min(1200, r * 150);
  const b = emptyBuilder();
  walk(b, rand, kit, {
    from: START_PAD,
    to: len - GOAL_INSET - 160,
    density: Math.min(1, 0.5 + r * 0.1),
    monsterSpeed: 34 + Math.min(30, r * 4),
    gapMax: Math.min(MAX_GAP, 78 + r * 6),
  });
  ensureMinimums(b, len);

  const dirt = dirtCount(b);
  const parSeconds = Math.round(len / 200 + dirt * 0.7 + 10);

  return {
    kind: "coop",
    index: r,
    chapterIndex: ci,
    name: `合作第 ${r + 1} 关 · ${CHAPTERS[ci].name}`,
    feature: kit.feature,
    hint: "分头清!全部清干净以后,两个人一起站到净化门前。",
    len,
    goalX: len - GOAL_INSET,
    gaps: b.gaps,
    platforms: b.platforms,
    monsters: b.monsters,
    stains: b.stains,
    sludges: b.sludges,
    sparkles: b.sparkles,
    springs: b.springs,
    beams: b.beams,
    junks: b.junks,
    chaserSpeed: null,
    slippery: kit.slippery,
    requiredRatio: 1,
    parSeconds,
    sparkleGoal: Math.max(1, Math.ceil(b.groundSparkles * 0.6)),
    timeLimit: Math.round(parSeconds * 2.6 + 30),
    hearts: 5,
    goalNeedsAll: true,
  };
}
