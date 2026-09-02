/**
 * 涂色小屋 · 画室视觉层（1.3 第 26 步 A 档新增，纯视觉模块）。
 *
 * 这一份只管「好看」：画室氛围、颜料坨、涟漪铺开、颜料滴角标、展墙相框、完成仪式。
 * 玩法一概不碰——判定、关卡数据、存档、热区全在别处，这里连一个状态都不存。
 *
 * 样式全部收在 `STUDIO_CSS`，**追加在 `CLF_CSS` 之后级联覆盖**（CLF_CSS 一字不改）；
 * 类名沿用本款 `clf-` 前缀。动画层一律 `pointer-events:none`，不挡任何点击。
 * 涟漪用 SVG `<mask>` + SMIL `<animate>`：旧色那层被一枚从点击点长大的圆洞
 * 渐渐擦掉，露出**逻辑早已铺好的最终色**——最终色 = 逻辑色，判定零改动。
 */
import { shade } from "../../art/kit/palette";
import { woodFrameCss } from "../../art/kit/frame";
import {
  BLOB_SINK_PX,
  RIPPLE_MS,
  STUDIO_TOKENS,
  brushDipSVG,
  dropBadgePath,
  paletteBoardCss,
} from "../../art/kit/paintBlob";

export { RIPPLE_MS };

/** 涂对亮圈的时长（动效时序表第 2 行） */
export const GLOW_MS = 240;
/** 涂错抖动的时长（动效时序表第 3 行） */
export const SHAKE_MS = 300;
/** 闪光扫过的时长（动效时序表第 6 行） */
export const SHINE_MS = 400;
/** 存好一幅飞进画廊的时长 */
export const FLY_MS = 550;

/** 数字 / 符号角标的字号（viewBox 座标系；360px 手机上缩到 0.9 倍仍 ≥ 12px 可读） */
export const MARK_FONT_PX = 14;
/** 颜料滴滴身的半径（viewBox 座标系） */
export const MARK_DROP_R = 10;

/** 涂对 / 涂错的两个视觉分支，互斥：先把两个都摘了再挂其中一个 */
export const HIT_CLASSES = ["clf-hit-right", "clf-hit-wrong"] as const;

/** 这一笔该走哪个视觉分支（涂对亮圈 / 涂错抖动） */
export function hitClassOf(right: boolean): (typeof HIT_CLASSES)[number] {
  return right ? HIT_CLASSES[0] : HIT_CLASSES[1];
}

/**
 * 按号模式「当前该涂的号」：按题目顺序找第一块还没涂对的，回它的目标色名。
 * 只读 fills，一个字段都不改；全涂对了回 null（呼吸提示熄掉）。
 */
export function nextPendingColor(
  tasks: ReadonlyArray<{ region: string; color: string }>,
  fills: Readonly<Record<string, string>>
): string | null {
  for (const task of tasks) {
    if (fills[task.region] !== task.color) return task.color;
  }
  return null;
}

/**
 * 把点击的屏幕坐标换算进 400×300 的 viewBox。
 * 用画布真实渲染矩形做比例换算，双指放大（transform:scale）也一并算对；
 * 量不到（矩形没铺开）回 null，调用方退回区域标签点。
 */
export function svgPointOf(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number
): { x: number; y: number } | null {
  if (!rect || !(rect.width > 0) || !(rect.height > 0)) return null;
  const x = ((clientX - rect.left) / rect.width) * 400;
  const y = ((clientY - rect.top) / rect.height) * 300;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: Math.max(0, Math.min(400, x)), y: Math.max(0, Math.min(300, y)) };
}

/**
 * 涟漪擦除层的 SVG 标记：`<mask>`（白底 + 从点击点长大的黑圆）+ 旧色残影。
 *
 * `shapeSvg` 是 `levels.ts` 里那条区域图形原文（只读），旧色 `oldHex` 铺在残影上、
 * 挂上 mask——黑圆从 0 长到 `radius`，旧色从点击点向外被擦掉，露出底下
 * **逻辑已经写好的新色**。`fill="freeze"` 停在擦干净那一帧，随后整组被移除。
 * 残影层不带 class、不带 data-id，天生不在热区名单里；容器再补 pointer-events:none。
 */
export function rippleGhostMarkup(
  shapeSvg: string,
  oldHex: string,
  maskId: string,
  cx: number,
  cy: number,
  radius: number,
  ms: number = RIPPLE_MS
): string {
  const shape = shapeSvg.replace(/\/>\s*$/, ` fill="${oldHex}" mask="url(#${maskId})"/>`);
  return (
    `<mask id="${maskId}">` +
    `<rect x="-20" y="-20" width="440" height="340" fill="#ffffff"/>` +
    `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="0" fill="#000000">` +
    `<animate attributeName="r" from="0" to="${Math.max(4, radius)}" dur="${ms}ms" fill="freeze"/>` +
    `</circle></mask>` +
    shape
  );
}

