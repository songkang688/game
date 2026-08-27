/**
 * 时钟小屋 1.3 · A 档视觉模块（只动皮，不动骨）。
 *
 * 这里住着本款全部「画出来的东西」：
 *  - 4.1 规格表的配色 token（CLK_TOKENS）；
 *  - 时针胖箭头 / 分针细长箭头的 path 几何（arrowHandD：端点坐标由调用方用
 *    `handTip` 算好传进来，本模块只负责造型，绝不自己再算一遍角度）；
 *  - 布谷鸟小屋外壳（瓦纹屋顶 + 烟囱 + 木纹壁板 + 摆锤 + 暖光小窗 + 盆栽房间背景）；
 *  - 答题反馈的小鸟层（答对咕咕 + 星屑 6 粒；答错只歪头，绝不批评）；
 *  - HOUSE_CSS：以上所有视觉的样式，单独一个 style 节点挂载，
 *    不混进 runner.ts 的 CLK_CSS（那份有自己的契约锁）。
 *
 * 红线：不碰 hourHandAngleAt / minuteHandAngleAt / handTip、不碰判定与题库、
 * 不碰 data-t / aria-label 可测接口；无位图、无运行时依赖。
 */
import { PASTEL, shade, withAlpha } from "../../art/kit/palette";
import { SPARK_MS, sparkleCss, sparkleSpecs } from "../../art/kit/sparkle";

/** 4.1 规格表的配色 token（一字不差） */
export const CLK_TOKENS = {
  /** 屋身壁板 / 木纹线与描边 */
  houseWood: "#d9a066",
  houseWoodDark: "#a06b3a",
  /** 屋顶瓦片双色交错 */
  roofRed: "#e8735a",
  roofRedDark: "#c25542",
  /** 表盘底色 */
  dialCream: "#fff8ec",
  /** 时针主色（胖箭头） */
  hourOrange: "#ff9f43",
  /** 分针主色（细长箭头） */
  minuteTeal: "#2ec4b6",
  /** 小窗暖光 */
  windowGlow: "#ffe9a8",
  /** 房间墙纸 / 地板线 */
  wallPaper: "#f6eef7",
  floorLine: "#e0d4e4",
} as const;

// ---------------------------------------------------------------------------
// 指针造型：胖箭头（时针）与细长箭头（分针）的 path 几何
// ---------------------------------------------------------------------------

export interface HandShape {
  /** 杆的半宽（规格：时针杆宽 7 → 3.5，分针杆宽 4 → 2） */
  shaftHalf: number;
  /** 箭头三角的半宽（规格：时针 12 → 6） */
  headHalf: number;
  /** 箭头三角的长度（从杆头到针尖） */
  headLen: number;
  /** 尾部造型：round = 圆配重（时针），feather = 尾羽两片小三角（分针） */
  tail: "round" | "feather";
  /** 圆配重半径 / 尾羽长度 */
  tailSize: number;
}

/** 时针：短粗胖箭头 + 圆尾配重 r=4（4.2 工序单第 1 条） */
export const HOUR_HAND_SHAPE: HandShape = { shaftHalf: 3.5, headHalf: 6, headLen: 7.5, tail: "round", tailSize: 4 };

/** 分针：细长箭头 + 尾羽两片小三角（4.2 工序单第 2 条） */
export const MINUTE_HAND_SHAPE: HandShape = { shaftHalf: 2, headHalf: 4.2, headLen: 9, tail: "feather", tailSize: 5 };

const f = (n: number): string => n.toFixed(2);

/**
 * 从中心 (cx, cy) 指到针尖 (tipX, tipY) 的箭头 path d。
 * 针尖坐标由调用方用 `handTip` 算出传入——本函数只做造型，
 * 所以「path 端点 = handTip 输出」可以逐字节断言。
 */
