/**
 * 找不同 · 1.3 视觉舞台（第 25 步 C 档，纯视觉模块）。
 *
 * 这里只产字符串与纯函数：侦探书桌 CSS、双画框、命中收圈、问号气泡、
 * 侦探徽章、沙漏、缎带与彩纸。**不碰 DOM、不开计时器、不读存档**，
 * 更不碰题目数据——`CellView` 的 dx/dy/scale/flip/count/emoji、命中半径、
 * 计时与提示逻辑全在 `scene12.ts` / `runtime.ts` / `index.ts` 原地未动。
 *
 * 命中收圈的终态半径直接读 `runtime.hitRadius()`：画出来的圈就是判定的圈，
 * 视觉与判定一个口径，谁也骗不了谁。
 */
import { FRAME_TOKENS, magnifierSVG, plaqueCss, ropeSVG, woodFrameCss } from "../../art/kit/frame";
import { withAlpha } from "../../art/kit/palette";
import { SPARK_MS, sparkleCss, sparkleSpecs, type SparkSpec } from "../../art/kit/sparkle";
import { hitRadius } from "./runtime";

/** 本款专属的侦探色 token（画框木色见 kit 的 FRAME_TOKENS） */
export const FDF_ART = {
  /** 已找到差异的常显金圈 */
  foundGold: "#f4b942",
  /** 命中瞬间的虚线收圈 */
  hitRing: "#ff8c42",
  /** 点错的问号气泡与涟漪（灰，不闪红） */
  missGray: "rgba(140,140,150,.6)",
  /** 侦探徽章底色 */
  badgeBrass: "#d1a054",
  /** 沙漏流沙色 */
  sandAmber: "#f4d03f",
} as const;

// --- 动效时序（毫秒），与规格的时序表一一对应 -------------------------------

/** 放大镜滑入聚焦 */
export const MAG_MS = 260;
/** 虚线收圈定格 */
export const RING_MS = 300;
/** 徽章点亮闪光 */
export const BADGE_FLASH_MS = 400;
/** 问号气泡浮起 */
export const BUBBLE_MS = 350;
/** 缎带 + 彩纸 */
export const RIBBON_MS = 800;
/** 提示按钮按下 */
export const HINT_PRESS_MS = 200;
/** 收圈起始半径（px），终点是命中判定半径 */
export const RING_FROM_R = 28;
/** 全找齐时的彩纸粒数 */
export const CONFETTI_N = 16;

// --- 纯函数：视觉与数据的映射 ------------------------------------------------

/** 命中收圈的终态半径 = 命中判定半径（同一支 hitRadius，不许有第二个口径） */
export function hitRingEndRadius(cellWidth: number): number {
  return hitRadius(cellWidth);
}

/** 沙漏里还剩多少沙：剩余时间 / 总时长，夹在 0–1，总时长非法一律 0 */
export function sandRatio(remainSec: number, totalSec: number): number {
  if (!Number.isFinite(remainSec) || !Number.isFinite(totalSec) || totalSec <= 0) return 0;
  return Math.min(1, Math.max(0, remainSec / totalSec));
}

/** 徽章排的点亮表：长度 = 该关差异总数，前 found 枚点亮 */
export function badgeLights(found: number, total: number): boolean[] {
  const n = Math.max(0, Math.round(total));
  const lit = Math.min(n, Math.max(0, Math.round(found)));
  return Array.from({ length: n }, (_, i) => i < lit);
}

/** 中缝装饰的排法：窄屏（≤480px，上下排布）改顶部麻绳横挂，宽屏用别针连框 */
export function seamMode(viewportWidth: number): "hang" | "link" {
  const w = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 360;
  return w <= 480 ? "hang" : "link";
}

/** 点错的气泡文案：只有小问号，没有一个批评字 */
export const MISS_BUBBLE_TEXT = "咦？";

/** 命中时的星屑：3 颗，轨迹参数走 kit 的 sparkleSpecs */
export function hitSparkSpecs(rand: () => number): SparkSpec[] {
  return sparkleSpecs(rand, 3);
}

export interface ConfettiSpec {
  /** 横向落点（px，相对中缝中心） */
  dx: number;
  /** 下落距离（px） */
  fall: number;
  /** 起飞延迟（ms） */
  delayMs: number;
  /** 旋转角（deg） */
  spin: number;
  /** 用色下标（对 CONFETTI_TINTS 取模） */
  tint: number;
}

