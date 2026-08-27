/**
 * 王子公主大冒险 · 1.3 视觉模块(只管画,不碰玩法)。
 *
 * 这里住着四样东西:
 *   1. 四·补一的配色板 token 与九层图层序 —— 全部写死成常量,测试逐个对表;
 *   2. 四·补三的动效时序表(毫秒)与纯函数相位:披风摆动、旗帜飘动、宝石呼吸、
 *      刃光窗口、无敌闪烁节拍,全都「毫秒 + reduced 进、相位出」,不持有状态;
 *   3. 双角色几何:王子 / 公主的身体剪影路径,与皇冠 / 蝶结 / 双层裙摆 /
 *      双排金扣 / 披纱五个识别件 —— 16px 灰度下靠**剪影**分人,不靠颜色;
 *   4. `PcpFx`:渲染侧的小账本(挥杖星尘轨迹 + 通关击掌彩纸)。
 *      它只在事件发生时被喂坐标,一个字也不写回 `World`。
 *
 * 红线:攻击窗口 `attackT`、无敌时序、`HERO_W / HERO_H` 判定盒这里**只读**;
 * `prefers-reduced-motion` 的判断由调用方传进来,本模块不摸媒体特性。
 */

import { shade, withAlpha } from "../../art/kit/palette";
import { strokeOutline } from "../../art/kit/outline";
import { traceStar } from "../../art/kit/star";
import {
  spawnRibbons,
  spawnSparkles,
  stepParticles,
  drawParticles,
  type Particle,
} from "../../art/kit/sparkle";
import type { EnemyKind } from "./levels";

// ---------------------------------------------------------------------------
// 四·补一 配色板(token 一个不许飘)
// ---------------------------------------------------------------------------

export const PP_COLORS = {
  /** 王子上衣渐变主色(顶光走 shade(+TOP_LIGHT)) */
  ppPrince: "#7FB2F0",
  /** 公主外裙渐变主色(顶光走 shade(+TOP_LIGHT)) */
  ppPrincess: "#F4859F",
  /** 公主内衬 / 披纱底色 */
  ppLining: "#FFF0F6",
  /** 皇冠 / 金扣 / 剑护手 */
  ppGold: "#F0C25A",
  /** 皇冠正中宝石 */
  ppRuby: "#E85D75",
  /** 城堡远景剪影 */
  ppCastleFar: "#D8CBEA",
  /** 城堡中景剪影 */
  ppCastleMid: "#BFA8DD",
  /** 全场统一落影 */
  ppShadow: "rgba(90,74,120,.16)",
} as const;

/** 顶光提亮档:「主色 → 顶光 +20%」的那个 20 */
export const TOP_LIGHT = 20;

/** 落影椭圆:宽 0.75×HERO_W,高是宽的 0.2 */
export const SHADOW_W_RATIO = 0.75;
export const SHADOW_H_RATIO = 0.2;

/**
 * 图层序(`render` 从底到顶)。危险标记是功能件,压所有美术层,只让 HUD 盖它。
 */
export const PP_LAYERS = [
  "sky",
  "castleTowers",
  "bushes",
  "terrain",
  "props",
  "heroes",
  "fx",
  "hazardMark",
  "hud",
] as const;

// ---------------------------------------------------------------------------
// 四·补三 动效时序表(毫秒写死,测试引用)
// ---------------------------------------------------------------------------

/** 披风 / 裙摆摆动:移动时 2 帧一循环(step),reduced 静止 */
export const CAPE_SWAY_MS = 340;
export const CAPE_SWAY_FRAMES = 2;
/** 刃光扫过:挥剑起手的这一小窗(≈1 帧),功能反馈,reduced 也保留 */
export const BLADE_FLASH_MS = 50;
/** 刃光的那一抹白 */
export const BLADE_FLASH_COLOR = "rgba(255,255,255,.85)";
/** 星尘轨迹:挥杖 5 颗,400ms(easeOutQuad 由 sparkle.ts 统一管),reduced 不生成 */
export const STARDUST_COUNT = 5;
export const STARDUST_MS = 400;
/** 宝石呼吸微光:2000ms 周期(sin);reduced 静止在 1.2 的固定透明度上 */
export const GEM_BREATH_MS = 2000;
/** 1.2 的静态光圈透明度 —— 呼吸绕着它走,reduced 就停在它上 */
export const GEM_GLOW_BASE = 0.42;
/** 呼吸摆幅(±一半) */
export const GEM_BREATH_AMP = 0.14;
/** 存档旗飘动:2 帧 900ms(step),reduced 静止 */
export const FLAG_WAVE_MS = 900;
export const FLAG_WAVE_FRAMES = 2;
/** 通关击掌彩纸:600ms(easeOutCubic 由 sparkle.ts 统一管),reduced 静止合影 */
export const HIGHFIVE_MS = 600;
/** 无敌闪烁的提亮档:闪烁帧把角色主色 +40%(节拍沿用 1.2,一拍不改) */
export const BLINK_LIFT = 40;
/** 头饰最小可辨尺寸(px):低于它退化为纯色块,但形状保留 */
export const HEADWEAR_MIN_PX = 6;
/** 公主披纱透明度(半透明白 30%) */
export const SHAWL_ALPHA = 0.3;

