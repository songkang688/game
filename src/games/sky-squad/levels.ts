/**
 * 飞机小队的 188 关战役:八片天空,每片天空的最后一关是一位多阶段大 Boss。
 * 所有关卡都由确定性随机生成,同一关每次都是同一份编队,可测可复现。
 */
import { mulberry32, randInt, type Chapter } from "../level99";
import { makeSpec, type BossSpec, type PatternSpec, type PhaseSpec } from "./bullets";
import type { FoeKind, PickupKind } from "./logic";

export const CHAPTERS: Chapter[] = [
  { name: "晴空起飞", emoji: "☁️", color: "#E3F1FF", desc: "先熟悉操纵和三种主武器,云很软,敌机很少。", size: 24 },
  { name: "彩虹峡谷", emoji: "🌈", color: "#FFE7F3", desc: "峡谷里回旋的螺旋弹,绕着圈慢慢转。", size: 24 },
  { name: "齿轮天空", emoji: "⚙️", color: "#EDEAF6", desc: "一排排往下压的缺口墙,认准缝再钻。", size: 24 },
  { name: "糖果雨云", emoji: "🍭", color: "#FFEDD9", desc: "糖豆一样的落雨弹,泳道之间永远有安全带。", size: 24 },
  { name: "极光冰原", emoji: "❄️", color: "#E4F6FB", desc: "环形弹一圈一圈铺开,站位比手速重要。", size: 24 },
  { name: "沙海古港", emoji: "🏜️", color: "#FBEFD8", desc: "扫射弹来回横扫,跟着它的节奏走反方向。", size: 24 },
  { name: "星尘轨道", emoji: "✨", color: "#EAE6FA", desc: "两套弹幕叠在一起,先看清哪套是主旋律。", size: 22 },
  { name: "月亮总站", emoji: "🌙", color: "#E7ECFB", desc: "全部机制混编,这是小队长的毕业考。", size: 22 },
];

// ---------------------------------------------------------------------------
// 八位大 Boss(每位三个阶段)
// ---------------------------------------------------------------------------

function phase(
  name: string,
  until: number,
  color: string,
  shout: string,
  swing: number,
  patterns: PatternSpec[]
): PhaseSpec {
  return { name, until, color, shout, swing, patterns };
}

