// 糖果秋千关卡数据。画布坐标系 360 x 480，共 99 关、6 大主题章节。
// 24 个"基础关"全部手工调校，其余关卡用镜像变换(物理完全对称)与
// 机关参数变体扩展而成。每一关都带一份 solve「通关配方」，
// physics.test.ts 会按配方逐帧仿真，保证 99 关全部真实可通关。

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

/**
 * 通关配方：测试用它逐帧仿真验证每一关都能赢。
 * dir 为 1 表示往右、-1 表示往左；镜像变换会自动翻转。
 */
export type SolveRecipe =
  | { kind: "wait"; time?: number }
  | { kind: "cut"; t?: number; time?: number }
  | { kind: "low"; dir: 1 | -1; time?: number }
  | { kind: "lowPop"; dir: 1 | -1; popX: number; time?: number }
  | { kind: "hookRelay"; dir: 1 | -1; dir2?: 1 | -1; time?: number }
  | { kind: "ropeRelay"; rope: number; dir: 1 | -1; dir2?: 1 | -1; time?: number }
  | { kind: "cutPuff"; t?: number; puffAt?: number; afterTeleport?: boolean; time?: number }
  | { kind: "search"; tMax: number }
  | { kind: "relaySettle"; t?: number; settle?: number; time?: number };

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
  /** 通关配方（测试仿真用） */
  solve: SolveRecipe;
}

export type ChapterTheme = "meadow" | "night" | "factory" | "sky" | "ice" | "rainbow";

export interface ChapterDef {
  name: string;
  theme: ChapterTheme;
  blurb: string;
}

export const CHAPTERS: ChapterDef[] = [
  { name: "阳光草地", theme: "meadow", blurb: "学会剪绳、荡秋千和各种小机关！" },
  { name: "星星夜空", theme: "night", blurb: "传送门、呼呼气球和自动剪刀登场！" },
  { name: "糖果工厂", theme: "factory", blurb: "小心糖果蛾！全部本领一起用上！" },
  { name: "云朵乐园", theme: "sky", blurb: "泡泡、气球和挂钩的空中乐园！" },
  { name: "冰雪王国", theme: "ice", blurb: "冰柱、冰门和滑溜溜的木板！" },
  { name: "彩虹嘉年华", theme: "rainbow", blurb: "最难的组合关都在这里，冲鸭！" },
];

/** 每章关卡数（共 99） */
export const CHAPTER_SIZES = [17, 17, 17, 16, 16, 16];

/** 关卡所属章节序号 */
export function chapterOf(levelIndex: number): number {
  let acc = 0;
  for (let c = 0; c < CHAPTER_SIZES.length; c++) {
    acc += CHAPTER_SIZES[c];
    if (levelIndex < acc) return c;
  }
  return CHAPTER_SIZES.length - 1;
}

