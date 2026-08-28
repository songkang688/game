/**
 * 拼图乐园 · 1.3 视觉层(第 21 步 B 档)。
 *
 * 本文件只有「皮肤」:--pt- 配色 token、动效时序、图层序、拼块齿边皮肤 SVG、
 * 放对 / 放错的类名映射、虚影只读映射、旋转视角累计角、FX 计时包。
 * 判定数值(吸附阈值 / 解算 / 校验 / 关卡数据 / 存档 key)一个都不在这里,也一个都不许改:
 * 齿边是 pointer-events:none 的裁剪层,块的逻辑坐标与拖拽热区仍是方格。
 *
 * `prefers-reduced-motion` 下抬升 / 回弹 / 摇头 / 装裱全停,
 * 静态齿边与层次保留,放对的接缝白光保留(功能反馈,不是纯装饰)。
 */
import { jigsawD, jigsawRadiusPct } from "../../art/kit/jigsaw";
import { shade } from "../../art/kit/fruit";
import { PATTERN_CELL, patternSliceNestedSvg } from "../../art/kit/pattern";

// ---------------------------------------------------------------------------
// 一、配色 token 与动效时序(step 文档 四·补一 / 四·补三,测试逐字核对)
// ---------------------------------------------------------------------------

/** --pt- 配色 token:全部落在样式表里,由 .pz-wrap / .pz-mode / .pzt-drag 携带 */
export const PT_TOKENS: Readonly<Record<string, string>> = {
  "--pt-easel": "#EFE4D4",
  "--pt-frame": "#C89B6C",
  "--pt-frame-grain": shade("#C89B6C", -0.2),
  "--pt-piece-edge": "rgba(255,255,255,.5)",
  "--pt-ghost": "rgba(244,133,159,.3)",
  "--pt-slot": "inset 0 2px 4px rgba(0,0,0,.12)",
  "--pt-glow": "rgba(255,214,120,.5)",
  "--pt-seam": "#FFFFFF",
};

/** 动效时序表(毫秒 / 幅度),CSS 里写成同名自定义属性 */
export const PT_TIMING = {
  /** 拾起抬升:4px + 1.04,80ms ease-out,reduced 只加描边 */
  liftMs: 80,
  liftPx: 4,
  liftScale: 1.04,
  /** 吸附回弹:1.04→0.98→1,150ms ease-out-back,reduced 瞬间落定 */
  snapMs: 150,
  /** 放错摇头:±3°,240ms ease-in-out,reduced 瞬回 */
  shakeMs: 240,
  shakeDeg: 3,
  /** 旋转过渡:120ms ease-out,reduced 瞬转 */
  rotMs: 120,
  /** 滑动位移:90ms + scaleX 1.03,reduced 位移保留、拉伸关 */
  slideMs: 90,
  slideStretch: 1.03,
  /** 装裱合拢:300ms 四边合拢,reduced 直接展示成品 */
  mountMs: 300,
} as const;

/**
 * DOM 图层序(z-index 从低到高):
 * ① 画室底 → ② 底板网格/凹槽 → ③ 已放定拼块 → ④ 虚影提示 →
 * ⑤ 拾起中的拼块(最高+影子) → ⑥ 星闪/彩纸 → ⑦ 顶栏 → ⑧ 完成装裱浮层
 */
export const PT_LAYERS = {
  easel: 0,
  slots: 1,
  placed: 2,
  ghost: 3,
  lift: 60,
  fx: 70,
  hud: 80,
  mount: 90,
} as const;

// ---------------------------------------------------------------------------
// 二、纯映射:反馈类名 / 虚影只读 / 旋转视角累计角
// ---------------------------------------------------------------------------

/**
 * 放对 / 放错走不同视觉分支。
 * 放对:吸附回弹 + 接缝白光;reduced 只留白光(功能反馈)。
 * 放错:轻微摇头(提示不批评);reduced 瞬回,一个类都不加。
 */
export function dropFxClasses(kind: "snap" | "wrong", reduced: boolean): string[] {
  if (kind === "snap") return reduced ? ["pzv-seam"] : ["pzv-snap", "pzv-seam"];
  return reduced ? [] : ["pzv-shake"];
}

