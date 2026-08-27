// 地鼠嘭嘭 · 1.3 视觉层(B 档视觉升级)。
//
// 这里放的全是「怎么画」:七个 --mp- 配色 token、动效时序表、洞口三层土堆的
// DOM 层级序、洞内结构模板与整张样式表——全部纯数据与纯字符串,不碰 DOM,
// index.ts 只负责把这里的字符串挂上去。
//
// 红线:这一层绝不读写出洞节奏 / hits 判定 / quiz 出题 / 存档;
// 洞按钮(热区)的几何(aspect-ratio 1、min 56px、grid gap 12px)与
// 升降的 translateY 时序(mpUp .18s / 6px / 22px / 26px)沿用 1.2,一个字不改。

// ---------------------------------------------------------------------------
// 一、配色 token(1.3 规格表原样落成常量,动一个色值单测就红)
// ---------------------------------------------------------------------------

export const MP_TOKENS = {
  /** 草地背景主色 */
  "--mp-grass": "#B8E39B",
  /** 洞后沿土堆(深) */
  "--mp-soil-back": "#A87B4F",
  /** 洞前沿土堆(浅) */
  "--mp-soil-front": "#C89B6C",
  /** 洞内暗部:径向渐变 #5A4636 → #3E3226 */
  "--mp-hole": "radial-gradient(ellipse at 50% 38%, #5A4636 0%, #3E3226 78%)",
  /** 地鼠皮毛主色 */
  "--mp-mole": "#D9A06B",
  /** 算术小黑板板面 */
  "--mp-board": "#4A3B2E",
  /** 夜场洞口暖光圈 */
  "--mp-torch": "rgba(255,200,120,.4)",
} as const;

// ---------------------------------------------------------------------------
// 二、动效时序表(毫秒;CSS 里全部写成 var(--mp-*-ms) 自定义属性)
// ---------------------------------------------------------------------------

export const MP_TIMING = {
  /** 冒头预告:洞口土粒抖两下 */
  peekMs: 150,
  /** 第一下敲中,装备(盾/帽)抛物线飞走 */
  gearFlyMs: 260,
  /** 被敲压扁 0.8 倍回弹 */
  bonkMs: 180,
  /** 被敲反馈帧(压扁+星星圈)在洞口停留多久后收走 */
  bonkHoldMs: 420,
  /** 算术小黑板轻摆 ±3° 一个来回 */
  cardSwayMs: 900,
  /** 连击数字跳动 scale 1.2 → 1 */
  comboPopMs: 120,
  /** 夜场火苗双层摇曳周期 */
  flameMs: 700,
} as const;

/**
 * 升降沿用 1.2 的既有时序,这里只是「钉住」供单测断言:
 * mpUp 动画 0.18s、站定 translateY(6px)、缩回 translateY(22px)、起点 26px。
 */
export const MP_RISE_ANIM = "mpUp .18s ease";
export const MP_FACE_UP_Y = "translateY(6px)";
export const MP_FACE_DROP_Y = "translateY(22px)";
export const MP_FACE_FROM_Y = "translateY(26px)";

// ---------------------------------------------------------------------------
// 三、洞内 DOM 层级(z-index 从低到高;热区是洞按钮本体,永远在最顶接点击)
// ---------------------------------------------------------------------------

export const MP_Z = {
  /** ① 洞内暗部 */
  pit: 1,
  /** ② 后沿土堆(深色弧) */
  moundBack: 2,
  /** ③ 地鼠层(overflow:hidden 裁剪升降) */
  lift: 3,
  /** ④ 装备层(盾/帽/黑板,独立元素) */
  gear: 4,
  /** ⑤ 前沿土堆(浅色弧,盖住地鼠下半身) */
  moundFront: 5,
  /** ⑥ 敲击反馈(星星圈/压扁帧) */
  fx: 6,
} as const;

/**
 * 每个洞按钮的内部结构:六层全是 pointer-events:none 的装饰,
 * 点击仍落在按钮本体上——热区几何与 1.2 完全一致。
 */
export function holeInnerHtml(): string {
  return (
    `<span class="mp-pit"></span>` +
    `<span class="mp-mound-back"></span>` +
    `<span class="mp-lift"></span>` +
    `<span class="mp-gear"></span>` +
    `<span class="mp-mound-front"></span>` +
    `<span class="mp-fx"></span>`
  );
}

// 样式表本体留在 index.ts 的模板字面量里(既有 360px 窄屏 QA 直接从那边源码
// 抠 CSS,搬走会把老用例弄红)。这里的常量是唯一口径,视觉单测负责把
// index.ts 里的 CSS 与这里的 token / 时序 / z 序逐一对账,漂移就红。
