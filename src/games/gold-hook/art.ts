/**
 * 金矿钩钩 · 1.3 视觉资产（纯绘制，不碰玩法数值）。
 *
 * 1.2 的矿工是「圆角矩形 + 圆头 + 头盔弧」的准火柴人，钩子是三笔 chevron 线，
 * 绞盘是一个圆角矩形加一个圆 —— 主管点名的反面教材全在这儿。1.3 把这些
 * 核心资产集中到本文件重画，并让每个绘制函数都能拿一个 stub 的 2D context
 * 单独调用，视觉契约写得成测试（见 `art.test.ts`）。
 *
 * 红线（与 `docs/plan-1.3-step12-C-gold-hook.md` 一致）：
 *  - 只画不算：`hookAngle` / `hookTip` / `ropeSag` / `lightRadius`、矿石价值
 *    重量、关卡生成一律不在这里出现，本文件只消费坐标与状态；
 *  - 不做透视：钩子角度是这个玩法唯一要瞄的东西，纵深只靠位移视差与明暗；
 *  - 弱动效（calm）分支必须接入每一个新增动画：静止、不闪、不抖。
 */
import { FIELD_H, FIELD_W, ORES, PIVOT_X, PIVOT_Y, WALL, type Ore } from "./logic";
import { PARALLAX, parallaxOffset } from "./depth12";

const TAU = Math.PI * 2;

type Ctx = CanvasRenderingContext2D;

// ---------------------------------------------------------------------------
// 配色：一章一套粉彩矿洞（结构从 index.ts 挪过来，数值一个没动）
// ---------------------------------------------------------------------------

export interface Palette {
  /** 洞顶的天光 */
  sky0: string;
  /** 洞底的暗处(仍旧是浅色,不要大片深色压着眼睛) */
  sky1: string;
  /** 两侧石壁 */
  wall: string;
  /** 石壁上的矿脉纹路 */
  vein: string;
  /** 地面草皮 */
  ground: string;
  groundDark: string;
}

/** 把 #rrggbb 按比例调暗（远景层用） */
export function shadeHex(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `rgb(${r},${g},${b})`;
}

// ---------------------------------------------------------------------------
// 矿工：朵朵与星星（第一优先修复项）
// ---------------------------------------------------------------------------

export interface CrewSkin {
  name: string;
  /** 头盔主色与暗部（暗部也是帽檐和矿灯座的颜色） */
  helmet: string;
  helmetDark: string;
  /** 工装背带裤的主色与暗部 */
  overalls: string;
  overallsDark: string;
  /** 衬衫（也是手臂的颜色） */
  shirt: string;
  skin: string;
  cheek: string;
  /** 盔沿下露出来的那一撮头发 */
  hair: string;
  /** 圆眼 / 眯眼笑：形状通道，色弱也分得开 */
  eye: "round" | "smile";
  /** 朵朵扎两个小揪揪，剪影通道也不一样 */
  pigtails: boolean;
}

/**
 * 双人差异走「剪影 + 主色 + 配饰」三层：
 * A 朵朵 = 暖黄盔 + 橙背带裤 + 圆眼 + 双揪揪；
 * B 星星 = 天蓝盔 + 青背带裤 + 眯眼笑 + 棕发一撮。
 */
export const CREW_SKINS: readonly [CrewSkin, CrewSkin] = [
  {
    name: "朵朵",
    helmet: "#FFD166",
    helmetDark: "#DFA53C",
    overalls: "#F5915C",
    overallsDark: "#D9713D",
    shirt: "#FF9EC4",
    skin: "#FFE7D6",
    cheek: "#FF9EB4",
    hair: "#4A3628",
    eye: "round",
    pigtails: true,
  },
  {
    name: "星星",
    helmet: "#8FBEF5",
    helmetDark: "#5E90CE",
    overalls: "#55BFA6",
    overallsDark: "#3B9A83",
    shirt: "#A9D3F8",
    skin: "#FFE7D6",
    cheek: "#F5A9A0",
    hair: "#7A4E2B",
    eye: "smile",
    pigtails: false,
  },
];

export type CrewPose = "idle" | "out" | "back" | "heavy" | "cheer";

export interface CrewOpts {
  pose: CrewPose;
  /** 世界钟（秒）：呼吸、眨眼、摇柄、欢呼蹦跳全从它来，暂停即静止 */
  t: number;
  /** 弱动效：整个人静止成持镐站姿，不呼吸不眨眼不摇柄 */
  calm: boolean;
  /** 摇柄进度：收放绳时传绳长，双臂两帧循环跟着绳长走（与收绳速度天然同步） */
  crank?: number;
}

interface Stance {
  /** 上下位移：呼吸起伏 / 欢呼蹦跳（负数往上） */
  bob: number;
  /** 前倾后仰（弧度，绕脚底转，正 = 朝绞盘） */
  lean: number;
  /** 靠绞盘那条手臂的摆角（相对垂直向下，正 = 朝绞盘） */
  armNear: number;
  /** 另一条手臂的摆角（正 = 朝绞盘，负 = 往外甩） */
  armFar: number;
  blink: boolean;
  mouth: "smile" | "grit" | "open";
  /** calm 的持镐站姿 */
  hold: boolean;
  /** 蹬腿的张距（钩到重物时腿要撑开） */
  spread: number;
}

function stanceOf(who: 0 | 1, o: CrewOpts): Stance {
  if (o.calm) {
    // 弱动效：一帧不动的持镐站姿
    return { bob: 0, lean: 0, armNear: 0.55, armFar: -0.2, blink: false, mouth: "smile", hold: true, spread: 0 };
  }
  const t = o.t;
  if (o.pose === "out") {
    // 放绳：身体前倾扶着绳看下去
    return { bob: 0, lean: 0.12, armNear: 1.05, armFar: 0.72, blink: false, mouth: "open", hold: false, spread: 1 };
  }
  if (o.pose === "back") {
    // 收绳：双臂交替摇绞盘摇柄，两帧循环；两位矿工靠 who*7 错开半拍
    const f = Math.floor(((o.crank ?? 0) + who * 7) / 13) % 2;
    return {
      bob: f ? 0.7 : 0,
      lean: 0.06,
      armNear: f ? 1.4 : 0.55,
      armFar: f ? 0.55 : 1.4,
      blink: false,
      mouth: "smile",
      hold: false,
      spread: 0,
    };
  }
  if (o.pose === "heavy") {
    // 钩到重物：后仰蹬腿咬牙，两只手都攥着绳
    return { bob: 0, lean: -0.16, armNear: 1.5, armFar: 1.25, blink: false, mouth: "grit", hold: false, spread: 3 };
  }
  if (o.pose === "cheer") {
    // 宝物入袋：举手欢呼小跳
    const hop = Math.abs(Math.sin(t * 9)) * 1.8;
    return { bob: -hop, lean: 0, armNear: 2.45, armFar: -2.45, blink: false, mouth: "open", hold: false, spread: 1 };
  }
  // 待机：呼吸起伏 + 偶尔眨眼 + 手臂轻轻晃
  const sway = Math.sin(t * 2.4 + who * 1.3) * 0.08;
  return {
    bob: Math.sin(t * 2.4 + who * 1.3) * 1.1,
    lean: 0,
    armNear: 0.16 + sway,
    armFar: -(0.16 + sway),
    blink: ((t + who * 1.7) % 3.4) < 0.14,
    mouth: "smile",
    hold: false,
    spread: 0,
  };
}

