/**
 * 飞行棋乐园 · 1.3 视觉资产（`src/games/flight-chess/art.ts`）
 *
 * 全部是「纯函数返回内联 SVG 字符串」：不碰 DOM、不建 canvas、不挂监听。
 * 颜色从 `board.ts` 的 `COLOR_INFO`（ink / soft）出发，用共享素材包
 * `src/art/kit/` 的 shade / tint 推导三阶光影，绝不自己再造一套调色数学。
 *
 * 视觉宪法要点（docs/plan-1.3-visual-bible.md）：
 * - 「飞行棋」必须有飞机：四色 Q 版小飞机（机身 + 座舱高光 + 双翼 + 螺旋桨），
 *   四款尾翼形状不同 —— 色弱模式下形状 + 颜色双通道可分辨；
 * - 骰子是「顶面亮、侧面暗一阶」的伪 3D 三面体 + 圆点高光，不再是 emoji 字符；
 * - 击落表现为「降落伞安全返航」，无爆炸碎片，符合低龄分级；
 * - emoji 只进 aria-label 与座位卡文案，不再当棋子画。
 */

import { KIT_PALETTE, shade, tint } from "../../art/kit";
import { BASE, COLOR_INFO, GOAL, cellXY, type Color } from "./board";

/** 飞机姿态：fly 飞行 / park 基地停机 / land 终点着陆收翼 */
export type PlanePose = "fly" | "park" | "land";

/** 四款尾翼剪影（辅助色弱区分）：0 圆鳍 / 1 星鳍 / 2 双叉鳍 / 3 燕尾鳍 */
export const FIN_NAMES = ["round", "star", "twin", "swallow"] as const;

const n2 = (v: number): string => (Math.round(v * 100) / 100).toString();

/** 五角星顶点串（塔台、星鳍共用） */
function starPts(cx: number, cy: number, rOut: number, rIn: number, points = 5): string {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    pts.push(`${n2(cx + Math.cos(a) * r)},${n2(cy + Math.sin(a) * r)}`);
  }
  return pts.join(" ");
}

/** 四款尾翼：画在机尾（11, 16.5）附近，颜色用深一阶的主色 */
function finSVG(color: Color): string {
  const dark = shade(COLOR_INFO[color].ink, 0.25);
  const lite = tint(COLOR_INFO[color].ink, 0.35);
  if (color === 0) {
    // 圆鳍：一枚圆润的半圆背鳍
    return (
      `<path d="M 8.4 17.6 Q 11 14.4 13.6 17.6 Q 11 19 8.4 17.6 Z" fill="${dark}"/>` +
      `<circle cx="11" cy="16.9" r="1" fill="${lite}"/>`
    );
  }
  if (color === 1) {
    // 星鳍：尾巴上顶一颗小星星
    return (
      `<rect x="10.2" y="15.6" width="1.6" height="2.6" rx=".8" fill="${dark}"/>` +
      `<polygon points="${starPts(11, 18.2, 2.2, 1)}" fill="${lite}" stroke="${dark}" stroke-width=".4"/>`
    );
  }
  if (color === 2) {
    // 双叉鳍：左右两片小竖鳍
    return (
      `<path d="M 8.2 16 Q 7.2 18.8 8.8 19.4 L 9.8 16.6 Z" fill="${dark}"/>` +
      `<path d="M 13.8 16 Q 14.8 18.8 13.2 19.4 L 12.2 16.6 Z" fill="${dark}"/>` +
      `<rect x="10.3" y="15.8" width="1.4" height="2.2" rx=".7" fill="${lite}"/>`
    );
  }
  // 燕尾鳍：一片 V 字剪尾
  return (
    `<path d="M 11 15.6 L 8 19.6 L 11 18.2 L 14 19.6 Z" fill="${dark}"/>` +
    `<path d="M 11 15.6 L 11 18.2" stroke="${lite}" stroke-width=".8" stroke-linecap="round"/>`
  );
}

/**
 * Q 版小飞机（22×22 视图，机头朝上）：
 * 圆润机身（渐变主色 + 机腹 soft 色）+ 座舱盖白高光 + 双翼 + 尾翼（四款形状）
 * + 头部两叶螺旋桨（class `fc-prop`，走子时 CSS 提转速）。
 * - park：缩小 0.85 + 三个停机轮，螺旋桨横置；
 * - land：着陆收翼（翼展收短）+ 花环。
 */
