// 糖果秋千关卡数据。画布坐标系 360 x 480，共 24 关、3 个章节。
// 星星位置按"标准玩法"的摆动/抛物线轨迹校算过（关键关卡有物理仿真测试）。

export interface RopeDef {
  /** 锚点位置 */
  x: number;
  y: number;
  /** 绳段数（不传按长度自动算） */
  segments?: number;
  /** 绳总长（不传用锚点到糖果的距离） */
  length?: number;
}

export interface HookDef {
  x: number;
  y: number;
  /** 糖果进入这个半径就自动抓住，生成一条新绳 */
  radius: number;
}

export interface BubbleDef {
  x: number;
  y: number;
}

export interface SpikeDef {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 刺尖朝向，只影响画法 */
  dir: "up" | "down" | "left" | "right";
}

export interface BoardDef {
  /** 在 (x1,y1) 和 (x2,y2) 之间来回滑动 */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
  h: number;
  /** 一个来回的秒数 */
  period: number;
}

export interface PortalDef {
  /** 入口（吸入的漩涡） */
  ax: number;
  ay: number;
  /** 出口（吐出的圆环），单向传送，保留速度 */
  bx: number;
  by: number;
}

export interface BalloonDef {
  x: number;
  y: number;
  /** 点一下气球就朝这个方向呼出一阵风 */
  dir: "up" | "down" | "left" | "right";
  /** 能呼几次风 */
  puffs: number;
}

export interface ScissorsDef {
  x: number;
  y: number;
  /** 咔嚓时剪断半径内的绳段 */
  radius: number;
  /** 每隔几秒咔嚓一次 */
  period: number;
  /** 第一次咔嚓的时刻（不传等于 period） */
  offset?: number;
}

export interface MothDef {
  /** 出生点 */
  x: number;
  y: number;
  /** 几秒后开始出动 */
  delay: number;
  /** 飞行速度 px/s */
  speed: number;
  /** 咬断一段绳需要的秒数 */
  chew: number;
}

export interface LevelDef {
  name: string;
  tip: string;
  candy: { x: number; y: number };
  monster: { x: number; y: number };
  ropes: RopeDef[];
  stars: { x: number; y: number }[];
  hooks?: HookDef[];
  bubbles?: BubbleDef[];
  spikes?: SpikeDef[];
  boards?: BoardDef[];
  portals?: PortalDef[];
  balloons?: BalloonDef[];
  scissors?: ScissorsDef[];
  moths?: MothDef[];
}

export type ChapterTheme = "meadow" | "night" | "factory";

export interface ChapterDef {
  name: string;
  theme: ChapterTheme;
  blurb: string;
}

/** 每章 8 关 */
export const CHAPTER_SIZE = 8;

export const CHAPTERS: ChapterDef[] = [
  { name: "阳光草地", theme: "meadow", blurb: "学会剪绳、荡秋千和各种小机关！" },
  { name: "星星夜空", theme: "night", blurb: "传送门、呼呼气球和自动剪刀登场！" },
  { name: "糖果工厂", theme: "factory", blurb: "小心糖果蛾！全部本领一起用上！" },
];

/** 关卡所属章节序号 */
export function chapterOf(levelIndex: number): number {
  return Math.min(CHAPTERS.length - 1, Math.floor(levelIndex / CHAPTER_SIZE));
}

/** 一关用到的机关种类（测试与选关角标用） */
export function mechanismKinds(lv: LevelDef): string[] {
  const kinds: string[] = [];
  if (lv.ropes.length >= 2) kinds.push("multiRope");
  if ((lv.bubbles ?? []).length > 0) kinds.push("bubble");
  if ((lv.spikes ?? []).length > 0) kinds.push("spike");
  if ((lv.hooks ?? []).length > 0) kinds.push("hook");
  if ((lv.boards ?? []).length > 0) kinds.push("board");
  if ((lv.portals ?? []).length > 0) kinds.push("portal");
  if ((lv.balloons ?? []).length > 0) kinds.push("balloon");
  if ((lv.scissors ?? []).length > 0) kinds.push("scissors");
  if ((lv.moths ?? []).length > 0) kinds.push("moth");
  return kinds;
}