/** 彩纸可用色：金、橙、天蓝、粉（都来自本款与平台的既有色相） */
export const CONFETTI_TINTS: readonly string[] = [FDF_ART.foundGold, FDF_ART.hitRing, "#74c0fc", "#f06595"];

/** 全找齐的 16 粒彩纸：左右扇开、错峰起飞；rand 由调用方注入，测试喂定数可复现 */
export function confettiSpecs(rand: () => number, count = CONFETTI_N): ConfettiSpec[] {
  const n = Math.max(1, Math.floor(count));
  const out: ConfettiSpec[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.min(1, Math.max(0, rand()));
    const side = i % 2 === 0 ? 1 : -1;
    out.push({
      dx: Math.round(side * (12 + (i / n) * 70 + r * 24)),
      fall: Math.round(60 + r * 70),
      delayMs: Math.round((i % 8) * 30),
      spin: Math.round(side * (180 + r * 360)),
      tint: i % CONFETTI_TINTS.length,
    });
  }
  return out;
}

// --- SVG 片段 ---------------------------------------------------------------

/** 五角星顶点串（徽章浮雕线用）：外径 rO、内径 rI，尖朝上 */
export function starPoints(cx: number, cy: number, rO: number, rI: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rO : rI;
    const a = -Math.PI / 2 + (Math.PI / 5) * i;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`);
  }
  return pts.join(" ");
}

/** 一枚侦探徽章：圆形铜牌 + 五角星浮雕线；未点亮灰度 60%，点亮金描边 */
export function badgeSVG(lit: boolean, flash = false): string {
  const cls = `fdf-medal ${lit ? "fdf-medal-lit" : "fdf-medal-dim"}${flash ? " fdf-medal-flash" : ""}`;
  const stroke = lit ? FDF_ART.foundGold : withAlpha("#8d6b3f", 0.5);
  const star = lit ? "rgba(255,255,255,.75)" : "rgba(60,50,40,.28)";
  return (
    `<svg class="${cls}" viewBox="0 0 20 20" aria-hidden="true">` +
    `<circle cx="10" cy="10" r="8.4" fill="${FDF_ART.badgeBrass}" stroke="${stroke}" stroke-width="2"/>` +
    `<polygon points="${starPoints(10, 10.6, 5.4, 2.3)}" fill="none" stroke="${star}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `</svg>`
  );
}

/** 徽章排：找到一枚点亮一枚；flashNewest 只闪最新点亮的那枚（reduced 时调用方传 false） */
export function badgeRowHTML(found: number, total: number, flashNewest = false): string {
  const lights = badgeLights(found, total);
  const newest = lights.lastIndexOf(true);
  return lights.map((lit, i) => badgeSVG(lit, flashNewest && lit && i === newest)).join("");
}

/**
 * 沙漏：上下两个三角仓 + 细腰。上仓沙量 = ratio，底仓堆积 = 1 - ratio，
 * 中间流沙线只在 0 < ratio < 1 时画（CSS 让它流动，reduced 下静止成刻度）。
 * viewBox 恒为 0 0 22 30；`data-sand` 带出夹好的比例，测试直接读。
 */
export function hourglassSVG(ratio: number): string {
  const r = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
  const wood = FRAME_TOKENS.frameWoodDark;
  const parts: string[] = [
    `<path d="M4 3 H18 L11 14 Z" fill="none" stroke="${wood}" stroke-width="1.8" stroke-linejoin="round"/>`,
    `<path d="M11 16 L18 27 H4 Z" fill="none" stroke="${wood}" stroke-width="1.8" stroke-linejoin="round"/>`,
  ];
  if (r > 0) {
    // 上仓：沙面从 y=4（满）落到 y=13.4（空）；三角形里等高截面越靠下越窄
    const ys = 4 + (1 - r) * 9.4;
    const hw = ((14 - ys) / 11) * 6.6;
    parts.push(
      `<path class="fdf-sandtop" d="M${(11 - hw).toFixed(2)} ${ys.toFixed(2)} H${(11 + hw).toFixed(2)} L11 13.6 Z" fill="${FDF_ART.sandAmber}"/>`
    );
  }
  if (r < 1) {
    // 底仓：沙堆从底边 y=26.4 往上积，最高积到 y=17
    const ph = (1 - r) * 9.4;
    const yTop = 26.4 - ph;
    const hw = (ph / 11) * 6.6 + 1.6;
    parts.push(
      `<path class="fdf-sandpile" d="M${(11 - hw).toFixed(2)} 26.4 Q11 ${(yTop - 1.2).toFixed(2)} ${(11 + hw).toFixed(2)} 26.4 Z" fill="${FDF_ART.sandAmber}"/>`
    );
  }
  if (r > 0 && r < 1) {
    parts.push(
      `<line class="fdf-sandline" x1="11" y1="14.6" x2="11" y2="25.6" stroke="${FDF_ART.sandAmber}" stroke-width="1.4" stroke-dasharray="2 2"/>`
    );
  }
  return `<svg viewBox="0 0 22 30" data-sand="${r.toFixed(3)}" aria-hidden="true">${parts.join("")}</svg>`;
}

