// 碰碰车大乱斗 · 188 关场地生成器(确定性:同一关每次布局完全一样)。
//
// 八个主题章节合计 188 关,章节和由 level99 的 assertTotal 兜底校验。
// 每一关给出:场地形状与护栏、加速带、滚桶障碍、对手阵容、限时与生命数。
// 生成器只吐数据,不画一个像素,所以「每一关的出生点都在场内、对手数量合理」
// 这类硬指标可以在单测里 188 关全量扫一遍。
import { TOTAL_LEVELS, mulberry32, type Chapter } from "../level99";
import type { AiLevel } from "./ai";
import {
  CAR_R,
  DAMP_PER_SEC,
  ENDLESS_REVIVES,
  makeHazard,
  type BoostPad,
  type EdgeName,
  type Field,
  type Hazard,
  type Slick,
  type Spinner,
} from "./logic";

export const CHAPTERS: Chapter[] = [
  { name: "新手车场", emoji: "🚗", color: "#ffe6ef", desc: "两侧有护栏,先练油门、刹车和撞人的角度", size: 24 },
  { name: "弹簧乐园", emoji: "🪀", color: "#e7f4e9", desc: "护栏会把车弹回来,学会借弹力反打", size: 24 },
  { name: "加速带广场", emoji: "⚡", color: "#fff3d9", desc: "地上有加速带,踩对了瞬间提速,踩错了直接冲下场", size: 24 },
  { name: "圆环擂台", emoji: "🎯", color: "#e6f0ff", desc: "圆形场地只有半圈护栏,得记住缺口在哪边", size: 24 },
  { name: "滚桶工地", emoji: "🛢️", color: "#f1eadd", desc: "来回滚的桶会把车顶飞,可以拿它当武器", size: 23 },
  { name: "星光冰面", emoji: "❄️", color: "#e5f2f8", desc: "冰面几乎不减速,提前松油门才刹得住", size: 23 },
  { name: "传送带迷阵", emoji: "🌀", color: "#f0e9fb", desc: "整片传送带朝着悬崖推,逆着它走才安全", size: 23 },
  { name: "冠军竞技场", emoji: "🏆", color: "#fde9dd", desc: "重量级对手登场,四台车围着你转", size: 23 },
];

/** 对手车手(全部是本作原创伙伴) */
export interface Foe {
  name: string;
  emoji: string;
  color: string;
  skill: AiLevel;
  /** 车重:越重越难被撞飞 */
  mass: number;
  r: number;
  /** 掉下去几次才退场 */
  lives: number;
}

const ROSTER = [
  { name: "糯糯", emoji: "🐰", color: "#f7a9c4" },
  { name: "云云", emoji: "☁️", color: "#8fb8e8" },
  { name: "闪闪", emoji: "⚡", color: "#f0c454" },
  { name: "绿绿豆", emoji: "🫛", color: "#7fc48d" },
  { name: "啾啾", emoji: "🐤", color: "#efc07a" },
  { name: "墩墩", emoji: "🐻", color: "#b78b6b" },
];

export interface CarLevel {
  /** 0 基关号;对战场与无尽波次用 -1 */
  index: number;
  chapter: number;
  field: Field;
  pads: BoostPad[];
  hazards: Hazard[];
  /** 旋转盘:踩上去车头被带着转 */
  spinners: Spinner[];
  /** 油渍:踩上去摩擦变小,一路滑过去 */
  slicks: Slick[];
  /** 每秒保留的速度比例(冰面关更高) */
  keep: number;
  spawn: { x: number; y: number };
  foeSpawns: Array<{ x: number; y: number }>;
  foes: Foe[];
  /** 同时冲着玩家来的对手上限,其余的在外圈等着轮换(免得一上来就被围殴) */
  hunters: number;
  /** 玩家掉几次就算输 */
  hearts: number;
  seconds: number;
  seed: number;
  hint: string;
}

// ---------------------------------------------------------------------------
// 场地骨架
// ---------------------------------------------------------------------------