/** 章节 c 的第一关下标 */
export function chapterStart(c: number): number {
  let acc = 0;
  for (let i = 0; i < c; i++) acc += CHAPTER_SIZES[i];
  return acc;
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

/* ================= 镜像变换与变体工具 ================= */

const CANVAS_W = 360;

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function flipDir(d: "up" | "down" | "left" | "right"): "up" | "down" | "left" | "right" {
  return d === "left" ? "right" : d === "right" ? "left" : d;
}

function mirrorSolve(s: SolveRecipe): SolveRecipe {
  const r = clone(s);
  if ("dir" in r) r.dir = (r.dir * -1) as 1 | -1;
  if ("dir2" in r && r.dir2 !== undefined) r.dir2 = (r.dir2 * -1) as 1 | -1;
  if (r.kind === "lowPop") r.popX = CANVAS_W - r.popX;
  return r;
}

/** 左右镜像：物理完全对称，可解性不变 */
function mirrorLevel(lv: LevelDef): LevelDef {
  const m = clone(lv);
  m.candy = { x: CANVAS_W - lv.candy.x, y: lv.candy.y };
  m.monster = { x: CANVAS_W - lv.monster.x, y: lv.monster.y };
  m.ropes = lv.ropes.map((r) => ({ ...r, x: CANVAS_W - r.x }));
  m.stars = lv.stars.map((s) => ({ x: CANVAS_W - s.x, y: s.y }));
  if (lv.hooks) m.hooks = lv.hooks.map((h) => ({ ...h, x: CANVAS_W - h.x }));
  if (lv.bubbles) m.bubbles = lv.bubbles.map((b) => ({ x: CANVAS_W - b.x, y: b.y }));
  if (lv.spikes) {
    m.spikes = lv.spikes.map((s) => ({ ...s, x: CANVAS_W - s.x - s.w, dir: flipDir(s.dir) }));
  }
  if (lv.boards) {
    m.boards = lv.boards.map((b) => ({ ...b, x1: CANVAS_W - b.x1 - b.w, x2: CANVAS_W - b.x2 - b.w }));
  }
  if (lv.portals) {
    m.portals = lv.portals.map((p) => ({ ax: CANVAS_W - p.ax, ay: p.ay, bx: CANVAS_W - p.bx, by: p.by }));
  }
  if (lv.balloons) m.balloons = lv.balloons.map((b) => ({ ...b, x: CANVAS_W - b.x, dir: flipDir(b.dir) }));
  if (lv.scissors) m.scissors = lv.scissors.map((s) => ({ ...s, x: CANVAS_W - s.x }));
  if (lv.moths) m.moths = lv.moths.map((mo) => ({ ...mo, x: CANVAS_W - mo.x }));
  m.solve = mirrorSolve(lv.solve);
  return m;
}

/** 变体：换名字/提示，可覆盖任意字段 */
function V(base: LevelDef, name: string, tip: string, over: Partial<LevelDef> = {}): LevelDef {
  return { ...clone(base), ...over, name, tip };
}

/** 镜像变体 */
function MV(base: LevelDef, name: string, tip: string, over: Partial<LevelDef> = {}): LevelDef {
  return { ...mirrorLevel(base), ...over, name, tip };
}

/* ================= 24 个基础关（全部手工调校） ================= */

const B01: LevelDef = {
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
  solve: { kind: "cut", t: 0.5 },
};

const B02: LevelDef = {
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
  solve: { kind: "low", dir: 1 },
};

const B03: LevelDef = {
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
  solve: { kind: "cut", t: 0.5 },
};

const B04: LevelDef = {
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
  solve: { kind: "cut", t: 0.5, time: 10 },
};

const B05: LevelDef = {
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
  solve: { kind: "low", dir: 1 },
};

const B06: LevelDef = {
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
  solve: { kind: "hookRelay", dir: 1 },
};

const B07: LevelDef = {
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
  solve: { kind: "search", tMax: 3.2 },
};

const B08: LevelDef = {
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
  solve: { kind: "lowPop", dir: 1, popX: 240, time: 12 },
};

const B09: LevelDef = {
  name: "大冒险",
  tip: "先剪短的那根绳，荡过去让挂钩接住，再剪！",
  candy: { x: 30, y: 110 },
  monster: { x: 280, y: 430 },
  ropes: [
    { x: 84, y: 54 },
    { x: 150, y: 40 },
  ],
  hooks: [{ x: 200, y: 170, radius: 85 }],
  spikes: [
    { x: 334, y: 96, w: 26, h: 210, dir: "left" },
    { x: 0, y: 456, w: 150, h: 24, dir: "up" },
  ],
  stars: [
    { x: 148, y: 166 },
    { x: 200, y: 228 },
    { x: 258, y: 330 },
  ],
  solve: { kind: "ropeRelay", rope: 1, dir: 1, time: 16 },
};

const B10: LevelDef = {
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
  solve: { kind: "cut", t: 0.3 },
};

const B11: LevelDef = {
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
  solve: { kind: "cutPuff", t: 0.1, puffAt: 0.16 },
};

const B12: LevelDef = {
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
  solve: { kind: "wait", time: 8 },
};

const B13: LevelDef = {
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
  solve: { kind: "cut", t: 0.5, time: 10 },
};

const B14: LevelDef = {
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
  solve: { kind: "cut", t: 0.3, time: 12 },
};

const B15: LevelDef = {
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
  solve: { kind: "hookRelay", dir: 1 },
};

const B16: LevelDef = {
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
  solve: { kind: "search", tMax: 3 },
};

const B17: LevelDef = {
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
  solve: { kind: "cut", t: 0.4 },
};

const B18: LevelDef = {
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
  solve: { kind: "cut", t: 0.5, time: 10 },
};

const B19: LevelDef = {
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
  solve: { kind: "search", tMax: 6.4 },
};

const B20: LevelDef = {
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
  solve: { kind: "cut", t: 0.3 },
};

const B21: LevelDef = {
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
  solve: { kind: "search", tMax: 2.1 },
};

const B22: LevelDef = {
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
  solve: { kind: "hookRelay", dir: -1 },
};

const B23: LevelDef = {
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
  solve: { kind: "cutPuff", t: 0.3, afterTeleport: true, time: 10 },
};

const B24: LevelDef = {
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
  solve: { kind: "relaySettle", t: 0.5, settle: 1.5, time: 16 },
};

/* ================= 新基础关（新章节专属） ================= */

const N1: LevelDef = {
  name: "双泡云梯",
  tip: "剪断双绳落进泡泡，一路飘到云上的啾啾！",
  candy: { x: 180, y: 170 },
  monster: { x: 180, y: 88 },
  ropes: [
    { x: 120, y: 50 },
    { x: 240, y: 50 },
  ],
  bubbles: [{ x: 180, y: 320 }],
  stars: [
    { x: 180, y: 230 },
    { x: 180, y: 300 },
    { x: 180, y: 130 },
  ],
  solve: { kind: "cut", t: 0.5, time: 10 },
};

const N2: LevelDef = {
  name: "山谷来风",
  tip: "剪断绳子，赶紧点气球把糖果吹过山谷！",
  candy: { x: 80, y: 190 },
  monster: { x: 300, y: 430 },
  ropes: [{ x: 80, y: 64 }],
  balloons: [{ x: 80, y: 290, dir: "right", puffs: 2 }],
  spikes: [{ x: 0, y: 456, w: 200, h: 24, dir: "up" }],
  stars: [
    { x: 144, y: 220 },
    { x: 208, y: 272 },
    { x: 268, y: 360 },
  ],
  solve: { kind: "cutPuff", t: 0.1, puffAt: 0.16 },
};

const N3: LevelDef = {
  name: "冰柱直落",
  tip: "两边都是冰柱！走中间直直落下去。",
  candy: { x: 180, y: 160 },
  monster: { x: 180, y: 430 },
  ropes: [{ x: 180, y: 50 }],
  spikes: [
    { x: 0, y: 140, w: 26, h: 220, dir: "right" },
    { x: 334, y: 140, w: 26, h: 220, dir: "left" },
  ],
  stars: [
    { x: 180, y: 240 },
    { x: 180, y: 310 },
    { x: 180, y: 380 },
  ],
  solve: { kind: "cut", t: 0.5 },
};

const N4: LevelDef = {
  name: "冰洞传送",
  tip: "冰洞会把糖果送到对岸的圆环！",
  candy: { x: 90, y: 170 },
  monster: { x: 270, y: 430 },
  ropes: [{ x: 90, y: 56 }],
  portals: [{ ax: 90, ay: 330, bx: 270, by: 140 }],
  spikes: [{ x: 0, y: 456, w: 180, h: 24, dir: "up" }],
  stars: [
    { x: 90, y: 250 },
    { x: 270, y: 220 },
    { x: 270, y: 330 },
  ],
  solve: { kind: "cut", t: 0.3 },
};

const N5: LevelDef = {
  name: "彩虹三重奏",
  tip: "剪刀、冰洞、刺坑！等剪刀咔嚓就出发。",
  candy: { x: 180, y: 190 },
  monster: { x: 300, y: 428 },
  ropes: [{ x: 180, y: 50 }],
  scissors: [{ x: 180, y: 118, radius: 24, period: 2.2 }],
  portals: [{ ax: 180, ay: 330, bx: 300, by: 150 }],
  spikes: [{ x: 0, y: 456, w: 240, h: 24, dir: "up" }],
  stars: [
    { x: 180, y: 260 },
    { x: 300, y: 230 },
    { x: 300, y: 340 },
  ],
  solve: { kind: "wait", time: 10 },
};

/* ================= 六大章节 · 99 关 ================= */

// ---- 第一章 · 阳光草地（17 关）----
const C1: LevelDef[] = [
  B01,
  B02,
  B03,
  B04,
  B05,
  B06,
  B07,
  B08,
  MV(B02, "反着荡", "换个方向荡秋千，低点再剪！"),
  V(B01, "云梯直落", "绳子更长啦，一样直直落！", {
    candy: { x: 180, y: 150 },
    stars: [{ x: 180, y: 220 }, { x: 180, y: 290 }, { x: 180, y: 360 }],
  }),
  MV(B05, "换边刺刺", "这次刺在右边，往左飞！"),
  MV(B06, "左钩接力", "挂钩在左边等着接糖果！"),
  MV(B04, "右舷泡泡", "右边的泡泡也会飘！"),
  MV(B07, "木板反着跑", "木板从另一头出发，重新看空档！"),
  MV(B08, "左砰砰", "泡泡在左边，飞进去再点破它！"),
  V(B07, "慢吞吞木板", "木板变慢了，空档更好等！", {
    boards: [{ x1: 30, y1: 330, x2: 230, y2: 330, w: 100, h: 16, period: 4 }],
    solve: { kind: "search", tMax: 4 },
  }),
  V(B03, "高高双绳", "从更高的地方剪断双绳！", {
    candy: { x: 180, y: 150 },
    stars: [{ x: 180, y: 220 }, { x: 180, y: 290 }, { x: 180, y: 360 }],
  }),
];

// ---- 第二章 · 星星夜空（17 关）----
const C2: LevelDef[] = [
  B09,
  B10,
  B11,
  B12,
  B13,
  B14,
  B15,
  B16,
  MV(B10, "换边星门", "漩涡搬到右边了，剪断就出发！"),
  MV(B11, "西风气球", "这次风往左吹，注意方向！"),
  V(B12, "慢吞吞剪刀", "剪刀更慢了，耐心等一等！", {
    scissors: [{ x: 180, y: 115, radius: 26, period: 3.4 }],
  }),
  MV(B14, "逆行穿星", "反方向的传送之旅！"),
  MV(B15, "左钩弯月", "挂钩和月亮都换了边！"),
  MV(B16, "反向过山车", "过山车倒着开，重新找空档！"),
  MV(B09, "换边大冒险", "先剪右绳荡过去，让左边挂钩接住！"),
  V(B10, "双子星门", "圆环挪了位置，还是一样穿过去！", {
    portals: [{ ax: 80, ay: 310, bx: 280, by: 190 }],
    stars: [{ x: 80, y: 240 }, { x: 280, y: 260 }, { x: 280, y: 360 }],
  }),
  V(B13, "深夜电梯", "泡泡沉得更低，胆子要更大！", {
    bubbles: [{ x: 180, y: 355 }],
    stars: [{ x: 180, y: 250 }, { x: 180, y: 300 }, { x: 180, y: 355 }],
  }),
];

// ---- 第三章 · 糖果工厂（17 关）----
const C3: LevelDef[] = [
  B17,
  B18,
  B19,
  B20,
  B21,
  B22,
  B23,
  B24,
  MV(B17, "蛾从西来", "糖果蛾从左边来啦，一样要快！"),
  MV(B18, "换边夺糖", "刺墙在左边，泡泡电梯照常开！"),
  MV(B19, "反向传送带", "两层木板倒着跑，重新掐时间！"),
  MV(B20, "左线配送", "传送门装到了右边，路线反过来！"),
  MV(B21, "镜像车间", "木板从右边出发，看好再剪！"),
  MV(B22, "右手流水线", "从左往右荡，右边挂钩来接！"),
  MV(B23, "逆风车间", "风从右往左吹，传送后快点气球！"),
  MV(B24, "镜像大糖厂", "全套本领反着来一遍！"),
  V(B17, "急脾气蛾子", "这只蛾子飞得更快，手要更快！", {
    moths: [{ x: 330, y: 80, delay: 2, speed: 95, chew: 0.8 }],
  }),
];

// ---- 第四章 · 云朵乐园（16 关）----
const C4: LevelDef[] = [
  N1,
  V(B04, "云端电梯", "泡泡沉在更低的云里！", {
    bubbles: [{ x: 100, y: 360 }],
    stars: [{ x: 100, y: 270 }, { x: 100, y: 360 }, { x: 100, y: 170 }],
    solve: { kind: "cut", t: 0.5, time: 12 },
  }),
  N2,
  MV(N2, "西谷来风", "风从右边吹向左边的山谷！"),
  V(B11, "三口仙气", "气球能吹三口气，省着点用！", {
    balloons: [{ x: 100, y: 300, dir: "right", puffs: 3 }],
  }),
  MV(
    V(B11, "", "", { balloons: [{ x: 100, y: 300, dir: "right", puffs: 3 }] }),
    "西风仙气",
    "三口西风，把糖果吹回左边！"
  ),
  V(B06, "云钩大圈", "这个云朵挂钩的圈圈特别大！", {
    hooks: [{ x: 200, y: 170, radius: 95 }],
  }),
  MV(
    V(B06, "", "", { hooks: [{ x: 200, y: 170, radius: 95 }] }),
    "大圈换边",
    "大圈圈挂钩搬到了左边！"
  ),
  V(B08, "云里砰砰", "云朵里的泡泡，接住糖果再点破！", {
    stars: [{ x: 160, y: 210 }, { x: 250, y: 230 }, { x: 300, y: 340 }],
  }),
  V(B02, "荡上云霄", "秋千吊得更短，荡起来更快！", {
    ropes: [{ x: 122, y: 70 }],
    stars: [{ x: 178, y: 250 }, { x: 204, y: 306 }, { x: 226, y: 366 }],
  }),
  MV(
    V(B02, "", "", {
      ropes: [{ x: 122, y: 70 }],
      stars: [{ x: 178, y: 250 }, { x: 204, y: 306 }, { x: 226, y: 366 }],
    }),
    "云霄换边",
    "短秋千反着荡，一样要看低点！"
  ),
  V(B14, "云中穿行", "云朵版的传送加泡泡二连跳！", {
    stars: [{ x: 60, y: 260 }, { x: 300, y: 370 }, { x: 300, y: 235 }],
  }),
  V(B13, "白日电梯", "白天的泡泡电梯，云朵软软的！", {
    bubbles: [{ x: 180, y: 340 }],
    stars: [{ x: 180, y: 255 }, { x: 180, y: 295 }, { x: 180, y: 340 }],
  }),
  MV(
    V(B10, "", "", {
      portals: [{ ax: 80, ay: 310, bx: 280, by: 190 }],
      stars: [{ x: 80, y: 240 }, { x: 280, y: 260 }, { x: 280, y: 360 }],
    }),
    "云门跳跃",
    "云朵漩涡在右边，圆环在左边！"
  ),
  V(N1, "星雨云梯", "泡泡换了云层，星星下了一场雨！", {
    bubbles: [{ x: 180, y: 330 }],
    stars: [{ x: 150, y: 240 }, { x: 210, y: 280 }, { x: 180, y: 120 }],
  }),
  V(B18, "云上夺糖", "云朵里也有糖果蛾，好在它飞得慢！", {
    moths: [{ x: 330, y: 60, delay: 7, speed: 70, chew: 1.4 }],
  }),
];

// ---- 第五章 · 冰雪王国（16 关）----
const C5: LevelDef[] = [
  N3,
  N4,
  MV(N4, "换边冰洞", "冰洞搬到了右边，圆环在左边！"),
  V(B07, "冰面滑板", "冰上的木板滑得飞快！", {
    boards: [{ x1: 30, y1: 330, x2: 230, y2: 330, w: 100, h: 16, period: 2.6 }],
    solve: { kind: "search", tMax: 2.6 },
  }),
  MV(
    V(B07, "", "", {
      boards: [{ x1: 30, y1: 330, x2: 230, y2: 330, w: 100, h: 16, period: 2.6 }],
      solve: { kind: "search", tMax: 2.6 },
    }),
    "滑板反向",
    "冰滑板倒着滑，重新看空档！"
  ),
  V(B12, "咔嚓冰剪", "冰剪刀咔嚓得特别勤快！", {
    scissors: [{ x: 180, y: 115, radius: 26, period: 2 }],
  }),
  V(B16, "冰夜过山车", "冰剪刀来得晚，自己动手更快！", {
    scissors: [{ x: 70, y: 108, radius: 22, period: 6, offset: 6 }],
  }),
  MV(
    V(B16, "", "", { scissors: [{ x: 70, y: 108, radius: 22, period: 6, offset: 6 }] }),
    "冰车反向",
    "反方向的冰上过山车！"
  ),
  V(B19, "冰雪传送带", "冰上的双层木板慢悠悠！", {
    boards: [
      { x1: 30, y1: 330, x2: 230, y2: 330, w: 100, h: 16, period: 3.6 },
      { x1: 40, y1: 240, x2: 220, y2: 240, w: 80, h: 14, period: 2.8 },
    ],
    solve: { kind: "search", tMax: 7.2 },
  }),
  V(B21, "冰工坊", "冰剪刀更慢，木板照常跑！", {
    scissors: [{ x: 180, y: 118, radius: 24, period: 2.6, offset: 2.6 }],
    solve: { kind: "search", tMax: 2.5 },
  }),
  MV(
    V(B21, "", "", {
      scissors: [{ x: 180, y: 118, radius: 24, period: 2.6, offset: 2.6 }],
      solve: { kind: "search", tMax: 2.5 },
    }),
    "镜像冰坊",
    "冰工坊照镜子，一样找空档！"
  ),
  V(B15, "冰钩残月", "冰剪刀十秒才咔嚓，从容一点！", {
    scissors: [{ x: 84, y: 110, radius: 22, period: 10, offset: 10 }],
  }),
  MV(
    V(B15, "", "", { scissors: [{ x: 84, y: 110, radius: 22, period: 10, offset: 10 }] }),
    "残月换边",
    "左边的冰钩也能接住糖果！"
  ),
  V(B10, "冰门瞬移", "冰门的圆环挂得更高！", {
    portals: [{ ax: 80, ay: 310, bx: 280, by: 170 }],
    stars: [{ x: 80, y: 240 }, { x: 280, y: 250 }, { x: 280, y: 350 }],
  }),
  V(B13, "冰泡电梯", "冰泡泡浮力十足，小心天花板冰锥！", {
    bubbles: [{ x: 180, y: 310 }],
    stars: [{ x: 180, y: 240 }, { x: 180, y: 275 }, { x: 180, y: 310 }],
  }),
  V(N3, "冰柱森林", "冰柱更长啦，还是走中间！", {
    candy: { x: 180, y: 140 },
    stars: [{ x: 180, y: 220 }, { x: 180, y: 300 }, { x: 180, y: 380 }],
  }),
];

// ---- 第六章 · 彩虹嘉年华（16 关，全部组合关）----
const C6: LevelDef[] = [
  V(B09, "彩虹大冒险", "双绳、挂钩、刺墙，一口气连起来！", {
    stars: [{ x: 150, y: 180 }, { x: 206, y: 240 }, { x: 262, y: 340 }],
  }),
  V(B15, "彩虹钩月", "剪刀在倒数，挂钩接力要快！", {
    stars: [{ x: 150, y: 172 }, { x: 200, y: 240 }, { x: 250, y: 336 }],
  }),
  V(B16, "彩虹过山车", "木板跑得更快，看准了再剪！", {
    boards: [{ x1: 180, y1: 300, x2: 260, y2: 300, w: 70, h: 14, period: 2.6 }],
    solve: { kind: "search", tMax: 2.6 },
  }),
  MV(
    V(B16, "", "", {
      boards: [{ x1: 180, y1: 300, x2: 260, y2: 300, w: 70, h: 14, period: 2.6 }],
      solve: { kind: "search", tMax: 2.6 },
    }),
    "终极过山车",
    "最快的过山车倒着开！"
  ),
  V(B18, "彩虹夺糖", "这只蛾子加速啦，剪绳别犹豫！", {
    moths: [{ x: 330, y: 60, delay: 3.5, speed: 85, chew: 1 }],
  }),
  V(B19, "彩虹传送带", "双层木板全速运转！", {
    boards: [
      { x1: 30, y1: 330, x2: 230, y2: 330, w: 100, h: 16, period: 3 },
      { x1: 40, y1: 240, x2: 220, y2: 240, w: 80, h: 14, period: 2.2 },
    ],
    solve: { kind: "search", tMax: 6 },
  }),
  V(B20, "彩虹配送", "糖果蛾提前出发，传送要更快！", {
    moths: [{ x: 330, y: 300, delay: 3, speed: 75, chew: 1.2 }],
  }),
  MV(
    V(B20, "", "", { moths: [{ x: 330, y: 300, delay: 3, speed: 75, chew: 1.2 }] }),
    "反向配送",
    "反方向的加急配送！"
  ),
  V(B22, "彩虹流水线", "蛾子来得早，接力要一气呵成！", {
    moths: [{ x: 20, y: 60, delay: 5, speed: 70, chew: 1.2 }],
  }),
  V(B23, "彩虹风暴", "气球有三口风，吹出一道彩虹！", {
    balloons: [{ x: 140, y: 155, dir: "right", puffs: 3 }],
  }),
  MV(
    V(B23, "", "", { balloons: [{ x: 140, y: 155, dir: "right", puffs: 3 }] }),
    "逆向风暴",
    "三口风向左吹，路线全反过来！"
  ),
  N5,
  MV(N5, "换边三重奏", "三重奏换个方向再来一遍！"),
  V(B24, "嘉年华彩排", "大糖厂全流程彩排，蛾子睡懒觉！", {
    moths: [{ x: 20, y: 300, delay: 12, speed: 80, chew: 1.2 }],
    stars: [{ x: 120, y: 250 }, { x: 300, y: 210 }, { x: 300, y: 380 }],
  }),
  MV(
    V(B24, "", "", {
      moths: [{ x: 20, y: 300, delay: 12, speed: 80, chew: 1.2 }],
      stars: [{ x: 120, y: 250 }, { x: 300, y: 210 }, { x: 300, y: 380 }],
    }),
    "镜像彩排",
    "镜子里的大糖厂，全套再来！"
  ),
  MV(B24, "终极大巡游", "七种机关同台！打完就是糖果大师！", {
    balloons: [{ x: 300, y: 220, dir: "left", puffs: 2 }],
  }),
];

export const LEVELS: LevelDef[] = [...C1, ...C2, ...C3, ...C4, ...C5, ...C6];

/** 全部关卡的星星总数（评级用）。 */
export function totalStars(): number {
  return LEVELS.reduce((sum, lv) => sum + lv.stars.length, 0);
}
