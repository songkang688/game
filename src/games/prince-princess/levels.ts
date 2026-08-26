/**
 * 王子公主大冒险 · 关卡数据层(纯数据 + 确定性生成器,不碰 DOM)。
 *
 * 七个主题章节合计 188 关,走 `src/games/level99.ts` 的通用闯关框架:
 *  ①樱花城堡 ②星光森林 ③水晶洞窟 ④云海浮岛 ⑤熔岩火山 ⑥冰霜雪原 ⑦暗影王座
 *
 * 每章的正中间和最后一关各有一场首领战,合计 14 场(7 位首领,中途那场是弱化版)。
 *
 * 两位主角分工不同,关卡数据必须同时照顾到:
 *  - 王子只有一段跳,所以**主路上任何断口和台阶都按王子的跳跃极限来卡**,
 *    公主的二段跳只是让她轻松些,绝不会出现「只有公主过得去」的主路;
 *  - 铠甲怪只吃近战、幽灵只吃远程,所以这两种怪永远成组出现在有回旋余地的平地上,
 *    不会塞进窄台上逼小朋友在半空中换人。
 *
 * 坐标约定:x 向右增长,y 向下增长,地面上表面 y = 0,空中的东西 y 是负数。
 */
import { mulberry32, randInt, type Chapter } from "../level99";

// ---------------------------------------------------------------------------
// 几何红线:比 logic.ts 里那套跳跃物理算出来的极限更保守,留足容错
// logic.test.ts 会断言这些值确实小于王子(跳得最矮的那个)的物理极限
// ---------------------------------------------------------------------------

/** 地面断口最窄(太窄反而看不清) */
export const MIN_GAP = 56;
/** 地面断口最宽:必须明显小于王子一次跳跃的水平距离 */
export const MAX_GAP = 118;
/** 空中平台最高:必须明显小于王子一次跳跃的最高点 */
export const MAX_PLATFORM_RISE = 86;
/** 关卡最左边这一段永远是干净平地,给玩家看清楚状况 */
export const START_PAD = 230;
/** 城门离关卡末端的距离 */
export const GOAL_INSET = 130;
/** 首领擂台的宽度 */
export const ARENA_LEN = 1500;

// ---------------------------------------------------------------------------
// 章节
// ---------------------------------------------------------------------------

export const CHAPTERS: Chapter[] = [
  {
    name: "樱花城堡",
    emoji: "🌸",
    color: "#FFE3EF",
    desc: "从城堡门口出发。王子拔剑近身砍,公主抬手放星星,分工合作最省力。",
    size: 28,
  },
  {
    name: "星光森林",
    emoji: "🌲",
    color: "#E3F3DC",
    desc: "小蝙蝠在树梢飞来飞去,剑够不着 —— 该公主的星星出场啦。",
    size: 27,
  },
  {
    name: "水晶洞窟",
    emoji: "💎",
    color: "#DDEBF9",
    desc: "铠甲怪的壳会把星星弹开,只有王子的剑劈得动;水晶炮台还会吐水晶弹。",
    size: 27,
  },
  {
    name: "云海浮岛",
    emoji: "☁️",
    color: "#EAF2FC",
    desc: "云上的断口一个接一个。公主的二段跳最吃香,王子跟紧一点别掉下去。",
    size: 27,
  },
  {
    name: "熔岩火山",
    emoji: "🌋",
    color: "#FFE6D6",
    desc: "地上全是尖刺,炮台一颗接一颗地吐火球,别站着不动。",
    size: 27,
  },
  {
    name: "冰霜雪原",
    emoji: "❄️",
    color: "#E4F2FA",
    desc: "地板滑溜溜,幽灵飘来飘去 —— 剑会从它身上穿过去,得靠公主的星星。",
    size: 26,
  },
  {
    name: "暗影王座",
    emoji: "👑",
    color: "#EBE4F7",
    desc: "王座前的最后一段路。前面学过的怪全都在这儿等着,两个人一起才打得过。",
    size: 26,
  },
];

