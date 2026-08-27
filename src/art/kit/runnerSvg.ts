/**
 * 1.3 共享美术套件 · 侧视跑者小人(纯字符串 SVG,不碰 DOM)。
 *
 * 第 23 步 A 档(red-blue-race)首建,供 B / C 档红蓝系列对齐观感:
 * 参数化 服色 / 帧相位 / 姿态,返回完整 `<svg>` 标记串,调用方 innerHTML 即用。
 *  - 跑姿两帧交替(摆臂 ±35° + 前腿伸 / 后腿蹬),帧切换由调用方的 CSS 控制;
 *  - `jump` 收腿展臂;`slip` 坐地 + 头顶三颗转圈星(不痛苦,眼睛是「><」都不用);
 *  - 头部留一块圆形头像位(`faceHref`),发帽 / 背心号码 / 鞋色三个通道区分红蓝;
 *  - 同一页面放多个实例时用 `idPrefix` 隔离 clipPath / 渐变 id。
 * 纯函数、零依赖、输出确定,node 环境可直接断言。
 * 色板走公共 `palette.ts`(B 档先落,只 import 不改):
 * 它的 `shade(hex, pct)` 是百分比语义(正提亮/负压暗),这里包一层 0..1 的
 * `shade` / `tint` 便于在模板串里内插。
 */
import { PASTEL, shade as mixPct } from "./palette";

/** 暗部推导:向黑靠 amount(0..1) */
function shade(hex: string, amount: number): string {
  return mixPct(hex, -amount * 100);
}

/** 高光推导:向白靠 amount(0..1) */
function tint(hex: string, amount: number): string {
  return mixPct(hex, amount * 100);
}

/** 红蓝双方服装配色:主色取公共 PASTEL 的对抗红/蓝,副色/点缀色本文件自管 */
export const DUO_COLORS = {
  red: { primary: PASTEL.red, secondary: "#C9455D", accent: "#FF9A6B", outline: "#8E3247" },
  blue: { primary: PASTEL.blue, secondary: "#3663B4", accent: "#5AC8C8", outline: "#2B4A88" }
} as const;

export interface RunnerLook {
  /** 背心主色(渐变上端) */
  vest: string;
  /** 背心暗部(渐变下端) */
  vestDark: string;
  /** 鞋色:第二剪影通道,红蓝远看也分得清 */
  shoe: string;
  /** 发帽色 */
  cap: string;
  /** 背心号码大字 */
  number: 1 | 2;
}

export type RunnerPose = "run" | "jump" | "slip";

export interface RunnerOpts {
  look: RunnerLook;
  /** 跑姿帧相位:0 = 前腿伸,1 = 后腿蹬(非 0/1 一律当 0) */
  phase?: number;
  pose?: RunnerPose;
  /** 圆形头像位要贴的脸(不传就画一张简笔笑脸) */
  faceHref?: string;
  /** 同页多实例时的 id 前缀 */
  idPrefix?: string;
}

/** 红蓝赛跑双方的既定穿搭:红方橙鞋 1 号,蓝方青鞋 2 号 */
export const RACE_LOOKS: { red: RunnerLook; blue: RunnerLook } = {
  red: {
    vest: DUO_COLORS.red.primary,
    vestDark: DUO_COLORS.red.secondary,
    shoe: DUO_COLORS.red.accent,
    cap: shade(DUO_COLORS.red.primary, 0.25),
    number: 1
  },
  blue: {
    vest: DUO_COLORS.blue.primary,
    vestDark: DUO_COLORS.blue.secondary,
    shoe: DUO_COLORS.blue.accent,
    cap: shade(DUO_COLORS.blue.primary, 0.25),
    number: 2
  }
};

const SKIN = "#F2C09A";
const SKIN_DARK = "#D9A177";
const INK = "#4A4458";

interface Limbs {
  /** 近侧腿(hip→knee→ankle)与鞋心 */
  nearLeg: string;
  nearShoe: [number, number];
  farLeg: string;
  farShoe: [number, number];
  nearArm: string;
  farArm: string;
  /** 头部上下小幅起伏 */
  headDy: number;
  /** 落地阴影宽度系数 */
  shadowW: number;
}

