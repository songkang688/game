/**
 * 弹弹小鸟 —— 关卡数据。
 *
 * 1.1 版共 188 关、9 个主题世界:
 * 1.0 的 99 关(草地 / 沙滩 / 雪地 / 夜晚 / 火山 / 云端)一字未动,
 * 末尾追加 3 个新章(风车高地 / 冰晶矿洞 / 熔岩工坊)共 89 关,
 * 并带来三个新机制:传送门、两段连锁的岩壳块、会回旋的新小鸟卷卷。
 * 手写关为独特布局(handmade: true),其余由确定性生成器按「配方」生成——
 * 同一个种子永远生成同样的关卡。
 */
import { GROUND_Y, makeRng } from "./physics";

export type BirdKind = "straight" | "split" | "slam" | "drill" | "boomerang";
export type BlockKind = "wood" | "stone" | "ice" | "glass" | "tnt" | "shell" | "core";

export interface BlockDef {
  kind: BlockKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 绿绿豆(圆豆),x/y 为圆心 */
export interface BeanDef {
  x: number;
  y: number;
}

export interface SlopeDef {
  x: number;
  y: number;
  w: number;
  h: number;
  dir: "up-right" | "up-left";
}

export interface BoulderDef {
  x: number;
  y: number;
  r: number;
}

/** 移动平台:绕 (x,y) 按正弦往返,dx/dy 是振幅 */
export interface PlatformDef {
  x: number;
  y: number;
  w: number;
  h: number;
  dx: number;
  dy: number;
  period: number;
}

/** 气球:下面用绳子吊着一颗绿绿豆(运行时自动生成) */
export interface BalloonDef {
  x: number;
  y: number;
}

/** 风区:范围内的小鸟受持续风力 */
export interface WindDef {
  x: number;
  y: number;
  w: number;
  h: number;
  fx: number;
  fy: number;
}

/** 传送门(1.1 新机制):小鸟钻进 A 口就从 B 口飞出,双向都通 */
export interface PortalDef {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  r: number;
}

export interface LevelDef {
  id: number;
  chapter: number;
  name: string;
  handmade?: boolean;
  birds: BirdKind[];
  beans: BeanDef[];
  blocks: BlockDef[];
  slopes?: SlopeDef[];
  boulders?: BoulderDef[];
  platforms?: PlatformDef[];
  balloons?: BalloonDef[];
  winds?: WindDef[];
  portals?: PortalDef[];
}

/** 每章关卡数(1.0 六章 99 关 + 1.1 三章 89 关 = 188 关) */
export const CHAPTER_SIZES = [15, 15, 15, 15, 20, 19, 30, 30, 29] as const;
/** 气球绳长:吊着的豆在气球下方这么远 */
export const BALLOON_ROPE = 34;

export const CHAPTERS = [
  { name: "青青草地", emoji: "🌿" },
  { name: "阳光沙滩", emoji: "🏖️" },
  { name: "白白雪原", emoji: "❄️" },
  { name: "星星夜空", emoji: "🌙" },
  { name: "火山峡谷", emoji: "🌋" },
  { name: "彩虹云端", emoji: "🌈" },
  { name: "风车高地", emoji: "🌬️" },
  { name: "冰晶矿洞", emoji: "💎" },
  { name: "熔岩工坊", emoji: "⚙️" }
] as const;

/** 某章第一关的 id */
export function chapterStartId(c: number): number {
  let id = 1;
  for (let i = 0; i < c; i++) id += CHAPTER_SIZES[i];
  return id;
}

/** 关卡 id 所属章节 */
export function chapterOfId(id: number): number {
  let c = 0;
  let start = 1;
  while (c < CHAPTER_SIZES.length - 1 && id >= start + CHAPTER_SIZES[c]) {
    start += CHAPTER_SIZES[c];
    c++;
  }
  return c;
}

const G = GROUND_Y;

function bl(kind: BlockKind, x: number, y: number, w: number, h: number): BlockDef {
  return { kind, x, y, w, h };
}

/* ------------------------------------------------------------------ */
/* 手写关卡(32 关)                                                    */
/* ------------------------------------------------------------------ */

const HANDMADE_LEVELS: LevelDef[] = [
  {
    id: 1,
    chapter: 0,
    name: "第一颗绿绿豆",
    handmade: true,
    birds: ["straight", "straight", "straight"],
    beans: [{ x: 424, y: G - 10 }],
    blocks: [bl("wood", 380, G - 26, 26, 26)]
  },
  {
    id: 2,
    chapter: 0,
    name: "小木塔",
    handmade: true,
    birds: ["straight", "straight", "straight"],
    beans: [
      { x: 394, y: G - 80 },
      { x: 394, y: G - 10 }
    ],
    blocks: [
      bl("wood", 360, G - 58, 14, 58),
      bl("wood", 414, G - 58, 14, 58),
      bl("wood", 352, G - 70, 84, 12)
    ]
  },
  {
    id: 3,
    chapter: 0,
    name: "两颗豆豆",
    handmade: true,
    birds: ["straight", "straight", "straight"],
    beans: [
      { x: 343, y: G - 36 },
      { x: 463, y: G - 62 }
    ],
    blocks: [
      bl("wood", 330, G - 26, 26, 26),
      bl("wood", 450, G - 26, 26, 26),
      bl("wood", 450, G - 52, 26, 26)
    ]
  },
  {
    id: 4,
    chapter: 0,
    name: "玻璃闪闪",
    handmade: true,
    birds: ["straight", "straight", "straight", "straight"],
    beans: [
      { x: 394, y: G - 10 },
      { x: 443, y: G - 36 }
    ],
    blocks: [bl("glass", 350, G - 84, 18, 84), bl("wood", 430, G - 26, 26, 26)]
  },
  {
    id: 5,
    chapter: 0,
    name: "云云登场",
    handmade: true,
    birds: ["split", "split", "straight"],
    beans: [
      { x: 343, y: G - 36 },
      { x: 413, y: G - 36 },
      { x: 483, y: G - 36 }
    ],
    blocks: [
      bl("wood", 330, G - 26, 26, 26),
      bl("wood", 400, G - 26, 26, 26),
      bl("wood", 470, G - 26, 26, 26)
    ]
  },
  {
    id: 6,
    chapter: 0,
    name: "小山坡",
    handmade: true,
    birds: ["straight", "straight", "split"],
    beans: [
      { x: 430, y: G - 10 },
      { x: 473, y: G - 36 }
    ],
    blocks: [bl("wood", 460, G - 26, 26, 26)],
    slopes: [{ x: 300, y: G - 60, w: 90, h: 60, dir: "up-right" }]
  },
  {
    id: 7,
    chapter: 0,
    name: "木头城堡",
    handmade: true,
    birds: ["straight", "split", "straight"],
    beans: [
      { x: 398, y: G - 10 },
      { x: 397, y: G - 106 }
    ],
    blocks: [
      bl("wood", 370, G - 58, 14, 58),
      bl("wood", 424, G - 58, 14, 58),
      bl("wood", 362, G - 70, 84, 12),
      bl("wood", 384, G - 96, 26, 26)
    ]
  },
  {
    id: 8,
    chapter: 0,
    name: "咚!滚石",
    handmade: true,
    birds: ["straight", "straight", "split"],
    beans: [
      { x: 473, y: G - 62 },
      { x: 515, y: G - 10 }
    ],
    blocks: [
      bl("stone", 290, G - 90, 40, 90),
      bl("wood", 460, G - 26, 26, 26),
      bl("wood", 460, G - 52, 26, 26)
    ],
    slopes: [{ x: 340, y: G - 70, w: 80, h: 70, dir: "up-left" }],
    boulders: [{ x: 310, y: G - 104, r: 14 }]
  },
  {
    id: 9,
    chapter: 0,
    name: "轰隆 TNT",
    handmade: true,
    birds: ["straight", "straight"],
    beans: [
      { x: 432, y: G - 86 },
      { x: 505, y: G - 10 }
    ],
    blocks: [
      bl("tnt", 420, G - 24, 24, 24),
      bl("wood", 419, G - 50, 26, 26),
      bl("wood", 419, G - 76, 26, 26),
      bl("glass", 468, G - 22, 22, 22)
    ]
  },
  {
    id: 10,
    chapter: 0,
    name: "气球豆豆",
    handmade: true,
    birds: ["split", "straight", "straight"],
    beans: [{ x: 485, y: G - 10 }],
    blocks: [
      bl("wood", 446, G - 26, 26, 26),
      bl("wood", 498, G - 26, 26, 26),
      bl("wood", 442, G - 38, 84, 12)
    ],
    balloons: [{ x: 400, y: 150 }]
  },
  {
    id: 11,
    chapter: 0,
    name: "顺风起飞",
    handmade: true,
    birds: ["straight", "split", "straight"],
    beans: [
      { x: 441, y: G - 120 },
      { x: 495, y: G - 10 }
    ],
    blocks: [bl("stone", 430, G - 110, 22, 110)],
    winds: [{ x: 230, y: 60, w: 130, h: 170, fx: 0, fy: -260 }]
  },
  {
    id: 12,
    chapter: 0,
    name: "草地大考验",
    handmade: true,
    birds: ["split", "straight", "split", "straight"],
    beans: [
      { x: 365, y: G - 10 },
      { x: 403, y: G - 72 },
      { x: 515, y: G - 10 }
    ],
    blocks: [
      bl("glass", 330, G - 70, 16, 70),
      bl("tnt", 392, G - 24, 24, 24),
      bl("wood", 376, G - 36, 56, 12),
      bl("wood", 390, G - 62, 26, 26),
      bl("stone", 470, G - 28, 28, 28)
    ]
  },
  {
    id: 16,
    chapter: 1,
    name: "墩墩来了",
    handmade: true,
    birds: ["slam", "slam", "straight"],
    beans: [
      { x: 408, y: G - 10 },
      { x: 497, y: G - 10 }
    ],
    blocks: [
      bl("wood", 380, G - 44, 14, 44),
      bl("wood", 436, G - 44, 14, 44),
      bl("wood", 372, G - 56, 86, 12),
      bl("stone", 474, G - 36, 12, 36),
      bl("stone", 508, G - 36, 12, 36),
      bl("stone", 468, G - 48, 58, 12)
    ]
  },
  {
    id: 17,
    chapter: 1,
    name: "沙滩城堡",
    handmade: true,
    birds: ["slam", "split", "straight"],
    beans: [
      { x: 442, y: G - 78 },
      { x: 374, y: G - 10 }
    ],
    blocks: [
      bl("stone", 400, G - 30, 84, 30),
      bl("wood", 408, G - 56, 26, 26),
      bl("wood", 448, G - 56, 26, 26),
      bl("wood", 400, G - 68, 84, 12),
      bl("glass", 340, G - 24, 24, 24)
    ]
  },
  {
    id: 18,
    chapter: 1,
    name: "移动小船",
    handmade: true,
    birds: ["straight", "slam", "split"],
    beans: [
      { x: 415, y: 200 },
      { x: 493, y: G - 36 }
    ],
    blocks: [bl("wood", 480, G - 26, 26, 26)],
    platforms: [{ x: 380, y: 210, w: 70, h: 12, dx: 70, dy: 0, period: 4 }]
  },
  {
    id: 19,
    chapter: 1,
    name: "海风阵阵",
    handmade: true,
    birds: ["split", "slam", "straight", "straight"],
    beans: [
      { x: 429, y: G - 66 },
      { x: 479, y: G - 94 }
    ],
    blocks: [bl("glass", 420, G - 56, 18, 56), bl("glass", 470, G - 84, 18, 84)],
    winds: [{ x: 250, y: 40, w: 230, h: 190, fx: -150, fy: 0 }]
  },
  {
    id: 31,
    chapter: 2,
    name: "闪闪钻冰",
    handmade: true,
    birds: ["drill", "drill", "straight"],
    beans: [
      { x: 460, y: G - 10 },
      { x: 500, y: G - 70 }
    ],
    blocks: [
      bl("ice", 390, G - 96, 24, 96),
      bl("ice", 414, G - 96, 24, 96),
      bl("glass", 490, G - 60, 20, 60)
    ]
  },
  {
    id: 32,
    chapter: 2,
    name: "冰滑梯",
    handmade: true,
    birds: ["drill", "slam", "split"],
    beans: [
      { x: 470, y: G - 10 },
      { x: 508, y: G - 36 }
    ],
    blocks: [bl("stone", 300, G - 84, 30, 84), bl("ice", 495, G - 26, 26, 26)],
    slopes: [{ x: 330, y: G - 80, w: 100, h: 80, dir: "up-left" }],
    boulders: [{ x: 315, y: G - 98, r: 14 }]
  },
  {
    id: 33,
    chapter: 2,
    name: "雪原彩球",
    handmade: true,
    birds: ["split", "drill", "straight"],
    beans: [{ x: 490, y: G - 80 }],
    blocks: [bl("ice", 480, G - 70, 20, 70)],
    balloons: [
      { x: 360, y: 130 },
      { x: 440, y: 105 }
    ],
    winds: [{ x: 290, y: 50, w: 120, h: 150, fx: 0, fy: -180 }]
  },
  {
    id: 34,
    chapter: 2,
    name: "冰石堡垒",
    handmade: true,
    birds: ["drill", "slam", "split", "straight"],
    beans: [
      { x: 458, y: G - 10 },
      { x: 423, y: G - 112 }
    ],
    blocks: [
      bl("stone", 400, G - 64, 16, 64),
      bl("stone", 470, G - 64, 16, 64),
      bl("stone", 392, G - 76, 102, 12),
      bl("tnt", 422, G - 24, 24, 24),
      bl("ice", 410, G - 102, 26, 26),
      bl("ice", 446, G - 102, 26, 26)
    ]
  },
  {
    id: 46,
    chapter: 3,
    name: "月光炸弹",
    handmade: true,
    birds: ["straight", "drill", "slam"],
    beans: [
      { x: 423, y: G - 38 },
      { x: 483, y: G - 38 }
    ],
    blocks: [
      bl("glass", 352, G - 40, 14, 40),
      bl("tnt", 380, G - 24, 24, 24),
      bl("stone", 410, G - 28, 26, 28),
      bl("tnt", 440, G - 24, 24, 24),
      bl("stone", 470, G - 28, 26, 28),
      bl("tnt", 500, G - 24, 24, 24)
    ]
  },
  {
    id: 47,
    chapter: 3,
    name: "夜风飞行",
    handmade: true,
    birds: ["split", "split", "drill"],
    beans: [{ x: 392, y: G - 10 }],
    blocks: [bl("stone", 350, G - 70, 18, 70)],
    balloons: [
      { x: 430, y: 90 },
      { x: 485, y: 145 }
    ],
    winds: [
      { x: 235, y: 40, w: 110, h: 180, fx: 0, fy: -240 },
      { x: 380, y: 30, w: 140, h: 150, fx: 130, fy: 0 }
    ]
  },
  {
    id: 48,
    chapter: 3,
    name: "升降孤岛",
    handmade: true,
    birds: ["slam", "drill", "split", "straight"],
    beans: [
      { x: 402, y: 160 },
      { x: 492, y: 110 },
      { x: 349, y: G - 50 }
    ],
    blocks: [bl("tnt", 300, G - 24, 24, 24), bl("stone", 336, G - 40, 26, 40)],
    platforms: [
      { x: 370, y: 170, w: 64, h: 12, dx: 0, dy: 55, period: 5 },
      { x: 460, y: 120, w: 64, h: 12, dx: 0, dy: 70, period: 6.5 }
    ]
  },
  {
    id: 49,
    chapter: 3,
    name: "梦幻要塞",
    handmade: true,
    birds: ["drill", "slam", "split", "straight", "straight"],
    beans: [
      { x: 460, y: G - 10 },
      { x: 437, y: G - 98 }
    ],
    blocks: [
      bl("glass", 348, G - 90, 16, 90),
      bl("stone", 404, G - 50, 14, 50),
      bl("stone", 470, G - 50, 14, 50),
      bl("stone", 396, G - 62, 96, 12),
      bl("tnt", 426, G - 24, 24, 24),
      bl("ice", 424, G - 88, 26, 26)
    ],
    slopes: [{ x: 255, y: G - 56, w: 70, h: 56, dir: "up-right" }],
    balloons: [{ x: 315, y: 120 }]
  },
  // —— 火山峡谷(第 5 章)——
  {
    id: 61,
    chapter: 4,
    name: "峡谷入口",
    handmade: true,
    birds: ["straight", "slam", "split"],
    beans: [
      { x: 426, y: G - 10 },
      { x: 426, y: G - 88 }
    ],
    blocks: [
      bl("stone", 400, G - 40, 12, 40),
      bl("stone", 440, G - 40, 12, 40),
      bl("glass", 394, G - 52, 64, 12),
      bl("stone", 413, G - 78, 26, 26),
      bl("tnt", 480, G - 24, 24, 24)
    ]
  },
  {
    id: 62,
    chapter: 4,
    name: "滚石峡谷",
    handmade: true,
    birds: ["straight", "split", "slam"],
    beans: [
      { x: 461, y: G - 10 },
      { x: 461, y: G - 58 }
    ],
    blocks: [
      bl("stone", 280, G - 80, 36, 80),
      bl("stone", 440, G - 36, 12, 36),
      bl("stone", 470, G - 36, 12, 36),
      bl("stone", 434, G - 48, 54, 12)
    ],
    slopes: [{ x: 316, y: G - 70, w: 90, h: 70, dir: "up-left" }],
    boulders: [{ x: 298, y: G - 94, r: 14 }]
  },
  {
    id: 70,
    chapter: 4,
    name: "岩浆炸弹",
    handmade: true,
    birds: ["straight", "drill", "split"],
    beans: [
      { x: 433, y: G - 40 },
      { x: 495, y: G - 40 }
    ],
    blocks: [
      bl("glass", 360, G - 40, 14, 40),
      bl("tnt", 390, G - 24, 24, 24),
      bl("stone", 420, G - 30, 26, 30),
      bl("tnt", 452, G - 24, 24, 24),
      bl("stone", 482, G - 30, 26, 30)
    ]
  },
  {
    id: 80,
    chapter: 4,
    name: "火山大喷发",
    handmade: true,
    birds: ["drill", "slam", "split", "straight", "straight"],
    beans: [
      { x: 407, y: G - 108 },
      { x: 466, y: G - 10 }
    ],
    blocks: [
      bl("stone", 370, G - 60, 14, 60),
      bl("stone", 430, G - 60, 14, 60),
      bl("stone", 362, G - 72, 90, 12),
      bl("tnt", 395, G - 24, 24, 24),
      bl("glass", 400, G - 98, 26, 26),
      bl("tnt", 484, G - 24, 24, 24)
    ],
    slopes: [{ x: 240, y: G - 56, w: 70, h: 56, dir: "up-right" }],
    boulders: [{ x: 330, y: G - 13, r: 13 }],
    winds: [{ x: 250, y: 40, w: 120, h: 160, fx: 0, fy: -220 }]
  },
  // —— 彩虹云端(第 6 章)——
  {
    id: 81,
    chapter: 5,
    name: "云端漫步",
    handmade: true,
    birds: ["straight", "split", "slam"],
    beans: [
      { x: 375, y: 170 },
      { x: 470, y: G - 36 }
    ],
    blocks: [bl("wood", 457, G - 26, 26, 26)],
    platforms: [{ x: 340, y: 180, w: 70, h: 12, dx: 0, dy: 40, period: 5 }],
    balloons: [{ x: 300, y: 120 }]
  },
  {
    id: 82,
    chapter: 5,
    name: "彩虹气球",
    handmade: true,
    birds: ["split", "straight", "straight", "slam"],
    beans: [{ x: 479, y: G - 66 }],
    blocks: [bl("glass", 470, G - 56, 18, 56)],
    balloons: [
      { x: 350, y: 100 },
      { x: 430, y: 140 }
    ],
    winds: [{ x: 240, y: 50, w: 130, h: 170, fx: 0, fy: -240 }]
  },
  {
    id: 90,
    chapter: 5,
    name: "云中宫殿",
    handmade: true,
    birds: ["drill", "split", "slam", "straight"],
    beans: [
      { x: 418, y: G - 10 },
      { x: 418, y: G - 118 },
      { x: 282, y: 140 }
    ],
    blocks: [
      bl("glass", 380, G - 70, 16, 70),
      bl("glass", 440, G - 70, 16, 70),
      bl("ice", 372, G - 82, 92, 12),
      bl("ice", 405, G - 108, 26, 26)
    ],
    platforms: [{ x: 250, y: 150, w: 64, h: 12, dx: 45, dy: 0, period: 4 }]
  },
  {
    id: 99,
    chapter: 5,
    name: "彩虹终点大狂欢",
    handmade: true,
    birds: ["drill", "slam", "split", "straight", "split", "straight"],
    beans: [
      { x: 413, y: G - 104 },
      { x: 443, y: G - 104 },
      { x: 500, y: G - 10 }
    ],
    blocks: [
      bl("stone", 380, G - 56, 14, 56),
      bl("stone", 442, G - 56, 14, 56),
      bl("stone", 372, G - 68, 92, 12),
      bl("tnt", 406, G - 24, 24, 24),
      bl("glass", 400, G - 94, 26, 26),
      bl("ice", 430, G - 94, 26, 26)
    ],
    platforms: [{ x: 260, y: 130, w: 64, h: 12, dx: 0, dy: 50, period: 5.5 }],
    balloons: [{ x: 320, y: 90 }],
    winds: [{ x: 235, y: 40, w: 110, h: 170, fx: 0, fy: -230 }]
  }
];

/* ------------------------------------------------------------------ */
/* 生成关卡(67 关):每个配方的障碍组合都不一样                          */
/* ------------------------------------------------------------------ */

type FeatKind = BlockKind | "boulder" | "slope" | "platform" | "balloon" | "wind";

interface Recipe {
  id: number;
  chapter: number;
  name: string;
  seed: number;
  /** 本关出现的障碍组合(生成器保证全部用上) */
  feats: FeatKind[];
  /** 目标绿绿豆总数(含气球吊着的) */
  beans: number;
  birds: BirdKind[];
}

const RECIPES: Recipe[] = [
  // —— 草地(第 1 章)——
  { id: 13, chapter: 0, name: "花田小屋", seed: 101, feats: ["wood", "glass"], beans: 2, birds: ["straight", "split", "straight"] },
  { id: 14, chapter: 0, name: "山坡野餐", seed: 102, feats: ["wood", "tnt", "slope"], beans: 2, birds: ["straight", "straight", "split"] },
  { id: 15, chapter: 0, name: "草地气球会", seed: 103, feats: ["wood", "glass", "tnt", "balloon"], beans: 3, birds: ["split", "straight", "straight", "straight"] },
  // —— 沙滩(第 2 章)——
  { id: 20, chapter: 1, name: "贝壳小屋", seed: 201, feats: ["wood", "stone"], beans: 2, birds: ["straight", "slam", "split"] },
  { id: 21, chapter: 1, name: "滚滚椰子", seed: 202, feats: ["wood", "slope", "boulder"], beans: 2, birds: ["straight", "split", "slam"] },
  { id: 22, chapter: 1, name: "浪花渡轮", seed: 203, feats: ["wood", "stone", "platform"], beans: 3, birds: ["slam", "straight", "split", "straight"] },
  { id: 23, chapter: 1, name: "起风的沙堡", seed: 204, feats: ["wood", "glass", "wind"], beans: 2, birds: ["split", "slam", "straight"] },
  { id: 24, chapter: 1, name: "石头灯塔", seed: 205, feats: ["stone", "tnt"], beans: 2, birds: ["slam", "straight", "split"] },
  { id: 25, chapter: 1, name: "海上飘飘", seed: 206, feats: ["wood", "balloon", "wind"], beans: 3, birds: ["split", "split", "straight", "slam"] },
  { id: 26, chapter: 1, name: "椰林滚石阵", seed: 207, feats: ["stone", "slope", "boulder", "tnt"], beans: 2, birds: ["straight", "slam", "split"] },
  { id: 27, chapter: 1, name: "玻璃观景台", seed: 208, feats: ["wood", "stone", "glass", "platform"], beans: 3, birds: ["slam", "split", "straight", "straight"] },
  { id: 28, chapter: 1, name: "烟花码头", seed: 209, feats: ["wood", "tnt", "platform", "balloon"], beans: 3, birds: ["split", "slam", "straight", "straight"] },
  { id: 29, chapter: 1, name: "斜坡风车", seed: 210, feats: ["stone", "glass", "slope", "wind"], beans: 2, birds: ["slam", "split", "straight"] },
  { id: 30, chapter: 1, name: "沙滩大派对", seed: 211, feats: ["wood", "stone", "tnt", "boulder", "balloon"], beans: 4, birds: ["split", "slam", "straight", "straight", "split"] },
  // —— 雪地(第 3 章)——
  { id: 35, chapter: 2, name: "冰晶小塔", seed: 301, feats: ["ice", "glass"], beans: 2, birds: ["drill", "split", "straight"] },
  { id: 36, chapter: 2, name: "雪屋惊喜", seed: 302, feats: ["wood", "ice", "tnt"], beans: 2, birds: ["drill", "slam", "split"] },
  { id: 37, chapter: 2, name: "冰坡滚雪球", seed: 303, feats: ["stone", "ice", "boulder", "slope"], beans: 2, birds: ["drill", "straight", "slam"] },
  { id: 38, chapter: 2, name: "空中冰桥", seed: 304, feats: ["ice", "glass", "platform"], beans: 3, birds: ["drill", "split", "slam", "straight"] },
  { id: 39, chapter: 2, name: "雪风飘飘", seed: 305, feats: ["wood", "ice", "balloon", "wind"], beans: 3, birds: ["split", "drill", "straight", "slam"] },
  { id: 40, chapter: 2, name: "雪山哨站", seed: 306, feats: ["stone", "ice", "tnt", "slope"], beans: 3, birds: ["drill", "slam", "split", "straight"] },
  { id: 41, chapter: 2, name: "寒风玻璃塔", seed: 307, feats: ["ice", "glass", "boulder", "wind"], beans: 2, birds: ["drill", "split", "slam"] },
  { id: 42, chapter: 2, name: "雪橇缆车", seed: 308, feats: ["wood", "stone", "ice", "platform", "balloon"], beans: 3, birds: ["slam", "drill", "split", "straight"] },
  { id: 43, chapter: 2, name: "冰洞爆破", seed: 309, feats: ["ice", "tnt", "boulder", "platform"], beans: 3, birds: ["drill", "slam", "straight", "split"] },
  { id: 44, chapter: 2, name: "冰滑梯乐园", seed: 310, feats: ["wood", "ice", "glass", "slope", "balloon"], beans: 3, birds: ["split", "drill", "slam", "straight"] },
  { id: 45, chapter: 2, name: "暴风雪堡垒", seed: 311, feats: ["stone", "ice", "glass", "tnt", "boulder", "wind"], beans: 4, birds: ["drill", "slam", "split", "straight", "drill"] },
  // —— 夜晚(第 4 章)——
  { id: 50, chapter: 3, name: "星光哨塔", seed: 401, feats: ["stone", "tnt", "balloon"], beans: 3, birds: ["straight", "drill", "slam", "split"] },
  { id: 51, chapter: 3, name: "夜市烟花", seed: 402, feats: ["wood", "glass", "tnt", "wind"], beans: 3, birds: ["drill", "split", "slam", "straight"] },
  { id: 52, chapter: 3, name: "月光缆车", seed: 403, feats: ["stone", "boulder", "platform", "slope"], beans: 3, birds: ["slam", "drill", "straight", "split"] },
  { id: 53, chapter: 3, name: "晚风孔明灯", seed: 404, feats: ["wood", "stone", "tnt", "balloon", "wind"], beans: 3, birds: ["split", "drill", "slam", "straight"] },
  { id: 54, chapter: 3, name: "银河玻璃桥", seed: 405, feats: ["stone", "ice", "glass", "platform", "wind"], beans: 3, birds: ["drill", "slam", "split", "straight"] },
  { id: 55, chapter: 3, name: "夜半滚石谷", seed: 406, feats: ["wood", "tnt", "slope", "boulder", "balloon"], beans: 3, birds: ["straight", "slam", "drill", "split"] },
  { id: 56, chapter: 3, name: "云端夜灯", seed: 407, feats: ["stone", "glass", "platform", "balloon", "wind"], beans: 4, birds: ["split", "drill", "slam", "straight", "split"] },
  { id: 57, chapter: 3, name: "极光钻冰夜", seed: 408, feats: ["wood", "ice", "tnt", "boulder", "wind"], beans: 3, birds: ["drill", "drill", "slam", "split"] },
  { id: 58, chapter: 3, name: "星桥升降梯", seed: 409, feats: ["stone", "ice", "slope", "platform", "balloon"], beans: 4, birds: ["slam", "split", "drill", "straight", "drill"] },
  { id: 59, chapter: 3, name: "午夜大爆炸", seed: 410, feats: ["wood", "stone", "glass", "tnt", "boulder", "wind"], beans: 4, birds: ["drill", "slam", "split", "straight", "slam"] },
  { id: 60, chapter: 3, name: "梦境终点站", seed: 411, feats: ["wood", "stone", "ice", "glass", "tnt", "balloon", "platform", "wind"], beans: 5, birds: ["drill", "slam", "split", "straight", "drill", "split"] },
  // —— 火山峡谷(第 5 章):石头、炸药、滚石与斜坡的世界 ——
  { id: 63, chapter: 4, name: "熔岩石桥", seed: 501, feats: ["stone", "tnt", "boulder"], beans: 2, birds: ["straight", "slam", "split"] },
  { id: 64, chapter: 4, name: "火山口滑坡", seed: 502, feats: ["stone", "tnt", "slope"], beans: 2, birds: ["slam", "straight", "split"] },
  { id: 65, chapter: 4, name: "岩浆采石场", seed: 503, feats: ["wood", "stone", "tnt", "slope"], beans: 3, birds: ["straight", "split", "slam", "straight"] },
  { id: 66, chapter: 4, name: "滚烫滚石道", seed: 504, feats: ["wood", "tnt", "slope", "boulder"], beans: 2, birds: ["straight", "slam", "split"] },
  { id: 67, chapter: 4, name: "黑曜石塔", seed: 505, feats: ["stone", "glass", "tnt"], beans: 2, birds: ["drill", "slam", "straight"] },
  { id: 68, chapter: 4, name: "喷发平台", seed: 506, feats: ["stone", "tnt", "boulder", "platform"], beans: 3, birds: ["slam", "drill", "split", "straight"] },
  { id: 69, chapter: 4, name: "热风峡谷", seed: 507, feats: ["stone", "tnt", "slope", "wind"], beans: 2, birds: ["split", "slam", "straight"] },
  { id: 71, chapter: 4, name: "火山玻璃棚", seed: 508, feats: ["glass", "tnt", "slope", "boulder"], beans: 2, birds: ["drill", "straight", "slam"] },
  { id: 72, chapter: 4, name: "碎石营地", seed: 509, feats: ["wood", "stone", "tnt", "boulder"], beans: 3, birds: ["straight", "slam", "split", "straight"] },
  { id: 73, chapter: 4, name: "缆车采矿场", seed: 510, feats: ["stone", "tnt", "slope", "platform"], beans: 3, birds: ["slam", "split", "drill", "straight"] },
  { id: 74, chapter: 4, name: "岩浆水晶洞", seed: 511, feats: ["stone", "glass", "tnt", "boulder"], beans: 3, birds: ["drill", "slam", "split", "straight"] },
  { id: 75, chapter: 4, name: "热气球侦察", seed: 512, feats: ["stone", "slope", "boulder", "balloon"], beans: 3, birds: ["straight", "split", "slam", "straight"] },
  { id: 76, chapter: 4, name: "灰烬风暴", seed: 513, feats: ["wood", "tnt", "boulder", "wind"], beans: 2, birds: ["slam", "drill", "split"] },
  { id: 77, chapter: 4, name: "熔岩瞭望塔", seed: 514, feats: ["stone", "glass", "tnt", "platform"], beans: 3, birds: ["drill", "split", "slam", "straight"] },
  { id: 78, chapter: 4, name: "火山要塞", seed: 515, feats: ["wood", "stone", "tnt", "slope", "boulder"], beans: 3, birds: ["slam", "drill", "split", "straight"] },
  { id: 79, chapter: 4, name: "大喷发前夜", seed: 516, feats: ["stone", "glass", "tnt", "boulder", "platform", "wind"], beans: 4, birds: ["drill", "slam", "split", "straight", "slam"] },
  // —— 彩虹云端(第 6 章):平台、气球与风的空中世界 ——
  { id: 83, chapter: 5, name: "软软白云", seed: 601, feats: ["wood", "platform", "balloon"], beans: 3, birds: ["straight", "split", "slam"] },
  { id: 84, chapter: 5, name: "玻璃风铃", seed: 602, feats: ["glass", "balloon", "wind"], beans: 2, birds: ["split", "straight", "drill"] },
  { id: 85, chapter: 5, name: "顺风木桥", seed: 603, feats: ["wood", "platform", "wind"], beans: 2, birds: ["straight", "slam", "split"] },
  { id: 86, chapter: 5, name: "飘飘热气球", seed: 604, feats: ["wood", "platform", "balloon", "wind"], beans: 3, birds: ["split", "straight", "slam", "straight"] },
  { id: 87, chapter: 5, name: "云朵玻璃屋", seed: 605, feats: ["glass", "platform", "balloon"], beans: 3, birds: ["drill", "split", "straight"] },
  { id: 88, chapter: 5, name: "微风观景桥", seed: 606, feats: ["wood", "glass", "platform", "wind"], beans: 3, birds: ["straight", "drill", "split", "slam"] },
  { id: 89, chapter: 5, name: "泡泡飞行队", seed: 607, feats: ["glass", "platform", "balloon", "wind"], beans: 3, birds: ["split", "drill", "straight", "slam"] },
  { id: 91, chapter: 5, name: "冰晶云梯", seed: 608, feats: ["ice", "platform", "balloon"], beans: 3, birds: ["drill", "split", "straight"] },
  { id: 92, chapter: 5, name: "云上烟花铺", seed: 609, feats: ["stone", "tnt", "platform", "balloon"], beans: 3, birds: ["slam", "split", "drill", "straight"] },
  { id: 93, chapter: 5, name: "极光水晶桥", seed: 610, feats: ["ice", "glass", "platform", "balloon", "wind"], beans: 3, birds: ["drill", "split", "slam", "straight"] },
  { id: 94, chapter: 5, name: "雪云缆车", seed: 611, feats: ["wood", "ice", "platform", "balloon", "wind"], beans: 3, birds: ["split", "drill", "slam", "straight"] },
  { id: 95, chapter: 5, name: "云端爆竹节", seed: 612, feats: ["glass", "tnt", "platform", "balloon", "wind"], beans: 4, birds: ["drill", "slam", "split", "straight", "split"] },
  { id: 96, chapter: 5, name: "彩虹大桥", seed: 613, feats: ["stone", "ice", "glass", "platform", "balloon", "wind"], beans: 4, birds: ["drill", "slam", "split", "straight", "drill"] },
  { id: 97, chapter: 5, name: "云海滚滚", seed: 614, feats: ["wood", "boulder", "platform", "balloon", "wind"], beans: 3, birds: ["straight", "slam", "drill", "split"] },
  { id: 98, chapter: 5, name: "银河嘉年华", seed: 615, feats: ["wood", "ice", "glass", "tnt", "platform", "balloon", "wind"], beans: 4, birds: ["drill", "slam", "split", "straight", "split", "straight"] }
];

function buildLevel(r: Recipe): LevelDef {
  const rng = makeRng(r.id * 1013 + r.seed);
  const has = (f: FeatKind): boolean => r.feats.includes(f);

  const blocks: BlockDef[] = [];
  const beans: BeanDef[] = [];
  const slopes: SlopeDef[] = [];
  const boulders: BoulderDef[] = [];
  const platforms: PlatformDef[] = [];
  const balloons: BalloonDef[] = [];
  const winds: WindDef[] = [];
  const beanSlots: BeanDef[] = [];

  let x = 230 + Math.round(rng() * 16);

  if (has("slope")) {
    const h = 44 + Math.round(rng() * 20);
    slopes.push({ x, y: G - h, w: 70, h, dir: "up-right" });
    x += 82;
  }
  if (has("boulder")) {
    // 滚石堵在阵地前面:要么推开它,要么从上面飞过去
    boulders.push({ x: x + 15, y: G - 13, r: 13 });
    x += 40;
  }

  const mats = (["wood", "stone", "ice", "glass"] as BlockKind[]).filter(has);
  if (mats.length === 0) mats.push("wood");
  const towerCount =
    has("slope") || has("boulder") ? 2 : mats.length >= 4 ? 3 : 2 + (rng() < 0.55 ? 1 : 0);
  const tntTower = has("tnt") ? Math.floor(rng() * towerCount) : -1;

  for (let i = 0; i < towerCount; i++) {
    const mat = mats[i % mats.length];
    const accent = mats[(i + 1) % mats.length];
    if (i % 2 === 0) {
      // 双柱亭:两根柱子 + 顶板,里面可以藏 TNT 或绿绿豆
      const h = 40 + Math.round(rng() * 22);
      blocks.push(bl(mat, x + 4, G - h, 14, h));
      blocks.push(bl(mat, x + 46, G - h, 14, h));
      blocks.push(bl(accent, x, G - h - 12, 64, 12));
      if (i === tntTower) {
        blocks.push(bl("tnt", x + 20, G - 24, 24, 24));
      } else {
        beanSlots.push({ x: x + 32, y: G - 10 });
      }
      beanSlots.push({ x: x + 32, y: G - h - 22 });
      x += 78;
    } else {
      // 叠叠塔:方块摞起来,TNT 关会把 TNT 放在塔顶
      const n = 2 + (rng() < 0.5 ? 1 : 0);
      let top = G;
      for (let k = 0; k < n; k++) {
        blocks.push(bl(k % 2 === 0 ? mat : accent, x, top - 26, 26, 26));
        top -= 26;
      }
      if (i === tntTower) {
        blocks.push(bl("tnt", x + 1, top - 24, 24, 24));
        beanSlots.push({ x: x + 47, y: G - 10 });
        x += 68;
      } else {
        beanSlots.push({ x: x + 13, y: top - 10 });
        x += 44;
      }
    }
  }

  let platBean: BeanDef | null = null;
  if (has("platform")) {
    const vert = r.id % 2 === 1;
    const px = 300 + Math.round(rng() * 60);
    const p: PlatformDef = vert
      ? {
          x: px,
          y: 110 + Math.round(rng() * 40),
          w: 64,
          h: 12,
          dx: 0,
          dy: 34 + Math.round(rng() * 20),
          period: 4.5 + rng() * 2
        }
      : {
          x: px,
          y: 132 + Math.round(rng() * 48),
          w: 64,
          h: 12,
          dx: 50 + Math.round(rng() * 25),
          dy: 0,
          period: 3.6 + rng() * 1.6
        };
    platforms.push(p);
    platBean = { x: p.x + p.w / 2, y: p.y - 10 };
  }

  if (has("balloon")) {
    balloons.push({ x: 330 + Math.round(rng() * 130), y: 74 + Math.round(rng() * 30) });
  }

  if (has("wind")) {
    const up = rng() < 0.5;
    winds.push(
      up
        ? {
            x: 235 + Math.round(rng() * 25),
            y: 46 + Math.round(rng() * 20),
            w: 120 + Math.round(rng() * 50),
            h: 150 + Math.round(rng() * 40),
            fx: 0,
            fy: -(170 + Math.round(rng() * 90))
          }
        : {
            x: 245 + Math.round(rng() * 20),
            y: 30 + Math.round(rng() * 20),
            w: 170 + Math.round(rng() * 60),
            h: 140 + Math.round(rng() * 40),
            fx: -(110 + Math.round(rng() * 60)),
            fy: 0
          }
    );
  }

  // 分配绿绿豆:气球自带一颗;平台上一颗;其余从塔位里抽;不够就排在地上
  let need = r.beans - balloons.length;
  if (platBean && need > 0) {
    beans.push(platBean);
    need--;
  }
  while (need > 0) {
    if (beanSlots.length > 0) {
      const idx = Math.floor(rng() * beanSlots.length);
      beans.push(beanSlots.splice(idx, 1)[0]);
    } else {
      beans.push({ x: Math.min(505, x + 10), y: G - 10 });
      x += 26;
    }
    need--;
  }

  const level: LevelDef = { id: r.id, chapter: r.chapter, name: r.name, birds: r.birds, beans, blocks };
  if (slopes.length) level.slopes = slopes;
  if (boulders.length) level.boulders = boulders;
  if (platforms.length) level.platforms = platforms;
  if (balloons.length) level.balloons = balloons;
  if (winds.length) level.winds = winds;
  return level;
}

export const GENERATED_LEVELS: LevelDef[] = RECIPES.map(buildLevel);

/* ------------------------------------------------------------------ */
/* 1.1 新章手写关(12 关):风车高地 / 冰晶矿洞 / 熔岩工坊                */
/* ------------------------------------------------------------------ */

const HANDMADE_LEVELS_V2: LevelDef[] = [
  // —— 风车高地(第 7 章):大风与回旋小鸟卷卷的主场 ——
  {
    id: 100,
    chapter: 6,
    name: "进山的风",
    handmade: true,
    birds: ["boomerang", "straight", "straight"],
    beans: [
      { x: 424, y: G - 36 },
      { x: 484, y: G - 10 }
    ],
    blocks: [bl("wood", 410, G - 26, 26, 26), bl("glass", 452, G - 60, 18, 60)],
    winds: [{ x: 240, y: 60, w: 110, h: 160, fx: 0, fy: -180 }]
  },
  {
    id: 101,
    chapter: 6,
    name: "卷卷试飞",
    handmade: true,
    birds: ["boomerang", "boomerang", "straight"],
    beans: [
      { x: 430, y: G - 10 },
      { x: 500, y: G - 36 }
    ],
    blocks: [
      bl("stone", 380, G - 80, 16, 80),
      bl("ice", 372, G - 92, 100, 12),
      bl("wood", 486, G - 26, 26, 26)
    ],
    winds: [{ x: 235, y: 50, w: 105, h: 150, fx: 0, fy: -200 }]
  },
  {
    id: 115,
    chapter: 6,
    name: "回旋大风车",
    handmade: true,
    birds: ["boomerang", "split", "straight", "slam"],
    beans: [{ x: 470, y: G - 114 }],
    blocks: [bl("stone", 458, G - 104, 24, 104)],
    balloons: [{ x: 380, y: 110 }],
    winds: [{ x: 260, y: 30, w: 200, h: 120, fx: -140, fy: 0 }]
  },
  {
    id: 129,
    chapter: 6,
    name: "高地放风节",
    handmade: true,
    birds: ["boomerang", "slam", "split", "straight", "straight"],
    beans: [
      { x: 419, y: G - 66 },
      { x: 495, y: G - 10 }
    ],
    blocks: [
      bl("glass", 410, G - 56, 18, 56),
      bl("stone", 470, G - 36, 12, 36),
      bl("stone", 508, G - 36, 12, 36),
      bl("stone", 464, G - 48, 58, 12)
    ],
    balloons: [{ x: 340, y: 96 }],
    winds: [{ x: 238, y: 44, w: 120, h: 170, fx: 0, fy: -230 }]
  },
  // —— 冰晶矿洞(第 8 章):传送门与冰晶的地下世界 ——
  {
    id: 130,
    chapter: 7,
    name: "初见传送门",
    handmade: true,
    birds: ["straight", "split", "straight"],
    beans: [{ x: 445, y: G - 10 }],
    blocks: [
      bl("glass", 396, G - 70, 16, 70),
      bl("stone", 415, G - 40, 14, 40),
      bl("stone", 462, G - 40, 14, 40)
    ],
    portals: [{ ax: 250, ay: 140, bx: 445, by: 84, r: 16 }]
  },
  {
    id: 131,
    chapter: 7,
    name: "水晶回廊",
    handmade: true,
    birds: ["drill", "straight", "split"],
    beans: [
      { x: 430, y: G - 80 },
      { x: 500, y: G - 10 }
    ],
    blocks: [bl("ice", 420, G - 70, 20, 70), bl("glass", 480, G - 46, 16, 46)],
    portals: [{ ax: 255, ay: 120, bx: 470, by: 70, r: 15 }]
  },
  {
    id: 145,
    chapter: 7,
    name: "矿洞中枢",
    handmade: true,
    birds: ["drill", "slam", "split", "straight"],
    beans: [
      { x: 419, y: G - 36 },
      { x: 480, y: G - 62 }
    ],
    blocks: [bl("wood", 406, G - 26, 26, 26), bl("glass", 470, G - 52, 20, 52)],
    balloons: [{ x: 360, y: 100 }],
    portals: [{ ax: 250, ay: 155, bx: 430, by: 78, r: 15 }]
  },
  {
    id: 159,
    chapter: 7,
    name: "矿洞深处的大水晶",
    handmade: true,
    birds: ["drill", "split", "slam", "straight", "drill"],
    beans: [
      { x: 412, y: G - 96 },
      { x: 466, y: G - 10 }
    ],
    blocks: [
      bl("ice", 400, G - 86, 24, 86),
      bl("stone", 446, G - 44, 12, 44),
      bl("stone", 486, G - 44, 12, 44),
      bl("ice", 440, G - 56, 64, 12)
    ],
    portals: [{ ax: 248, ay: 118, bx: 466, by: 190, r: 15 }]
  },
  // —— 熔岩工坊(第 9 章):两段连锁的岩壳块 + 火花四溅的机关 ——
  {
    id: 160,
    chapter: 8,
    name: "岩壳登场",
    handmade: true,
    birds: ["slam", "straight", "straight"],
    beans: [
      { x: 445, y: G - 40 },
      { x: 512, y: G - 10 }
    ],
    blocks: [bl("shell", 430, G - 30, 30, 30), bl("tnt", 478, G - 24, 24, 24)]
  },
  {
    id: 161,
    chapter: 8,
    name: "工坊流水线",
    handmade: true,
    birds: ["slam", "drill", "split"],
    beans: [
      { x: 445, y: G - 40 },
      { x: 382, y: 140 }
    ],
    blocks: [bl("shell", 430, G - 30, 30, 30), bl("wood", 470, G - 26, 26, 26)],
    platforms: [{ x: 350, y: 150, w: 64, h: 12, dx: 55, dy: 0, period: 4.2 }]
  },
  {
    id: 175,
    chapter: 8,
    name: "双层岩壳塔",
    handmade: true,
    birds: ["slam", "slam", "drill", "straight"],
    beans: [
      { x: 445, y: G - 70 },
      { x: 508, y: G - 10 }
    ],
    blocks: [
      bl("shell", 430, G - 30, 30, 30),
      bl("shell", 430, G - 60, 30, 30),
      bl("glass", 478, G - 40, 16, 40)
    ],
    boulders: [{ x: 390, y: G - 13, r: 13 }]
  },
  {
    id: 188,
    chapter: 8,
    name: "熔炉大决战",
    handmade: true,
    birds: ["boomerang", "drill", "slam", "split", "straight", "straight"],
    beans: [
      { x: 411, y: G - 108 },
      { x: 432, y: G - 10 },
      { x: 505, y: G - 36 }
    ],
    blocks: [
      bl("stone", 380, G - 56, 14, 56),
      bl("stone", 442, G - 56, 14, 56),
      bl("stone", 372, G - 68, 92, 12),
      bl("tnt", 396, G - 24, 24, 24),
      bl("shell", 396, G - 98, 30, 30),
      bl("wood", 492, G - 26, 26, 26)
    ],
    balloons: [{ x: 330, y: 92 }],
    winds: [{ x: 235, y: 40, w: 110, h: 170, fx: 0, fy: -220 }],
    portals: [{ ax: 252, ay: 128, bx: 411, by: 160, r: 15 }]
  }
];

/* ------------------------------------------------------------------ */
/* 1.1 新章生成关(77 关):生成器 v2 支持传送门与岩壳块                  */
/* v1 的 buildLevel 与 RECIPES 原样保留,保证前 99 关一个字节都不变。    */
/* ------------------------------------------------------------------ */

type FeatKind2 = FeatKind | "portal" | "shell";

interface Recipe2 {
  id: number;
  chapter: number;
  name: string;
  seed: number;
  feats: FeatKind2[];
  beans: number;
  birds: BirdKind[];
}

const RECIPES_V2: Recipe2[] = [
  // —— 风车高地(第 7 章):每关都有风区,卷卷全程陪飞 ——
  { id: 102, chapter: 6, name: "微风草坡", seed: 701, feats: ["wood", "glass", "wind"], beans: 2, birds: ["boomerang", "straight", "split"] },
  { id: 103, chapter: 6, name: "顺风信箱", seed: 702, feats: ["wood", "tnt", "wind"], beans: 2, birds: ["straight", "boomerang", "straight"] },
  { id: 104, chapter: 6, name: "山风木塔", seed: 703, feats: ["wood", "stone", "wind", "glass"], beans: 3, birds: ["slam", "boomerang", "split", "straight"] },
  { id: 105, chapter: 6, name: "风车磨坊", seed: 704, feats: ["stone", "glass", "wind", "slope"], beans: 2, birds: ["boomerang", "slam", "straight"] },
  { id: 106, chapter: 6, name: "逆风飞行赛", seed: 705, feats: ["wood", "balloon", "wind"], beans: 3, birds: ["split", "boomerang", "straight", "straight"] },
  { id: 107, chapter: 6, name: "滚草垛", seed: 706, feats: ["wood", "boulder", "wind", "slope"], beans: 2, birds: ["straight", "boomerang", "slam"] },
  { id: 108, chapter: 6, name: "高地缆车", seed: 707, feats: ["stone", "platform", "wind"], beans: 3, birds: ["boomerang", "split", "slam", "straight"] },
  { id: 109, chapter: 6, name: "玻璃风塔", seed: 708, feats: ["glass", "tnt", "wind"], beans: 2, birds: ["drill", "boomerang", "straight"] },
  { id: 110, chapter: 6, name: "追风气球队", seed: 709, feats: ["wood", "balloon", "wind", "platform"], beans: 3, birds: ["split", "straight", "boomerang", "slam"] },
  { id: 111, chapter: 6, name: "石墙背风处", seed: 710, feats: ["stone", "tnt", "wind"], beans: 3, birds: ["boomerang", "slam", "split", "straight"] },
  { id: 112, chapter: 6, name: "冰糖风铃", seed: 711, feats: ["ice", "glass", "wind"], beans: 2, birds: ["drill", "boomerang", "split"] },
  { id: 113, chapter: 6, name: "上升气流谷", seed: 712, feats: ["wood", "stone", "wind", "balloon"], beans: 3, birds: ["boomerang", "split", "slam", "straight"] },
  { id: 114, chapter: 6, name: "风口滚石阵", seed: 713, feats: ["stone", "boulder", "wind", "tnt"], beans: 2, birds: ["slam", "boomerang", "straight"] },
  { id: 116, chapter: 6, name: "半山玻璃屋", seed: 714, feats: ["glass", "stone", "wind", "platform"], beans: 3, birds: ["drill", "boomerang", "slam", "straight"] },
  { id: 117, chapter: 6, name: "木箱风车局", seed: 715, feats: ["wood", "tnt", "wind", "boulder"], beans: 2, birds: ["straight", "slam", "boomerang"] },
  { id: 118, chapter: 6, name: "云梯哨站", seed: 716, feats: ["stone", "platform", "wind", "balloon"], beans: 3, birds: ["boomerang", "split", "drill", "straight"] },
  { id: 119, chapter: 6, name: "大风天工地", seed: 717, feats: ["wood", "stone", "tnt", "wind"], beans: 3, birds: ["slam", "boomerang", "split", "straight"] },
  { id: 120, chapter: 6, name: "风筝广场", seed: 718, feats: ["glass", "balloon", "wind"], beans: 3, birds: ["split", "boomerang", "straight", "slam"] },
  { id: 121, chapter: 6, name: "呼呼斜坡道", seed: 719, feats: ["wood", "slope", "wind", "tnt"], beans: 2, birds: ["boomerang", "straight", "slam"] },
  { id: 122, chapter: 6, name: "冰风瞭望塔", seed: 720, feats: ["ice", "stone", "wind", "platform"], beans: 3, birds: ["drill", "slam", "boomerang", "straight"] },
  { id: 123, chapter: 6, name: "逆风爆破组", seed: 721, feats: ["glass", "tnt", "wind", "boulder"], beans: 3, birds: ["slam", "drill", "boomerang", "split"] },
  { id: 124, chapter: 6, name: "高地观星台", seed: 722, feats: ["glass", "platform", "wind", "balloon"], beans: 3, birds: ["split", "drill", "boomerang", "straight"] },
  { id: 125, chapter: 6, name: "风谷木堡", seed: 723, feats: ["wood", "glass", "tnt", "wind", "slope"], beans: 3, birds: ["boomerang", "slam", "split", "straight"] },
  { id: 126, chapter: 6, name: "翘板与风车", seed: 724, feats: ["wood", "stone", "platform", "wind"], beans: 3, birds: ["straight", "boomerang", "drill", "slam"] },
  { id: 127, chapter: 6, name: "大风车检修日", seed: 725, feats: ["stone", "ice", "tnt", "wind", "balloon"], beans: 4, birds: ["drill", "boomerang", "slam", "split", "straight"] },
  { id: 128, chapter: 6, name: "高地风暴眼", seed: 726, feats: ["wood", "stone", "glass", "tnt", "wind", "boulder"], beans: 4, birds: ["boomerang", "slam", "drill", "split", "straight"] },
  // —— 冰晶矿洞(第 8 章):每关都有冰晶或传送门 ——
  { id: 132, chapter: 7, name: "蓝晶小径", seed: 801, feats: ["ice", "glass", "portal"], beans: 2, birds: ["drill", "straight", "split"] },
  { id: 133, chapter: 7, name: "矿车站台", seed: 802, feats: ["ice", "stone", "platform"], beans: 3, birds: ["drill", "slam", "split", "straight"] },
  { id: 134, chapter: 7, name: "门后的豆豆", seed: 803, feats: ["wood", "portal", "tnt"], beans: 2, birds: ["straight", "split", "slam"] },
  { id: 135, chapter: 7, name: "冰柱回音厅", seed: 804, feats: ["ice", "glass", "boulder"], beans: 2, birds: ["drill", "slam", "straight"] },
  { id: 136, chapter: 7, name: "双门矿道", seed: 805, feats: ["stone", "portal", "ice"], beans: 3, birds: ["straight", "drill", "boomerang", "split"] },
  { id: 137, chapter: 7, name: "水晶吊灯", seed: 806, feats: ["ice", "balloon", "portal"], beans: 3, birds: ["split", "drill", "straight", "slam"] },
  { id: 138, chapter: 7, name: "滑冰运输线", seed: 807, feats: ["ice", "slope", "boulder"], beans: 2, birds: ["drill", "straight", "slam"] },
  { id: 139, chapter: 7, name: "矿洞爆破日", seed: 808, feats: ["stone", "tnt", "portal"], beans: 3, birds: ["slam", "drill", "split", "straight"] },
  { id: 140, chapter: 7, name: "冰镜迷宫", seed: 809, feats: ["ice", "glass", "portal", "platform"], beans: 3, birds: ["drill", "split", "boomerang", "straight"] },
  { id: 141, chapter: 7, name: "蓝宝石堡垒", seed: 810, feats: ["ice", "stone", "tnt"], beans: 3, birds: ["slam", "drill", "split", "straight"] },
  { id: 142, chapter: 7, name: "传送门试验场", seed: 811, feats: ["glass", "portal", "wind"], beans: 2, birds: ["split", "straight", "drill"] },
  { id: 143, chapter: 7, name: "钟乳石广场", seed: 812, feats: ["ice", "boulder", "slope", "tnt"], beans: 3, birds: ["drill", "slam", "boomerang", "straight"] },
  { id: 144, chapter: 7, name: "矿灯气球屋", seed: 813, feats: ["wood", "ice", "balloon"], beans: 3, birds: ["split", "drill", "slam", "straight"] },
  { id: 146, chapter: 7, name: "寒气回旋谷", seed: 814, feats: ["ice", "wind", "portal"], beans: 3, birds: ["boomerang", "drill", "split", "straight"] },
  { id: 147, chapter: 7, name: "冰封月台", seed: 815, feats: ["ice", "platform", "portal"], beans: 3, birds: ["drill", "split", "slam", "straight"] },
  { id: 148, chapter: 7, name: "水晶爆破房", seed: 816, feats: ["glass", "tnt", "portal"], beans: 3, birds: ["drill", "slam", "split", "straight"] },
  { id: 149, chapter: 7, name: "冰河渡口", seed: 817, feats: ["ice", "stone", "platform", "boulder"], beans: 3, birds: ["slam", "drill", "straight", "split"] },
  { id: 150, chapter: 7, name: "蓝光电梯井", seed: 818, feats: ["ice", "portal", "balloon", "wind"], beans: 3, birds: ["split", "drill", "boomerang", "straight"] },
  { id: 151, chapter: 7, name: "碎冰工作面", seed: 819, feats: ["ice", "tnt", "boulder"], beans: 3, birds: ["drill", "slam", "split", "straight"] },
  { id: 152, chapter: 7, name: "幽光玻璃桥", seed: 820, feats: ["glass", "portal", "platform"], beans: 3, birds: ["split", "drill", "slam", "straight"] },
  { id: 153, chapter: 7, name: "冰洞风口", seed: 821, feats: ["ice", "wind", "slope"], beans: 2, birds: ["drill", "boomerang", "straight"] },
  { id: 154, chapter: 7, name: "双门大厅", seed: 822, feats: ["stone", "ice", "portal", "tnt"], beans: 3, birds: ["slam", "drill", "split", "straight"] },
  { id: 155, chapter: 7, name: "水晶滚珠道", seed: 823, feats: ["ice", "boulder", "portal", "slope"], beans: 3, birds: ["drill", "straight", "slam", "boomerang"] },
  { id: 156, chapter: 7, name: "矿洞气球节", seed: 824, feats: ["ice", "balloon", "wind", "glass"], beans: 3, birds: ["split", "boomerang", "drill", "straight"] },
  { id: 157, chapter: 7, name: "深蓝密室", seed: 825, feats: ["ice", "glass", "portal", "tnt"], beans: 3, birds: ["drill", "slam", "split", "straight"] },
  { id: 158, chapter: 7, name: "大水晶前厅", seed: 826, feats: ["ice", "stone", "portal", "platform", "balloon"], beans: 4, birds: ["drill", "split", "slam", "boomerang", "straight"] },
  // —— 熔岩工坊(第 9 章):每关都有岩壳块或 TNT ——
  { id: 162, chapter: 8, name: "壳中豆豆", seed: 901, feats: ["shell", "tnt"], beans: 2, birds: ["slam", "straight", "split"] },
  { id: 163, chapter: 8, name: "铁匠的滚石", seed: 902, feats: ["stone", "boulder", "tnt"], beans: 2, birds: ["straight", "slam", "drill"] },
  { id: 164, chapter: 8, name: "岩壳双塔", seed: 903, feats: ["shell", "glass", "boulder"], beans: 3, birds: ["slam", "drill", "split", "straight"] },
  { id: 165, chapter: 8, name: "流水线平台", seed: 904, feats: ["shell", "platform", "tnt"], beans: 3, birds: ["slam", "split", "drill", "straight"] },
  { id: 166, chapter: 8, name: "火花玻璃棚", seed: 905, feats: ["glass", "tnt", "slope"], beans: 2, birds: ["drill", "straight", "slam"] },
  { id: 167, chapter: 8, name: "岩壳仓库", seed: 906, feats: ["shell", "wood", "tnt"], beans: 3, birds: ["slam", "drill", "split", "straight"] },
  { id: 168, chapter: 8, name: "热风烟囱", seed: 907, feats: ["stone", "wind", "tnt", "shell"], beans: 3, birds: ["boomerang", "slam", "drill", "straight"] },
  { id: 169, chapter: 8, name: "锻造台连爆", seed: 908, feats: ["shell", "tnt", "boulder"], beans: 3, birds: ["slam", "drill", "split", "straight"] },
  { id: 170, chapter: 8, name: "工坊吊索", seed: 909, feats: ["shell", "balloon", "platform"], beans: 3, birds: ["split", "slam", "drill", "straight"] },
  { id: 171, chapter: 8, name: "岩浆滑道", seed: 910, feats: ["stone", "slope", "tnt", "boulder"], beans: 3, birds: ["slam", "straight", "drill", "split"] },
  { id: 172, chapter: 8, name: "壳里藏晶", seed: 911, feats: ["shell", "ice", "glass"], beans: 3, birds: ["drill", "slam", "split", "straight"] },
  { id: 173, chapter: 8, name: "回旋锻锤", seed: 912, feats: ["shell", "wind", "tnt"], beans: 3, birds: ["boomerang", "slam", "drill", "straight"] },
  { id: 174, chapter: 8, name: "双壳保险库", seed: 913, feats: ["shell", "stone", "tnt", "platform"], beans: 3, birds: ["slam", "drill", "split", "straight"] },
  { id: 176, chapter: 8, name: "火花气球间", seed: 914, feats: ["tnt", "balloon", "wind"], beans: 3, birds: ["split", "slam", "boomerang", "straight"] },
  { id: 177, chapter: 8, name: "岩壳滚珠台", seed: 915, feats: ["shell", "boulder", "slope"], beans: 3, birds: ["slam", "drill", "straight", "split"] },
  { id: 178, chapter: 8, name: "熔炉观察窗", seed: 916, feats: ["glass", "shell", "tnt"], beans: 3, birds: ["drill", "slam", "split", "straight"] },
  { id: 179, chapter: 8, name: "传送检修门", seed: 917, feats: ["shell", "portal", "tnt"], beans: 3, birds: ["drill", "slam", "split", "straight"] },
  { id: 180, chapter: 8, name: "大齿轮平台", seed: 918, feats: ["stone", "platform", "tnt", "wind"], beans: 3, birds: ["slam", "split", "drill", "straight"] },
  { id: 181, chapter: 8, name: "岩壳烟花库", seed: 919, feats: ["shell", "tnt", "balloon"], beans: 3, birds: ["slam", "split", "drill", "straight"] },
  { id: 182, chapter: 8, name: "热浪玻璃廊", seed: 920, feats: ["glass", "wind", "tnt", "slope"], beans: 3, birds: ["drill", "boomerang", "slam", "straight"] },
  { id: 183, chapter: 8, name: "壳塔爆破夜", seed: 921, feats: ["shell", "stone", "tnt", "boulder"], beans: 3, birds: ["slam", "drill", "split", "straight"] },
  { id: 184, chapter: 8, name: "工坊大风扇", seed: 922, feats: ["shell", "wind", "platform"], beans: 3, birds: ["boomerang", "slam", "drill", "straight"] },
  { id: 185, chapter: 8, name: "岩壳传送阵", seed: 923, feats: ["shell", "portal", "ice"], beans: 3, birds: ["drill", "slam", "boomerang", "straight"] },
  { id: 186, chapter: 8, name: "熔炉前夜", seed: 924, feats: ["shell", "tnt", "platform", "balloon"], beans: 4, birds: ["slam", "drill", "split", "boomerang", "straight"] },
  { id: 187, chapter: 8, name: "工坊总动员", seed: 925, feats: ["shell", "stone", "glass", "tnt", "boulder", "wind"], beans: 4, birds: ["slam", "drill", "split", "boomerang", "straight"] }
];

/**
 * 生成器 v2:在 v1 的布局套路上叠加传送门与岩壳块。
 * 岩壳碉堡放在阵地最前排,传送门吊在半空(入口在弹弓弧线上、出口在阵地上方)。
 */
function buildLevel2(r: Recipe2): LevelDef {
  const rng = makeRng(r.id * 1013 + r.seed);
  const has = (f: FeatKind2): boolean => r.feats.includes(f);

  const blocks: BlockDef[] = [];
  const beans: BeanDef[] = [];
  const slopes: SlopeDef[] = [];
  const boulders: BoulderDef[] = [];
  const platforms: PlatformDef[] = [];
  const balloons: BalloonDef[] = [];
  const winds: WindDef[] = [];
  const portals: PortalDef[] = [];
  const beanSlots: BeanDef[] = [];

  let x = 230 + Math.round(rng() * 16);

  if (has("slope")) {
    const h = 44 + Math.round(rng() * 20);
    slopes.push({ x, y: G - h, w: 70, h, dir: "up-right" });
    x += 82;
  }
  if (has("boulder")) {
    boulders.push({ x: x + 15, y: G - 13, r: 13 });
    x += 40;
  }
  if (has("shell")) {
    // 岩壳碉堡:一层或两层岩壳,顶上放一颗豆——外壳要敲两次才碎
    const twin = rng() < 0.4;
    blocks.push(bl("shell", x + 2, G - 30, 30, 30));
    if (twin) {
      blocks.push(bl("shell", x + 2, G - 60, 30, 30));
      beanSlots.push({ x: x + 17, y: G - 70 });
    } else {
      beanSlots.push({ x: x + 17, y: G - 40 });
    }
    x += 46;
  }

  const mats = (["wood", "stone", "ice", "glass"] as BlockKind[]).filter((m) =>
    r.feats.includes(m as FeatKind2)
  );
  if (mats.length === 0) mats.push("wood");
  const towerCount =
    has("slope") || has("boulder") || has("shell")
      ? 2
      : mats.length >= 4
        ? 3
        : 2 + (rng() < 0.55 ? 1 : 0);
  const tntTower = has("tnt") ? Math.floor(rng() * towerCount) : -1;

  for (let i = 0; i < towerCount; i++) {
    const mat = mats[i % mats.length];
    const accent = mats[(i + 1) % mats.length];
    if (i % 2 === 0) {
      if (x + 64 > 528) break;
      const h = 40 + Math.round(rng() * 22);
      blocks.push(bl(mat, x + 4, G - h, 14, h));
      blocks.push(bl(mat, x + 46, G - h, 14, h));
      blocks.push(bl(accent, x, G - h - 12, 64, 12));
      if (i === tntTower) {
        blocks.push(bl("tnt", x + 20, G - 24, 24, 24));
      } else {
        beanSlots.push({ x: x + 32, y: G - 10 });
      }
      beanSlots.push({ x: x + 32, y: G - h - 22 });
      x += 78;
    } else {
      if (x + 26 > 528) break;
      const n = 2 + (rng() < 0.5 ? 1 : 0);
      let top = G;
      for (let k = 0; k < n; k++) {
        blocks.push(bl(k % 2 === 0 ? mat : accent, x, top - 26, 26, 26));
        top -= 26;
      }
      if (i === tntTower && x + 25 <= 528) {
        blocks.push(bl("tnt", x + 1, top - 24, 24, 24));
        beanSlots.push({ x: x + 47, y: G - 10 });
        x += 68;
      } else {
        beanSlots.push({ x: x + 13, y: top - 10 });
        x += 44;
      }
    }
  }

  let platBean: BeanDef | null = null;
  if (has("platform")) {
    const vert = r.id % 2 === 1;
    const px = 300 + Math.round(rng() * 60);
    const p: PlatformDef = vert
      ? {
          x: px,
          y: 110 + Math.round(rng() * 40),
          w: 64,
          h: 12,
          dx: 0,
          dy: 34 + Math.round(rng() * 20),
          period: 4.5 + rng() * 2
        }
      : {
          x: px,
          y: 132 + Math.round(rng() * 48),
          w: 64,
          h: 12,
          dx: 50 + Math.round(rng() * 25),
          dy: 0,
          period: 3.6 + rng() * 1.6
        };
    platforms.push(p);
    platBean = { x: p.x + p.w / 2, y: p.y - 10 };
  }

  if (has("balloon")) {
    balloons.push({ x: 330 + Math.round(rng() * 130), y: 74 + Math.round(rng() * 30) });
  }

  if (has("wind")) {
    const up = rng() < 0.5;
    winds.push(
      up
        ? {
            x: 235 + Math.round(rng() * 25),
            y: 46 + Math.round(rng() * 20),
            w: 120 + Math.round(rng() * 50),
            h: 150 + Math.round(rng() * 40),
            fx: 0,
            fy: -(170 + Math.round(rng() * 90))
          }
        : {
            x: 245 + Math.round(rng() * 20),
            y: 30 + Math.round(rng() * 20),
            w: 170 + Math.round(rng() * 60),
            h: 140 + Math.round(rng() * 40),
            fx: -(110 + Math.round(rng() * 60)),
            fy: 0
          }
    );
  }

  if (has("portal")) {
    // 入口挂在弹弓正前方的半空,出口悬在阵地上方:钻进去就能空降
    portals.push({
      ax: 245 + Math.round(rng() * 30),
      ay: 110 + Math.round(rng() * 55),
      bx: 400 + Math.round(rng() * 70),
      by: 66 + Math.round(rng() * 40),
      r: 15
    });
  }

  let need = r.beans - balloons.length;
  if (platBean && need > 0) {
    beans.push(platBean);
    need--;
  }
  while (need > 0) {
    if (beanSlots.length > 0) {
      const idx = Math.floor(rng() * beanSlots.length);
      beans.push(beanSlots.splice(idx, 1)[0]);
    } else {
      beans.push({ x: Math.min(505, x + 10), y: G - 10 });
      x += 26;
    }
    need--;
  }

  const level: LevelDef = { id: r.id, chapter: r.chapter, name: r.name, birds: r.birds, beans, blocks };
  if (slopes.length) level.slopes = slopes;
  if (boulders.length) level.boulders = boulders;
  if (platforms.length) level.platforms = platforms;
  if (balloons.length) level.balloons = balloons;
  if (winds.length) level.winds = winds;
  if (portals.length) level.portals = portals;
  return level;
}

export const GENERATED_LEVELS_V2: LevelDef[] = RECIPES_V2.map(buildLevel2);

/** 全部 188 关,按 id 从小到大(前 99 关与 1.0 完全一致) */
export const LEVELS: LevelDef[] = [
  ...HANDMADE_LEVELS,
  ...GENERATED_LEVELS,
  ...HANDMADE_LEVELS_V2,
  ...GENERATED_LEVELS_V2
].sort((a, b) => a.id - b.id);

export function levelsOfChapter(chapter: number): LevelDef[] {
  return LEVELS.filter((l) => l.chapter === chapter);
}

/** 本关出现的障碍种类(由实际内容推导,测试用) */
export function obstacleKinds(l: LevelDef): string[] {
  const s = new Set<string>();
  for (const b of l.blocks) s.add(b.kind);
  if (l.slopes?.length) s.add("slope");
  if (l.boulders?.length) s.add("boulder");
  if (l.platforms?.length) s.add("platform");
  if (l.balloons?.length) s.add("balloon");
  if (l.winds?.length) s.add("wind");
  if (l.portals?.length) s.add("portal");
  return [...s].sort();
}

/** 「特殊障碍」:木头石头以外的花样(1.1 新增岩壳块与传送门) */
export const SPECIAL_KINDS = [
  "ice",
  "glass",
  "tnt",
  "boulder",
  "slope",
  "platform",
  "balloon",
  "wind",
  "shell",
  "portal"
] as const;

/** 本关目标总数(普通豆 + 气球吊豆) */
export function targetCount(l: LevelDef): number {
  return l.beans.length + (l.balloons?.length ?? 0);
}