export const CHAPTER_NAMES = CHAPTERS.map((c) => c.name);

/** 关卡总数(应恒为 188) */
export const TOTAL = CHAPTERS.reduce((s, c) => s + c.size, 0);

// ---------------------------------------------------------------------------
// 数据结构
// ---------------------------------------------------------------------------

export interface Gap {
  x0: number;
  x1: number;
}

export type PlatformKind = "solid" | "move";

export interface PlatformDef {
  x: number;
  /** 平台上表面(负数,越小越高) */
  y: number;
  w: number;
  kind: PlatformKind;
  range?: number;
  speed?: number;
}

/**
 * 五种小怪:
 *  - slime 果冻怪:地面巡逻,剑和星星都打得动,也能踩;
 *  - bat   小蝙蝠:低空盘旋,剑要跳起来才够得着,星星最省事;
 *  - armor 铠甲怪:壳会弹开星星,**只有近战打得动**;
 *  - ghost 小幽灵:剑会从身上穿过去,**只有远程打得动**;
 *  - turret 炮台:原地不动,定时吐弹,两种攻击都吃。
 */
export type EnemyKind = "slime" | "bat" | "armor" | "ghost" | "turret";

export interface EnemyDef {
  kind: EnemyKind;
  x: number;
  /** 巡逻左右界(静止的怪两个值相同) */
  minX: number;
  maxX: number;
  speed: number;
  /** 飞行怪的盘旋中心高度(负数);地面怪是 0 */
  y: number;
}

export interface SpikeDef {
  x: number;
  w: number;
}

export interface GemDef {
  x: number;
  y: number;
  /** 站在地面主路上就能捡到的 */
  ground: boolean;
}

export interface BossDef {
  /** 首领编号,对应 BOSSES 表 */
  kind: number;
  x: number;
  hp: number;
  /** 换护盾的间隔(秒):护盾在「只吃近战」和「只吃远程」之间来回切 */
  guardSeconds: number;
  /** 招式之间的间歇(秒),越小越凶 */
  restSeconds: number;
  /** 是不是章节中段的弱化版 */
  mini: boolean;
}

export interface BossInfo {
  name: string;
  emoji: string;
  /** 战前的一句话介绍 */
  taunt: string;
  color: string;
}

export const BOSSES: BossInfo[] = [
  { name: "棉花糖巨兽", emoji: "🍡", taunt: "软绵绵的大家伙挡住了城门,它护甲一亮就换人打!", color: "#F4A6C4" },
  { name: "森林大蜂后", emoji: "🐝", taunt: "蜂后飞得又高又快,公主的星星是主力,王子瞅准落地那一下!", color: "#EBC55C" },
  { name: "水晶石巨人", emoji: "🗿", taunt: "石巨人的水晶壳硬得很,亮蓝壳时只有剑劈得动!", color: "#7FA9D6" },
  { name: "云端大风筝", emoji: "🪁", taunt: "大风筝一头扎下来就快闪开,它落地那会儿最好打!", color: "#8FC7EA" },
  { name: "火山炎龙", emoji: "🐲", taunt: "炎龙吐的火球会连成一排,先躲开再靠近!", color: "#EE8B5C" },
  { name: "冰雪雕像王", emoji: "⛄", taunt: "雕像王站在滑地板上,别冲太快,滑过头会撞上它!", color: "#9FD3EC" },
  { name: "暗影国王", emoji: "👑", taunt: "最后一战!国王换护盾换得飞快,两个人配合才拿得下。", color: "#8C7BC4" },
];

export type StageKind = "campaign" | "endless";