const ALL_EDGES: EdgeName[] = ["top", "right", "bottom", "left"];

/** 按章节挑护栏:留下的开放边就是能把人撞下去的悬崖 */
export function springsFor(chapter: number, level: number): EdgeName[] {
  switch (chapter) {
    case 0:
      return ["left", "right"];
    case 1:
      // 三面护栏,缺口每关换一边,逼着孩子先看清楚哪边是悬崖
      return ALL_EDGES.filter((_, i) => i !== level % 4);
    case 2:
      return level % 2 === 0 ? ["top", "bottom"] : ["left", "right"];
    case 4:
      return ["top"];
    case 6:
      return level % 3 === 0 ? ["left"] : [];
    case 7:
      return [];
    default:
      return level % 2 === 0 ? ["bottom"] : ["top"];
  }
}

/** 圆形场地的护栏弧段:留一个越来越大的缺口 */
export function arcsFor(level: number, holeTurns: number): Array<{ from: number; to: number }> {
  const start = (level % 8) / 8;
  const hole = Math.max(0.12, Math.min(0.9, holeTurns));
  const from = (start + hole) % 1;
  const to = (start + 1) % 1;
  return [{ from, to }];
}

/** 均匀撒在圆周上的若干个点 */
export function ringPoints(
  cx: number,
  cy: number,
  radius: number,
  count: number,
  offset = 0
): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < count; i++) {
    const t = offset + i / Math.max(1, count);
    out.push({ x: cx + Math.cos(t * Math.PI * 2) * radius, y: cy + Math.sin(t * Math.PI * 2) * radius });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 每一章的配方
// ---------------------------------------------------------------------------

interface Recipe {
  w: number;
  h: number;
  round: boolean;
  /** 对手数量的下限与上限(章节内逐关走高) */
  foesFrom: number;
  foesTo: number;
  /** 技能档:章节内后半段升一档 */
  skill: AiLevel;
  pads: number;
  rollers: number;
  /** 旋转盘个数 */
  spinners: number;
  /** 油渍摊数 */
  slicks: number;
  keep: number;
  hearts: number;
  seconds: number;
  hint: string;
}

const RECIPES: Recipe[] = [
  {
    w: 104, h: 72, round: false, foesFrom: 1, foesTo: 2, skill: 1, pads: 0, rollers: 0,
    spinners: 0, slicks: 0,
    keep: DAMP_PER_SEC, hearts: 5, seconds: 75,
    hint: "把对手往上下两条悬崖赶,左右两边有护栏撞不出去。滑出场边先打转两秒,这时候往场内打方向还能开回来。",
  },
  {
    w: 108, h: 74, round: false, foesFrom: 1, foesTo: 2, skill: 1, pads: 0, rollers: 0,
    spinners: 0, slicks: 0,
    keep: DAMP_PER_SEC, hearts: 5, seconds: 92,
    hint: "护栏能把车弹回来,贴着护栏起跳再撞,力道翻倍。按住冲撞键蓄力,松手那一下推得最远。",
  },
  {
    w: 112, h: 76, round: false, foesFrom: 2, foesTo: 3, skill: 1, pads: 3, rollers: 0,
    spinners: 0, slicks: 0,
    keep: DAMP_PER_SEC, hearts: 6, seconds: 90,
    hint: "加速带只在踩上去的那一瞬间推你,别在悬崖边踩。",
  },
  {
    w: 96, h: 96, round: true, foesFrom: 2, foesTo: 3, skill: 2, pads: 2, rollers: 0,
    spinners: 1, slicks: 0,
    keep: DAMP_PER_SEC, hearts: 6, seconds: 90,
    hint: "圆台只有半圈护栏,把对手引到缺口那一侧再发力。中间那块旋转盘会把车头带偏,别在上面蓄力。",
  },
  {
    w: 116, h: 78, round: false, foesFrom: 2, foesTo: 3, skill: 2, pads: 2, rollers: 2,
    spinners: 0, slicks: 1,
    keep: DAMP_PER_SEC, hearts: 7, seconds: 95,
    hint: "滚桶把谁都弹得一样远,站在它后面让对手自己撞上来。地上那摊油渍刹不住,绕着走。",
  },
  {
    w: 100, h: 100, round: true, foesFrom: 2, foesTo: 3, skill: 2, pads: 2, rollers: 1,
    spinners: 1, slicks: 2,
    keep: 0.68, hearts: 7, seconds: 100,
    hint: "冰面几乎不减速,想停下来只能提前按刹车。油渍比冰面还滑,踩上去只能顺着滑完。",
  },
  {
    w: 118, h: 80, round: false, foesFrom: 2, foesTo: 3, skill: 2, pads: 4, rollers: 2,
    spinners: 2, slicks: 1,
    keep: 0.6, hearts: 7, seconds: 105,
    hint: "传送带整片朝外推,逆着它开才站得住。两块旋转盘会把车头转过去,进盘子前先对好方向。",
  },
  {
    w: 120, h: 84, round: false, foesFrom: 3, foesTo: 4, skill: 2, pads: 3, rollers: 3,
    spinners: 1, slicks: 2,
    keep: DAMP_PER_SEC, hearts: 8, seconds: 125,
    hint: "重量级对手撞不飞,先把轻车清掉再合力对付它。蓄满的一记强撞连重车都顶得动。",
  },
];

/** 章节起始关号(0 基) */
export function chapterStartLevel(chapter: number): number {
  let acc = 0;
  for (let i = 0; i < chapter && i < CHAPTERS.length; i++) acc += CHAPTERS[i].size;
  return acc;
}

/** level(0 基)属于第几章 */
export function chapterOfLevel(level: number): number {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    acc += CHAPTERS[i].size;
    if (level < acc) return i;
  }
  return CHAPTERS.length - 1;
}

