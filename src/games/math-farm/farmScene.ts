/**
 * 算数小农场 1.3 · 农场舞台（纯字符串 SVG 与 CSS，不碰 DOM、不碰玩法）。
 *
 * 这里只有「怎么画」：天空渐变 + 太阳 / 云两朵、远景谷仓 + 风车（叶片缓转）、
 * 中景三块菜畦（深土 + 浅土垄面 + 垄沟线）、近景木栅栏，以及全部视觉层的
 * `mtf-` 前缀 CSS（木牌选项 / 吊挂题卡 / 菜畦占格 / 浇水 / 蜜蜂 / 彩纸 / 收成板）。
 * 判定、计分、TTS 一个字都不在这个文件里。全部函数输出确定，node 环境可直接断言。
 *
 * 图层序（DOM 从底到顶）：`.mtf-scene`(z0) → `.mtf-plots`(z1) → `.mtf-quizhost`(z2)
 * → `.mtf-fx` 动画层(z3, pointer-events:none)。
 */
import { shade, withAlpha } from "../../art/kit/palette";
import { FARM_PALETTE } from "../../art/kit/crops";

const P = FARM_PALETTE;

// ---------------------------------------------------------------------------
// 动效时序表（4.3 规格）：全部集中在这里，测试与实现共用一份数
// ---------------------------------------------------------------------------

/** 答对成长三阶段每一步的间隔（发芽 0ms → 长叶 150ms → 结果 300ms） */
export const GROW_STEP_MS = 150;
/** 成长动画总时长（450ms 后摘掉动画类） */
export const GROW_TOTAL_MS = 450;
/** 答错歪头动画时长 */
export const WOBBLE_MS = 400;
/** 浇水壶两滴水的停留时长 */
export const WATER_MS = 450;
/** 小蜜蜂绕场一圈的时长 */
export const BEE_MS = 1200;
/** 连对几题请出一只小蜜蜂（纯视觉节奏，与计分的连对奖励互不相干） */
export const BEE_EVERY = 3;
/** 收获仪式一次性动画时长 */
export const HARVEST_MS = 900;
/** 彩纸粒数 */
export const CONFETTI_N = 20;
/** 「再想想」木牌停留时长 */
export const RETHINK_MS = 1400;
/** 「再想想」木牌文案（只鼓励，不批评） */
export const RETHINK_TEXT = "再想想";
/** 风车叶片转一圈的时长（秒） */
export const MILL_SPIN_S = 8;

// ---------------------------------------------------------------------------
// 布局底线（第七节 360px 规格）
// ---------------------------------------------------------------------------

/** 360px 窄屏上单个作物插图的最小边长（规格底线 16px） */
export const MIN_CROP_PX = 16;
/** 插图作物的常规边长 */
export const CROP_PX = 20;
/** 选项木牌的最小高度（规格底线 44px，本款给到 64px 与壳一致） */
export const SIGN_MIN_H = 64;

// ---------------------------------------------------------------------------
// 农场舞台 SVG
// ---------------------------------------------------------------------------

/** 云朵（三个椭圆拼的软云） */
function cloud(x: number, y: number, k: number, cls: string): string {
  return (
    `<g class="mtf-cloud ${cls}" data-part="cloud" transform="translate(${x} ${y}) scale(${k})" fill="#ffffff" opacity=".92">` +
    `<ellipse cx="0" cy="0" rx="24" ry="12"/>` +
    `<ellipse cx="-16" cy="5" rx="15" ry="9"/>` +
    `<ellipse cx="17" cy="4" rx="17" ry="10"/>` +
    `</g>`
  );
}