/**
 * 按号 / 图例角标：颜料滴（滴内数字或符号 + 描边 = 对应目标色）。
 * 数字与颜色双通道助记：认得数字的看数字，认得颜色的看描边。
 * 滴身白底不透明度 0.94，盖在没涂的白块上也看得出轮廓；文字仍旧深灰保证可读。
 */
export function dropBadgeMarkup(mark: string, strokeHex: string, lx: number, ly: number): string {
  const cy = ly - 5;
  return (
    `<path d="${dropBadgePath(lx, cy, MARK_DROP_R)}" fill="rgba(255,255,255,.94)"` +
    ` stroke="${strokeHex}" stroke-width="2.2" stroke-linejoin="round"/>` +
    `<text x="${lx}" y="${ly}" text-anchor="middle" font-size="${MARK_FONT_PX}" fill="#495057">${mark}</text>`
  );
}

/** 调色盘旁的小画笔（笔尖蘸当前色）；纯装饰，span + aria-hidden，不进 Tab 序也不接点击 */
export function paletteBrushHTML(tipHex: string): string {
  return `<span class="clf-brush" aria-hidden="true">${brushDipSVG(tipHex)}</span>`;
}

/**
 * 画室场景层的内容（墙纹 + 窗 + 透光斜带 + 画架剪影 + 地板线）。
 * 整层塞进 `.clf-studio`（absolute + z-index:-1 + pointer-events:none），
 * 只当背景纸，一个热区都不碰；画架是原创 A 字三脚剪影，不摹任何形象。
 */
export function studioSceneMarkup(): string {
  const wood = STUDIO_TOKENS.easelWood;
  return (
    `<span class="clf-studio-wall"></span>` +
    `<span class="clf-studio-beam"></span>` +
    `<span class="clf-studio-window"></span>` +
    `<svg class="clf-studio-easel" viewBox="0 0 100 60" preserveAspectRatio="xMidYMax meet" aria-hidden="true">` +
    `<path d="M50 2 L15 58" stroke="${wood}" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M50 2 L85 58" stroke="${wood}" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M50 8 L50 58" stroke="${shade(wood, -14)}" stroke-width="5" stroke-linecap="round"/>` +
    `<rect x="22" y="38" width="56" height="6" rx="3" fill="${shade(wood, 10)}"/>` +
    `</svg>` +
    `<span class="clf-studio-floor"></span>`
  );
}

const T = STUDIO_TOKENS;

/**
 * 1.3 视觉皮肤：全部**追加**在 `CLF_CSS` 之后，同名选择器靠级联后写者赢。
 * 热区红线：不写任何会移动 / 缩放 `.clf-region` 常态几何的规则；
 * 44px 那些热区尺寸一条不碰；动画层全部 pointer-events:none。
 */