// ---------------------------------------------------------------------------
// 纯函数相位
// ---------------------------------------------------------------------------

/** 披风 / 裙摆的两帧摆动相位(0|1)。不动或 reduced 一律冻在 0 */
export function capePhase(ms: number, moving: boolean, reduced: boolean): 0 | 1 {
  if (reduced || !moving) return 0;
  return (Math.floor(Math.max(0, ms) / (CAPE_SWAY_MS / CAPE_SWAY_FRAMES)) % CAPE_SWAY_FRAMES) as 0 | 1;
}

/** 存档旗的两帧飘动相位(0|1)。reduced 冻在 0 */
export function flagWavePhase(ms: number, reduced: boolean): 0 | 1 {
  if (reduced) return 0;
  return (Math.floor(Math.max(0, ms) / (FLAG_WAVE_MS / FLAG_WAVE_FRAMES)) % FLAG_WAVE_FRAMES) as 0 | 1;
}

/** 宝石光圈这一刻的透明度:sin 呼吸;reduced 停在 1.2 的固定档 */
export function gemGlowAlpha(ms: number, reduced: boolean): number {
  if (reduced) return GEM_GLOW_BASE;
  return GEM_GLOW_BASE + (GEM_BREATH_AMP / 2) * Math.sin((ms / GEM_BREATH_MS) * Math.PI * 2);
}

/**
 * 无敌闪烁节拍 —— 和 1.2 的 `world.invuln > 0 && (calm || floor(invuln*12)%2===0)`
 * 逐拍一致,这里只是把公式挪成可单测的纯函数;色变(主色 +BLINK_LIFT%)在绘制层做。
 */
export function invulnBlink(invuln: number, calm: boolean): boolean {
  return invuln > 0 && (calm || Math.floor(invuln * 12) % 2 === 0);
}

/**
 * 刃光是否在场:挥剑起手的头 `BLADE_FLASH_MS` 毫秒亮一下。
 * 只读 `attackT`(剩余秒)与 `meleeTime`(总长秒),不写回。
 * 功能反馈,reduced 也保留,所以签名里压根没有 reduced。
 */
export function bladeFlashOn(attackT: number, meleeTime: number): boolean {
  return attackT > 0 && (meleeTime - attackT) * 1000 <= BLADE_FLASH_MS;
}

/** 头饰画不画细节:渲染尺寸低于 6px 就退化为纯色块(形状保留,细节全免) */
export function headwearDetail(px: number): boolean {
  return px >= HEADWEAR_MIN_PX;
}

// ---------------------------------------------------------------------------
// 双角色剪影(x 单位 = HERO_W,y 单位 = HERO_H;原点脚底中心,向上为负)
// ---------------------------------------------------------------------------

/** 身体从这条线开始(脖根),和 drawHero 的 bodyTop 对齐 */
export const BODY_TOP = -0.53;

/**
 * 王子:立领上衣收腰 + **两条裤腿**(裆部凹口是灰度下认王子的关键)。
 */
export function princeSilhouette(): ReadonlyArray<readonly [number, number]> {
  return [
    [-0.3, BODY_TOP],
    [0.3, BODY_TOP],
    [0.26, -0.3],
    [0.22, -0.16],
    [0.22, -0.01],
    [0.07, -0.01],
    [0.07, -0.14],
    [-0.07, -0.14],
    [-0.07, -0.01],
    [-0.22, -0.01],
    [-0.22, -0.16],
    [-0.26, -0.3],
  ];
}

/**
 * 公主:收腰上身 + 钟形外裙(裙摆一路張到 0.46,灰度下和裤装一眼分清)。
 */
export function princessSilhouette(): ReadonlyArray<readonly [number, number]> {
  return [
    [-0.18, BODY_TOP],
    [0.18, BODY_TOP],
    [0.15, -0.36],
    [0.3, -0.16],
    [0.46, -0.02],
    [0.0, -0.005],
    [-0.46, -0.02],
    [-0.3, -0.16],
    [-0.15, -0.36],
  ];
}

// ---------------------------------------------------------------------------
// 识别件几何(皇冠 / 蝶结 / 双层裙摆 / 双排扣 / 披纱)
// ---------------------------------------------------------------------------