/** 一把小镐：木柄 + 弯月双尖镐头（装饰用，也给 calm 的持镐站姿） */
export function drawPickaxe(c: Ctx, x: number, y: number, angle: number): void {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.strokeStyle = "#A5825A";
  c.lineWidth = 2.4;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(0, 9);
  c.lineTo(0, -8);
  c.stroke();
  c.fillStyle = "#9AA7B8";
  c.strokeStyle = "#66727F";
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(-9, -5.5);
  c.quadraticCurveTo(0, -13, 9, -5.5);
  c.quadraticCurveTo(0, -9.2, -9, -5.5);
  c.closePath();
  c.fill();
  c.stroke();
  c.restore();
}

/** 短手：两段圆头短棒 + 一颗小手套（画在身体后面，手从躯干侧面探出来） */
function drawArm(c: Ctx, k: CrewSkin, sx: number, sy: number, ang: number): void {
  const ex = sx + Math.sin(ang) * 4.2;
  const ey = sy + Math.cos(ang) * 4.2;
  const hx = ex + Math.sin(ang * 1.25) * 3.8;
  const hy = ey + Math.cos(ang * 1.25) * 3.8;
  c.strokeStyle = k.shirt;
  c.lineWidth = 3.6;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(sx, sy);
  c.lineTo(ex, ey);
  c.lineTo(hx, hy);
  c.stroke();
  c.fillStyle = k.skin;
  c.beginPath();
  c.arc(hx, hy, 2.1, 0, TAU);
  c.fill();
}

/**
 * 一名矿工。2 头身 Q 版：头盔（高光 + 矿灯）+ 梯形工装背带裤 + 短手短脚 +
 * 名字小木牌。动作系统见 `CrewPose`；`calm` 时整个人是静止的持镐站姿。
 * (x, y) 与 1.2 的火柴人同一基准：头心约在 (x, y-9)，脚底在 y+22。
 */