export function arrowHandD(cx: number, cy: number, tipX: number, tipY: number, s: HandShape): string {
  const dx = tipX - cx;
  const dy = tipY - cy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // 垂直单位向量（顺时针 90 度）
  const px = -uy;
  const py = ux;
  // 杆头（箭头三角的底边中心）
  const hx = cx + ux * Math.max(0, len - s.headLen);
  const hy = cy + uy * Math.max(0, len - s.headLen);
  const arrow =
    `M ${f(cx + px * s.shaftHalf)} ${f(cy + py * s.shaftHalf)} ` +
    `L ${f(hx + px * s.shaftHalf)} ${f(hy + py * s.shaftHalf)} ` +
    `L ${f(hx + px * s.headHalf)} ${f(hy + py * s.headHalf)} ` +
    `L ${f(tipX)} ${f(tipY)} ` +
    `L ${f(hx - px * s.headHalf)} ${f(hy - py * s.headHalf)} ` +
    `L ${f(hx - px * s.shaftHalf)} ${f(hy - py * s.shaftHalf)} ` +
    `L ${f(cx - px * s.shaftHalf)} ${f(cy - py * s.shaftHalf)} Z`;
  if (s.tail === "round") {
    // 圆配重：中心背向针尖偏 tailSize + 1，一整圈用两段圆弧闭合
    const bx = cx - ux * (s.tailSize + 1);
    const by = cy - uy * (s.tailSize + 1);
    const r = s.tailSize;
    return (
      `${arrow} M ${f(bx + r)} ${f(by)} ` +
      `A ${f(r)} ${f(r)} 0 1 1 ${f(bx - r)} ${f(by)} ` +
      `A ${f(r)} ${f(r)} 0 1 1 ${f(bx + r)} ${f(by)} Z`
    );
  }
  // 尾羽：两片小三角，从尾根向后张开
  const rx = cx - ux * 2;
  const ry = cy - uy * 2;
  const ex = cx - ux * (2 + s.tailSize);
  const ey = cy - uy * (2 + s.tailSize);
  const feather = (side: number): string =>
    `M ${f(rx)} ${f(ry)} L ${f(ex + px * side * s.tailSize * 0.9)} ${f(ey + py * side * s.tailSize * 0.9)} ` +
    `L ${f(ex + px * side * s.shaftHalf * 0.4)} ${f(ey + py * side * s.shaftHalf * 0.4)} Z`;
  return `${arrow} ${feather(1)} ${feather(-1)}`;
}

/** 轴心铆钉：外圆木色 + 内圆深色 + 高光点，盖住两针交点（4.2 工序单第 3 条） */
export function hubSVG(cx = 50, cy = 50): string {
  return (
    `<g class="clk-hub">` +
    `<circle cx="${cx}" cy="${cy}" r="7" fill="${CLK_TOKENS.houseWood}" stroke="${CLK_TOKENS.houseWoodDark}" stroke-width="1.6"/>` +
    `<circle cx="${cx}" cy="${cy}" r="3.5" fill="${CLK_TOKENS.houseWoodDark}"/>` +
    `<circle cx="${f(cx - 1.4)}" cy="${f(cy - 1.4)}" r="1.1" fill="${withAlpha("#ffffff", 0.7)}"/>` +
    `</g>`
  );
}

// ---------------------------------------------------------------------------
// 布谷鸟小屋外壳：屋顶 / 屋身开槽 / 屋底（摆锤 + 小窗 + 盆栽）
// ---------------------------------------------------------------------------

/** 屋顶瓦片排数（规格：三排交错） */
export const ROOF_TILE_ROWS = 3;

/** 屋顶：三角 + 三排交错瓦片 + 烟囱三圈砖线 + 布谷鸟门洞（4.2 工序单第 4 条） */
export function roofSVG(): string {
  const T = CLK_TOKENS;
  let tiles = "";
  // 三排瓦：一排比一排高、短，双色交错；整体用三角 clip 裁齐
  for (let row = 0; row < ROOF_TILE_ROWS; row++) {
    const y = 26 - row * 8.5;
    const offset = row % 2 === 0 ? 0 : 4.5;
    for (let i = 0; i < 14; i++) {
      const x = 2 + offset + i * 8.5;
      tiles += `<rect x="${f(x)}" y="${f(y)}" width="7.6" height="9" rx="3.4" fill="${
        (i + row) % 2 === 0 ? T.roofRed : T.roofRedDark
      }"/>`;
    }
  }
  return (
    `<svg class="clk-house-roof" viewBox="0 0 120 36" aria-hidden="true">` +
    `<defs><clipPath id="clkRoofClip"><path d="M2 35 L60 3 L118 35 Z"/></clipPath></defs>` +
    // 烟囱 + 三圈砖线
    `<g class="clk-chimney"><rect x="86" y="4" width="9" height="16" rx="1.5" fill="${T.houseWood}" stroke="${T.houseWoodDark}" stroke-width="1.2"/>` +
    `<line x1="86" y1="8" x2="95" y2="8" stroke="${T.houseWoodDark}" stroke-width="0.9"/>` +
    `<line x1="86" y1="12" x2="95" y2="12" stroke="${T.houseWoodDark}" stroke-width="0.9"/>` +
    `<line x1="86" y1="16" x2="95" y2="16" stroke="${T.houseWoodDark}" stroke-width="0.9"/></g>` +
    `<path d="M2 35 L60 3 L118 35 Z" fill="${T.roofRed}"/>` +
    `<g clip-path="url(#clkRoofClip)">${tiles}</g>` +
    `<path d="M2 35 L60 3 L118 35 Z" fill="none" stroke="${T.roofRedDark}" stroke-width="2"/>` +
    // 布谷鸟门洞：拱形深色门 + 两扇小门板（小鸟从反馈层弹出，这里是它的家）
    `<g class="clk-bird-door"><path d="M53 35 L53 28 A7 7 0 0 1 67 28 L67 35 Z" fill="${shade(T.houseWoodDark, -35)}"/>` +
    `<path d="M55 35 L55 28.6 A5 5 0 0 1 60 24.4 L60 35 Z" fill="${T.houseWood}" stroke="${T.houseWoodDark}" stroke-width="0.8"/>` +
    `<path d="M65 35 L65 28.6 A5 5 0 0 0 60 24.4 L60 35 Z" fill="${T.houseWood}" stroke="${T.houseWoodDark}" stroke-width="0.8"/></g>` +
    `</svg>`
  );
}

