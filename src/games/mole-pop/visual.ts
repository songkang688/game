// 地鼠嘭嘭 · 1.3 视觉层(B 档视觉升级)。
//
// 这里放的全是「怎么画」:七个 --mp- 配色 token、动效时序表、洞口三层土堆的
// DOM 层级序、洞内结构模板、种类 → SVG 的映射与装备显隐——全部纯数据与
// 纯函数,不碰 DOM,index.ts 只负责把这里算出来的字符串挂上去。
//
// 红线:这一层绝不读写出洞节奏 / hits 判定 / quiz 出题 / 存档;
// MOLE_SPECS 只读(按剩余敲击次数决定装备显隐,判定本身一个字不动);
// 洞按钮(热区)的几何(aspect-ratio 1、min 56px、grid gap 12px)与
// 升降的 translateY 时序(mpUp .18s / 6px / 22px / 26px)沿用 1.2,一个字不改。
import {
  MOLE_FUR_GOLD,
  bunnySvg,
  moleGearSvg,
  moleSvg,
  type MoleGear,
  type MolePose,
} from "../../art/kit/moleSvg";
import {
  drowseBoldGroup,
  flashCrestGroup,
  injectAccents,
  shieldSteelGroup,
} from "../../art/kit/moleAccents";
import { MOLE_SPECS, type MoleKind } from "./rhythm";

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

// ---------------------------------------------------------------------------
// 四、种类 → 画什么(纯映射;emoji 从此退休,九种角色全走自绘 SVG)
// ---------------------------------------------------------------------------

/** 洞里能出现的装备(独立 DOM 装备层) */
export type MoleGearKind = Exclude<MoleGear, "none">;

/**
 * 这一只现在该不该亮装备。只读 MOLE_SPECS[kind].hits(总共要敲几下)与
 * 已经吃了几下(hitsTaken):剩余 ≥ 2 下才带着装备——护盾鼠 / 帽子鼠
 * 第一下装备飞走,第二下才倒。算式鼠全程举小黑板。
 */
export function gearFor(kind: MoleKind, hitsTaken: number): MoleGearKind | null {
  if (kind === "quiz") return "board";
  if (kind === "shield" || kind === "hat") {
    const remaining = MOLE_SPECS[kind].hits - Math.max(0, hitsTaken);
    if (remaining < 2) return null;
    return kind === "shield" ? "shield" : "hat";
  }
  return null;
}

/**
 * 一只地鼠(或花花兔)的主体 SVG:种类差异靠皮毛色 / 瞌睡眼 / 星芒 / 剪影。
 * W6R1-05/06 修复:闪光鼠叠头顶天线星(剪影级差异 + 描边星芒),
 * 瞌睡鼠叠加粗闭眼弧与带描边瞌睡泡——kit 走 moleAccents 只增不改。
 */
export function moleFaceSvg(kind: MoleKind, pose: MolePose = "up"): string {
  if (kind === "bunny") return bunnySvg();
  if (kind === "gold") return moleSvg({ pose, fur: MOLE_FUR_GOLD });
  if (kind === "sleepy") return injectAccents(moleSvg({ pose, sleepy: true }), [drowseBoldGroup()]);
  if (kind === "flash") return injectAccents(moleSvg({ pose, sparkle: true }), [flashCrestGroup()]);
  return moleSvg({ pose });
}

/**
 * 装备层 SVG(黑板要把手写算式带上)。
 * W6R1-05 修复:盾面叠冷灰钢盾(灰度与皮毛拉开)+ 深描边 + 左上高光。
 */
export function gearSvgFor(gear: MoleGearKind, expr = ""): string {
  const svg = moleGearSvg(gear, expr);
  return gear === "shield" ? injectAccents(svg, [shieldSteelGroup()]) : svg;
}

/** 缩回时的姿态:没被敲到的可敲角色打个哈欠再降;花花兔照旧 */
export function dropPose(kind: MoleKind): MolePose {
  return MOLE_SPECS[kind].hittable ? "yawn" : "up";
}

// ---------------------------------------------------------------------------
// 五、场景氛围:白天草地果园 / 夜场自绘火把(互斥渲染,白天关不带火把节点)
// ---------------------------------------------------------------------------

/**
 * 草地果园背景:远景两棵圆树 + 栅栏 + 三排错落草丛,纯装饰、点不到。
 * viewBox 按 360×240 画,xMidYMax slice 贴住底部,窄屏只裁两侧。
 */
