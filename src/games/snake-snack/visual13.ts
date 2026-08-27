// 贪吃毛毛虫 · 1.3 视觉层:配色板 / 图层序 / 动效时序 / 场景画笔。
//
// 只管好看,不管规则:逻辑格坐标、碰撞判定、移动节奏都在 logic.ts / snake12.ts,
// 这里的所有函数都是「拿着状态画一帧」的纯绘制,一个逻辑数值都不改。
// 光源统一左上 45°;reduced-motion 的降级开关全部由入参传进来。
import { type Chain2D, type CatLook, catShade } from "../../art/kit/caterpillar";

/* ------------------------------------------------------------------ */
/* 一、配色板(与 step 文档四·补一的表逐色一致)                          */
/* ------------------------------------------------------------------ */

export const SS_COLORS = {
  /** 棋盘双色格(明度差 4%) */
  ssBoardA: "#F4F8EC",
  ssBoardB: "#EDF3E2",
  /** 花园栅栏边框 */
  ssFence: "#C89B6C",
  /** 虫身双色交替节 */
  ssBodyA: "#9FD98B",
  ssBodyB: "#B8E39B",
  /** 头部主色(大眼白 + 黑瞳在 kit 里画) */
  ssHead: "#8FCB7A",
  /** 待踩花砖 / 踩过亮砖 */
  ssTile: "#E8D8F0",
  ssTileLit: "#FFE9A8",
  /** 三棱面岩石 */
  ssRock: "#B9AFA4",
  /** 统一落影 */
  ssShadow: "rgba(90,110,74,.14)",
} as const;

/** 场景件的补充色(归在视觉常量块里,不散落在画笔里) */
export const SS_SCENE = {
  bushDark: "#93C17E",
  bushLight: "#B7DFA0",
  doorWood: "#C99A63",
  doorDark: "#A87C4C",
  doorLight: "#F7EFD8",
  lockGold: "#E8C05A",
  swirlA: "#8FB7E8",
  swirlB: "#C9A6E8",
  hogBody: "#B99B7E",
  hogSpike: "#8D7358",
  hogFace: "#F3E3CF",
  tileGlow: "rgba(255,214,120,0.55)",
} as const;

/** 绿虫是主角;双身位关的第二条粉虫,主色/交替色全套不同,一眼可分 */
export const SS_WORM_GREEN: CatLook = {
  head: SS_COLORS.ssHead,
  bodyA: SS_COLORS.ssBodyA,
  bodyB: SS_COLORS.ssBodyB,
  shadow: SS_COLORS.ssShadow,
};
export const SS_WORM_PINK: CatLook = {
  head: "#D389B4",
  bodyA: "#E9A6C9",
  bodyB: "#F3C3DB",
  shadow: SS_COLORS.ssShadow,
};

/**
 * draw 的图层序(从底到顶),index.ts 按这个顺序画:
 * 棋盘双色格 → 花砖小路 → 墙草丛/石头/门 → 传送旋涡 → 食物/奖励星
 * → 刺猬 → 毛毛虫(尾→头,头永远最上) → 鼓包波/金闪 → HUD(DOM)。
 */
export const SS_LAYERS = [
  "board",
  "tiles",
  "terrain",
  "portal",
  "snack",
  "hedgehog",
  "caterpillar",
  "fx",
  "hud",
] as const;

/* ------------------------------------------------------------------ */
/* 二、动效时序(毫秒写死成常量,测试引用这里)                            */
/* ------------------------------------------------------------------ */

export const SS_ANIM = {
  /** 移动插值:上一格 → 当前格 80ms 平滑(linear);reduced 关闭回逐格瞬跳 */
  moveMs: 80,
  /** 吃食张嘴:1 帧(step);reduced 保留(功能反馈) */
  biteFrames: 1,
  /** 鼓包传导:两节 × 90ms(easeOutQuad);reduced 关闭 */
  bulgeNodeMs: 90,
  bulgeNodes: 2,
  /** 奖励金闪:1 帧全身(step);reduced 保留 */
  goldFrames: 1,
  /** 门旋开:150ms(easeOutQuad);reduced 瞬开 */
  doorMs: 150,
  /** 传送旋涡:常驻 2400ms/圈(linear);reduced 静止 */
  swirlMs: 2400,
  /** 花砖点亮微光:260ms 渐入(easeOut);reduced 瞬亮(提示保留) */
  tileGlowMs: 260,
} as const;

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

export function easeOutQuad(t: number): number {
  const c = clamp01(t);
  return c * (2 - c);
}