/** 屋底：底板 + 金色摆锤（transform-origin 钉在屋底锚点）+ 两侧暖光小窗 + 左右盆栽 */
export function baseSVG(): string {
  const T = CLK_TOKENS;
  const gold = PASTEL.starGold;
  const window_ = (x: number): string =>
    `<g class="clk-window"><rect x="${x}" y="6" width="13" height="15" rx="2.5" fill="${T.houseWoodDark}"/>` +
    `<rect class="clk-win-glow" x="${f(x + 1.4)}" y="7.4" width="10.2" height="12.2" rx="1.6" fill="${T.windowGlow}"/>` +
    `<line x1="${f(x + 6.5)}" y1="7.4" x2="${f(x + 6.5)}" y2="19.6" stroke="${T.houseWoodDark}" stroke-width="1"/>` +
    `<line x1="${f(x + 1.4)}" y1="13.5" x2="${f(x + 11.6)}" y2="13.5" stroke="${T.houseWoodDark}" stroke-width="1"/></g>`;
  const plant = (x: number): string =>
    `<g class="clk-plant"><path d="M${x} 27 L${x + 9} 27 L${x + 7.6} 34 L${x + 1.4} 34 Z" fill="${T.roofRedDark}"/>` +
    `<circle cx="${f(x + 2.6)}" cy="24.6" r="3" fill="#7bc47f"/>` +
    `<circle cx="${f(x + 6.4)}" cy="24.2" r="3.2" fill="#5aa860"/>` +
    `<circle cx="${f(x + 4.5)}" cy="21.6" r="3" fill="#8fd694"/></g>`;
  return (
    `<svg class="clk-house-base" viewBox="0 0 120 36" aria-hidden="true">` +
    // 底板（屋底锚点在 y=0 一线）
    `<rect x="8" y="0" width="104" height="6" rx="2" fill="${T.houseWood}" stroke="${T.houseWoodDark}" stroke-width="1.4"/>` +
    window_(20) + window_(87) +
    // 摆锤：细杆 + 圆锤（金色 + 高光弧），锚点在底板下沿中点
    `<g transform="translate(60 5)"><g class="clk-pend">` +
    `<line x1="0" y1="0" x2="0" y2="21" stroke="${T.houseWoodDark}" stroke-width="2"/>` +
    `<circle cx="0" cy="25" r="6" fill="${gold}" stroke="${shade(gold, -30)}" stroke-width="1.4"/>` +
    `<path d="M -3 22.6 A 4.2 4.2 0 0 1 1.4 20.8" fill="none" stroke="${withAlpha("#ffffff", 0.85)}" stroke-width="1.3" stroke-linecap="round"/>` +
    `</g></g>` +
    plant(2) + plant(107) +
    `</svg>`
  );
}

/**
 * 小屋外壳的完整 HTML：屋顶 → 屋身开槽（.clk-house-mid，钟面 SVG 挂进去）→ 屋底。
 * 房间背景（墙纸 + 地板线）由 `.clk-house` 自己的 CSS 画，盆栽在屋底 SVG 两端。
 */
export function houseHTML(): string {
  return `${roofSVG()}<div class="clk-house-mid"></div>${baseSVG()}`;
}