export function planeSVG(color: Color, pose: PlanePose = "fly"): string {
  const info = COLOR_INFO[color];
  const ink = info.ink;
  const body = tint(ink, 0.12);
  const belly = tint(info.soft, 0.35);
  const dark = shade(ink, 0.3);
  const wingTip = tint(ink, 0.45);
  const parked = pose === "park";
  const landed = pose === "land";
  // 翼展：飞行全开 8.6，着陆收到 5.6
  const span = landed ? 5.6 : 8.6;
  const wingY = landed ? 11.6 : 10.8;
  const wings =
    `<path d="M ${n2(11 - span)} ${n2(wingY + 1.6)} Q ${n2(11 - span - 0.8)} ${n2(wingY - 0.4)} ${n2(
      11 - span + 1.6
    )} ${n2(wingY - 1)} L 9.4 ${n2(wingY - 1.4)} L 9.4 ${n2(wingY + 1.8)} Z" fill="${ink}"/>` +
    `<path d="M ${n2(11 + span)} ${n2(wingY + 1.6)} Q ${n2(11 + span + 0.8)} ${n2(wingY - 0.4)} ${n2(
      11 + span - 1.6
    )} ${n2(wingY - 1)} L 12.6 ${n2(wingY - 1.4)} L 12.6 ${n2(wingY + 1.8)} Z" fill="${ink}"/>` +
    `<circle cx="${n2(11 - span + 1.2)}" cy="${n2(wingY + 0.4)}" r=".8" fill="${wingTip}"/>` +
    `<circle cx="${n2(11 + span - 1.2)}" cy="${n2(wingY + 0.4)}" r=".8" fill="${wingTip}"/>`;
  const gear = parked
    ? `<circle cx="8.6" cy="13.6" r="1.1" fill="${KIT_PALETTE.ink}"/>` +
      `<circle cx="13.4" cy="13.6" r="1.1" fill="${KIT_PALETTE.ink}"/>` +
      `<circle cx="11" cy="17.4" r=".9" fill="${KIT_PALETTE.ink}"/>` +
      `<circle cx="8.3" cy="13.3" r=".4" fill="${KIT_PALETTE.cloud}"/>` +
      `<circle cx="13.1" cy="13.3" r=".4" fill="${KIT_PALETTE.cloud}"/>`
    : "";
  // 花环：着陆庆祝，机身周围一圈小花
  let wreath = "";
  if (landed) {
    const petals = [KIT_PALETTE.candy, KIT_PALETTE.lemon, KIT_PALETTE.mint, KIT_PALETTE.lilac];
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      wreath += `<circle cx="${n2(11 + Math.cos(a) * 9.4)}" cy="${n2(11 + Math.sin(a) * 9.4)}" r="1.1" fill="${
        petals[i % 4]
      }" class="fc-wreath"/>`;
    }
  }
  // 螺旋桨：两叶 + 圆毂；停机时横置一字
  const prop = parked
    ? `<g class="fc-prop"><rect x="6.2" y="2.2" width="9.6" height="1.2" rx=".6" fill="${dark}"/>` +
      `<circle cx="11" cy="2.8" r="1" fill="${tint(ink, 0.5)}"/></g>`
    : `<g class="fc-prop"><ellipse cx="11" cy="1.6" rx="1" ry="1.7" fill="${dark}" opacity=".9"/>` +
      `<ellipse cx="11" cy="4.2" rx="1" ry="1.7" fill="${dark}" opacity=".9"/>` +
      `<circle cx="11" cy="2.9" r="1" fill="${tint(ink, 0.5)}"/></g>`;
  return (
    `<svg viewBox="0 0 22 22" class="fc-plane fc-plane-${pose} fc-fin-${FIN_NAMES[color]}" aria-hidden="true" focusable="false">` +
    `<g${parked ? ' transform="translate(1.65 1.65) scale(.85)"' : ""}>` +
    wreath +
    prop +
    wings +
    // 机身：圆头长身，底部略收
    `<path d="M 11 2.4 Q 14.2 5.2 14 10 Q 13.9 14.6 12.4 17 L 9.6 17 Q 8.1 14.6 8 10 Q 7.8 5.2 11 2.4 Z" fill="${body}" stroke="${dark}" stroke-width=".5"/>` +
    // 机腹浅色条
    `<path d="M 9.9 8.4 Q 11 7.8 12.1 8.4 L 11.9 15.8 L 10.1 15.8 Z" fill="${belly}"/>` +
    // 座舱盖：白高光 + 天蓝玻璃
    `<ellipse cx="11" cy="6.4" rx="1.9" ry="2.3" fill="${KIT_PALETTE.sky}" stroke="${dark}" stroke-width=".4"/>` +
    `<ellipse cx="10.4" cy="5.6" rx=".7" ry="1" fill="${KIT_PALETTE.cloud}"/>` +
    // 机身笑脸：眼睛 + 白瞳光 + 腮红 + 微笑(Q 版可爱档)
    `<circle cx="9.9" cy="10.2" r=".55" fill="${KIT_PALETTE.ink}"/>` +
    `<circle cx="12.1" cy="10.2" r=".55" fill="${KIT_PALETTE.ink}"/>` +
    `<circle cx="9.75" cy="10" r=".2" fill="${KIT_PALETTE.cloud}"/>` +
    `<circle cx="11.95" cy="10" r=".2" fill="${KIT_PALETTE.cloud}"/>` +
    `<ellipse cx="9.1" cy="11.1" rx=".5" ry=".3" fill="${KIT_PALETTE.blush}" opacity=".7"/>` +
    `<ellipse cx="12.9" cy="11.1" rx=".5" ry=".3" fill="${KIT_PALETTE.blush}" opacity=".7"/>` +
    `<path d="M 10.4 11.4 Q 11 12 11.6 11.4" fill="none" stroke="${KIT_PALETTE.ink}" stroke-width=".4" stroke-linecap="round"/>` +
    finSVG(color) +
    gear +
    `</g></svg>`
  );
}