/** 移动插值进度:80ms 内平滑走完,之后停在格心;reduced 直接落格 */
export function moveGlideT(accMs: number, reduced: boolean): number {
  if (reduced) return 1;
  return clamp01(accMs / SS_ANIM.moveMs);
}

/** 花砖踩亮微光进度:260ms easeOut 渐入;reduced 瞬亮(提示不丢) */
export function tileGlowT(msSinceLit: number, reduced: boolean): number {
  if (reduced) return 1;
  if (!(msSinceLit >= 0)) return 0;
  return easeOutQuad(msSinceLit / SS_ANIM.tileGlowMs);
}

/** 门旋开进度:150ms easeOutQuad;reduced 瞬开 */
export function doorSwingT(msSinceOpen: number, reduced: boolean): number {
  if (reduced) return 1;
  if (!(msSinceOpen >= 0)) return 0;
  return easeOutQuad(msSinceOpen / SS_ANIM.doorMs);
}

/** 传送旋涡相位 0..1:2400ms 一圈 linear;reduced 静止在 0 */
export function swirlPhase(nowMs: number, reduced: boolean): number {
  if (reduced) return 0;
  const ms = Math.max(0, nowMs);
  return (ms % SS_ANIM.swirlMs) / SS_ANIM.swirlMs;
}

/**
 * 鼓包波此刻传到第几节(小数):两节 × 90ms,easeOutQuad 减速;
 * 传完(≥ 180ms)或 reduced 时返回 -9 = 没有波。
 */
export function bulgePos(msSinceEat: number, reduced: boolean): number {
  if (reduced || !(msSinceEat >= 0)) return -9;
  const total = SS_ANIM.bulgeNodeMs * SS_ANIM.bulgeNodes;
  if (msSinceEat >= total) return -9;
  return easeOutQuad(msSinceEat / total) * SS_ANIM.bulgeNodes;
}

/* ------------------------------------------------------------------ */
/* 三、一局的视觉小状态(插值计时 / 张嘴金闪帧 / 花砖点亮时刻)             */
/* ------------------------------------------------------------------ */

export interface VisualFx {
  /** 上一口吃在几毫秒(鼓包波起点);-1 = 没有波 */
  eatAtMs: number;
  /** 张嘴剩余帧 / 金闪剩余帧 */
  biteFrames: number;
  goldFrames: number;
  /** 绕圈门打开时刻;-1 = 还没开 */
  doorOpenAtMs: number;
  /** 每块花砖踩亮的时刻(格 key → 毫秒) */
  tileLitAt: Map<number, number>;
  noteEat(nowMs: number): void;
  noteStar(): void;
  noteDoorOpen(nowMs: number): void;
  noteTileLit(key: number, nowMs: number): void;
  /** destroy 时全部归零:计时、帧、砖点亮记录一个不留 */
  reset(): void;
}

export function createVisualFx(): VisualFx {
  return {
    eatAtMs: -1,
    biteFrames: 0,
    goldFrames: 0,
    doorOpenAtMs: -1,
    tileLitAt: new Map<number, number>(),
    noteEat(nowMs: number) {
      this.eatAtMs = nowMs;
      this.biteFrames = SS_ANIM.biteFrames;
    },
    noteStar() {
      this.goldFrames = SS_ANIM.goldFrames;
    },
    noteDoorOpen(nowMs: number) {
      this.doorOpenAtMs = nowMs;
    },
    noteTileLit(key: number, nowMs: number) {
      this.tileLitAt.set(key, nowMs);
    },
    reset() {
      this.eatAtMs = -1;
      this.biteFrames = 0;
      this.goldFrames = 0;
      this.doorOpenAtMs = -1;
      this.tileLitAt.clear();
    },
  };
}

/* ------------------------------------------------------------------ */
/* 四、场景画笔(九种 emoji 的替身,全部程序化绘制)                        */
/* ------------------------------------------------------------------ */

const TAU = Math.PI * 2;

/** 场景画笔用到的最小画布面:kit 的 Chain2D 再加矩形与线性渐变 */
export interface Paint2D extends Chain2D {
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): { addColorStop(o: number, c: string): void };
}

/** 一格的中心与常用尺寸 */
function at(x: number, y: number, cell: number): { cx: number; cy: number; r: number } {
  return { cx: (x + 0.5) * cell, cy: (y + 0.5) * cell, r: cell / 2 };
}