export const BOSSES: BossSpec[] = [
  {
    id: "cotton-carrier",
    name: "棉花云航母",
    emoji: "☁️",
    hp: 60,
    phases: [
      phase("散步棉花", 0.66, "#DCEBFB", "棉花云慢慢摊开啦,先看清扇形的缝。", 90, [
        makeSpec("fan", { count: 7, speed: 108, radius: 12, interval: 1.7, spread: Math.PI * 0.55 }),
      ]),
      phase("棉花墙", 0.33, "#CFE3F7", "它把棉花排成一堵墙,缺口每次都会挪一挪。", 60, [
        makeSpec("wall", { count: 10, speed: 96, radius: 13, interval: 2, gaps: 2 }),
      ]),
      phase("棉花花环", 0, "#C3DAF2", "最后一段是花环加小雨,沿着边上绕就行。", 110, [
        makeSpec("ring", { count: 11, speed: 100, radius: 11, interval: 2.1, rotate: 0.3 }),
        makeSpec("rain", { count: 4, speed: 118, radius: 12, interval: 1.9, delay: 0.9 }),
      ]),
    ],
  },
  {
    id: "rainbow-top",
    name: "彩虹陀螺",
    emoji: "🌈",
    hp: 72,
    phases: [
      phase("慢转陀螺", 0.66, "#FFE0EF", "陀螺转起来了,螺旋弹其实很好数。", 70, [
        makeSpec("spiral", { count: 8, speed: 112, radius: 12, interval: 0.34, rotate: 0.52 }),
      ]),
      phase("反转陀螺", 0.33, "#FFD3E8", "它换了个方向转,你也跟着换边。", 100, [
        makeSpec("spiral", { count: 12, speed: 116, radius: 11, interval: 0.32, rotate: -0.58 }),
      ]),
      phase("彩虹光环", 0, "#FFC7E0", "光环加扫射,贴着光环的缝走。", 120, [
        makeSpec("ring", { count: 12, speed: 104, radius: 11, interval: 2, rotate: 0.26 }),
        makeSpec("sweep", { count: 3, speed: 128, radius: 12, interval: 1.5, delay: 0.7 }),
      ]),
    ],
  },
  {
    id: "clock-tower",
    name: "发条大钟",
    emoji: "🕰️",
    hp: 84,
    phases: [
      phase("整点报时", 0.66, "#E6E2F5", "钟摆一晃就是一堵墙,缺口在往一边走。", 80, [
        makeSpec("wall", { count: 11, speed: 104, radius: 13, interval: 1.9, gaps: 2 }),
      ]),
      phase("摆锤扫过", 0.33, "#DCD6F0", "摆锤扫射来回摆,你走它的反方向。", 130, [
        makeSpec("sweep", { count: 4, speed: 132, radius: 12, interval: 1.15 }),
      ]),
      phase("发条全开", 0, "#D0C8EA", "墙加环一起来,先钻墙缝再绕环。", 100, [
        makeSpec("wall", { count: 10, speed: 98, radius: 12, interval: 2.3, gaps: 2 }),
        makeSpec("ring", { count: 10, speed: 108, radius: 11, interval: 2.4, rotate: 0.34, delay: 1.1 }),
      ]),
    ],
  },
  {
    id: "lolly-tower",
    name: "棒棒糖旋塔",
    emoji: "🍭",
    hp: 96,
    phases: [
      phase("糖霜螺旋", 0.66, "#FFE8D2", "糖霜绕成螺旋,顺着一个方向跑就好。", 90, [
        makeSpec("spiral", { count: 10, speed: 118, radius: 12, interval: 0.3, rotate: 0.46 }),
      ]),
      phase("糖豆雨", 0.33, "#FFDDBE", "糖豆雨永远给你留四条泳道。", 70, [
        makeSpec("rain", { count: 6, speed: 126, radius: 13, interval: 1.15 }),
      ]),
      phase("旋塔加班", 0, "#FFD2AA", "螺旋加缺口墙,数着缺口走。", 120, [
        makeSpec("spiral", { count: 8, speed: 112, radius: 11, interval: 0.4, rotate: 0.5 }),
        makeSpec("wall", { count: 10, speed: 92, radius: 12, interval: 2.6, gaps: 2, delay: 1.3 }),
      ]),
    ],
  },
  {
    id: "ice-kite",
    name: "冰晶风筝",
    emoji: "❄️",
    hp: 104,
    phases: [
      phase("冰花绽放", 0.66, "#E1F4FA", "冰花是一圈一圈的,站在两圈中间最安全。", 100, [
        makeSpec("ring", { count: 13, speed: 106, radius: 12, interval: 1.7, rotate: 0.28 }),
      ]),
      phase("冰墙推进", 0.33, "#D3EDF7", "冰墙压下来了,提前站到缺口那边。", 60, [
        makeSpec("wall", { count: 12, speed: 100, radius: 12, interval: 1.9, gaps: 2 }),
      ]),
      phase("极光合奏", 0, "#C5E6F4", "冰花配上极光扫射,别贪打,先躲。", 130, [
        makeSpec("ring", { count: 11, speed: 104, radius: 11, interval: 2.1, rotate: -0.3 }),
        makeSpec("sweep", { count: 4, speed: 130, radius: 12, interval: 1.4, delay: 0.8 }),
      ]),
    ],
  },
  {
    id: "sand-ark",
    name: "沙漏方舟",
    emoji: "⏳",
    hp: 116,
    phases: [
      phase("细沙落下", 0.66, "#FBEBD1", "细沙一条一条落,泳道之间就是路。", 80, [
        makeSpec("rain", { count: 6, speed: 120, radius: 13, interval: 1.1 }),
      ]),
      phase("沙暴扇面", 0.33, "#F8E2BF", "沙暴是扇形的,扇子边上最空。", 110, [
        makeSpec("fan", { count: 9, speed: 114, radius: 12, interval: 1.5, spread: Math.PI * 0.62 }),
      ]),
      phase("翻转沙漏", 0, "#F5D8AC", "沙雨加螺旋,一边绕一边找缝。", 120, [
        makeSpec("rain", { count: 5, speed: 118, radius: 12, interval: 1.4 }),
        makeSpec("spiral", { count: 8, speed: 110, radius: 11, interval: 0.42, rotate: 0.48, delay: 0.7 }),
      ]),
    ],
  },
  {
    id: "meteor-bot",
    name: "陨石球机器人",
    emoji: "🤖",
    hp: 128,
    phases: [
      phase("滚球预热", 0.66, "#EAE4FA", "陨石球先排成墙滚下来,认准缝。", 90, [
        makeSpec("wall", { count: 12, speed: 106, radius: 13, interval: 1.8, gaps: 2 }),
      ]),
      phase("碎星四射", 0.33, "#E1D8F6", "碎星是环形的,顺着圈跑不会撞。", 120, [
        makeSpec("ring", { count: 14, speed: 110, radius: 11, interval: 1.7, rotate: 0.24 }),
      ]),
      phase("陨石全开", 0, "#D6CBF2", "墙加扫射,先看墙缝再看扫射走向。", 140, [
        makeSpec("wall", { count: 11, speed: 98, radius: 12, interval: 2.4, gaps: 2 }),
        makeSpec("sweep", { count: 4, speed: 134, radius: 12, interval: 1.5, delay: 1.2 }),
      ]),
    ],
  },
  {
    id: "moon-lantern",
    name: "月亮大灯笼",
    emoji: "🌙",
    hp: 144,
    phases: [
      phase("灯笼摆动", 0.66, "#E8EDFC", "灯笼来回摆,扫射跟着摆,你走反方向。", 130, [
        makeSpec("sweep", { count: 5, speed: 132, radius: 12, interval: 1.1 }),
      ]),
      phase("月光螺旋", 0.33, "#DDE4FA", "月光转成螺旋,顺时针跟着走一圈。", 110, [
        makeSpec("spiral", { count: 12, speed: 118, radius: 11, interval: 0.3, rotate: 0.55 }),
      ]),
      phase("满月合唱", 0, "#D0DAF7", "满月是环加雨,这是最后一段,稳住!", 140, [
        makeSpec("ring", { count: 13, speed: 108, radius: 11, interval: 2, rotate: 0.3 }),
        makeSpec("rain", { count: 5, speed: 124, radius: 12, interval: 1.5, delay: 0.9 }),
      ]),
    ],
  },
];