// ---------------------------------------------------------------------------
// 答题反馈：小鸟层（读判定结果只做映射，绝不批评）
// ---------------------------------------------------------------------------

/** 答对 / 答错各走一个视觉分支的类名（纯映射，可测） */
export function birdMoodClass(correct: boolean): string {
  return correct ? "clk-bird-cheer" : "clk-bird-peek";
}

/** 答对时小鸟说的话（只夸不评） */
export const CUCKOO_SAY = "咕咕！";

/** 答对的星屑颗数（规格：6 粒） */
export const CHEER_SPARKS = 6;

/** 原创小鸟：圆身 + 翅膀 + 小嘴 + 眼睛，站在一小截栖木上（不像任何品牌角色） */
export function birdSVG(): string {
  const T = CLK_TOKENS;
  return (
    `<svg class="clk-bird" viewBox="0 0 44 40" aria-hidden="true">` +
    `<line x1="6" y1="36" x2="38" y2="36" stroke="${T.houseWoodDark}" stroke-width="3" stroke-linecap="round"/>` +
    `<g class="clk-bird-body">` +
    `<ellipse cx="22" cy="24" rx="11" ry="10" fill="#8ecbde"/>` +
    `<path d="M13 27 Q7 31 6 25 Q11 22 14 24 Z" fill="#5fa8c2"/>` +
    `<circle cx="27" cy="15" r="7.5" fill="#a5d8e8"/>` +
    `<path d="M34 14 L40 16 L34 18 Z" fill="${T.hourOrange}"/>` +
    `<circle cx="28.5" cy="13.5" r="1.6" fill="#2f3b45"/>` +
    `<circle cx="29.1" cy="12.9" r="0.5" fill="#ffffff"/>` +
    `<path d="M24 8 Q26 4 29 7" fill="none" stroke="#5fa8c2" stroke-width="1.6" stroke-linecap="round"/>` +
    `<line x1="18" y1="33" x2="18" y2="36" stroke="${T.hourOrange}" stroke-width="1.8" stroke-linecap="round"/>` +
    `<line x1="25" y1="33" x2="25" y2="36" stroke="${T.hourOrange}" stroke-width="1.8" stroke-linecap="round"/>` +
    `</g></svg>`
  );
}

export interface ClockFxHandle {
  /** 答对：小鸟弹出咕咕两下 + 星屑 6 粒（reduced 下 CSS 全停，只剩静态小鸟） */
  cheer: (rand?: () => number) => void;
  /** 答错：小鸟探头歪脑袋（不批评） */
  oops: () => void;
  /** 连错到壳自己亮提示的那一刻，给正确项加一圈柔光（只做映射，不提前泄答案） */
  glowCorrect: (btn: Element | null) => void;
  destroy: () => void;
}

/**
 * 把小鸟反馈层挂到答题宿主上。全程只加自己的节点与类名，
 * 不碰壳的判分与提示；destroy 把计时器与节点一起收干净。
 */
