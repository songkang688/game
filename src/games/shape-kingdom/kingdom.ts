/**
 * 形状王国 · 王国场景与城堡剪影（1.3 视觉升级 · 第 25 步 B 档，纯视觉模块）。
 *
 * 这里只有常量、纯函数和 CSS 文本：城堡剪影 SVG（原创塔楼 + 垛口城墙，六段，
 * 不像任何商标城堡）、拼放进度 → 点亮段数的映射、天空 / 远山 / 双云的场景层、
 * 完成仪式的彩纸轨迹、骨牌架的小剪影。不碰 DOM、不开计时器、不带运行时依赖；
 * 拼放判定、placements、关卡数据在这里一个字都不出现。
 */
import { GEM_STOPS, gemBody, gemEdge } from "../../art/kit/gem";
import { withAlpha } from "../../art/kit/palette";
import { SPARK_MS } from "../../art/kit/sparkle";
import { parseCellKey, type CellKey } from "./geometry";

/** 王国场景配色（绘制规格 4.1） */
export const KINGDOM_TOKENS = {
  /** 地基石纹底 */
  stoneBase: "#e8e2d8",
  /** 地基纹线 */
  stoneLine: "#c9c0b2",
  /** 未点亮城堡剪影 */
  castleSilhouette: "#b7a6cf",
  /** 已点亮塔楼描金 */
  castleLit: "#ffd93d",
  /** 背景天空渐变（上→下） */
  skyTop: "#dbeeff",
  skyBottom: "#fff6e8",
} as const;

/** 城堡剪影一共几段（塔楼 + 城墙交替，50% 进度正好点亮一半） */
export const CASTLE_SEGMENTS = 6;

/** 掐到 [0,1]；NaN 当 0（视觉层永远给得出结果） */
export function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

/** 拼放进度 → 点亮段数：0 → 0 段，50% → 3 段，100% → 6 段 */
export function litSegments(progress: number, segments = CASTLE_SEGMENTS): number {
  return Math.round(clamp01(progress) * Math.max(0, segments));
}

/** 拼骨牌的进度：已放格数 / 轮廓总格数（只读数量，不碰判定） */
export function tilingProgress(placedCells: number, totalCells: number): number {
  return totalCells > 0 ? clamp01(placedCells / totalCells) : 0;
}

// ---------------------------------------------------------------------------
// 城堡剪影 SVG（原创：矮方塔 + 方齿垛口 + 圆拱门，六段，从左往右点亮）
// ---------------------------------------------------------------------------

/** 一座方顶塔楼：三枚方齿垛口 + 塔身 */
function towerShape(x: number, w: number, top: number): string {
  const m = w / 5;
  const merlons = [0, 2, 4]
    .map((k) => `<rect x="${(x + k * m).toFixed(1)}" y="${top}" width="${m.toFixed(1)}" height="6"/>`)
    .join("");
  return `<rect x="${x}" y="${top + 5}" width="${w}" height="${64 - top - 5}"/>${merlons}`;
}

/** 一段城墙：四枚小方齿 + 墙身 */
function wallShape(x: number, w: number, top: number): string {
  const m = w / 7;
  const merlons = [0, 2, 4, 6]
    .map((k) => `<rect x="${(x + k * m).toFixed(1)}" y="${top}" width="${m.toFixed(1)}" height="4"/>`)
    .join("");
  return `<rect x="${x}" y="${top + 4}" width="${w}" height="${64 - top - 4}"/>${merlons}`;
}

/** 六段剪影的形体（从左到右：塔-墙-高塔-门墙-塔-墙） */
const CASTLE_SHAPES: readonly string[] = [
  towerShape(6, 28, 20),
  wallShape(34, 40, 36),
  towerShape(74, 28, 10),
  wallShape(102, 40, 30) + `<path d="M115 64 v-9 a7 7 0 0 1 14 0 v9 z" fill="#6b5c8c" stroke="none"/>`,
  towerShape(142, 28, 20),
  wallShape(170, 66, 36),
];

/**
 * 城堡剪影：`lit` 段已点亮（描金），其余是剪影紫。
 * `prevLit` 是上一次的点亮数——新亮的那几段挂 `shk-seg-new`，CSS 给 400ms
 * 描金过渡（reduced 下动画停了，fill 本身就是点亮结果，瞬时呈现）。
 * 全亮时中央高塔升起一面小三角旗（「王国建成」）。
 */