/** 带三停光影的小圆(场景件共用的体积笔) */
function ball(ctx: Paint2D, cx: number, cy: number, r: number, color: string): void {
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.15, cx, cy, r);
  g.addColorStop(0, catShade(color, 0.25));
  g.addColorStop(0.65, color);
  g.addColorStop(1, catShade(color, -0.16));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
}

/** ① 棋盘双色格 + 花园栅栏边框(整张底,一次画完) */
export function paintBoard(ctx: Paint2D, grid: number, cell: number): void {
  const size = grid * cell;
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? SS_COLORS.ssBoardA : SS_COLORS.ssBoardB;
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  // 栅栏:双层描边 + 每格一个小桩点,像围了一圈小木篱
  ctx.strokeStyle = SS_COLORS.ssFence;
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, size - 3, size - 3);
  ctx.strokeStyle = catShade(SS_COLORS.ssFence, 0.35);
  ctx.lineWidth = 1;
  ctx.strokeRect(3.5, 3.5, size - 7, size - 7);
  ctx.fillStyle = catShade(SS_COLORS.ssFence, -0.22);
  for (let i = 0; i < grid; i++) {
    const m = (i + 0.5) * cell;
    for (const [px, py] of [[m, 2], [m, size - 2], [2, m], [size - 2, m]] as const) {
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, TAU);
      ctx.fill();
    }
  }
}

/** ③ 墙 = 草丛簇:三球叠层 + 深浅两色 + 落影 */
export function paintBush(ctx: Paint2D, x: number, y: number, cell: number): void {
  const { cx, cy, r } = at(x, y, cell);
  ctx.fillStyle = SS_COLORS.ssShadow;
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.62, r * 0.78, r * 0.26, 0, 0, TAU);
  ctx.fill();
  ball(ctx, cx - r * 0.4, cy + r * 0.18, r * 0.5, SS_SCENE.bushDark);
  ball(ctx, cx + r * 0.42, cy + r * 0.2, r * 0.48, SS_SCENE.bushDark);
  ball(ctx, cx, cy - r * 0.18, r * 0.58, SS_SCENE.bushLight);
  // 顶上两粒露珠高光
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  for (const [hx, hy] of [[cx - r * 0.18, cy - r * 0.42], [cx + r * 0.3, cy - r * 0.1]] as const) {
    ctx.beginPath();
    ctx.arc(hx, hy, r * 0.1, 0, TAU);
    ctx.fill();
  }
}