export function drawCrew(c: Ctx, x: number, y: number, who: 0 | 1, o: CrewOpts): void {
  const k = CREW_SKINS[who];
  /** 朝向绞盘那一侧：0 号站左边脸朝右，1 号站右边脸朝左 */
  const dir = who === 0 ? 1 : -1;
  const s = stanceOf(who, o);

  c.save();

  // 脚下软影
  c.fillStyle = "rgba(120,95,60,.16)";
  c.beginPath();
  c.ellipse(x, y + 22.5, 13, 3, 0, 0, TAU);
  c.fill();

  // 装饰小镐斜靠在外侧；calm 时改拿在手里，这儿就不摆了
  if (!s.hold) drawPickaxe(c, x - dir * 17, y + 15, -dir * 0.5);

  // 身体这一段跟着姿态倾斜（绕脚底转）和呼吸起伏
  c.save();
  c.translate(x, y + 21);
  c.rotate(dir * s.lean);
  c.translate(-x, -(y + 21));
  c.translate(0, s.bob);

  // 短腿 + 小圆鞋（蹬腿时往两边撑）
  c.fillStyle = k.overallsDark;
  c.beginPath();
  c.roundRect(x - 5.2 - s.spread, y + 14, 4.2, 7.5, 2);
  c.roundRect(x + 1 + s.spread, y + 14, 4.2, 7.5, 2);
  c.fill();
  c.fillStyle = "#6B4A2B";
  c.beginPath();
  c.ellipse(x - 3.1 - s.spread, y + 21.4, 3.1, 1.9, 0, 0, TAU);
  c.ellipse(x + 3.1 + s.spread, y + 21.4, 3.1, 1.9, 0, 0, TAU);
  c.fill();

  // 手臂先画，躯干压在肩膀上，手从身侧探出来
  const armY = y + 3.4;
  drawArm(c, k, x + dir * 6.4, armY, dir * s.armNear);
  drawArm(c, k, x - dir * 6.4, armY, dir * s.armFar);
  if (s.hold) drawPickaxe(c, x + dir * 10.5, y + 4.5, dir * 0.5);

  // 衬衫（上半）
  c.fillStyle = k.shirt;
  c.beginPath();
  c.roundRect(x - 7.4, y - 2.5, 14.8, 9, 4);
  c.fill();
  // 工装背带裤：上窄下宽的小梯形，下摆微圆
  c.fillStyle = k.overalls;
  c.beginPath();
  c.moveTo(x - 7, y + 3);
  c.lineTo(x + 7, y + 3);
  c.lineTo(x + 8.8, y + 16.5);
  c.quadraticCurveTo(x, y + 19, x - 8.8, y + 16.5);
  c.closePath();
  c.fill();
  // 胸兜
  c.beginPath();
  c.roundRect(x - 4.4, y - 1.2, 8.8, 6.4, 2);
  c.fill();
  // 两条背带
  c.strokeStyle = k.overalls;
  c.lineWidth = 2.2;
  c.beginPath();
  c.moveTo(x - 3.4, y - 0.6);
  c.lineTo(x - 5.6, y - 3.8);
  c.moveTo(x + 3.4, y - 0.6);
  c.lineTo(x + 5.6, y - 3.8);
  c.stroke();
  // 兜口 + 两颗扣子
  c.fillStyle = k.overallsDark;
  c.beginPath();
  c.roundRect(x - 2.4, y + 1.6, 4.8, 3.2, 1.2);
  c.fill();
  c.beginPath();
  c.arc(x - 3.4, y - 0.4, 1, 0, TAU);
  c.arc(x + 3.4, y - 0.4, 1, 0, TAU);
  c.fill();

  // 头
  const hy = y - 9;
  c.fillStyle = k.skin;
  c.beginPath();
  c.arc(x, hy, 8.2, 0, TAU);
  c.fill();
  if (k.pigtails) {
    // 朵朵的两个小揪揪：从盔沿下面探出来，剪影上和星星一眼能分开
    c.fillStyle = k.hair;
    c.beginPath();
    c.arc(x - 8.6, hy + 1.6, 2.4, 0, TAU);
    c.arc(x + 8.6, hy + 1.6, 2.4, 0, TAU);
    c.fill();
  }
  // 头盔：圆顶 + 帽檐 + 高光 + 朝绞盘那侧的小矿灯
  c.fillStyle = k.helmet;
  c.beginPath();
  c.arc(x, hy - 1.6, 8.8, Math.PI, 0);
  c.closePath();
  c.fill();
  c.fillStyle = k.helmetDark;
  c.beginPath();
  c.roundRect(x - 10.6, hy - 3.2, 21.2, 3, 1.5);
  c.fill();
  // 盔沿下露出来的一撮头发
  c.fillStyle = k.hair;
  c.beginPath();
  c.ellipse(x - dir * 3.6, hy - 0.2, 3.2, 1.5, dir * -0.2, 0, TAU);
  c.fill();
  c.strokeStyle = "rgba(255,255,255,.8)";
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(x - 1.5, hy - 2.8, 6, Math.PI * 1.18, Math.PI * 1.55);
  c.stroke();
  c.fillStyle = k.helmetDark;
  c.beginPath();
  c.arc(x + dir * 5, hy - 6, 2.4, 0, TAU);
  c.fill();
  c.fillStyle = "#FFF9E0";
  c.beginPath();
  c.arc(x + dir * 5, hy - 6, 1.3, 0, TAU);
  c.fill();

  // 脸：A 圆眼会眨，B 眯眯眼常驻笑
  if (k.eye === "round") {
    if (s.blink) {
      c.strokeStyle = "#4A3628";
      c.lineWidth = 1.3;
      c.beginPath();
      c.moveTo(x - 4.6, hy + 1.6);
      c.lineTo(x - 1.8, hy + 1.6);
      c.moveTo(x + 1.8, hy + 1.6);
      c.lineTo(x + 4.6, hy + 1.6);
      c.stroke();
    } else {
      c.fillStyle = "#4A3628";
      c.beginPath();
      c.arc(x - 3.2, hy + 1.4, 1.7, 0, TAU);
      c.arc(x + 3.2, hy + 1.4, 1.7, 0, TAU);
      c.fill();
      c.fillStyle = "#FFFFFF";
      c.beginPath();
      c.arc(x - 2.7, hy + 0.9, 0.6, 0, TAU);
      c.arc(x + 3.7, hy + 0.9, 0.6, 0, TAU);
      c.fill();
    }
  } else {
    c.strokeStyle = "#4A3628";
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(x - 3.2, hy + 2.2, 2, Math.PI * 1.15, Math.PI * 1.85);
    c.stroke();
    c.beginPath();
    c.arc(x + 3.2, hy + 2.2, 2, Math.PI * 1.15, Math.PI * 1.85);
    c.stroke();
  }
  // 腮红
  c.save();
  c.globalAlpha = 0.5;
  c.fillStyle = k.cheek;
  c.beginPath();
  c.ellipse(x - 5.6, hy + 3.8, 1.9, 1.1, 0, 0, TAU);
  c.ellipse(x + 5.6, hy + 3.8, 1.9, 1.1, 0, 0, TAU);
  c.fill();
  c.restore();
  // 嘴：笑 / 咬牙 / 加油张嘴
  if (s.mouth === "grit") {
    c.fillStyle = "#FFFFFF";
    c.beginPath();
    c.roundRect(x - 2.6, hy + 4.4, 5.2, 2.4, 1);
    c.fill();
    c.strokeStyle = "#B96A60";
    c.lineWidth = 0.9;
    c.stroke();
    c.beginPath();
    c.moveTo(x, hy + 4.4);
    c.lineTo(x, hy + 6.8);
    c.stroke();
  } else if (s.mouth === "open") {
    c.fillStyle = "#C9736F";
    c.beginPath();
    c.arc(x, hy + 5, 2.2, 0, Math.PI);
    c.closePath();
    c.fill();
  } else {
    c.strokeStyle = "#C9736F";
    c.lineWidth = 1.4;
    c.beginPath();
    c.arc(x, hy + 3.8, 2.8, Math.PI * 0.15, Math.PI * 0.85);
    c.stroke();
  }
  c.restore(); // 结束倾斜 / 呼吸

  // 名字小木牌（钉在地上，不跟着身体倾斜）
  c.fillStyle = "#CDA06C";
  c.beginPath();
  c.roundRect(x - 14, y + 25, 28, 10, 3);
  c.fill();
  c.strokeStyle = "#9A7647";
  c.lineWidth = 1;
  c.stroke();
  c.fillStyle = "#8A6B45";
  c.beginPath();
  c.arc(x - 10.5, y + 30, 0.9, 0, TAU);
  c.arc(x + 10.5, y + 30, 0.9, 0, TAU);
  c.fill();
  c.fillStyle = "#5E4322";
  c.font = "bold 8.5px system-ui, sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(k.name, x, y + 30.5);

  c.restore();
}

// ---------------------------------------------------------------------------
// 矿石家族（11 种，保留 1.2 的家族设计，加光影与小动作）
// ---------------------------------------------------------------------------

/**
 * 矿石的皮肤。
 *
 * 全都手画成矢量而不是直接甩 emoji:矿洞底色是浅米黄,emoji 在上面又小又糊,
 * 而且换个设备字体一变就认不出来了。自己画能保证「金的是暖黄、石头是冷灰」这条
 * 最要紧的分辨线一直在。
 */
export const ORE_SKIN: Record<Ore["kind"], { fill: string; lit: string; edge: string }> = {
  nugget: { fill: "#FFD264", lit: "#FFF0BC", edge: "#CF9A20" },
  goldSmall: { fill: "#FFC441", lit: "#FFE79A", edge: "#C1880F" },
  goldBig: { fill: "#FFB22C", lit: "#FFDD8C", edge: "#AE7305" },
  goldHuge: { fill: "#FF9F14", lit: "#FFD07A", edge: "#9C6100" },
  // r2 修复 W4R2-07:石头系整体压暗一档(fill 明度 ≤ 金块最深亮停 ÷1.25),
  // 色弱/16px 灰度下金石不再靠猜;石头仍是无彩度的灰褐,金块仍是暖黄
  pebble: { fill: "#A69E8F", lit: "#CCC4B6", edge: "#6E675C" },
  boulder: { fill: "#857E72", lit: "#A9A296", edge: "#57524A" },
  gem: { fill: "#7DDDF0", lit: "#D6F7FF", edge: "#2F97AF" },
  chest: { fill: "#C98C58", lit: "#E7B98C", edge: "#8A5A31" },
  mole: { fill: "#D8A87A", lit: "#F0CFAC", edge: "#A57A4E" },
  // 1.2 新矿:泥泥矿一眼看出「裹着泥」,双层晶用冷紫和钻石区分开
  muddy: { fill: "#A8794F", lit: "#D0A87C", edge: "#6E4A28" },
  twinCrystal: { fill: "#9FA8F0", lit: "#DCE0FF", edge: "#5B63B8" },
};

/** 金块家族:斜向扫光只给它们 */
const GOLD_KINDS = new Set<Ore["kind"]>(["nugget", "goldSmall", "goldBig", "goldHuge"]);