/**
 * 王子的 3 齿实心皇冠折点(单位 headR,相对头心;向上为负)。
 * 齿尖圆珠与正中红宝石的位置由 `crownTeethTips` / `CROWN_RUBY` 给。
 */
export function crownPath(): ReadonlyArray<readonly [number, number]> {
  return [
    [-0.72, -0.74],
    [-0.72, -0.95],
    [-0.48, -1.38],
    [-0.24, -1.02],
    [0, -1.46],
    [0.24, -1.02],
    [0.48, -1.38],
    [0.72, -0.95],
    [0.72, -0.74],
  ];
}

/** 三颗齿尖(圆珠长在这儿) */
export function crownTeethTips(): ReadonlyArray<readonly [number, number]> {
  return [
    [-0.48, -1.38],
    [0, -1.46],
    [0.48, -1.38],
  ];
}

/** 皇冠正中的红宝石(椭圆)+ 高光点位 */
export const CROWN_RUBY = { x: 0, y: -0.86, rx: 0.16, ry: 0.12, hi: 0.05 } as const;

/** 公主的小皇冠 = 同一条 crownPath 缩到 0.45 —— 「小冠」和「大皇冠」的差就在这 */
export const PRINCESS_CROWN_SCALE = 0.45;
/** 小皇冠往头顶偏左挪一点,给侧边的蝶结让位 */
export const PRINCESS_CROWN_OFFSET_X = -0.3;

export interface BowShape {
  knot: { x: number; y: number; r: number };
  wings: ReadonlyArray<ReadonlyArray<readonly [number, number]>>;
}

/** 公主的蝴蝶结(单位 headR,相对头心):中间结 + 两片翼,长在头侧 */
export function bowShape(): BowShape {
  return {
    knot: { x: 0.55, y: -0.85, r: 0.14 },
    wings: [
      [
        [0.55, -0.85],
        [0.2, -1.08],
        [0.26, -0.6],
      ],
      [
        [0.55, -0.85],
        [0.92, -1.08],
        [0.86, -0.58],
      ],
    ],
  };
}

/** 内衬波浪下摆:几个半圆扇贝 [x, y, r](x/r 单位 HERO_W,y 单位 HERO_H) */
export function skirtLiningArcs(): ReadonlyArray<readonly [number, number, number]> {
  return [
    [-0.26, -0.03, 0.1],
    [0, -0.025, 0.11],
    [0.26, -0.03, 0.1],
  ];
}

/** 裙面三点小星纹的位置 [x, y](单位同上)与星径(HERO_W 倍) */
export function skirtStars(): ReadonlyArray<readonly [number, number]> {
  return [
    [-0.14, -0.18],
    [0, -0.1],
    [0.14, -0.19],
  ];
}
export const SKIRT_STAR_R = 0.05;

/** 王子的双排金扣:2 列 × 2 行,共 4 点(单位同剪影) */
export function buttonPoints(): ReadonlyArray<readonly [number, number]> {
  return [
    [-0.1, -0.44],
    [0.1, -0.44],
    [-0.1, -0.34],
    [0.1, -0.34],
  ];
}

/** 公主披肩短纱的路径点(画在身后,填 withAlpha(ppLining, SHAWL_ALPHA)) */
export function shawlPath(): ReadonlyArray<readonly [number, number]> {
  return [
    [-0.05, BODY_TOP],
    [-0.44, -0.4],
    [-0.36, -0.16],
    [-0.08, -0.3],
  ];
}

/** 披纱的填色(背景处降饱和的半透明白,配一条細边防糊) */
export function shawlFill(): string {
  return withAlpha(PP_COLORS.ppLining, SHAWL_ALPHA);
}

/** 无敌闪烁帧的提亮色:角色主色 +40% */
export function blinkLift(color: string): string {
  return shade(color, BLINK_LIFT);
}

// ---------------------------------------------------------------------------
// PcpFx:星尘轨迹 + 通关击掌彩纸(渲染侧账本,只读事件坐标)
// ---------------------------------------------------------------------------

/** 星尘 / 彩纸的粉彩弹药 */
export const FX_COLORS = [PP_COLORS.ppGold, PP_COLORS.ppLining, PP_COLORS.ppPrincess, PP_COLORS.ppPrince];

export class PcpFx {
  private list: Particle[] = [];
  /** 通关击掌还剩几秒(秒;reduced 也计,只是不撒纸 —— 静止合影靠它撑住姿势) */
  celebrateT = 0;

  /** 挥杖:5 颗星尘,400ms;reduced 不生成 */
  stardust(x: number, y: number, reduced: boolean, rand?: () => number): void {
    if (reduced) return;
    this.list.push(
      ...spawnSparkles(x, y, {
        count: STARDUST_COUNT,
        lifeMs: STARDUST_MS,
        colors: FX_COLORS,
        size: 4,
        speed: 150,
        rand,
      })
    );
  }