/** 骰子 1–6 点的圆点布局（面中心为原点，单位为点距） */
export const DIE_PIPS: readonly (readonly (readonly [number, number])[])[] = [
  [],
  [[0, 0]],
  [
    [-1, -1],
    [1, 1]
  ],
  [
    [-1, -1],
    [0, 0],
    [1, 1]
  ],
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1]
  ],
  [
    [-1, -1],
    [1, -1],
    [0, 0],
    [-1, 1],
    [1, 1]
  ],
  [
    [-1, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [1, 1]
  ]
];

/**
 * 伪 3D 三面体骰：顶面最亮、右侧面最暗（两阶暗面给体积），
 * 前脸圆角白面 + 圆点（每颗带一粒高光）。`gold` 是掷出 6 的金边庆祝态。
 * 点数越界会被 clamp 到 1–6，绝不给 undefined。
 */
export function dieSVG(v: number, gold = false): string {
  const n = Math.max(1, Math.min(6, Math.round(v) || 1));
  const top = tint(KIT_PALETTE.sky, 0.72);
  const side = shade(KIT_PALETTE.sky, 0.22);
  const pipC = n === 6 ? shade(KIT_PALETTE.coral, 0.18) : KIT_PALETTE.ink;
  let pips = "";
  for (const [dx, dy] of DIE_PIPS[n]) {
    const px = 12 + dx * 5;
    const py = 16 + dy * 5;
    pips +=
      `<circle class="fc-die-pip" cx="${px}" cy="${py}" r="2.1" fill="${pipC}"/>` +
      `<circle cx="${n2(px - 0.7)}" cy="${n2(py - 0.7)}" r=".6" fill="${tint(pipC, 0.65)}"/>`;
  }
  return (
    `<svg viewBox="0 0 28 30" class="fc-die" data-pips="${n}" aria-hidden="true" focusable="false">` +
    `<polygon points="2,6 7,1 27,1 22,6" fill="${top}"/>` +
    `<polygon points="22,6 27,1 27,21 22,26" fill="${side}"/>` +
    `<rect x="2" y="6" width="20" height="20" rx="4.5" fill="${KIT_PALETTE.cloud}" stroke="${
      gold ? KIT_PALETTE.starGold : shade(KIT_PALETTE.sky, 0.08)
    }" stroke-width="${gold ? 2.4 : 1}"/>` +
    `<rect x="3.4" y="7.4" width="17.2" height="4.2" rx="2.1" fill="${tint(KIT_PALETTE.sky, 0.85)}" opacity=".8"/>` +
    pips +
    `</svg>`
  );
}

