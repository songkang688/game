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
import {
  spawnRibbons,
  spawnSparkles,
  stepParticles,
  drawParticles,
  type Particle,
} from "../../art/kit/sparkle";

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
