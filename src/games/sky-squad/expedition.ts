/**
 * 飞机小队 —— 无尽「云海远征」(纯逻辑,零 DOM)。
 *
 * 1.1 的无尽是三条线性曲线加一个道具循环:飞到第 20 波和第 3 波长得一样,
 * 只是数字大了点。1.2 换成**段落拼接**:
 *
 *   1. 手写一张段落表(`SEGMENTS`),每段有自己的编队骨架、弹幕图案与配色;
 *   2. `expeditionPlan(seed, n)` 用确定性随机把段落拼成一条航线,
 *      同一颗种子拼出来的航线**永远一模一样**(能复盘、能分享、能测);
 *   3. 难度沿 `difficultyAt` 这条曲线走,而且每隔几段必有一段「补给云」——
 *      喘口气 + 白送一个升级,不会一路被压到崩。
 *
 * 成绩仍旧走 `save.recordEndlessBest("sky-squad", n)`。
 */
import { mulberry32 } from "../level99";
import type { PatternDecl } from "./bullets";
import type { FoeKind } from "./logic";
import type { PowerTrack } from "./power";

export type SegmentId = "ladder" | "ribbon" | "candy" | "ring-field" | "lantern" | "supply";

export interface SegmentDef {
  id: SegmentId;
  name: string;
  emoji: string;
  /** 这一段的天空底色 */
  tint: string;
  /** 这一段的敌机骨架 */
  kinds: FoeKind[];
  /** 一段里飞几小波 */
  waves: number;
  /** 每小波几架(还会乘难度) */
  baseFoes: number;
  /** 这一段的弹幕图案(声明式,直接喂 compileDecl) */
  fire: PatternDecl;
  /** 一句话预告 */
  call: string;
}

/**
 * 段落表。六段各有各的读法,拼起来才会「一段一段不一样」。
 * 最后一段 `supply` 是补给云:不发弹,只送升级。
 */
export const SEGMENTS: SegmentDef[] = [
  {
    id: "ladder",
    name: "云梯",
    emoji: "☁️",
    tint: "#E7F0FF",
    kinds: ["scout", "puff"],
    waves: 3,
    baseFoes: 4,
    fire: { pattern: "fan", count: 3, speed: 104, arc: 60, interval: 1.8, warn: 0.36 },
    call: "云梯一级一级往上,扇形弹从上面撒下来。",
  },
  {
    id: "ribbon",
    name: "彩带流",
    emoji: "🎀",
    tint: "#FFEDF6",
    kinds: ["scout", "kite"],
    waves: 3,
    baseFoes: 5,
    fire: { pattern: "spiral", count: 8, speed: 112, rotate: 28, interval: 0.36, warn: 0.3 },
    call: "彩带绕着圈飘,螺旋弹顺着一个方向转。",
  },
  {
    id: "candy",
    name: "糖豆雨云",
    emoji: "🍬",
    tint: "#FFF1DF",
    kinds: ["puff", "kite"],
    waves: 2,
    baseFoes: 6,
    fire: { pattern: "rain", count: 4, speed: 118, interval: 1.2, warn: 0.32 },
    call: "糖豆一条一条落,泳道之间永远有安全带。",
  },
  {
    id: "ring-field",
    name: "光环原",
    emoji: "🌀",
    tint: "#EAF6FA",
    kinds: ["puff", "tanker"],
    waves: 2,
    baseFoes: 4,
    fire: { pattern: "ring", count: 11, speed: 102, rotate: 16, interval: 2, warn: 0.4 },
    call: "光环一圈一圈铺开,站在两圈中间最舒服。",
  },
  {
    id: "lantern",
    name: "灯笼道",
    emoji: "🏮",
    tint: "#F3ECFC",
    kinds: ["kite", "tanker"],
    waves: 3,
    baseFoes: 5,
    fire: { pattern: "cross", count: 8, speed: 108, rotate: 22, interval: 1.5, warn: 0.34 },
    call: "灯笼排成一路,十字弹的四条胳膊之间是空的。",
  },
  {
    id: "supply",
    name: "补给云",
    emoji: "🎁",
    tint: "#EDFBF2",
    kinds: ["scout"],
    waves: 1,
    baseFoes: 3,
    fire: { pattern: "fan", count: 1, speed: 90, arc: 30, interval: 3.2, warn: 0.5 },
    call: "补给云!这一段很松,顺手把升级捡了。",
  },
];

export const SUPPLY_EVERY = 4;

