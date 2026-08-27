/**
 * 豆豆迷宫 · 188 关战役切分（8 章）。
 * 每一关的地图都由 buildMaze 用固定 seed 生成，生成器保证「所有豆子都能吃到」。
 */
import { assertTotal, type Chapter } from "../level99";
import { TIERS, type Tier } from "./ghosts";
import { buildMaze, type Maze } from "./maze";
import type { RunConfig } from "./logic";

export const CHAPTERS: Chapter[] = [
  { name: "练习廊", emoji: "🚸", color: "#FFF3C4", desc: "没有小幽灵，先把转向和输入缓冲练顺手。", size: 24 },
  { name: "一只幽灵", emoji: "🩷", color: "#FFE1E8", desc: "只有直直在追你，学会拉开身位。", size: 24 },
  { name: "四种脾气", emoji: "🎭", color: "#FFE9CF", desc: "四只全开，脾气各不相同。", size: 24 },
  { name: "能量豆", emoji: "🔵", color: "#DCEEFF", desc: "能量豆一亮就反攻，连击 200 / 400 / 800 / 1600。", size: 24 },
  { name: "隧道风", emoji: "🌀", color: "#E3F7EC", desc: "多条隧道左右相通，穿过去会稍微慢一点。", size: 22 },
  { name: "迷雾迷宫", emoji: "🌫️", color: "#E9E4F7", desc: "视野变小，靠小地图记路。", size: 22 },
  { name: "双人追逃", emoji: "👫", color: "#FFE0F0", desc: "康康操纵一只小幽灵，鸭梨负责清豆。", size: 24 },
  { name: "迷宫杯", emoji: "🏆", color: "#FFEFC2", desc: "全机制高速，把整张图吃干净。", size: 24 },
];

export const TOTAL = 188;

export function chaptersValid(): boolean {
  return assertTotal(CHAPTERS, TOTAL, "dot-maze");
}

/** 关号（0 基）落在第几章 */
export function chapterIndexOf(level: number): number {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    acc += CHAPTERS[i].size;
    if (level < acc) return i;
  }
  return CHAPTERS.length - 1;
}

export interface LevelPlan {
  level: number;
  chapter: number;
  ghostCount: number;
  tier: Tier;
  tunnels: number;
  powerPellets: number;
  fog: boolean;
  /** 康康是否操纵一只小幽灵 */
  duoChase: boolean;
  stepMs: number;
  lives: number;
  width: number;
  height: number;
  density: number;
}

function tierFor(chapter: number, indexInChapter: number): Tier {
  if (chapter <= 1) return "rookie";
  if (chapter <= 3) return indexInChapter >= 16 ? "normal" : "rookie";
  if (chapter <= 5) return indexInChapter >= 12 ? "pro" : "normal";
  if (chapter === 6) return indexInChapter >= 12 ? "pro" : "normal";
  return indexInChapter >= 12 ? "hell" : "pro";
}

/** 某一关的配置（纯函数，同一关每次都一样） */
export function planFor(level: number): LevelPlan {
  const lv = Math.max(0, Math.min(TOTAL - 1, Math.round(level)));
  const chapter = chapterIndexOf(lv);
  let acc = 0;
  for (let i = 0; i < chapter; i++) acc += CHAPTERS[i].size;
  const k = lv - acc;
  const size = CHAPTERS[chapter].size;
  const ramp = size <= 1 ? 0 : k / (size - 1);

  const ghostCount = chapter === 0 ? 0 : chapter === 1 ? 1 : chapter === 2 ? (k < 6 ? 2 : k < 14 ? 3 : 4) : 4;
  const tunnels = chapter >= 4 ? (k < 8 ? 1 : k < 16 ? 2 : 3) : chapter >= 2 ? 1 : 0;
  const powerPellets = chapter >= 3 ? 4 : chapter >= 2 ? 2 : 0;
  const width = 15 + 2 * Math.min(4, Math.floor(chapter / 2) + Math.floor(ramp * 2));
  const height = 11 + 2 * Math.min(3, Math.floor(chapter / 3) + Math.floor(ramp * 2));
  const stepMs = Math.round(210 - chapter * 12 - ramp * 18);

  return {
    level: lv,
    chapter,
    ghostCount,
    tier: tierFor(chapter, k),
    tunnels,
    powerPellets,
    fog: chapter === 5,
    duoChase: chapter === 6,
    stepMs: Math.max(105, stepMs),
    lives: chapter === 0 ? 5 : chapter >= 7 ? 3 : 4,
    width,
    height,
    density: 0.08 + Math.min(0.22, chapter * 0.03 + ramp * 0.04),
  };
}

/** 某一关的地图（固定 seed，每次生成完全一样） */
export function mazeFor(level: number): Maze {
  const plan = planFor(level);
  return buildMaze(1000 + plan.level * 37, {
    w: plan.width,
    h: plan.height,
    density: plan.density,
    tunnels: plan.tunnels,
    powerPellets: plan.powerPellets,
  });
}

/** 某一关的完整 RunConfig */
export function configFor(level: number): RunConfig {
  const plan = planFor(level);
  const maze = mazeFor(level);
  return {
    maze,
    tier: plan.tier,
    ghostCount: plan.ghostCount,
    lives: plan.lives,
    stepMs: plan.stepMs,
    fruitAt: plan.chapter >= 2 ? [12000, 34000] : [],
    fog: plan.fog,
  };
}

/** 无尽模式第 n 圈的配置（速度递增，地图循环） */
export function endlessConfig(round: number): RunConfig {
  const r = Math.max(0, Math.round(round));
  const tier = TIERS[Math.min(TIERS.length - 1, Math.floor(r / 3))];
  const maze = buildMaze(50000 + r * 91, {
    w: 17 + 2 * (r % 3),
    h: 13 + 2 * (r % 2),
    density: 0.1 + Math.min(0.2, r * 0.02),
    tunnels: 1 + (r % 3),
    powerPellets: 4,
  });
  return {
    maze,
    tier,
    ghostCount: Math.min(4, 1 + Math.floor(r / 2)),
    lives: 3,
    stepMs: Math.max(100, 200 - r * 8),
    fruitAt: [10000, 28000, 46000],
    fog: false,
  };
}

/** 三星门槛：剩余小星命越多越好 */
export function rateLevel(livesLeft: number, total: number): 1 | 2 | 3 {
  if (livesLeft >= total) return 3;
  if (livesLeft >= Math.ceil(total / 2)) return 2;
  return 1;
}