export const STUDIO_CSS = `
/* ---- 画室小屋氛围（图层序最底：墙 → 窗斜带 → 画架 → 地板线） ---- */
.clf-wrap{z-index:0;}
.clf-studio{position:absolute;inset:0;z-index:-1;pointer-events:none;overflow:hidden;border-radius:16px;}
.clf-studio-wall{position:absolute;inset:0 0 12% 0;
  background:repeating-linear-gradient(90deg,rgba(160,107,58,.05) 0 2px,rgba(0,0,0,0) 2px 64px),
    linear-gradient(rgba(248,241,231,.62),rgba(248,241,231,.34));}
.clf-studio-beam{position:absolute;top:-12%;left:7%;width:32%;height:82%;transform:skewX(-18deg);
  background:linear-gradient(${T.sunBeam},rgba(255,233,168,0));}
.clf-studio-window{position:absolute;top:5%;left:6%;width:74px;height:58px;border-radius:8px;
  border:4px solid rgba(160,107,58,.4);background:
    linear-gradient(90deg,rgba(0,0,0,0) 0 46%,rgba(160,107,58,.4) 46% 54%,rgba(0,0,0,0) 54%),
    linear-gradient(rgba(0,0,0,0) 0 44%,rgba(160,107,58,.4) 44% 56%,rgba(0,0,0,0) 56%),
    linear-gradient(rgba(208,244,255,.55),rgba(255,255,255,.25));}
.clf-studio-easel{position:absolute;left:50%;bottom:3%;width:min(340px,84%);height:36%;
  transform:translateX(-50%);opacity:.5;}
.clf-studio-floor{position:absolute;left:0;right:0;bottom:0;height:12%;
  background:repeating-linear-gradient(90deg,rgba(160,107,58,.16) 0 2px,rgba(0,0,0,0) 2px 72px),
    linear-gradient(${T.studioFloor},rgba(230,216,196,.4));box-shadow:0 -2px 0 rgba(160,107,58,.24);}
/* 画布放在画架上：底沿一道木托（box-shadow 画的，盒子几何与热区零改动） */
.clf-stage{box-shadow:0 4px 0 #0001,0 11px 0 -4px ${T.easelWood},0 14px 0 -4px ${shade(T.easelWood, -22)};}
/* ---- 调色盘实体化：木板 + 颜料坨 + 画笔 ---- */
${paletteBoardCss("clf")}
.clf-palette{padding:10px 18px 12px;}
.clf-brush{flex:0 0 auto;width:34px;height:44px;pointer-events:none;align-self:flex-start;
  filter:drop-shadow(0 2px 1px rgba(120,80,40,.3));}
.clf-swatch-dot{transition:transform .14s ease-out,box-shadow .14s ease-out;}
.clf-swatch.clf-picked .clf-swatch-dot{transform:translateY(${BLOB_SINK_PX}px) scale(1.06);
  border-color:#fffdf7;box-shadow:0 0 0 3px ${T.pickRing},0 1px 0 rgba(0,0,0,.2);}
.clf-swatch.clf-picked .clf-swatch-name{color:#7c2d12;}
.clf-swatch.clf-breathe .clf-swatch-dot{animation:clfBreathe 1.4s ease-in-out infinite;}
@keyframes clfBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
/* ---- 涂色过程感：涟漪擦除层 + 涂对亮圈 + 涂错抖动（互斥类） ---- */
.clf-ripple-layer{pointer-events:none;}
.clf-canvas .clf-hit-right{animation:clfEdgeGlow ${GLOW_MS}ms ease-out;}
@keyframes clfEdgeGlow{0%{stroke:#ffd43b;filter:drop-shadow(0 0 7px #ffd43b)}
  100%{stroke:#495057;filter:none}}
.clf-canvas .clf-hit-wrong{animation:clfShakeXY ${SHAKE_MS}ms ease-out;}
@keyframes clfShakeXY{0%,100%{transform:translateX(0)}25%{transform:translateX(-2px)}
  50%{transform:translateX(2px)}75%{transform:translateX(-2px)}}
/* ---- 完成仪式：闪光扫过 → 装裱上画框（都压不住点击，闪光层 pointer-events:none） ---- */
.clf-shine{position:absolute;inset:0;pointer-events:none;overflow:hidden;border-radius:14px;z-index:3;}
.clf-shine::after{content:"";position:absolute;top:0;bottom:0;left:-45%;width:36%;transform:skewX(-18deg);
  background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.8),rgba(255,255,255,0));
  animation:clfShineSweep ${SHINE_MS}ms ease-out forwards;}
@keyframes clfShineSweep{to{left:112%;}}
.clf-stage.clf-mounted{box-shadow:0 0 0 6px ${T.easelWood},0 0 0 8px ${T.paletteWoodDark},
  0 6px 16px rgba(96,64,32,.35);}
/* ---- 画室（沙盒）也搭在画室墙上 ---- */
.clf-sheet{background:repeating-linear-gradient(90deg,rgba(160,107,58,.045) 0 2px,rgba(0,0,0,0) 2px 64px),
  linear-gradient(#fff8f0,#ffeedd);}
/* ---- 画廊展墙：射灯光晕 + 木质相框 + 底部铭牌 + 轻微抬起 ---- */
.clf-gallery{padding:12px 8px 8px;border-radius:12px;
  background:linear-gradient(180deg,${T.galleryLight},rgba(255,246,214,0) 46%);}
${woodFrameCss("clf")}
.clf-work.clf-framed{border-radius:8px;transition:transform .15s ease-out;}
.clf-work.clf-framed:hover,.clf-work.clf-framed:focus-visible{transform:translateY(-2px);}
.clf-work.clf-framed:active{transform:translateY(0);}
.clf-work-plaque{display:block;width:max-content;max-width:100%;margin:2px auto 0;padding:0 6px;
  font-size:12px;font-weight:800;color:#7a5a20;background:#fffdf7;
  border:1px solid ${T.paletteWoodDark};border-radius:6px;pointer-events:none;}
/* ---- 存好一幅飞进画廊（reduced 直接入列） ---- */
.clf-fly{position:absolute;width:72px;pointer-events:none;z-index:12;
  filter:drop-shadow(0 3px 6px rgba(96,64,32,.3));animation:clfFlyIn ${FLY_MS}ms ease-in forwards;}
.clf-fly svg{width:100%;height:auto;display:block;background:#fff;border-radius:4px;}
@keyframes clfFlyIn{to{transform:translate(var(--clf-fly-x,0px),var(--clf-fly-y,220px)) scale(.3);opacity:.15}}
/* ---- 手机 360px：氛围让位、坨子与角标一个不缩 ---- */
@media (max-width:400px){
  .clf-studio-window{display:none;}
  .clf-palette{padding:8px 12px 10px;}
}
/* ---- 减弱动效：涟漪（JS 已跳过）/ 呼吸 / 闪光 / 飞入全停，静态质感与结果保留 ---- */
@media (prefers-reduced-motion:reduce){
  .clf-swatch.clf-breathe .clf-swatch-dot{animation:none;box-shadow:0 0 0 3px rgba(255,140,66,.55);}
  .clf-canvas .clf-hit-right{animation:none;}
  .clf-canvas .clf-hit-wrong{animation:none;}
  .clf-shine::after{animation:none;opacity:0;}
  .clf-fly{animation:none;display:none;}
  .clf-swatch-dot{transition:none;}
  .clf-work.clf-framed{transition:none;}
}
`;