/**
 * 四角机库（6×6 基地区域，viewBox 0–60）：圆角停机坪 + 机库小屋（门口弧线）
 * + 4 个圆形停机位（对齐 board.ts 的 BASE_SLOT 偏移 1.5/3.5）。
 * 机库门一律朝向棋盘中心，靠 `flip` 水平/垂直翻转。
 */
export function hangarSVG(color: Color): string {
  const info = COLOR_INFO[color];
  const ink = info.ink;
  const pad = tint(info.soft, 0.3);
  const line = tint(ink, 0.55);
  // 门朝内：左上不翻、右上水平翻、右下双翻、左下垂直翻
  const sx = color === 1 || color === 2 ? -1 : 1;
  const sy = color === 2 || color === 3 ? -1 : 1;
  let spots = "";
  for (const [cx, cy] of [
    [15, 15],
    [35, 15],
    [15, 35],
    [35, 35]
  ]) {
    spots +=
      `<circle cx="${cx}" cy="${cy}" r="6.2" fill="${pad}" stroke="${line}" stroke-width="1.2" stroke-dasharray="3 2.4"/>` +
      `<circle cx="${cx}" cy="${cy}" r="1.4" fill="${line}"/>`;
  }
  return (
    `<svg viewBox="0 0 60 60" class="fc-hangar fc-hangar-${color}" preserveAspectRatio="none" aria-hidden="true" focusable="false">` +
    `<g${sx < 0 || sy < 0 ? ` transform="translate(${sx < 0 ? 60 : 0} ${sy < 0 ? 60 : 0}) scale(${sx} ${sy})"` : ""}>` +
    `<rect x="2.5" y="2.5" width="55" height="55" rx="9" fill="none" stroke="${tint(ink, 0.4)}" stroke-width="1.6"/>` +
    // 机库小屋：拱顶 + 门口弧线，蹲在外角
    `<path d="M 6 21 L 6 12 Q 15 3 24 12 L 24 21 Z" fill="${tint(ink, 0.25)}"/>` +
    `<path d="M 6 12.6 Q 15 4.4 24 12.6" fill="none" stroke="${shade(ink, 0.2)}" stroke-width="1.6"/>` +
    `<path class="fc-hangar-door" d="M 9.5 21 L 9.5 14 Q 15 9.4 20.5 14 L 20.5 21 Z" fill="${info.soft}" stroke="${shade(
      ink,
      0.2
    )}" stroke-width="1"/>` +
    `<path d="M 12.4 21 L 12.4 12.4 M 15 21 L 15 11.6 M 17.6 21 L 17.6 12.4" stroke="${tint(ink, 0.5)}" stroke-width=".7"/>` +
    // 出库滑行道：机库门口到停机坪的虚线
    `<path d="M 15 22 L 15 28 Q 15 31 19 31 L 26 31" fill="none" stroke="${line}" stroke-width="1.4" stroke-dasharray="3 2.6"/>` +
    spots +
    `</g></svg>`
  );
}

/**
 * 中央塔台（3×3 停机坪，viewBox 0–60）：四色风车跑道向中心汇聚 +
 * 中央塔台（塔身 + 了望厅）顶一颗大星星。
 */