/** 远景谷仓：粉彩红仓身 + 白门框 + 通风口 */
function barn(): string {
  const body = shade(P.tomatoRed, 16);
  const roof = shade(P.signWood, -24);
  const line = shade(body, -38);
  return (
    `<g data-part="barn">` +
    `<rect x="42" y="238" width="80" height="62" rx="4" fill="${body}" stroke="${line}" stroke-width="2"/>` +
    `<path d="M36 244 L82 214 L128 244 Z" fill="${roof}" stroke="${shade(roof, -25)}" stroke-width="2" stroke-linejoin="round"/>` +
    `<rect x="68" y="262" width="28" height="38" rx="3" fill="#fff8e1" stroke="${line}" stroke-width="2"/>` +
    `<path d="M68 262 L96 300 M96 262 L68 300" stroke="${line}" stroke-width="2"/>` +
    `<circle cx="82" cy="230" r="6.5" fill="#fff8e1" stroke="${line}" stroke-width="2"/>` +
    `</g>`
  );
}

/** 远景风车：塔身 + 缓转的四叶（reduced 静止） */
function windmill(): string {
  const tower = shade(P.signWood, 8);
  const line = shade(P.signWood, -34);
  const blade =
    `<rect x="-3.4" y="-30" width="6.8" height="27" rx="3.2" fill="#ffffff" stroke="${line}" stroke-width="1.8"/>`;
  return (
    `<g data-part="windmill">` +
    `<path d="M148 300 L154 234 L166 234 L172 300 Z" fill="${tower}" stroke="${line}" stroke-width="2" stroke-linejoin="round"/>` +
    `<circle cx="160" cy="256" r="4" fill="#fff8e1" stroke="${line}" stroke-width="1.6"/>` +
    `<g class="mtf-mill-blades" data-part="mill-blades" transform="translate(160 232)">` +
    `<g>${blade}</g>` +
    `<g transform="rotate(90)">${blade}</g>` +
    `<g transform="rotate(180)">${blade}</g>` +
    `<g transform="rotate(270)">${blade}</g>` +
    `</g>` +
    `<circle cx="160" cy="232" r="5" fill="${P.cornYellow}" stroke="${line}" stroke-width="2"/>` +
    `</g>`
  );
}

/** 中景菜畦一块：深土底 + 三条浅土垄面 + 垄沟线（土垄剖面） */
function soilBed(x: number): string {
  const edge = shade(P.soilDark, -22);
  const rows = [0, 1, 2]
    .map((i) => {
      const y = 330 + i * 20;
      return (
        `<rect x="${x + 8}" y="${y}" width="84" height="9" rx="4.5" fill="${P.soilLight}"/>` +
        `<path d="M${x + 10} ${y + 13.5} h80" stroke="${edge}" stroke-width="2" stroke-linecap="round" opacity=".55"/>`
      );
    })
    .join("");
  return (
    `<g data-part="bed">` +
    `<rect x="${x}" y="322" width="100" height="64" rx="10" fill="${P.soilDark}" stroke="${edge}" stroke-width="2"/>` +
    rows +
    `</g>`
  );
}

/** 近景木栅栏：尖头立柱 + 双横杆 */
function fence(): string {
  const line = shade(P.fenceWood, -38);
  let posts = "";
  for (let i = 0; i < 10; i++) {
    const x = 6 + i * 39;
    posts +=
      `<path d="M${x} 436 L${x + 12} 436 L${x + 12} 478 L${x} 478 Z M${x} 436 L${x + 6} 428 L${x + 12} 436"` +
      ` fill="${P.fenceWood}" stroke="${line}" stroke-width="2" stroke-linejoin="round"/>`;
  }
  return (
    `<g data-part="fence">` +
    `<rect x="0" y="444" width="360" height="9" rx="4" fill="${P.signWood}" stroke="${line}" stroke-width="1.6"/>` +
    `<rect x="0" y="462" width="360" height="9" rx="4" fill="${P.signWood}" stroke="${line}" stroke-width="1.6"/>` +
    posts +
    `</g>`
  );
}

/**
 * 整屏农场舞台：天空渐变 + 太阳 / 云两朵 → 谷仓 + 风车 → 三块菜畦 → 木栅栏。
 * `preserveAspectRatio="xMidYMax slice"`：栅栏永远贴着舞台底边，宽屏裁天不裁地。
 */