export function castleSvg(lit: number, prevLit = lit, segments = CASTLE_SEGMENTS): string {
  const on = Math.max(0, Math.min(segments, Math.round(lit)));
  const prev = Math.max(0, Math.min(segments, Math.round(prevLit)));
  const segs = CASTLE_SHAPES.slice(0, segments)
    .map((shape, i) => {
      const isOn = i < on;
      const isNew = isOn && i >= prev;
      const fill = isOn ? KINGDOM_TOKENS.castleLit : KINGDOM_TOKENS.castleSilhouette;
      const stroke = isOn ? "#d18a2a" : "#a293c2";
      return `<g data-seg="${i}" data-on="${isOn ? 1 : 0}"${isNew ? ' class="shk-seg-new"' : ""} fill="${fill}" stroke="${stroke}" stroke-width="1">${shape}</g>`;
    })
    .join("");
  const banner =
    on >= segments
      ? `<g data-banner="1"><rect x="87" y="0" width="2" height="10" fill="#8a7457"/><path d="M89 1 l10 3 -10 3 z" fill="${GEM_STOPS[0][0]}"/></g>`
      : "";
  return `<svg class="shk-castle-svg" viewBox="0 0 244 64" data-lit="${on}" data-segs="${segments}" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${banner}${segs}</svg>`;
}

/** 地基四角的小三角旗（原创小旗杆 + 三角旗） */
export function cornerFlagSvg(): string {
  return `<svg viewBox="0 0 14 18" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="1" width="1.6" height="16" rx="0.8" fill="#8a7457"/><path d="M4 1.5 l9 3 -9 3 z" fill="${KINGDOM_TOKENS.castleSilhouette}"/></svg>`;
}