export interface LevelDef {
  kind: StageKind;
  /** 战役里的 0 基关号;无尽用轮次号 */
  index: number;
  chapterIndex: number;
  name: string;
  feature: string;
  hint: string;
  len: number;
  goalX: number;
  gaps: Gap[];
  platforms: PlatformDef[];
  enemies: EnemyDef[];
  spikes: SpikeDef[];
  gems: GemDef[];
  boss: BossDef | null;
  /** 冰面:松手还会往前溜一段 */
  slippery: boolean;
  /** 城门打开需要打倒的小怪比例(0..1);首领关看首领 */
  requiredRatio: number;
  /** 三星标准之一:标准用时(秒) */
  parSeconds: number;
  /** 三星标准之一:星星宝石收集数 */
  gemGoal: number;
  /** 本关时间上限(秒);0 表示不限时 */
  timeLimit: number;
  /** 两人共享的心数 */
  hearts: number;
  /** 需要两个人都站到城门前 */
  goalNeedsAll: boolean;
}

// ---------------------------------------------------------------------------
// 生成器
// ---------------------------------------------------------------------------

type FeatureKind =
  | "slime"
  | "bat"
  | "armor"
  | "ghost"
  | "turret"
  | "gap"
  | "platform"
  | "movePlat"
  | "spike"
  | "gem";

interface ChapterKit {
  /** 加权特征池:同一个词出现几次就是几倍权重 */
  pool: FeatureKind[];
  slippery: boolean;
  spots: string[];
  feature: string;
  hint: string;
}

