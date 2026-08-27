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
