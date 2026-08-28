/**
 * 共享美术套件 · 红蓝跑者「剪影级」区分装饰（1.3 窗口8 第 1 轮 C 档修复新增，独占文件）。
 *
 * 修 W8R1-05：`runnerSvg` 的红蓝双方在 16px 灰度下只靠色相区分（可分辨像素 0%），
 * 色弱孩子与小尺寸场景分不清谁是谁。`runnerSvg.ts` 归 A 档（本窗冻结，只 import 不改），
 * 所以在这里做**后置装饰**：吃 `runnerSvg` 输出的 SVG 串，按红/蓝叠一层剪影级配件，
 * 在 `</svg>` 前注入、不改动原有任何节点：
 *
 *  - 红方 = 亮部套装：双丸子头（头顶轮廓外扩）+ 白色上下条纹背心带 + 白围巾结；
 *  - 蓝方 = 暗部套装：反戴帽舌（向后/向左的大帽檐）+ 深藏青上下背心带 + 深围巾结。
 *
 * 三通道叠加：剪影（丸子头 vs 反帽舌）、明度（白带 vs 深带，灰度图上直接可分）、
 * 附件（背心号码 1/2 由 runnerSvg 自带，条纹带刻意避开号码区 y30–40 不遮挡）。
 * 光源沿全库约定左上 45°：高光点一律点在配件左上。
 *
 * 配件跟随姿态：头饰随 `headDy`（run 0/1、jump −2、slip +12）起伏，
 * 躯干带随 slip 的 `torsoDy = 10` 下移——这两组偏移是 `runnerSvg.ts` 写死的常量，
 * 本文件按同一张表推算（`duoTrim.test.ts` 有用例钉住两边不许漂移）。
 * 纯函数、无 DOM、无 id（配件全是实色填充，不需要 defs），同参数输出确定。
 */
import type { RunnerPose } from "./runnerSvg";

/** 红方亮部件配色（描边继承 runnerSvg 的红方 outline 语境） */
export const TRIM_RED = {
  bun: "#C9455D",
  bunDark: "#8E3247",
  band: "#FFF6EC",
  bandEdge: "#D9BFa8"
} as const;

/** 蓝方暗部件配色 */
export const TRIM_BLUE = {
  visor: "#2C4470",
  visorDark: "#1B2C55",
  band: "#22386B",
  bandEdge: "#16244A"
} as const;

export interface TrimOpts {
  pose?: RunnerPose;
  /** 跑姿帧相位（与 runnerSvg 同语义：非 0/1 一律当 0） */
  phase?: number;
}

/** 头部上下偏移：与 runnerSvg.limbsOf 的 headDy 同表 */
export function trimHeadDy(pose: RunnerPose, phase: number): number {
  if (pose === "jump") return -2;
  if (pose === "slip") return 12;
  return phase === 1 ? 1 : 0;
}

/** 躯干下移：与 runnerSvg 的 torsoDy 同表（只有 slip 坐地时下移） */
export function trimTorsoDy(pose: RunnerPose): number {
  return pose === "slip" ? 10 : 0;
}

/** 鞋心位置：与 runnerSvg.limbsOf 的 nearShoe / farShoe 同表（袜口环挂在鞋口上沿） */
export function trimShoeSpots(pose: RunnerPose, phase: number): Array<[number, number]> {
  if (pose === "jump") return [[38, 56], [34, 58]];
  if (pose === "slip") return [[54, 60], [50, 63]];
  return phase === 1 ? [[40, 59], [17, 61]] : [[49, 62], [14, 58]];
}

/** 袜口环：红白 / 蓝深，一只鞋一道，画在鞋口上沿 */
function sockCuffs(fill: string, edge: string, spots: Array<[number, number]>): string {
  const cuff = ([x, y]: [number, number]): string =>
    `<rect x="${x - 3.4}" y="${y - 5.4}" width="6.8" height="3.2" rx="1.4"` +
    ` fill="${fill}" stroke="${edge}" stroke-width="0.8"/>`;
  return `<g data-trim-part="cuffs">${spots.map(cuff).join("")}</g>`;
}

/** 背心上下两条明度带（避开号码区 y30–40）：红白亮带 / 蓝深带 */
function vestBands(fill: string, edge: string, torsoDy: number): string {
  const band = (y: number): string =>
    `<path d="M25.6 ${y} L43.8 ${y} L43.3 ${y + 4.3} L25.1 ${y + 4.3} Z"` +
    ` fill="${fill}" stroke="${edge}" stroke-width="0.8" stroke-linejoin="round" opacity=".96"/>`;
  return `<g data-trim-part="bands" transform="translate(0 ${torsoDy})">${band(26.2)}${band(41.9)}</g>`;
}

