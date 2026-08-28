/**
 * 勇者小路 · 纯视觉模块（1.3 第 17 步 A 档新增）。
 *
 * 只管「长什么样」：配色 token、DOM 层级序、动效时序、血条分段、稀有度分档、
 * 冷却扇形角度、迷雾可见集、迷宫格子的 class/innerHTML 视图。
 * **一行玩法逻辑都没有**——不 import logic/combat/levels/maze，不读写存档，
 * 全部是可以在 node 环境直接单测的纯函数。
 */

import { badge } from "../../art/kit/badge";

/* ------------------------------------------------------------------ */
/* 配色 token（四·补一规格表，落在组件根 .bvp-root 上）                    */
/* ------------------------------------------------------------------ */

export const BVP_TOKENS = {
  "--bvp-floor": "#F6EFE4",
  "--bvp-floor-edge": "#D9C9A8",
  "--bvp-wall": "#C7B8D8",
  "--bvp-moss": "#9FD98B",
  "--bvp-fog": "rgba(120,120,140,.55)",
  "--bvp-torch": "rgba(255,200,120,.35)",
  "--bvp-hp-hi": "#8FD98B",
  "--bvp-hp-mid": "#F0C25A",
  "--bvp-hp-low": "#F4859F"
} as const;

/**
 * DOM 层级序（z-index 从低到高）：
 * ① 迷宫格底 → ② 格内徽章 → ③ 迷雾层 → ④ 暖光圈 → ⑤ 战斗浮层 → ⑥ 顶栏 HUD → ⑦ 结算浮层。
 * 迷雾必须盖住徽章但不得盖顶栏。
 */
export const BVP_LAYERS = {
  "--bvp-z-cell": 1,
  "--bvp-z-badge": 2,
  "--bvp-z-fog": 3,
  "--bvp-z-torch": 4,
  "--bvp-z-battle": 5,
  "--bvp-z-hud": 6,
  "--bvp-z-settle": 7
} as const;

/** 动效时序（毫秒，四·补三规格表）；reduced 下由 CSS 归零或换静态 */
export const BVP_TIMING = {
  "--bvp-t-breath": 2000,
  "--bvp-t-fog": 280,
  "--bvp-t-float": 420,
  "--bvp-t-shake": 160,
  "--bvp-t-turn": 180,
  "--bvp-t-lit": 90
} as const;

/** 把三张表拼成 CSS 自定义属性声明串，塞进 .bvp-root{} 顶部 */
export function tokenCss(): string {
  const rows: string[] = [];
  for (const [k, v] of Object.entries(BVP_TOKENS)) rows.push(`${k}:${v}`);
  for (const [k, v] of Object.entries(BVP_LAYERS)) rows.push(`${k}:${v}`);
  for (const [k, v] of Object.entries(BVP_TIMING)) rows.push(`${k}:${v}ms`);
  return `${rows.join(";")};`;
}

/* ------------------------------------------------------------------ */
/* 血条三段色：绿 → 黄 → 粉                                              */
/* ------------------------------------------------------------------ */

export type HpSegment = "hi" | "mid" | "low";

/** 星芒占比 → 分段：> .55 绿、> .25 黄、其余粉；脏数字一律按低段兜底 */
export function hpSegment(ratio: number): HpSegment {
  if (!Number.isFinite(ratio)) return "low";
  if (ratio > 0.55) return "hi";
  if (ratio > 0.25) return "mid";
  return "low";
}

/** 只读 hp / maxHp，绝不写回；对象可以是冻结的 */
export function hpSegmentOf(f: { hp: number; maxHp: number }): HpSegment {
  return hpSegment(f.maxHp > 0 ? f.hp / f.maxHp : 0);
}

/* ------------------------------------------------------------------ */
/* 冷却扇形罩                                                          */
/* ------------------------------------------------------------------ */

/** 冷却比例（0..1）→ conic-gradient 的扇形角度（0..360°） */
export function cooldownAngle(ratio: number): number {
  const r = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  return r * 360;
}

/* ------------------------------------------------------------------ */
/* 稀有度色阶：灰 / 蓝 / 金（边框颜色 + 粗细同步分档，色弱也分得清）           */
/* ------------------------------------------------------------------ */

export type Rarity = "common" | "rare" | "epic";

/** 装备按解锁等级分档：1–8 灰、16–26 蓝、38+ 金 */
export function gearRarity(reqLevel: number): Rarity {
  if (reqLevel >= 38) return "epic";
  if (reqLevel >= 16) return "rare";
  return "common";
}

/** 技能按学习点数分档：1 点灰、2 点蓝、3+ 点金 */
export function skillRarity(cost: number): Rarity {
  if (cost >= 3) return "epic";
  if (cost >= 2) return "rare";
  return "common";
}

/** 道具按价格分档 */
export function itemRarity(price: number): Rarity {
  if (price >= 45) return "epic";
  if (price >= 25) return "rare";
  return "common";
}