export const LEVELS: LevelDef[] = [
  // ============ 第一章 · 阳光草地 ============
  {
    // 第 1 关：教学 —— 划断绳子，糖果直直落进嘴巴
    name: "直直落",
    tip: "用手指划断绳子，糖果就会掉下去！",
    candy: { x: 180, y: 190 },
    monster: { x: 180, y: 420 },
    ropes: [{ x: 180, y: 52 }],
    stars: [
      { x: 180, y: 252 },
      { x: 180, y: 308 },
      { x: 180, y: 364 },
    ],
  },
  {
    // 第 2 关：教学 —— 等糖果荡到最低点再剪，飞出一道弧线
    name: "荡一荡",
    tip: "糖果在荡秋千，荡到最低点再剪！",
    candy: { x: 62, y: 178 },
    monster: { x: 252, y: 420 },
    ropes: [{ x: 122, y: 56 }],
    stars: [
      { x: 180, y: 242 },
      { x: 206, y: 300 },
      { x: 228, y: 362 },
    ],
  },
  {
    // 第 3 关：双绳 —— 两根都要剪
    name: "双绳结",
    tip: "两根绳子都剪断，糖果才会掉哦！",
    candy: { x: 180, y: 172 },
    monster: { x: 180, y: 428 },
    ropes: [
      { x: 84, y: 54 },
      { x: 276, y: 54 },
    ],
    stars: [
      { x: 180, y: 240 },
      { x: 180, y: 300 },
      { x: 180, y: 362 },
    ],
  },
  {
    // 第 4 关：泡泡电梯 —— 剪断双绳落进泡泡，泡泡带糖果飘到高处的怪物嘴里
    name: "泡泡电梯",
    tip: "糖果碰到泡泡会飘起来！",
    candy: { x: 100, y: 200 },
    monster: { x: 100, y: 120 },
    ropes: [
      { x: 30, y: 56 },
      { x: 170, y: 56 },
    ],
    bubbles: [{ x: 100, y: 340 }],
    stars: [
      { x: 100, y: 268 },
      { x: 100, y: 340 },
      { x: 100, y: 178 },
    ],
  },
  {
    // 第 5 关：小心刺刺 —— 地上有刺，最低点剪出去才能飞进右边缺口
    name: "小心刺刺",
    tip: "别掉到刺上！最低点剪，飞向右边。",
    candy: { x: 60, y: 140 },
    monster: { x: 300, y: 426 },
    ropes: [{ x: 140, y: 50 }],
    spikes: [
      { x: 0, y: 190, w: 24, h: 200, dir: "right" },
      { x: 0, y: 452, w: 230, h: 28, dir: "up" },
    ],
    stars: [
      { x: 235, y: 240 },
      { x: 273, y: 310 },
      { x: 300, y: 380 },
    ],
  },
  {
    // 第 6 关：挂钩接力 —— 剪断后小挂钩接住糖果，再荡一次
    name: "挂钩接力",
    tip: "小挂钩会自动接住飞过来的糖果！",
    candy: { x: 30, y: 110 },
    monster: { x: 280, y: 430 },
    ropes: [{ x: 84, y: 54 }],
    hooks: [{ x: 200, y: 170, radius: 85 }],
    stars: [
      { x: 148, y: 166 },
      { x: 200, y: 228 },
      { x: 258, y: 330 },
    ],
  },
  {
    // 第 7 关：移动木板 —— 木板来回挡路，看准空档
    name: "调皮木板",
    tip: "木板来回跑，等它让开再剪！",
    candy: { x: 180, y: 186 },
    monster: { x: 180, y: 434 },
    ropes: [{ x: 180, y: 50 }],
    boards: [{ x1: 30, y1: 330, x2: 230, y2: 330, w: 100, h: 16, period: 3.2 }],
    spikes: [
      { x: 0, y: 456, w: 116, h: 24, dir: "up" },
      { x: 244, y: 456, w: 116, h: 24, dir: "up" },
    ],
    stars: [
      { x: 180, y: 248 },
      { x: 180, y: 302 },
      { x: 180, y: 396 },
    ],
  },
  {
    // 第 8 关：砰砰泡泡 —— 荡出去飞进泡泡，再点破它落进嘴巴，小心天花板的刺
    name: "砰砰泡泡",
    tip: "点一下泡泡可以把它弄破！小心天上的刺。",
    candy: { x: 18, y: 132 },
    monster: { x: 296, y: 416 },
    ropes: [{ x: 84, y: 52 }],
    bubbles: [{ x: 196, y: 268 }],
    spikes: [{ x: 0, y: 0, w: 360, h: 22, dir: "down" }],
    stars: [
      { x: 166, y: 222 },
      { x: 240, y: 246 },
      { x: 296, y: 330 },
    ],
  },

  // ============ 第二章 · 星星夜空 ============
  {
    // 第 9 关：大冒险 —— 双绳 + 挂钩 + 刺，全部本领用上
    name: "大冒险",
    tip: "先剪左绳荡过去，让挂钩接住，再剪！",
    candy: { x: 128, y: 162 },
    monster: { x: 272, y: 432 },
    ropes: [
      { x: 58, y: 50 },
      { x: 198, y: 50 },
    ],
    hooks: [{ x: 286, y: 176, radius: 64 }],
    spikes: [
      { x: 334, y: 96, w: 26, h: 210, dir: "left" },
      { x: 0, y: 456, w: 150, h: 24, dir: "up" },
    ],
    stars: [
      { x: 243, y: 174 },
      { x: 286, y: 236 },
      { x: 286, y: 330 },
    ],
  },
  {
    // 第 10 关：传送门教学 —— 掉进漩涡，从远处的圆环飞出来
    name: "星空传送门",
    tip: "紫色漩涡会把糖果传送到圆环那边！",
    candy: { x: 80, y: 150 },
    monster: { x: 280, y: 420 },
    ropes: [{ x: 80, y: 52 }],
    portals: [{ ax: 80, ay: 310, bx: 280, by: 150 }],
    spikes: [{ x: 0, y: 456, w: 220, h: 24, dir: "up" }],
    stars: [
      { x: 80, y: 235 },
      { x: 280, y: 230 },
      { x: 280, y: 330 },
    ],
  },
  {
    // 第 11 关：气球教学 —— 点气球呼一阵风，把糖果吹过刺坑
    name: "呼呼气球",
    tip: "剪断绳子后，快点点气球把糖果吹过去！",
    candy: { x: 100, y: 215 },
    monster: { x: 276, y: 428 },
    ropes: [{ x: 100, y: 60 }],
    balloons: [{ x: 100, y: 300, dir: "right", puffs: 2 }],
    spikes: [{ x: 0, y: 456, w: 236, h: 24, dir: "up" }],
    stars: [
      { x: 138, y: 258 },
      { x: 188, y: 310 },
      { x: 238, y: 372 },
    ],
  },
  {
    // 第 12 关：剪刀教学 —— 自动剪刀每隔一会儿咔嚓一下
    name: "咔嚓剪刀",
    tip: "小剪刀会自己咔嚓！等它帮你剪绳子。",
    candy: { x: 180, y: 190 },
    monster: { x: 180, y: 425 },
    ropes: [{ x: 180, y: 50 }],
    scissors: [{ x: 180, y: 115, radius: 26, period: 2.4 }],
    stars: [
      { x: 180, y: 255 },
      { x: 180, y: 320 },
      { x: 180, y: 385 },
    ],
  },
  {
    // 第 13 关：夜泡电梯 —— 双绳 + 泡泡 + 天花板刺（3 种机关）
    name: "夜泡电梯",
    tip: "剪断双绳落进泡泡，小心天上的刺！",
    candy: { x: 180, y: 210 },
    monster: { x: 180, y: 110 },
    ropes: [
      { x: 100, y: 56 },
      { x: 260, y: 56 },
    ],
    bubbles: [{ x: 180, y: 325 }],
    spikes: [
      { x: 0, y: 0, w: 120, h: 22, dir: "down" },
      { x: 240, y: 0, w: 120, h: 22, dir: "down" },
    ],
    stars: [
      { x: 180, y: 245 },
      { x: 180, y: 285 },
      { x: 180, y: 325 },
    ],
  },
  {
    // 第 14 关：穿星之旅 —— 传送门 + 泡泡 + 刺（3 种机关）
    name: "穿星之旅",
    tip: "先传送，再坐泡泡电梯上楼！",
    candy: { x: 60, y: 160 },
    monster: { x: 300, y: 150 },
    ropes: [{ x: 60, y: 50 }],
    portals: [{ ax: 60, ay: 330, bx: 300, by: 330 }],
    bubbles: [{ x: 300, y: 390 }],
    spikes: [
      { x: 0, y: 0, w: 360, h: 22, dir: "down" },
      { x: 0, y: 456, w: 200, h: 24, dir: "up" },
    ],
    stars: [
      { x: 60, y: 245 },
      { x: 300, y: 360 },
      { x: 300, y: 250 },
    ],
  },
  {
    // 第 15 关：星夜钩月 —— 挂钩 + 刺 + 自动剪刀催促（3 种机关）
    name: "星夜钩月",
    tip: "抓紧时间！剪刀 8 秒后就会自己咔嚓。",
    candy: { x: 30, y: 110 },
    monster: { x: 280, y: 430 },
    ropes: [{ x: 84, y: 54 }],
    hooks: [{ x: 200, y: 170, radius: 85 }],
    scissors: [{ x: 84, y: 110, radius: 22, period: 8, offset: 8 }],
    spikes: [{ x: 0, y: 452, w: 200, h: 28, dir: "up" }],
    stars: [
      { x: 148, y: 166 },
      { x: 200, y: 228 },
      { x: 258, y: 330 },
    ],
  },
  {
    // 第 16 关：午夜过山车 —— 传送门 + 剪刀 + 木板 + 刺（4 种机关）
    name: "午夜过山车",
    tip: "看准木板的空档再剪，传送后正好穿过去！",
    candy: { x: 70, y: 170 },
    monster: { x: 290, y: 428 },
    ropes: [{ x: 70, y: 54 }],
    scissors: [{ x: 70, y: 108, radius: 22, period: 4.5, offset: 4.5 }],
    portals: [{ ax: 70, ay: 340, bx: 290, by: 120 }],
    boards: [{ x1: 180, y1: 300, x2: 260, y2: 300, w: 70, h: 14, period: 3 }],
    spikes: [{ x: 0, y: 456, w: 220, h: 24, dir: "up" }],
    stars: [
      { x: 70, y: 250 },
      { x: 290, y: 200 },
      { x: 290, y: 350 },
    ],
  },

  // ============ 第三章 · 糖果工厂 ============
  {
    // 第 17 关：糖果蛾登场 —— 它会飞过来咬绳子，快点行动！
    name: "糖果蛾来了",
    tip: "糖果蛾会咬绳子！趁它没到快剪！",
    candy: { x: 180, y: 185 },
    monster: { x: 180, y: 428 },
    ropes: [
      { x: 100, y: 52 },
      { x: 260, y: 52 },
    ],
    moths: [{ x: 330, y: 80, delay: 2.5, speed: 80, chew: 1 }],
    spikes: [
      { x: 0, y: 456, w: 120, h: 24, dir: "up" },
      { x: 240, y: 456, w: 120, h: 24, dir: "up" },
    ],
    stars: [
      { x: 180, y: 250 },
      { x: 180, y: 315 },
      { x: 180, y: 380 },
    ],
  },
  {
    // 第 18 关：蛾口夺糖 —— 双绳 + 泡泡 + 蛾 + 刺（4 种机关）
    name: "蛾口夺糖",
    tip: "糖果蛾快到了！剪断双绳坐泡泡上楼。",
    candy: { x: 100, y: 200 },
    monster: { x: 100, y: 120 },
    ropes: [
      { x: 30, y: 56 },
      { x: 170, y: 56 },
    ],
    bubbles: [{ x: 100, y: 340 }],
    moths: [{ x: 330, y: 60, delay: 4, speed: 75, chew: 1.2 }],
    spikes: [{ x: 334, y: 100, w: 26, h: 220, dir: "left" }],
    stars: [
      { x: 100, y: 268 },
      { x: 100, y: 340 },
      { x: 100, y: 178 },
    ],
  },
  {
    // 第 19 关：工厂传送带 —— 双层木板 + 刺 + 蛾（3 种机关）
    name: "工厂传送带",
    tip: "两层木板都要让开才能掉下去哦！",
    candy: { x: 180, y: 186 },
    monster: { x: 180, y: 434 },
    ropes: [{ x: 180, y: 50 }],
    boards: [
      { x1: 30, y1: 330, x2: 230, y2: 330, w: 100, h: 16, period: 3.2 },
      { x1: 40, y1: 240, x2: 220, y2: 240, w: 80, h: 14, period: 2.4 },
    ],
    moths: [{ x: 20, y: 70, delay: 6, speed: 85, chew: 1 }],
    spikes: [
      { x: 0, y: 456, w: 116, h: 24, dir: "up" },
      { x: 244, y: 456, w: 116, h: 24, dir: "up" },
    ],
    stars: [
      { x: 180, y: 248 },
      { x: 180, y: 302 },
      { x: 180, y: 396 },
    ],
  },
  {
    // 第 20 关：甜蜜配送 —— 传送门 + 蛾 + 刺 + 气球（4 种机关）
    name: "甜蜜配送",
    tip: "糖果蛾在追！传送门是最快的路。",
    candy: { x: 60, y: 170 },
    monster: { x: 260, y: 425 },
    ropes: [{ x: 60, y: 54 }],
    portals: [{ ax: 60, ay: 330, bx: 260, by: 140 }],
    moths: [{ x: 330, y: 300, delay: 3.5, speed: 75, chew: 1.2 }],
    balloons: [{ x: 180, y: 220, dir: "right", puffs: 2 }],
    spikes: [{ x: 0, y: 456, w: 180, h: 24, dir: "up" }],
    stars: [
      { x: 60, y: 250 },
      { x: 260, y: 240 },
      { x: 260, y: 340 },
    ],
  },
  {
    // 第 21 关：剪刀车间 —— 剪刀 + 木板 + 刺（3 种机关）
    name: "剪刀车间",
    tip: "自己剪时机更好！别全等剪刀。",
    candy: { x: 180, y: 190 },
    monster: { x: 180, y: 430 },
    ropes: [{ x: 180, y: 50 }],
    scissors: [{ x: 180, y: 118, radius: 24, period: 2.2, offset: 2.2 }],
    boards: [{ x1: 40, y1: 310, x2: 220, y2: 310, w: 100, h: 16, period: 2.8 }],
    spikes: [
      { x: 0, y: 456, w: 120, h: 24, dir: "up" },
      { x: 240, y: 456, w: 120, h: 24, dir: "up" },
    ],
    stars: [
      { x: 180, y: 250 },
      { x: 180, y: 352 },
      { x: 180, y: 400 },
    ],
  },
  {
    // 第 22 关：钩子流水线 —— 挂钩 + 蛾 + 刺（3 种机关，镜像挂钩关）
    name: "钩子流水线",
    tip: "荡过去让挂钩接住，糖果蛾马上就来！",
    candy: { x: 330, y: 110 },
    monster: { x: 80, y: 430 },
    ropes: [{ x: 276, y: 54 }],
    hooks: [{ x: 160, y: 170, radius: 85 }],
    moths: [{ x: 20, y: 60, delay: 6, speed: 70, chew: 1.2 }],
    spikes: [{ x: 160, y: 452, w: 200, h: 28, dir: "up" }],
    stars: [
      { x: 212, y: 166 },
      { x: 160, y: 228 },
      { x: 102, y: 330 },
    ],
  },
  {
    // 第 23 关：风暴车间 —— 气球 + 传送门 + 刺 + 剪刀（4 种机关）
    name: "风暴车间",
    tip: "传送出来后马上点气球，把糖果吹进嘴巴！",
    candy: { x: 60, y: 160 },
    monster: { x: 300, y: 430 },
    ropes: [{ x: 60, y: 52 }],
    portals: [{ ax: 60, ay: 210, bx: 140, by: 110 }],
    balloons: [{ x: 140, y: 155, dir: "right", puffs: 2 }],
    scissors: [{ x: 60, y: 100, radius: 20, period: 5, offset: 5 }],
    spikes: [{ x: 0, y: 456, w: 250, h: 24, dir: "up" }],
    stars: [
      { x: 60, y: 195 },
      { x: 200, y: 185 },
      { x: 260, y: 290 },
    ],
  },
  {
    // 第 24 关：超级大糖厂 —— 双绳 + 剪刀 + 传送门 + 挂钩 + 蛾 + 刺（6 种机关）
    name: "超级大糖厂",
    tip: "全部本领用上：剪、传送、挂钩、再剪！",
    candy: { x: 120, y: 180 },
    monster: { x: 300, y: 428 },
    ropes: [
      { x: 60, y: 54 },
      { x: 180, y: 54 },
    ],
    scissors: [{ x: 66, y: 84, radius: 20, period: 2, offset: 2 }],
    portals: [{ ax: 120, ay: 340, bx: 300, by: 120 }],
    hooks: [{ x: 300, y: 260, radius: 70 }],
    moths: [{ x: 20, y: 300, delay: 9, speed: 80, chew: 1.2 }],
    spikes: [
      { x: 0, y: 0, w: 240, h: 20, dir: "down" },
      { x: 0, y: 456, w: 240, h: 24, dir: "up" },
    ],
    stars: [
      { x: 120, y: 260 },
      { x: 300, y: 200 },
      { x: 300, y: 390 },
    ],
  },
];

/** 全部关卡的星星总数（评级用）。 */
export function totalStars(): number {
  return LEVELS.reduce((sum, lv) => sum + lv.stars.length, 0);
}