/** HUD 里的「沙漏 + 剩余秒数」：计时逻辑一个字不动，这里只做剩余时间 → 画面的映射 */
export function hudTimeHTML(remainSec: number, totalSec: number): string {
  const sec = Math.max(0, Math.round(Number.isFinite(remainSec) ? remainSec : 0));
  return `<span class="fdf-sandbadge">${hourglassSVG(sandRatio(remainSec, totalSec))}</span><span class="fdf-timetext">${sec}s</span>`;
}

/** 命中动画层里的放大镜（kit 的原创侦探镜，不摹任何形象） */
export function magnifierFxHTML(): string {
  return magnifierSVG({ rim: FRAME_TOKENS.frameWoodDark, handle: FRAME_TOKENS.frameWood });
}

/** 中缝装饰：hang = 顶部麻绳横挂（窄屏上下排布），link = 麻绳短段 + 两个别针连框 */
export function seamHTML(mode: "hang" | "link"): string {
  return mode === "hang"
    ? ropeSVG({ w: 220, h: 18, rope: "#b08d57", pin: FRAME_TOKENS.frameWood, pins: 3 })
    : ropeSVG({ w: 160, h: 16, rope: "#b08d57", pin: FRAME_TOKENS.frameWood, pins: 2 });
}

/** 书桌角落的装饰小图：一只放大镜 + 一本翻开的小笔记本（都是剪影级装饰） */
export function deskDoodleHTML(): string {
  const note =
    `<svg viewBox="0 0 46 40" aria-hidden="true">` +
    `<rect x="3" y="6" width="40" height="30" rx="4" fill="#fffdf7" stroke="${FRAME_TOKENS.frameWoodDark}" stroke-width="2"/>` +
    `<line x1="23" y1="8" x2="23" y2="34" stroke="${FRAME_TOKENS.frameWoodDark}" stroke-width="1.4"/>` +
    `<line x1="8" y1="14" x2="19" y2="14" stroke="#c9b8a0" stroke-width="1.6"/>` +
    `<line x1="8" y1="20" x2="19" y2="20" stroke="#c9b8a0" stroke-width="1.6"/>` +
    `<line x1="27" y1="14" x2="38" y2="14" stroke="#c9b8a0" stroke-width="1.6"/>` +
    `<line x1="27" y1="20" x2="38" y2="20" stroke="#c9b8a0" stroke-width="1.6"/>` +
    `</svg>`;
  return (
    `<span class="fdf-deco-mag">${magnifierSVG({ rim: FRAME_TOKENS.frameWoodDark, handle: FRAME_TOKENS.frameWood, glass: "rgba(255,253,247,.5)" })}</span>` +
    `<span class="fdf-deco-note">${note}</span>`
  );
}

// --- 舞台 CSS ---------------------------------------------------------------

/**
 * 全部新增样式。类名沿用 fdf- 前缀；标记层及以上（fx / 暖色滤镜 / 装饰）一律
 * pointer-events:none；reduced-motion 下放大镜、收圈、流沙、彩纸全停，
 * 金圈与徽章保留。**没有任何规则去改 .fdf-grid / .fdf-cell 的盒模型。**
 */