  /** 通关:两人击掌 + 彩纸 600ms;reduced 只摆姿势不撒纸 */
  highFive(x: number, y: number, reduced: boolean, rand?: () => number): void {
    this.celebrateT = HIGHFIVE_MS / 1000;
    if (reduced) return;
    this.list.push(
      ...spawnRibbons(x, y, { count: 8, lifeMs: HIGHFIVE_MS, colors: FX_COLORS, rand }),
      ...spawnSparkles(x, y, { count: 6, lifeMs: HIGHFIVE_MS, colors: FX_COLORS, rand })
    );
  }

  /** 每帧走一步(通关后世界停了,这本账自己往前翻,不碰 World) */
  step(dt: number): void {
    if (this.list.length > 0) this.list = stepParticles(this.list, dt);
    if (this.celebrateT > 0) this.celebrateT = Math.max(0, this.celebrateT - Math.max(0, dt));
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.list.length > 0) drawParticles(ctx, this.list);
  }

  get count(): number {
    return this.list.length;
  }

  get celebrating(): boolean {
    return this.celebrateT > 0;
  }

  /** destroy 时一把清干净:星尘与计时归零 */
  clear(): void {
    this.list = [];
    this.celebrateT = 0;
  }
}

// ---------------------------------------------------------------------------
// 修复员 S1/S2:五小怪母形自绘 + 参数化 Q 版首领骨架
// (几何全按 ENEMY_STATS / BOSS_W / BOSS_H 现尺寸挂比例,判定盒只读不动)
// ---------------------------------------------------------------------------

/**
 * 五小怪主色(母形 + 专属色双通道识别):
 * 果冻=草绿半圆水滴 / 蝙蝠=暮紫圆体三角翼 / 铠甲=钢蓝圆体前置盾 /
 * 幽灵=雾紫摆边纱体 / 法珠=晶紫圆体环绕珠。
 */
export const PP_ENEMY = {
  slime: "#8FCF7A",
  bat: "#9B8CCB",
  armor: "#8FA8C8",
  ghost: "#CFC5EA",
  turret: "#C08BD6",
} as const;

/** 蝙蝠翼两帧摆动:300ms 一换(learner #6);reduced 定格 0 帧 */
export const BAT_FLAP_MS = 300;
/** 法珠怪环绕小珠:3 颗互差 120°,公转一圈的毫秒数;reduced 静止在初相 */
export const ORB_SPIN_MS = 2400;
export const ORB_COUNT = 3;

