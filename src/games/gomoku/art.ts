/**
 * 五子棋 · 视觉资产（1.3 视觉升级，纯绘制不碰玩法数值）。
 *
 * 这里只放「怎么画」：精装木盘的边框与包角、玉石棋子的渐变画法、
 * 最后一手的漆印红点、落定波纹、胜利星星、谜题过关的金色小花，
 * 以及座位条 / 沙漏用的 SVG 图标。何时画、画在哪一格由 view.ts 决定。
 *
 * 共享 art kit（src/art/kit/）还没建，按视觉宪法先落在本目录；
 * 建成后 paintStone 的玉石渐变画法可反向输出给 kit（供 weiqi-garden 等复用）。
 */

type Ctx2D = CanvasRenderingContext2D;

// ---------------------------------------------------------------------------
// 调色板（改的是观感，不是胜负）
// ---------------------------------------------------------------------------

/** 黑子三档渐变：更沉的墨玉感，减少 1.2 版的紫味 */
export const STONE_BLACK = ["#8E7E92", "#4A4054", "#2E2837"] as const;
/** 白子三档渐变：贝壳白，1.2 的配方原样保留 */
export const STONE_WHITE = ["#FFFFFF", "#FBF4E8", "#EBDFC9"] as const;

/** 深木边框的双色渐变（外深内浅，有车边的光泽） */
export const FRAME_DARK = "#6B4423";
export const FRAME_LIGHT = "#96652F";
/** 边框内侧的一圈金线 */
export const FRAME_GOLD = "#E8C57C";
/** 棋盘外那圈桌面的深茶色 */
export const TABLE_DARK = "#4A3220";
export const TABLE_LIGHT = "#5E4128";
/** 四角包角铜饰 */
export const CORNER_COPPER = "#C88A4A";

/** 深木边框厚度（px），桌面色露出的一圈宽度（px） */
export const FRAME_PX = 10;
export const TABLE_PX = 3;

/** 最后一手漆印红点 */
export const LACQUER_RED = "#E23B30";

/** 提示教学区块：极淡金色（与木盘同族，不再是绿色荧光） */
export const HINT_GOLD_FILL = "233,190,105";
export const HINT_GOLD_EDGE = "#C9973F";

// ---------------------------------------------------------------------------
// 玉石棋子（1.2 的标杆画法，只润色不换公式）
// ---------------------------------------------------------------------------

/**
 * 在 (cx,cy) 画一颗半径 r 的玉石棋子：投影 + 径向渐变 + 白子描边 + 椭圆高光。
 * 这是全仓库棋子的标杆画法，sprite 预渲染与直接绘制共用这一份。
 */
