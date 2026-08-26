// 糖果秋千关卡数据。画布坐标系 360 x 480，共 99 关、6 大主题章节。
// 24 个"基础关"全部手工调校，其余关卡用镜像变换(物理完全对称)与
// 机关参数变体扩展而成。每一关都带一份 solve「通关配方」，
// physics.test.ts 会按配方逐帧仿真，保证 99 关全部真实可通关。

/** 1.1 新增：发条绳的伸缩参数（绳长在 min..max 倍之间来回） */
export interface WinchDef {
  /** 最短倍率（t = offset 时收到这么短） */
  min: number;
  /** 最长倍率 */
  max: number;
  /** 一收一放的秒数 */
  period: number;
  /** 相位偏移，不传按 0 */
  offset?: number;
}

export interface RopeDef {
  /** 锚点位置 */
  x: number;
  y: number;
  /** 绳段数（不传按长度自动算） */
  segments?: number;
  /** 绳总长（不传用锚点到糖果的距离） */
  length?: number;
  /** 1.1 新增：挂上发条，绳子自己一收一放 */
  winch?: WinchDef;
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
  /**
   * 1.2 新增：粘性泡泡。挂住糖果这么多秒后自己松手，
   * 松手时把挂住之前的速度按 STICKY_KEEP 还回去（见 swing12.ts）。
   * 不填就是 1.1 的普通泡泡（接住后一直慢慢上浮）。
   */
  sticky?: number;
}