/** 小怪 / 首领统一眼型:竖椭圆 + 白高光点(与两位主角同一张脸谱语言) */
function enemyEyes(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, spread = 0.34): void {
  ctx.fillStyle = "#4A3D5E";
  for (const s of [-1, 1] as const) {
    ctx.beginPath();
    ctx.ellipse(cx + s * r * spread, cy, Math.max(1, r * 0.1), Math.max(1.4, r * 0.16), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,.92)";
  for (const s of [-1, 1] as const) {
    ctx.beginPath();
    ctx.arc(cx + s * r * spread - r * 0.03, cy - r * 0.05, Math.max(0.5, r * 0.045), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 2 停体渐变:顶亮 +16 → 底 -10(左上光源的纵向近似) */
function enemyBodyGrad(
  ctx: CanvasRenderingContext2D,
  color: string,
  top: number,
  bottom: number
): CanvasGradient {
  const grad = ctx.createLinearGradient(0, top, 0, bottom);
  grad.addColorStop(0, shade(color, 16));
  grad.addColorStop(1, shade(color, -10));
  return grad;
}

/**
 * 五小怪自绘(替换绿圆/蝙蝠/盾牌/幽灵/水晶球五只裸 emoji 字形)。
 * 以 (cx,cy) 为怪物中心、w×h 为 ENEMY_STATS 现尺寸盒;
 * tMs 只喂动效相位(蝙蝠翼两帧 / 法珠公转),reduced 全部定格,判定不碰。
 */
export function drawEnemy(
  ctx: CanvasRenderingContext2D,
  kind: EnemyKind,
  cx: number,
  cy: number,
  w: number,
  h: number,
  tMs: number,
  reduced: boolean,
  dir: 1 | -1 = 1
): void {
  const color = PP_ENEMY[kind];
  const hw = w / 2;
  const hh = h / 2;
  ctx.save();
  // 落影(全场统一 ppShadow)
  ctx.fillStyle = PP_COLORS.ppShadow;
  ctx.beginPath();
  ctx.ellipse(cx, cy + hh * 0.98, hw * 0.72, hh * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = enemyBodyGrad(ctx, color, cy - hh, cy + hh);
  if (kind === "slime") {
    // 半圆水滴体:圆顶拱 + 底压暗带 + 顶部高光弧
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy + hh);
    ctx.bezierCurveTo(cx - hw, cy - hh * 0.9, cx + hw, cy - hh * 0.9, cx + hw, cy + hh);
    ctx.closePath();
    ctx.fill();
    strokeOutline(ctx, color, 1.5);
    ctx.fillStyle = withAlpha(shade(color, -22), 0.55);
    ctx.beginPath();
    ctx.ellipse(cx, cy + hh * 0.86, hw * 0.78, hh * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.8)";
    ctx.lineWidth = Math.max(1.5, hh * 0.12);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(cx, cy + hh * 0.15, hw * 0.62, -Math.PI * 0.78, -Math.PI * 0.4);
    ctx.stroke();
    ctx.lineCap = "butt";
    enemyEyes(ctx, cx, cy + hh * 0.1, hh);
  } else if (kind === "bat") {
    // 圆体 + 双三角翼(两帧 300ms 摆;reduced 定格)+ 双立耳
    const flap = reduced ? 0 : Math.floor(tMs / BAT_FLAP_MS) % 2;
    const tipY = cy - hh * (flap === 0 ? 0.72 : 0.1);
    for (const s of [-1, 1] as const) {
      ctx.beginPath();
      ctx.moveTo(cx + s * hw * 0.24, cy - hh * 0.1);
      ctx.lineTo(cx + s * hw * 1.02, tipY);
      ctx.quadraticCurveTo(cx + s * hw * 0.86, cy + hh * 0.34, cx + s * hw * 0.2, cy + hh * 0.28);
      ctx.closePath();
      ctx.fill();
    }
    for (const s of [-1, 1] as const) {
      ctx.beginPath();
      ctx.moveTo(cx + s * hh * 0.16, cy - hh * 0.5);
      ctx.lineTo(cx + s * hh * 0.42, cy - hh * 1.0);
      ctx.lineTo(cx + s * hh * 0.52, cy - hh * 0.4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, hh * 0.62, 0, Math.PI * 2);
    ctx.fill();
    strokeOutline(ctx, color, 1.5);
    enemyEyes(ctx, cx, cy - hh * 0.1, hh * 0.9);
  } else if (kind === "armor") {
    // 圆体 + 前置小盾牌(圆角盾形 2 停 + 铆钉 2 点);盾随行进方向换边
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(hw, hh) * 0.86, 0, Math.PI * 2);
    ctx.fill();
    strokeOutline(ctx, color, 1.5);
    enemyEyes(ctx, cx - dir * hw * 0.16, cy - hh * 0.22, hh * 0.8);
    const sx = cx + dir * hw * 0.56;
    const sw = hw * 0.52;
    const sh = hh * 0.78;
    const shieldGrad = ctx.createLinearGradient(0, cy - sh * 0.6, 0, cy + sh * 0.6);
    shieldGrad.addColorStop(0, shade("#C8D4E4", 12));
    shieldGrad.addColorStop(1, shade("#C8D4E4", -10));
    ctx.fillStyle = shieldGrad;
    ctx.beginPath();
    ctx.moveTo(sx - sw * 0.5, cy - sh * 0.55);
    ctx.quadraticCurveTo(sx, cy - sh * 0.7, sx + sw * 0.5, cy - sh * 0.55);
    ctx.quadraticCurveTo(sx + sw * 0.5, cy + sh * 0.2, sx, cy + sh * 0.6);
    ctx.quadraticCurveTo(sx - sw * 0.5, cy + sh * 0.2, sx - sw * 0.5, cy - sh * 0.55);
    ctx.closePath();
    ctx.fill();
    strokeOutline(ctx, "#C8D4E4", 1.5);
    ctx.fillStyle = shade("#C8D4E4", -30);
    for (const dy of [-0.2, 0.14]) {
      ctx.beginPath();
      ctx.arc(sx, cy + sh * dy, Math.max(1, sw * 0.09), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === "ghost") {
    // 摆边纱体(半透明 0.85 = 剑会穿过去的视觉语言)+ 内层暗芯
    ctx.globalAlpha = 0.85;
    const r = Math.min(hw, hh * 0.62);
    ctx.beginPath();
    ctx.arc(cx, cy - hh * 0.28, r, Math.PI, 0);
    ctx.lineTo(cx + r, cy + hh * 0.62);
    for (let k = 2; k >= 0; k--) {
      const wx = cx - r + ((k + 0.5) / 3) * r * 2;
      ctx.quadraticCurveTo(wx + r * 0.32, cy + hh * 0.98, wx, cy + hh * 0.62);
      ctx.quadraticCurveTo(wx - r * 0.32, cy + hh * 0.3, wx - r * 0.66, cy + hh * 0.62);
    }
    ctx.closePath();
    ctx.fill();
    strokeOutline(ctx, color, 1.5);
    ctx.fillStyle = shade(color, -14);
    ctx.beginPath();
    ctx.arc(cx, cy + hh * 0.05, r * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    enemyEyes(ctx, cx, cy - hh * 0.34, hh * 0.9);
  } else {
    // 法珠怪:圆体 + 环绕小珠 3 颗(公转;reduced 静止在初相)
    const spin = reduced ? 0 : ((tMs % ORB_SPIN_MS) / ORB_SPIN_MS) * Math.PI * 2;
    const body = Math.min(hw, hh) * 0.72;
    ctx.beginPath();
    ctx.arc(cx, cy + hh * 0.08, body, 0, Math.PI * 2);
    ctx.fill();
    strokeOutline(ctx, color, 1.5);
    enemyEyes(ctx, cx, cy - hh * 0.06, hh * 0.85);
    for (let i = 0; i < ORB_COUNT; i++) {
      const a = spin + (i / ORB_COUNT) * Math.PI * 2;
      const ox = cx + Math.cos(a) * hw * 1.0;
      const oy = cy + hh * 0.08 + Math.sin(a) * hh * 0.42;
      ctx.fillStyle = "#E8C7F2";
      ctx.beginPath();
      ctx.arc(ox, oy, Math.max(2, hw * 0.13), 0, Math.PI * 2);
      ctx.fill();
      strokeOutline(ctx, "#E8C7F2", 1);
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.beginPath();
      ctx.arc(ox - hw * 0.04, oy - hh * 0.04, Math.max(0.8, hw * 0.045), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 修复员 S2:参数化 Q 版首领骨架(一副骨架 + 七套特征件,不画七个独立 BOSS)
// ---------------------------------------------------------------------------

/** BOSS 出场弹入时长(learner #7:400ms 缩放弹入;reduced 直接淡入) */
export const BOSS_INTRO_MS = 400;

/** 出场缩放:0.7 → 1,途中一点点回弹;reduced 恒 1(淡入交给调用侧 alpha) */
export function bossIntroScale(k: number, reduced: boolean): number {
  if (reduced) return 1;
  const t = Math.max(0, Math.min(1, k));
  return 0.7 + 0.3 * t + 0.08 * Math.sin(t * Math.PI);
}

/** guard 光环:平涂 0.28 底 → 边缘径向渐变淡出(中心实、边缘散) */
export function drawGuardHalo(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  w: number,
  h: number,
  color: string,
  alpha: number
): void {
  const cy = by - h * 0.52;
  const rr = Math.max(w, h) * 0.72;
  const grad = ctx.createRadialGradient(bx, cy, rr * 0.35, bx, cy, rr);
  grad.addColorStop(0, withAlpha(color, alpha));
  grad.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(bx, cy, rr, rr * 0.86, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 参数化首领:三停渐变胖椭圆本体 + 皱眉鼓腮脸 + 短圆四肢,
 * 再按 kindIdx(BOSSES 下标)配 1–2 件特征件:
 * 0 糖串首领=头顶三色丸串 / 1 蜂后=双翅+条纹腹 / 2 石像=方下巴+眉檐 /
 * 3 风筝=菱形背板+飘带 / 4 小龙=圆角背鳍 3 齿 / 5 雪首领=雪球肚+毛线帽 /
 * 6 王者=大王冠。特征件全部文字规格原创,不参照任何现存商业形象。
 * (bx,by) 是脚底中点,w×h = BOSS_W×BOSS_H 现判定盒;体渐变 +20/−16、描边 2px 深 26%。
 */
export function drawBossFigure(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  w: number,
  h: number,
  kindIdx: number,
  color: string
): void {
  const cy = by - h * 0.52;
  const rx = w * 0.5;
  const ry = h * 0.48;
  ctx.save();
  // 落影
  ctx.fillStyle = PP_COLORS.ppShadow;
  ctx.beginPath();
  ctx.ellipse(bx, by, rx * 0.9, h * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  // 背后特征件(翼 / 背板 / 背鳍):画在本体之下
  if (kindIdx === 1) {
    ctx.fillStyle = "rgba(255,255,255,.65)";
    for (const s of [-1, 1] as const) {
      ctx.beginPath();
      ctx.ellipse(bx + s * rx * 0.66, cy - ry * 0.72, rx * 0.42, ry * 0.24, s * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kindIdx === 3) {
    ctx.fillStyle = shade(color, 12);
    ctx.beginPath();
    ctx.moveTo(bx, cy - ry * 1.3);
    ctx.lineTo(bx + rx * 1.2, cy);
    ctx.lineTo(bx, cy + ry * 1.26);
    ctx.lineTo(bx - rx * 1.2, cy);
    ctx.closePath();
    ctx.fill();
    strokeOutline(ctx, shade(color, 12), 2);
    ctx.strokeStyle = shade(color, 26);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (const s of [-1, 1] as const) {
      ctx.beginPath();
      ctx.moveTo(bx + s * rx * 0.3, by);
      ctx.quadraticCurveTo(bx + s * rx * 0.7, by + h * 0.12, bx + s * rx * 0.5, by + h * 0.2);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
  } else if (kindIdx === 4) {
    ctx.fillStyle = shade(color, -18);
    for (const [dx, dy] of [
      [-0.42, -0.78],
      [0, -1.0],
      [0.42, -0.78],
    ] as Array<[number, number]>) {
      ctx.beginPath();
      ctx.arc(bx + rx * dx, cy + ry * dy, rx * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // 短圆四肢(手在身侧、脚在身底)
  ctx.fillStyle = shade(color, -8);
  for (const s of [-1, 1] as const) {
    ctx.beginPath();
    ctx.arc(bx + s * rx * 1.02, cy + ry * 0.16, rx * 0.17, 0, Math.PI * 2);
    ctx.fill();
    strokeOutline(ctx, shade(color, -8), 1.5);
    ctx.fillStyle = shade(color, -8);
    ctx.beginPath();
    ctx.ellipse(bx + s * rx * 0.44, by - h * 0.03, rx * 0.24, h * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // 本体:三停径向渐变(+20 → 本体 → −16),高光偏左上 45°
  const grad = ctx.createRadialGradient(bx - rx * 0.36, cy - ry * 0.42, rx * 0.14, bx, cy, Math.max(rx, ry) * 1.06);
  grad.addColorStop(0, shade(color, 20));
  grad.addColorStop(0.55, color);
  grad.addColorStop(1, shade(color, -16));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(bx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shade(color, -26);
  ctx.lineWidth = 2;
  ctx.stroke();
  // 皱眉鼓腮脸(倒 U 撇嘴,无凶相只有「鼓着腮不服气」)
  ctx.strokeStyle = shade(color, -40);
  ctx.lineWidth = Math.max(1.5, ry * 0.06);
  ctx.lineCap = "round";
  for (const s of [-1, 1] as const) {
    ctx.beginPath();
    ctx.moveTo(bx + s * rx * 0.36, cy - ry * 0.56);
    ctx.lineTo(bx + s * rx * 0.1, cy - ry * 0.42);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
  enemyEyes(ctx, bx, cy - ry * 0.26, ry * 0.9, 0.24);
  ctx.fillStyle = withAlpha(shade(color, 22), 0.8);
  for (const s of [-1, 1] as const) {
    ctx.beginPath();
    ctx.ellipse(bx + s * rx * 0.42, cy - ry * 0.06, rx * 0.16, ry * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = shade(color, -40);
  ctx.lineWidth = Math.max(1.5, ry * 0.05);
  ctx.beginPath();
  ctx.arc(bx, cy + ry * 0.28, rx * 0.14, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  // 前景特征件
  if (kindIdx === 0) {
    // 头顶三色丸串(糖串首领)
    ctx.strokeStyle = "#B58A5C";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx, cy - ry * 0.98);
    ctx.lineTo(bx, cy - ry * 1.62);
    ctx.stroke();
    const dango = ["#F9C6D8", "#FFF3E8", "#BFE3B4"];
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = dango[i];
      ctx.beginPath();
      ctx.arc(bx, cy - ry * (1.5 - i * 0.2), rx * 0.11, 0, Math.PI * 2);
      ctx.fill();
      strokeOutline(ctx, dango[i], 1.5);
    }
  } else if (kindIdx === 1) {
    // 条纹腹:椭圆内两道深色横带(clip 进本体)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(bx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = withAlpha(shade(color, -30), 0.8);
    for (const dy of [0.3, 0.58]) {
      ctx.fillRect(bx - rx, cy + ry * dy, rx * 2, ry * 0.14);
    }
    ctx.restore();
  } else if (kindIdx === 2) {
    // 方下巴 + 眉檐(石像)
    ctx.fillStyle = shade(color, -14);
    ctx.fillRect(bx - rx * 0.3, cy + ry * 0.4, rx * 0.6, ry * 0.22);
    strokeOutline(ctx, shade(color, -14), 1.5);
    ctx.fillStyle = shade(color, -26);
    ctx.fillRect(bx - rx * 0.42, cy - ry * 0.52, rx * 0.84, ry * 0.1);
  } else if (kindIdx === 5) {
    // 雪球肚 + 毛线帽(雪首领)
    const belly = ctx.createRadialGradient(bx - rx * 0.12, cy + ry * 0.1, rx * 0.05, bx, cy + ry * 0.24, rx * 0.4);
    belly.addColorStop(0, "#FFFFFF");
    belly.addColorStop(1, "#DFE8F2");
    ctx.fillStyle = belly;
    ctx.beginPath();
    ctx.arc(bx, cy + ry * 0.24, rx * 0.38, 0, Math.PI * 2);
    ctx.fill();
    strokeOutline(ctx, "#DFE8F2", 1.5);
    ctx.fillStyle = shade(color, -24);
    ctx.beginPath();
    ctx.arc(bx, cy - ry * 0.88, rx * 0.3, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(bx - rx * 0.32, cy - ry * 0.94, rx * 0.64, ry * 0.09);
    ctx.beginPath();
    ctx.arc(bx, cy - ry * 1.2, rx * 0.08, 0, Math.PI * 2);
    ctx.fill();
  } else if (kindIdx === 6) {
    // 大王冠(王者):金 2 停三齿
    const cw = rx * 0.5;
    const baseY = cy - ry * 0.92;
    const ch = ry * 0.42;
    const gold = ctx.createLinearGradient(0, baseY - ch * 1.15, 0, baseY);
    gold.addColorStop(0, shade(PP_COLORS.ppGold, 18));
    gold.addColorStop(1, PP_COLORS.ppGold);
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.moveTo(bx - cw, baseY);
    ctx.lineTo(bx - cw, baseY - ch * 0.9);
    ctx.lineTo(bx - cw * 0.5, baseY - ch * 0.45);
    ctx.lineTo(bx, baseY - ch * 1.15);
    ctx.lineTo(bx + cw * 0.5, baseY - ch * 0.45);
    ctx.lineTo(bx + cw, baseY - ch * 0.9);
    ctx.lineTo(bx + cw, baseY);
    ctx.closePath();
    ctx.fill();
    strokeOutline(ctx, PP_COLORS.ppGold, 1.5);
    ctx.fillStyle = PP_COLORS.ppRuby;
    ctx.beginPath();
    ctx.arc(bx, baseY - ch * 0.16, rx * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 修复员 R2(N2 + G4/L-1 + N4 画布部分):画布 emoji() 助手退休,小徽章全矢量。
// 工艺与既有画笔同规格:两停以上渐变、kit strokeOutline 描边(深 20%)、光照左上;
// 全部纯静态识别件(原 emoji 字形也是静态),reduced 无需分支,判定一概不沾。
// DOM 出场卡 / HUD chips 里的 emoji 属功能文字口径,不在此列(登记遗留交第 3 轮)。
// ---------------------------------------------------------------------------

/** 圆角矩形路径(visual13 本地小工具,画完不 fill 不 stroke) */
function badgeRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/** 徽章几何合法性:半径为正且圆心有限 */
function badgeOk(x: number, y: number, s: number): boolean {
  return s > 0 && Number.isFinite(x) && Number.isFinite(y);
}

/**
 * 挂锁(N2,替换门锁 emoji 字形,思路对齐 iff `drawPadlock`):
 * 圆环锁弓 + 金色 2 停圆角锁体 + 锁孔;open 时锁弓向右上掀起,开 / 合一眼分。
 * s 是锁体半高;开合语义由调用方读 `doorOpen(world)` 传入,这里只管画。
 */
export function drawPadlockBadge(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, open: boolean): void {
  if (!badgeOk(cx, cy, s)) return;
  const bw = s * 1.6;
  const bh = s * 1.4;
  const top = cy - s * 0.2;
  // 锁弓:先画,压在锁体后面
  ctx.strokeStyle = "#8C82A8";
  ctx.lineWidth = Math.max(1.2, s * 0.3);
  ctx.lineCap = "round";
  ctx.beginPath();
  if (open) {
    ctx.arc(cx + s * 0.5, top - s * 0.5, s * 0.58, Math.PI * 0.9, Math.PI * 1.85);
  } else {
    ctx.arc(cx, top - s * 0.45, s * 0.55, Math.PI, Math.PI * 2);
  }
  ctx.stroke();
  ctx.lineCap = "butt";
  // 锁体:金 2 停(顶亮底沉)圆角方 + 描边
  const gold = ctx.createLinearGradient(cx, top, cx, top + bh);
  gold.addColorStop(0, shade(PP_COLORS.ppGold, 16));
  gold.addColorStop(1, shade(PP_COLORS.ppGold, -8));
  badgeRect(ctx, cx - bw / 2, top, bw, bh, s * 0.3);
  ctx.fillStyle = gold;
  ctx.fill();
  strokeOutline(ctx, PP_COLORS.ppGold, 1.5);
  // 锁孔:圆头 + 短槽
  ctx.fillStyle = shade(PP_COLORS.ppGold, -46);
  ctx.beginPath();
  ctx.arc(cx, top + bh * 0.38, Math.max(0.8, s * 0.2), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - Math.max(0.5, s * 0.09), top + bh * 0.44, Math.max(1, s * 0.18), bh * 0.3);
}