/** 金块 / 石头共用的圆角块 */
function nuggetPath(c: Ctx, x: number, y: number, r: number): void {
  c.beginPath();
  c.roundRect(x - r, y - r * 0.86, r * 2, r * 1.72, r * 0.44);
}

/** 四角小星:金块的闪、图标里的花纹都用它 */
function starPath(c: Ctx, x: number, y: number, s: number): void {
  c.beginPath();
  c.moveTo(x, y - s);
  c.quadraticCurveTo(x + s * 0.18, y - s * 0.18, x + s, y);
  c.quadraticCurveTo(x + s * 0.18, y + s * 0.18, x, y + s);
  c.quadraticCurveTo(x - s * 0.18, y + s * 0.18, x - s, y);
  c.quadraticCurveTo(x - s * 0.18, y - s * 0.18, x, y - s);
  c.closePath();
}

/** 手绘的小问号(被钩住的地鼠头顶那个,不用 emoji 也不用字体字符) */
function questionPath(c: Ctx, x: number, y: number, s: number): void {
  c.beginPath();
  c.arc(x, y, s, Math.PI * 0.9, Math.PI * 2.35);
  c.lineTo(x + s * 0.28, y + s * 1.1);
  c.stroke();
  c.beginPath();
  c.arc(x + s * 0.22, y + s * 2, s * 0.3, 0, TAU);
  c.fill();
}

export interface OreDrawOpts {
  /** 世界钟(秒):扫光、眨眼、挥肢都从它来,暂停即静止 */
  t?: number;
  /** 弱动效:扫光停成静态高光,闪烁恒亮,挥肢不动 */
  calm?: boolean;
  /** 正被钩着拉:宝箱盖微开漏金光、地鼠挥肢冒问号、影子不跟着飞 */
  carried?: boolean;
}