export function farmSceneSvg(): string {
  const grass = shade(P.leafGreen, 52);
  return (
    `<svg viewBox="0 0 360 480" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" data-part="farm-scene">` +
    `<defs><linearGradient id="mtfSkyGrad" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${P.skyTop}"/><stop offset=".62" stop-color="${P.skyHorizon}"/>` +
    `</linearGradient></defs>` +
    `<rect x="0" y="0" width="360" height="480" fill="url(#mtfSkyGrad)"/>` +
    `<g data-part="sun"><circle cx="306" cy="56" r="34" fill="${P.cornYellow}" opacity=".28"/>` +
    `<circle cx="306" cy="56" r="21" fill="${P.cornYellow}" stroke="${shade(P.cornYellow, -28)}" stroke-width="2"/></g>` +
    cloud(78, 62, 1, "mtf-cloud-a") +
    cloud(216, 100, 0.72, "mtf-cloud-b") +
    `<rect x="0" y="296" width="360" height="184" fill="${grass}"/>` +
    `<path d="M0 296 h360" stroke="${withAlpha(P.leafDark, 0.35)}" stroke-width="2"/>` +
    barn() +
    windmill() +
    soilBed(8) +
    soilBed(130) +
    soilBed(252) +
    fence() +
    `</svg>`
  );
}

/** 浇水壶 + 两滴水（答对时洒一下） */
export function wateringCanSvg(): string {
  const body = shade(P.skyTop, -18);
  const line = shade(body, -40);
  return (
    `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" data-part="watering-can">` +
    `<g transform="rotate(-18 24 20)">` +
    `<rect x="14" y="12" width="20" height="16" rx="5" fill="${body}" stroke="${line}" stroke-width="2"/>` +
    `<path d="M14 17 L4 22 L6 26 L14 23 Z" fill="${body}" stroke="${line}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M18 12 q6 -7 12 0" fill="none" stroke="${line}" stroke-width="2.4"/>` +
    `<circle cx="4.6" cy="23.8" r="3.4" fill="${body}" stroke="${line}" stroke-width="1.8"/>` +
    `</g>` +
    `<path class="mtf-drop mtf-drop-a" d="M10 32 q1.8 -3.4 3.6 0 a2 2.2 0 1 1 -3.6 0 Z" fill="${P.skyTop}" stroke="${line}" stroke-width="1.2"/>` +
    `<path class="mtf-drop mtf-drop-b" d="M17 36 q1.6 -3 3.2 0 a1.8 2 0 1 1 -3.2 0 Z" fill="${P.skyTop}" stroke="${line}" stroke-width="1.2"/>` +
    `</svg>`
  );
}

