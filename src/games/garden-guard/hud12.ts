// 花园守卫 1.2 —— HUD 与塔选择条的纯布局计算。
//
// 为什么要单独抽出来:360px 竖屏是本作的底线机型,
// 「生命 / 花瓣 / 波次挤成一行会不会溢出」「塔图标够不够 44px」
// 这两件事在 canvas 里靠肉眼看是查不出来的,必须能写成断言。
// 所以凡是尺寸计算都放在这里,index.ts 只负责照着画。

import { TOWER_INFO, TowerKind } from "./logic";

/** 规格底线:HUD 一行文字不得小于这个字号。 */
export const HUD_MIN_FONT = 14;
/** 规格底线:塔选择条里每个可点图标不得小于这个边长。 */
export const TOWER_ICON_MIN = 44;
/** 本作认定的「窄屏」阈值。 */
export const NARROW_WIDTH = 480;

/* ---------------- 文字宽度估算 ---------------- */

/**
 * 不依赖 canvas 的文字宽度估算。
 * 只求「够不够宽」这个量级上的准确,所以按字符类别给系数就行:
 * 汉字满格、emoji 略宽、数字与字母大约半格。
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  let units = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code > 0x1f000) units += 1.15; // emoji
    else if (code > 0x2000) units += 1; // 汉字与全角标点
    else if (ch === " ") units += 0.32;
    else units += 0.56;
  }
  return units * fontSize;
}

/* ---------------- HUD 一行 ---------------- */

export interface HudModel {
  hearts: number;
  maxHearts: number;
  petals: number;
  wave: number;
  /** 无尽没有总波数,传 null */
  waveTotal: number | null;
  /** 闯关显示「章-关」,无尽显示「守到底」 */
  title: string;
}

export interface HudSegments {
  left: string;
  center: string;
  right: string;
}

/**
 * 一行三段。窄屏下爱心改成「💗×5」的写法:
 * 五个 emoji 连排要 85px 左右,是 360px 上唯一真正撑破布局的那一段。
 */
export function hudSegments(m: HudModel, viewW: number): HudSegments {
  const narrow = viewW < NARROW_WIDTH;
  const wave = m.waveTotal === null ? `波 ${m.wave}` : `波 ${m.wave}/${m.waveTotal}`;
  const hearts = narrow
    ? `💗×${Math.max(0, m.hearts)}`
    : "💗".repeat(Math.max(0, m.hearts)) + "🤍".repeat(Math.max(0, m.maxHearts - m.hearts));
  return {
    left: `🌸 ${m.petals}`,
    center: narrow ? wave : `${m.title} · ${wave}`,
    right: hearts,
  };
}

export interface HudLayout {
  fontSize: number;
  segments: HudSegments;
  /** 三段加上按钮与间隙之后的总宽 */
  usedWidth: number;
  /** true = 一行放得下,不会横向溢出 */
  fits: boolean;
}

/**
 * 在保证 ≥ HUD_MIN_FONT 的前提下挑一个放得下的字号。
 * 放不下就如实返回 fits=false,而不是偷偷把字缩到 12px ——
 * 「字号不许低于 14」是硬规格,宁可让测试红,也不能悄悄破线。
 */
export function hudLayout(m: HudModel, viewW: number, backW: number, gap = 10): HudLayout {
  const segments = hudSegments(m, viewW);
  const budget = viewW - backW - gap * 3;
  for (let fontSize = 18; fontSize > HUD_MIN_FONT; fontSize--) {
    const used = hudUsedWidth(segments, fontSize);
    if (used <= budget) return { fontSize, segments, usedWidth: used + backW + gap * 3, fits: true };
  }
  const used = hudUsedWidth(segments, HUD_MIN_FONT);
  return {
    fontSize: HUD_MIN_FONT,
    segments,
    usedWidth: used + backW + gap * 3,
    fits: used <= budget,
  };
}

function hudUsedWidth(s: HudSegments, fontSize: number): number {
  return (
    estimateTextWidth(s.left, fontSize) +
    estimateTextWidth(s.center, fontSize) +
    estimateTextWidth(s.right, fontSize)
  );
}