const KITS: ChapterKit[] = [
  {
    pool: ["slime", "slime", "slime", "slime", "gem", "gem", "gap", "platform"],
    slippery: false,
    spots: ["吊桥前", "花园小径", "喷泉边", "石阶下", "旗杆旁", "马厩口", "钟塔脚", "城门前"],
    feature: "剑与星星",
    hint: "王子按攻击键挥剑,公主按攻击键放星星;踩在果冻怪头上也能把它弹开。",
  },
  {
    pool: ["slime", "slime", "bat", "bat", "bat", "gem", "gem", "platform", "platform", "gap"],
    slippery: false,
    spots: ["林间道", "萤火坡", "老橡树", "蘑菇圈", "溪流边", "藤蔓桥", "松塔林", "星空台"],
    feature: "空中小蝙蝠",
    hint: "蝙蝠飞得高,公主的星星够得着;王子想砍就得先跳起来。",
  },
  {
    pool: ["slime", "armor", "armor", "armor", "turret", "turret", "gem", "gem", "platform", "gap"],
    slippery: false,
    spots: ["矿车道", "水晶柱", "回声厅", "钟乳廊", "地下湖", "宝石堆", "矿灯下", "深洞口"],
    feature: "铠甲怪与炮台",
    hint: "铠甲怪会弹开星星,交给王子的剑;炮台吐弹的间隙冲上去最安全。",
  },
  {
    pool: ["gap", "gap", "platform", "platform", "movePlat", "movePlat", "bat", "slime", "gem", "gem"],
    slippery: false,
    spots: ["云梯口", "浮岛群", "风之谷", "彩虹桥", "白云坪", "气流带", "断崖边", "云顶台"],
    feature: "浮台与断口",
    hint: "浮台飘到脚边再跳。公主有二段跳,半空中还能再蹬一下。",
  },
  {
    pool: ["spike", "spike", "turret", "turret", "slime", "slime", "armor", "gap", "gem", "platform"],
    slippery: false,
    spots: ["岩浆滩", "焦石坡", "喷发口", "黑曜台", "热风道", "熔岩桥", "火山腹", "赤红门"],
    feature: "尖刺与火球",
    hint: "尖刺踩不得,跳过去;火球是直线飞的,蹲不掉就跳开。",
  },
  {
    pool: ["ghost", "ghost", "ghost", "slime", "slime", "platform", "gem", "gem", "gap", "turret"],
    slippery: true,
    spots: ["雪松林", "冰湖面", "雪屋旁", "冻瀑布", "白熊坡", "风雪口", "冰晶塔", "极光台"],
    feature: "滑地板与幽灵",
    hint: "地板滑,松手也会往前溜;幽灵不怕剑,交给公主的星星。",
  },
  {
    pool: ["slime", "bat", "armor", "ghost", "turret", "spike", "gap", "platform", "movePlat", "gem"],
    slippery: false,
    spots: ["黑铁门", "影之廊", "残破厅", "王座阶", "暗窗下", "旧战场", "钟摆廊", "王座前"],
    feature: "全员混战",
    hint: "什么怪都有:铠甲怪找王子,幽灵找公主,换人要快。",
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

/** 这一章的中段首领在第几关(章内 0 基序号) */
export function miniBossPos(ci: number): number {
  return Math.floor(CHAPTERS[ci].size / 2);
}

/** 这一关是不是首领关;是的话返回 "mini" 或 "chapter" */
export function bossSlotOf(level: number): "mini" | "chapter" | null {
  const ci = chapterIndexOf(level);
  const pos = indexInChapterOf(level);
  if (pos === CHAPTERS[ci].size - 1) return "chapter";
  if (pos === miniBossPos(ci)) return "mini";
  return null;
}

/** 全部首领关的关号(0 基,升序) */
export function bossLevels(): number[] {
  const out: number[] = [];
  for (let lv = 0; lv < TOTAL; lv++) if (bossSlotOf(lv)) out.push(lv);
  return out;
}

function pickFrom<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

interface Builder {
  gaps: Gap[];
  platforms: PlatformDef[];
  enemies: EnemyDef[];
  spikes: SpikeDef[];
  gems: GemDef[];
  groundGems: number;
}

function emptyBuilder(): Builder {
  return { gaps: [], platforms: [], enemies: [], spikes: [], gems: [], groundGems: 0 };
}

/** x 处是否落在某个断口里 */
export function inAnyGap(gaps: readonly Gap[], x: number): boolean {
  return gaps.some((g) => x > g.x0 - 14 && x < g.x1 + 14);
}

/** x 处有没有实心地面 */
export function groundSolidAt(def: Pick<LevelDef, "gaps" | "len">, x: number): boolean {
  if (x < 0 || x > def.len) return false;
  return !def.gaps.some((g) => x > g.x0 && x < g.x1);
}

/** 一关里要打倒的小怪总数 */
export function enemyCount(def: Pick<LevelDef, "enemies">): number {
  return def.enemies.length;
}

/**
 * 沿着 x 轴从左往右摆机关:每摆一个就把游标推过它自己的宽度再加安全间距,
 * 所以断口永远不会压在怪身上,地面怪也永远站得到实地上。
 */
function walk(
  b: Builder,
  rand: () => number,
  kit: ChapterKit,
  opts: { from: number; to: number; density: number; enemySpeed: number; gapMax: number }
): void {
  let x = opts.from;
  const step = Math.max(104, 226 - opts.density * 76);
  let guard = 0;
  while (x < opts.to && guard++ < 400) {
    const feat = pickFrom(rand, kit.pool);
    switch (feat) {
      case "slime": {
        const span = randInt(rand, 30, 72);
        b.enemies.push({ kind: "slime", x, minX: x - span, maxX: x + span, speed: opts.enemySpeed, y: 0 });
        x += span + step;
        break;
      }
      case "armor": {
        const span = randInt(rand, 26, 56);
        b.enemies.push({
          kind: "armor",
          x,
          minX: x - span,
          maxX: x + span,
          speed: Math.round(opts.enemySpeed * 0.7),
          y: 0,
        });
        // 铠甲怪身边留出一块空地,方便王子绕到侧面
        x += span + step + 50;
        break;
      }
      case "bat": {
        const span = randInt(rand, 50, 110);
        b.enemies.push({
          kind: "bat",
          x,
          minX: x - span,
          maxX: x + span,
          speed: opts.enemySpeed + randInt(rand, 10, 40),
          y: -randInt(rand, 74, 116),
        });
        x += span + step;
        break;
      }
      case "ghost": {
        const span = randInt(rand, 40, 90);
        b.enemies.push({
          kind: "ghost",
          x,
          minX: x - span,
          maxX: x + span,
          speed: Math.round(opts.enemySpeed * 0.8),
          y: -randInt(rand, 40, 76),
        });
        x += span + step + 30;
        break;
      }
      case "turret": {
        b.enemies.push({ kind: "turret", x, minX: x, maxX: x, speed: 0, y: 0 });
        x += step + 90;
        break;
      }
      case "gap": {
        const g = randInt(rand, MIN_GAP, opts.gapMax);
        b.gaps.push({ x0: x, x1: x + g });
        // 断口对面放一颗宝石当奖励,跳过去顺手就吃到
        b.gems.push({ x: x + g + 44, y: -46, ground: true });
        b.groundGems++;
        x += g + step + 24;
        break;
      }
      case "platform": {
        const w = randInt(rand, 116, 172);
        const py = -randInt(rand, 58, MAX_PLATFORM_RISE);
        b.platforms.push({ x, y: py, w, kind: "solid" });
        b.gems.push({ x: x + w * 0.34, y: py - 40, ground: false });
        b.gems.push({ x: x + w * 0.7, y: py - 40, ground: false });
        x += w + step - 26;
        break;
      }
      case "movePlat": {
        const w = randInt(rand, 104, 142);
        const py = -randInt(rand, 56, MAX_PLATFORM_RISE);
        b.platforms.push({
          x,
          y: py,
          w,
          kind: "move",
          range: randInt(rand, 48, 88),
          speed: 42 + randInt(rand, 0, 28),
        });
        b.gems.push({ x: x + w * 0.5, y: py - 42, ground: false });
        x += w + step + 44;
        break;
      }
      case "spike": {
        const w = randInt(rand, 40, 74);
        b.spikes.push({ x, w });
        x += w + step;
        break;
      }
      case "gem": {
        b.gems.push({ x, y: -46, ground: true });
        b.groundGems++;
        x += step - 30;
        break;
      }
      default:
        x += step;
        break;
    }

    // 空隙里再撒一颗地面宝石,让主路一直有东西可捡
    if (rand() < 0.5) {
      const gx = x - step * 0.42;
      if (gx > opts.from && gx < opts.to && !inAnyGap(b.gaps, gx)) {
        b.gems.push({ x: gx, y: -46, ground: true });
        b.groundGems++;
      }
    }
  }
}

/**
 * 兜底:每段路至少三只怪、三颗宝石,免得随机结果太稀,一关变成空跑一趟。
 */
function ensureMinimums(b: Builder, len: number, speed: number): void {
  const def = { gaps: b.gaps, len };
  let fill = 0;
  while (b.enemies.length < 3 && fill++ < 8) {
    const x = START_PAD + 150 * (fill + 1);
    if (x >= len - GOAL_INSET - 90 || !groundSolidAt(def, x)) continue;
    // 巡逻段也得整段踩得到实地:够不到 40 就把来回的范围收窄,收到 0 就让它站着不动
    let span = 40;
    while (span > 0 && !(groundSolidAt(def, x - span) && groundSolidAt(def, x + span))) span -= 8;
    b.enemies.push({ kind: "slime", x, minX: x - span, maxX: x + span, speed, y: 0 });
  }
  let gem = 0;
  while (b.gems.length < 3 && gem++ < 8) {
    const x = START_PAD + 130 * (gem + 1);
    if (x < len - GOAL_INSET - 90 && groundSolidAt({ gaps: b.gaps, len }, x)) {
      b.gems.push({ x, y: -46, ground: true });
      b.groundGems++;
    }
  }
}

/** 尖刺不许压在断口上,也不许压在起跑区 */
function trimSpikes(b: Builder): void {
  b.spikes = b.spikes.filter((s) => s.x > START_PAD && !inAnyGap(b.gaps, s.x) && !inAnyGap(b.gaps, s.x + s.w));
}

/** 地面怪不许站在断口上 */
function trimEnemies(b: Builder, len: number): void {
  b.enemies = b.enemies.filter((e) => {
    if (e.y < 0) return true;
    const def = { gaps: b.gaps, len };
    return groundSolidAt(def, e.minX) && groundSolidAt(def, e.maxX) && groundSolidAt(def, e.x);
  });
}

function levelName(rand: () => number, ci: number): string {
  return `${CHAPTERS[ci].name}·${pickFrom(rand, KITS[ci].spots)}`;
}

// ---------------------------------------------------------------------------
// 首领关
// ---------------------------------------------------------------------------

function buildBossLevel(lv: number, ci: number, mini: boolean, rand: () => number, t: number): LevelDef {
  const kit = KITS[ci];
  const info = BOSSES[ci];
  const len = ARENA_LEN + (mini ? 0 : 220);
  const b = emptyBuilder();

  // 擂台两侧各一块跳台:躲冲锋、也给王子一个跳起来砍高处的落脚点
  b.platforms.push({ x: 420, y: -78, w: 150, kind: "solid" });
  b.platforms.push({ x: len - 620, y: -78, w: 150, kind: "solid" });
  b.gems.push({ x: 480, y: -122, ground: false });
  b.gems.push({ x: len - 560, y: -122, ground: false });
  for (let i = 0; i < 4; i++) {
    b.gems.push({ x: 620 + i * 170, y: -46, ground: true });
    b.groundGems++;
  }
  // 陪练小怪:中段首领只带一只,章节首领带两只
  const helpers = mini ? 1 : 2;
  for (let i = 0; i < helpers; i++) {
    const x = 700 + i * 320;
    b.enemies.push({ kind: "slime", x, minX: x - 60, maxX: x + 60, speed: 46 + ci * 4, y: 0 });
  }

  const hp = mini ? 34 + ci * 8 : 52 + ci * 13;
  return {
    kind: "campaign",
    index: lv,
    chapterIndex: ci,
    name: `${mini ? "小" : ""}首领 · ${info.name}`,
    feature: `${info.emoji} 首领战`,
    hint: `${info.taunt}护甲亮红色时只有王子的剑打得动,亮蓝色时只有公主的星星打得动。`,
    len,
    goalX: len - GOAL_INSET,
    gaps: [],
    platforms: b.platforms,
    enemies: b.enemies,
    spikes: [],
    gems: b.gems,
    boss: {
      kind: ci,
      x: len - 520,
      hp,
      guardSeconds: mini ? 7.5 - ci * 0.3 : 6 - ci * 0.35,
      restSeconds: mini ? 1.7 : Math.max(0.85, 1.4 - t * 0.35),
      mini,
    },
    slippery: kit.slippery,
    requiredRatio: 0,
    parSeconds: Math.round((mini ? 42 : 58) + ci * 4),
    gemGoal: Math.max(1, Math.ceil(b.groundGems * 0.6)),
    timeLimit: mini ? 190 : 240,
    hearts: 6,
    goalNeedsAll: false,
  };
}

// ---------------------------------------------------------------------------
// 战役
// ---------------------------------------------------------------------------

/**
 * 生成战役第 index 关(0 基)。同一个关号每次生成的结果完全一样。
 */
export function buildLevel(index: number): LevelDef {
  const lv = Math.max(0, Math.min(TOTAL - 1, Math.round(index)));
  const ci = chapterIndexOf(lv);
  const pos = indexInChapterOf(lv);
  const kit = KITS[ci];
  const rand = mulberry32(0x7a0000 + lv * 7919 + 29);
  const t = TOTAL > 1 ? lv / (TOTAL - 1) : 0;

  const slot = bossSlotOf(lv);
  if (slot) return buildBossLevel(lv, ci, slot === "mini", rand, t);

  const len = Math.round(1780 + ci * 190 + pos * 20);
  const b = emptyBuilder();
  walk(b, rand, kit, {
    from: START_PAD,
    to: len - GOAL_INSET - 190,
    density: 0.18 + t * 0.82,
    enemySpeed: 40 + Math.round(t * 42),
    gapMax: Math.min(MAX_GAP, 72 + ci * 7 + Math.round(pos * 0.5)),
  });
  trimSpikes(b);
  trimEnemies(b, len);
  ensureMinimums(b, len, 40 + Math.round(t * 42));

  const foes = b.enemies.length;
  const parSeconds = Math.round(len / 175 + foes * 1.9 + 8);

  return {
    kind: "campaign",
    index: lv,
    chapterIndex: ci,
    name: levelName(rand, ci),
    feature: kit.feature,
    hint: kit.hint,
    len,
    goalX: len - GOAL_INSET,
    gaps: b.gaps,
    platforms: b.platforms,
    enemies: b.enemies,
    spikes: b.spikes,
    gems: b.gems,
    boss: null,
    slippery: kit.slippery,
    requiredRatio: Math.min(0.85, 0.5 + t * 0.35),
    parSeconds,
    gemGoal: Math.max(1, Math.ceil(b.groundGems * 0.7)),
    timeLimit: Math.round(parSeconds * 2.6 + 30),
    hearts: 6,
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

// ---------------------------------------------------------------------------
// 无尽模式:王国远征
// ---------------------------------------------------------------------------

/**
 * 无尽模式第 round 段路(0 基)。段落一段接一段地往前接,越往后越长、越挤;
 * 每第 5 段安排一场首领,打赢了补一颗心。
 */
export function buildEndless(round: number): LevelDef {
  const r = Math.max(0, Math.round(round));
  const rand = mulberry32(0x5ee700 + r * 104729 + 11);
  const ci = r % KITS.length;
  const kit = KITS[ci];
  const isBoss = r > 0 && r % 5 === 4;

  if (isBoss) {
    const def = buildBossLevel(r, ci, true, rand, Math.min(1, r / 20));
    return {
      ...def,
      kind: "endless",
      index: r,
      name: `远征首领 · ${BOSSES[ci].name}`,
      hint: "远征路上的首领!打倒它就能补一颗心,继续往前。",
      timeLimit: 0,
      hearts: def.hearts,
    };
  }

  const len = 2200 + Math.min(1700, r * 165);
  const b = emptyBuilder();
  walk(b, rand, kit, {
    from: START_PAD,
    to: len - GOAL_INSET - 170,
    density: Math.min(1, 0.32 + r * 0.075),
    enemySpeed: 44 + Math.min(46, r * 5),
    gapMax: Math.min(MAX_GAP, 78 + r * 4),
  });
  trimSpikes(b);
  trimEnemies(b, len);
  ensureMinimums(b, len, 44 + Math.min(46, r * 5));

  return {
    kind: "endless",
    index: r,
    chapterIndex: ci,
    name: `第 ${r + 1} 段 · ${CHAPTERS[ci].name}`,
    feature: kit.feature,
    hint: "一路向前!打倒的怪越多、宝石捡得越多,分数越高。",
    len,
    goalX: len - GOAL_INSET,
    gaps: b.gaps,
    platforms: b.platforms,
    enemies: b.enemies,
    spikes: b.spikes,
    gems: b.gems,
    boss: null,
    slippery: kit.slippery,
    // 远征段要清掉六成怪才通往下一段,不然「无尽」就只剩埋头跑
    requiredRatio: 0.6,
    parSeconds: Math.round(len / 175 + 10),
    gemGoal: Math.max(1, b.groundGems),
    timeLimit: 0,
    hearts: 6,
    goalNeedsAll: false,
  };
}
