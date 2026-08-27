/**
 * 朵星格斗王 —— 1.3 视觉资产库（纯函数，零 DOM、零随机、零玩法数字）。
 *
 * 这里放的全是"怎么画"：
 *  · 八位小伙伴的行头（发型 / 头饰 / 双色服装 / 腰带 / 拳套色 / 披挂件），剪影两两可辨；
 *  · 五款表情（平常 / 出招咬牙 / 被打中 >< / 眩晕螺旋眼 / 获胜大笑）按状态查表；
 *  · 命中火花三档（轻招 4 根短线 / 重招 8 根加星形爆点 / 破防盾碎六片）；
 *  · 四层视差（远天 / 远山 / 近景 / 前景轻粒子）与四套舞台主题 + 地面纵深三条带；
 *  · 超必杀 cut-in 的竖条底、斜向速度线、角色特写与入场白闪；
 *  · HUD 头像、回合星、能量满槽流光，以及 P1/P2 的脚下光环 + 头顶标记双通道；
 *  · 姿态查表、影子缩放、倒地小弹跳、残影、扬尘、彩带、连击弹跳等小演出。
 *
 * 减弱动效（reduced）的口径是「静态、不消失」：视差画一帧不动、残影 / 流光 / 白闪
 * 直接关掉、弹跳类全部回到 1 倍，任何一层都不会整个不见。
 *
 * 判定、帧数、胜负全都不在这儿 —— 引擎照旧只认 `rules.ts` / `frames.ts` 的数字。
 */

/* ------------------------------------------------------------------ */
/* 通用小工具                                                          */
/* ------------------------------------------------------------------ */

type Ctx = CanvasRenderingContext2D;

/** 圆角矩形路径（不 fill 不 stroke，交给调用方） */
function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const c = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.quadraticCurveTo(x + w, y + h, x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.quadraticCurveTo(x, y, x + c, y);
  ctx.closePath();
}