/* ---------------- 塔选择条 ---------------- */

export interface TowerBarLayout {
  cardW: number;
  cardH: number;
  iconSize: number;
  gap: number;
  padX: number;
  /** 全部卡片摊开一共多宽 */
  contentW: number;
  /** true = 放不下,要横滑 */
  scrollable: boolean;
  /** 最多能滑多远 */
  maxScroll: number;
}

/**
 * 塔选择条永远是「一行横滑」,不折行也不缩图标。
 * 缩图标的话 8 座塔在 360px 上每个只剩 40px,手指点不准;
 * 折行的话工具栏会吃掉两倍高度,棋盘就没地方了。
 */
export function towerBarLayout(count: number, viewW: number, barH: number): TowerBarLayout {
  const cardH = Math.max(TOWER_ICON_MIN, barH - 10);
  const cardW = Math.max(TOWER_ICON_MIN, 52);
  const gap = 6;
  const padX = 8;
  const n = Math.max(0, count);
  const contentW = n === 0 ? 0 : padX * 2 + n * cardW + (n - 1) * gap;
  const maxScroll = Math.max(0, contentW - viewW);
  return {
    cardW,
    cardH,
    iconSize: TOWER_ICON_MIN,
    gap,
    padX,
    contentW,
    scrollable: maxScroll > 0,
    maxScroll,
  };
}

/** 第 i 张卡在屏幕上的左边缘(已经算进横滑偏移)。 */
export function towerCardX(i: number, layout: TowerBarLayout, scroll: number): number {
  return layout.padX + i * (layout.cardW + layout.gap) - clampScroll(scroll, layout.maxScroll);
}

export function clampScroll(scroll: number, maxScroll: number): number {
  return Math.max(0, Math.min(maxScroll, scroll));
}

/** 把第 i 张卡整个滑进视野所需的最小偏移(选中被解锁的新塔时用)。 */
export function scrollToCard(i: number, layout: TowerBarLayout, scroll: number, viewW: number): number {
  const left = layout.padX + i * (layout.cardW + layout.gap);
  const right = left + layout.cardW;
  const cur = clampScroll(scroll, layout.maxScroll);
  if (left - cur < layout.padX) return clampScroll(left - layout.padX, layout.maxScroll);
  if (right - cur > viewW - layout.padX) return clampScroll(right - viewW + layout.padX, layout.maxScroll);
  return cur;
}

/* ---------------- 放置合法性 ---------------- */

export type PlaceIssue = "outside" | "path" | "occupied" | "barricade" | "poor" | null;

export interface PlaceContext {
  cols: number;
  rows: number;
  /** 小路占的格 */
  blocked: ReadonlySet<string>;
  /** 已经有塔的格 */
  occupied: ReadonlySet<string>;
  /** 还没敲掉的路障 */
  barricades: ReadonlySet<string>;
  petals: number;
}

/**
 * 这一格为什么不能种。返回 null 才是能种。
 * 拖拽预览要「明确变红并给原因」,所以不能只回一个 boolean。
 */
export function placementIssue(
  col: number,
  row: number,
  kind: TowerKind,
  ctx: PlaceContext,
): PlaceIssue {
  if (col < 0 || row < 0 || col >= ctx.cols || row >= ctx.rows) return "outside";
  const key = `${col},${row}`;
  if (ctx.blocked.has(key)) return "path";
  if (ctx.barricades.has(key)) return "barricade";
  if (ctx.occupied.has(key)) return "occupied";
  if (ctx.petals < TOWER_INFO[kind].cost) return "poor";
  return null;
}

/** 给孩子看的一句原因,不吓人也不含糊。 */
export function placementReason(issue: PlaceIssue, kind: TowerKind): string {
  switch (issue) {
    case "outside":
      return "这里在花园外面啦";
    case "path":
      return "小路要留给怪走,不能挡住";
    case "barricade":
      return "先点两下把木箱敲掉";
    case "occupied":
      return "这格已经有一株啦";
    case "poor":
      return `还差一点花瓣,${TOWER_INFO[kind].name}要 ${TOWER_INFO[kind].cost}🌸`;
    default:
      return "点一下就能种下";
  }
}