export function paintStone(ctx: Ctx2D, cx: number, cy: number, r: number, p: 1 | 2): void {
  if (r <= 0) return;
  ctx.beginPath();
  ctx.arc(cx + r * 0.06, cy + r * 0.12, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(120,80,40,.28)";
  ctx.fill();
  const grad = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.42, r * 0.1, cx, cy, r * 1.05);
  const stops = p === 1 ? STONE_BLACK : STONE_WHITE;
  grad.addColorStop(0, stops[0]);
  grad.addColorStop(p === 1 ? 0.55 : 0.6, stops[1]);
  grad.addColorStop(1, stops[2]);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  if (p === 2) {
    ctx.strokeStyle = "rgba(150,110,70,.8)";
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  ctx.fillStyle = p === 1 ? "rgba(255,255,255,.4)" : "rgba(255,255,255,.95)";
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.32, cy - r * 0.4, r * 0.26, r * 0.16, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

/** sprite 一张覆盖多少格（棋子 0.47c×2 + 投影 / 高光的呼吸余量） */
export const SPRITE_SPAN_CELLS = 1.3;
/** 预渲染倍率：落子动画会放大到 1.5 倍，2 倍采样保证不糊 */
export const SPRITE_OVERSAMPLE = 2;

export interface StoneSprite {
  canvas: HTMLCanvasElement;
  /** 画到主画布上时的逻辑边长（px），中心即棋子中心 */
  span: number;
}

/**
 * 把一颗棋子预渲染成离屏画布（满盘 15×15 时 draw() 只做 drawImage）。
 * 离屏环境拿不到 2d 上下文时返回 null，调用方退回逐颗渐变绘制。
 */
export function buildStoneSprite(
  doc: { createElement(tag: string): unknown },
  cellPx: number,
  p: 1 | 2
): StoneSprite | null {
  if (cellPx <= 0) return null;
  const span = cellPx * SPRITE_SPAN_CELLS;
  const size = Math.max(2, Math.ceil(span * SPRITE_OVERSAMPLE));
  const canvas = doc.createElement("canvas") as HTMLCanvasElement;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext?.("2d") as Ctx2D | null;
  if (!ctx) return null;
  paintStone(ctx, size / 2, size / 2, cellPx * 0.47 * SPRITE_OVERSAMPLE, p);
  return { canvas, span };
}

// ---------------------------------------------------------------------------
// 精装木盘：桌面 → 柔影 → 深木边框 → 金线 → 包角铜饰
// ---------------------------------------------------------------------------

/**
 * 在已经铺好木纹的画布上，给外圈加桌面色 + 深木边框 + 金线 + 四角铜饰。
 * 画在木纹之后、棋盘线之前；不动 px()/cs()，落点换算不受影响。
 */
export function paintBoardFrame(ctx: Ctx2D, w: number): void {
  // 桌面：最外一圈深茶色（canvas 的圆角由 CSS border-radius 裁）
  const table = ctx.createLinearGradient(0, 0, w, w);
  table.addColorStop(0, TABLE_LIGHT);
  table.addColorStop(1, TABLE_DARK);
  ctx.fillStyle = table;
  ctx.fillRect(0, 0, w, TABLE_PX);
  ctx.fillRect(0, w - TABLE_PX, w, TABLE_PX);
  ctx.fillRect(0, 0, TABLE_PX, w);
  ctx.fillRect(w - TABLE_PX, 0, TABLE_PX, w);
  // 棋盘悬浮在桌上的 4px 柔影：沿边框外侧压一圈半透明暗色
  ctx.strokeStyle = "rgba(30,18,8,.35)";
  ctx.lineWidth = 4;
  ctx.strokeRect(TABLE_PX + 0.5, TABLE_PX + 0.5, w - TABLE_PX * 2 - 1, w - TABLE_PX * 2 - 1);
  // 深木边框：双色渐变
  const frame = ctx.createLinearGradient(0, 0, w, w);
  frame.addColorStop(0, FRAME_LIGHT);
  frame.addColorStop(0.5, FRAME_DARK);
  frame.addColorStop(1, FRAME_LIGHT);
  ctx.fillStyle = frame;
  const f0 = TABLE_PX;
  const fw = w - TABLE_PX * 2;
  ctx.fillRect(f0, f0, fw, FRAME_PX);
  ctx.fillRect(f0, w - TABLE_PX - FRAME_PX, fw, FRAME_PX);
  ctx.fillRect(f0, f0, FRAME_PX, fw);
  ctx.fillRect(w - TABLE_PX - FRAME_PX, f0, FRAME_PX, fw);
  // 内侧 1px 金线
  const inner = TABLE_PX + FRAME_PX;
  ctx.strokeStyle = FRAME_GOLD;
  ctx.lineWidth = 1;
  ctx.strokeRect(inner - 0.5, inner - 0.5, w - inner * 2 + 1, w - inner * 2 + 1);
  // 四角包角铜饰：四分之一圆弧，一亮一暗两笔有金属感
  const cr = FRAME_PX + 4;
  const corners: Array<[number, number, number]> = [
    [f0, f0, 0],
    [w - f0, f0, Math.PI / 2],
    [w - f0, w - f0, Math.PI],
    [f0, w - f0, Math.PI * 1.5],
  ];
  ctx.lineCap = "round";
  for (const [cx, cy, rot] of corners) {
    ctx.strokeStyle = CORNER_COPPER;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, rot, rot + Math.PI / 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,226,170,.75)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, cr - 1.6, rot + 0.12, rot + Math.PI / 2 - 0.12);
    ctx.stroke();
  }
}

/** 星位点：深色圆点 + 0.5px 偏移的高光弧（内嵌钉感） */
export function paintStarPoint(ctx: Ctx2D, x: number, y: number, r: number): void {
  ctx.fillStyle = "#B9854E";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,240,210,.7)";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.arc(x - 0.5, y - 0.5, r - 0.9, Math.PI * 0.8, Math.PI * 1.7);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// 标记：漆印红点 / 落定波纹 / 胜利星星 / 金色小花
// ---------------------------------------------------------------------------