/** 1.2 新增：弹簧蘑菇。糖果压上伞面就沿 dir 弹开，有增益也有封顶。 */
export interface MushroomDef {
  x: number;
  y: number;
  dir: "up" | "down" | "left" | "right";
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

/** 1.1 新增：风扇气流。矩形风道里沿 dir 推糖果，越远越弱。 */
export interface FanDef {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 吹风方向 */
  dir: "up" | "down" | "left" | "right";
  /** 风力（加速度 px/s²，重力是 900） */
  power: number;
  /** 一开一关的秒数，不传就是常开 */
  period?: number;
  /** 每个周期里吹风的时间占比，不传按 0.5 */
  duty?: number;
  /** 相位偏移 */
  offset?: number;
}

/** 1.1 新增：糖霜磁铁。半径内吸住（strength > 0）或推开（< 0）糖果。 */
export interface MagnetDef {
  x: number;
  y: number;
  radius: number;
  /** 吸力（加速度 px/s²），负数是推力 */
  strength: number;
}

/** 1.1 新增：捣蛋鬼「咕噜噜」。在两点间来回巡逻，碰到糖果就抢走。 */
export interface GremlinDef {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** 一个来回的秒数 */
  period: number;
  /** 张嘴半径：糖果进来就被抢走 */
  radius: number;
  /** 相位偏移秒数 */
  offset?: number;
  /** 前几秒还在打盹，不抓糖 */
  delay?: number;
}

/** 1.2 新增机关①：黏黏泡。糖果撞进来被黏住 hold 秒，到点自己放开（一次性）。 */
export interface StickyDef {
  x: number;
  y: number;
  /** 黏住判定半径 */
  radius: number;
  /** 黏住几秒 */
  hold: number;
}

/** 1.2 新增机关②：弹簧蘑菇。踩到就朝 dir 方向弹走，换个方向继续飞。 */
export interface SpringDef {
  x: number;
  y: number;
  /** 蘑菇伞盖半径（碰撞判定用） */
  radius: number;
  /** 弹出方向 */
  dir: "up" | "down" | "left" | "right";
  /** 法向速度放大倍数 */
  bounce: number;
  /** 保底弹出速度 px/s：轻轻蹭一下也弹得动 */
  minOut: number;
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
  | { kind: "relaySettle"; t?: number; settle?: number; time?: number }
  /**
   * 1.1 新增：脚本化时间线。按秒数依次做动作，
   * 够用来描述「先剪、落到台阶上、再点气球」这类多段操作。
   */
  | { kind: "timeline"; acts: TimelineAct[]; time?: number };

/** 时间线里的一个动作：at 秒时做 do（cutRope / puff 用 i 指定第几根绳、第几个气球） */
export interface TimelineAct {
  at: number;
  do: "cut" | "cutRope" | "pop" | "puff";
  i?: number;
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
  /** 1.1 新增机关 */
  fans?: FanDef[];
  magnets?: MagnetDef[];
  gremlins?: GremlinDef[];
  /** 1.2 新增机关 */
  mushrooms?: MushroomDef[];
  stickies?: StickyDef[];
  springs?: SpringDef[];
  /**
   * 1.2 无尽「甜甜塔」用：本层必须在这么多秒内把糖果送进嘴里。
   * 闯关模式不填（不限时）。
   */
  timeLimit?: number;
  /** 通关配方（测试仿真用） */
  solve: SolveRecipe;
}

export type ChapterTheme =
  | "meadow"
  | "night"
  | "factory"
  | "sky"
  | "ice"
  | "rainbow"
  | "clock"
  | "isle"
  | "starfac"
  | "moonfair";

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
  { name: "发条钟楼", theme: "clock", blurb: "绳子挂上发条自己伸缩，还要借钟楼台阶接力！" },
  { name: "泡泡浮岛", theme: "isle", blurb: "风扇气流托着糖果走，顺风逆风都要算准！" },
  { name: "星糖工厂", theme: "starfac", blurb: "糖霜磁铁又吸又推，捣蛋鬼咕噜噜到处抢糖！" },
  { name: "月光大巡游", theme: "moonfair", blurb: "十种机关同台压轴，糖果大师的毕业考！" },
];

/** 1.0 的前 99 关切分，做回归用，永远不许改 */
export const LEGACY_CHAPTER_SIZES = [17, 17, 17, 16, 16, 16];

/** 每章关卡数（前 6 章 99 关原样保留，1.1 追加 4 章 89 关，共 188） */
export const CHAPTER_SIZES = [...LEGACY_CHAPTER_SIZES, 23, 22, 22, 22];

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

/** 静止不动的木板就是「高台」，可以站上去接力再荡一段 */
export function isLedge(b: BoardDef): boolean {
  return b.x1 === b.x2 && b.y1 === b.y2;
}

/** 一关用到的机关种类（测试与选关角标用） */
export function mechanismKinds(lv: LevelDef): string[] {
  const kinds: string[] = [];
  const boards = lv.boards ?? [];
  if (lv.ropes.length >= 2) kinds.push("multiRope");
  if ((lv.bubbles ?? []).length > 0) kinds.push("bubble");
  if ((lv.spikes ?? []).length > 0) kinds.push("spike");
  if ((lv.hooks ?? []).length > 0) kinds.push("hook");
  if (boards.some((b) => !isLedge(b))) kinds.push("board");
  if ((lv.portals ?? []).length > 0) kinds.push("portal");
  if ((lv.balloons ?? []).length > 0) kinds.push("balloon");
  if ((lv.scissors ?? []).length > 0) kinds.push("scissors");
  if ((lv.moths ?? []).length > 0) kinds.push("moth");
  // ---- 1.1 新机关 ----
  if (lv.ropes.some((r) => r.winch)) kinds.push("winch");
  if (boards.some(isLedge)) kinds.push("ledge");
  if ((lv.fans ?? []).length > 0) kinds.push("fan");
  if ((lv.magnets ?? []).length > 0) kinds.push("magnet");
  if ((lv.gremlins ?? []).length > 0) kinds.push("gremlin");
  // ---- 1.2 新机关 ----
  if ((lv.stickies ?? []).length > 0) kinds.push("sticky");
  if ((lv.springs ?? []).length > 0) kinds.push("spring");
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
  if (lv.fans) {
    m.fans = lv.fans.map((f) => ({ ...f, x: CANVAS_W - f.x - f.w, dir: flipDir(f.dir) }));
  }
  if (lv.magnets) m.magnets = lv.magnets.map((mg) => ({ ...mg, x: CANVAS_W - mg.x }));
  if (lv.gremlins) {
    m.gremlins = lv.gremlins.map((g) => ({
      ...g,
      x1: CANVAS_W - g.x1,
      x2: CANVAS_W - g.x2,
    }));
  }
  if (lv.stickies) m.stickies = lv.stickies.map((s) => ({ ...s, x: CANVAS_W - s.x }));
  if (lv.springs) {
    m.springs = lv.springs.map((s) => ({ ...s, x: CANVAS_W - s.x, dir: flipDir(s.dir) }));
  }
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

/* ================= 1.1 新增基础关（第七～第十章专属） ================= */

// ---- 发条钟楼：绳子挂发条自己伸缩 + 钟楼台阶接力 ----

const K1: LevelDef = {
  name: "发条落锤",
  tip: "绳子挂了发条，会自己一收一放，放长了再剪！",
  candy: { x: 180, y: 168 },
  monster: { x: 180, y: 432 },
  ropes: [{ x: 180, y: 44, winch: { min: 0.85, max: 1.5, period: 3.2 } }],
  stars: [
    { x: 180, y: 252 },
    { x: 180, y: 318 },
    { x: 180, y: 386 },
  ],
  solve: { kind: "cut", t: 0.6 },
};

const K2: LevelDef = {
  name: "长短钟摆",
  tip: "发条绳越放越长，钟摆也就荡得越远。",
  candy: { x: 64, y: 176 },
  monster: { x: 258, y: 424 },
  ropes: [{ x: 126, y: 52, winch: { min: 0.9, max: 1.3, period: 3 } }],
  stars: [
    { x: 172, y: 252 },
    { x: 210, y: 306 },
    { x: 238, y: 364 },
  ],
  solve: { kind: "search", tMax: 3 },
};

const K3: LevelDef = {
  name: "钟楼台阶",
  tip: "先荡到台阶上滑一段，再从台阶尽头掉进啾啾嘴里！",
  candy: { x: 66, y: 176 },
  monster: { x: 320, y: 430 },
  ropes: [{ x: 126, y: 52 }],
  boards: [{ x1: 150, y1: 300, x2: 150, y2: 300, w: 100, h: 14, period: 4 }],
  spikes: [{ x: 0, y: 456, w: 250, h: 24, dir: "up" }],
  stars: [
    { x: 178, y: 258 },
    { x: 232, y: 282 },
    { x: 296, y: 356 },
  ],
  solve: { kind: "low", dir: 1 },
};

const K4: LevelDef = {
  name: "双发条",
  tip: "两根发条绳快慢不一样，糖果会左摇右摆！",
  candy: { x: 180, y: 178 },
  monster: { x: 180, y: 436 },
  ropes: [
    { x: 96, y: 50, winch: { min: 0.92, max: 1.22, period: 2.4 } },
    { x: 264, y: 50, winch: { min: 0.92, max: 1.22, period: 3.6, offset: 0.6 } },
  ],
  spikes: [
    { x: 0, y: 458, w: 92, h: 22, dir: "up" },
    { x: 268, y: 458, w: 92, h: 22, dir: "up" },
  ],
  stars: [
    { x: 180, y: 250 },
    { x: 180, y: 318 },
    { x: 180, y: 386 },
  ],
  solve: { kind: "search", tMax: 2.4 },
};

const K5: LevelDef = {
  name: "发条越刺",
  tip: "等发条把绳子放长，摆幅够大才越得过刺墙！",
  candy: { x: 60, y: 148 },
  monster: { x: 296, y: 426 },
  ropes: [{ x: 132, y: 48, winch: { min: 0.9, max: 1.42, period: 3.4 } }],
  spikes: [
    { x: 0, y: 196, w: 24, h: 196, dir: "right" },
    { x: 0, y: 452, w: 224, h: 28, dir: "up" },
  ],
  stars: [
    { x: 232, y: 244 },
    { x: 270, y: 312 },
    { x: 296, y: 380 },
  ],
  solve: { kind: "search", tMax: 3.4 },
};

const K6: LevelDef = {
  name: "齿轮星门",
  tip: "发条绳一放长就够到齿轮漩涡，一钻就到对面！",
  candy: { x: 86, y: 162 },
  monster: { x: 286, y: 424 },
  ropes: [{ x: 86, y: 50, winch: { min: 0.88, max: 1.36, period: 3 } }],
  portals: [{ ax: 86, ay: 330, bx: 286, by: 152 }],
  spikes: [{ x: 0, y: 456, w: 196, h: 24, dir: "up" }],
  stars: [
    { x: 86, y: 246 },
    { x: 286, y: 230 },
    { x: 286, y: 332 },
  ],
  solve: { kind: "cut", t: 0.4 },
};

// ---- 泡泡浮岛：风扇气流 ----

const F1: LevelDef = {
  name: "顺风滑翔",
  tip: "风扇一路往右吹，糖果边掉边飘过去！",
  candy: { x: 60, y: 124 },
  monster: { x: 278, y: 436 },
  ropes: [{ x: 60, y: 46 }],
  fans: [{ x: 16, y: 170, w: 330, h: 300, dir: "right", power: 1650 }],
  stars: [
    { x: 118, y: 222 },
    { x: 186, y: 300 },
    { x: 252, y: 380 },
  ],
  solve: { kind: "cut", t: 0.4 },
};

const F2: LevelDef = {
  name: "上升气流",
  tip: "绳子是把糖果拴在地上的！剪断它，气流就把糖果吹上天。",
  candy: { x: 180, y: 300 },
  monster: { x: 180, y: 110 },
  ropes: [
    { x: 120, y: 462 },
    { x: 240, y: 462 },
  ],
  fans: [{ x: 120, y: 150, w: 120, h: 320, dir: "up", power: 2400 }],
  stars: [
    { x: 180, y: 248 },
    { x: 180, y: 200 },
    { x: 180, y: 158 },
  ],
  solve: { kind: "cut", t: 0.5, time: 12 },
};

const F3: LevelDef = {
  name: "一开一关",
  tip: "这台风扇会歇气！风起来的时候再放糖果。",
  candy: { x: 66, y: 132 },
  monster: { x: 274, y: 434 },
  ropes: [{ x: 66, y: 48 }],
  fans: [
    { x: 16, y: 176, w: 330, h: 300, dir: "right", power: 2200, period: 2.2, duty: 0.5 },
  ],
  stars: [
    { x: 120, y: 224 },
    { x: 188, y: 304 },
    { x: 248, y: 382 },
  ],
  solve: { kind: "search", tMax: 2.2 },
};

const F4: LevelDef = {
  name: "风送泡泡",
  tip: "坐上泡泡往上飘，侧风会把它一路吹到对岸！",
  candy: { x: 84, y: 196 },
  monster: { x: 296, y: 146 },
  ropes: [
    { x: 34, y: 60 },
    { x: 134, y: 60 },
  ],
  bubbles: [{ x: 84, y: 330 }],
  fans: [{ x: 56, y: 130, w: 290, h: 214, dir: "right", power: 110 }],
  stars: [
    { x: 108, y: 300 },
    { x: 196, y: 234 },
    { x: 268, y: 180 },
  ],
  solve: { kind: "cut", t: 0.5, time: 14 },
};

const F5: LevelDef = {
  name: "风推高台",
  tip: "糖果落在浮岛上会被风一点点推走，别急！",
  candy: { x: 150, y: 168 },
  monster: { x: 306, y: 430 },
  ropes: [{ x: 150, y: 54 }],
  boards: [{ x1: 100, y1: 300, x2: 100, y2: 300, w: 120, h: 14, period: 4 }],
  fans: [{ x: 90, y: 250, w: 250, h: 62, dir: "right", power: 200 }],
  spikes: [{ x: 0, y: 458, w: 236, h: 22, dir: "up" }],
  stars: [
    { x: 150, y: 240 },
    { x: 214, y: 284 },
    { x: 286, y: 366 },
  ],
  solve: { kind: "cut", t: 0.4, time: 12 },
};

// ---- 星糖工厂：糖霜磁铁 + 捣蛋鬼咕噜噜 ----

const M1: LevelDef = {
  name: "磁铁引路",
  tip: "糖霜磁铁会把糖果一路吸过去！",
  candy: { x: 76, y: 150 },
  monster: { x: 284, y: 420 },
  ropes: [{ x: 76, y: 48 }],
  magnets: [{ x: 284, y: 300, radius: 400, strength: 1300 }],
  spikes: [{ x: 0, y: 458, w: 200, h: 22, dir: "up" }],
  stars: [
    { x: 128, y: 232 },
    { x: 196, y: 292 },
    { x: 262, y: 352 },
  ],
  solve: { kind: "cut", t: 0.4 },
};

const M2: LevelDef = {
  name: "推推磁铁",
  tip: "蓝磁铁是反着的，它会把糖果推开！",
  candy: { x: 180, y: 158 },
  monster: { x: 306, y: 428 },
  ropes: [{ x: 180, y: 48 }],
  magnets: [{ x: 148, y: 302, radius: 220, strength: -1100 }],
  spikes: [{ x: 0, y: 458, w: 244, h: 22, dir: "up" }],
  stars: [
    { x: 214, y: 254 },
    { x: 262, y: 322 },
    { x: 300, y: 388 },
  ],
  solve: { kind: "cut", t: 0.4 },
};

const M3: LevelDef = {
  name: "磁铁走廊",
  tip: "一吸一推接着来，糖果会走出一条弯路！",
  candy: { x: 70, y: 146 },
  monster: { x: 292, y: 424 },
  ropes: [{ x: 70, y: 46 }],
  magnets: [
    { x: 210, y: 236, radius: 200, strength: 1200 },
    { x: 112, y: 378, radius: 240, strength: -1100 },
  ],
  spikes: [{ x: 0, y: 458, w: 180, h: 22, dir: "up" }],
  stars: [
    { x: 138, y: 208 },
    { x: 216, y: 282 },
    { x: 276, y: 356 },
  ],
  solve: { kind: "cut", t: 0.3 },
};

const M4: LevelDef = {
  name: "咕噜噜巡逻",
  tip: "捣蛋鬼咕噜噜来回跑，趁它走远了再剪绳！",
  candy: { x: 180, y: 172 },
  monster: { x: 180, y: 436 },
  ropes: [{ x: 180, y: 48 }],
  gremlins: [{ x1: 54, y1: 340, x2: 306, y2: 340, period: 3.4, radius: 26 }],
  stars: [
    { x: 180, y: 250 },
    { x: 180, y: 300 },
    { x: 180, y: 396 },
  ],
  solve: { kind: "search", tMax: 3.4 },
};

const M5: LevelDef = {
  name: "抢糖大作战",
  tip: "磁铁在帮忙，咕噜噜在捣乱，看准空档！",
  candy: { x: 74, y: 152 },
  monster: { x: 288, y: 424 },
  ropes: [{ x: 74, y: 48 }],
  magnets: [{ x: 288, y: 300, radius: 400, strength: 1300 }],
  gremlins: [{ x1: 306, y1: 306, x2: 150, y2: 306, period: 2.8, radius: 22 }],
  spikes: [{ x: 0, y: 458, w: 196, h: 22, dir: "up" }],
  stars: [
    { x: 130, y: 240 },
    { x: 198, y: 296 },
    { x: 262, y: 354 },
  ],
  solve: { kind: "search", tMax: 2.8 },
};

const M6: LevelDef = {
  name: "星糖流水线",
  tip: "木板、磁铁、咕噜噜三样一起来，慢慢数拍子！",
  candy: { x: 180, y: 176 },
  monster: { x: 180, y: 436 },
  ropes: [{ x: 180, y: 48 }],
  boards: [{ x1: 34, y1: 316, x2: 226, y2: 316, w: 100, h: 16, period: 3.2 }],
  magnets: [{ x: 180, y: 404, radius: 150, strength: 700 }],
  gremlins: [{ x1: 60, y1: 244, x2: 60, y2: 244, period: 3, radius: 22, delay: 30 }],
  stars: [
    { x: 180, y: 244 },
    { x: 180, y: 296 },
    { x: 180, y: 392 },
  ],
  solve: { kind: "search", tMax: 3.2 },
};

/* ================= 第七章 · 发条钟楼（23 关） ================= */

const C7: LevelDef[] = [
  K1,
  K2,
  K3,
  K4,
  K5,
  K6,
  MV(K1, "反向落锤", "同样的发条落锤，锚点换了个位置。", {
    ropes: [{ x: 176, y: 40, winch: { min: 0.85, max: 1.5, period: 3.2 } }],
  }),
  MV(K2, "逆时钟摆", "钟摆往左荡，还是等绳子放长！"),
  MV(K3, "左侧台阶", "台阶搬到了左边，接力方向反过来。"),
  MV(K5, "换边越刺", "刺墙在右边，往左边荡过去！"),
  MV(K6, "反向齿轮门", "齿轮漩涡换了边，路线整个镜像。"),
  V(K1, "慢发条", "发条上得松，绳子放得慢，多等一会儿。", {
    ropes: [{ x: 180, y: 44, winch: { min: 0.85, max: 1.55, period: 4.6 } }],
    solve: { kind: "cut", t: 1.2 },
  }),
  V(K1, "急发条", "发条上得紧，一收一放特别快！", {
    ropes: [{ x: 180, y: 44, winch: { min: 0.86, max: 1.44, period: 1.8 } }],
    stars: [{ x: 180, y: 258 }, { x: 180, y: 322 }, { x: 180, y: 390 }],
    solve: { kind: "cut", t: 0.4 },
  }),
  V(K2, "大摆长绳", "发条能把绳子放到很长，摆幅也更夸张。", {
    ropes: [{ x: 126, y: 52, winch: { min: 0.95, max: 1.42, period: 3.6 } }],
    solve: { kind: "search", tMax: 3.6 },
  }),
  MV(
    V(K2, "", "", {
      ropes: [{ x: 126, y: 52, winch: { min: 0.95, max: 1.42, period: 3.6 } }],
      solve: { kind: "search", tMax: 3.6 },
    }),
    "大摆反向",
    "长绳大摆照镜子，重新数拍子！"
  ),
  V(K3, "长台阶", "台阶更长，滑行的路也更远。", {
    boards: [{ x1: 148, y1: 300, x2: 148, y2: 300, w: 118, h: 14, period: 4 }],
    stars: [{ x: 178, y: 258 }, { x: 240, y: 282 }, { x: 300, y: 360 }],
  }),
  V(K4, "同步发条", "两根发条同进同退，糖果稳稳往下坠。", {
    ropes: [
      { x: 96, y: 50, winch: { min: 0.9, max: 1.24, period: 2.8 } },
      { x: 264, y: 50, winch: { min: 0.9, max: 1.24, period: 2.8 } },
    ],
    solve: { kind: "search", tMax: 2.8 },
  }),
  V(K4, "错拍发条", "两边错着拍子，糖果晃得更厉害！", {
    ropes: [
      { x: 92, y: 52, winch: { min: 0.9, max: 1.28, period: 2.2 } },
      { x: 268, y: 52, winch: { min: 0.9, max: 1.28, period: 3.3, offset: 1.1 } },
    ],
    solve: { kind: "search", tMax: 3.3 },
  }),
  V(K5, "钟楼刺阵", "刺墙更高了，摆得不够远就过不去。", {
    spikes: [
      { x: 0, y: 176, w: 24, h: 216, dir: "right" },
      { x: 0, y: 452, w: 232, h: 28, dir: "up" },
    ],
    solve: { kind: "search", tMax: 3.4 },
  }),
  V(K6, "高环齿轮", "齿轮门的出口挂得更高，落点也更靠里。", {
    portals: [{ ax: 86, ay: 330, bx: 286, by: 128 }],
    stars: [{ x: 86, y: 246 }, { x: 286, y: 214 }, { x: 286, y: 322 }],
  }),
  V(K6, "剪刀齿轮", "发条绳配自动剪刀，双手都能歇一歇！", {
    scissors: [{ x: 86, y: 108, radius: 24, period: 2.6 }],
    stars: [{ x: 86, y: 252 }, { x: 286, y: 236 }, { x: 286, y: 340 }],
    solve: { kind: "wait", time: 12 },
  }),
  V(K3, "台阶接钩", "台阶尽头有个挂钩，接住之后再剪一次！", {
    hooks: [{ x: 296, y: 320, radius: 78 }],
    monster: { x: 262, y: 430 },
    spikes: [{ x: 0, y: 456, w: 196, h: 24, dir: "up" }],
    stars: [{ x: 180, y: 258 }, { x: 236, y: 284 }, { x: 300, y: 372 }],
    solve: { kind: "relaySettle", t: 0.62, settle: 1.4, time: 18 },
  }),
  MV(K4, "镜像双发条", "两根发条照镜子，节奏正好倒过来。", {
    stars: [{ x: 180, y: 258 }, { x: 180, y: 324 }, { x: 180, y: 392 }],
  }),
];

/* ================= 第八章 · 泡泡浮岛（22 关） ================= */

const C8: LevelDef[] = [
  F1,
  F2,
  F3,
  F4,
  F5,
  MV(F1, "逆风滑翔", "风改成往左吹，糖果朝另一边飘。"),
  MV(F3, "反向歇气", "会歇气的风扇换了方向，节奏重新数。"),
  MV(F4, "西风泡泡", "泡泡往上飘，西风把它送到左岸！"),
  MV(F5, "左推高台", "浮岛上的风改成往左推。"),
  V(F1, "微风滑翔", "风小了一点，糖果落得更靠里。", {
    fans: [{ x: 16, y: 170, w: 330, h: 300, dir: "right", power: 1000 }],
    monster: { x: 236, y: 438 },
    stars: [{ x: 110, y: 226 }, { x: 172, y: 306 }, { x: 220, y: 384 }],
  }),
  V(F1, "强风滑翔", "风大得很，糖果一路飞到边上！", {
    fans: [{ x: 16, y: 170, w: 330, h: 300, dir: "right", power: 1900 }],
    monster: { x: 312, y: 434 },
    stars: [{ x: 124, y: 220 }, { x: 200, y: 298 }, { x: 278, y: 378 }],
  }),
  V(F2, "高高升起", "风扇更猛，糖果能顶得更高！", {
    fans: [{ x: 120, y: 140, w: 120, h: 330, dir: "up", power: 3000 }],
    monster: { x: 180, y: 92 },
    stars: [{ x: 180, y: 246 }, { x: 180, y: 192 }, { x: 180, y: 142 }],
  }),
  V(F2, "浮岛喷泉", "喷泉一样的气流，把糖果稳稳托住。", {
    fans: [{ x: 132, y: 156, w: 96, h: 314, dir: "up", power: 2800 }],
    candy: { x: 180, y: 322 },
    stars: [{ x: 180, y: 262 }, { x: 180, y: 208 }, { x: 180, y: 162 }],
  }),
  V(F3, "长气短气", "歇气时间更长，得多等一等风。", {
    fans: [
      { x: 16, y: 176, w: 330, h: 300, dir: "right", power: 2400, period: 3, duty: 0.45 },
    ],
    solve: { kind: "search", tMax: 3 },
  }),
  V(F3, "急促阵风", "阵风又急又短，抓紧那一下！", {
    fans: [
      { x: 16, y: 176, w: 330, h: 300, dir: "right", power: 2200, period: 1.6, duty: 0.55 },
    ],
    stars: [{ x: 122, y: 228 }, { x: 192, y: 306 }, { x: 252, y: 386 }],
    solve: { kind: "search", tMax: 1.6 },
  }),
  V(F4, "斜风泡泡", "风更强，泡泡飘得更斜。", {
    fans: [{ x: 56, y: 130, w: 290, h: 214, dir: "right", power: 145 }],
    monster: { x: 316, y: 158 },
    stars: [{ x: 112, y: 296 }, { x: 204, y: 232 }, { x: 284, y: 186 }],
  }),
  V(F5, "双台阶风道", "两层浮岛，风会一层层往下推。", {
    boards: [
      { x1: 100, y1: 288, x2: 100, y2: 288, w: 110, h: 14, period: 4 },
      { x1: 214, y1: 380, x2: 214, y2: 380, w: 104, h: 14, period: 4 },
    ],
    fans: [{ x: 90, y: 240, w: 250, h: 62, dir: "right", power: 210 }],
    monster: { x: 336, y: 428 },
    spikes: [{ x: 0, y: 458, w: 200, h: 22, dir: "up" }],
    stars: [{ x: 150, y: 236 }, { x: 210, y: 272 }, { x: 300, y: 356 }],
    solve: { kind: "cut", t: 0.4, time: 14 },
  }),
  V(F1, "浮岛刺风", "顺风路上多了一排刺，别贴着地飞。", {
    spikes: [{ x: 0, y: 458, w: 200, h: 22, dir: "up" }],
    stars: [{ x: 116, y: 218 }, { x: 184, y: 296 }, { x: 250, y: 372 }],
  }),
  V(F2, "气流接星", "上升气流路上串了三颗星。", {
    stars: [{ x: 180, y: 262 }, { x: 180, y: 214 }, { x: 180, y: 170 }],
    monster: { x: 180, y: 124 },
  }),
  MV(
    V(F1, "", "", {
      fans: [{ x: 16, y: 170, w: 330, h: 300, dir: "right", power: 1900 }],
      monster: { x: 312, y: 434 },
      stars: [{ x: 124, y: 220 }, { x: 200, y: 298 }, { x: 278, y: 378 }],
    }),
    "强风倒吹",
    "最猛的风倒过来吹，落点也整个翻面。"
  ),
  V(F4, "风扇电梯", "泡泡加气流，一路斜着飘上云端。", {
    bubbles: [{ x: 84, y: 344 }],
    fans: [{ x: 56, y: 128, w: 290, h: 230, dir: "right", power: 120 }],
    monster: { x: 302, y: 138 },
    stars: [{ x: 106, y: 306 }, { x: 198, y: 240 }, { x: 272, y: 180 }],
  }),
  V(F5, "风道挂钩", "浮岛边上有挂钩，被接住就再剪一次。", {
    hooks: [{ x: 274, y: 320, radius: 76 }],
    monster: { x: 286, y: 438 },
    stars: [{ x: 150, y: 238 }, { x: 216, y: 284 }, { x: 286, y: 372 }],
    solve: { kind: "relaySettle", t: 0.4, settle: 1.6, time: 18 },
  }),
];

/* ================= 第九章 · 星糖工厂（22 关） ================= */

const C9: LevelDef[] = [
  M1,
  M2,
  M3,
  M4,
  M5,
  M6,
  MV(M1, "换边磁铁", "磁铁装到了左边，糖果往左拐。"),
  MV(M2, "反推磁铁", "推力磁铁换边，糖果被推向左侧。"),
  MV(M3, "镜像走廊", "一吸一推的走廊照了镜子。"),
  MV(M5, "反向抢糖", "咕噜噜从另一边冲过来抢糖！"),
  V(M1, "弱磁引路", "磁力小一些，糖果拐得没那么急。", {
    magnets: [{ x: 284, y: 300, radius: 400, strength: 1150 }],
    monster: { x: 234, y: 384 },
    spikes: [{ x: 0, y: 458, w: 150, h: 22, dir: "up" }],
    stars: [{ x: 128, y: 234 }, { x: 186, y: 296 }, { x: 232, y: 342 }],
  }),
  V(M1, "强磁引路", "磁力大得很，糖果几乎被拽着走！", {
    magnets: [{ x: 292, y: 290, radius: 420, strength: 1800 }],
    monster: { x: 300, y: 412 },
    stars: [{ x: 134, y: 220 }, { x: 210, y: 282 }, { x: 276, y: 340 }],
  }),
  V(M2, "双推磁铁", "上下两块推力磁铁，糖果被赶成一条斜线。", {
    magnets: [
      { x: 146, y: 268, radius: 190, strength: -1000 },
      { x: 168, y: 384, radius: 170, strength: -820 },
    ],
    stars: [{ x: 216, y: 246 }, { x: 268, y: 314 }, { x: 306, y: 382 }],
  }),
  V(M4, "两只咕噜噜", "两只捣蛋鬼一前一后，空档更小了！", {
    gremlins: [
      { x1: 54, y1: 300, x2: 306, y2: 300, period: 3.4, radius: 24 },
      { x1: 306, y1: 384, x2: 54, y2: 384, period: 2.6, radius: 24 },
    ],
    solve: { kind: "search", tMax: 4 },
  }),
  V(M4, "慢吞吞咕噜噜", "这只咕噜噜走得慢，空档很好找。", {
    gremlins: [{ x1: 60, y1: 348, x2: 300, y2: 348, period: 4.8, radius: 28 }],
    stars: [{ x: 180, y: 244 }, { x: 180, y: 296 }, { x: 180, y: 400 }],
    solve: { kind: "search", tMax: 4.8 },
  }),
  V(M4, "上下咕噜噜", "咕噜噜这次斜着跑，路线更难猜。", {
    gremlins: [{ x1: 60, y1: 260, x2: 300, y2: 396, period: 3, radius: 24 }],
    stars: [{ x: 180, y: 234 }, { x: 180, y: 306 }, { x: 180, y: 402 }],
    solve: { kind: "search", tMax: 3 },
  }),
  V(M5, "磁铁夹道", "磁铁吸着走，咕噜噜横着拦，稳住！", {
    gremlins: [{ x1: 300, y1: 244, x2: 150, y2: 244, period: 2.2, radius: 22 }],
    solve: { kind: "search", tMax: 2.2 },
  }),
  V(M3, "磁铁与星门", "走廊尽头加了个星门，路更绕了。", {
    portals: [{ ax: 292, ay: 330, bx: 292, by: 200 }],
    stars: [{ x: 140, y: 212 }, { x: 220, y: 284 }, { x: 286, y: 262 }],
  }),
  V(M2, "推推挂钩", "被推开之后，挂钩正好接住！", {
    hooks: [{ x: 292, y: 296, radius: 74 }],
    monster: { x: 304, y: 434 },
    stars: [{ x: 220, y: 250 }, { x: 274, y: 300 }, { x: 304, y: 384 }],
    solve: { kind: "relaySettle", t: 0.4, settle: 1.4, time: 18 },
  }),
  V(M1, "磁铁泡泡", "磁铁把糖果吸过去，泡泡再托着它上楼。", {
    bubbles: [{ x: 196, y: 360 }],
    magnets: [{ x: 284, y: 120, radius: 340, strength: 1500 }],
    monster: { x: 262, y: 182 },
    spikes: [{ x: 0, y: 458, w: 150, h: 22, dir: "up" }],
    stars: [{ x: 132, y: 250 }, { x: 196, y: 330 }, { x: 236, y: 226 }],
    solve: { kind: "cut", t: 0.4, time: 16 },
  }),
  MV(M6, "镜像流水线", "整条流水线照镜子，节奏也翻了个面。"),
  MV(
    V(M4, "", "", {
      gremlins: [{ x1: 60, y1: 348, x2: 300, y2: 348, period: 4.8, radius: 28 }],
      stars: [{ x: 180, y: 244 }, { x: 180, y: 296 }, { x: 180, y: 400 }],
      solve: { kind: "search", tMax: 4.8 },
    }),
    "反向慢咕噜",
    "慢咕噜噜从另一头出发，一样等空档。"
  ),
];

/* ================= 第十章 · 月光大巡游（22 关，全机关混编） ================= */

const C10: LevelDef[] = [
  V(K1, "月光落锤", "发条落锤配上剪刀，两只手都省下来了。", {
    scissors: [{ x: 180, y: 96, radius: 24, period: 2.4 }],
    spikes: [
      { x: 0, y: 458, w: 96, h: 22, dir: "up" },
      { x: 264, y: 458, w: 96, h: 22, dir: "up" },
    ],
    solve: { kind: "wait", time: 12 },
  }),
  V(K2, "月下长摆", "发条长摆加刺墙，摆幅一定要够；左边那级台阶是给你看高度的。", {
    spikes: [{ x: 0, y: 456, w: 180, h: 24, dir: "up" }],
    boards: [{ x1: 2, y1: 306, x2: 2, y2: 306, w: 52, h: 14, period: 4 }],
    stars: [{ x: 170, y: 250 }, { x: 208, y: 304 }, { x: 240, y: 362 }],
    solve: { kind: "search", tMax: 3 },
  }),
  V(K5, "巡游刺阵", "发条越刺再加一台风扇，顺风更远！", {
    fans: [{ x: 120, y: 220, w: 230, h: 200, dir: "right", power: 300 }],
    solve: { kind: "search", tMax: 3.4 },
  }),
  V(K6, "月夜齿轮", "发条、星门、磁铁，三样连着来！", {
    magnets: [{ x: 286, y: 330, radius: 200, strength: 900 }],
    stars: [{ x: 86, y: 244 }, { x: 286, y: 226 }, { x: 286, y: 336 }],
  }),
  V(F1, "月色顺风", "顺风路上多了块磁铁，落点更靠里。", {
    magnets: [{ x: 250, y: 380, radius: 190, strength: 700 }],
    fans: [{ x: 16, y: 170, w: 330, h: 300, dir: "right", power: 1500 }],
    spikes: [{ x: 0, y: 458, w: 168, h: 22, dir: "up" }],
    stars: [{ x: 116, y: 220 }, { x: 186, y: 298 }, { x: 250, y: 374 }],
  }),
  V(F2, "月泉升空", "上升气流加两根绳，剪断才飞得起来。", {
    magnets: [{ x: 180, y: 150, radius: 150, strength: 500 }],
    stars: [{ x: 180, y: 304 }, { x: 180, y: 232 }, { x: 180, y: 172 }],
  }),
  V(F3, "阵风陷阱", "阵风的空档里还站着咕噜噜，看准了再剪！", {
    gremlins: [{ x1: 60, y1: 400, x2: 172, y2: 400, period: 2.6, radius: 22 }],
    spikes: [{ x: 0, y: 458, w: 150, h: 22, dir: "up" }],
    stars: [{ x: 120, y: 226 }, { x: 196, y: 306 }, { x: 252, y: 384 }],
    solve: { kind: "search", tMax: 2.6 },
  }),
  V(F5, "浮岛咕噜噜", "浮岛上的风还没停，咕噜噜就来了！", {
    gremlins: [{ x1: 44, y1: 402, x2: 170, y2: 402, period: 2.4, radius: 22 }],
    stars: [{ x: 150, y: 238 }, { x: 214, y: 282 }, { x: 292, y: 350 }],
    solve: { kind: "cut", t: 0.4, time: 12 },
  }),
  V(M1, "巡游磁铁", "磁铁配上会歇气的风扇，路线弯弯的。", {
    fans: [{ x: 60, y: 190, w: 280, h: 190, dir: "right", power: 420, period: 2, duty: 0.6 }],
    monster: { x: 306, y: 416 },
    stars: [{ x: 134, y: 232 }, { x: 208, y: 290 }, { x: 274, y: 348 }],
    solve: { kind: "search", tMax: 2 },
  }),
  V(M4, "咕噜噜舞会", "三只咕噜噜排成三排，空档要自己找！", {
    gremlins: [
      { x1: 54, y1: 260, x2: 306, y2: 260, period: 3, radius: 22 },
      { x1: 306, y1: 336, x2: 54, y2: 336, period: 2.4, radius: 22 },
      { x1: 54, y1: 402, x2: 306, y2: 402, period: 3.8, radius: 22 },
    ],
    magnets: [{ x: 180, y: 404, radius: 130, strength: 600 }],
    spikes: [
      { x: 0, y: 458, w: 96, h: 22, dir: "up" },
      { x: 264, y: 458, w: 96, h: 22, dir: "up" },
    ],
    stars: [{ x: 180, y: 236 }, { x: 180, y: 306 }, { x: 180, y: 380 }],
    solve: { kind: "search", tMax: 6 },
  }),
  V(M6, "月夜流水线", "木板、磁铁、发条绳，全在一条线上。", {
    ropes: [{ x: 180, y: 48, winch: { min: 0.92, max: 1.3, period: 2.8 } }],
    solve: { kind: "search", tMax: 3.2 },
  }),
  V(K3, "月台阶接力", "台阶滑行加一台风扇，多推一小段。", {
    fans: [{ x: 240, y: 250, w: 110, h: 90, dir: "right", power: 160 }],
    monster: { x: 336, y: 432 },
    stars: [{ x: 178, y: 258 }, { x: 234, y: 282 }, { x: 306, y: 352 }],
    solve: { kind: "low", dir: 1, time: 14 },
  }),
  V(B10, "月光星门", "老星门配新磁铁，出口那头有人接。", {
    magnets: [{ x: 280, y: 300, radius: 170, strength: 700 }],
    stars: [{ x: 80, y: 242 }, { x: 280, y: 244 }, { x: 280, y: 344 }],
  }),
  V(B12, "月夜剪刀", "自动剪刀配上升气流，落得慢慢的；两边高台看热闹。", {
    fans: [{ x: 130, y: 300, w: 100, h: 160, dir: "up", power: 500 }],
    boards: [
      { x1: 16, y1: 330, x2: 16, y2: 330, w: 66, h: 14, period: 4 },
      { x1: 278, y1: 330, x2: 278, y2: 330, w: 66, h: 14, period: 4 },
    ],
    monster: { x: 180, y: 442 },
    stars: [{ x: 180, y: 258 }, { x: 180, y: 322 }, { x: 180, y: 392 }],
    solve: { kind: "wait", time: 14 },
  }),
  V(B02, "月光秋千", "老秋千挂上发条，荡起来手感不一样；地上还铺了刺。", {
    ropes: [{ x: 122, y: 56, winch: { min: 0.94, max: 1.18, period: 2.6 } }],
    spikes: [{ x: 0, y: 460, w: 150, h: 20, dir: "up" }],
    boards: [{ x1: 2, y1: 320, x2: 2, y2: 320, w: 48, h: 14, period: 4 }],
    solve: { kind: "search", tMax: 2.6 },
  }),
  V(B06, "月钩接力", "挂钩接力，下面有块磁铁帮忙，可别掉进刺坑。", {
    magnets: [{ x: 280, y: 380, radius: 170, strength: 600 }],
    spikes: [{ x: 0, y: 460, w: 140, h: 20, dir: "up" }],
    solve: { kind: "hookRelay", dir: 1, time: 14 },
  }),
  V(M5, "月夜抢糖", "磁铁、咕噜噜、刺墙，全都凑齐了！", {
    spikes: [
      { x: 0, y: 458, w: 196, h: 22, dir: "up" },
      { x: 0, y: 196, w: 22, h: 150, dir: "right" },
    ],
    solve: { kind: "search", tMax: 2.8 },
  }),
  MV(
    V(M5, "", "", {
      spikes: [
        { x: 0, y: 458, w: 196, h: 22, dir: "up" },
        { x: 0, y: 196, w: 22, h: 150, dir: "right" },
      ],
      solve: { kind: "search", tMax: 2.8 },
    }),
    "镜像抢糖",
    "同一套抢糖阵照镜子，方向全反。"
  ),
  V(F4, "月泡漂流", "泡泡加侧风加磁铁，慢慢漂过整条河。", {
    magnets: [{ x: 300, y: 160, radius: 180, strength: 600 }],
    stars: [{ x: 108, y: 298 }, { x: 198, y: 232 }, { x: 272, y: 176 }],
  }),
  V(K4, "月夜双发条", "两根发条加一只咕噜噜，别被它碰到！", {
    gremlins: [{ x1: 60, y1: 356, x2: 300, y2: 356, period: 3.2, radius: 22 }],
    solve: { kind: "search", tMax: 3.4 },
  }),
  V(M3, "巡游走廊", "一吸一推的走廊，末尾还有台风扇。", {
    fans: [{ x: 200, y: 300, w: 150, h: 120, dir: "right", power: 260 }],
    monster: { x: 316, y: 420 },
    stars: [{ x: 138, y: 208 }, { x: 220, y: 286 }, { x: 296, y: 356 }],
  }),
  V(K6, "毕业大巡游", "发条、星门、磁铁、风扇、咕噜噜——全套来一遍！", {
    magnets: [{ x: 286, y: 320, radius: 190, strength: 800 }],
    fans: [{ x: 200, y: 180, w: 150, h: 130, dir: "down", power: 260 }],
    gremlins: [{ x1: 40, y1: 240, x2: 40, y2: 240, period: 3, radius: 20, delay: 40 }],
    stars: [{ x: 86, y: 248 }, { x: 286, y: 232 }, { x: 286, y: 344 }],
  }),
];

export const LEVELS: LevelDef[] = [
  ...C1, ...C2, ...C3, ...C4, ...C5, ...C6,
  ...C7, ...C8, ...C9, ...C10,
];

/** 全部关卡的星星总数（评级用）。 */
export function totalStars(): number {
  return LEVELS.reduce((sum, lv) => sum + lv.stars.length, 0);
}

/* ---------------- 结算朗读 ---------------- */
// 逐关结算不走 level99 浮层，识字量有限的孩子靠听。
// 纯函数便于测试；朗读本身走 speech.ts，无中文语音包时静默降级。

/** 过关时要朗读的整句话。 */
export function wonSpeechLine(stars: number): string {
  return `过关啦！啾啾吃到糖果，得到 ${stars} 颗星！`;
}

/** 失败时要朗读的整句话：先说原因，再温柔安抚。 */
export function failedSpeechLine(reason: string): string {
  return `${reason}没关系，点一下屏幕再来一次！`;
}