function makeField(recipe: Recipe, chapter: number, inChapter: number): Field {
  if (recipe.round) {
    // 圆台的缺口随关号变大:第一关只缺一小段,章末缺掉大半圈
    const hole = 0.72 - Math.min(0.34, inChapter * 0.014);
    return { shape: "round", w: recipe.w, h: recipe.h, springs: [], arcs: arcsFor(inChapter, hole) };
  }
  return { shape: "rect", w: recipe.w, h: recipe.h, springs: springsFor(chapter, inChapter), arcs: [] };
}

function makePads(recipe: Recipe, rand: () => number, chapter: number): BoostPad[] {
  const pads: BoostPad[] = [];
  const cx = recipe.w / 2;
  const cy = recipe.h / 2;
  for (let i = 0; i < recipe.pads; i++) {
    const t = i / Math.max(1, recipe.pads);
    const ang = t * Math.PI * 2 + rand() * 0.4;
    const dist = Math.min(recipe.w, recipe.h) * (0.16 + rand() * 0.14);
    const w = 14 + rand() * 8;
    const h = 9 + rand() * 5;
    // 传送带迷阵的加速带朝外推(踩上去就危险),其余章节沿着场地绕圈推,
    // 推力刻意压得不大:加速带是用来抢位置的,不该一脚把人送下场。
    const outward = chapter === 6;
    const dx = outward ? Math.cos(ang) : -Math.sin(ang);
    const dy = outward ? Math.sin(ang) : Math.cos(ang);
    pads.push({
      x: cx + Math.cos(ang) * dist - w / 2,
      y: cy + Math.sin(ang) * dist - h / 2,
      w,
      h,
      dx,
      dy,
      power: outward ? 26 + rand() * 12 : 34 + rand() * 16,
    });
  }
  return pads;
}