/** ② 待踩圈 = 花砖:未踩灰花 / 踩过亮花 + 微光(glowT 0..1) */
export function paintTile(ctx: Paint2D, x: number, y: number, cell: number, lit: boolean, glowT: number): void {
  const { cx, cy, r } = at(x, y, cell);
  ctx.fillStyle = lit ? SS_COLORS.ssTileLit : SS_COLORS.ssTile;
  ctx.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);
  ctx.strokeStyle = catShade(lit ? SS_COLORS.ssTileLit : SS_COLORS.ssTile, -0.14);
  ctx.lineWidth = 1;
  ctx.strokeRect(x * cell + 2.5, y * cell + 2.5, cell - 5, cell - 5);
  // 砖心一朵五瓣小花:未踩是灰白的,踩过点亮成暖黄
  const petal = lit ? "#FFC85C" : "#CFC6D8";
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU - Math.PI / 2;
    ctx.fillStyle = petal;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r * 0.34, cy + Math.sin(a) * r * 0.34, r * 0.2, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = lit ? "#FFF3CE" : "#EDE7F2";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.18, 0, TAU);
  ctx.fill();
  // 踩亮那 260ms 的微光圈
  if (lit && glowT > 0) {
    ctx.globalAlpha = 0.65 * glowT;
    ctx.strokeStyle = SS_SCENE.tileGlow;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r * (0.55 + 0.3 * glowT), 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/** ④ 传送 = 双色旋涡:两条渐细的旋臂绕相位转;reduced 时相位恒 0(静止) */
export function paintSwirl(ctx: Paint2D, x: number, y: number, cell: number, phase: number): void {
  const { cx, cy, r } = at(x, y, cell);
  ball(ctx, cx, cy, r * 0.82, "#E3ECFA");
  ctx.lineCap = "round";
  const base = phase * TAU;
  for (const [arm, color] of [[0, SS_SCENE.swirlA], [Math.PI, SS_SCENE.swirlB]] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = r * 0.2;
    ctx.beginPath();
    for (let k = 0; k <= 8; k++) {
      const a = base + arm + k * 0.34;
      const rad = r * 0.66 * (1 - k / 11);
      const px = cx + Math.cos(a) * rad;
      const py = cy + Math.sin(a) * rad;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.1, 0, TAU);
  ctx.fill();
}

/**
 * 门(窄门与绕圈小门共用):木门板 + 木纹;关着挂锁牌,开门时门板旋开(swingT 0..1)。
 * flower = true 的门开了以后门洞里放一朵小花(绕圈门「🌼」的替身语义)。
 */
export function paintDoor(
  ctx: Paint2D,
  x: number,
  y: number,
  cell: number,
  open: boolean,
  swingT: number,
  flower = false
): void {
  const { cx, cy, r } = at(x, y, cell);
  const left = x * cell + 2;
  const top = y * cell + 2;
  const w = cell - 4;
  const h = cell - 4;
  // 门框
  ctx.fillStyle = SS_SCENE.doorDark;
  ctx.fillRect(left, top, w, h);
  // 门洞透光(开门越大越亮)
  ctx.fillStyle = SS_SCENE.doorLight;
  ctx.fillRect(left + 2, top + 2, w - 4, h - 4);
  // 门板:铰链在左,旋开用宽度收缩表现(150ms easeOutQuad)
  const plank = open ? Math.max(0, 1 - 0.82 * swingT) : 1;
  const pw = (w - 4) * plank;
  if (pw > 0.5) {
    const g = ctx.createLinearGradient(left + 2, top, left + 2 + pw, top);
    g.addColorStop(0, catShade(SS_SCENE.doorWood, 0.16));
    g.addColorStop(1, catShade(SS_SCENE.doorWood, -0.1));
    ctx.fillStyle = g;
    ctx.fillRect(left + 2, top + 2, pw, h - 4);
    // 两道竖木纹
    ctx.strokeStyle = catShade(SS_SCENE.doorWood, -0.28);
    ctx.lineWidth = 1;
    for (const fx of [0.35, 0.7]) {
      const lx = left + 2 + pw * fx;
      ctx.beginPath();
      ctx.moveTo(lx, top + 4);
      ctx.lineTo(lx, top + h - 6);
      ctx.stroke();
    }
  }
  if (!open) {
    // 锁牌:金色小圆牌 + 锁孔
    ball(ctx, cx + r * 0.02, cy + r * 0.08, r * 0.3, SS_SCENE.lockGold);
    ctx.fillStyle = catShade(SS_SCENE.lockGold, -0.55);
    ctx.beginPath();
    ctx.arc(cx + r * 0.02, cy + r * 0.04, r * 0.08, 0, TAU);
    ctx.fill();
    ctx.fillRect(cx - r * 0.02, cy + r * 0.04, r * 0.08, r * 0.18);
  } else if (flower && swingT >= 1) {
    // 绕圈门开了:门洞里一朵小花当路标
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - Math.PI / 2;
      ctx.fillStyle = "#FFC85C";
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r * 0.26, cy + Math.sin(a) * r * 0.26, r * 0.15, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = "#FFF3CE";
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.13, 0, TAU);
    ctx.fill();
  }
}

/** ③ 石头 = 三棱面岩石:底影 + 主面 + 亮顶面 + 暗侧面 */
export function paintRock(ctx: Paint2D, x: number, y: number, cell: number): void {
  const { cx, cy, r } = at(x, y, cell);
  ctx.fillStyle = SS_COLORS.ssShadow;
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.58, r * 0.72, r * 0.24, 0, 0, TAU);
  ctx.fill();
  // 主面:不规则六边
  ctx.fillStyle = SS_COLORS.ssRock;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.66, cy + r * 0.5);
  ctx.lineTo(cx - r * 0.72, cy - r * 0.05);
  ctx.lineTo(cx - r * 0.22, cy - r * 0.58);
  ctx.lineTo(cx + r * 0.42, cy - r * 0.5);
  ctx.lineTo(cx + r * 0.7, cy + r * 0.08);
  ctx.lineTo(cx + r * 0.5, cy + r * 0.52);
  ctx.closePath();
  ctx.fill();
  // 亮顶面(光源左上)
  ctx.fillStyle = catShade(SS_COLORS.ssRock, 0.22);
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.72, cy - r * 0.05);
  ctx.lineTo(cx - r * 0.22, cy - r * 0.58);
  ctx.lineTo(cx + r * 0.42, cy - r * 0.5);
  ctx.lineTo(cx - r * 0.1, cy - r * 0.02);
  ctx.closePath();
  ctx.fill();
  // 暗侧面
  ctx.fillStyle = catShade(SS_COLORS.ssRock, -0.16);
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.42, cy - r * 0.5);
  ctx.lineTo(cx + r * 0.7, cy + r * 0.08);
  ctx.lineTo(cx + r * 0.5, cy + r * 0.52);
  ctx.lineTo(cx - r * 0.1, cy - r * 0.02);
  ctx.closePath();
  ctx.fill();
}