/* ------------------------------------------------------------------ */
/* 阵营 → 徽章套系映射                                                  */
/* ------------------------------------------------------------------ */

export type BvpElement = "fire" | "water" | "grass" | "light" | "dark";

/** 勇者侧：火 / 暗走剑士金环，光走牧师粉环，水 / 草走法师蓝环 */
export function heroBadgeKind(element: BvpElement): "swordsman" | "mage" | "priest" {
  if (element === "fire" || element === "dark") return "swordsman";
  if (element === "light") return "priest";
  return "mage";
}

/** 怪物侧：草 / 水是果冻怪，火是蘑菇怪，光 / 暗是石头怪 */
export function foeBadgeKind(element: BvpElement): "jelly" | "mushroom" | "rock" {
  if (element === "grass" || element === "water") return "jelly";
  if (element === "fire") return "mushroom";
  return "rock";
}

/* ------------------------------------------------------------------ */
/* reduced-motion：动效类名的开关都从这一处发                              */
/* ------------------------------------------------------------------ */

interface MatchMediaHost {
  matchMedia?: (query: string) => { matches: boolean };
}

/** 读系统的 prefers-reduced-motion；node / 老环境一律当「不减弱」 */
export function prefersReducedMotion(host?: MatchMediaHost): boolean {
  const w = host ?? (globalThis as MatchMediaHost);
  try {
    return Boolean(w.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  } catch {
    return false;
  }
}

export interface FxPlan {
  /** 受击抖动类；reduced 下不加 */
  shake: string;
  /** 受击数字类；reduced 下换成原地显示 */
  float: string;
  /** 过层小路点亮类；reduced 下不加（一次性全亮） */
  dotLit: string;
  /** 胜利星屑彩纸开关 */
  confetti: boolean;
}

/** 抖动 / 上飘 / 点亮 / 彩纸的类名计划：reduced 一把闸 */
export function fxClassPlan(reduced: boolean): FxPlan {
  return {
    shake: reduced ? "" : "bvp-hit",
    float: reduced ? "bvp-float bvp-float-still" : "bvp-float",
    dotLit: reduced ? "" : "bvp-dot-lit",
    confetti: !reduced
  };
}

/** 过层小路逐格点亮的延迟（毫秒） */
export function litDelayMs(index: number): number {
  return Math.max(0, index) * BVP_TIMING["--bvp-t-lit"];
}

/* ------------------------------------------------------------------ */
/* 迷雾可见集：走过的格 + 周围一圈算「看见了」                              */
/* ------------------------------------------------------------------ */

export function seenSet(been: Iterable<string>, rows: number, cols: number): Set<string> {
  const out = new Set<string>();
  for (const key of been) {
    const [r, c] = key.split(",").map(Number);
    if (!Number.isFinite(r) || !Number.isFinite(c)) continue;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.add(`${nr},${nc}`);
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 迷宫格子视图：class + innerHTML 一次算好                               */
/* ------------------------------------------------------------------ */

export interface MazeCellState {
  wall: boolean;
  /** 走过（留脚印） */
  been: boolean;
  /** 看见过（不盖雾） */
  seen: boolean;
  isMe: boolean;
  isGhost: boolean;
  /** 与勇者相邻的可走格（微亮） */
  nearMe: boolean;
  item: "" | "key" | "door" | "lock" | "exit";
}

/* ------------------------------------------------------------------ */
/* 迷宫拾取物：与勇者/影子徽章同族的参数化 SVG（W6R1-03 修复）            */
/* 约定同 badge 套件：墨色描边 1.5px、底部落影椭圆、左上高光、粉彩色板。   */
/* 迷雾剪影仍走 .bvp-mz-fog 的 brightness(0) 滤镜，SVG 同样只露轮廓。    */
/* ------------------------------------------------------------------ */

const ITEM_INK = "#4B3A6E";
const ITEM_SHADOW = "rgba(0,0,0,.12)";
const ITEM_GOLD = "#F0C25A";
const ITEM_WOOD = "#C89B6C";

function itemWrap(kind: string, inner: string): string {
  return (
    `<svg class="bvp-it bvp-it-${kind}" viewBox="0 0 64 64" width="100%" height="100%" ` +
    `aria-hidden="true" focusable="false">` +
    `<ellipse cx="32" cy="56" rx="14" ry="3.2" fill="${ITEM_SHADOW}"/>` +
    inner +
    `</svg>`
  );
}

/** 钥匙：金色圆环头 + 键身双齿，环上左上高光弧 */
function keyItemSvg(): string {
  return itemWrap(
    "key",
    `<circle cx="32" cy="19" r="9.5" fill="${ITEM_GOLD}" stroke="${ITEM_INK}" stroke-width="1.5"/>` +
      `<circle cx="32" cy="19" r="4" fill="#FFF7EC" stroke="${ITEM_INK}" stroke-width="1.2"/>` +
      `<path d="M29 28.5h6v18.5l-3 4-3-4z" fill="${ITEM_GOLD}" stroke="${ITEM_INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
      `<path d="M35 36.5h5.6v3.6H35zM35 43h4.4v3.6H35z" fill="${ITEM_GOLD}" stroke="${ITEM_INK}" stroke-width="1.3" stroke-linejoin="round"/>` +
      `<path d="M25.6 14.4a8 8 0 0 1 5.4-3.4" stroke="rgba(255,255,255,.85)" stroke-width="2" fill="none" stroke-linecap="round"/>`
  );
}

/** 门：拱顶木门 + 板缝 + 金门把 + 门槛石，左上一道受光弧 */
function doorItemSvg(): string {
  return itemWrap(
    "door",
    `<path d="M18.5 51.5v-22a13.5 13.5 0 0 1 27 0v22z" fill="${ITEM_WOOD}" stroke="${ITEM_INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
      `<path d="M40.5 51.5v-28a13.5 13.5 0 0 1 5 6v22z" fill="rgba(90,60,30,.22)"/>` +
      `<path d="M27 51.5V18.8M36 51.5v-33.6" stroke="rgba(90,60,30,.35)" stroke-width="1.2"/>` +
      `<path d="M21.5 28.5a11 11 0 0 1 6.5-8.8" stroke="rgba(255,255,255,.7)" stroke-width="2" fill="none" stroke-linecap="round"/>` +
      `<circle cx="38.5" cy="38" r="2.4" fill="${ITEM_GOLD}" stroke="${ITEM_INK}" stroke-width="1"/>` +
      `<rect x="15" y="50.5" width="34" height="4.4" rx="2.2" fill="#D9C9A8" stroke="${ITEM_INK}" stroke-width="1.2"/>`
  );
}

/** 锁：银色锁梁 + 金色锁身（顶部受光带）+ 墨色锁孔 */
function lockItemSvg(): string {
  return itemWrap(
    "lock",
    `<path d="M23.5 30v-6.5a8.5 8.5 0 0 1 17 0V30" stroke="${ITEM_INK}" stroke-width="6.4" fill="none" stroke-linecap="round"/>` +
      `<path d="M23.5 30v-6.5a8.5 8.5 0 0 1 17 0V30" stroke="#AEB6CC" stroke-width="4" fill="none" stroke-linecap="round"/>` +
      `<path d="M25.5 22a6.5 6.5 0 0 1 4.4-5.4" stroke="rgba(255,255,255,.8)" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
      `<rect x="18" y="29" width="28" height="22.5" rx="6" fill="${ITEM_GOLD}" stroke="${ITEM_INK}" stroke-width="1.5"/>` +
      `<path d="M18 35.5c0-3.6 2.9-6.5 6.5-6.5h15c3.6 0 6.5 2.9 6.5 6.5z" fill="rgba(255,255,255,.4)"/>` +
      `<circle cx="32" cy="39.5" r="2.8" fill="${ITEM_INK}"/>` +
      `<path d="M30.8 40.5h2.4v6h-2.4z" fill="${ITEM_INK}"/>`
  );
}

/** 终点：木旗杆 + 黑白棋盘小旗（3×3 交错），杆顶圆头 */
function exitItemSvg(): string {
  const cw = 7;
  const ch = 5.4;
  let checks = "";
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if ((r + c) % 2 === 0) {
        checks += `<rect x="${(24 + c * cw).toFixed(1)}" y="${(14 + r * ch).toFixed(1)}" width="${cw}" height="${ch}" fill="${ITEM_INK}"/>`;
      }
    }
  }
  return itemWrap(
    "exit",
    `<rect x="19.6" y="12" width="3.4" height="42" rx="1.6" fill="${ITEM_WOOD}" stroke="${ITEM_INK}" stroke-width="1"/>` +
      `<circle cx="21.3" cy="11" r="2.4" fill="${ITEM_GOLD}" stroke="${ITEM_INK}" stroke-width="1"/>` +
      `<rect x="24" y="14" width="21" height="16.2" fill="#FFF7EC" stroke="${ITEM_INK}" stroke-width="1.5"/>` +
      checks +
      `<path d="M25 15.6a4 4 0 0 1 3-1.2" stroke="rgba(255,255,255,.85)" stroke-width="1.6" fill="none" stroke-linecap="round"/>`
  );
}

const ITEM_SVG: Record<Exclude<MazeCellState["item"], "">, () => string> = {
  key: keyItemSvg,
  door: doorItemSvg,
  lock: lockItemSvg,
  exit: exitItemSvg
};

/** 迷宫拾取物 SVG（导出供视觉用例咬字符串） */
export function mazeItemSvg(item: Exclude<MazeCellState["item"], "">): string {
  return ITEM_SVG[item]();
}

/**
 * 一格迷宫的皮：勇者 = 朵朵五瓣花徽章（SVG），影子 = 星星徽章（SVG），
 * 钥匙 / 门 / 锁 / 出口 = 同族拾取物 SVG（迷雾下经 brightness(0) 只露轮廓）。
 * 功能类名 `bvp-mz-ghost` / `bvp-mz-me` 原样保留，只换皮不换判定。
 */
export function mazeCellView(s: MazeCellState): { cls: string; html: string } {
  if (s.wall) {
    return { cls: `bvp-mz bvp-mz-wall${s.seen ? "" : " bvp-mz-fog"}`, html: "" };
  }
  let cls = "bvp-mz";
  if (s.been) cls += " bvp-mz-been";
  if (s.nearMe && !s.isMe) cls += " bvp-mz-near";
  if (!s.seen) cls += " bvp-mz-fog";
  let html = s.item === "" ? "" : `<span class="bvp-mz-it">${mazeItemSvg(s.item)}</span>`;
  if (s.isGhost && !s.isMe) {
    cls += " bvp-mz-ghost";
    html = `<span class="bvp-mz-badge">${badge("star", { camp: "foe" })}</span>`;
  }
  if (s.isMe) {
    cls += " bvp-mz-me";
    html = `<span class="bvp-mz-badge">${badge("flower", { camp: "hero" })}</span>`;
  }
  return { cls, html };
}

/* ------------------------------------------------------------------ */
/* 行图标族（W6R1-07 修复）：选项卡 / 背包 / 商店的大号 emoji 图标         */
/* 换成与 mazeItemSvg 同族的参数化 SVG：64 视窗、底部落影椭圆、           */
/* 1.5px 墨描边、左上高光、粉彩色板。调用方按语义要图                     */
/* （道具 id / 装备槽 / 技能类型 / 步骤节点 / 补给 / 祝福），数据定义里的  */
/* emoji 字段一个不动；未知键回退空串，由调用方兜底回 emoji 文本。         */
/* ------------------------------------------------------------------ */

/** 元素色（图标主色通道；与徽章族粉彩同调） */
export const ELEMENT_TINT: Record<BvpElement, string> = {
  fire: "#F08A5A",
  water: "#6FAFE8",
  grass: "#8FCB6B",
  light: "#F0C25A",
  dark: "#9B86C9"
};

/** 稀有度主色（与 .bvp-ico 边框三档同色：灰 / 蓝 / 金） */
export const RARITY_TINT: Record<Rarity, string> = {
  common: "#AEB6CC",
  rare: "#5F9BE8",
  epic: "#E3A82F"
};

function iconWrap(kind: string, inner: string): string {
  return (
    `<svg class="bvp-ric bvp-ric-${kind}" viewBox="0 0 64 64" width="100%" height="100%" ` +
    `aria-hidden="true" focusable="false">` +
    `<ellipse cx="32" cy="56" rx="14" ry="3.2" fill="${ITEM_SHADOW}"/>` +
    inner +
    `</svg>`
  );
}

/** 左上高光弧（同族约定：白 .8 圆头短弧） */
function hlArc(d: string, w = 1.8): string {
  return `<path d="${d}" stroke="rgba(255,255,255,.8)" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
}

/* ---- 共用小件（心 / 盾 / 剑 / 铃 / 金币 / 果冻怪），参数化配色 ---- */

function heartGlyph(tint: string): string {
  return (
    `<path d="M32 49c-9.5-6.4-15.5-12.6-15.5-19.6 0-5 3.9-8.9 8.2-8.9 3 0 5.8 1.8 7.3 4.3 1.5-2.5 4.3-4.3 7.3-4.3 4.3 0 8.2 3.9 8.2 8.9 0 7-6 13.2-15.5 19.6z" ` +
    `fill="${tint}" stroke="${ITEM_INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
    hlArc("M22.5 26.5a6.4 6.4 0 0 1 4.4-3.6")
  );
}

function shieldGlyph(tint: string, crack = false): string {
  return (
    `<path d="M32 15.5l13.5 4.8v10c0 9.6-5.7 16.4-13.5 19.4-7.8-3-13.5-9.8-13.5-19.4v-10z" ` +
    `fill="${tint}" stroke="${ITEM_INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M32 15.5l13.5 4.8v10c0 1.4-.1 2.7-.4 4L32 24z" fill="rgba(255,255,255,.28)"/>` +
    (crack
      ? `<path d="M32 20l-3.5 8 5 3.5-4 9" stroke="${ITEM_INK}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
      : "") +
    hlArc("M22.5 22.5a17 17 0 0 1 6.5-4")
  );
}

function swordGlyph(tint: string): string {
  return (
    `<path d="M32 10.5l4.4 5.4-2.4 21.6h-4l-2.4-21.6z" fill="${tint}" stroke="${ITEM_INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M32 12.6v24.9" stroke="rgba(255,255,255,.55)" stroke-width="1.1"/>` +
    `<rect x="24.5" y="37.5" width="15" height="4.4" rx="2.2" fill="${ITEM_GOLD}" stroke="${ITEM_INK}" stroke-width="1.3"/>` +
    `<rect x="30" y="41.9" width="4" height="9" rx="1.8" fill="${ITEM_WOOD}" stroke="${ITEM_INK}" stroke-width="1.2"/>` +
    `<circle cx="32" cy="52.6" r="2.2" fill="${ITEM_GOLD}" stroke="${ITEM_INK}" stroke-width="1.1"/>`
  );
}

function bellGlyph(tint: string): string {
  return (
    `<path d="M32 17c7 0 10.6 5.2 10.6 11.6v6.8l3 4.6H18.4l3-4.6v-6.8C21.4 22.2 25 17 32 17z" ` +
    `fill="${tint}" stroke="${ITEM_INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<circle cx="32" cy="14.6" r="2.6" fill="${ITEM_WOOD}" stroke="${ITEM_INK}" stroke-width="1.2"/>` +
    `<circle cx="32" cy="44.5" r="3.4" fill="${ITEM_WOOD}" stroke="${ITEM_INK}" stroke-width="1.3"/>` +
    hlArc("M24.5 23a9 9 0 0 1 5-3.6")
  );
}

function coinGlyph(): string {
  return (
    `<circle cx="32" cy="33" r="15" fill="${ITEM_GOLD}" stroke="${ITEM_INK}" stroke-width="1.5"/>` +
    `<circle cx="32" cy="33" r="10.4" fill="none" stroke="rgba(122,90,30,.5)" stroke-width="1.4"/>` +
    `<path d="M32 27.4l1.7 3.5 3.9.5-2.8 2.7.7 3.9-3.5-1.9-3.5 1.9.7-3.9-2.8-2.7 3.9-.5z" fill="#FFF7EC" stroke="rgba(122,90,30,.5)" stroke-width="1"/>` +
    hlArc("M22.6 26.6a12 12 0 0 1 6-4.6")
  );
}

/** 果冻小怪：软团 + 波浪底 + 豆豆眼（原创造型，颜色随元素） */
function blobGlyph(tint: string, opts?: { crown?: "gold" | "star" }): string {
  const crown =
    opts?.crown === "gold"
      ? `<path d="M24 15.6l3.4 3.2 4.6-5.4 4.6 5.4 3.4-3.2v5.2H24z" fill="${ITEM_GOLD}" stroke="${ITEM_INK}" stroke-width="1.3" stroke-linejoin="round"/>`
      : opts?.crown === "star"
        ? `<path d="M32 8.5l1.9 4 4.4.6-3.2 3 .8 4.3-3.9-2.1-3.9 2.1.8-4.3-3.2-3 4.4-.6z" fill="${ITEM_GOLD}" stroke="${ITEM_INK}" stroke-width="1.3" stroke-linejoin="round"/>`
        : "";
  return (
    crown +
    `<path d="M32 19c8.8 0 14.6 6.6 14.6 14.2 0 4.6-1.6 8.4-1.6 12.3l-4.2-2.8-4.4 3.6-4.4-3.6-4.4 3.6-4.4-3.6-4.2 2.8c0-3.9-1.6-7.7-1.6-12.3C17.4 25.6 23.2 19 32 19z" ` +
    `fill="${tint}" stroke="${ITEM_INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<circle cx="27" cy="33" r="2.1" fill="${ITEM_INK}"/><circle cx="37" cy="33" r="2.1" fill="${ITEM_INK}"/>` +
    `<circle cx="27.7" cy="32.3" r=".7" fill="#fff"/><circle cx="37.7" cy="32.3" r=".7" fill="#fff"/>` +
    `<path d="M28.6 38.6q3.4 2.6 6.8 0" stroke="${ITEM_INK}" stroke-width="1.4" fill="none" stroke-linecap="round"/>` +
    hlArc("M23 26a10.5 10.5 0 0 1 5.6-4.2")
  );
}

/* ---- 道具（战斗背包 / 商店，按 ITEMS 的 id 要图） ---- */

const ITEM_ICONS: Record<string, () => string> = {
  berry: () =>
    `<path d="M32 22.5c7.6 0 12.4 4.6 12.4 11 0 8.4-6.6 14.6-12.4 16.6-5.8-2-12.4-8.2-12.4-16.6 0-6.4 4.8-11 12.4-11z" ` +
    `fill="#F4859F" stroke="${ITEM_INK}" stroke-width="1.5"/>` +
    `<path d="M25.5 20.5c2.4-3.6 10.6-3.6 13 0-2.6 1.9-4.6 2.6-6.5 2.6s-3.9-.7-6.5-2.6z" fill="#8FCB6B" stroke="${ITEM_INK}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<circle cx="27" cy="32" r="1.1" fill="#FFF7EC"/><circle cx="36.5" cy="30.5" r="1.1" fill="#FFF7EC"/>` +
    `<circle cx="31.5" cy="38.5" r="1.1" fill="#FFF7EC"/><circle cx="37.5" cy="41" r="1.1" fill="#FFF7EC"/>` +
    hlArc("M24.3 28.4a8.8 8.8 0 0 1 4.6-4"),
  honey: () =>
    `<path d="M22.4 29.5c-1.9 2.4-3 5.2-3 8.2 0 7.6 5.7 12.8 12.6 12.8s12.6-5.2 12.6-12.8c0-3-1.1-5.8-3-8.2z" ` +
    `fill="#E8B05A" stroke="${ITEM_INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<rect x="23.5" y="24.5" width="17" height="5.6" rx="2.8" fill="#C89B6C" stroke="${ITEM_INK}" stroke-width="1.4"/>` +
    `<path d="M22 39.5h20" stroke="rgba(122,82,30,.4)" stroke-width="1.6"/>` +
    hlArc("M22.8 35.4a9.6 9.6 0 0 1 4-5.2"),
  bell: () => bellGlyph(ITEM_GOLD),
  pepper: () =>
    `<path d="M38.6 22.6c5.4 2.8 7.6 9.6 4.8 16.6-3 7.4-10.6 12.4-16.4 11.2 4.6-3.9 7.5-8.6 8.6-14.2.9-4.7 1-9.2 3-13.6z" ` +
    `fill="#E85D5D" stroke="${ITEM_INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M38.2 22.8c-.6-3 .8-5.4 3.6-6.4" stroke="#6E9C4A" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
    hlArc("M38.9 27.2a12.5 12.5 0 0 1 .9 5.4", 1.6),
  hammer: () =>
    `<rect x="19.5" y="18.5" width="25" height="12.5" rx="4" fill="${ITEM_WOOD}" stroke="${ITEM_INK}" stroke-width="1.5"/>` +
    `<path d="M19.5 24.5h25" stroke="rgba(90,60,30,.3)" stroke-width="1.2"/>` +
    `<rect x="29.6" y="31" width="4.8" height="21.5" rx="2.2" fill="#D9C9A8" stroke="${ITEM_INK}" stroke-width="1.4"/>` +
    hlArc("M22.5 22.4a4.8 4.8 0 0 1 3.4-1.9")
};

/* ---- 装备槽（badge 槽由调用方直接用 badge 套件，元素即身份） ---- */

const GEAR_ICONS: Record<string, (tint: string) => string> = {
  weapon: swordGlyph,
  armor: (tint) =>
    `<path d="M24 19.5l6-3.5h4l6 3.5 5 7-5.5 3.8V49h-15V30.3L19 26.5z" ` +
    `fill="${tint}" stroke="${ITEM_INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M30 16h4l-2 6z" fill="rgba(255,255,255,.5)" stroke="${ITEM_INK}" stroke-width="1"/>` +
    `<path d="M24.5 34h15" stroke="rgba(75,58,110,.35)" stroke-width="1.3"/>` +
    hlArc("M23.8 24.6a9 9 0 0 1 4.6-4.6"),
  charm: (tint) =>
    `<path d="M20 16c3.4 6.2 8 9.4 12 9.4S40.6 22.2 44 16" stroke="${ITEM_WOOD}" stroke-width="2.2" fill="none" stroke-linecap="round"/>` +
    `<circle cx="32" cy="27.8" r="2.6" fill="${ITEM_GOLD}" stroke="${ITEM_INK}" stroke-width="1.2"/>` +
    `<path d="M32 30.5l8.6 8.6L32 51.5l-8.6-12.4z" fill="${tint}" stroke="${ITEM_INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M32 30.5l8.6 8.6H23.4z" fill="rgba(255,255,255,.3)"/>` +
    hlArc("M27.1 35.4l3.4-3.4", 1.5)
};

/* ---- 技能（形状随类型，颜色随元素） ---- */

const SKILL_ICONS: Record<string, (tint: string) => string> = {
  damage: (tint) =>
    `<path d="M32 13l4.6 13.4L50 31l-13.4 4.6L32 49l-4.6-13.4L14 31l13.4-4.6z" ` +
    `fill="${tint}" stroke="${ITEM_INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<circle cx="32" cy="31" r="3.2" fill="#FFF7EC" stroke="${ITEM_INK}" stroke-width="1"/>` +
    hlArc("M25.4 24.2l4-3.4", 1.5),
  breaker: (tint) => shieldGlyph(tint, true),
  pierce: (tint) =>
    `<path d="M19 45.5L38.6 25.9" stroke="${ITEM_INK}" stroke-width="4.6" stroke-linecap="round"/>` +
    `<path d="M19 45.5L38.6 25.9" stroke="${tint}" stroke-width="2.6" stroke-linecap="round"/>` +
    `<path d="M35.8 17.6l10.6 10.6-9.2 2.4-3.8-3.8z" fill="${tint}" stroke="${ITEM_INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M21.5 49.5l-5-1 3.4-3.8" fill="none" stroke="${ITEM_INK}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` +
    hlArc("M37.4 21.4l4.6 4.6", 1.5),
  heal: heartGlyph,
  buff: (tint) =>
    `<path d="M20.5 36.5L32 26l11.5 10.5" stroke="${ITEM_INK}" stroke-width="6.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M20.5 36.5L32 26l11.5 10.5" stroke="${tint}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M20.5 48L32 37.5 43.5 48" stroke="${ITEM_INK}" stroke-width="6.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M20.5 48L32 37.5 43.5 48" stroke="${tint}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
    hlArc("M25.5 31.5l4.2-3.8", 1.5)
};

/* ---- 步骤卡节点（宝箱 / 小摊 / 歇脚 / 小怪 / 精英 / 首领） ---- */

const NODE_ICONS: Record<string, (tint: string) => string> = {
  chest: () =>
    `<path d="M18.5 30.5c0-5.8 5.4-9.5 13.5-9.5s13.5 3.7 13.5 9.5v2h-27z" ` +
    `fill="#D9B078" stroke="${ITEM_INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<rect x="18.5" y="32.5" width="27" height="17.5" rx="3.4" fill="${ITEM_WOOD}" stroke="${ITEM_INK}" stroke-width="1.5"/>` +
    `<path d="M29.8 21.4h4.4v28.6h-4.4z" fill="${ITEM_GOLD}" stroke="${ITEM_INK}" stroke-width="1.2"/>` +
    `<circle cx="32" cy="33.5" r="3" fill="#FFF7EC" stroke="${ITEM_INK}" stroke-width="1.2"/>` +
    hlArc("M21.6 27.2a10 10 0 0 1 5.4-4"),
  shop: () =>
    `<rect x="21" y="33" width="22" height="17" rx="2.6" fill="#FFF7EC" stroke="${ITEM_INK}" stroke-width="1.5"/>` +
    `<rect x="27.8" y="38.5" width="8.4" height="11.5" rx="1.8" fill="${ITEM_WOOD}" stroke="${ITEM_INK}" stroke-width="1.3"/>` +
    `<path d="M17.5 24.5h29l2.6 7.2c0 2.4-2 4.3-4.4 4.3s-4.4-1.9-4.4-4.3c0 2.4-2 4.3-4.4 4.3S31.5 34.1 31.5 31.7c0 2.4-2 4.3-4.4 4.3s-4.4-1.9-4.4-4.3c0 2.4-2 4.3-4.4 4.3s-4.4-1.9-4.4-4.3z" ` +
    `fill="#F4859F" stroke="${ITEM_INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M23.2 24.5l1.5 7.2M31 24.5v7.2M38.8 24.5l-1.5 7.2" stroke="#FFF7EC" stroke-width="2.6"/>` +
    hlArc("M20.4 28.3l1-2.4", 1.5),
  rest: () =>
    `<rect x="15.5" y="34" width="33" height="12.5" rx="6.2" fill="${ITEM_WOOD}" stroke="${ITEM_INK}" stroke-width="1.5"/>` +
    `<ellipse cx="45.4" cy="40.2" rx="3.6" ry="5.4" fill="#E8CFA4" stroke="${ITEM_INK}" stroke-width="1.3"/>` +
    `<ellipse cx="45.4" cy="40.2" rx="1.4" ry="2.4" fill="none" stroke="rgba(90,60,30,.5)" stroke-width="1"/>` +
    `<path d="M18 33c5-3.8 18-3.8 23 0l-2.4 2.6c-6-2.4-12.2-2.4-18.2 0z" fill="#8FCB6B" stroke="${ITEM_INK}" stroke-width="1.3" stroke-linejoin="round"/>` +
    hlArc("M18.6 38.6a5.4 5.4 0 0 1 3.2-2.6"),
  foe: (tint) => blobGlyph(tint),
  elite: (tint) => blobGlyph(tint, { crown: "gold" }),
  boss: (tint) => blobGlyph(tint, { crown: "star" })
};

/* ---- 补给（休息点三选一）与祝福（无尽深渊过层）按 kind 要图 ---- */

const SUPPLY_ICONS: Record<string, () => string> = {
  heal: () => heartGlyph("#F4859F"),
  shield: () => shieldGlyph("#8FA0D6"),
  coins: coinGlyph,
  power: () => swordGlyph("#F08A5A"),
  grit: () =>
    `<path d="M20 29.5c2.4-6 8-9.5 12.6-9.5 5.8 0 11.4 4.6 11.4 11.6 0 8.4-6.2 14.9-12 14.9-6.6 0-12-7-12-17z" ` +
    `fill="#B8AEA0" stroke="${ITEM_INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M18 36.8l28-8.2" stroke="#F4EDE2" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M18 36.8l28-8.2" stroke="rgba(75,58,110,.4)" stroke-width="1" stroke-dasharray="2.6 2.6"/>` +
    hlArc("M23.4 26.4a8.6 8.6 0 0 1 5-3.4")
};

const BLESS_ICONS: Record<string, () => string> = {
  heal: () =>
    `<ellipse cx="32" cy="43" rx="14.5" ry="7" fill="#9CD3F0" stroke="${ITEM_INK}" stroke-width="1.5"/>` +
    `<ellipse cx="32" cy="41.4" rx="10.8" ry="4.6" fill="#CFEAFA"/>` +
    `<path d="M25 32c-1.8-3 1.8-5 0-8M32 30c-1.8-3 1.8-5 0-8M39 32c-1.8-3 1.8-5 0-8" ` +
    `stroke="#8FB8D8" stroke-width="2.2" fill="none" stroke-linecap="round"/>` +
    hlArc("M22.4 40.4a9.8 9.8 0 0 1 4.6-2.8"),
  maxhp: () =>
    `<circle cx="32" cy="36" r="14" fill="#E85D5D" stroke="${ITEM_INK}" stroke-width="1.5"/>` +
    `<path d="M32 22.8c-.4-3 .8-5.2 3.2-6.2" stroke="#6E9C4A" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
    `<path d="M35 20.5c3.4-1.4 6.4-.4 7.6 2-2.8 1.6-5.8 1.2-7.6-2z" fill="#8FCB6B" stroke="${ITEM_INK}" stroke-width="1.2" stroke-linejoin="round"/>` +
    hlArc("M22.8 30.2a10.8 10.8 0 0 1 5.4-4.6"),
  atk: () =>
    `<path d="M17.5 45.5l22-22 5.4-1.6-1.6 5.4-22 22c-1.6 1.6-4 1.6-5.4-.2-1.4-1.5-1.2-3.8 1.6-3.6z" ` +
    `fill="#AEB6CC" stroke="${ITEM_INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M21 42l19.6-19.6" stroke="rgba(255,255,255,.6)" stroke-width="1.2"/>` +
    `<path d="M45.5 30.5l3.4 1 -2.4 2.6M49.9 24.1l2.6-.6-.6 2.8" stroke="${ITEM_GOLD}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
    hlArc("M39.9 20.9l3-1", 1.4),
  def: () => shieldGlyph("#8FCB6B") +
    `<path d="M32 22v22M32 28l-5 4M32 28l5 4M32 36l-4.4 3.6M32 36l4.4 3.6" stroke="rgba(75,58,110,.5)" stroke-width="1.3" fill="none" stroke-linecap="round"/>`,
  crit: () => bellGlyph("#F0C25A") +
    `<path d="M15.8 22.4l3.4 2M48.2 22.4l-3.4 2M17.6 30h3.6M46.4 30h-3.6" stroke="${ITEM_GOLD}" stroke-width="1.8" stroke-linecap="round"/>`,
  coins: coinGlyph
};

/** 行图标：`item-莓果id` / `gear-槽位` / `skill-类型` / `node-节点` / `supply-类` / `bless-类`。未知键回空串（调用方兜底回 emoji） */
export function rowIconSvg(kind: string, tint?: string): string {
  const [group, key] = kind.split("-", 2) as [string, string];
  if (group === "item") return ITEM_ICONS[key] ? iconWrap(kind, ITEM_ICONS[key]()) : "";
  if (group === "gear") return GEAR_ICONS[key] ? iconWrap(kind, GEAR_ICONS[key](tint ?? RARITY_TINT.common)) : "";
  if (group === "skill") return SKILL_ICONS[key] ? iconWrap(kind, SKILL_ICONS[key](tint ?? ELEMENT_TINT.light)) : "";
  if (group === "node") return NODE_ICONS[key] ? iconWrap(kind, NODE_ICONS[key](tint ?? ELEMENT_TINT.grass)) : "";
  if (group === "supply") return SUPPLY_ICONS[key] ? iconWrap(kind, SUPPLY_ICONS[key]()) : "";
  if (group === "bless") return BLESS_ICONS[key] ? iconWrap(kind, BLESS_ICONS[key]()) : "";
  return "";
}

/* ------------------------------------------------------------------ */
/* 胜利星屑彩纸：确定性铺开，不用运行时随机                                 */
/* ------------------------------------------------------------------ */

export const CONFETTI_COUNT = 18;

export function confettiHtml(count = CONFETTI_COUNT): string {
  let out = "";
  for (let i = 0; i < count; i++) {
    const left = Math.round((i * 61.8) % 100);
    const delay = (i % 6) * 60;
    out += `<span class="bvp-conf bvp-conf-${i % 3}" style="left:${left}%;animation-delay:${delay}ms"></span>`;
  }
  return out;
}