function makeRollers(recipe: Recipe, rand: () => number): Hazard[] {
  const out: Hazard[] = [];
  for (let i = 0; i < recipe.rollers; i++) {
    const vertical = i % 2 === 0;
    const lane = (i + 1) / (recipe.rollers + 1);
    const inset = Math.min(recipe.w, recipe.h) * 0.2;
    const x0 = vertical ? recipe.w * lane : inset;
    const x1 = vertical ? recipe.w * lane : recipe.w - inset;
    const y0 = vertical ? inset : recipe.h * lane;
    const y1 = vertical ? recipe.h - inset : recipe.h * lane;
    out.push(
      makeHazard({
        x0,
        y0,
        x1,
        y1,
        r: 4 + rand() * 2.5,
        speed: 12 + rand() * 10,
        phase: rand(),
      })
    );
  }
  return out;
}

/**
 * 旋转盘:摆在离场心不远的位置,半径固定,转向按序号交替。
 * 位置刻意压在内圈——机关是用来「打乱走位」的,不该变成悬崖边的第二道杀器。
 */
export function makeSpinners(recipe: Recipe, rand: () => number): Spinner[] {
  const out: Spinner[] = [];
  const cx = recipe.w / 2;
  const cy = recipe.h / 2;
  const reach = Math.min(recipe.w, recipe.h) * 0.18;
  for (let i = 0; i < recipe.spinners; i++) {
    const ang = (i / Math.max(1, recipe.spinners)) * Math.PI * 2 + rand() * 0.5;
    const dist = i === 0 && recipe.spinners === 1 ? 0 : reach;
    out.push({
      x: cx + Math.cos(ang) * dist,
      y: cy + Math.sin(ang) * dist,
      r: 7 + rand() * 3,
      rate: (i % 2 === 0 ? 1 : -1) * (0.45 + rand() * 0.35),
      push: 9 + rand() * 6,
    });
  }
  return out;
}

/** 油渍:一摊摊圆形的油,踩上去每秒保留的速度比例被抬到 0.86 上下(= 摩擦变小) */
export function makeSlicks(recipe: Recipe, rand: () => number): Slick[] {
  const out: Slick[] = [];
  const cx = recipe.w / 2;
  const cy = recipe.h / 2;
  const reach = Math.min(recipe.w, recipe.h) * 0.26;
  for (let i = 0; i < recipe.slicks; i++) {
    const ang = (i / Math.max(1, recipe.slicks)) * Math.PI * 2 + rand() * 0.8 + 0.7;
    out.push({
      x: cx + Math.cos(ang) * reach,
      y: cy + Math.sin(ang) * reach,
      r: 8 + rand() * 4,
      keep: Math.max(recipe.keep + 0.12, 0.86 + rand() * 0.06),
    });
  }
  return out;
}

/** 第 index 关(0 基)的完整场地数据 */
export function buildLevel(index: number): CarLevel {
  const level = Math.max(0, Math.min(TOTAL_LEVELS - 1, Math.round(index)));
  const chapter = chapterOfLevel(level);
  const inChapter = level - chapterStartLevel(chapter);
  const size = CHAPTERS[chapter].size;
  const recipe = RECIPES[chapter];
  const seed = 7301 + level * 977;
  const rand = mulberry32(seed);

  const field = makeField(recipe, chapter, inChapter);
  const pads = makePads(recipe, rand, chapter);
  const hazards = makeRollers(recipe, rand);
  const spinners = makeSpinners(recipe, rand);
  const slicks = makeSlicks(recipe, rand);

  // 章节内逐关加人:前几关只有下限,章末拉满
  const ramp = size <= 1 ? 1 : inChapter / (size - 1);
  const foeCount = Math.round(recipe.foesFrom + (recipe.foesTo - recipe.foesFrom) * ramp);
  // 冠军竞技场的最后几关才请得动「卡角高手」这一档,其余章节的档位跟 1.1 一模一样
  const bump = chapter === CHAPTERS.length - 1 && ramp > 0.85 ? 2 : 1;
  const skill: AiLevel = (ramp > 0.6 ? Math.min(4, recipe.skill + bump) : recipe.skill) as AiLevel;

  const cx = recipe.w / 2;
  const cy = recipe.h / 2;
  const ringR = Math.min(recipe.w, recipe.h) * 0.3;
  const spots = ringPoints(cx, cy, ringR, foeCount + 1, inChapter / Math.max(1, size));
  const spawn = spots[0];
  const foeSpawns = spots.slice(1);

  const foes: Foe[] = [];
  for (let i = 0; i < foeCount; i++) {
    const who = ROSTER[(level + i) % ROSTER.length];
    // 章末的「重车」要撞两次才请得走,是本章的小考验
    const heavy = chapter >= 4 && i === 0 && ramp > 0.5;
    foes.push({
      name: who.name,
      emoji: who.emoji,
      color: who.color,
      skill,
      mass: heavy ? 1.9 : 1 + (chapter >= 2 ? 0.12 : 0),
      r: heavy ? CAR_R * 1.25 : CAR_R,
      lives: heavy ? 2 : 1,
    });
  }

  return {
    index: level,
    chapter,
    field,
    pads,
    hazards,
    spinners,
    slicks,
    keep: recipe.keep,
    spawn,
    foeSpawns,
    foes,
    hunters: Math.min(foeCount, chapter <= 1 ? 1 : 2),
    hearts: recipe.hearts,
    seconds: recipe.seconds + Math.round(ramp * 10),
    seed,
    hint: recipe.hint,
  };
}