/** 确定性伪随机（0..1）：装饰物摆位用它，测试才能钉得住 */
export function jitter(i: number): number {
  const v = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/** 五角星路径 */
export function starPath(ctx: Ctx, cx: number, cy: number, r: number, rot = -Math.PI / 2): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = rot + (Math.PI * i) / 5;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** 实心小星星（眩晕圈、火花爆点都用它，不再用字符占位） */
export function drawStarShape(ctx: Ctx, cx: number, cy: number, r: number, color: string, rot = -Math.PI / 2): void {
  ctx.save();
  ctx.fillStyle = color;
  starPath(ctx, cx, cy, r, rot);
  ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* 一、行头：八位小伙伴各有各的                                        */
/* ------------------------------------------------------------------ */

/** 头饰款式（剪影差异的主通道，八款互不重样） */
export type HeadgearKind =
  | "petal" // 朵朵：侧边一朵五瓣小花
  | "starclip" // 星星：星形发卡
  | "dango" // 糯糯：头顶三团小丸子
  | "cloudtuft" // 云云：三团云朵呆毛
  | "pandaears" // 墩墩：一对圆耳朵
  | "boltcrest" // 闪闪：闪电呆毛
  | "sproutleaf" // 绿绿豆：一茎双叶小豆芽
  | "chickcrest"; // 啾啾：三根呆毛 + 小尖嘴

/** 披挂件：短裙 / 披风（跳起来展开）/ 围巾 / 腰间飘带 / 无 */
export type ExtraKind = "skirt" | "cape" | "scarf" | "sash" | "none";

export interface HeroLook {
  headgear: HeadgearKind;
  /** 上衣色 */
  top: string;
  /** 下装色 */
  bottom: string;
  /** 腰带色 */
  belt: string;
  /** 拳套 / 鞋头亮色端点 */
  glove: string;
  /** 披挂件 */
  extra: ExtraKind;
  /** 头饰主色 */
  gear: string;
  /** 头饰深色细节 */
  gearDark: string;
}

/** 八位小伙伴的行头查表（纯外观，判定框一个数都不碰） */
export const HERO_LOOKS: Record<string, HeroLook> = {
  duoduo: {
    headgear: "petal",
    top: "#ffd3e3",
    bottom: "#e989b4",
    belt: "#b24a78",
    glove: "#fff1f6",
    extra: "skirt",
    gear: "#ff9fc4",
    gearDark: "#ffe36e"
  },
  xingxing: {
    headgear: "starclip",
    top: "#cfe0ff",
    bottom: "#7d9bd8",
    belt: "#3a62a8",
    glove: "#fff8d6",
    extra: "cape",
    gear: "#ffd75e",
    gearDark: "#e8a52c"
  },
  nuonuo: {
    headgear: "dango",
    top: "#ffedd6",
    bottom: "#e3b378",
    belt: "#a9702c",
    glove: "#fff6ea",
    extra: "scarf",
    gear: "#f7c8d8",
    gearDark: "#a9702c"
  },
  yunyun: {
    headgear: "cloudtuft",
    top: "#e8efff",
    bottom: "#a9bbe8",
    belt: "#5a6ea8",
    glove: "#ffffff",
    extra: "sash",
    gear: "#ffffff",
    gearDark: "#8fa3d8"
  },
  dundun: {
    headgear: "pandaears",
    top: "#f4f4fa",
    bottom: "#8b8ba3",
    belt: "#4b4b60",
    glove: "#dcdcec",
    extra: "none",
    gear: "#4b4b60",
    gearDark: "#8b8ba3"
  },
  shanshan: {
    headgear: "boltcrest",
    top: "#fff5cc",
    bottom: "#ecc94e",
    belt: "#a87a16",
    glove: "#fffdf0",
    extra: "sash",
    gear: "#ffdf5e",
    gearDark: "#a87a16"
  },
  lvlvdou: {
    headgear: "sproutleaf",
    top: "#e2f6d2",
    bottom: "#93c46e",
    belt: "#4c7a2a",
    glove: "#f2fbe8",
    extra: "skirt",
    gear: "#7fbd52",
    gearDark: "#4c7a2a"
  },
  jiujiu: {
    headgear: "chickcrest",
    top: "#fff1c2",
    bottom: "#eeb94e",
    belt: "#b8862a",
    glove: "#fffae6",
    extra: "cape",
    gear: "#f5a83c",
    gearDark: "#b8862a"
  }
};

/** 按角色 id 取行头，认不出的一律给朵朵那套（永不 undefined） */
export function lookOf(charId: string): HeroLook {
  return HERO_LOOKS[charId] ?? HERO_LOOKS.duoduo;
}

/**
 * 一帧的角色几何：渲染层把骨架算好塞进来，这边只管往上叠行头。
 * 全部是画布坐标（y 向下为正），和 `drawFighter` 里现算的量一一对应。
 */
export interface FighterFrame {
  /** 脚底中心 x */
  x: number;
  /** 脚底 y */
  feet: number;
  /** 身体半宽 */
  hw: number;
  /** 当前身高（蹲下会矮） */
  h: number;
  /** 头顶 y */
  bodyTop: number;
  /** 胯 y（躯干画到这儿，往下是腿） */
  hipY: number;
  /** 肩 y */
  shoulderY: number;
  /** 头心 x / y / 半径 */
  headX: number;
  headY: number;
  headR: number;
  facing: 1 | -1;
  /** 走路步幅摆动量（±） */
  stride: number;
  airborne: boolean;
  crouch: boolean;
  /** 全局帧号（动画相位） */
  tick: number;
  reduced: boolean;
}

/** 背面披挂：披风 / 围巾尾 / 飘带画在躯干后面，得先于身体调用 */
export function drawBackGear(ctx: Ctx, fr: FighterFrame, look: HeroLook): void {
  const back = -fr.facing;
  ctx.save();
  if (look.extra === "cape") {
    // 披风：平时贴背，跳起来展开
    const spread = fr.airborne ? 1.7 : 1;
    const sway = fr.reduced ? 0 : Math.sin(fr.tick * 0.11) * 2;
    ctx.fillStyle = look.bottom;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(fr.x + back * fr.hw * 0.3, fr.shoulderY);
    ctx.quadraticCurveTo(
      fr.x + back * fr.hw * (1.3 * spread) + sway,
      (fr.shoulderY + fr.hipY) / 2,
      fr.x + back * fr.hw * (1.1 * spread) + sway,
      fr.hipY + fr.h * (fr.airborne ? 0.02 : 0.1)
    );
    ctx.lineTo(fr.x + back * fr.hw * 0.2, fr.hipY);
    ctx.closePath();
    ctx.fill();
  } else if (look.extra === "scarf") {
    // 围巾尾：一小段从脖子后面垂下来
    ctx.fillStyle = look.gear;
    rr(ctx, fr.x + back * fr.hw * 0.5 - 4, fr.shoulderY - 2, 8, fr.h * 0.22, 4);
    ctx.fill();
  } else if (look.extra === "sash") {
    // 腰间飘带：从腰带后面飘出去一条
    const wave = fr.reduced ? 0 : Math.sin(fr.tick * 0.14) * 3;
    ctx.strokeStyle = look.belt;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(fr.x + back * fr.hw * 0.6, fr.hipY - fr.h * 0.05);
    ctx.quadraticCurveTo(
      fr.x + back * fr.hw * 1.4,
      fr.hipY + wave,
      fr.x + back * fr.hw * 1.8,
      fr.hipY - fr.h * 0.02 + wave
    );
    ctx.stroke();
  }
  ctx.restore();
}

/** 双色躯干 + 腰带 + 描边（替代原来的单色圆角矩形身体） */
export function drawHeroBody(ctx: Ctx, fr: FighterFrame, look: HeroLook, ink: string): void {
  const bodyY = fr.bodyTop + fr.headR;
  const bodyH = fr.hipY - bodyY;
  const beltY = bodyY + bodyH * 0.58;
  ctx.save();
  // 上衣
  ctx.fillStyle = look.top;
  rr(ctx, fr.x - fr.hw, bodyY, fr.hw * 2, bodyH, fr.hw * 0.55);
  ctx.fill();
  // 下装（盖住躯干下段，圆角小一点像短裤 / 裙裤）
  ctx.fillStyle = look.bottom;
  rr(ctx, fr.x - fr.hw, beltY, fr.hw * 2, fr.hipY - beltY, fr.hw * 0.4);
  ctx.fill();
  // 腰带
  ctx.fillStyle = look.belt;
  ctx.fillRect(fr.x - fr.hw + 1, beltY - 2, fr.hw * 2 - 2, 4);
  // 整体描边
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3;
  rr(ctx, fr.x - fr.hw, bodyY, fr.hw * 2, bodyH, fr.hw * 0.55);
  ctx.stroke();
  ctx.restore();
}

/** 头饰（八款各一分支；特写与 HUD 头像也复用它） */
export function drawHeadgear(ctx: Ctx, cx: number, cy: number, headR: number, facing: 1 | -1, look: HeroLook): void {
  ctx.save();
  const g = look.gear;
  const gd = look.gearDark;
  switch (look.headgear) {
    case "petal": {
      // 侧边一朵五瓣小花 + 黄芯
      const px = cx - facing * headR * 0.62;
      const py = cy - headR * 0.72;
      ctx.fillStyle = g;
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(px + Math.cos(a) * headR * 0.26, py + Math.sin(a) * headR * 0.26, headR * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = gd;
      ctx.beginPath();
      ctx.arc(px, py, headR * 0.16, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "starclip": {
      drawStarShape(ctx, cx - facing * headR * 0.55, cy - headR * 0.8, headR * 0.42, g);
      ctx.strokeStyle = gd;
      ctx.lineWidth = 1.5;
      starPath(ctx, cx - facing * headR * 0.55, cy - headR * 0.8, headR * 0.42);
      ctx.stroke();
      break;
    }
    case "dango": {
      // 头顶斜着一串三团小丸子
      ctx.strokeStyle = gd;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - headR * 0.5, cy - headR * 0.85);
      ctx.lineTo(cx + headR * 0.6, cy - headR * 1.25);
      ctx.stroke();
      ctx.fillStyle = g;
      for (let i = 0; i < 3; i++) {
        const t = i / 2;
        ctx.beginPath();
        ctx.arc(cx - headR * 0.4 + t * headR, cy - headR * (0.9 + t * 0.35), headR * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "cloudtuft": {
      ctx.fillStyle = g;
      for (const [dx, dy, r] of [
        [-0.45, -0.85, 0.3],
        [0, -1.02, 0.36],
        [0.45, -0.85, 0.3]
      ]) {
        ctx.beginPath();
        ctx.arc(cx + dx * headR, cy + dy * headR, r * headR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = gd;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy - headR * 1.02, headR * 0.36, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      break;
    }
    case "pandaears": {
      ctx.fillStyle = g;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(cx + s * headR * 0.72, cy - headR * 0.72, headR * 0.34, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = gd;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(cx + s * headR * 0.72, cy - headR * 0.72, headR * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "boltcrest": {
      // 一道闪电形呆毛
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx - facing * headR * 0.1, cy - headR * 0.9);
      ctx.lineTo(cx + facing * headR * 0.34, cy - headR * 1.5);
      ctx.lineTo(cx + facing * headR * 0.12, cy - headR * 1.16);
      ctx.lineTo(cx + facing * headR * 0.52, cy - headR * 1.62);
      ctx.lineTo(cx + facing * headR * 0.4, cy - headR * 1.06);
      ctx.lineTo(cx + facing * headR * 0.16, cy - headR * 0.82);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = gd;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      break;
    }
    case "sproutleaf": {
      ctx.strokeStyle = gd;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(cx, cy - headR * 0.9);
      ctx.quadraticCurveTo(cx + headR * 0.08, cy - headR * 1.2, cx, cy - headR * 1.35);
      ctx.stroke();
      ctx.fillStyle = g;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(cx + s * headR * 0.3, cy - headR * 1.42, headR * 0.32, headR * 0.16, s * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "chickcrest": {
      // 三根呆毛
      ctx.strokeStyle = g;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      for (const dx of [-0.3, 0, 0.3]) {
        ctx.beginPath();
        ctx.moveTo(cx + dx * headR, cy - headR * 0.86);
        ctx.lineTo(cx + dx * headR * 1.7, cy - headR * 1.34);
        ctx.stroke();
      }
      // 小尖嘴（贴着脸朝前）
      ctx.fillStyle = gd;
      ctx.beginPath();
      ctx.moveTo(cx + facing * headR * 0.86, cy + headR * 0.08);
      ctx.lineTo(cx + facing * headR * 1.3, cy + headR * 0.22);
      ctx.lineTo(cx + facing * headR * 0.82, cy + headR * 0.4);
      ctx.closePath();
      ctx.fill();
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

/**
 * 正面行头总入口：头饰 + 短裙摆（随步幅一帧一摆）等前景件。
 * 骨架（四肢 / 躯干 / 头）由渲染层自己画，这里只往上叠。
 */
export function drawHeroLook(ctx: Ctx, fr: FighterFrame, look: HeroLook): void {
  if (look.extra === "skirt") {
    // 短裙：胯部一圈小裙摆，走路时裙摆跟着步幅方向摆 1 帧
    const swing = fr.stride >= 0 ? 1 : -1;
    ctx.save();
    ctx.fillStyle = look.bottom;
    ctx.beginPath();
    ctx.moveTo(fr.x - fr.hw * 1.05, fr.hipY + fr.h * 0.06 + swing);
    ctx.quadraticCurveTo(fr.x, fr.hipY + fr.h * 0.14, fr.x + fr.hw * 1.05, fr.hipY + fr.h * 0.06 - swing);
    ctx.lineTo(fr.x + fr.hw * 0.9, fr.hipY - fr.h * 0.06);
    ctx.lineTo(fr.x - fr.hw * 0.9, fr.hipY - fr.h * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (look.extra === "scarf") {
    // 围巾前段：脖子上一圈
    ctx.save();
    ctx.fillStyle = look.gear;
    rr(ctx, fr.x - fr.hw * 0.85, fr.shoulderY - 4, fr.hw * 1.7, 7, 4);
    ctx.fill();
    ctx.restore();
  }
  drawHeadgear(ctx, fr.headX, fr.headY, fr.headR, fr.facing, look);
}

/* ------------------------------------------------------------------ */
/* 二、表情：五款按状态查表                                            */
/* ------------------------------------------------------------------ */

export type FaceKind = "normal" | "attack" | "hurt" | "dizzy" | "win";

/** 姿态：和渲染层的四态一致（语义详见 poseOf） */
export type FighterPose = "normal" | "stun" | "down" | "wakeup";

/**
 * 姿态查表（从渲染层挪出来的纯函数，语义一字不改）：
 *  · guardbreak            → stun（破防原地摇晃）；
 *  · knockdown 且 stun≤14  → wakeup（正在爬起来）；
 *  · knockdown 且 stun>14  → down（躺平贴地）；
 *  · 起身无敌且自由         → wakeup；
 *  · 其余                  → normal。
 */
export function poseOf(f: { phase: string; stun: number; invuln: number; free: boolean }): FighterPose {
  if (f.phase === "guardbreak") return "stun";
  if (f.phase === "knockdown") return f.stun <= 14 ? "wakeup" : "down";
  if (f.invuln > 0 && f.free) return "wakeup";
  return "normal";
}

/** 表情查表：赢了 > 眩晕 > 被打中 > 出招 > 平常 */
export function faceOf(o: { pose: FighterPose; phase: string; winner: boolean }): FaceKind {
  if (o.winner) return "win";
  if (o.pose === "stun") return "dizzy";
  if (o.pose === "down" || o.phase === "hitstun" || o.phase === "blockstun") return "hurt";
  if (o.phase === "attack") return "attack";
  return "normal";
}

/** 画一张脸（眼睛 + 嘴，五款互不重样），cx/cy 是头心 */
export function drawFace(ctx: Ctx, cx: number, cy: number, headR: number, facing: 1 | -1, kind: FaceKind, ink: string): void {
  const ex = cx + facing * headR * 0.3;
  const ey = cy - headR * 0.12;
  const gapL = -facing * headR * 0.3;
  const gapR = facing * headR * 0.12;
  ctx.save();
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineCap = "round";
  switch (kind) {
    case "normal": {
      ctx.beginPath();
      ctx.arc(ex + gapL, ey, 3.1, 0, Math.PI * 2);
      ctx.arc(ex + gapR, ey, 3.1, 0, Math.PI * 2);
      ctx.fill();
      // 一点点微笑
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ex, ey + headR * 0.4, headR * 0.2, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
      break;
    }
    case "attack": {
      // 咬牙：压低的眉 + 一排小牙
      ctx.lineWidth = 2.4;
      for (const [dx, s] of [
        [gapL, -1],
        [gapR, 1]
      ] as const) {
        ctx.beginPath();
        ctx.moveTo(ex + dx - 3.4, ey - 4.6 + s * facing * 1.2);
        ctx.lineTo(ex + dx + 3.4, ey - 4.6 - s * facing * 1.2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(ex + gapL, ey, 2.6, 0, Math.PI * 2);
      ctx.arc(ex + gapR, ey, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      rr(ctx, ex - headR * 0.24, ey + headR * 0.3, headR * 0.48, headR * 0.2, 2);
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(ex, ey + headR * 0.3);
      ctx.lineTo(ex, ey + headR * 0.5);
      ctx.stroke();
      ctx.strokeStyle = ink;
      rr(ctx, ex - headR * 0.24, ey + headR * 0.3, headR * 0.48, headR * 0.2, 2);
      ctx.stroke();
      break;
    }
    case "hurt": {
      // >< 眼 + 小圆嘴（卡通挨了一下，不带任何吓人的表现）
      ctx.lineWidth = 2.4;
      for (const [dx, s] of [
        [gapL, 1],
        [gapR, -1]
      ] as const) {
        ctx.beginPath();
        ctx.moveTo(ex + dx - 3 * s, ey - 3);
        ctx.lineTo(ex + dx + 3 * s, ey);
        ctx.lineTo(ex + dx - 3 * s, ey + 3);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(ex, ey + headR * 0.42, headR * 0.14, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "dizzy": {
      // 螺旋眼：两圈半径递减的圆弧 + 波浪嘴
      ctx.lineWidth = 2;
      for (const dx of [gapL, gapR]) {
        ctx.beginPath();
        ctx.arc(ex + dx, ey, 3.6, 0, Math.PI * 1.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(ex + dx, ey, 1.8, Math.PI * 0.5, Math.PI * 1.8);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(ex - headR * 0.26, ey + headR * 0.42);
      ctx.quadraticCurveTo(ex - headR * 0.1, ey + headR * 0.32, ex, ey + headR * 0.42);
      ctx.quadraticCurveTo(ex + headR * 0.12, ey + headR * 0.52, ex + headR * 0.26, ey + headR * 0.42);
      ctx.stroke();
      break;
    }
    case "win": {
      // 眯眯笑眼 + 张大嘴笑
      ctx.lineWidth = 2.4;
      for (const dx of [gapL, gapR]) {
        ctx.beginPath();
        ctx.arc(ex + dx, ey + 1.5, 3.4, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(ex, ey + headR * 0.32, headR * 0.26, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ff9fb4";
      ctx.beginPath();
      ctx.arc(ex, ey + headR * 0.44, headR * 0.12, 0, Math.PI);
      ctx.fill();
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* 三、打击感：命中火花三档 / 残影 / 扬尘 / 倒地小弹跳                 */
/* ------------------------------------------------------------------ */

export type SparkGrade = "light" | "heavy" | "break";

/** 各档火花亮几帧 */
export function sparkLife(grade: SparkGrade): number {
  return grade === "light" ? 10 : grade === "heavy" ? 14 : 18;
}

/**
 * 命中火花：t 是 0..1 的进度。
 *  · light：4 根放射短线 + 中心白闪点；
 *  · heavy：8 根放射线 + 星形爆点 + 白闪圈；
 *  · break：6 片盾碎三角往外飞。
 */
export function hitSpark(ctx: Ctx, x: number, y: number, grade: SparkGrade, t: number): void {
  const k = Math.max(0, Math.min(1, t));
  const fade = 1 - k;
  ctx.save();
  ctx.globalAlpha = Math.max(0, fade);
  if (grade === "break") {
    // 盾碎：六片小三角飞出去
    ctx.fillStyle = "#9fd8ff";
    ctx.strokeStyle = "#5a8ec9";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6 + 0.4;
      const d = 10 + k * 34;
      const px = x + Math.cos(a) * d;
      const py = y + Math.sin(a) * d;
      const s = 7 * (1 - k * 0.4);
      ctx.beginPath();
      ctx.moveTo(px, py - s);
      ctx.lineTo(px + s * 0.9, py + s * 0.7);
      ctx.lineTo(px - s * 0.9, py + s * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  const rays = grade === "light" ? 4 : 8;
  const inner = 6 + k * (grade === "light" ? 10 : 16);
  const outer = inner + (grade === "light" ? 10 : 18) * (1 - k * 0.3);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = grade === "light" ? 2.5 : 3.5;
  ctx.lineCap = "round";
  for (let i = 0; i < rays; i++) {
    const a = (Math.PI * 2 * i) / rays + (grade === "light" ? 0.6 : 0.2);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner);
    ctx.lineTo(x + Math.cos(a) * outer, y + Math.sin(a) * outer);
    ctx.stroke();
  }
  if (grade === "heavy") {
    drawStarShape(ctx, x, y, 12 * (1 - k * 0.5), "#ffd45e", k * 1.2);
    ctx.globalAlpha = fade * 0.5;
    ctx.strokeStyle = "#fff6d0";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 14 + k * 18, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, 4 * (1 - k * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 残影透明度：减弱动效时恒 0（残影整个关掉） */
export function afterimageAlpha(reduced: boolean): number {
  return reduced ? 0 : 0.22;
}

/** 重招命中帧留下的半透明轮廓（alpha ≤ 0 时一笔都不画） */
export function drawAfterimage(
  ctx: Ctx,
  ghost: { x: number; feet: number; hw: number; h: number },
  color: string,
  alpha: number
): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  rr(ctx, ghost.x - ghost.hw, ghost.feet - ghost.h, ghost.hw * 2, ghost.h, ghost.hw * 0.55);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ghost.x, ghost.feet - ghost.h + ghost.hw * 0.74, ghost.hw * 0.74, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 扬尘存活帧数 */
export const DUST_LIFE = 20;

/** 落地扬尘：一小团由三个圆组成的软云，随时间散开变淡 */
export function drawDustPuff(ctx: Ctx, x: number, y: number, seed: number, t: number): void {
  const k = Math.max(0, Math.min(1, t));
  const drift = (jitter(seed) - 0.5) * 26;
  const r = 5 + k * 9;
  ctx.save();
  ctx.globalAlpha = (1 - k) * 0.55;
  ctx.fillStyle = "#e8ddd0";
  for (const [dx, dy, rs] of [
    [-0.8, 0, 0.8],
    [0, -0.4, 1],
    [0.8, 0.05, 0.7]
  ]) {
    ctx.beginPath();
    ctx.arc(x + drift * k + dx * r, y - k * 8 + dy * r, r * rs, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 倒地小弹跳持续帧数（只挪画的位置，物理一个数都不改） */
export const DOWN_BOUNCE_FRAMES = 12;

/** 刚倒地那几帧画面往上弹一小下；减弱动效恒 0 */
export function downBounceOffset(downFrames: number, reduced: boolean): number {
  if (reduced) return 0;
  if (downFrames < 0 || downFrames >= DOWN_BOUNCE_FRAMES) return 0;
  return Math.sin((downFrames / DOWN_BOUNCE_FRAMES) * Math.PI) * 6;
}

/* ------------------------------------------------------------------ */
/* 四、影子与 P1/P2 识别双通道                                          */
/* ------------------------------------------------------------------ */

/** 影子随跳跃高度缩小（渲染层原公式原样搬来，测试钉住它） */
export function shadowShrink(y: number): number {
  return Math.max(0.45, 1 - y / 220);
}

/** 两人贴得比这个近，影子交叠加深 */
export const SHADOW_NEAR_GAP = 70;

/** 影子透明度：平时 0.15，贴身时最深加到 0.3 */
export function shadowAlpha(gap: number): number {
  if (gap >= SHADOW_NEAR_GAP) return 0.15;
  const k = 1 - Math.max(0, gap) / SHADOW_NEAR_GAP;
  return 0.15 + k * 0.15;
}

/** P1 / P2 光环与标记的主色（暖粉 vs 天蓝，色弱下明度也拉得开） */
export const RING_COLORS: [string, string] = ["#e0679f", "#4a7fd6"];

/** 脚下光环：P1 粉圈、P2 蓝圈（颜色通道），跳起来跟影子一起缩 */
export function drawFootRing(ctx: Ctx, x: number, y: number, hw: number, side: 0 | 1, shrink: number): void {
  ctx.save();
  ctx.strokeStyle = RING_COLORS[side];
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(x, y, (hw + 6) * shrink, 7 * shrink, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** 头顶标记：P1 小花、P2 小星（形状通道），慢慢上下浮动 */
export function drawSideMarker(ctx: Ctx, x: number, y: number, side: 0 | 1, tick: number, reduced: boolean): void {
  const bob = reduced ? 0 : Math.sin(tick * 0.08 + side * 2) * 2.5;
  const my = y - bob;
  ctx.save();
  if (side === 0) {
    ctx.fillStyle = RING_COLORS[0];
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 4.6, my + Math.sin(a) * 4.6, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#ffe36e";
    ctx.beginPath();
    ctx.arc(x, my, 2.8, 0, Math.PI * 2);
    ctx.fill();
  } else {
    drawStarShape(ctx, x, my, 7, RING_COLORS[1]);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x - 1.6, my - 1.6, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* 五、舞台主题与四层视差 + 地面纵深带                                  */
/* ------------------------------------------------------------------ */

export interface StageTheme {
  id: string;
  name: string;
  skyTop: string;
  skyBottom: string;
  /** 远山剪影色 */
  far: string;
  /** 近景剪影色 */
  near: string;
  /** 地面纵深三条带：远 → 近，越近越亮 */
  ground: [string, string, string];
  groundLine: string;
  /** 前景轻粒子色（花瓣 / 星屑 / 泡泡 / 雪花） */
  petal: string;
  /** cut-in 竖条底色 */
  band: string;
}

/** 四套舞台主题：樱花山道 / 星空擂台 / 海边木台 / 雪夜灯笼 */
export const STAGE_THEMES: [StageTheme, StageTheme, StageTheme, StageTheme] = [
  {
    id: "sakura",
    name: "樱花山道",
    skyTop: "#ffe4ef",
    skyBottom: "#fffdf8",
    far: "rgba(214,150,190,.4)",
    near: "rgba(206,120,164,.5)",
    ground: ["#e3cbde", "#efdcea", "#faeef6"],
    groundLine: "#d8b8d0",
    petal: "rgba(255,180,210,.6)",
    band: "#ffd9ec"
  },
  {
    id: "starry",
    name: "星空擂台",
    skyTop: "#46508c",
    skyBottom: "#a8b4e4",
    far: "rgba(60,70,130,.55)",
    near: "rgba(90,100,170,.6)",
    ground: ["#6a74ac", "#8790c4", "#a7b0dc"],
    groundLine: "#5a648f",
    petal: "rgba(255,240,170,.65)",
    band: "#d9e6ff"
  },
  {
    id: "seaside",
    name: "海边木台",
    skyTop: "#d6f0ff",
    skyBottom: "#fffef6",
    far: "rgba(110,190,200,.45)",
    near: "rgba(90,160,130,.5)",
    ground: ["#d2ac74", "#e2c08c", "#f0d4a6"],
    groundLine: "#bd9660",
    petal: "rgba(160,220,255,.55)",
    band: "#d0f0ff"
  },
  {
    id: "snowlantern",
    name: "雪夜灯笼",
    skyTop: "#4a5578",
    skyBottom: "#cfd8ec",
    far: "rgba(160,175,210,.5)",
    near: "rgba(120,130,170,.55)",
    ground: ["#b9c3dd", "#d3daeb", "#eef2fb"],
    groundLine: "#9aa6c8",
    petal: "rgba(255,255,255,.8)",
    band: "#e6ecfc"
  }
];

/** 按序号取主题（格斗塔按章节分段：每两章换一套；其他模式按选人哈希轮换） */
export function stageThemeOf(i: number): StageTheme {
  const n = Math.abs(Math.round(i)) % STAGE_THEMES.length;
  return STAGE_THEMES[n];
}

/** 四层视差系数：远天 / 远山 / 近景 / 前景轻粒子 */
export const PARALLAX = { sky: 0.08, far: 0.22, near: 0.52, petal: 1.15 } as const;

/** 视差平移量；减弱动效时恒 0 —— 层还在，只是一帧不动 */
export function parallaxOffset(camX: number, factor: number, reduced: boolean): number {
  return reduced ? 0 : -camX * factor;
}

/** 远天层：太阳 / 月亮 + 云或星，各主题一套 */
export function drawSkyDecor(ctx: Ctx, theme: StageTheme, W: number, H: number, off: number, tick: number): void {
  ctx.save();
  const night = theme.id === "starry" || theme.id === "snowlantern";
  // 天体：白天太阳、夜里月亮
  ctx.fillStyle = night ? "#fff6d8" : "#ffe9a8";
  ctx.beginPath();
  ctx.arc(W * 0.78 + off * 0.4, H * 0.16, 26, 0, Math.PI * 2);
  ctx.fill();
  if (night) {
    ctx.fillStyle = theme.skyTop;
    ctx.beginPath();
    ctx.arc(W * 0.78 + off * 0.4 + 10, H * 0.16 - 5, 21, 0, Math.PI * 2);
    ctx.fill();
    // 小星星撒一把（确定性摆位）
    for (let i = 0; i < 9; i++) {
      const sx = ((jitter(i) * (W + 160) + off) % (W + 160)) - 80;
      const sy = jitter(i + 40) * H * 0.4 + 8;
      const tw = 0.55 + 0.45 * Math.sin(tick * 0.05 + i * 1.7);
      ctx.globalAlpha = 0.4 + tw * 0.5;
      drawStarShape(ctx, sx, sy, 3.2 + jitter(i + 80) * 2, "#fff2b8");
    }
  } else {
    // 两团慢慢飘的软云
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = "#ffffff";
    for (const i of [0, 1]) {
      const cx = ((i * 300 + 90 + off * 0.6 + tick * 0.1) % (W + 220)) - 110;
      const cy = H * (0.12 + i * 0.08);
      for (const [dx, r] of [
        [-24, 15],
        [0, 20],
        [26, 14]
      ]) {
        ctx.beginPath();
        ctx.arc(cx + dx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

/** 远山层（22%）：各主题换一套剪影 */
export function drawFarHills(ctx: Ctx, theme: StageTheme, line: number, off: number, W: number): void {
  ctx.save();
  ctx.fillStyle = theme.far;
  for (let i = -1; i < 8; i++) {
    const x = off + i * 190 + 60;
    ctx.beginPath();
    if (theme.id === "seaside") {
      // 海面小岛：又扁又圆
      ctx.moveTo(x - 130, line);
      ctx.quadraticCurveTo(x, line - 58, x + 130, line);
    } else if (theme.id === "snowlantern") {
      // 雪峰：尖一点
      ctx.moveTo(x - 110, line);
      ctx.lineTo(x, line - 138);
      ctx.lineTo(x + 110, line);
    } else {
      // 圆山（樱花 / 星空共用外形，颜色不同）
      ctx.moveTo(x - 120, line);
      ctx.quadraticCurveTo(x, line - 128, x + 120, line);
    }
    ctx.closePath();
    ctx.fill();
    if (theme.id === "snowlantern") {
      // 雪顶
      ctx.fillStyle = "rgba(255,255,255,.7)";
      ctx.beginPath();
      ctx.moveTo(x - 26, line - 106);
      ctx.lineTo(x, line - 138);
      ctx.lineTo(x + 26, line - 106);
      ctx.quadraticCurveTo(x, line - 92, x - 26, line - 106);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = theme.far;
    }
  }
  ctx.restore();
}

/** 近景层（52%）：樱花树 / 星光晶柱 / 棕榈 / 灯笼杆，各主题一套 */
export function drawNearProps(ctx: Ctx, theme: StageTheme, line: number, off: number, W: number): void {
  ctx.save();
  ctx.fillStyle = theme.near;
  for (let i = -1; i < 11; i++) {
    const x = off + i * 132 + 30;
    switch (theme.id) {
      case "sakura": {
        // 樱花树：杆 + 三团花冠
        ctx.fillRect(x - 5, line - 52, 10, 52);
        for (const [dx, dy, r] of [
          [-16, -58, 18],
          [14, -62, 17],
          [0, -76, 20]
        ]) {
          ctx.beginPath();
          ctx.arc(x + dx, line + dy, r, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case "starry": {
        // 星光晶柱：细长六边形 + 顶上一颗星
        ctx.beginPath();
        ctx.moveTo(x - 10, line);
        ctx.lineTo(x - 7, line - 64);
        ctx.lineTo(x, line - 80);
        ctx.lineTo(x + 7, line - 64);
        ctx.lineTo(x + 10, line);
        ctx.closePath();
        ctx.fill();
        drawStarShape(ctx, x, line - 92, 6, "rgba(255,240,170,.8)");
        ctx.fillStyle = theme.near;
        break;
      }
      case "seaside": {
        // 棕榈：斜杆 + 四片叶
        ctx.beginPath();
        ctx.moveTo(x - 4, line);
        ctx.quadraticCurveTo(x + 4, line - 40, x + 10, line - 66);
        ctx.lineTo(x + 18, line - 64);
        ctx.quadraticCurveTo(x + 10, line - 38, x + 4, line);
        ctx.closePath();
        ctx.fill();
        for (const a of [-0.9, -0.3, 0.3, 0.9]) {
          ctx.beginPath();
          ctx.ellipse(x + 14 + Math.cos(a - Math.PI / 2) * 16, line - 66 + Math.sin(a - Math.PI / 2) * 8, 17, 6, a, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      default: {
        // 灯笼杆：杆 + 暖光灯笼
        ctx.fillRect(x - 3, line - 74, 6, 74);
        ctx.fillRect(x - 12, line - 74, 24, 4);
        ctx.fillStyle = "rgba(255,200,120,.85)";
        rr(ctx, x - 9, line - 68, 18, 22, 8);
        ctx.fill();
        ctx.fillStyle = "rgba(255,240,190,.9)";
        ctx.beginPath();
        ctx.arc(x, line - 57, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = theme.near;
        break;
      }
    }
  }
  ctx.restore();
}

/** 地面纵深：三条横向色带（远暗近亮）+ 擂台中线，纵深感全靠它和视差扛 */
export function drawGroundBands(ctx: Ctx, theme: StageTheme, line: number, W: number, H: number): void {
  const gh = Math.max(1, H - line);
  const tops = [0, 0.3, 0.62];
  const hts = [0.3, 0.32, 0.38];
  ctx.save();
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = theme.ground[i];
    ctx.fillRect(-20, line + gh * tops[i], W + 40, gh * hts[i] + 1.5);
  }
  // 地平线
  ctx.strokeStyle = theme.groundLine;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-20, line);
  ctx.lineTo(W + 20, line);
  ctx.stroke();
  // 两条带间的细中线（亮一号，看得出一层层往前近）
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  for (const t of [0.3, 0.62]) {
    ctx.beginPath();
    ctx.moveTo(-20, line + gh * t);
    ctx.lineTo(W + 20, line + gh * t);
    ctx.stroke();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* 六、超必杀 cut-in                                                   */
/* ------------------------------------------------------------------ */

/** 演出最长 72 帧 = 1.2 秒（规格上限）；减弱动效改成 24 帧静态卡 */
export const SUPER_CUT_FRAMES = 72;
export const SUPER_CUT_REDUCED_FRAMES = 24;

export function superCutDuration(reduced: boolean): number {
  return reduced ? SUPER_CUT_REDUCED_FRAMES : SUPER_CUT_FRAMES;
}

/** 入场白闪帧数（0.1 秒） */
export const SUPER_FLASH_FRAMES = 6;

/** 入场白闪透明度：只闪一次、只闪 0.1 秒；减弱动效恒 0 */
export function superFlashAlpha(elapsed: number, reduced: boolean): number {
  if (reduced) return 0;
  if (elapsed < 0 || elapsed >= SUPER_FLASH_FRAMES) return 0;
  return (1 - elapsed / SUPER_FLASH_FRAMES) * 0.85;
}

/** 竖条底：主题色纵向三宽条 + 两侧深色收边 */
export function drawCutInBands(ctx: Ctx, W: number, H: number, side: 0 | 1, theme: StageTheme): void {
  ctx.save();
  ctx.globalAlpha = 0.82;
  ctx.fillStyle = side === 0 ? "#ffd9ec" : "#d9e6ff";
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = theme.band;
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(W * (0.14 + i * 0.3), 0, W * 0.12, H);
  }
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = RING_COLORS[side];
  ctx.fillRect(0, 0, W * 0.05, H);
  ctx.fillRect(W * 0.95, 0, W * 0.05, H);
  ctx.restore();
}

/** 斜向速度线 12 根，随进度往外抽 */
export function drawSpeedLines(ctx: Ctx, W: number, H: number, side: 0 | 1, t: number): void {
  const dir = side === 0 ? 1 : -1;
  ctx.save();
  ctx.strokeStyle = "#ffffff";
  ctx.globalAlpha = 0.65;
  ctx.lineCap = "round";
  for (let i = 0; i < 12; i++) {
    const y = (i / 12) * H + jitter(i) * 24;
    const len = 90 + jitter(i + 12) * 120 + t * 160;
    const x0 = side === 0 ? -40 + ((t * 480 + i * 130) % (W + 240)) : W + 40 - ((t * 480 + i * 130) % (W + 240));
    ctx.lineWidth = 2 + jitter(i + 24) * 3;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + dir * len, y - dir * len * 0.18);
    ctx.stroke();
  }
  ctx.restore();
}

/** 角色特写：放大版脑袋（白圈 + 主色圆 + 出招表情 + 头饰） */
export function drawCutInCloseUp(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  look: HeroLook,
  color: string,
  ink: string,
  facing: 1 | -1
): void {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  drawFace(ctx, cx + facing * r * 0.14, cy, r, facing, "attack", ink);
  // 腮红
  ctx.fillStyle = "rgba(255,150,180,.55)";
  ctx.beginPath();
  ctx.ellipse(cx + facing * r * 0.5, cy + r * 0.3, r * 0.2, r * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  drawHeadgear(ctx, cx, cy, r, facing, look);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* 七、HUD：头像 / 回合星 / 能量流光 / 连击弹跳                          */
/* ------------------------------------------------------------------ */

/** 元气条端头的小头像（复用脑袋画法，一次画完不重绘） */
export function drawAvatar(ctx: Ctx, size: number, look: HeroLook, color: string, ink: string): void {
  const c = size / 2;
  const r = size * 0.36;
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(c, c, size * 0.48, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(c, c + size * 0.06, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  drawFace(ctx, c + r * 0.1, c + size * 0.06, r, 1, "normal", ink);
  drawHeadgear(ctx, c, c + size * 0.06, r, 1, look);
  ctx.restore();
}

/** 回合星：赢一回合点亮一颗（画的星形，不再用字符） */
export function drawRoundPips(ctx: Ctx, w: number, h: number, wins: number, needed: number, rightAlign: boolean): void {
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  const r = h * 0.38;
  const step = r * 2.5;
  for (let i = 0; i < needed; i++) {
    const cx = rightAlign ? w - r - 1 - i * step : r + 1 + i * step;
    if (i < wins) {
      drawStarShape(ctx, cx, h / 2, r, "#f2b429");
      ctx.strokeStyle = "#b8862a";
      ctx.lineWidth = 1;
      starPath(ctx, cx, h / 2, r);
      ctx.stroke();
    } else {
      ctx.strokeStyle = "rgba(160,140,190,.55)";
      ctx.lineWidth = 1.2;
      starPath(ctx, cx, h / 2, r);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** 能量满槽流光的横向平移量；减弱动效恒 0（静态金框由 CSS 兜底） */
export function shimmerOffset(tick: number, reduced: boolean): number {
  return reduced ? 0 : (tick * 2) % 48;
}

/** 连击数弹跳：新的一段连击进来的头几帧放大回落；减弱动效恒 1 */
export function comboPopScale(age: number, reduced: boolean): number {
  if (reduced) return 1;
  if (age < 0 || age >= 8) return 1;
  return 1 + 0.5 * (1 - age / 8);
}

/** 连击弹跳数字从第几连开始显示 */
export const COMBO_POP_MIN = 3;

export function comboPopVisible(combo: number): boolean {
  return combo >= COMBO_POP_MIN;
}

/** 画布上的连击弹跳徽章：描边圆底 + 大数字 */
export function drawComboPop(ctx: Ctx, x: number, y: number, combo: number, scale: number, side: 0 | 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = RING_COLORS[side];
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(0, 0, 21, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.font = "900 17px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = RING_COLORS[side];
  ctx.fillText(`${combo}连`, 0, 1);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* 八、胜利彩带                                                        */
/* ------------------------------------------------------------------ */

export const CONFETTI_COUNT = 20;

const CONFETTI_COLORS = ["#ff9ec4", "#ffd45e", "#9fd8ff", "#c6f0a8", "#d8b4ff"];

/** 胜利彩带 20 片：确定性摆位，减弱动效时静止铺满（不消失也不飘） */
export function drawConfetti(ctx: Ctx, W: number, H: number, tick: number, reduced: boolean): void {
  const t = reduced ? 0 : tick;
  ctx.save();
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const x = jitter(i) * W + Math.sin((t + i * 13) * 0.04) * 18;
    const y = ((jitter(i + 50) * H + t * (1.2 + jitter(i + 90))) % (H + 24)) - 12;
    const rot = jitter(i + 130) * Math.PI + t * 0.03 * (i % 2 === 0 ? 1 : -1);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    ctx.fillRect(-5, -2.5, 10, 5);
    ctx.restore();
  }
  ctx.restore();
}