export function mountClockFx(host: HTMLElement): ClockFxHandle {
  const doc = host.ownerDocument;
  const root = doc.createElement("div");
  root.className = "clk-fx";
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = `${birdSVG()}<span class="clk-fx-say"></span>`;
  host.appendChild(root);
  const bird = root.querySelector(".clk-bird");
  const say = root.querySelector(".clk-fx-say");
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let dead = false;

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timers.delete(t);
      if (!dead) fn();
    }, ms);
    timers.add(t);
  }

  function calm(): void {
    bird?.classList.remove("clk-bird-cheer", "clk-bird-peek");
    if (say) say.textContent = "";
  }

  return {
    cheer(rand: () => number = Math.random): void {
      if (dead) return;
      calm();
      bird?.classList.add(birdMoodClass(true));
      if (say) say.textContent = CUCKOO_SAY;
      for (const spec of sparkleSpecs(rand, CHEER_SPARKS)) {
        const s = doc.createElement("span");
        s.className = "clk-spark";
        s.textContent = "✨";
        s.style.setProperty("--clk-spark-dx", `${spec.dx}px`);
        s.style.setProperty("--clk-spark-dy", `${spec.dy}px`);
        s.style.animationDelay = `${spec.delayMs}ms`;
        s.style.fontSize = `${spec.sizePx}px`;
        root.appendChild(s);
        later(() => s.remove(), SPARK_MS + spec.delayMs + 60);
      }
      later(calm, 700);
    },
    oops(): void {
      if (dead) return;
      calm();
      bird?.classList.add(birdMoodClass(false));
      later(calm, 500);
    },
    glowCorrect(btn: Element | null): void {
      if (!dead && btn) btn.classList.add("clk-glow");
    },
    destroy(): void {
      dead = true;
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      root.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// HOUSE_CSS：小屋 / 房间 / 小鸟 / 拨杆增亮 / 星屑的全部样式（单独 style 节点）
// ---------------------------------------------------------------------------

export const HOUSE_CSS = `
.clk-quizhost { position: relative; }
.clk-house { display: flex; flex-direction: column; align-items: center; max-width: 100%; margin: 2px auto 0;
  padding: 8px 6px 4px; border-radius: 16px;
  background-color: ${CLK_TOKENS.wallPaper};
  background-image:
    linear-gradient(to bottom, rgba(0,0,0,0) 0 86%, ${CLK_TOKENS.floorLine} 86% 87.5%, #f7efe3 87.5% 100%),
    repeating-linear-gradient(90deg, rgba(0,0,0,0) 0 15px, ${withAlpha(CLK_TOKENS.floorLine, 0.4)} 15px 16px); }
.clk-house-roof { display: block; width: 100%; height: auto; margin-bottom: -2px; z-index: 1; }
.clk-house-mid { background: repeating-linear-gradient(0deg, ${CLK_TOKENS.houseWood} 0 14px, ${shade(
  CLK_TOKENS.houseWood,
  -12
)} 14px 16px);
  border: 2px solid ${CLK_TOKENS.houseWoodDark}; border-radius: 4px 4px 12px 12px; padding: 6px; margin: 0 10px;
  line-height: 0; }
.clk-house-base { display: block; width: 100%; height: auto; margin-top: -3px; }
.clk-win-glow { animation: clkWinBreath 3s ease-in-out infinite; }
@keyframes clkWinBreath { 0%, 100% { opacity: 1; } 50% { opacity: .84; } }
.clk-pend { animation: clkPendSwing 2s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 0; }
@keyframes clkPendSwing { 0%, 100% { transform: rotate(14deg); } 50% { transform: rotate(-14deg); } }
.clk-tickpop { animation: clkTickPop 180ms cubic-bezier(.34,1.56,.64,1); transform-box: view-box; transform-origin: 50% 50%; }
@keyframes clkTickPop { 0% { transform: rotate(0deg); } 45% { transform: rotate(2.2deg); } 100% { transform: rotate(0deg); } }
.clk-precise .clk-t1 { stroke: #7048e8; stroke-width: 1.2; }
.clk-precise .clk-ring { stroke: ${CLK_TOKENS.minuteTeal}; }
.clk-fx { position: absolute; top: 2px; right: 8px; width: 64px; height: 54px; pointer-events: none; z-index: 6;
  text-align: center; }
.clk-fx .clk-bird { width: 44px; height: 40px; display: inline-block; }
.clk-bird-body { transform-box: fill-box; transform-origin: 50% 90%; }
.clk-bird-cheer .clk-bird-body { animation: clkBirdPop 700ms ease-out; }
@keyframes clkBirdPop { 0% { transform: translateY(4px) scale(.9); } 22% { transform: translateY(-5px) scale(1.06); }
  40% { transform: translateY(0) scale(1); } 62% { transform: translateY(-4px) scale(1.05); } 100% { transform: translateY(0) scale(1); } }
.clk-bird-peek .clk-bird-body { animation: clkBirdTilt 500ms ease-out; }
@keyframes clkBirdTilt { 0% { transform: rotate(0deg); } 45% { transform: rotate(-13deg); } 100% { transform: rotate(0deg); } }
.clk-fx-say { display: block; margin-top: -4px; font-size: 15px; font-weight: 900; color: ${shade(
  CLK_TOKENS.roofRedDark,
  -10
)}; text-shadow: 0 1px 0 #fff; min-height: 18px; }
.clk-glow { filter: drop-shadow(0 0 6px ${withAlpha(PASTEL.starGold, 0.95)}) drop-shadow(0 0 14px ${withAlpha(
  PASTEL.starGold,
  0.65
)}); }
@media (prefers-reduced-motion: reduce) {
  .clk-win-glow { animation: none; }
  .clk-pend { animation: none; }
  .clk-tickpop { animation: none; }
  .clk-bird-cheer .clk-bird-body { animation: none; }
  .clk-bird-peek .clk-bird-body { animation: none; }
}
${sparkleCss("clk")}`;