/** 全部关号,给单测全量扫描用 */
export const ALL_LEVELS: number[] = Array.from({ length: TOTAL_LEVELS }, (_, i) => i);

// ---------------------------------------------------------------------------
// 对战场(双人同屏 / 人机),每一局换一张图
// ---------------------------------------------------------------------------

export interface ArenaLevel {
  field: Field;
  pads: BoostPad[];
  hazards: Hazard[];
  spinners: Spinner[];
  slicks: Slick[];
  keep: number;
  spawns: Array<{ x: number; y: number }>;
  seconds: number;
  seed: number;
  name: string;
  hint: string;
}

const ARENAS = [
  { name: "月牙圆台", round: true, w: 98, h: 98, pads: 0, rollers: 0, spinners: 0, slicks: 0, keep: DAMP_PER_SEC, hint: "圆台缺口在一侧,把对手往那边挤。" },
  { name: "弹簧方场", round: false, w: 110, h: 76, pads: 0, rollers: 1, spinners: 0, slicks: 0, keep: DAMP_PER_SEC, hint: "左右有护栏,上下是悬崖,借护栏反弹更好使。" },
  { name: "加速十字", round: false, w: 112, h: 78, pads: 4, rollers: 0, spinners: 1, slicks: 0, keep: DAMP_PER_SEC, hint: "四条加速带都朝中间推,中间那块旋转盘会把车头带偏。" },
  { name: "滚桶擂台", round: true, w: 102, h: 102, pads: 0, rollers: 2, spinners: 0, slicks: 2, keep: DAMP_PER_SEC, hint: "两只滚桶来回跑,躲在它后面等对手撞上来;两摊油渍别乱踩。" },
  { name: "冰面圆环", round: true, w: 96, h: 96, pads: 2, rollers: 0, spinners: 1, slicks: 1, keep: 0.8, hint: "冰面刹不住,提前松油门才转得过来。" },
];