/** 领口围巾结：小三角结 + 短飘带，红白 / 蓝深各一版 */
function scarf(fill: string, edge: string, torsoDy: number): string {
  return (
    `<g data-trim-part="scarf" transform="translate(0 ${torsoDy})">` +
    `<path d="M28.5 24.6 Q34.5 27.8 40.5 24.6 L39.5 28.2 Q34.5 30.4 29.5 28.2 Z"` +
    ` fill="${fill}" stroke="${edge}" stroke-width="1" stroke-linejoin="round"/>` +
    `<path d="M30 27.6 L27.4 31.8 L30.8 30.6 Z" fill="${fill}" stroke="${edge}" stroke-width="0.8" stroke-linejoin="round"/>` +
    `</g>`
  );
}

/** 红方双丸子头：两颗发髻挂在头顶轮廓外，左上各一粒高光 */
function redBuns(hy: number): string {
  const bun = (cx: number, cy: number): string =>
    `<circle cx="${cx}" cy="${cy}" r="5.6" fill="${TRIM_RED.bun}" stroke="${TRIM_RED.bunDark}" stroke-width="1.6"/>` +
    `<circle cx="${cx - 1.8}" cy="${cy - 2}" r="1.4" fill="#FFFFFF" opacity=".55"/>`;
  return (
    `<g data-trim="red-buns">` +
    bun(33.5, 5.2 + hy) +
    bun(48.5, 4.6 + hy) +
    `<path d="M38.5 ${3.4 + hy} L43.5 ${3.1 + hy} L41 ${6.2 + hy} Z" fill="${TRIM_RED.band}"` +
    ` stroke="${TRIM_RED.bunDark}" stroke-width="1" stroke-linejoin="round"/>` +
    `</g>`
  );
}

/** 蓝方反戴帽舌：一片向后（画面左）的大帽檐，盖住原右侧小帽舌的存在感 */
function blueVisor(hy: number): string {
  return (
    `<g data-trim="blue-visor">` +
    `<path d="M32.6 ${9 + hy} Q23 ${7.4 + hy} 17.4 ${12.6 + hy} L18.8 ${15.8 + hy} Q26 ${12 + hy} 33.2 ${13.2 + hy} Z"` +
    ` fill="${TRIM_BLUE.visor}" stroke="${TRIM_BLUE.visorDark}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<circle cx="22.5" cy="${11.2 + hy}" r="1.2" fill="#FFFFFF" opacity=".4"/>` +
    `<circle cx="41" cy="${5.4 + hy}" r="2.9" fill="${TRIM_BLUE.visor}" stroke="${TRIM_BLUE.visorDark}" stroke-width="1.4"/>` +
    `</g>`
  );
}

/**
 * 给 `runnerSvg` 的输出叠上红/蓝剪影配件。
 * 只在结尾 `</svg>` 前插入一个 `<g data-duo-trim="…">`，原串一字不改；
 * 传进来的不是完整 SVG（找不到收尾标签）就原样返回，绝不抛错拖垮玩法层。
 */
export function trimRunnerSvg(svg: string, side: "red" | "blue", opts: TrimOpts = {}): string {
  if (typeof svg !== "string") return svg;
  const at = svg.lastIndexOf("</svg>");
  if (at < 0) return svg;
  const pose: RunnerPose = opts.pose ?? "run";
  const phase = opts.phase === 1 ? 1 : 0;
  const hy = trimHeadDy(pose, phase);
  const dy = trimTorsoDy(pose);
  const spots = trimShoeSpots(pose, phase);
  const parts =
    side === "red"
      ? vestBands(TRIM_RED.band, TRIM_RED.bandEdge, dy) +
        scarf(TRIM_RED.band, TRIM_RED.bandEdge, dy) +
        sockCuffs(TRIM_RED.band, TRIM_RED.bandEdge, spots) +
        redBuns(hy)
      : vestBands(TRIM_BLUE.band, TRIM_BLUE.bandEdge, dy) +
        scarf(TRIM_BLUE.band, TRIM_BLUE.bandEdge, dy) +
        sockCuffs(TRIM_BLUE.band, TRIM_BLUE.bandEdge, spots) +
        blueVisor(hy);
  const layer = `<g data-duo-trim="${side}">${parts}</g>`;
  return svg.slice(0, at) + layer + svg.slice(at);
}