export function towerSVG(): string {
  let vanes = "";
  // 四色风车叶：从四边中点收向中心，颜色顺序对齐四家（0 左 / 1 上 / 2 右 / 3 下）
  const quad: [number, number, number, number, Color][] = [
    [2, 22, 2, 38, 0],
    [22, 2, 38, 2, 1],
    [58, 38, 58, 22, 2],
    [38, 58, 22, 58, 3]
  ];
  for (const [x1, y1, x2, y2, c] of quad) {
    vanes +=
      `<path d="M ${x1} ${y1} L ${x2} ${y2} L 30 30 Z" fill="${COLOR_INFO[c].soft}" stroke="${tint(
        COLOR_INFO[c].ink,
        0.3
      )}" stroke-width="1"/>` +
      `<path d="M ${n2((x1 + x2) / 2)} ${n2((y1 + y2) / 2)} L 30 30" stroke="${COLOR_INFO[c].ink}" stroke-width="1.2" stroke-dasharray="2.6 2.2" opacity=".65"/>`;
  }
  const g = KIT_PALETTE.starGold;
  return (
    `<svg viewBox="0 0 60 60" class="fc-tower" aria-hidden="true" focusable="false">` +
    `<circle cx="30" cy="30" r="27" fill="${tint(KIT_PALETTE.grass, 0.55)}" stroke="${tint(
      KIT_PALETTE.grassDeep,
      0.3
    )}" stroke-width="1.6"/>` +
    vanes +
    `<circle cx="30" cy="30" r="10.5" fill="${KIT_PALETTE.cloud}" stroke="${shade(KIT_PALETTE.sky, 0.15)}" stroke-width="1.4"/>` +
    // 塔身 + 了望厅
    `<path d="M 27 37 L 27.8 27 L 32.2 27 L 33 37 Z" fill="${shade(KIT_PALETTE.sky, 0.05)}"/>` +
    `<rect x="24.6" y="24" width="10.8" height="4.6" rx="2.2" fill="${KIT_PALETTE.sky}" stroke="${shade(
      KIT_PALETTE.sky,
      0.25
    )}" stroke-width=".9"/>` +
    `<rect x="26" y="25.2" width="3.4" height="2.2" rx="1" fill="${KIT_PALETTE.cloud}"/>` +
    // 塔顶大星星
    `<polygon points="${starPts(30, 20.4, 4.6, 2)}" fill="${g}" stroke="${shade(g, 0.25)}" stroke-width=".8"/>` +
    `<circle cx="28.6" cy="19.2" r=".9" fill="${tint(g, 0.6)}"/>` +
    `</svg>`
  );
}

/** 云朵（航线起点格）：三团圆 + 底部平弧，纯白带天蓝描影 */
export function cloudSVG(): string {
  const c = KIT_PALETTE.cloud;
  const line = shade(KIT_PALETTE.sky, 0.12);
  return (
    `<g class="fc-cloud">` +
    `<ellipse cx="0" cy="1.4" rx="4.6" ry="1.7" fill="${line}" opacity=".45"/>` +
    `<circle cx="-2.4" cy="0.4" r="1.9" fill="${c}"/>` +
    `<circle cx="2.4" cy="0.4" r="1.9" fill="${c}"/>` +
    `<circle cx="0" cy="-1" r="2.6" fill="${c}"/>` +
    `<ellipse cx="0" cy="0.9" rx="4.2" ry="1.6" fill="${c}"/>` +
    `<ellipse cx="-1.4" cy="-1.8" rx="1" ry=".5" fill="${tint(KIT_PALETTE.sky, 0.75)}" transform="rotate(-20 -1.4 -1.8)"/>` +
    `</g>`
  );
}

/** 降落伞（被撞返航用）：色伞衣 + 伞骨分瓣 + 四根伞绳 */
export function parachuteSVG(color: Color): string {
  const ink = COLOR_INFO[color].ink;
  const lite = tint(ink, 0.55);
  return (
    `<svg viewBox="0 0 20 20" class="fc-parachute" aria-hidden="true" focusable="false">` +
    `<path d="M 2 8.6 Q 10 -1.4 18 8.6 Q 14 6.6 10 8.6 Q 6 6.6 2 8.6 Z" fill="${COLOR_INFO[color].soft}" stroke="${ink}" stroke-width=".8"/>` +
    `<path d="M 6 3.2 Q 10 6 10 8.6 M 14 3.2 Q 10 6 10 8.6" fill="none" stroke="${lite}" stroke-width=".7"/>` +
    `<path d="M 2.6 8.4 L 8.4 16.4 M 17.4 8.4 L 11.6 16.4 M 6.4 7.4 L 9.4 16.4 M 13.6 7.4 L 10.6 16.4" stroke="${ink}" stroke-width=".6" opacity=".8"/>` +
    `</svg>`
  );
}