/** 三姿态 × 两帧的四肢关键点(侧视朝右,viewBox 64×72) */
function limbsOf(pose: RunnerPose, phase: number): Limbs {
  if (pose === "jump") {
    // 收腿:双膝上提,双臂展开向前上——腾空的姿态一眼可读
    return {
      nearLeg: "M32 44 Q41 48 37 55",
      nearShoe: [38, 56],
      farLeg: "M31 44 Q38 50 33 57",
      farShoe: [34, 58],
      nearArm: "M34 30 Q41 25 47 20",
      farArm: "M33 31 Q39 29 44 26",
      headDy: -2,
      shadowW: 0.6
    };
  }
  if (pose === "slip") {
    // 坐地:腿伸直搭在地上,手往后撑,整个人是「哎呀坐下了」不是「摔伤了」
    return {
      nearLeg: "M32 54 Q42 57 52 60",
      nearShoe: [54, 60],
      farLeg: "M31 54 Q40 60 48 63",
      farShoe: [50, 63],
      nearArm: "M33 40 Q26 48 22 56",
      farArm: "M32 41 Q27 50 25 57",
      headDy: 12,
      shadowW: 1.25
    };
  }
  if (phase === 1) {
    // 后腿蹬:膝盖前顶、原前腿收到身后,摆臂整组对调
    return {
      nearLeg: "M32 44 Q41 47 39 58",
      nearShoe: [40, 59],
      farLeg: "M31 44 Q25 53 19 60",
      farShoe: [17, 61],
      nearArm: "M34 30 Q42 33 47 29",
      farArm: "M33 31 Q26 37 22 33",
      headDy: 1,
      shadowW: 0.9
    };
  }
  // 帧 0 · 前腿伸:前脚落地、后脚蹬离,近臂后摆 / 远臂前摆(约 ±35°)
  return {
    nearLeg: "M32 44 Q42 50 47 61",
    nearShoe: [49, 62],
    farLeg: "M31 44 Q24 51 16 57",
    farShoe: [14, 58],
    nearArm: "M34 30 Q27 37 22 32",
    farArm: "M33 31 Q41 34 46 30",
    headDy: 0,
    shadowW: 1
  };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 滑倒时头顶那三颗转圈星(class 交给 CSS 做旋转,减弱动效时静止) */
function slipStars(cx: number, cy: number): string {
  const star = (x: number, y: number, r: number): string => {
    const pts: string[] = [];
    for (let i = 0; i < 10; i++) {
      const rad = (Math.PI / 5) * i - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.45;
      pts.push(`${(x + Math.cos(rad) * rr).toFixed(1)},${(y + Math.sin(rad) * rr).toFixed(1)}`);
    }
    return `<polygon class="kit-slip-star" points="${pts.join(" ")}" fill="#F5C445" stroke="#C29024" stroke-width="1"/>`;
  };
  return `<g class="kit-slip-stars" transform-origin="${cx} ${cy}">${star(cx - 13, cy - 12, 4)}${star(cx + 1, cy - 17, 5)}${star(cx + 14, cy - 11, 4)}</g>`;
}

/**
 * 侧视跑者小人。输出保证:
 *  - 不同 `phase` / `pose` 四肢路径不同(两帧跑姿肉眼可辨);
 *  - `look` 的背心 / 鞋 / 帽三通道颜色都会出现在标记里;
 *  - 不含 NaN、不含脚本,id 全部带 `idPrefix`。
 */
export function runnerSvg(opts: RunnerOpts): string {
  const look = opts.look;
  const pose: RunnerPose = opts.pose ?? "run";
  const phase = opts.phase === 1 ? 1 : 0;
  const pre = (opts.idPrefix ?? "kitRunner").replace(/[^a-zA-Z0-9_-]/g, "");
  const L = limbsOf(pose, phase);
  const hy = L.headDy;
  const torsoDy = pose === "slip" ? 10 : 0;
  const vestTop = tint(look.vest, 0.18);

  const face = opts.faceHref
    ? `<image href="${esc(opts.faceHref)}" x="31" y="${5 + hy}" width="20" height="20" preserveAspectRatio="xMidYMid slice" clip-path="url(#${pre}-face)"/>`
    : `<g><circle cx="41" cy="${15 + hy}" r="10" fill="${SKIN}"/><circle cx="45" cy="${14 + hy}" r="1.6" fill="${INK}"/><path d="M42 ${19 + hy} Q45 ${21.5 + hy} 48 ${19 + hy}" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/><circle cx="38" cy="${18 + hy}" r="1.8" fill="#F8B7CD" opacity=".7"/></g>`;

  const leg = (d: string, dark: boolean): string =>
    `<path d="${d}" fill="none" stroke="${dark ? SKIN_DARK : SKIN}" stroke-width="5" stroke-linecap="round"/>`;
  const shoe = (p: [number, number], dark: boolean): string =>
    `<g><ellipse cx="${p[0]}" cy="${p[1]}" rx="5" ry="3" fill="${dark ? shade(look.shoe, 0.2) : look.shoe}" stroke="${shade(look.shoe, 0.45)}" stroke-width="1"/><ellipse cx="${p[0]}" cy="${p[1] + 1.6}" rx="5" ry="1.2" fill="${shade(look.shoe, 0.5)}"/></g>`;
  const arm = (d: string, dark: boolean): string =>
    `<path d="${d}" fill="none" stroke="${dark ? SKIN_DARK : SKIN}" stroke-width="4.4" stroke-linecap="round"/>`;

  return (
    `<svg viewBox="0 0 64 72" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" data-pose="${pose}" data-phase="${phase}">` +
    `<defs>` +
    `<linearGradient id="${pre}-vest" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${vestTop}"/><stop offset="1" stop-color="${look.vestDark}"/>` +
    `</linearGradient>` +
    `<clipPath id="${pre}-face"><circle cx="41" cy="${15 + hy}" r="10"/></clipPath>` +
    `</defs>` +
    `<ellipse cx="33" cy="66" rx="${(15 * L.shadowW).toFixed(1)}" ry="3.4" fill="rgba(90,80,110,.18)"/>` +
    // 远侧肢体压在躯干后面,一深一浅拉出前后层次
    arm(L.farArm, true) +
    leg(L.farLeg, true) +
    shoe(L.farShoe, true) +
    // 躯干背心:主色渐变 + 描边 + 底边暗阶,胸口号码大字
    `<g transform="translate(0 ${torsoDy})">` +
    `<path d="M27 26 L41 26 Q45 26 44.4 30.5 L42.6 43.5 Q42 47 38.5 47 L27.5 47 Q24 47 24.4 43 L25.8 29.5 Q26.2 26 27 26 Z" fill="url(#${pre}-vest)" stroke="${INK}" stroke-width="1.6"/>` +
    `<path d="M25 41 L43 41 L42.6 43.5 Q42 47 38.5 47 L27.5 47 Q24 47 24.4 43 Z" fill="${shade(look.vestDark, 0.18)}" opacity=".55"/>` +
    `<text x="34" y="40" font-size="12.5" font-weight="900" font-family="system-ui, sans-serif" fill="#FFFFFF" text-anchor="middle" stroke="${shade(look.vestDark, 0.35)}" stroke-width=".6">${look.number}</text>` +
    `</g>` +
    // 头:脸(头像位)+ 发帽 + 帽舌
    `<g>` +
    `<circle cx="41" cy="${15 + hy}" r="10" fill="${SKIN}"/>` +
    face +
    `<path d="M31.2 ${13 + hy} A9.9 9.9 0 0 1 50.8 ${12.4 + hy} L51.5 ${13.4 + hy} Q42 ${7 + hy} 31.6 ${14.6 + hy} Z" fill="${look.cap}" stroke="${shade(look.cap, 0.3)}" stroke-width="1"/>` +
    `<path d="M49.5 ${11.5 + hy} Q55 ${11 + hy} 56 ${13.5 + hy} L50.5 ${14.5 + hy} Z" fill="${look.cap}" stroke="${shade(look.cap, 0.3)}" stroke-width="1"/>` +
    `<circle cx="41" cy="${15 + hy}" r="10" fill="none" stroke="${INK}" stroke-width="1.4"/>` +
    `</g>` +
    // 近侧肢体盖在躯干前
    leg(L.nearLeg, false) +
    shoe(L.nearShoe, false) +
    arm(L.nearArm, false) +
    (pose === "slip" ? slipStars(41, 15 + hy) : "") +
    `</svg>`
  );
}