/** 最后一手：棋子上一个小红点漆印（带高光），黑白子上都看得清 */
export function paintLacquerDot(ctx: Ctx2D, cx: number, cy: number, r: number): void {
  if (r <= 0) return;
  ctx.fillStyle = "rgba(90,20,10,.4)";
  ctx.beginPath();
  ctx.arc(cx + r * 0.16, cy + r * 0.22, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = LACQUER_RED;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy - r * 0.34, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

/** 波纹半径：从棋子边缘往外扩到 1.7 倍（easeOut，先快后慢） */
export function rippleRadius(stoneR: number, k: number): number {
  const e = 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 2);
  return stoneR * (1 + 0.7 * e);
}

/** 波纹透明度：线性淡出到 0 */
export function rippleAlpha(k: number): number {
  return Math.max(0, 0.55 * (1 - k));
}

/** 落定波纹：一圈细波纹从棋子边缘扩散开（0.25s，reduced 下由 view 直接不排） */
export function paintRipple(ctx: Ctx2D, cx: number, cy: number, stoneR: number, k: number): void {
  const a = rippleAlpha(k);
  if (a <= 0) return;
  ctx.strokeStyle = `rgba(214,158,88,${a})`;
  ctx.lineWidth = 1.6 * (1 - k * 0.5);
  ctx.beginPath();
  ctx.arc(cx, cy, rippleRadius(stoneR, k), 0, Math.PI * 2);
  ctx.stroke();
}

/** 胜利线上的小星星：矢量五角星，替掉 1.2 的「⭐」字符占位 */
export function paintStar(ctx: Ctx2D, cx: number, cy: number, r: number, alpha: number): void {
  if (r <= 0 || alpha <= 0) return;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(rad) * rr;
    const y = cy + Math.sin(rad) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = "#FFE58A";
  ctx.fill();
  ctx.strokeStyle = "#D9A13B";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** 开花的生长进度：reduced 直接满开，其余 easeOutBack 微回弹 */
export function bloomScale(k: number, reduced: boolean): number {
  if (reduced) return 1;
  const t = Math.max(0, Math.min(1, k));
  const c = 1.70158;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}

/** 谜题过关的金色小花：五瓣金花 + 花心，开在制胜点上 */
export function paintGoldFlower(ctx: Ctx2D, cx: number, cy: number, r: number, scale: number): void {
  const s = r * Math.max(0, scale);
  if (s <= 0) return;
  for (let i = 0; i < 5; i++) {
    const rad = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    ctx.fillStyle = "#F7C64B";
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(rad) * s * 0.52, cy + Math.sin(rad) * s * 0.52, s * 0.4, s * 0.26, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#D9A13B";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.fillStyle = "#FFF3C9";
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#D9820F";
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// HUD 用的 SVG 图标（座位条棋子 / AI 思考沙漏），全部原创矢量
// ---------------------------------------------------------------------------

/** 座位条 / 结算卡上的棋子小图标（与画布同一套玉石配色） */
export function stoneIconSVG(p: 1 | 2, size: number): string {
  const [hi, mid, lo] = p === 1 ? STONE_BLACK : STONE_WHITE;
  const edge = p === 2 ? `<circle cx="24" cy="24" r="19" fill="none" stroke="rgba(150,110,70,.8)" stroke-width="2"/>` : "";
  return (
    `<svg class="gmk-stoneicon" viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true">` +
    `<ellipse cx="26" cy="28" rx="19" ry="18" fill="rgba(120,80,40,.28)"/>` +
    `<defs><radialGradient id="gmk-g${p}" cx="0.36" cy="0.32" r="0.95">` +
    `<stop offset="0" stop-color="${hi}"/><stop offset="0.55" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/>` +
    `</radialGradient></defs>` +
    `<circle cx="24" cy="24" r="19" fill="url(#gmk-g${p})"/>${edge}` +
    `<ellipse cx="17" cy="16" rx="6" ry="3.6" transform="rotate(-32 17 16)" fill="rgba(255,255,255,${p === 1 ? ".4" : ".95"})"/>` +
    `</svg>`
  );
}

// ---------------------------------------------------------------------------
// 六档棋灵的画制头像（round2 N-01:座位条不再用 emoji 前缀认对手）
// ---------------------------------------------------------------------------

/** spiritAvatarSVG 支持的六档(与 ai.ts 的 Difficulty 同名,只取字面量不引玩法模块) */
export type SpiritTier = "novice" | "easy" | "normal" | "smart" | "master" | "hell";

/** 棋灵的一对墨点眼(带高光),渊档换成闭目弯月 */
function spiritEyes(ink: string, closed: boolean): string {
  if (closed) {
    return (
      `<path d="M16.6 25.6 q2.3 -2.8 4.6 0" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>` +
      `<path d="M26.8 25.6 q2.3 -2.8 4.6 0" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>`
    );
  }
  return (
    `<circle cx="19" cy="25.2" r="1.7" fill="${ink}"/>` +
    `<circle cx="29" cy="25.2" r="1.7" fill="${ink}"/>` +
    `<circle cx="18.4" cy="24.6" r=".6" fill="#fff"/>` +
    `<circle cx="28.4" cy="24.6" r=".6" fill="#fff"/>`
  );
}

/** 微笑一弯(嘴角上翘,失败也只会鼓励的脸) */
function spiritSmile(ink: string): string {
  return `<path d="M21.4 30.4 q2.6 2.4 5.2 0" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>`;
}

/**
 * 六档棋灵头像:与座位条迷你棋子**同一套玉石材质**——投影 + 三档径向渐变圆面 +
 * 左上椭圆高光(-32°,同 stoneIconSVG),特征全部用深木墨色(FRAME_DARK)两三笔勾出:
 * 苗=顶芽两叶 / 喵=立耳粉窝 / 狐=尖耳白吻 / 龙=金角短须 / 象=大耳卷鼻 / 渊=墨玉面星点闭目。
 * 渊档整面换黑玉渐变,呼应「深渊」;全部原创造型,不近似任何棋院徽记 / 商标形象。
 * 纯 SVG 字符串,座位条直接 innerHTML 内联;渐变 id 按档位隔离不串色。
 */
export function spiritAvatarSVG(tier: SpiritTier, size: number): string {
  const dark = tier === "hell";
  const [hi, mid, lo] = dark ? STONE_BLACK : STONE_WHITE;
  const ink = dark ? "#E8DDF2" : FRAME_DARK;
  const blush = dark ? "rgba(232,221,242,.28)" : "rgba(205,125,70,.30)";
  const gid = `gmk-sp-${tier}`;
  const feats: Record<SpiritTier, string> = {
    // 苗:头顶一茎两片嫩芽(绿),刚发芽的新手
    novice:
      `<path d="M24 13 C23.7 11 23.9 9.2 24.5 7.6" fill="none" stroke="#5E8C4A" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M23.9 9.8 C21.6 10 19.9 9 19.1 7 C21.4 6.4 23.3 7.3 23.9 9.8 Z" fill="#7FB069" stroke="#5E8C4A" stroke-width="1.3" stroke-linejoin="round"/>` +
      `<path d="M24.4 8.6 C26.3 9.2 28.3 8.5 29.3 6.6 C27.2 5.6 25.2 6.3 24.4 8.6 Z" fill="#9CC97F" stroke="#5E8C4A" stroke-width="1.3" stroke-linejoin="round"/>` +
      spiritEyes(ink, false) +
      spiritSmile(ink),
    // 喵:两只立耳(耳窝一抹粉) + w 形猫嘴
    easy:
      `<path d="M13.6 19 L14.9 8.9 Q15.1 7.6 16.2 8.4 L21.8 12.4 Z" fill="${mid}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>` +
      `<path d="M34.4 19 L33.1 8.9 Q32.9 7.6 31.8 8.4 L26.2 12.4 Z" fill="${mid}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>` +
      `<path d="M15.7 16.4 L16.4 11.2 L19.6 13.5 Z" fill="${blush}"/>` +
      `<path d="M32.3 16.4 L31.6 11.2 L28.4 13.5 Z" fill="${blush}"/>` +
      spiritEyes(ink, false) +
      `<path d="M21.2 30 Q22.6 31.9 24 30 Q25.4 31.9 26.8 30" fill="none" stroke="${ink}" stroke-width="1.5" stroke-linecap="round"/>`,
    // 狐:更高更尖的双耳 + 奶白小吻端
    normal:
      `<path d="M14.4 20 L14.7 7 Q14.8 5.7 16 6.7 L21.9 12.3 Z" fill="${mid}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>` +
      `<path d="M33.6 20 L33.3 7 Q33.2 5.7 32 6.7 L26.1 12.3 Z" fill="${mid}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>` +
      `<ellipse cx="24" cy="31" rx="6.2" ry="4.4" fill="#FFF9EE" stroke="${ink}" stroke-width="1.4"/>` +
      `<circle cx="24" cy="29.4" r="1.4" fill="${ink}"/>` +
      spiritEyes(ink, false),
    // 龙:一对金角 + 腮边短须
    smart:
      `<path d="M17.2 12.8 C15.6 10 16 7.2 18 5.2 C19.3 7.8 19.1 10.5 18.3 12.6 Z" fill="${FRAME_GOLD}" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round"/>` +
      `<path d="M30.8 12.8 C32.4 10 32 7.2 30 5.2 C28.7 7.8 28.9 10.5 29.7 12.6 Z" fill="${FRAME_GOLD}" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round"/>` +
      `<path d="M13.6 28.4 q-2.8 .3 -3.8 2.5" fill="none" stroke="${ink}" stroke-width="1.5" stroke-linecap="round"/>` +
      `<path d="M34.4 28.4 q2.8 .3 3.8 2.5" fill="none" stroke="${ink}" stroke-width="1.5" stroke-linecap="round"/>` +
      spiritEyes(ink, false) +
      spiritSmile(ink),
    // 象:两扇大耳 + 一管卷鼻(与 xiangqi 小象同族但玉石材质)
    master:
      `<ellipse cx="12.4" cy="24.6" rx="5.2" ry="6.8" fill="${mid}" stroke="${ink}" stroke-width="2"/>` +
      `<ellipse cx="35.6" cy="24.6" rx="5.2" ry="6.8" fill="${mid}" stroke="${ink}" stroke-width="2"/>` +
      `<path d="M22.8 29 C22 32 22.4 34.4 24 35.8 C25.4 37 27.2 37.1 28.6 36.2 L27.8 34.6 C26.7 35.2 25.6 35 24.9 34.2 C23.9 33 24 31 24.9 29.2 Z" fill="${mid}" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round"/>` +
      spiritEyes(ink, false),
    // 渊:墨玉面 + 三粒星光 + 闭目浅笑(星环徽记样式刻意避开)
    hell:
      `<path d="M15 13.6 l.9 2 2 .9 -2 .9 -.9 2 -.9 -2 -2 -.9 2 -.9 Z" fill="#CBB8E8"/>` +
      `<path d="M31.6 11.8 l.7 1.6 1.6 .7 -1.6 .7 -.7 1.6 -.7 -1.6 -1.6 -.7 1.6 -.7 Z" fill="#B7A3DB"/>` +
      `<path d="M31 33.4 l.6 1.3 1.3 .6 -1.3 .6 -.6 1.3 -.6 -1.3 -1.3 -.6 1.3 -.6 Z" fill="#CBB8E8"/>` +
      spiritEyes(ink, true) +
      spiritSmile(ink),
  };
  return (
    `<svg class="gmk-spirit" viewBox="0 0 48 48" width="${size}" height="${size}"` +
    ` style="vertical-align:middle" aria-hidden="true">` +
    `<ellipse cx="25.4" cy="30" rx="16.4" ry="15.4" fill="rgba(120,80,40,.28)"/>` +
    `<defs><radialGradient id="${gid}" cx="0.36" cy="0.32" r="0.95">` +
    `<stop offset="0" stop-color="${hi}"/><stop offset="0.55" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/>` +
    `</radialGradient></defs>` +
    `<circle cx="24" cy="27" r="16.5" fill="url(#${gid})"/>` +
    `<circle cx="24" cy="27" r="16.5" fill="none" stroke="${dark ? "rgba(46,40,55,.9)" : "rgba(150,110,70,.8)"}" stroke-width="2"/>` +
    `<ellipse cx="18.6" cy="20.6" rx="5.4" ry="3.1" transform="rotate(-32 18.6 20.6)" fill="rgba(255,255,255,${dark ? ".35" : ".9"})"/>` +
    `<ellipse cx="15.6" cy="29.4" rx="2.3" ry="1.4" fill="${blush}"/>` +
    `<ellipse cx="32.4" cy="29.4" rx="2.3" ry="1.4" fill="${blush}"/>` +
    feats[tier] +
    `</svg>`
  );
}

/** AI 思考时棋盘右上角的小沙漏（旋转交给 CSS，reduced 下静止） */
export function hourglassSVG(size: number): string {
  return (
    `<svg class="gmk-sandicon" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">` +
    `<rect x="5" y="2" width="14" height="2.6" rx="1.3" fill="#96652F"/>` +
    `<rect x="5" y="19.4" width="14" height="2.6" rx="1.3" fill="#96652F"/>` +
    `<path d="M7 5h10c0 3.2-2.2 4.6-3.6 5.9L12 12l-1.4-1.1C9.2 9.6 7 8.2 7 5z" fill="#F5D9AE" stroke="#C79A66" stroke-width="1"/>` +
    `<path d="M7 19h10c0-3.2-2.2-4.6-3.6-5.9L12 12l-1.4 1.1C9.2 14.4 7 15.8 7 19z" fill="#F5D9AE" stroke="#C79A66" stroke-width="1"/>` +
    `<path d="M9.4 6h5.2c-.5 1.6-1.6 2.4-2.6 3.2C11 8.4 9.9 7.6 9.4 6z" fill="#E8B45C"/>` +
    `<path d="M12 14.4l2.6 3.6H9.4L12 14.4z" fill="#E8B45C"/>` +
    `</svg>`
  );
}
