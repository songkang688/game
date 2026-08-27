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