export const STAGE_CSS = `
${woodFrameCss("fdf")}
${plaqueCss("fdf")}
${sparkleCss("fdf")}
.fdf-desk{position:relative;background:
  radial-gradient(130% 80% at 50% 0%,rgba(255,243,222,.42),rgba(255,243,222,0) 62%),
  repeating-linear-gradient(0deg,rgba(80,50,22,.12) 0 2px,rgba(80,50,22,0) 2px 30px),
  repeating-linear-gradient(90deg,rgba(255,235,205,.05) 0 3px,rgba(120,80,40,.05) 3px 6px),
  linear-gradient(180deg,${withAlpha("#b57b45", 0.94)},${withAlpha(FRAME_TOKENS.deskWood, 0.95)} 55%,${withAlpha("#8f5d31", 0.95)});}
.fdf-desk>.fdf-top,.fdf-desk>.fdf-msg,.fdf-desk>.fdf-tools,.fdf-desk>.fdf-viewport{position:relative;z-index:1;}
.fdf-deco{position:absolute;inset:0;pointer-events:none;z-index:0;overflow:hidden;border-radius:16px;opacity:.42;}
.fdf-deco-mag{position:absolute;right:5px;bottom:3px;width:42px;height:42px;transform:rotate(-16deg);}
.fdf-deco-note{position:absolute;left:5px;bottom:3px;width:44px;height:38px;transform:rotate(7deg);}
.fdf-deco-mag svg,.fdf-deco-note svg,.fdf-sandbadge svg{width:100%;height:100%;display:block;}
.fdf-plaque.fdf-label{font-size:14px;color:#6b4a26;}
.fdf-msg{color:#fff8ec;text-shadow:0 1px 2px rgba(70,40,10,.4);}
.fdf-split.fdf-seam{height:18px;width:96%;background:none;border-radius:0;}
.fdf-split.fdf-seam-hang{width:96%;}
.fdf-split.fdf-seam-link{width:64%;}
.fdf-warmth{position:absolute;inset:0;pointer-events:none;z-index:4;background:rgba(255,166,66,.04);border-radius:14px;}
.fdf-fxlayer{position:absolute;inset:0;pointer-events:none;z-index:5;}
.fdf-cell::before{content:"";position:absolute;left:14%;right:14%;bottom:6%;height:22%;border-radius:50%;
  background:radial-gradient(50% 50% at 50% 50%,rgba(96,74,48,.16),rgba(96,74,48,0) 72%);}
.fdf-badges{display:flex;gap:3px;align-items:center;background:#ffffffd9;border-radius:999px;padding:4px 10px;
  box-shadow:0 2px 6px rgba(120,120,160,.2);}
.fdf-medal{width:18px;height:18px;display:inline-block;}
.fdf-medal-dim{filter:grayscale(.6);opacity:.55;}
.fdf-medal-flash{animation:fdfMedalFlash ${BADGE_FLASH_MS}ms ease-out;}
@keyframes fdfMedalFlash{from{transform:scale(.5);filter:brightness(1.9)}to{transform:scale(1)}}
.fdf-sandbadge{display:inline-block;width:14px;height:19px;vertical-align:-4px;margin-right:3px;}
.fdf-sandline{animation:fdfSandFlow .9s linear infinite;}
@keyframes fdfSandFlow{to{stroke-dashoffset:-8;}}
.fdf-mag{position:absolute;width:52px;height:52px;margin:-26px 0 0 -26px;pointer-events:none;
  animation:fdfMagSwoop ${MAG_MS}ms cubic-bezier(.2,.75,.35,1) both;}
@keyframes fdfMagSwoop{
  from{transform:translate(96px,-120px) scale(.7);opacity:0;}
  55%{opacity:1;}
  to{transform:translate(0,0) scale(1);opacity:1;}}
.fdf-maglens{position:absolute;left:6.5px;top:6.5px;width:29px;height:29px;border-radius:50%;
  background:radial-gradient(60% 60% at 42% 38%,rgba(255,255,255,.5),rgba(255,255,255,.06));
  animation:fdfLensPulse ${MAG_MS}ms ease-out both;}
@keyframes fdfLensPulse{from{transform:scale(.6)}to{transform:scale(1.12)}}
.fdf-hitring{position:absolute;pointer-events:none;border:3px dashed ${FDF_ART.hitRing};border-radius:50%;
  width:${RING_FROM_R * 2}px;height:${RING_FROM_R * 2}px;
  animation:fdfRingClose ${RING_MS}ms ease-out ${MAG_MS}ms both,fdfRingSpin ${RING_MS}ms linear ${MAG_MS}ms both;}
.fdf-hitring-done{border-style:solid;border-color:${FDF_ART.foundGold};}
@keyframes fdfRingClose{from{width:${RING_FROM_R * 2}px;height:${RING_FROM_R * 2}px;}
  to{width:var(--fdf-ring-d);height:var(--fdf-ring-d);}}
@keyframes fdfRingSpin{from{transform:translate(-50%,-50%) rotate(0deg)}to{transform:translate(-50%,-50%) rotate(300deg)}}
.fdf-fxstar{position:absolute;width:0;height:0;}
.fdf-bubble{position:absolute;pointer-events:none;transform:translate(-50%,-125%);background:#ffffffe8;
  color:#5f5f6b;border:2px solid ${FDF_ART.missGray};border-radius:12px;padding:3px 10px;
  font-size:14px;font-weight:800;white-space:nowrap;box-shadow:0 2px 6px rgba(90,90,105,.18);
  animation:fdfBubbleUp ${BUBBLE_MS}ms ease-out both;}
.fdf-bubble::after{content:"";position:absolute;left:50%;bottom:-6px;margin-left:-4px;border:4px solid transparent;
  border-top-color:#ffffffe8;border-bottom:none;}
@keyframes fdfBubbleUp{from{transform:translate(-50%,-85%);opacity:0;}to{transform:translate(-50%,-125%);opacity:1;}}
.fdf-ribbon{display:flex;align-items:center;justify-content:center;min-height:26px;padding:2px 20px;
  border-radius:7px;background:linear-gradient(180deg,#ffa564,${FDF_ART.hitRing});color:#fff;font-weight:900;
  font-size:14px;letter-spacing:3px;box-shadow:0 3px 8px rgba(200,90,20,.35);position:relative;
  animation:fdfRibbonIn ${RIBBON_MS}ms ease-out both;}
.fdf-ribbon::before,.fdf-ribbon::after{content:"";position:absolute;top:4px;border:9px solid #e0761f;border-radius:2px;}
.fdf-ribbon::before{left:-11px;border-left-color:transparent;}
.fdf-ribbon::after{right:-11px;border-right-color:transparent;}
@keyframes fdfRibbonIn{from{transform:scale(.4);opacity:0;}35%{opacity:1;}60%{transform:scale(1.08);}to{transform:scale(1);}}
.fdf-paper{position:absolute;top:-4px;width:6px;height:10px;border-radius:2px;pointer-events:none;
  animation:fdfPaperFall ${RIBBON_MS}ms ease-in both;}
@keyframes fdfPaperFall{from{transform:translate(0,-12px) rotate(0deg);opacity:1;}
  to{transform:translate(var(--fdf-paper-dx),var(--fdf-paper-fall)) rotate(var(--fdf-paper-spin));opacity:0;}}
.fdf-btn.fdf-hint{background:linear-gradient(180deg,#ffd166,${FDF_ART.foundGold});box-shadow:0 4px 0 #c98d2a;
  color:#6b4310;transition:transform ${HINT_PRESS_MS}ms ease-out,box-shadow ${HINT_PRESS_MS}ms ease-out;}
.fdf-btn.fdf-hint:active{transform:translateY(2px) scale(.98);box-shadow:0 2px 0 #c98d2a;}
.fdf-cell.fdf-hintarea{background:#fff7d9;box-shadow:0 0 0 2px ${withAlpha(FDF_ART.foundGold, 0.4)},0 0 12px ${withAlpha(FDF_ART.foundGold, 0.4)};}
@media (max-width:380px){
  .fdf-framed{border-width:6px;}
  .fdf-row .fdf-framed{border-width:5px;}
  .fdf-plaque.fdf-label{padding:2px 10px;}
}
@media (prefers-reduced-motion:reduce){
  .fdf-mag,.fdf-hitring,.fdf-paper,.fdf-sandline{display:none;}
  .fdf-bubble,.fdf-ribbon,.fdf-medal-flash{animation:none;}
}
`;

/** kit 星屑一颗飞多久：index 里排收尸计时用（透传，别再抄一份数字） */
export const HIT_SPARK_MS = SPARK_MS;
