// 糖果秋千关卡数据。画布坐标系 360 x 480，由易到难共 9 关。
// 星星位置按"标准玩法"的摆动/抛物线轨迹校算过。

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
}

export const LEVELS: LevelDef[] = [
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
];

/** 全部关卡的星星总数（评级用）。 */
export function totalStars(): number {
  return LEVELS.reduce((sum, lv) => sum + lv.stars.length, 0);
}