/**
 * 虚影提示:这一格亮不亮只读既有校验的输入(缺口表 / 已补表 / 手里块的值),
 * 不写任何游戏数据——凑近且「这块就该放这里」才亮。
 */
export function ghostTarget(
  pos: number,
  value: number,
  holes: readonly number[],
  filled: readonly number[]
): boolean {
  return value === pos && holes.includes(pos) && !filled.includes(pos);
}

/**
 * 旋转视角的累计角:顺点一下 +90°、撤一步 -90°,永远走最短的那一段,
 * 不会出现 270°→0° 倒转三圈;视角和逻辑走散了就直接对齐(逻辑朝向说了算)。
 */
export function stepAngle(prevDeg: number, fromQ: number, toQ: number): number {
  const norm = (q: number): number => ((Math.round(q) % 4) + 4) % 4;
  const prevQ = norm(prevDeg / 90);
  if (prevQ !== norm(fromQ)) return norm(toQ) * 90;
  const delta = norm(toQ - fromQ);
  if (delta === 3) return prevDeg - 90;
  return prevDeg + delta * 90;
}

// ---------------------------------------------------------------------------
// 三、FX 计时包:视觉动画的 setTimeout 统一记账,destroy 一把清零
// ---------------------------------------------------------------------------

export class PtFx {
  private pending = new Set<ReturnType<typeof setTimeout>>();

  later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      this.pending.delete(t);
      fn();
    }, ms);
    this.pending.add(t);
  }

  get size(): number {
    return this.pending.size;
  }

  clear(): void {
    this.pending.forEach((t) => clearTimeout(t));
    this.pending.clear();
  }
}

// ---------------------------------------------------------------------------
// 四、拼块皮肤 SVG(纯字符串,不碰 DOM)
// ---------------------------------------------------------------------------

let skinUid = 0;

export interface PieceSkinOpts {
  rows: number;
  cols: number;
  /** 这一块「回家」时的行列:齿形跟着块走,拼齐才严丝合缝 */
  r: number;
  c: number;
  bg: string;
  /** 块的真实边长(px):小于 40px 自动降 14% 齿形半径 */
  cellPx: number;
  seed?: number;
  /** 虚影皮肤:粉色半透明,无描边无纸纹 */
  ghost?: boolean;
  /**
   * 牌面切片(窗口 7 R1 修复:拼的是画不是 emoji):
   * 传主题号 + 块号,场景画切片会被齿形路径裁剪后垫在纸纹下面;
   * 不传时输出与 1.3 首发一字不差(既有用例不惊动)。
   */
  slice?: { theme: number; home: number };
}

/**
 * 一块拼图的皮肤:凹凸齿轮廓 + 场景画切片(齿形裁剪) + 纸质渐变(135°,白 4% → 透明 60%)+ 1px 内亮边。
 * 绝对定位、pointer-events:none,往四周各多出一个齿形半径,按钮热区一个像素不动。
 */
export function pieceSkinSvg(opts: PieceSkinOpts): string {
  const size = Number.isFinite(opts.cellPx) && opts.cellPx > 0 ? opts.cellPx : 64;
  const radPct = jigsawRadiusPct(size);
  const rad = (size * radPct) / 100;
  const d = jigsawD(opts.rows, opts.cols, opts.r, opts.c, size, opts.seed ?? 1);
  const box = `${-rad} ${-rad} ${size + 2 * rad} ${size + 2 * rad}`;
  const head =
    `<svg class="pzv-skin${opts.ghost ? " pzv-ghostskin" : ""}" viewBox="${box}" ` +
    `preserveAspectRatio="none" aria-hidden="true" focusable="false" style="inset:-${radPct}%">`;
  if (opts.ghost) {
    return `${head}<path d="${d}" fill="var(--pt-ghost)"/></svg>`;
  }
  const gid = `ptg${++skinUid}`;
  // 切片视窗四周多裁一个齿形半径(换算成画面单位),凸齿上也有画,拼合无缝
  const slice = opts.slice
    ? `<clipPath id="${gid}c"><path d="${d}"/></clipPath>` +
      `<g clip-path="url(#${gid}c)">` +
      patternSliceNestedSvg(
        opts.slice.theme,
        opts.rows,
        opts.cols,
        opts.slice.home,
        -rad,
        -rad,
        size + 2 * rad,
        size + 2 * rad,
        (rad / size) * PATTERN_CELL
      ) +
      `</g>`
    : "";
  return (
    head +
    `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset=".04" stop-color="rgba(255,255,255,.5)"/>` +
    `<stop offset=".6" stop-color="rgba(255,255,255,0)"/>` +
    `</linearGradient></defs>` +
    `<path d="${d}" fill="${opts.bg}" stroke="var(--pt-piece-edge)" stroke-width="2"/>` +
    slice +
    `<path d="${d}" fill="url(#${gid})"/>` +
    `</svg>`
  );
}