/** 骨牌架上的小剪影：把这一块的格子按宝石本色画成迷你方块（纯展示） */
export function pieceBadgeSvg(cells: readonly CellKey[], colorIndex: number): string {
  const pts = cells.map((k) => parseCellKey(k));
  const rows = Math.max(...pts.map((p) => p.r)) + 1;
  const cols = Math.max(...pts.map((p) => p.c)) + 1;
  const u = 10;
  const rects = pts
    .map(
      (p) =>
        `<rect x="${p.c * u + 1}" y="${p.r * u + 1}" width="${u - 2}" height="${u - 2}" rx="2" fill="${gemBody(colorIndex)}" stroke="${gemEdge(colorIndex)}" stroke-width="1"/>`
    )
    .join("");
  return `<svg viewBox="0 0 ${cols * u} ${rows * u}" width="${cols * u}" height="${rows * u}" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}

// ---------------------------------------------------------------------------
// 完成仪式 · 彩纸轨迹（纯参数，落地方拿去写内联样式）
// ---------------------------------------------------------------------------

/** 一关拼满撒几粒彩纸 */
export const CONFETTI_COUNT = 20;

export interface ConfettiSpec {
  /** 相对中线的横向起点（px） */
  dxPx: number;
  /** 错开起飞（ms） */
  delayMs: number;
  /** 纸片宽（px） */
  sizePx: number;
  /** 用第几种宝石色 */
  colorIndex: number;
  /** 飘落时长（ms） */
  durationMs: number;
}

/** 彩纸参数：横向摊开、颗颗错峰，`rand` 由调用方注入（测试喂定数就能复现） */
export function confettiSpecs(rand: () => number, count = CONFETTI_COUNT): ConfettiSpec[] {
  const n = Math.max(1, Math.floor(count));
  const out: ConfettiSpec[] = [];
  for (let i = 0; i < n; i++) {
    const r = clamp01(rand());
    out.push({
      dxPx: Math.round((i / Math.max(1, n - 1)) * 240 - 120 + (r * 2 - 1) * 8),
      delayMs: i * 36,
      sizePx: 6 + Math.round(r * 4),
      colorIndex: i % GEM_STOPS.length,
      durationMs: 700 + Math.round(r * 300),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 王国皮肤 CSS（追加在 DRAW_CSS 之后级联覆盖；DRAW_CSS 本身一字不改）
// ---------------------------------------------------------------------------

const ghostRules = GEM_STOPS.map(
  (_, i) =>
    `.shk-cell-ghost-p${i}{background:${withAlpha(gemBody(i), 0.4)};border-color:${gemEdge(i)};}`
).join("\n");

export const KINGDOM_CSS = `
/* ---- 图层序：场景(0) → 内容(1) → dock(2，DRAW_CSS 原有) → 星闪/彩纸(5+) ---- */
.shk-draw{position:relative;}
.shk-draw-top,.shk-castle,.shk-kingdom,.shk-ask,.shk-boardwrap{position:relative;z-index:1;}

/* ---- 场景氛围：淡色天空 + 远山 + 两朵云（缓移 12s，reduced 静止） ---- */
.shk-scene{position:absolute;inset:0;border-radius:16px;overflow:hidden;pointer-events:none;z-index:0;
  background:linear-gradient(180deg,${KINGDOM_TOKENS.skyTop} 0%,${KINGDOM_TOKENS.skyBottom} 72%,rgba(255,246,232,0) 100%);opacity:.85;}
.shk-mount{position:absolute;bottom:34%;height:26%;border-radius:50% 50% 0 0;}
.shk-mount-a{left:-12%;width:58%;background:#cfc3e6;opacity:.45;}
.shk-mount-b{left:46%;width:70%;height:20%;background:#bdaedd;opacity:.35;}
.shk-cloud{position:absolute;top:7%;width:64px;height:20px;border-radius:999px;background:rgba(255,255,255,.92);
  box-shadow:14px 6px 0 -3px rgba(255,255,255,.85),-15px 7px 0 -4px rgba(255,255,255,.75);
  animation:shkDrift 12s linear infinite alternate;}
.shk-cloud-a{left:5%;}
.shk-cloud-b{left:58%;top:14%;width:46px;height:15px;animation-duration:12s;animation-delay:-5s;}
@keyframes shkDrift{from{transform:translateX(0)}to{transform:translateX(44px)}}

/* ---- 城堡剪影背景层：拼放进度逐段点亮，新亮那段 400ms 描金过渡 ---- */
.shk-kingdom{display:flex;justify-content:center;pointer-events:none;min-height:40px;}
.shk-kingdom svg{width:min(244px,82%);height:auto;display:block;filter:drop-shadow(0 2px 2px rgba(120,100,160,.25));}
.shk-seg-new{animation:shkLight .4s ease-in-out;}
@keyframes shkLight{from{opacity:.3}to{opacity:1}}

/* ---- 城堡地基：石纹底 + 虚线轮廓（几何原样：border 仍是 2px，只换色与线型） ---- */
.shk-cell-target{background:
  repeating-linear-gradient(0deg,transparent 0 9px,${withAlpha(KINGDOM_TOKENS.stoneLine, 0.55)} 9px 10px),
  repeating-linear-gradient(90deg,transparent 0 12px,${withAlpha(KINGDOM_TOKENS.stoneLine, 0.35)} 12px 13px),
  ${KINGDOM_TOKENS.stoneBase};
  border-style:dashed;border-color:${KINGDOM_TOKENS.stoneLine};}
.shk-flag{position:absolute;width:14px;height:18px;pointer-events:none;z-index:2;}
.shk-flag svg{width:100%;height:100%;display:block;}
.shk-flag-tl{left:-6px;top:-14px;}
.shk-flag-tr{right:-6px;top:-14px;transform:scaleX(-1);}
.shk-flag-bl{left:-6px;bottom:-6px;}
.shk-flag-br{right:-6px;bottom:-6px;transform:scaleX(-1);}

/* ---- 棋盘外框：城墙垛口边框（伪元素画在盒子外侧，热区与判定格零位移） ---- */
.shk-board::before{content:"";position:absolute;left:-7px;right:-7px;top:-13px;bottom:-7px;z-index:-1;
  border:3px solid #cbbfe3;border-radius:18px;background:rgba(255,255,255,.35);pointer-events:none;}
.shk-board::after{content:"";position:absolute;left:-4px;right:-4px;top:-13px;height:7px;
  background:repeating-linear-gradient(90deg,#cbbfe3 0 10px,transparent 10px 18px);
  border-radius:3px;pointer-events:none;}

/* ---- 宝石块落定 / 弹回 / 预放虚影 ---- */
.shk-cell-landed{animation:shkLand .22s cubic-bezier(.34,1.56,.64,1);}
@keyframes shkLand{0%{transform:translateY(-4px) scale(1.08)}55%{transform:translateY(0) scale(1)}72%{transform:translateY(0) scale(1)}86%{transform:scale(1.04)}100%{transform:scale(1)}}
.shk-cell-deny{animation:shkDeny .32s ease-out;}
@keyframes shkDeny{0%{transform:rotate(0)}25%{transform:rotate(3deg)}55%{transform:rotate(-3deg)}80%{transform:rotate(2deg)}100%{transform:rotate(0)}}
.shk-cell-ghost{border-style:dashed;}
${ghostRules}

/* ---- 放对四角星闪（sparkle.ts 的轨迹参数 + 这里的定点星） ---- */
.shk-starpop{position:absolute;pointer-events:none;z-index:5;}
.shk-starpop .shk-spark{font-size:12px;line-height:1;color:#ffd93d;text-shadow:0 0 3px rgba(255,214,120,.9);}

/* ---- 拾起态：抬升 4px + 放大 1.05 + 底部椭圆影（作用在按钮内层，热区零位移） ---- */
.shk-piece{position:relative;}
.shk-piece-face{display:inline-flex;align-items:center;gap:6px;transition:transform .14s ease-out;}
.shk-piece-art{display:inline-flex;}
.shk-piece-art svg{display:block;}
.shk-piece-on .shk-piece-face{transform:translateY(-4px) scale(1.05);}
.shk-piece-on::after{content:"";position:absolute;left:16%;right:16%;bottom:2px;height:6px;border-radius:50%;
  background:rgba(0,0,0,.15);pointer-events:none;}

/* ---- 形状架：待选块下的木架横条与投影 ---- */
.shk-rack-row{position:relative;padding:6px 8px 14px;}
.shk-rack-row::after{content:"";position:absolute;left:2%;right:2%;bottom:2px;height:10px;border-radius:6px;
  background:linear-gradient(180deg,#d9a05f,#b97b3e);box-shadow:0 3px 5px rgba(90,60,20,.28);pointer-events:none;}
.shk-rack-row .shk-piece{z-index:1;}

/* ---- 顶栏与读数卡片化（只换壳，文本一字不动；字号守住 ≥14px） ---- */
.shk-badge{background:#fffdf7;border:1.5px solid #e8dfc9;box-shadow:0 2px 0 rgba(160,140,100,.16);font-size:14px;}
.shk-readout{background:rgba(255,255,255,.88);border:1.5px solid #e9e2f2;border-radius:12px;padding:6px 10px;
  box-shadow:0 2px 6px rgba(120,110,160,.14);}

/* ---- 完成仪式：升旗 400ms + 彩纸 20 粒 + 星星逐颗弹入（浮层不接指针） ---- */
.shk-fete{position:absolute;inset:0;pointer-events:none;z-index:5;display:flex;flex-direction:column;
  align-items:center;padding-top:6px;overflow:hidden;border-radius:16px;}
.shk-fete-flagwrap{position:relative;width:34px;height:52px;}
.shk-fete-pole{position:absolute;left:4px;top:0;bottom:0;width:3px;border-radius:2px;background:#8a7457;}
.shk-fete-flagcloth{position:absolute;left:7px;top:2px;width:26px;height:16px;background:${GEM_STOPS[0][0]};
  clip-path:polygon(0 0,100% 0,78% 50%,100% 100%,0 100%);animation:shkFlagUp .4s ease forwards;}
@keyframes shkFlagUp{from{transform:translateY(26px)}to{transform:translateY(0)}}
.shk-fete-stars{display:flex;gap:8px;margin-top:2px;font-size:26px;}
.shk-fete-star{animation:shkStarIn .3s cubic-bezier(.34,1.56,.64,1) backwards;}
@keyframes shkStarIn{from{transform:scale(0);opacity:0}}
.shk-confetti{position:absolute;top:-14px;border-radius:2px;animation:shkConfetti .9s ease-in forwards;}
@keyframes shkConfetti{from{transform:translateY(0) rotate(0);opacity:1}to{transform:translateY(360px) rotate(540deg);opacity:.15}}

/* ---- reduced：吸附 / 升旗 / 云移 / 点亮过渡 / 彩纸全停，静态质感与点亮结果保留；
       星闪退成静态星点（sparkle 套件默认整颗藏掉，这里把定点星以静态样子放回来）；
       拾起抬升是功能反馈，按规格保留 ---- */
@media (prefers-reduced-motion:reduce){
  .shk-cloud{animation:none;}
  .shk-seg-new{animation:none;}
  .shk-cell-landed{animation:none;}
  .shk-cell-deny{animation:none;}
  .shk-fete-flagcloth{animation:none;}
  .shk-fete-star{animation:none;}
  .shk-confetti{display:none;}
  .shk-starpop .shk-spark{display:inline;animation:none;opacity:.85;}
}

/* ---- 360px 窄屏：王国层收窄、卡片仍一行放得下（字号钉在 14px 不再小） ---- */
@media (max-width:380px){
  .shk-kingdom svg{width:88%;}
  .shk-badge{padding:4px 10px;}
}
`;

/** 星闪动画时长（转出口，落地方好按它收尸） */
export const STARPOP_MS = SPARK_MS;