export function orchardSceneSvg(): string {
  const tuft = (x: number, y: number, s: number, fill: string): string =>
    `<path d="M${x} ${y}q${2 * s} ${-7 * s} ${4 * s} 0q${1 * s} ${-9 * s} ${3 * s} 0q${2 * s} ${-6 * s} ${4 * s} 0z" fill="${fill}"/>`;
  const row = (y: number, fill: string, offset: number, mark: string): string => {
    let out = `<g data-part="${mark}">`;
    for (let x = offset; x < 372; x += 46) out += tuft(x, y, 1.15, fill);
    return `${out}</g>`;
  };
  const tree = (x: number, y: number): string =>
    `<rect x="${x - 3.4}" y="${y}" width="6.8" height="18" rx="2.4" fill="#A87B4F"/>` +
    `<circle cx="${x}" cy="${y - 12}" r="20" fill="#7CBB5E"/>` +
    `<circle cx="${x - 11}" cy="${y - 5}" r="12" fill="#8BC96D"/>` +
    `<circle cx="${x + 11}" cy="${y - 5}" r="12" fill="#8BC96D"/>` +
    `<circle cx="${x - 6}" cy="${y - 15}" r="2.6" fill="#F27D93"/>` +
    `<circle cx="${x + 8}" cy="${y - 8}" r="2.6" fill="#F27D93"/>`;
  let fence = `<g data-part="fence"><rect x="0" y="66" width="360" height="3.4" rx="1.7" fill="#D9B98C"/><rect x="0" y="76" width="360" height="3.4" rx="1.7" fill="#D9B98C"/>`;
  for (let x = 12; x < 372; x += 44) {
    fence += `<rect x="${x}" y="58" width="5.4" height="28" rx="2.6" fill="#C89B6C"/>`;
  }
  fence += `</g>`;
  return (
    `<svg viewBox="0 0 360 240" width="100%" height="100%" preserveAspectRatio="xMidYMax slice" ` +
    `aria-hidden="true" focusable="false">` +
    `<g data-part="trees">${tree(52, 52)}${tree(310, 56)}</g>` +
    fence +
    row(108, "#ABD988", 6, "grass-far") +
    row(164, "#9FCF7A", 28, "grass-mid") +
    row(222, "#93C46C", 12, "grass-near") +
    `</svg>`
  );
}

/**
 * 夜场氛围层(B 档 TOP-7 落地):orchardSceneSvg 的夜姊妹件。
 * 月牙 + 五粒星子 + 远景剪影树,全是纯装饰、点不到;
 * 星子全部压在栅栏线(y=58)以上,不进洞区不抢玩法层。
 * 火把(torchFlamesHtml)与洞口暖光一字不动,叠在本层之上。
 */
export function nightSceneSvg(): string {
  const star = (x: number, y: number, r: number): string =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="#FFF3C9" opacity=".8"/>`;
  const treeShadow = (x: number, y: number): string =>
    `<rect x="${x - 3.4}" y="${y}" width="6.8" height="18" rx="2.4" fill="#3C3A55"/>` +
    `<circle cx="${x}" cy="${y - 12}" r="20" fill="#3C3A55"/>` +
    `<circle cx="${x - 11}" cy="${y - 5}" r="12" fill="#3C3A55"/>` +
    `<circle cx="${x + 11}" cy="${y - 5}" r="12" fill="#3C3A55"/>`;
  return (
    `<svg viewBox="0 0 360 240" width="100%" height="100%" preserveAspectRatio="xMidYMax slice" ` +
    `aria-hidden="true" focusable="false">` +
    `<defs><mask id="mp-night-moon"><rect width="360" height="240" fill="#fff"/>` +
    `<circle cx="265" cy="19" r="11.5" fill="#000"/></mask></defs>` +
    `<g data-part="night-trees">${treeShadow(52, 52)}${treeShadow(310, 56)}</g>` +
    `<g data-part="moon"><circle cx="259" cy="24" r="14" fill="#FFF3C9" mask="url(#mp-night-moon)"/></g>` +
    `<g data-part="stars">${star(36, 30, 1.5)}${star(96, 18, 1.2)}${star(150, 42, 1.8)}${star(206, 22, 1.3)}${star(322, 48, 1.5)}</g>` +
    `</svg>`
  );
}

/**
 * 夜场火把:双层火苗(外橙内黄,错相摇曳)+ 杆子 + 洞口暖光底晕。
 * 暖光用 var(--mp-torch),色值只在 token 里出现一次。
 */
export function torchFlameSvg(): string {
  return (
    `<svg viewBox="0 0 24 40" width="100%" height="100%" aria-hidden="true" focusable="false">` +
    `<ellipse cx="12" cy="16" rx="11" ry="13" fill="var(--mp-torch)"/>` +
    `<rect x="10" y="22" width="4" height="16" rx="2" fill="#8A6B4A"/>` +
    `<g data-part="flame-outer"><path d="M12 2c6 7 8 12 8 16a8 8 0 0 1-16 0c0-4 2-9 8-16z" fill="#FFB347"/></g>` +
    `<g data-part="flame-inner"><path d="M12 9c3 4 4.4 7 4.4 9.4a4.4 4.4 0 0 1-8.8 0c0-2.4 1.4-5.4 4.4-9.4z" fill="#FFE08A"/></g>` +
    `</svg>`
  );
}

/** 夜场左右各一支火把(只在 night 关渲染,白天关不引入这些节点) */
export function torchFlamesHtml(): string {
  const flame = torchFlameSvg();
  return `<span class="mp-flame mp-flame-l">${flame}</span><span class="mp-flame mp-flame-r">${flame}</span>`;
}