// ---------------------------------------------------------------------------
// 五、顶栏三枚玩法图标签(齿块 / 旋转箭头 / 滑槽)
// ---------------------------------------------------------------------------

const MODE_ICONS: Readonly<Record<"fill" | "rotate" | "slide", { label: string; svg: string }>> = {
  fill: {
    label: "缺块补齐",
    svg:
      `<svg viewBox="0 0 24 24" aria-hidden="true"><path transform="translate(4 4)" ` +
      `d="${jigsawD(2, 2, 0, 0, 15, 3)}" fill="currentColor"/></svg>`,
  },
  rotate: {
    label: "旋转块",
    svg:
      `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<path d="M 12 5 a 7 7 0 1 1 -6.2 3.4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M 3.6 3.2 L 6.6 9.4 L 11 5.2 Z" fill="currentColor"/></svg>`,
  },
  slide: {
    label: "推格子",
    svg:
      `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>` +
      `<rect x="6.2" y="8.2" width="5.2" height="7.6" rx="1.4" fill="currentColor"/></svg>`,
  },
};

/** 顶栏玩法标识:三枚图标签,本关玩法亮起(纯标识不可点,玩法由关卡决定) */
export function modeTagHtml(active: "fill" | "rotate" | "slide"): string {
  const order: Array<"fill" | "rotate" | "slide"> = ["fill", "rotate", "slide"];
  const chips = order
    .map((k) => `<i class="pzv-micon${k === active ? " pzv-mode-on" : ""}" title="${MODE_ICONS[k].label}">${MODE_ICONS[k].svg}</i>`)
    .join("");
  return `<span class="pzv-modetag" role="img" aria-label="本关玩法:${MODE_ICONS[active].label}">${chips}</span>`;
}

// ---------------------------------------------------------------------------
// 六、完成装裱浮层(画框四边合拢 + 彩纸 + 画廊语义)
// ---------------------------------------------------------------------------

const CONFETTI_COLORS = ["#F4859F", "#FFD86E", "#8E86E0", "#A8DDA0", "#7FC8E8", "#F2B04C"];

/** 彩纸:位置 / 颜色 / 延迟全由下标确定(不掺随机,两次装裱一个样) */
export function confettiHtml(n = 12): string {
  let out = "";
  for (let i = 0; i < n; i++) {
    const left = (i * 83 + 7) % 100;
    const delay = (i % 5) * 90;
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const spin = i % 2 === 0 ? 200 : -160;
    out +=
      `<i style="left:${left}%;background:${color};animation-delay:${delay}ms;` +
      `--pt-cspin:${spin}deg"></i>`;
  }
  return `<span class="pzv-confetti">${out}</span>`;
}

/** 完成装裱浮层的内容:四条木框边合拢 + 画廊语义标牌 + 彩纸 */
export function framingOverlayHtml(caption: string): string {
  return (
    `<i class="pzv-mbar pzv-mt"></i><i class="pzv-mbar pzv-mb"></i>` +
    `<i class="pzv-mbar pzv-ml"></i><i class="pzv-mbar pzv-mr"></i>` +
    confettiHtml() +
    `<span class="pzv-mcap">${caption}</span>`
  );
}