/** 段落 id → 段落定义 */
export function segmentById(id: SegmentId): SegmentDef {
  return SEGMENTS.find((s) => s.id === id) ?? SEGMENTS[0];
}

/**
 * 难度曲线:前几段爬得慢(给孩子上手),中段稳步走,后段封顶。
 * 单调不减、有上界 —— 这两条都写成了断言。
 */
export function difficultyAt(index: number): number {
  const i = Math.max(0, Math.floor(index));
  return Math.round(Math.min(2.6, 1 + Math.log2(1 + i * 0.6) * 0.42) * 100) / 100;
}

export interface Leg {
  /** 第几段(0 基) */
  index: number;
  segment: SegmentDef;
  difficulty: number;
  /** 这一段一共几小波 */
  waves: number;
  /** 每小波几架 */
  foesPerWave: number;
  /** 敌机开火间隔(秒),有下限 */
  fireGap: number;
  /** 这一段结束时白送的升级(没有就是 null) */
  reward: PowerTrack | null;
}

const REWARD_CYCLE: PowerTrack[] = ["spread", "wing", "homing", "pierce"];

/**
 * 拼出第 index 段(0 基)。同一颗种子 + 同一个序号 → 永远同一段。
 * 每 `SUPPLY_EVERY` 段固定塞一段补给云,不受随机影响。
 */
export function legAt(seed: number, index: number): Leg {
  const i = Math.max(0, Math.floor(index));
  const supply = i > 0 && i % SUPPLY_EVERY === SUPPLY_EVERY - 1;
  const pickable = SEGMENTS.filter((s) => s.id !== "supply");
  const rand = mulberry32((seed >>> 0) + i * 2654435761);
  // 连着两段不重样:上一段抽中的从这一段的候选里剔掉
  let pool = pickable;
  if (i > 0) {
    const prev = legSegmentId(seed, i - 1);
    const trimmed = pickable.filter((s) => s.id !== prev);
    if (trimmed.length > 0) pool = trimmed;
  }
  const segment = supply ? segmentById("supply") : pool[Math.floor(rand() * pool.length) % pool.length];
  const difficulty = difficultyAt(i);
  return {
    index: i,
    segment,
    difficulty,
    waves: segment.waves,
    foesPerWave: Math.min(11, Math.round(segment.baseFoes * (supply ? 1 : difficulty))),
    fireGap: supply ? 3 : Math.max(0.95, 2.5 - difficulty * 0.55),
    reward: supply ? REWARD_CYCLE[Math.floor(i / SUPPLY_EVERY) % REWARD_CYCLE.length] : null,
  };
}

/** 只算「第 i 段抽中哪个段落」,给「连着两段不重样」自己回溯一步用 */
function legSegmentId(seed: number, index: number): SegmentId {
  if (index > 0 && index % SUPPLY_EVERY === SUPPLY_EVERY - 1) return "supply";
  const pickable = SEGMENTS.filter((s) => s.id !== "supply");
  const rand = mulberry32((seed >>> 0) + index * 2654435761);
  return pickable[Math.floor(rand() * pickable.length) % pickable.length].id;
}

/** 一整条航线的前 n 段(纯函数,可复现) */
export function expeditionPlan(seed: number, n: number): Leg[] {
  const out: Leg[] = [];
  for (let i = 0; i < Math.max(0, Math.floor(n)); i++) out.push(legAt(seed, i));
  return out;
}

/** 远征成绩:段数是大头,打下来的小飞机是零头,擦弹给一点点甜头 */
export function expeditionScore(legs: number, downed: number, grazes: number): number {
  return Math.max(0, Math.floor(legs - 1)) * 150 + Math.max(0, downed) * 8 + Math.min(300, Math.max(0, grazes) * 2);
}

/** 航线小结:给结算面板念的一句话(只鼓励,不训人) */
export function expeditionLine(legs: number, downed: number, grazes: number): string {
  const far = segmentById(legAt(1, Math.max(0, legs - 1)).segment.id);
  if (legs <= 1) return `第一段${far.emoji}${far.name}就飞了 ${downed} 架下来,起飞这一步已经很稳啦。`;
  if (grazes >= 12) return `一路飞过 ${legs} 段,擦弹 ${grazes} 次还全身而退 —— 你已经敢贴着弹走了!`;
  return `一路飞过 ${legs} 段云海,请回机库 ${downed} 架小飞机。下一趟试试贴着弹边走,擦弹也有分。`;
}