// ---------------------------------------------------------------------------
// 普通关的编队
// ---------------------------------------------------------------------------

export type Formation = "line" | "vee" | "arc" | "column";

export interface FoeWave {
  kinds: FoeKind[];
  count: number;
  formation: Formation;
  speed: number;
  /** 这一波敌机的弹幕(数量都很小,主角是编队不是弹雨) */
  fire: PatternSpec;
  /** 这一波每架敌机的开火间隔 */
  fireGap: number;
}

export interface SortieDef {
  level: number;
  chapter: number;
  waves: FoeWave[];
  /** 章节最后一关才有 Boss */
  boss: BossSpec | null;
  /** 这一关会掉的道具(按顺序掉) */
  pickups: PickupKind[];
  hint: string;
}

const HINTS = [
  "机身判定点只有中间那一小块,看着挨到边其实没事。",
  "螺旋弹一直朝一个方向转,你跟着转就永远在缝里。",
  "缺口墙的缺口每次都往同一边挪一格,提前站过去。",
  "落雨弹永远留着好几条泳道,别站在正中间不动。",
  "环形弹一圈一圈铺开,站在两圈中间最舒服。",
  "扫射弹来回扫,你只要走它的反方向就永远躲得开。",
  "两套弹幕叠着来时,先躲快的那套,慢的还有时间。",
  "留一颗炸弹给 Boss 的最后一段,能省一架备用小飞机。",
];

function chapterOfLevel(level: number): number {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    acc += CHAPTERS[i].size;
    if (level < acc) return i;
  }
  return CHAPTERS.length - 1;
}

function startOfChapter(ci: number): number {
  let acc = 0;
  for (let i = 0; i < ci; i++) acc += CHAPTERS[i].size;
  return acc;
}

/** 章节 ci 的 Boss 关(0 基关号) */
export function bossLevelOf(ci: number): number {
  return startOfChapter(ci) + CHAPTERS[ci].size - 1;
}

/** 这一关是不是 Boss 关 */
export function isBossLevel(level: number): boolean {
  const ci = chapterOfLevel(level);
  return level === bossLevelOf(ci);
}

const FORMATIONS: Formation[] = ["line", "vee", "arc", "column"];

/** 普通关敌机的弹幕:比 Boss 稀薄得多,而且一样是低速大弹 */
function foeFire(ci: number, depth: number, rand: () => number): PatternSpec {
  const kinds = ["fan", "rain", "sweep", "wall"] as const;
  const kind = ci <= 1 ? "fan" : kinds[randInt(rand, 0, Math.min(3, 1 + Math.floor(ci / 2)))];
  return makeSpec(kind, {
    count: kind === "wall" ? 8 : kind === "rain" ? 3 : 2 + Math.floor(depth * 2),
    speed: 96 + ci * 5 + depth * 18,
    radius: 12,
    interval: Math.max(1.1, 2.4 - ci * 0.1 - depth * 0.3),
    spread: Math.PI * 0.35,
    gaps: 3,
    warn: 0.3,
  });
}