/** ⑥ 刺猬 = 圆背小刺球:友好脸(圆眼 + 小鼻头 + 微笑),碰到只是「哎呀」弹回 */
export function paintHedgehog(ctx: Paint2D, x: number, y: number, cell: number): void {
  const { cx, cy, r } = at(x, y, cell);
  ctx.fillStyle = SS_COLORS.ssShadow;
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.6, r * 0.7, r * 0.24, 0, 0, TAU);
  ctx.fill();
  // 背刺:七根短圆刺,绕着背排一圈
  ctx.fillStyle = SS_SCENE.hogSpike;
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.9 + (i / 6) * 1.2);
    const bx = cx + Math.cos(a) * r * 0.42;
    const by = cy + r * 0.02 + Math.sin(a) * r * 0.42;
    const tx = cx + Math.cos(a) * r * 0.78;
    const ty = cy + r * 0.02 + Math.sin(a) * r * 0.78;
    const ox = -Math.sin(a) * r * 0.14;
    const oy = Math.cos(a) * r * 0.14;
    ctx.beginPath();
    ctx.moveTo(bx + ox, by + oy);
    ctx.quadraticCurveTo(tx, ty, bx - ox, by - oy);
    ctx.closePath();
    ctx.fill();
  }
  // 圆背身体
  ball(ctx, cx, cy + r * 0.06, r * 0.5, SS_SCENE.hogBody);
  // 浅色小脸(朝下前方) + 圆眼两点 + 鼻头 + 微笑
  ball(ctx, cx, cy + r * 0.26, r * 0.3, SS_SCENE.hogFace);
  ctx.fillStyle = "#4A3A2C";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx + side * r * 0.14, cy + r * 0.2, r * 0.05, 0, TAU);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.32, r * 0.07, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#4A3A2C";
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.3, r * 0.14, 0.35, Math.PI - 0.35);
  ctx.stroke();
}

/** 小叶子(果子们共用) */
function leaf(ctx: Paint2D, cx: number, cy: number, r: number, angle: number): void {
  ctx.fillStyle = "#7FBF6A";
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.22, r * 0.1, angle, 0, TAU);
  ctx.fill();
}