// ---------------------------------------------------------------------------
// 七、1.3 新增样式(pzv- 前缀,只往既有 CSS 后面追加,靠书写顺序覆盖)
// ---------------------------------------------------------------------------

const tokenCss = Object.entries(PT_TOKENS)
  .map(([k, v]) => `${k}: ${v};`)
  .join(" ");

export const PT_CSS = `
/* ---- 1.3 视觉升级(全部 pzv- 前缀):token 与时序自定义属性 ---- */
.pz-wrap, .pz-mode, .pzt-drag {
  ${tokenCss}
  --pt-lift-ms: ${PT_TIMING.liftMs}ms; --pt-snap-ms: ${PT_TIMING.snapMs}ms;
  --pt-shake-ms: ${PT_TIMING.shakeMs}ms; --pt-rot-ms: ${PT_TIMING.rotMs}ms;
  --pt-slide-ms: ${PT_TIMING.slideMs}ms; --pt-mount-ms: ${PT_TIMING.mountMs}ms;
}
/* ① 画室底:亚麻画布纹 */
.pz-wrap {
  background: repeating-linear-gradient(0deg, rgba(255,255,255,.22) 0 1px, transparent 1px 7px),
    repeating-linear-gradient(90deg, rgba(190,160,120,.1) 0 1px, transparent 1px 7px),
    var(--pt-easel);
}
/* ③ 齿边拼块:按钮只留热区,皮肤是往外多出一个齿形半径的裁剪层 */
.pz-tile.pzv-cut, .pz-piece.pzv-cut {
  background: transparent !important;
  box-shadow: none;
  border-radius: 0;
  position: relative;
  z-index: ${PT_LAYERS.placed};
  filter: drop-shadow(0 2px 3px rgba(120,100,80,.28));
}
.pzv-skin { position: absolute; z-index: 0; pointer-events: none; overflow: visible; }
.pzv-face, .pz-tile .pz-spin, .pz-tile.pzv-cut small { position: relative; z-index: 1; }
/* ② 凹槽:推格子的空格与缺块的洞都是刻进画板的槽 */
.pz-tile.pz-empty, .pz-tile.pz-gap {
  background: rgba(120,90,60,.1) !important;
  box-shadow: var(--pt-slot);
  border-radius: 12px;
  position: relative;
  z-index: ${PT_LAYERS.slots};
}
.pz-tile.pz-gap { color: #A08B78; }
/* ④ 虚影:凑近且块对时,槽里浮出这块的粉色影子 */
.pzv-ghostskin { opacity: 0; transition: opacity 120ms ease; z-index: ${PT_LAYERS.ghost}; }
.pz-tile.pzv-ghost-on .pzv-ghostskin { opacity: 1; }
/* ⑤ 拾起:抬升 4px + 放大 1.04 + 影子扩大,80ms */
.pzt-drag.pzv-cut {
  background: transparent;
  box-shadow: none;
  filter: drop-shadow(0 ${PT_TIMING.liftPx + 8}px 16px rgba(80,70,140,.42));
  animation: pzvLift var(--pt-lift-ms) ease-out forwards;
  z-index: ${PT_LAYERS.lift};
}
@keyframes pzvLift {
  from { transform: translate(-50%, -50%) scale(1); }
  to { transform: translate(-50%, -50%) translateY(-${PT_TIMING.liftPx}px) scale(${PT_TIMING.liftScale}); }
}
/* 放对:吸附回弹 + 接缝白光(白光是功能反馈,reduced 也保留) */
.pzv-snap { animation: pzvSnap var(--pt-snap-ms) cubic-bezier(.34,1.56,.64,1); }
@keyframes pzvSnap { 0% { transform: scale(${PT_TIMING.liftScale}); } 55% { transform: scale(.98); } 100% { transform: scale(1); } }
.pzv-seam { animation: pzvSeam 160ms steps(1, end); }
@keyframes pzvSeam {
  0% { filter: brightness(1.75) drop-shadow(0 0 7px var(--pt-seam)); }
  100% { filter: none; }
}
/* 放错:±3° 摇头提示,不批评不扣色 */
.pzv-shake { animation: pzvShake var(--pt-shake-ms) ease-in-out; }
@keyframes pzvShake {
  0%, 100% { transform: rotate(0); }
  25% { transform: rotate(${PT_TIMING.shakeDeg}deg); }
  75% { transform: rotate(-${PT_TIMING.shakeDeg}deg); }
}
/* 旋转玩法:把手四点 + 120ms 旋转过渡 + 转正星闪 */
.pzv-rotor {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  transition: transform var(--pt-rot-ms) ease-out; pointer-events: none;
}
.pzv-knob {
  position: absolute; inset: 7%; z-index: 1; pointer-events: none;
  background-image:
    radial-gradient(circle at 4% 4%, rgba(255,255,255,.95) 0 2px, rgba(140,110,80,.4) 2px 3px, transparent 4px),
    radial-gradient(circle at 96% 4%, rgba(255,255,255,.95) 0 2px, rgba(140,110,80,.4) 2px 3px, transparent 4px),
    radial-gradient(circle at 4% 96%, rgba(255,255,255,.95) 0 2px, rgba(140,110,80,.4) 2px 3px, transparent 4px),
    radial-gradient(circle at 96% 96%, rgba(255,255,255,.95) 0 2px, rgba(140,110,80,.4) 2px 3px, transparent 4px);
}
.pzv-cut.pz-upright { box-shadow: none; filter: drop-shadow(0 0 5px #A8DDA0); }
.pzv-star {
  position: absolute; left: 50%; top: 50%; width: 26px; height: 26px; margin: -13px 0 0 -13px;
  z-index: ${PT_LAYERS.fx}; pointer-events: none; background: var(--pt-seam);
  clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%);
  animation: pzvStar 360ms ease-out forwards;
}
@keyframes pzvStar {
  0% { transform: scale(.2) rotate(0deg); opacity: 1; }
  100% { transform: scale(1.2) rotate(45deg); opacity: 0; }
}
/* 滑块玩法:90ms 位移 + 轻微惯性拉伸;可滑的块加微光边 */
.pzv-slidein { animation: pzvSlideIn var(--pt-slide-ms) ease-out; }
@keyframes pzvSlideIn {
  from { transform: translate(var(--pt-sx, 0), var(--pt-sy, 0)) scaleX(${PT_TIMING.slideStretch}); }
  to { transform: none; }
}
@keyframes pzvSlideInFlat {
  from { transform: translate(var(--pt-sx, 0), var(--pt-sy, 0)); }
  to { transform: none; }
}
.pz-tile.pzv-can .pzv-skin { filter: drop-shadow(0 0 4px var(--pt-glow)); }
/* 齿边块的提示高亮 / 选中描边改走形状投影(方形描边会穿帮) */
.pzv-cut.pz-glow { box-shadow: none; filter: drop-shadow(0 0 6px #FFD86E) drop-shadow(0 0 2px #FFD86E); }
.pzv-cut.pzt-target { box-shadow: none; filter: drop-shadow(0 0 6px #FFD86E); }
.pz-piece.pzv-cut.pz-piece-on { outline: none; filter: drop-shadow(0 0 5px #C2456F); }
/* 牌面切片(窗口 7 R1 修复):预览小样与底图虚影里撑满格子;记忆关藏图时切片一并藏 */
.pz-preview i, .pzt-ghost i { overflow: hidden; }
.pz-preview i .pzv-slice, .pzt-ghost i .pzv-slice { display: block; width: 100%; height: 100%; }
.pz-preview.pz-hidden i .pzv-slice { visibility: hidden; }
.pzv-scenedefs { position: absolute; width: 0; height: 0; overflow: hidden; }
/* 画框:目标预览升级成木质画框小样(框纹 + 玻璃反光斜线) */
.pz-preview {
  position: relative; overflow: hidden;
  border: 6px solid var(--pt-frame);
  border-image: repeating-linear-gradient(45deg, var(--pt-frame) 0 6px, var(--pt-frame-grain) 6px 9px) 6;
  box-shadow: 0 3px 8px rgba(120,90,60,.3);
}
.pz-preview::after {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(135deg, transparent 42%, rgba(255,255,255,.4) 50%, transparent 58%);
}
/* ⑦ 顶栏卡片化 + 三枚玩法图标签 */
.pz-top {
  position: relative; z-index: ${PT_LAYERS.hud};
  background: rgba(255,255,255,.72);
  border: 1px solid rgba(200,155,108,.35);
  border-radius: 14px; padding: 7px 9px;
  box-shadow: 0 2px 8px rgba(120,90,60,.15);
}
.pzv-modetag {
  display: inline-flex; gap: 4px; align-items: center;
  background: #fff; border-radius: 12px; padding: 4px 6px;
  box-shadow: 0 2px 6px rgba(130,130,210,.25);
}
.pzv-micon { width: 18px; height: 18px; font-style: normal; color: #B9AE9E; opacity: .38; }
.pzv-micon svg { width: 100%; height: 100%; display: block; }
.pzv-micon.pzv-mode-on { color: #C2456F; opacity: 1; }
/* ⑧ 完成装裱浮层:四条木框边合拢 + 彩纸 + 画廊标牌 */
.pzv-mount {
  position: absolute; inset: 0; z-index: ${PT_LAYERS.mount};
  pointer-events: none; border-radius: 16px; overflow: hidden;
}
.pzv-mbar { position: absolute; background: linear-gradient(180deg, var(--pt-frame), var(--pt-frame-grain)); }
.pzv-mbar.pzv-mt { top: 0; left: 0; right: 0; height: 10px; transform: translateY(-110%); animation: pzvMountY var(--pt-mount-ms) ease-in-out forwards; }
.pzv-mbar.pzv-mb { bottom: 0; left: 0; right: 0; height: 10px; transform: translateY(110%); animation: pzvMountY var(--pt-mount-ms) ease-in-out forwards; }
.pzv-mbar.pzv-ml { top: 0; bottom: 0; left: 0; width: 10px; transform: translateX(-110%); animation: pzvMountX var(--pt-mount-ms) ease-in-out forwards; }
.pzv-mbar.pzv-mr { top: 0; bottom: 0; right: 0; width: 10px; transform: translateX(110%); animation: pzvMountX var(--pt-mount-ms) ease-in-out forwards; }
@keyframes pzvMountY { to { transform: translateY(0); } }
@keyframes pzvMountX { to { transform: translateX(0); } }
.pzv-mcap {
  position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
  background: rgba(255,255,255,.94); color: #8A6B4A; font-weight: 900; font-size: 15px;
  padding: 6px 14px; border-radius: 999px; white-space: nowrap;
  box-shadow: 0 3px 8px rgba(120,90,60,.25);
  opacity: 0; animation: pzvCap 240ms ease-out var(--pt-mount-ms) forwards;
}
@keyframes pzvCap { to { opacity: 1; } }
.pzv-confetti i {
  position: absolute; top: -16px; width: 8px; height: 12px; border-radius: 2px;
  animation: pzvConf 900ms ease-in forwards;
}
@keyframes pzvConf { to { transform: translateY(560px) rotate(var(--pt-cspin, 180deg)); opacity: .4; } }
/* reduced:抬升 / 回弹 / 摇头 / 旋转过渡 / 滑动拉伸 / 装裱全停;齿边层次与接缝白光保留 */
@media (prefers-reduced-motion: reduce) {
  .pzt-drag.pzv-cut { animation: none; outline: 2px solid var(--pt-seam); transform: translate(-50%, -50%); }
  .pzv-snap, .pzv-shake, .pzv-star { animation: none; }
  .pzv-slidein { animation-name: pzvSlideInFlat; }
  .pzv-rotor { transition: none; }
  .pzv-mbar, .pzv-confetti i, .pzv-mcap { animation: none; }
}
@media (max-width: 380px) {
  .pz-top { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; padding: 6px 7px; }
  .pz-top .pz-badge { white-space: nowrap; flex: 0 0 auto; }
  .pzv-micon { width: 16px; height: 16px; }
}
`;