/**
 * 生成第 level 关(0 基)。章节的最后一关挂上该章 Boss。
 */
export function buildSortie(level: number): SortieDef {
  const lv = Math.max(0, Math.min(187, Math.floor(level)));
  const ci = chapterOfLevel(lv);
  const inCh = lv - startOfChapter(ci);
  const size = CHAPTERS[ci].size;
  const depth = size > 1 ? inCh / (size - 1) : 0;
  const rand = mulberry32(0x91c3 + lv * 2654435761);
  const boss = isBossLevel(lv) ? BOSSES[Math.min(ci, BOSSES.length - 1)] : null;

  const kindPool: FoeKind[] = ["scout"];
  if (ci >= 1 || depth > 0.4) kindPool.push("puff");
  if (ci >= 2) kindPool.push("kite");
  if (ci >= 4) kindPool.push("tanker");

  const waveCount = boss ? 1 : Math.min(4, 1 + Math.floor(depth * 2) + Math.floor(ci / 3));
  const waves: FoeWave[] = [];
  for (let w = 0; w < waveCount; w++) {
    const count = Math.min(9, 3 + Math.floor(depth * 3) + Math.floor(ci / 2) + (w > 0 ? 1 : 0));
    const picks: FoeKind[] = [];
    for (let i = 0; i < count; i++) picks.push(kindPool[randInt(rand, 0, kindPool.length - 1)]);
    waves.push({
      kinds: picks,
      count,
      formation: FORMATIONS[randInt(rand, 0, FORMATIONS.length - 1)],
      speed: 1 + ci * 0.05 + depth * 0.25,
      fire: foeFire(ci, depth, rand),
      fireGap: Math.max(1, 2.6 - ci * 0.12 - depth * 0.4),
    });
  }

  // 道具:每关最多两个,Boss 关一定给护盾,免得卡关
  const pickups: PickupKind[] = [];
  if (boss) {
    pickups.push("shield");
    if (ci >= 2) pickups.push("power");
  } else {
    const cycle: PickupKind[] = ["power", "shield", "bomb", "wing", "weapon", "power"];
    if (inCh % 3 === 1) pickups.push(cycle[(lv + ci) % cycle.length]);
    if (inCh % 6 === 4) pickups.push("power");
  }

  return {
    level: lv,
    chapter: ci,
    waves,
    boss,
    pickups,
    hint: boss ? `${boss.emoji} ${boss.name}有三段弹幕,每段的躲法都不一样。` : HINTS[ci],
  };
}

/** 无尽模式的一波编队(纯函数) */
export function buildEndlessWave(wave: number, kinds: readonly FoeKind[], count: number, speed: number): FoeWave {
  const rand = mulberry32(0x3b71 + wave * 40503);
  const picks: FoeKind[] = [];
  for (let i = 0; i < count; i++) picks.push(kinds[randInt(rand, 0, kinds.length - 1)]);
  return {
    kinds: picks,
    count,
    formation: FORMATIONS[randInt(rand, 0, FORMATIONS.length - 1)],
    speed,
    fire: makeSpec(wave % 3 === 0 ? "rain" : wave % 3 === 1 ? "fan" : "sweep", {
      count: 3,
      speed: 100 + Math.min(40, wave * 2),
      radius: 12,
      interval: Math.max(1.2, 2.4 - wave * 0.05),
      spread: Math.PI * 0.35,
    }),
    fireGap: Math.max(0.9, 2.4 - wave * 0.06),
  };
}

/** 编队里第 i 架飞机的出场位置(纯函数,便于测试与回放) */
export function formationSlot(formation: Formation, i: number, count: number, width: number): { x: number; y: number } {
  const n = Math.max(1, count);
  const f = n === 1 ? 0.5 : i / (n - 1);
  const inner = width * 0.72;
  const left = (width - inner) / 2;
  switch (formation) {
    case "line":
      return { x: left + inner * f, y: -40 - (i % 2) * 26 };
    case "vee":
      return { x: left + inner * f, y: -40 - Math.abs(f - 0.5) * 150 };
    case "arc":
      return { x: left + inner * f, y: -40 - Math.sin(f * Math.PI) * 120 };
    case "column":
    default:
      return { x: width * (0.3 + 0.4 * (i % 2)), y: -40 - i * 62 };
  }
}