/** ⑤ 食物 = 自绘小果子:emoji 字符只当「哪一种」的钥匙,画面全是矢量 */
export function paintSnack(ctx: Paint2D, x: number, y: number, cell: number, kind: string, alpha: number): void {
  const { cx, cy, r } = at(x, y, cell);
  ctx.globalAlpha = alpha;
  switch (kind) {
    case "🍓": {
      // 草莓:圆锥身 + 籽点 + 叶冠
      const g = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.1, cx, cy + r * 0.05, r * 0.62);
      g.addColorStop(0, "#FF8E8E");
      g.addColorStop(0.6, "#F26D6D");
      g.addColorStop(1, "#D8404E");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.5, cy - r * 0.18);
      ctx.quadraticCurveTo(cx, cy - r * 0.62, cx + r * 0.5, cy - r * 0.18);
      ctx.quadraticCurveTo(cx + r * 0.42, cy + r * 0.45, cx, cy + r * 0.62);
      ctx.quadraticCurveTo(cx - r * 0.42, cy + r * 0.45, cx - r * 0.5, cy - r * 0.18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#FFE9A8";
      for (const [sx, sy] of [[-0.22, 0.02], [0.18, 0.08], [-0.04, 0.3], [0.3, -0.12], [-0.32, -0.16]] as const) {
        ctx.beginPath();
        ctx.ellipse(cx + sx * r, cy + sy * r, r * 0.045, r * 0.07, 0, 0, TAU);
        ctx.fill();
      }
      leaf(ctx, cx - r * 0.14, cy - r * 0.42, r, -0.5);
      leaf(ctx, cx + r * 0.14, cy - r * 0.42, r, 0.5);
      break;
    }
    case "🍎": {
      ball(ctx, cx, cy + r * 0.05, r * 0.52, "#F26D6D");
      ctx.strokeStyle = "#8A5A38";
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.4);
      ctx.quadraticCurveTo(cx + r * 0.08, cy - r * 0.58, cx + r * 0.16, cy - r * 0.66);
      ctx.stroke();
      leaf(ctx, cx + r * 0.28, cy - r * 0.5, r, 0.6);
      break;
    }
    case "🍇": {
      // 葡萄:六颗小珠品字堆 + 叶
      const spots: ReadonlyArray<readonly [number, number]> = [
        [-0.22, -0.18], [0.22, -0.18], [0, -0.02], [-0.22, 0.18], [0.22, 0.18], [0, 0.36],
      ];
      for (const [gx, gy] of spots) ball(ctx, cx + gx * r, cy + gy * r, r * 0.22, "#B48BD9");
      leaf(ctx, cx, cy - r * 0.44, r, 0);
      break;
    }
    case "🍪": {
      ball(ctx, cx, cy, r * 0.52, "#D9A968");
      ctx.fillStyle = "#8A5A38";
      for (const [gx, gy] of [[-0.2, -0.14], [0.16, -0.02], [-0.06, 0.22], [0.26, 0.2]] as const) {
        ctx.beginPath();
        ctx.arc(cx + gx * r, cy + gy * r, r * 0.09, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case "🧁": {
      // 纸杯蛋糕:裙杯 + 奶油顶 + 樱桃
      ctx.fillStyle = "#F2A8C4";
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.42, cy + r * 0.02);
      ctx.lineTo(cx + r * 0.42, cy + r * 0.02);
      ctx.lineTo(cx + r * 0.3, cy + r * 0.55);
      ctx.lineTo(cx - r * 0.3, cy + r * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = catShade("#F2A8C4", -0.15);
      ctx.lineWidth = 1;
      for (const fxr of [-0.18, 0, 0.18]) {
        ctx.beginPath();
        ctx.moveTo(cx + fxr * r * 1.8, cy + r * 0.06);
        ctx.lineTo(cx + fxr * r * 1.3, cy + r * 0.5);
        ctx.stroke();
      }
      ball(ctx, cx, cy - r * 0.18, r * 0.4, "#FFF3E0");
      ball(ctx, cx, cy - r * 0.52, r * 0.14, "#E85A78");
      break;
    }
    case "✂️": {
      // 剪刀果:两片圆刃 + 双环把手,圆润不扎人
      ctx.fillStyle = "#B9C7D6";
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(cx + side * r * 0.14, cy - r * 0.18, r * 0.42, r * 0.13, side * 0.7, 0, TAU);
        ctx.fill();
      }
      ctx.strokeStyle = SS_SCENE.lockGold;
      ctx.lineWidth = Math.max(1.5, r * 0.1);
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(cx + side * r * 0.2, cy + r * 0.34, r * 0.17, 0, TAU);
        ctx.stroke();
      }
      ctx.fillStyle = "#8898A8";
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.07, 0, TAU);
      ctx.fill();
      break;
    }
    case "⭐":
      paintStar(ctx, x, y, cell, true, 1);
      break;
    default:
      // 兜底:一颗小浆果
      ball(ctx, cx, cy, r * 0.42, "#F28BA8");
      leaf(ctx, cx, cy - r * 0.4, r, 0);
      break;
  }
  ctx.globalAlpha = 1;
}

/** 五角星的十个顶点(奖励星与测试共用) */
export function starPoints(cx: number, cy: number, outer: number, inner: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? outer : inner;
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  return pts;
}

/** ⑤ 奖励 = 自绘五角星 + 光晕(限时快溜走时外面把 alpha 调低就是闪) */
export function paintStar(ctx: Paint2D, x: number, y: number, cell: number, halo: boolean, alpha: number): void {
  const { cx, cy, r } = at(x, y, cell);
  ctx.globalAlpha = alpha;
  if (halo) {
    const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 0.9);
    g.addColorStop(0, "rgba(255,222,120,0.5)");
    g.addColorStop(1, "rgba(255,222,120,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.9, 0, TAU);
    ctx.fill();
  }
  const pts = starPoints(cx, cy + r * 0.02, r * 0.52, r * 0.22);
  const g2 = ctx.createRadialGradient(cx - r * 0.15, cy - r * 0.15, r * 0.05, cx, cy, r * 0.55);
  g2.addColorStop(0, "#FFEFA8");
  g2.addColorStop(0.7, "#FFD86B");
  g2.addColorStop(1, "#E8B03E");
  ctx.fillStyle = g2;
  ctx.beginPath();
  pts.forEach(([px, py], i) => {
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.arc(cx - r * 0.14, cy - r * 0.12, r * 0.08, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}