export function drawOre(c: Ctx, ore: Ore, x: number, o: OreDrawOpts = {}): void {
  const r = ore.radius;
  const y = ore.y;
  const skin = ORE_SKIN[ore.kind];
  const t = o.t ?? 0;
  const calm = o.calm === true;
  c.save();
  c.textAlign = "center";
  c.textBaseline = "middle";

  // 影子:让矿石从背景里浮起来一点;被钩着悬在半空时影子不跟着飞
  if (!o.carried) {
    c.fillStyle = "rgba(120,95,60,.18)";
    c.beginPath();
    c.ellipse(x, y + r * 0.92, r * 0.86, r * 0.3, 0, 0, Math.PI * 2);
    c.fill();
  }

  // 体表 2 停线性渐变(lit→fill,左上受光):r2 修复 W4R1-05,
  // 与 duo-arena drawKitCoin 的全产品金币标准对齐;扫光/高光/描边/落影全部保留
  const bodyGrad = c.createLinearGradient(x - r * 0.8, y - r * 0.9, x + r * 0.7, y + r * 0.9);
  bodyGrad.addColorStop(0, skin.lit);
  bodyGrad.addColorStop(1, skin.fill);
  c.fillStyle = bodyGrad;
  c.strokeStyle = skin.edge;
  c.lineWidth = 1.6;

  if (ore.kind === "gem") {
    c.beginPath();
    c.moveTo(x, y - r);
    c.lineTo(x + r * 0.92, y - r * 0.16);
    c.lineTo(x, y + r);
    c.lineTo(x - r * 0.92, y - r * 0.16);
    c.closePath();
    c.fill();
    c.stroke();
    c.strokeStyle = "rgba(255,255,255,.85)";
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(x - r * 0.92, y - r * 0.16);
    c.lineTo(x + r * 0.92, y - r * 0.16);
    c.moveTo(x - r * 0.42, y - r * 0.16);
    c.lineTo(x, y - r);
    c.lineTo(x + r * 0.42, y - r * 0.16);
    c.stroke();
  } else if (ore.kind === "chest") {
    const open = o.carried === true;
    // 箱体(下半)
    c.beginPath();
    c.roundRect(x - r, y - r * 0.18, r * 2, r * 0.98, r * 0.22);
    c.fill();
    c.stroke();
    // 箱盖:被拉着走的时候绕后沿微微翘开
    c.save();
    c.translate(x - r, y - r * 0.14);
    if (open) c.rotate(-0.22);
    c.fillStyle = skin.lit;
    c.beginPath();
    c.roundRect(0, -r * 0.66, r * 2, r * 0.66, r * 0.24);
    c.fill();
    c.stroke();
    c.restore();
    if (open) {
      // 缝里漏出来的那一线金光(calm 时恒亮不闪)
      c.save();
      c.globalAlpha = calm ? 0.8 : 0.55 + 0.35 * Math.sin(t * 8);
      c.fillStyle = "#FFEFA8";
      c.beginPath();
      c.roundRect(x - r * 0.92, y - r * 0.3, r * 1.84, r * 0.2, r * 0.1);
      c.fill();
      c.restore();
    }
    // 锁扣竖带 + 圆锁
    c.fillStyle = "#F4C64A";
    c.fillRect(x - r * 0.18, y - r * 0.16, r * 0.36, r * 0.9);
    c.beginPath();
    c.arc(x, y + r * 0.2, r * 0.24, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = skin.edge;
    c.lineWidth = 1.2;
    c.stroke();
  } else if (ore.kind === "mole") {
    // 两只耳朵先画,才会被脑袋压住一半
    c.beginPath();
    c.arc(x - r * 0.66, y - r * 0.66, r * 0.36, 0, Math.PI * 2);
    c.arc(x + r * 0.66, y - r * 0.66, r * 0.36, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.beginPath();
    c.arc(x, y, r * 0.92, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = skin.lit;
    c.beginPath();
    c.ellipse(x, y + r * 0.3, r * 0.5, r * 0.36, 0, 0, Math.PI * 2);
    c.fill();
    // 待机每 3 秒眨一次眼;被钩住时眼睛瞪圆不眨
    const blink = !o.carried && !calm && ((t + ore.id * 0.9) % 3.1) < 0.16;
    if (blink) {
      c.strokeStyle = "#5A3F2A";
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(x - r * 0.48, y - r * 0.14);
      c.lineTo(x - r * 0.2, y - r * 0.14);
      c.moveTo(x + r * 0.2, y - r * 0.14);
      c.lineTo(x + r * 0.48, y - r * 0.14);
      c.stroke();
      c.fillStyle = "#5A3F2A";
      c.beginPath();
      c.arc(x, y + r * 0.16, r * 0.16, 0, Math.PI * 2);
      c.fill();
    } else {
      c.fillStyle = "#5A3F2A";
      c.beginPath();
      c.arc(x - r * 0.34, y - r * 0.14, r * 0.13, 0, Math.PI * 2);
      c.arc(x + r * 0.34, y - r * 0.14, r * 0.13, 0, Math.PI * 2);
      c.arc(x, y + r * 0.16, r * 0.16, 0, Math.PI * 2);
      c.fill();
    }
    if (o.carried) {
      // 被钩住:四只小短肢两帧交替地挥,头顶冒一个手绘的小问号
      const f = calm ? 0 : Math.floor(t * 7) % 2;
      c.strokeStyle = skin.fill;
      c.lineWidth = 2.6;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(x - r * 0.8, y + r * 0.1);
      c.lineTo(x - r * 1.25, y + (f ? -r * 0.42 : r * 0.5));
      c.moveTo(x + r * 0.8, y + r * 0.1);
      c.lineTo(x + r * 1.25, y + (f ? r * 0.5 : -r * 0.42));
      c.moveTo(x - r * 0.4, y + r * 0.85);
      c.lineTo(x - r * 0.62, y + r * (f ? 1.32 : 1.12));
      c.moveTo(x + r * 0.4, y + r * 0.85);
      c.lineTo(x + r * 0.62, y + r * (f ? 1.12 : 1.32));
      c.stroke();
      c.strokeStyle = "#7A5A2E";
      c.fillStyle = "#7A5A2E";
      c.lineWidth = 1.6;
      c.lineCap = "round";
      questionPath(c, x + r * 0.95, y - r * 1.7, 3);
    }
  } else {
    nuggetPath(c, x, y, r);
    c.fill();
    c.stroke();
    // 左上角一小块高光,金子看着才有光泽;石头也留着,当作被磨亮的一面
    c.fillStyle = skin.lit;
    c.beginPath();
    c.ellipse(x - r * 0.3, y - r * 0.34, r * 0.36, r * 0.22, -0.5, 0, Math.PI * 2);
    c.fill();
    if (GOLD_KINDS.has(ore.kind)) {
      // 金块的斜向扫光:每 2 秒出头扫一趟;calm 时停成一道静态斜高光
      const ph = calm ? 0.55 : ((t * 0.45 + ore.id * 0.37) % 1);
      if (calm || ph < 0.42) {
        const q = calm ? 0.5 : ph / 0.42;
        const bx = x - r * 1.6 + q * r * 3.2;
        c.save();
        nuggetPath(c, x, y, r);
        c.clip();
        c.globalAlpha = 0.5;
        c.fillStyle = "#FFFFFF";
        c.beginPath();
        c.moveTo(bx - r * 0.26, y + r);
        c.lineTo(bx + r * 0.26, y + r);
        c.lineTo(bx + r * 0.26 + r * 0.7, y - r);
        c.lineTo(bx - r * 0.26 + r * 0.7, y - r);
        c.closePath();
        c.fill();
        c.restore();
      }
    }
    if (ore.kind === "goldHuge") {
      // 巨型金块再压一道分层的纹,免得和大金块只差个头
      c.strokeStyle = skin.edge;
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(x - r * 0.72, y + r * 0.24);
      c.lineTo(x + r * 0.72, y + r * 0.24);
      c.stroke();
      // 顶上两粒小星闪(calm 时恒亮)
      c.save();
      c.fillStyle = "#FFFDF0";
      c.globalAlpha = calm ? 0.9 : 0.5 + 0.45 * Math.sin(t * 3 + ore.id);
      starPath(c, x - r * 0.5, y - r * 0.95, r * 0.2);
      c.fill();
      c.globalAlpha = calm ? 0.9 : 0.5 + 0.45 * Math.sin(t * 3 + ore.id + 2.1);
      starPath(c, x + r * 0.62, y - r * 0.7, r * 0.14);
      c.fill();
      c.restore();
    }
    if (ore.kind === "muddy") {
      // 泥壳:两坨深泥 + 一滴往下淌的泥点,一眼看出「裹着泥」
      c.fillStyle = "#8A5F35";
      c.beginPath();
      c.ellipse(x - r * 0.32, y - r * 0.18, r * 0.42, r * 0.3, -0.4, 0, Math.PI * 2);
      c.ellipse(x + r * 0.4, y + r * 0.26, r * 0.34, r * 0.26, 0.3, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(x - r * 0.08, y + r * 0.7, r * 0.12, r * 0.2, 0, 0, Math.PI * 2);
      c.fill();
    }
    if (ore.kind === "twinCrystal") {
      // 「有两层」要看得出来:里圈再描一道壳线,再来两道内部折光
      c.strokeStyle = "rgba(255,255,255,.65)";
      c.lineWidth = 1.1;
      nuggetPath(c, x, y, r * 0.72);
      c.stroke();
      c.beginPath();
      c.moveTo(x - r * 0.5, y + r * 0.52);
      c.lineTo(x + r * 0.08, y - r * 0.6);
      c.moveTo(x - r * 0.05, y + r * 0.6);
      c.lineTo(x + r * 0.5, y - r * 0.4);
      c.stroke();
    }
    if (!ORES[ore.kind].treasure) {
      // 石头补两个坑,一眼看出来是不值钱的那种
      c.fillStyle = skin.edge;
      c.beginPath();
      c.arc(x + r * 0.32, y + r * 0.2, r * 0.16, 0, Math.PI * 2);
      c.arc(x - r * 0.42, y + r * 0.34, r * 0.11, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.restore();
}

// ---------------------------------------------------------------------------
// 矿洞场景:三层视差内容、侧壁矿脉、地面草皮
// ---------------------------------------------------------------------------

/**
 * 矿洞纵深:近岩壁 / 中矿层 / 远洞穴三层,跟着钩子放绳的长度错位挪动。
 * **只有位移与明暗,没有透视** —— 钩子角度是这个玩法唯一要瞄的东西,一透视就瞄不准了。
 * 1.3 只升级每一层的**内容**:远层钟乳石剪影、中层矿脉晶体、近层岩壁凹凸,
 * `parallaxOffset` 的错位数学一个字没动。
 */
export function drawParallax(c: Ctx, pal: Palette, ropeLen: number): void {
  for (let i = PARALLAX.length - 1; i >= 0; i--) {
    const spec = PARALLAX[i];
    const dy = parallaxOffset(spec.layer, ropeLen);
    c.save();
    c.globalAlpha = 0.16 + i * 0.05;
    c.fillStyle = shadeHex(pal.wall, spec.shade);
    if (spec.layer === "cavern") {
      // 远洞穴:顶上垂下来的钟乳石剪影 + 一座圆顶石丘,一组一组往下重复
      for (let y0 = 118 - dy; y0 < FIELD_H; y0 += 190) {
        for (let k = 0; k < 4; k++) {
          const sx = 70 + k * 88;
          const len = 26 + ((k * 37) % 22);
          c.beginPath();
          c.moveTo(sx - 12, y0);
          c.quadraticCurveTo(sx - 3, y0 + len * 0.7, sx, y0 + len);
          c.quadraticCurveTo(sx + 3, y0 + len * 0.7, sx + 12, y0);
          c.closePath();
          c.fill();
        }
        c.beginPath();
        c.ellipse(FIELD_W / 2, y0 + 158, 92, 26, 0, 0, TAU);
        c.fill();
      }
    } else if (spec.layer === "seam") {
      // 中矿层:嵌在岩里的小晶体,菱形加一圈更淡的光晕,像是微弱自发光
      for (let y0 = 150 - dy; y0 < FIELD_H; y0 += 132) {
        for (let k = 0; k < 5; k++) {
          const sx = 58 + ((k * 83 + 31) % 344);
          const sy = y0 + ((k * 57) % 70);
          const s = 4 + (k % 3) * 1.5;
          c.save();
          c.globalAlpha = 0.28;
          c.fillStyle = "#FFFFFF";
          c.beginPath();
          c.moveTo(sx, sy - s * 1.7);
          c.lineTo(sx + s * 1.3, sy);
          c.lineTo(sx, sy + s * 1.7);
          c.lineTo(sx - s * 1.3, sy);
          c.closePath();
          c.fill();
          c.restore();
          c.beginPath();
          c.moveTo(sx, sy - s);
          c.lineTo(sx + s * 0.76, sy);
          c.lineTo(sx, sy + s);
          c.lineTo(sx - s * 0.76, sy);
          c.closePath();
          c.fill();
        }
      }
    } else {
      // 近岩壁:两侧探出来的不规则岩台,左右错开半格
      for (let y0 = 126 - dy; y0 < FIELD_H; y0 += 108) {
        c.beginPath();
        c.moveTo(WALL, y0);
        c.quadraticCurveTo(WALL + 20, y0 + 6, WALL + 14, y0 + 16);
        c.quadraticCurveTo(WALL + 24, y0 + 24, WALL, y0 + 34);
        c.closePath();
        c.fill();
        const ry = y0 + 54;
        c.beginPath();
        c.moveTo(FIELD_W - WALL, ry);
        c.quadraticCurveTo(FIELD_W - WALL - 20, ry + 6, FIELD_W - WALL - 14, ry + 16);
        c.quadraticCurveTo(FIELD_W - WALL - 24, ry + 24, FIELD_W - WALL, ry + 34);
        c.closePath();
        c.fill();
      }
    }
    c.restore();
  }
}

/** 两侧石壁:斜向的矿脉曲线代替 1.2 的等距横杠,再嵌几粒小金点和小晶体 */
export function drawWalls(c: Ctx, pal: Palette): void {
  c.save();
  c.fillStyle = pal.wall;
  c.fillRect(0, 96, WALL, FIELD_H - 96);
  c.fillRect(FIELD_W - WALL, 96, WALL, FIELD_H - 96);
  // 斜向矿脉:一条弯弯的脉络从壁里斜着淌下去
  c.strokeStyle = pal.vein;
  c.lineWidth = 3;
  c.lineCap = "round";
  for (const side of [0, 1]) {
    const bx = side === 0 ? 0 : FIELD_W - WALL;
    for (let y = 116; y < FIELD_H - 40; y += 74) {
      const yy = y + side * 34;
      c.beginPath();
      c.moveTo(bx + 3, yy);
      c.quadraticCurveTo(bx + WALL * 0.72, yy + 22, bx + 4, yy + 46);
      c.stroke();
    }
  }
  // 嵌在壁里的小金点
  c.fillStyle = "#FFD264";
  for (let y = 150; y < FIELD_H - 20; y += 96) {
    c.beginPath();
    c.arc(WALL * 0.45, y, 2.2, 0, TAU);
    c.arc(FIELD_W - WALL * 0.45, y + 48, 2.2, 0, TAU);
    c.fill();
  }
  // 两粒小晶体
  c.fillStyle = "#BFEAF2";
  for (const [cx, cy] of [
    [WALL * 0.5, 262],
    [FIELD_W - WALL * 0.5, 214],
  ]) {
    c.beginPath();
    c.moveTo(cx, cy - 4);
    c.lineTo(cx + 3, cy);
    c.lineTo(cx, cy + 4);
    c.lineTo(cx - 3, cy);
    c.closePath();
    c.fill();
  }
  c.restore();
}

/** 地面草皮:两条色带之上,加一排小草和几粒碎石 */
/* ---------------- r2(B档TOP5):地表天空的主题物与慢云 ---------------- */

/** 章节天空主题物:暖章太阳 / 冷章月牙 / 蓝紫章三粒闪星(按调色板下标查表,确定性) */
export type SkyDecorKind = "sun" | "moon" | "stars";

export function skyDecorKind(chapter: number): SkyDecorKind {
  const i = ((chapter % 8) + 8) % 8;
  if (i === 0 || i === 3) return "sun"; // 奶油金 / 蜜桃橙:暖
  if (i === 1 || i === 4) return "moon"; // 青碧 / 水青:冷
  return "stars"; // 蓝 / 紫系
}

/**
 * 地表天空区的一件主题物 + 两朵三瓣慢云。
 * 矿洞下面三层视差热热闹闹,地表却光秃秃——这里补上「头顶那口气」。
 * 云 6px/s 慢漂(镜头不动,不需要视差);calm 时全部定格。
 */
export function drawSkyDecor(c: Ctx, pal: Palette, chapter: number, t: number, calm: boolean): void {
  const kind = skyDecorKind(chapter);
  const x = FIELD_W * 0.82;
  const y = 38;
  const r = FIELD_W * 0.045;
  c.save();
  if (kind === "sun") {
    // 太阳:径向光晕 + 圆面
    const halo = c.createRadialGradient(x, y, r * 0.4, x, y, r * 2.2);
    halo.addColorStop(0, "rgba(255,214,110,.5)");
    halo.addColorStop(1, "rgba(255,214,110,0)");
    c.fillStyle = halo;
    c.beginPath();
    c.arc(x, y, r * 2.2, 0, TAU);
    c.fill();
    c.fillStyle = "#FFD87A";
    c.strokeStyle = "#E8B54A";
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
    c.stroke();
  } else if (kind === "moon") {
    // 月牙:双圆相减(亮圆上盖一枚天色圆)
    c.fillStyle = "#FFF3C2";
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
    c.fillStyle = pal.sky0;
    c.beginPath();
    c.arc(x + r * 0.42, y - r * 0.3, r * 0.86, 0, TAU);
    c.fill();
  } else {
    // 三粒闪星:大小两档,错落着放
    c.fillStyle = "#FFFDF0";
    c.globalAlpha = 0.95;
    starPath(c, x, y - 6, r * 0.42);
    c.fill();
    starPath(c, x - r * 1.4, y + r * 0.7, r * 0.28);
    c.fill();
    starPath(c, x + r * 1.2, y + r * 0.9, r * 0.22);
    c.fill();
    c.globalAlpha = 1;
  }
  // 两朵三瓣慢云(同 duo-rush drawCloudPuff 规格,透明度 0.5)
  c.globalAlpha = 0.5;
  c.fillStyle = "#FFFFFF";
  for (const [seed, cy, s] of [
    [86, 24, 1],
    [312, 46, 0.78],
  ] as const) {
    const cx = ((seed + (calm ? 0 : t * 6)) % (FIELD_W + 80)) - 40;
    for (const [dx, dy, cr] of [
      [0, -2 * s, 10 * s],
      [-10 * s, 3 * s, 7.5 * s],
      [10 * s, 3 * s, 7.5 * s],
    ] as const) {
      c.beginPath();
      c.arc(cx + dx, cy + dy, cr, 0, TAU);
      c.fill();
    }
  }
  c.restore();
}

export function drawGround(c: Ctx, pal: Palette): void {
  c.save();
  c.fillStyle = pal.ground;
  c.fillRect(0, 74, FIELD_W, 26);
  c.fillStyle = pal.groundDark;
  c.fillRect(0, 96, FIELD_W, 6);
  // 草皮边:地表探出来的小草芽
  for (let gx = 10; gx < FIELD_W; gx += 34) {
    c.beginPath();
    c.moveTo(gx, 74.5);
    c.quadraticCurveTo(gx + 3, 66, gx + 6, 74.5);
    c.closePath();
    c.fill();
  }
  // 地面上的碎石粒
  c.fillStyle = shadeHex(pal.ground, 0.82);
  for (let gx = 26; gx < FIELD_W; gx += 58) {
    c.beginPath();
    c.ellipse(gx, 88 + (gx % 3) * 2.5, 3, 1.8, 0, 0, TAU);
    c.fill();
  }
  c.restore();
}

// ---------------------------------------------------------------------------
// 绞盘与钩子（灵魂道具）
// ---------------------------------------------------------------------------

export interface WinchOpts {
  /** 摇柄的旋转角（弧度）。收放绳时跟着绳长走，calm 时传个定值就是静止 */
  spin: number;
  /** 卷筒上缠了多少绳（0–1）：收得越短缠得越多，筒面的绳圈跟着变多 */
  wraps: number;
}

/** 绞盘：三角木架 + 深色卷筒（缠绳圈随收绳增多）+ 会转的侧面摇柄 */
export function drawWinch(c: Ctx, x: number, y: number, o: WinchOpts): void {
  c.save();
  // 三角木架
  c.strokeStyle = "#8A6B45";
  c.lineWidth = 3.5;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(x - 13, y + 15);
  c.lineTo(x, y);
  c.moveTo(x + 13, y + 15);
  c.lineTo(x, y);
  c.stroke();
  // 底座踏板
  c.fillStyle = "#A5825A";
  c.beginPath();
  c.roundRect(x - 17, y + 13, 34, 5, 2.5);
  c.fill();
  // 卷筒
  c.fillStyle = "#7C5F3E";
  c.strokeStyle = "#5E462B";
  c.lineWidth = 1.4;
  c.beginPath();
  c.arc(x, y, 7, 0, TAU);
  c.fill();
  c.stroke();
  // 筒面缠着的绳：圈数随收绳增多（1–3 圈）
  const coils = 1 + Math.round(Math.max(0, Math.min(1, o.wraps)) * 2);
  c.strokeStyle = "#C9A96E";
  c.lineWidth = 1.2;
  for (let i = 0; i < coils; i++) {
    c.beginPath();
    c.arc(x, y, 5.4 - i * 1.8, 0, TAU);
    c.stroke();
  }
  // 轴心
  c.fillStyle = "#3F2E1B";
  c.beginPath();
  c.arc(x, y, 1.8, 0, TAU);
  c.fill();
  // 摇柄：柄臂 + 圆握把，跟着 spin 转
  const hx = x + Math.cos(o.spin) * 10;
  const hy = y + Math.sin(o.spin) * 10;
  c.strokeStyle = "#6B4A22";
  c.lineWidth = 2.6;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(hx, hy);
  c.stroke();
  c.fillStyle = "#A5825A";
  c.strokeStyle = "#6B4A22";
  c.lineWidth = 1;
  c.beginPath();
  c.arc(hx, hy, 2.6, 0, TAU);
  c.fill();
  c.stroke();
  c.restore();
}

export interface HookOpts {
  /** 空钩张开，钩中咬合 */
  open: boolean;
  /** 钩中那一瞬的白闪（calm 时调用方不要传 true） */
  flash: boolean;
}

/**
 * 锚形双爪钩，画在原点（调用方先 translate 到钩尖、rotate 到绳的角度）。
 * 实心填充 + 深色描边 + 内侧高光 —— 不再是三笔线。
 */
export function drawHook(c: Ctx, o: HookOpts): void {
  const sp = o.open ? 1 : 0.66;
  c.save();
  c.fillStyle = "#B9C2D4";
  c.strokeStyle = "#5F6B7E";
  c.lineWidth = 1.3;
  // 挂环
  c.beginPath();
  c.arc(0, -3.6, 2.6, 0, TAU);
  c.stroke();
  // 柄
  c.beginPath();
  c.roundRect(-1.7, -2.6, 3.4, 6.2, 1.5);
  c.fill();
  c.stroke();
  // 左右两只锚形爪：外缘甩到爪尖，内缘收回来，围成实心的月牙
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(0, 1.4);
    c.quadraticCurveTo(s * 10 * sp, 5.6, s * 8.4 * sp, -4.2);
    c.quadraticCurveTo(s * 6.6 * sp, 0.6, s * 2.2, 2.2);
    c.closePath();
    c.fill();
    c.stroke();
  }
  // 内侧高光
  c.strokeStyle = "rgba(255,255,255,.75)";
  c.lineWidth = 1;
  c.beginPath();
  c.arc(-3.4 * sp, 1.6, 3.4, Math.PI * 0.55, Math.PI * 1.05);
  c.stroke();
  // 钩中那一下的白闪
  if (o.flash) {
    c.globalAlpha = 0.55;
    c.fillStyle = "#FFFFFF";
    c.beginPath();
    c.arc(0, 1, 9.5, 0, TAU);
    c.fill();
  }
  c.restore();
}

// ---------------------------------------------------------------------------
// HUD 图标:全部矢量手绘,顶掉 1.2 的 💰🎯⏳💪🍀💥 emoji 芯片
// ---------------------------------------------------------------------------

export type IconKind = "coin" | "target" | "hourglass" | "arm" | "clover" | "bomb" | "bag";

/**
 * 在 [0, s]² 的方块里画一枚图标。调用方自己建 canvas(2 倍尺寸防糊)。
 * emoji 换成手绘的理由和矿石一样:换台设备字体一变就认不出来,
 * 而且 14px 的 emoji 在浅米黄底上糊成一团。
 */
export function drawIcon(c: Ctx, kind: IconKind, s: number): void {
  const m = s / 2;
  c.save();
  if (kind === "coin") {
    // 金币:金渐变圆 + 边缘厚度 + 内环 + 中心小星
    const g = c.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, "#FFE9A8");
    g.addColorStop(1, "#F0A93C");
    c.fillStyle = g;
    c.beginPath();
    c.arc(m, m, m - 0.8, 0, TAU);
    c.fill();
    c.strokeStyle = "#C98A1E";
    c.lineWidth = 1.2;
    c.stroke();
    c.strokeStyle = "rgba(255,255,255,.85)";
    c.lineWidth = 1;
    c.beginPath();
    c.arc(m, m, m - 3.2, 0, TAU);
    c.stroke();
    c.fillStyle = "#FFF6D8";
    starPath(c, m, m, s * 0.2);
    c.fill();
  } else if (kind === "target") {
    // 目标:同心圆靶
    c.fillStyle = "#FFE3E0";
    c.beginPath();
    c.arc(m, m, m - 0.8, 0, TAU);
    c.fill();
    c.strokeStyle = "#E4766B";
    c.lineWidth = 1.2;
    c.stroke();
    c.beginPath();
    c.arc(m, m, m - 4, 0, TAU);
    c.stroke();
    c.fillStyle = "#E4766B";
    c.beginPath();
    c.arc(m, m, 1.8, 0, TAU);
    c.fill();
  } else if (kind === "hourglass") {
    // 沙漏:上下两撮沙 + 木框
    c.fillStyle = "#FFD98A";
    c.beginPath();
    c.moveTo(3.2, 3.6);
    c.lineTo(s - 3.2, 3.6);
    c.lineTo(m, m);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(3.2, s - 3.6);
    c.lineTo(s - 3.2, s - 3.6);
    c.lineTo(m, m);
    c.closePath();
    c.fill();
    c.strokeStyle = "#B98A3C";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(3.2, 3.6);
    c.lineTo(s - 3.2, s - 3.6);
    c.moveTo(s - 3.2, 3.6);
    c.lineTo(3.2, s - 3.6);
    c.stroke();
    c.fillStyle = "#8A6B45";
    c.beginPath();
    c.roundRect(2.2, 1.4, s - 4.4, 2.2, 1.1);
    c.roundRect(2.2, s - 3.6, s - 4.4, 2.2, 1.1);
    c.fill();
  } else if (kind === "arm") {
    // 力量:弯举的小手臂剪影(前臂上举 + 鼓起来的二头肌 + 小拳头)
    c.strokeStyle = "#E08A5E";
    c.lineWidth = 3.4;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(2.6, s - 3);
    c.lineTo(s * 0.6, s * 0.62);
    c.lineTo(s * 0.66, s * 0.26);
    c.stroke();
    c.fillStyle = "#E08A5E";
    c.beginPath();
    c.ellipse(s * 0.42, s * 0.68, s * 0.2, s * 0.15, -0.6, 0, TAU);
    c.fill();
    c.fillStyle = "#F5B896";
    c.beginPath();
    c.arc(s * 0.68, s * 0.22, s * 0.15, 0, TAU);
    c.fill();
  } else if (kind === "clover") {
    // 幸运:四叶草
    c.fillStyle = "#7CC576";
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      c.beginPath();
      c.ellipse(m + Math.cos(a) * s * 0.2, m - 1 + Math.sin(a) * s * 0.2, s * 0.19, s * 0.14, a, 0, TAU);
      c.fill();
    }
    c.strokeStyle = "#5B9E57";
    c.lineWidth = 1.2;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(m, m + 1);
    c.quadraticCurveTo(m + 1, s - 3, m + 2.6, s - 1.6);
    c.stroke();
    c.fillStyle = "#A8DCA2";
    c.beginPath();
    c.arc(m, m - 1, 1, 0, TAU);
    c.fill();
  } else if (kind === "bomb") {
    // 炸药:圆炸弹 + 引信 + 一粒星火(没有火焰,口径和彩纸一致)
    c.fillStyle = "#5E6470";
    c.beginPath();
    c.arc(m, m + 1.2, m - 2.6, 0, TAU);
    c.fill();
    c.fillStyle = "rgba(255,255,255,.45)";
    c.beginPath();
    c.ellipse(m - 2, m - 0.6, 2, 1.2, -0.6, 0, TAU);
    c.fill();
    c.strokeStyle = "#8A6B45";
    c.lineWidth = 1.4;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(m + 1, m - 2.4);
    c.quadraticCurveTo(m + 3, 2.6, s - 3, 2.8);
    c.stroke();
    c.fillStyle = "#FFD166";
    starPath(c, s - 2.6, 2.4, 1.8);
    c.fill();
  } else {
    // 钱袋:鼓鼓的布袋 + 扎口 + 袋面一枚小金币
    c.fillStyle = "#C98C58";
    c.beginPath();
    c.moveTo(m - 2.4, s * 0.24);
    c.quadraticCurveTo(2, s * 0.5, s * 0.2, s * 0.86);
    c.quadraticCurveTo(m, s + 1, s * 0.8, s * 0.86);
    c.quadraticCurveTo(s - 2, s * 0.5, m + 2.4, s * 0.24);
    c.closePath();
    c.fill();
    c.strokeStyle = "#8A5A31";
    c.lineWidth = 1;
    c.stroke();
    // 扎口
    c.fillStyle = "#E7B98C";
    c.beginPath();
    c.roundRect(m - 3.2, s * 0.14, 6.4, s * 0.14, 1.4);
    c.fill();
    // 袋面小金币
    c.fillStyle = "#FFD264";
    c.beginPath();
    c.arc(m, s * 0.62, s * 0.15, 0, TAU);
    c.fill();
    c.strokeStyle = "#C98A1E";
    c.lineWidth = 0.9;
    c.stroke();
  }
  c.restore();
}

/**
 * 绳子。空钩绷直、钩着东西中段下垂的贝塞尔逻辑原样保留（垂度由调用方拿
 * `ropeSag` 算好传进来）；1.3 在主线上叠一条错位的浅色短划线，读作麻绳绞纹。
 */
export function drawRope(c: Ctx, tip: { x: number; y: number }, sag: number): void {
  const path = (): void => {
    c.beginPath();
    c.moveTo(PIVOT_X, PIVOT_Y);
    if (sag <= 0.2) {
      c.lineTo(tip.x, tip.y);
    } else {
      // 二次贝塞尔:控制点放在两端中点再往下推 2 倍垂度,曲线中点正好垂 sag
      const mx = (PIVOT_X + tip.x) / 2;
      const my = (PIVOT_Y + tip.y) / 2;
      c.quadraticCurveTo(mx, my + sag * 2, tip.x, tip.y);
    }
  };
  c.save();
  c.lineCap = "round";
  c.strokeStyle = "#8A6B45";
  c.lineWidth = 2.6;
  path();
  c.stroke();
  c.strokeStyle = "#D9BC8C";
  c.lineWidth = 1;
  c.setLineDash([2.5, 3.5]);
  path();
  c.stroke();
  c.restore();
}