/** 小蜜蜂（连对绕场；reduced 静止贴花） */
export function beeSvg(): string {
  const line = shade(P.cornYellow, -55);
  return (
    `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" data-part="bee">` +
    `<ellipse cx="18" cy="14" rx="8" ry="5.6" fill="#ffffff" opacity=".85" stroke="${line}" stroke-width="1.4" transform="rotate(-24 18 14)"/>` +
    `<ellipse cx="30" cy="13" rx="8" ry="5.6" fill="#ffffff" opacity=".85" stroke="${line}" stroke-width="1.4" transform="rotate(24 30 13)"/>` +
    `<ellipse cx="24" cy="26" rx="12" ry="9" fill="${P.cornYellow}" stroke="${line}" stroke-width="2"/>` +
    `<path d="M19 18.5 q-1 7.5 0 15 M25 17.5 q-1 8.5 0 17 M31 19 q-0.6 6.6 -1.6 13.6" stroke="${line}" stroke-width="2.6" stroke-linecap="round" fill="none"/>` +
    `<circle cx="17.6" cy="23.4" r="1.6" fill="${line}"/>` +
    `<path d="M13 30 q2 2.4 4.6 2.6" stroke="${line}" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    `<path d="M35.4 27.4 L40 29" stroke="${line}" stroke-width="2" stroke-linecap="round"/>` +
    `</svg>`
  );
}

// ---------------------------------------------------------------------------
// 视觉层 CSS：全部 mtf- 前缀；壳类（.qz-*）只在 .mtf-quizhost 作用域内换肤
// ---------------------------------------------------------------------------

const WOOD_FACE =
  `radial-gradient(circle 2.6px at 10px 10px, ${shade(P.signWood, -36)} 58%, transparent 60%),` +
  `radial-gradient(circle 2.6px at calc(100% - 10px) 10px, ${shade(P.signWood, -36)} 58%, transparent 60%),` +
  `repeating-linear-gradient(98deg, ${withAlpha(shade(P.signWood, -36), 0.14)} 0 2px, transparent 2px 13px),` +
  `linear-gradient(180deg, ${shade(P.fenceWood, 14)}, ${P.fenceWood} 55%, ${P.signWood})`;

const WOOD_EDGE = shade(P.soilDark, -6);
const WOOD_SHADOW = shade(P.signWood, -26);
const INK = shade(P.soilDark, -32);

export const FARM_CSS = `
/* ---- 农场舞台与图层序 ---- */
.mtf-scene { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; border-radius: inherit; }
.mtf-scene svg { width: 100%; height: 100%; display: block; }
.mtf-mill-blades { transform-box: fill-box; transform-origin: center; animation: mtfMillSpin ${MILL_SPIN_S}s linear infinite; }
@keyframes mtfMillSpin { to { transform: rotate(360deg); } }
.mtf-cloud { animation: mtfCloudDrift ${MILL_SPIN_S}s linear infinite alternate; }
.mtf-cloud-b { animation-duration: ${MILL_SPIN_S + 3}s; animation-delay: -3s; }
@keyframes mtfCloudDrift { from { transform: translateX(-7px); } to { transform: translateX(13px); } }
.mtf-farm-host { position: relative; z-index: 2; }
.mtf-fx { position: absolute; inset: 0; z-index: 3; pointer-events: none; overflow: hidden; }

/* ---- 菜畦占格进度（一畦 = 一题） ---- */
.mtf-plots { position: absolute; left: 10px; right: 10px; bottom: 7px; z-index: 1; pointer-events: none;
  display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; align-items: flex-end; }
.mtf-plot { width: 27px; height: 31px; border-radius: 7px 7px 9px 9px; position: relative;
  background: linear-gradient(180deg, ${P.soilLight} 0 40%, ${P.soilDark} 40%);
  border: 1.5px solid ${shade(P.soilDark, -22)}; box-shadow: inset 0 -3px 0 rgba(0,0,0,.12);
  display: flex; align-items: flex-end; justify-content: center; }
.mtf-plot svg { width: 23px; height: 23px; display: block; }
.mtf-plot-todo { opacity: .58; }
.mtf-plot-now { opacity: 1; box-shadow: 0 0 0 2px ${P.cornYellow}, inset 0 -3px 0 rgba(0,0,0,.12); }
.mtf-plot-done { opacity: 1; }
.mtf-plot-grow svg { animation: mtfGrowPop ${GROW_STEP_MS}ms ease-out; transform-origin: 50% 100%; }
@keyframes mtfGrowPop { from { transform: scale(.55); } to { transform: scale(1); } }
.mtf-plot-wobble svg { animation: mtfWobble ${WOBBLE_MS}ms ease-out; transform-origin: 50% 92%; }
@keyframes mtfWobble { 0%, 100% { transform: rotate(0deg); } 30% { transform: rotate(-6deg); } 70% { transform: rotate(6deg); } }

/* ---- 题目实物化插图（题目文本原样保留，这层只是配图） ---- */
.mtf-illus { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 4px 6px;
  background: ${withAlpha("#ffffff", 0.85)}; border: 2px dashed ${P.fenceWood}; border-radius: 12px;
  padding: 6px 8px; }
.mtf-illus[hidden] { display: none; }
.mtf-illus-group { display: inline-flex; flex-wrap: wrap; gap: 2px; align-items: flex-end; justify-content: center;
  max-width: 100%; }
.mtf-illus-unit { width: ${CROP_PX}px; height: ${CROP_PX}px; display: inline-block; }
.mtf-illus-unit svg { width: 100%; height: 100%; display: block; }
.mtf-illus-op { font-size: 20px; font-weight: 900; color: ${P.soilDark}; padding: 0 2px; }
.mtf-illus-legend { width: 100%; text-align: center; font-size: 12px; font-weight: 800; color: ${P.soilDark}; opacity: .9; }

/* ---- 换肤：木牌选项 / 吊挂题卡 / 小喇叭木牌（只在本款宿主作用域内，不碰壳文件） ---- */
.mtf-quizhost .qz-wrap { background: transparent !important; }
.mtf-quizhost .qz-prompt { position: relative; margin-top: 12px; border: 2px solid ${WOOD_EDGE};
  box-shadow: 0 4px 0 ${WOOD_SHADOW}, 0 8px 14px rgba(0,0,0,.10); overflow: visible; }
.mtf-quizhost .qz-prompt::before, .mtf-quizhost .qz-prompt::after { content: ""; position: absolute; top: -12px;
  width: 4px; height: 15px; border-radius: 2px; background: ${shade(P.signWood, -14)}; }
.mtf-quizhost .qz-prompt::before { left: 26%; transform: rotate(14deg); }
.mtf-quizhost .qz-prompt::after { right: 26%; transform: rotate(-14deg); }
.mtf-quizhost .qz-choice { min-height: ${SIGN_MIN_H}px; border: 2px solid ${WOOD_EDGE}; border-radius: 12px;
  background-image: ${WOOD_FACE}; color: ${INK}; text-shadow: 0 1px 0 rgba(255,255,255,.4);
  box-shadow: 0 4px 0 ${WOOD_SHADOW}, 0 6px 10px rgba(0,0,0,.12);
  transition: transform .12s ease-out, box-shadow .12s ease-out; }
.mtf-quizhost .qz-choice:hover { transform: translateY(-2px); box-shadow: 0 6px 0 ${WOOD_SHADOW}, 0 9px 13px rgba(0,0,0,.14); }
.mtf-quizhost .qz-choice:active { transform: translateY(2px); box-shadow: 0 1px 0 ${WOOD_SHADOW}; }
.mtf-quizhost .qz-choice.qz-right { box-shadow: 0 0 0 3px ${P.leafGreen}, 0 4px 0 ${WOOD_SHADOW}; }
.mtf-quizhost .qz-choice.qz-wrong { filter: grayscale(.75); }
.mtf-quizhost .qz-say, .mtf-quizhost .qz-jump-go { background-image: ${WOOD_FACE}; border: 2px solid ${WOOD_EDGE};
  color: ${INK}; text-shadow: 0 1px 0 rgba(255,255,255,.4); box-shadow: 0 3px 0 ${WOOD_SHADOW}; }
.mtf-quizhost .qz-bar { background: ${withAlpha("#ffffff", 0.55)}; }
.mtf-quizhost .qz-badge { background: ${withAlpha("#fff8e1", 0.92)}; }

/* ---- 浇水 / 再想想 / 蜜蜂 / 彩纸 / 收成板 ---- */
.mtf-water { position: absolute; left: 50%; bottom: 46px; width: 44px; height: 44px; margin-left: -22px; }
.mtf-water svg { width: 100%; height: 100%; display: block; }
.mtf-water .mtf-drop { animation: mtfDrip ${WATER_MS}ms ease-in; }
.mtf-water .mtf-drop-b { animation-delay: 90ms; }
@keyframes mtfDrip { from { transform: translateY(-7px); opacity: 0; } 40% { opacity: 1; } to { transform: translateY(4px); opacity: 0; } }
.mtf-rethink { position: absolute; left: 50%; bottom: 96px; transform: translateX(-50%);
  background-image: ${WOOD_FACE}; border: 2px solid ${WOOD_EDGE}; border-radius: 10px; color: ${INK};
  font-weight: 900; font-size: 15px; padding: 6px 16px; box-shadow: 0 3px 0 ${WOOD_SHADOW};
  animation: mtfSignIn ${WOBBLE_MS}ms ease-out; }
@keyframes mtfSignIn { from { opacity: 0; transform: translateX(-50%) translateY(7px); } to { opacity: 1; } }
.mtf-bee { position: absolute; left: 50%; top: 46%; width: 34px; height: 34px; margin: -17px 0 0 -17px;
  animation: mtfBeeLoop ${BEE_MS}ms ease-in-out forwards; }
.mtf-bee svg { width: 100%; height: 100%; display: block; }
@keyframes mtfBeeLoop {
  0% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
  12% { opacity: 1; }
  25% { transform: translate(74px, -36px) rotate(14deg); }
  50% { transform: translate(0, -70px) rotate(0deg); }
  75% { transform: translate(-74px, -36px) rotate(-14deg); }
  100% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
}
.mtf-bee-still { animation: none; opacity: 1; }
.mtf-confetti { position: absolute; top: -10px; width: 7px; height: 11px; border-radius: 2px;
  animation: mtfConfettiFall ${HARVEST_MS}ms ease-in forwards; }
@keyframes mtfConfettiFall { from { transform: translateY(0) rotate(0deg); opacity: 1; }
  to { transform: translateY(330px) rotate(230deg); opacity: 0; } }
.mtf-harvest { position: absolute; inset: 0; z-index: 3; pointer-events: none;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
.mtf-harvest-basket { width: 68px; height: 68px; }
.mtf-harvest-basket svg { width: 100%; height: 100%; display: block; }
.mtf-harvest-jump { position: absolute; width: 26px; height: 26px; animation: mtfCropJump ${HARVEST_MS}ms ease-in forwards; }
.mtf-harvest-jump svg { width: 100%; height: 100%; display: block; }
@keyframes mtfCropJump { 0% { transform: translate(var(--mtf-jx, 0px), 0) scale(1); }
  45% { transform: translate(calc(var(--mtf-jx, 0px) / 2), -30px) scale(1.06); }
  100% { transform: translate(0, 10px) scale(.5); opacity: 0; } }
.mtf-harvest-board { background: ${P.skyHorizon}; border: 3px solid ${P.signWood}; border-radius: 14px;
  padding: 10px 20px; font-weight: 900; font-size: 18px; color: ${P.soilDark};
  box-shadow: 0 4px 0 ${WOOD_SHADOW}; animation: mtfBoardFlip .5s ease-out; }
@keyframes mtfBoardFlip { from { transform: rotateX(78deg); opacity: .2; } to { transform: rotateX(0deg); opacity: 1; } }

/* ---- 360px 窄屏：插图自动换行、单作物不小于 ${MIN_CROP_PX}px、木牌高度不缩 ---- */
@media (max-width: 400px) {
  .mtf-illus { gap: 3px 4px; padding: 5px 6px; }
  .mtf-illus-unit { width: ${MIN_CROP_PX}px; height: ${MIN_CROP_PX}px; }
  .mtf-plot { width: 22px; height: 26px; }
  .mtf-plot svg { width: 18px; height: 18px; }
}

/* ---- reduced：风车 / 云 / 蜜蜂 / 成长 / 收获动画全停，静态阶段图与反馈色保留 ---- */
@media (prefers-reduced-motion: reduce) {
  .mtf-mill-blades, .mtf-cloud, .mtf-plot-grow svg, .mtf-plot-wobble svg, .mtf-water .mtf-drop,
  .mtf-rethink, .mtf-bee, .mtf-harvest-jump, .mtf-harvest-board { animation: none; }
  .mtf-confetti { display: none; }
  .mtf-quizhost .qz-choice, .mtf-quizhost .qz-choice:hover { transition: none; transform: none; }
}
`;