/** 第 round 局(1 基)的对战场地 */
export function buildArena(round: number): ArenaLevel {
  const idx = (Math.max(1, Math.round(round)) - 1) % ARENAS.length;
  const spec = ARENAS[idx];
  const seed = 5501 + idx * 313 + Math.max(1, Math.round(round));
  const rand = mulberry32(seed);
  const recipe: Recipe = {
    w: spec.w,
    h: spec.h,
    round: spec.round,
    foesFrom: 1,
    foesTo: 1,
    skill: 2,
    pads: spec.pads,
    rollers: spec.rollers,
    spinners: spec.spinners,
    slicks: spec.slicks,
    keep: spec.keep,
    hearts: 1,
    seconds: 60,
    hint: spec.hint,
  };
  const field = spec.round
    ? ({ shape: "round", w: spec.w, h: spec.h, springs: [], arcs: arcsFor(idx, 0.6) } as Field)
    : ({ shape: "rect", w: spec.w, h: spec.h, springs: ["left", "right"], arcs: [] } as Field);
  const cx = spec.w / 2;
  const cy = spec.h / 2;
  const ringR = Math.min(spec.w, spec.h) * 0.3;
  return {
    field,
    pads: makePads(recipe, rand, 0),
    hazards: makeRollers(recipe, rand),
    spinners: makeSpinners(recipe, rand),
    slicks: makeSlicks(recipe, rand),
    keep: spec.keep,
    spawns: ringPoints(cx, cy, ringR, 2, 0.25),
    seconds: 60,
    seed,
    name: spec.name,
    hint: spec.hint,
  };
}

// ---------------------------------------------------------------------------
// 无尽:车海模式,一波比一波多
// ---------------------------------------------------------------------------

/** 第 wave 波(1 基)会来几台对手车 */
export function waveFoeCount(wave: number): number {
  const w = Math.max(1, Math.round(wave));
  return Math.min(7, Math.round(1 + (w - 1) * 0.8));
}

/** 第 wave 波的对手技能档:第 10 波起「卡角高手」登场 */
export function waveSkill(wave: number): AiLevel {
  const w = Math.max(1, Math.round(wave));
  if (w <= 2) return 1;
  if (w <= 5) return 2;
  if (w <= 9) return 3;
  return 4;
}

/** 无尽第 wave 波(1 基)的场地与阵容 */
export function buildWave(wave: number): CarLevel {
  const w = Math.max(1, Math.round(wave));
  const seed = 9101 + w * 641;
  const rand = mulberry32(seed);
  const side = 104;
  const recipe: Recipe = {
    w: side,
    h: side,
    round: true,
    foesFrom: 1,
    foesTo: 1,
    skill: waveSkill(w),
    pads: w >= 4 ? 2 : 0,
    rollers: w >= 6 ? 2 : 0,
    spinners: w >= 3 ? 1 : 0,
    slicks: w >= 5 ? 2 : 0,
    keep: DAMP_PER_SEC,
    hearts: 1,
    seconds: 0,
    hint: "车越来越多,守住中间的空地。",
  };
  const field: Field = {
    shape: "round",
    w: side,
    h: side,
    springs: [],
    // 波次越高护栏越短,场地越危险
    arcs: [{ from: 0, to: Math.max(0.1, 0.5 - w * 0.05) }],
  };
  const count = waveFoeCount(w);
  const cx = side / 2;
  const cy = side / 2;
  const spots = ringPoints(cx, cy, side * 0.3, count + 1, 0.12 * w);
  const foes: Foe[] = [];
  for (let i = 0; i < count; i++) {
    const who = ROSTER[(w + i) % ROSTER.length];
    const heavy = w >= 5 && i === 0;
    foes.push({
      name: who.name,
      emoji: who.emoji,
      color: who.color,
      skill: waveSkill(w),
      mass: heavy ? 1.8 : 1,
      r: heavy ? CAR_R * 1.2 : CAR_R,
      lives: 1,
    });
  }
  return {
    index: -1,
    chapter: Math.min(CHAPTERS.length - 1, Math.floor((w - 1) / 3)),
    field,
    pads: makePads(recipe, rand, 3),
    hazards: makeRollers(recipe, rand),
    spinners: makeSpinners(recipe, rand),
    slicks: makeSlicks(recipe, rand),
    keep: DAMP_PER_SEC,
    spawn: spots[0],
    foeSpawns: spots.slice(1),
    foes,
    // 无尽模式每台车能被工作人员推回来三次
    hunters: Math.min(count, 2),
    hearts: ENDLESS_REVIVES,
    seconds: 0,
    seed,
    hint: "车海一波比一波多,守住中间的空地,让他们自己先撞成一团。",
  };
}