/** 起飞尾迹：两条渐隐的白色拉烟线 */
export function contrailSVG(): string {
  const c = KIT_PALETTE.cloud;
  return (
    `<svg viewBox="0 0 22 22" class="fc-contrail" aria-hidden="true" focusable="false">` +
    `<path d="M 8.4 12 Q 6.6 17 4.6 20.6" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round" opacity=".9"/>` +
    `<path d="M 13.6 12 Q 15.4 17 17.4 20.6" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round" opacity=".9"/>` +
    `<circle cx="4.2" cy="21.4" r=".9" fill="${c}" opacity=".6"/>` +
    `<circle cx="17.8" cy="21.4" r=".9" fill="${c}" opacity=".6"/>` +
    `</svg>`
  );
}

/** 迭子 ×2 徽章：白圆底 + 主色描边 + 「×2」（SVG 图形字，非正文文字） */
export function stackMarkSVG(color: Color): string {
  const ink = COLOR_INFO[color].ink;
  return (
    `<svg viewBox="0 0 14 14" class="fc-stackmark" aria-hidden="true" focusable="false">` +
    `<circle cx="7" cy="7.6" r="6" fill="${shade(ink, 0.25)}"/>` +
    `<circle cx="7" cy="7" r="6" fill="${KIT_PALETTE.cloud}" stroke="${ink}" stroke-width="1.2"/>` +
    `<text x="7" y="9.8" text-anchor="middle" font-size="8" font-weight="bold" fill="${ink}">×2</text>` +
    `</svg>`
  );
}

/** 基地停机时的机头朝向（度）：四个角各自面向棋盘中心 */
export const PARK_DEG: readonly number[] = [135, 225, 315, 45];

/**
 * 机头朝向（度，机头朝上为 0）：按「当前格 → 下一格」的向量取角度，
 * 吸到 45° 的倍数（八方向查表口径）。基地用 PARK_DEG，终点沿通道方向。
 */
export function headingDeg(color: Color, p: number): number {
  if (p === BASE || p < 0) return PARK_DEG[color];
  const from = p >= GOAL ? cellXY(color, GOAL - 1) : cellXY(color, p);
  const to = p >= GOAL ? cellXY(color, GOAL) : cellXY(color, p + 1);
  const ang = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
  const snapped = Math.round(ang / 45) * 45;
  return (((snapped + 90) % 360) + 360) % 360;
}

/** 座位卡「到家进度」：4 个小机位，点亮 got 个（替代纯数字） */
export function seatProgressHTML(got: number, color: Color): string {
  const n = Math.max(0, Math.min(4, Math.round(got)));
  const ink = COLOR_INFO[color].ink;
  let dots = "";
  for (let i = 0; i < 4; i++) {
    dots += `<i class="fc-slot${i < n ? " fc-slot-on" : ""}"${i < n ? ` style="background:${ink}"` : ""}></i>`;
  }
  return `<span class="fc-slots" role="img" aria-label="到家 ${n}/4">${dots}</span>`;
}

/** 结算名次条：按名次摆四色飞机头像 + 名字，第一名戴星 */
export function rankStripHTML(ranks: readonly Color[]): string {
  const rows = ranks
    .map((c, i) => {
      const star =
        i === 0
          ? `<svg viewBox="0 0 12 12" class="fc-rank-star" aria-hidden="true"><polygon points="${starPts(
              6,
              6.4,
              5,
              2.2
            )}" fill="${KIT_PALETTE.starGold}"/></svg>`
          : "";
      return (
        `<span class="fc-rank">` +
        `<b class="fc-rank-no">${i + 1}</b>` +
        `<span class="fc-rank-plane">${planeSVG(c, i === 0 ? "land" : "park")}</span>` +
        `<span class="fc-rank-name" style="color:${COLOR_INFO[c].ink}">${COLOR_INFO[c].name}</span>` +
        star +
        `</span>`
      );
    })
    .join("");
  return `<div class="fc-ranks">${rows}</div>`;
}
